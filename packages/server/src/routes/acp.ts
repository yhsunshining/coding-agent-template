import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { v4 as uuidv4 } from 'uuid'
import {
  ACP_PROTOCOL_VERSION,
  NEX_AGENT_INFO,
  JSON_RPC_ERRORS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type InitializeResult,
  type SessionNewResult,
  type SessionPromptParams,
  type AgentCallbackMessage,
  type ExtendedSessionUpdate,
} from '@coder/shared'
import { cloudbaseAgentService, getSupportedModels } from '../agent/cloudbase-agent.service.js'
import { persistenceService } from '../agent/persistence.service.js'
import { loadConfig } from '../config/store.js'
import { getDb } from '../db/index.js'
import { nanoid } from 'nanoid'
import { requireUserEnv, type AppEnv } from '../middleware/auth.js'

const acp = new Hono<AppEnv>()

// 除 /health 外，所有 ACP 路由都需要登录 + 用户环境校验
acp.use('/*', async (c, next) => {
  if (c.req.path.endsWith('/health') || c.req.path.endsWith('/config')) {
    return next()
  }
  return requireUserEnv(c, next)
})

// ─── JSON-RPC Helper Functions ────────────────────────────────────────────

function rpcOk<T>(id: number | string, result: T): JsonRpcResponse<T> {
  return { jsonrpc: '2.0', id, result }
}

function rpcErr(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  }
}

// ─── Health Check ──────────────────────────────────────────────────────────

acp.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'acp' })
})

// ─── Conversation CRUD ─────────────────────────────────────────────────────

/**
 * 创建新会话
 */
acp.post('/conversation', async (c) => {
  const body = await c.req.json<{ title?: string; conversationId?: string }>()
  const conversationId = body?.conversationId || uuidv4()
  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!

  if (!envId) {
    return c.json({ error: 'CloudBase environment not bound' }, 400)
  }

  // 检查会话是否已存在
  const exists = await persistenceService.conversationExists(conversationId, userId, envId)
  if (exists) {
    return c.json({ conversationId, exists: true })
  }

  // 会话记录会在第一次 prompt 时自动创建
  return c.json({ conversationId })
})

/**
 * 获取会话列表
 * 注：简化实现，返回最近有消息的会话
 */
acp.get('/conversations', async (c) => {
  // 简化实现：从消息记录中聚合会话列表
  // 实际项目中应该有单独的会话表
  return c.json({ total: 0, data: [] })
})

/**
 * 获取会话消息记录（分页）
 */
acp.get('/conversation/records', async (c) => {
  const conversationId = c.req.query('conversationId')
  const limit = parseInt(c.req.query('limit') || '10')
  const sort = (c.req.query('sort') || 'DESC') as 'ASC' | 'DESC'
  const type = c.req.query('type') || 'agui'

  if (!conversationId) {
    return c.json({ error: 'conversationId is required' }, 400)
  }

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json({ error: 'CloudBase environment not bound' }, 400)
  }

  const records = await persistenceService.loadDBMessages(conversationId, envId, userId, limit)

  // 过滤内容类型
  const ALLOWED_CONTENT_TYPES = new Set(['text', 'tool_use', 'tool_result', 'reasoning'])
  const filteredRecords = records.map((record) => ({
    ...record,
    parts: (record.parts || []).filter((p) => ALLOWED_CONTENT_TYPES.has(p.contentType)),
  }))

  // AGUI 格式转换
  if (type === 'agui') {
    const DB_TO_AGUI_CONTENT_TYPE: Record<string, string> = {
      tool_call: 'tool_use',
    }
    for (const record of filteredRecords) {
      for (const part of record.parts) {
        if (DB_TO_AGUI_CONTENT_TYPE[part.contentType]) {
          part.contentType = DB_TO_AGUI_CONTENT_TYPE[part.contentType] as any
        }
        if (part.contentType === 'tool_result' && typeof part.content === 'string') {
          try {
            const contents = JSON.parse(part.content)
            const arr = Array.isArray(contents) ? contents : [contents]
            part.content = arr
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text || '')
              .join('')
          } catch {
            // 保持原样
          }
        }
      }
    }
  }

  return c.json({ total: records.length, data: filteredRecords })
})

/**
 * 获取会话消息
 */
acp.get('/conversation/:conversationId/messages', async (c) => {
  const conversationId = c.req.param('conversationId')
  const limit = parseInt(c.req.query('limit') || '50')
  const sort = (c.req.query('sort') || 'DESC') as 'ASC' | 'DESC'

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json({ error: 'CloudBase environment not bound' }, 400)
  }

  const records = await persistenceService.loadDBMessages(conversationId, envId, userId, limit)

  // 转换为前端格式
  const data = records.map((r) => ({
    recordId: r.recordId,
    conversationId: r.conversationId,
    role: r.role,
    parts: r.parts,
    createTime: r.createTime,
  }))

  if (sort === 'DESC') {
    data.reverse()
  }

  return c.json({ total: data.length, data })
})

/**
 * 删除会话
 * 注：简化实现，暂不支持删除
 */
acp.delete('/conversation/:conversationId', async (c) => {
  // 简化实现
  return c.json({ status: 'success' })
})

// ─── Chat Endpoint (SSE) ───────────────────────────────────────────────────

/**
 * POST /api/agent/chat
 *
 * 简单的聊天端点，返回 SSE 流式响应
 */
acp.post('/chat', async (c) => {
  const body = await c.req.json<{ prompt: string; conversationId?: string; model?: string }>()
  const { prompt, conversationId, model } = body

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json({ error: 'CloudBase environment not bound' }, 400)
  }

  // 创建或使用现有会话
  const actualConversationId = conversationId || uuidv4()
  const cwd = `/tmp/workspace/${actualConversationId}`

  return streamSSE(c, async (stream) => {
    // 发送会话信息
    await stream.writeSSE({
      data: JSON.stringify({
        type: 'session',
        conversationId: actualConversationId,
      }),
    })

    let fullContent = ''
    let stopReason: 'end_turn' | 'cancelled' | 'error' = 'end_turn'

    const callback = async (msg: AgentCallbackMessage) => {
      if (msg.type === 'text' && msg.content) {
        fullContent += msg.content
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'text',
            content: msg.content,
          }),
        })
      } else if (msg.type === 'thinking' && msg.content) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'thinking',
            content: msg.content,
          }),
        })
      } else if (msg.type === 'tool_use') {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'tool_use',
            name: msg.name,
            input: msg.input,
            id: msg.id,
          }),
        })
      } else if (msg.type === 'tool_result') {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'tool_result',
            tool_use_id: msg.tool_use_id,
            content: msg.content,
            is_error: msg.is_error,
          }),
        })
      } else if (msg.type === 'error') {
        stopReason = 'error'
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            content: msg.content,
          }),
        })
      } else if (msg.type === 'result') {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'result',
          }),
        })
      }
    }

    try {
      await cloudbaseAgentService.chatStream(prompt, callback, {
        conversationId: actualConversationId,
        envId,
        userId,
        userCredentials,
        cwd,
        model,
      })
    } catch (error) {
      stopReason = 'error'
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          content: error instanceof Error ? error.message : String(error),
        }),
      })
    }

    // 发送结束标记
    await stream.writeSSE({ data: '[DONE]' })
  })
})

// ─── ACP JSON-RPC 2.0 Endpoint ─────────────────────────────────────────────

/**
 * POST /api/agent/acp
 *
 * ACP JSON-RPC 2.0 协议端点，支持：
 * - initialize: 协议握手
 * - session/new: 创建会话
 * - session/load: 加载会话
 * - session/prompt: 发送消息（SSE 流式响应）
 * - session/cancel: 取消请求
 */
acp.post('/acp', async (c) => {
  const body: JsonRpcRequest = await c.req.json()

  // 验证 JSON-RPC 请求
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    return c.json(rpcErr(body?.id ?? null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request'), 400)
  }

  const { id, method, params } = body
  const isNotification = id === undefined || id === null

  // 根据方法路由
  switch (method) {
    case 'initialize':
      return handleInitialize(c, id!)

    case 'session/new':
      return handleSessionNew(c, id!, params)

    case 'session/load':
      return handleSessionLoad(c, id!, params)

    case 'session/prompt':
      return handleSessionPrompt(c, id!, params as unknown as SessionPromptParams)

    case 'session/cancel':
      return handleSessionCancel(c, id ?? null, params, isNotification)

    default:
      if (isNotification) {
        return c.text('', 200)
      }
      return c.json(rpcErr(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method '${method}' not found`))
  }
})

// ─── ACP Method Handlers ───────────────────────────────────────────────────

async function handleInitialize(c: any, id: number | string) {
  // 异步获取支持的模型列表（首次会调 SDK，后续走缓存）
  getSupportedModels().catch(() => {})
  const models = await getSupportedModels()
  const result: InitializeResult = {
    protocolVersion: ACP_PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: false,
      },
    },
    agentInfo: NEX_AGENT_INFO,
    authMethods: [],
    supportedModels: models,
  }
  return c.json(rpcOk(id, result))
}

async function handleSessionNew(c: any, id: number | string, params: Record<string, unknown> | undefined) {
  const conversationId = (params?.conversationId as string) || uuidv4()
  const sessionId = conversationId

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, 'CloudBase environment not bound'))
  }

  try {
    // 检查会话是否已存在
    const exists = await persistenceService.conversationExists(conversationId, userId, envId)

    let hasHistory = false
    if (exists) {
      // 检查是否有历史消息
      const messages = await persistenceService.loadDBMessages(conversationId, envId, userId, 1)
      hasHistory = messages.length > 0
    }

    const result: SessionNewResult = { sessionId, hasHistory }
    return c.json(rpcOk(id, result))
  } catch (error) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, (error as Error).message))
  }
}

async function handleSessionLoad(c: any, id: number | string, params: Record<string, unknown> | undefined) {
  const sessionId = params?.sessionId as string

  if (!sessionId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'sessionId is required'))
  }

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, 'CloudBase environment not bound'))
  }

  const exists = await persistenceService.conversationExists(sessionId, userId, envId)

  if (!exists) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, `Session '${sessionId}' not found`))
  }

  return c.json(rpcOk(id, { sessionId }))
}

async function handleSessionPrompt(c: any, id: number | string, params: SessionPromptParams) {
  const sessionId = params?.sessionId

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, 'CloudBase environment not bound'))
  }

  // 检查会话是否存在，不存在则自动创建
  const exists = await persistenceService.conversationExists(sessionId, userId, envId)
  // Session will be auto-created by agent during chatStream (first prompt creates it)

  // 检查是否正在处理中
  const latestStatus = await persistenceService.getLatestRecordStatus(sessionId, userId, envId)
  if (latestStatus && (latestStatus.status === 'pending' || latestStatus.status === 'streaming')) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_REQUEST, 'A prompt turn is already in progress'))
  }

  // 提取 prompt 文本
  const prompt: string = (params?.prompt ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  if (!prompt.trim()) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'prompt must contain at least one text block'))
  }

  const cwd = `/tmp/workspace/${sessionId}`

  // 读取 task 的 selectedModel
  let selectedModel: string | undefined
  try {
    const task = await getDb().tasks.findById(sessionId)
    selectedModel = task?.selectedModel || undefined
  } catch {
    // read failure doesn't affect main flow
  }

  // Update task status to pending
  try {
    await getDb().tasks.update(sessionId, { status: 'pending', updatedAt: Date.now() })
  } catch {
    // write failure doesn't affect main flow
  }

  // 返回 SSE 流式响应
  return streamSSE(c, async (stream) => {
    let fullContent = ''
    let stopReason: 'end_turn' | 'cancelled' | 'error' = 'end_turn'

    // Helper to send extended session updates
    const notify = async (method: string, notifParams: { sessionId: string; update: ExtendedSessionUpdate }) => {
      await stream.writeSSE({
        data: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: notifParams,
        }),
      })
    }

    const callback = async (msg: AgentCallbackMessage) => {
      if (msg.type === 'text' && msg.content) {
        fullContent += msg.content
        await notify('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: msg.content },
          },
        })
      } else if (msg.type === 'thinking' && msg.content) {
        await notify('session/update', {
          sessionId,
          update: { sessionUpdate: 'agent_thought_chunk', content: msg.content },
        })
      } else if (msg.type === 'tool_use') {
        const toolCallId = msg.id || uuidv4()
        await notify('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId,
            title: msg.name || 'tool',
            kind: 'function',
            status: 'in_progress',
            input: msg.input,
          },
        })
      } else if (msg.type === 'tool_result') {
        await notify('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: msg.tool_use_id || '',
            status: msg.is_error ? 'failed' : 'completed',
            result: msg.content,
          },
        })
      } else if (msg.type === 'error') {
        stopReason = 'error'
        await notify('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'log',
            level: 'error',
            message: msg.content || 'Unknown error',
            timestamp: Date.now(),
          },
        })
      } else if (msg.type === 'deploy_url') {
        // Create or update deployment
        const deploymentType = msg.deploymentType || 'web'
        const now = Date.now()

        try {
          if (deploymentType === 'miniprogram') {
            // Single miniprogram per task
            const existing = await getDb().deployments.findByTaskIdAndTypePath(sessionId, 'miniprogram', null)

            if (existing) {
              await getDb().deployments.update(existing.id, {
                qrCodeUrl: msg.qrCodeUrl || existing.qrCodeUrl,
                pagePath: msg.pagePath || existing.pagePath,
                appId: msg.appId || existing.appId,
                label: msg.label || existing.label,
                metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : existing.metadata,
                updatedAt: now,
              })
            } else {
              await getDb().deployments.create({
                id: nanoid(12),
                taskId: sessionId,
                type: 'miniprogram',
                url: null,
                path: null,
                qrCodeUrl: msg.qrCodeUrl || null,
                pagePath: msg.pagePath || null,
                appId: msg.appId || null,
                label: msg.label || null,
                metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : null,
                createdAt: now,
                updatedAt: now,
              })
            }
          } else if (msg.url) {
            // Web deployment with URL
            let path: string | null = null
            try {
              const urlObj = new URL(msg.url)
              path = urlObj.pathname
            } catch {
              /* ignore */
            }

            if (path) {
              const existing = await getDb().deployments.findByTaskIdAndTypePath(sessionId, 'web', path)

              if (existing) {
                await getDb().deployments.update(existing.id, {
                  url: msg.url,
                  label: msg.label || existing.label,
                  metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : existing.metadata,
                  updatedAt: now,
                })
              } else {
                await getDb().deployments.create({
                  id: nanoid(12),
                  taskId: sessionId,
                  type: 'web',
                  url: msg.url,
                  path,
                  qrCodeUrl: null,
                  pagePath: null,
                  appId: null,
                  label: msg.label || null,
                  metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : null,
                  createdAt: now,
                  updatedAt: now,
                })
              }
            }
          }

          // Also update legacy previewUrl for backward compatibility
          if (msg.url) {
            await getDb().tasks.update(sessionId, { previewUrl: msg.url })
          }
        } catch (err) {
          console.error('Failed to create deployment:', err)
        }

        await notify('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'deploy_url',
            url: msg.url,
            type: deploymentType,
            qrCodeUrl: msg.qrCodeUrl,
            pagePath: msg.pagePath,
            appId: msg.appId,
            label: msg.label,
          },
        })
      } else if (msg.type === 'artifact' && msg.artifact) {
        await notify('session/update', {
          sessionId,
          update: { sessionUpdate: 'artifact', artifact: msg.artifact },
        })
      }
    }

    try {
      await cloudbaseAgentService.chatStream(prompt, callback, {
        conversationId: sessionId,
        envId,
        userId,
        userCredentials,
        cwd,
        model: selectedModel,
      })
    } catch (error) {
      stopReason = 'error'
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[ACP] chatStream error:', errMsg)
      await notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'log',
          level: 'error',
          message: errMsg,
          timestamp: Date.now(),
        },
      })
    }

    // 更新 task 状态（消息已由 PersistenceService 存入 CloudBase，不需再写 SQLite）
    try {
      await getDb().tasks.update(sessionId, {
        status: stopReason === 'error' ? 'error' : 'completed',
        completedAt: Date.now(),
        updatedAt: Date.now(),
      })
    } catch (dbErr) {
      console.error('[ACP] Failed to update task status:', dbErr)
    }

    // 发送最终响应
    await stream.writeSSE({
      data: JSON.stringify(rpcOk(id, { stopReason })),
    })

    // 发送结束标记
    await stream.writeSSE({ data: '[DONE]' })
  })
}

async function handleSessionCancel(
  c: any,
  id: number | string | null,
  params: Record<string, unknown> | undefined,
  isNotification: boolean,
) {
  const sessionId = params?.sessionId as string

  const { envId, userId, credentials: userCredentials } = c.get('userEnv')!

  if (sessionId && envId) {
    // 获取最新消息并更新状态为 cancel
    const latestStatus = await persistenceService.getLatestRecordStatus(sessionId, userId, envId)
    if (latestStatus && (latestStatus.status === 'pending' || latestStatus.status === 'streaming')) {
      await persistenceService.updateRecordStatus(latestStatus.recordId, 'cancel')
    }
  }

  if (isNotification) {
    return c.text('', 200)
  }

  return c.json(rpcOk(id ?? '', null))
}

// ─── LLM Config Endpoint ───────────────────────────────────────────────────

/**
 * GET /api/agent/config
 *
 * 获取当前 LLM 配置状态
 */
acp.get('/config', (c) => {
  const config = loadConfig()
  return c.json({
    configured: !!(config.llm?.apiKey && config.llm?.endpoint),
    model: config.llm?.model || 'claude-3-5-sonnet-20241022',
  })
})

export default acp
