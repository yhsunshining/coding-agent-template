import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, ExecutionError } from '@tencent-ai/agent-sdk'
import { z } from 'zod'
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { v4 as uuidv4 } from 'uuid'
import { loadConfig } from '../config/store.js'
import { persistenceService } from './persistence.service.js'
import { scfSandboxManager, type SandboxInstance } from '../sandbox/scf-sandbox-manager.js'
import { createSandboxMcpClient } from '../sandbox/sandbox-mcp-proxy.js'
import { archiveToGit } from '../sandbox/git-archive.js'
import type { AgentCallbackMessage, AgentOptions, CodeBuddyMessage } from '@coder/shared'

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'glm-5.0'
const OAUTH_TOKEN_ENDPOINT = 'https://copilot.tencent.com/oauth2/token'
const CONNECT_TIMEOUT_MS = 60_000
const ITERATION_TIMEOUT_MS = 30 * 1000
const HEALTH_MAX_RETRIES = 20
const HEALTH_INTERVAL_MS = 2000

// ─── Supported Models Cache ───────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  vendor?: string
  credits?: string
  supportsImages?: boolean
  supportsReasoning?: boolean
  supportsToolCall?: boolean
  tags?: string[]
  [key: string]: any
}

let cachedModels: ModelInfo[] | null = null

// Static model list (temporary, replace with dynamic fetch when ready)
const STATIC_MODELS: ModelInfo[] = [
  { id: 'minimax-m2.5', name: 'MiniMax-M2.5' },
  { id: 'kimi-k2.5', name: 'Kimi-K2.5' },
  { id: 'kimi-k2-thinking', name: 'Kimi-K2-Thinking' },
  { id: 'glm-5.0', name: 'GLM-5.0' },
  { id: 'glm-4.7', name: 'GLM-4.7' },
  { id: 'deepseek-v3-2-volc', name: 'DeepSeek-V3.2' },
]

// Dynamic model fetch from SDK (reserved for future use)
async function fetchSupportedModels(): Promise<ModelInfo[]> {
  try {
    const q = query({ prompt: '', options: { permissionMode: 'bypassPermissions' } })
    const models = await q.supportedModels()
    q.return?.()
    if (Array.isArray(models) && models.length > 0) {
      return models.map((m: any) =>
        typeof m === 'string'
          ? { id: m, name: m }
          : { id: m.id || m.name || DEFAULT_MODEL, name: m.name || m.id || DEFAULT_MODEL, ...m },
      )
    }
  } catch (e) {
    console.warn('[Agent] Failed to fetch supported models from SDK:', e)
  }
  return [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL }]
}

export async function getSupportedModels(): Promise<ModelInfo[]> {
  if (cachedModels) return cachedModels
  // TODO: switch to dynamic fetch when SDK is ready
  // cachedModels = await fetchSupportedModels()
  cachedModels = STATIC_MODELS
  return cachedModels
}

// ─── Sandbox Helpers ──────────────────────────────────────────────────────

/**
 * 等待沙箱健康检查就绪（轮询 /health）
 */
async function waitForSandboxHealth(sandbox: SandboxInstance, callback: AgentCallback): Promise<boolean> {
  for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
    try {
      const res = await sandbox.request('/health', {
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        console.log('[Agent] Sandbox health check passed')
        return true
      }
    } catch {
      // 继续轮询
    }
    if (i === 0) {
      callback({ type: 'text', content: '正在等待工作空间就绪...\n' })
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
  }
  return false
}

/**
 * 初始化沙箱工作空间：POST /api/session/init 注入凭证和环境变量
 * 返回容器内的工作目录路径（可能为 undefined）
 */
async function initSandboxWorkspace(
  sandbox: SandboxInstance,
  secret: { envId: string; secretId: string; secretKey: string; token?: string },
): Promise<string | undefined> {
  try {
    const res = await sandbox.request('/api/session/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: {
          CLOUDBASE_ENV_ID: secret.envId,
          TENCENTCLOUD_SECRETID: secret.secretId,
          TENCENTCLOUD_SECRETKEY: secret.secretKey,
          ...(secret.token ? { TENCENTCLOUD_SESSIONTOKEN: secret.token } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (res.ok) {
      const data = (await res.json()) as any
      console.log('[Agent] initSandboxWorkspace success, workspace:', data?.workspace)
      return data?.workspace || undefined
    }
    console.error('[Agent] initSandboxWorkspace failed, status:', res.status)
  } catch (e) {
    console.error('[Agent] initSandboxWorkspace error:', (e as Error).message)
  }
  return undefined
}

/**
 * 需要用户确认的写操作 MCP 工具集合。
 * canUseTool 中对这些工具发起 interrupt，等待客户端确认后再执行。
 * 可通过 bypassToolConfirmation=true 跳过确认。
 */
const WRITE_TOOLS = true
  ? new Set([])
  : new Set([
      // 数据库相关 (4个)
      'writeNoSqlDatabaseStructure', // 修改 NoSQL 数据库结构
      'writeNoSqlDatabaseContent', // 修改 NoSQL 数据库内容
      'executeWriteSQL', // 执行写入 SQL
      'modifyDataModel', // 修改数据模型

      // 云函数相关 (7个)
      'createFunction', // 创建云函数
      'updateFunctionCode', // 更新云函数代码
      'updateFunctionConfig', // 更新云函数配置
      'invokeFunction', // 调用云函数
      'manageFunctionTriggers', // 管理云函数触发器
      'writeFunctionLayers', // 管理云函数层
      'createFunctionHTTPAccess', // 创建云函数 HTTP 访问

      // 存储相关 (2个) - uploadFiles 不拦截（静态托管部署需要）
      'deleteFiles', // 删除文件
      'manageStorage', // 管理云存储

      // 其他 (5个)
      'domainManagement', // 域名管理
      'interactiveDialog', // 交互式对话
      'manageCloudRun', // 管理云托管
      'writeSecurityRule', // 写入安全规则
      'activateInviteCode', // 激活邀请码
      'callCloudApi', // 调用云 API
    ])

// ─── Types ─────────────────────────────────────────────────────────────────

interface ToolCallInfo {
  name: string
  input: unknown
  inputJson: string
}

interface ToolCallTracker {
  pendingToolCalls: Map<string, ToolCallInfo>
  blockIndexToToolId: Map<number, string>
  toolInputJsonBuffers: Map<string, string>
}

type AgentCallback = (message: AgentCallbackMessage) => void | Promise<void>

// ─── OAuth Token Cache ────────────────────────────────────────────────────

let cachedToken: { token: string; expiry: number } | null = null

/**
 * 通过 OAuth2 client_credentials 获取 auth token
 * 参考 tcb-headless-service getOAuthToken 实现
 */
async function getOAuthToken(): Promise<string> {
  // 检查缓存
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token
  }

  const clientId = process.env.CODEBUDDY_CLIENT_ID
  const clientSecret = process.env.CODEBUDDY_CLIENT_SECRET
  const endpoint = process.env.CODEBUDDY_OAUTH_ENDPOINT || OAUTH_TOKEN_ENDPOINT

  if (!clientId || !clientSecret) {
    throw new Error('Missing CODEBUDDY_CLIENT_ID or CODEBUDDY_CLIENT_SECRET environment variables')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  if (!data.access_token) {
    throw new Error('OAuth2 response missing access_token')
  }

  const token = data.access_token
  const expiresIn = data.expires_in || 3600
  // 提前 60 秒过期，避免边界问题
  const expiry = Date.now() + expiresIn * 1000 - 60000

  cachedToken = { token, expiry }

  return token
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function createToolCallTracker(): ToolCallTracker {
  return {
    pendingToolCalls: new Map(),
    blockIndexToToolId: new Map(),
    toolInputJsonBuffers: new Map(),
  }
}

/**
 * Get the path to the tool-override module for injection
 */
function getToolOverridePath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  // Use pre-compiled CJS file since CLI subprocess can't load .ts directly
  return path.resolve(__dirname, '../../dist/sandbox/tool-override.cjs')
}

// ─── System Prompt Builder ─────────────────────────────────────────────────

function buildAppendPrompt(sandboxCwd?: string, conversationId?: string, envId?: string): string {
  const base = `你是一个通用 AI 编程助手，同时具备腾讯云开发（CloudBase）能力，可通过工具操作云函数、数据库、存储、云托管等资源。
优先使用工具完成任务；删除等破坏性操作需确认用户意图。
默认使用中文与用户沟通。

Bash 超时处理策略：对于耗时较长的命令（如 npm install、yarn install、大型项目构建等），如果执行超时：
1. 改为后台执行, 添加 run_in_background，可以获取 pid
2. 定期检查进程状态：ps aux | grep '<关键词>' | grep -v grep
3. 通过 BashOutput 结合 pid 查看输出结果
4. 也可以通过 KillShell 关闭后台执行的任务

${
  true
    ? `小程序开发规则：
当用户的需求涉及微信小程序开发（创建、修改、部署小程序项目）时：
1. 必须先使用 AskUserQuestion 工具获取用户的微信小程序 appId
   - options 的第一个选项的 label 必须固定为 "ask:miniprogram_appid"（系统据此识别问题类别并替换为预置内容）
   - 其余字段可任意填写，系统会自动替换为标准问题
   - 示例: AskUserQuestion({ questions: [{ question: "选择小程序", header: "AppId", options: [{ label: "ask:miniprogram_appid", description: "选择小程序" }, { label: "跳过", description: "跳过" }], multiSelect: false }] })
2. 获取到 appId 后，在生成 project.config.json 时使用该 appId
3. 在调用 publishMiniprogram 部署前，确保已获取到有效的 appId`
    : ''
}`

  if (sandboxCwd) {
    return `${base}

当前用户的项目工作目录为: ${sandboxCwd}
当前使用的云开发环境为: ${envId}
请注意：
- 所有文件读写、终端命令都应在此目录下执行
- 使用 cloudbase_uploadFiles 部署文件时，localPath 必须是容器内的**绝对路径**（即当前工作目录 ${sandboxCwd} 下的路径），例如 ${sandboxCwd}/index.html
- 如用户没有特别要求，cloudPath 需要为 ${conversationId}，即在当前会话路径下
- 不要使用相对路径给 cloudbase_uploadFiles`
  }
  return base
}

// ─── CloudbaseAgentService ─────────────────────────────────────────────────

export class CloudbaseAgentService {
  async chatStream(prompt: string, callback: AgentCallback, options: AgentOptions = {}): Promise<void> {
    const {
      conversationId = uuidv4(),
      envId,
      userId,
      userCredentials,
      maxTurns = 50,
      cwd,
      askAnswers,
      toolConfirmation,
      model,
    } = options
    const modelId = model || DEFAULT_MODEL
    console.log(
      '[Agent] chatStream start, model:',
      modelId,
      'conversationId:',
      conversationId,
      'prompt:',
      prompt.slice(0, 50),
    )

    const userContext = { envId: envId || '', userId: userId || 'anonymous' }
    console.log('[Agent] userContext:', JSON.stringify(userContext))

    const actualCwd = cwd || `/tmp/workspace/${conversationId}`
    mkdirSync(actualCwd, { recursive: true })
    console.log('[Agent] cwd:', actualCwd)

    // ── 从 DB 恢复消息历史 ────────────────────────────────────────────
    let historicalMessages: CodeBuddyMessage[] = []
    let lastRecordId: string | null = null
    let hasHistory = false
    let sandboxMcpClient: Awaited<ReturnType<typeof createSandboxMcpClient>> | null = null

    // askAnswers / toolConfirmation 场景标记为 resume
    const isResumeFromInterrupt = (askAnswers && Object.keys(askAnswers).length > 0) || !!toolConfirmation

    // 本次 assistant 回复的统一 ID，与 DB recordId 保持一致
    // resume 场景下会在 restoreMessages 后更新为 DB 中最后一条 assistant record 的 id
    let assistantMessageId = uuidv4()

    // resume 场景：先从 DB 获取最新的 assistant record id
    if (isResumeFromInterrupt && conversationId && userContext.envId) {
      const record = await persistenceService.getLatestRecordStatus(
        conversationId,
        userContext.userId,
        userContext.envId,
      )
      if (record) {
        assistantMessageId = record.recordId
      }
    }

    if (conversationId && userContext.envId) {
      // Resume + askAnswers 场景：先直接更新 DB，再 restore 即可拿到最新数据
      // 新结构：askAnswers[messageId] = { toolCallId, answers }，用 toolCallId 作为 callId
      if (askAnswers && Object.keys(askAnswers).length > 0) {
        for (const [recordId, { toolCallId, answers }] of Object.entries(askAnswers)) {
          const output = {
            type: 'text',
            text: Object.entries(answers)
              .map(([key, value]) => ` · ${key} → ${value}`)
              .join('\n'),
          }
          await persistenceService.updateToolResult(conversationId, recordId, toolCallId, output, 'completed')
        }
      }

      // Resume + toolConfirmation 场景：处理用户确认结果
      if (toolConfirmation) {
        const isAllowed = toolConfirmation.payload.action === 'allow'

        if (isAllowed && sandboxMcpClient) {
          // allow: 通过 MCP client 调用工具获取真实结果
          const mcpClient = sandboxMcpClient.client
          const toolCallInfo = await persistenceService.getToolCallInfo(
            conversationId,
            assistantMessageId,
            toolConfirmation.interruptId,
          )

          if (toolCallInfo) {
            const normalizedToolName = toolCallInfo.toolName.startsWith('mcp__')
              ? toolCallInfo.toolName.split('__').slice(2).join('__') || toolCallInfo.toolName
              : toolCallInfo.toolName

            try {
              // 通过 MCP client 调用工具
              const res = (await mcpClient.callTool({
                name: normalizedToolName,
                arguments: toolCallInfo.input,
              })) as { content?: Record<string, unknown> }
              const toolResult: Record<string, unknown> = res.content || { result: res }
              await persistenceService.updateToolResult(
                conversationId,
                assistantMessageId,
                toolConfirmation.interruptId,
                {
                  type: 'text',
                  text: JSON.stringify(toolResult),
                },
                'completed',
              )
            } catch (err) {
              // 工具执行失败，记录错误
              const errorResult = {
                error: true,
                message: (err as Error).message || '工具执行失败',
              }
              await persistenceService.updateToolResult(
                conversationId,
                assistantMessageId,
                toolConfirmation.interruptId,
                {
                  type: 'text',
                  text: JSON.stringify(errorResult),
                },
                'error',
              )
            }
          }
        } else {
          // deny 或无 MCP client: 更新为拒绝消息
          await persistenceService.updateToolResult(
            conversationId,
            assistantMessageId,
            toolConfirmation.interruptId,
            {
              type: 'text',
              text: '用户拒绝了此操作',
            },
            'completed',
          )
        }
      }

      // 从 DB 恢复消息历史（askAnswers / toolConfirmation 场景下 DB 已是最新）
      const restored = await persistenceService.restoreMessages(
        conversationId,
        userContext.envId,
        userContext.userId,
        actualCwd,
      )
      historicalMessages = restored.messages
      lastRecordId = restored.lastRecordId
      hasHistory = historicalMessages.length > 0

      // resume interrupt 场景下，即使 DB 中无历史，
      // 只要有 conversationId 就强制走 resume 路径
      if (!hasHistory && isResumeFromInterrupt) {
        hasHistory = true
      }
    }

    // ── 预保存 pending 记录 ──────────────────────────────────────────
    // resume 场景跳过预保存（assistant 记录已存在）
    let preSavedUserRecordId: string | null = null

    if (conversationId && userContext.envId && !isResumeFromInterrupt) {
      const preSaved = await persistenceService.preSavePendingRecords({
        conversationId,
        envId: userContext.envId,
        userId: userContext.userId,
        prompt,
        prevRecordId: lastRecordId,
        assistantRecordId: assistantMessageId,
      })
      preSavedUserRecordId = preSaved.userRecordId
    }

    const wrappedCallback: AgentCallback = (msg) => {
      // 对于 ask_user 和 tool_confirm，保留原始 id (toolCallId)，同时添加 assistantMessageId
      if (msg.type === 'ask_user' || msg.type === 'tool_confirm') {
        callback({ ...msg, assistantMessageId })
      } else {
        callback({ ...msg, id: msg.id || assistantMessageId, assistantMessageId })
      }
    }

    // ── 获取 SCF 沙箱 ────────────────────────────────────────────────
    let sandboxInstance: SandboxInstance | null = null
    let toolOverrideConfig: { url: string; headers: Record<string, string> } | null = null

    const sandboxEnabled = process.env.TCB_ENV_ID && process.env.SCF_SANDBOX_IMAGE_URI

    if (sandboxEnabled) {
      try {
        sandboxInstance = await scfSandboxManager.getOrCreate(conversationId, userContext.envId, {
          mode: 'shared',
        })

        toolOverrideConfig = await sandboxInstance.getToolOverrideConfig()

        // ── 健康检查：等待沙箱就绪 ──────────────────────────────────
        const sandboxReady = await waitForSandboxHealth(sandboxInstance, wrappedCallback)
        if (!sandboxReady) {
          wrappedCallback({ type: 'text', content: '沙箱启动超时，将使用受限模式继续对话。\n\n' })
          sandboxInstance = null
        } else {
          // ── 初始化工作空间：注入【登录用户凭证】──────────────────
          const sandboxCwd = await initSandboxWorkspace(sandboxInstance, {
            envId: userContext.envId,
            secretId: userCredentials?.secretId || '',
            secretKey: userCredentials?.secretKey || '',
            token: userCredentials?.sessionToken,
          })
          if (sandboxCwd) {
            wrappedCallback({ type: 'session', sandboxCwd } as any)
            console.log(`[Agent] Sandbox workspace initialized, cwd: ${sandboxCwd}`)
          }

          // Create sandbox MCP client，使用【登录用户凭证】操作 CloudBase 资源
          sandboxMcpClient = await createSandboxMcpClient({
            baseUrl: sandboxInstance.baseUrl,
            sessionId: conversationId,
            getAccessToken: () => sandboxInstance!.getAccessToken(),
            getCredentials: async () => ({
              cloudbaseEnvId: userContext.envId,
              secretId: userCredentials?.secretId || '',
              secretKey: userCredentials?.secretKey || '',
              sessionToken: userCredentials?.sessionToken,
            }),
            workspaceFolderPaths: actualCwd,
            log: (msg) => console.log(msg),
            onDeployUrl: (url) => {
              wrappedCallback({ type: 'deploy_url', url })
            },
          })

          console.log(`[Agent] Sandbox ready: ${sandboxInstance.functionName}`)
        }
      } catch (err) {
        console.error('[Agent] Sandbox creation failed:', (err as Error).message)
        wrappedCallback({
          type: 'text',
          content: `【沙箱环境创建失败】${(err as Error).message}。将使用受限模式继续对话。\n\n`,
        })
        // Continue without sandbox
      }
    }

    // ── MCP Server ────────────────────────────────────────────────────
    // Note: createSdkMcpServer objects contain Zod schemas with circular references
    // which cannot be serialized by SDK 0.3.68's ProcessTransport.buildArgs.
    // Skip custom MCP tools for now - agent has built-in tools (Read/Write/Bash/etc.)

    // ── 获取认证凭据（API Key 或 OAuth Token）───────────────────────
    const envVars: Record<string, string> = {}

    if (process.env.CODEBUDDY_API_KEY) {
      // API Key 模式 - 直接使用密钥，无需 token 交换
      envVars.CODEBUDDY_API_KEY = process.env.CODEBUDDY_API_KEY
      if (process.env.CODEBUDDY_INTERNET_ENVIRONMENT) {
        envVars.CODEBUDDY_INTERNET_ENVIRONMENT = process.env.CODEBUDDY_INTERNET_ENVIRONMENT
      }
    } else {
      // OAuth 模式 - 通过 client_credentials 获取 token
      const authToken = await getOAuthToken()
      envVars.CODEBUDDY_AUTH_TOKEN = authToken
    }

    let connectTimer: ReturnType<typeof setTimeout> | undefined
    let iterationTimeoutTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const sessionOpts: Record<string, unknown> = hasHistory
        ? { resume: conversationId, sessionId: conversationId }
        : { persistSession: true, sessionId: conversationId }

      // Build env vars for tool override

      if (toolOverrideConfig) {
        envVars.CODEBUDDY_TOOL_OVERRIDE = getToolOverridePath()
        envVars.CODEBUDDY_TOOL_OVERRIDE_CONFIG = JSON.stringify(toolOverrideConfig)
      }

      // Build MCP servers config - pass the SDK-wrapped McpServer to query()
      const mcpServers: Record<string, any> = {}

      if (sandboxMcpClient) {
        mcpServers.cloudbase = sandboxMcpClient.sdkServer
      }

      // ── 执行 query ─────────────────────────────────────────────────
      const abortController = new AbortController()

      // 用于在 canUseTool 中捕获被中断的写工具调用信息
      const pendingToolInterrupt: {
        value: { callId: string; toolName: string; input: unknown } | null
      } = { value: null }

      // 构建 query 参数 - 和 tcb-headless-service buildQueryOptions 一致
      // 注意: cwd 必须是本地路径, 即使沙箱启用. 沙箱只提供 MCP 工具, agent 进程在本地运行.
      const queryArgs = {
        prompt,
        options: {
          model: modelId,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          maxTurns,
          cwd: actualCwd,
          ...sessionOpts,
          includePartialMessages: true,
          systemPrompt: {
            append: buildAppendPrompt(actualCwd, conversationId, userContext.envId),
          },
          mcpServers,
          abortController,
          canUseTool: async (toolName: string, input: unknown, _options: unknown) => {
            const toolUseId = (_options as any)?.toolUseID

            // AskUserQuestion 处理
            if (toolName === 'AskUserQuestion') {
              // Resume 场景：已有用户答案（新结构：通过 toolCallId 匹配）
              if (askAnswers) {
                const matched = Object.values(askAnswers).find((v) => v.toolCallId === toolUseId)
                if (matched && Object.keys(matched.answers).length > 0) {
                  const resolvedInput = { ...(input as Record<string, unknown>), answers: matched.answers }
                  return {
                    behavior: 'allow' as const,
                    updatedInput: resolvedInput,
                  }
                }
              }

              // 通知前端需要用户回答
              wrappedCallback({
                type: 'ask_user',
                id: toolUseId,
                input: input as Record<string, unknown>,
              })

              return {
                behavior: 'deny' as const,
                message: '等待用户回答问题',
                interrupt: true,
              }
            }

            // 写工具确认处理（提取工具名，去掉 mcp__server__ 前缀）
            const normalizedToolName = toolName.startsWith('mcp__')
              ? toolName.split('__').slice(2).join('__') || toolName
              : toolName

            if (WRITE_TOOLS.has(normalizedToolName)) {
              // Resume 场景：已有用户确认结果
              if (toolConfirmation && toolConfirmation.interruptId === toolUseId) {
                if (toolConfirmation.payload.action === 'allow') {
                  return {
                    behavior: 'allow' as const,
                    updatedInput: input as Record<string, unknown>,
                  }
                }
                return { behavior: 'deny' as const, message: '用户拒绝了此操作' }
              }

              // 捕获工具调用信息供 catch 持久化
              if (toolUseId && pendingToolInterrupt) {
                pendingToolInterrupt.value = {
                  callId: toolUseId,
                  toolName,
                  input: input as Record<string, unknown>,
                }
              }

              // 通知前端需要确认
              wrappedCallback({
                type: 'tool_confirm',
                id: toolUseId,
                name: toolName,
                input: input as Record<string, unknown>,
              })

              return {
                behavior: 'deny' as const,
                message: '等待用户确认写操作',
                interrupt: true,
              }
            }

            return { behavior: 'allow' as const, updatedInput: input as Record<string, unknown> }
          },
          hooks: {
            PreToolUse: [
              {
                // 匹配所有 MCP 工具（mcp__ 开头）
                matcher: '^mcp__',
                hooks: [
                  async (hookInput: unknown, toolUseId: string, { signal }: { signal: unknown }) => {
                    const toolName = (hookInput as any).tool_name
                    const toolInput = (hookInput as any).tool_input
                    const actualToolUseId = toolUseId || (hookInput as any).tool_use_id

                    // 提取工具名（去掉 mcp__server__ 前缀）
                    const normalizedToolName = toolName.startsWith('mcp__')
                      ? toolName.split('__').slice(2).join('__') || toolName
                      : toolName

                    // 检查是否为需要确认的写工具
                    if (WRITE_TOOLS.has(normalizedToolName)) {
                      // Resume 场景：已有用户确认结果
                      if (toolConfirmation && toolConfirmation.interruptId === actualToolUseId) {
                        if (toolConfirmation.payload.action === 'allow') {
                          return {
                            continue: true,
                            hookSpecificOutput: {
                              hookEventName: 'PreToolUse',
                              permissionDecision: 'allow',
                            },
                          }
                        }
                        return {
                          continue: false,
                          decision: 'block',
                          reason: '用户拒绝了此操作',
                          hookSpecificOutput: {
                            hookEventName: 'PreToolUse',
                            permissionDecision: 'deny',
                            permissionDecisionReason: '用户拒绝了此操作',
                          },
                        }
                      }

                      // 捕获工具调用信息供 catch 持久化
                      if (actualToolUseId && pendingToolInterrupt) {
                        pendingToolInterrupt.value = {
                          callId: actualToolUseId,
                          toolName,
                          input: toolInput as Record<string, unknown>,
                        }
                      }

                      // 返回 block 并中断
                      return {
                        continue: false,
                        decision: 'block',
                        reason: '等待用户确认写操作',
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: 'ask',
                          permissionDecisionReason: '等待用户确认写操作',
                        },
                      }
                    }

                    // 其他 MCP 工具直接允许
                    return { continue: true }
                  },
                ],
              },
            ],
          },
          env: envVars,
          stderr: (data: string) => {
            console.error('[Agent CLI stderr]', data.trim())
          },
          disallowedTools: ['AskUserQuestion'],
        },
      }

      console.log('[Agent] calling query(), model:', modelId, 'sessionOpts:', JSON.stringify(sessionOpts))
      const q = query(queryArgs as any)
      console.log('[Agent] query() returned, entering message loop...')

      connectTimer = setTimeout(() => {
        abortController.abort()
      }, CONNECT_TIMEOUT_MS)

      let firstMessageReceived = false
      const tracker = createToolCallTracker()

      iterationTimeoutTimer = setTimeout(() => {
        abortController.abort()
        ;(q as any).cleanup?.()
      }, ITERATION_TIMEOUT_MS)

      try {
        console.log('[Agent] starting for-await loop...')
        messageLoop: for await (const message of q) {
          console.log('[Agent] message type:', message.type, JSON.stringify(message).slice(0, 300))
          if (iterationTimeoutTimer) {
            clearTimeout(iterationTimeoutTimer)
          }
          iterationTimeoutTimer = setTimeout(() => {
            abortController.abort()
            ;(q as any).cleanup?.()
          }, ITERATION_TIMEOUT_MS)

          if (!firstMessageReceived) {
            firstMessageReceived = true
            clearTimeout(connectTimer)
          }

          switch (message.type) {
            case 'system': {
              const sid = (message as any).session_id
              if (sid) wrappedCallback({ type: 'session', sessionId: sid })
              break
            }
            case 'error': {
              const errorMsg = (message as any).error || 'Unknown error'
              throw new Error(errorMsg)
            }
            case 'stream_event':
              this.handleStreamEvent((message as any).event, tracker, wrappedCallback)
              break
            case 'user': {
              const content = (message as any).message?.content
              if (content) this.handleToolResults(content, tracker, wrappedCallback)
              break
            }
            case 'assistant':
              this.handleToolNotFoundErrors(message, tracker, wrappedCallback)
              break
            case 'result':
              wrappedCallback({
                type: 'result',
                content: JSON.stringify({
                  subtype: (message as any).subtype,
                  duration_ms: (message as any).duration_ms,
                }),
              })
              break messageLoop
            default:
              break
          }
        }
      } catch (err) {
        console.error('[Agent] message loop error:', err)
        if (err instanceof ExecutionError) {
          console.log('[Agent] ExecutionError (interrupt), returning')
          return
        }
        // Don't re-throw Transport closed errors - they're expected when CLI exits
        if (err instanceof Error && err.message === 'Transport closed') {
          console.error('[Agent] CLI process exited unexpectedly')
          return
        }
        throw err
      }
    } finally {
      console.log('[Agent] entering finally block')
      if (connectTimer) clearTimeout(connectTimer)
      if (iterationTimeoutTimer) clearTimeout(iterationTimeoutTimer)

      // Archive to git if sandbox was used
      if (sandboxInstance) {
        try {
          await archiveToGit(sandboxInstance, conversationId, prompt)
        } catch (err) {
          console.error('[Agent] Archive to git failed:', (err as Error).message)
        }
      }

      // Close sandbox MCP client
      if (sandboxMcpClient) {
        try {
          await sandboxMcpClient.close()
        } catch {
          // ignore
        }
      }

      // 同步消息 + 清理本地文件
      // 存储失败是重大错误，必须通知客户端，但不能阻塞 Git 归档
      let syncError: Error | undefined
      try {
        await persistenceService.syncMessages(
          conversationId,
          userContext.envId,
          userContext.userId,
          historicalMessages,
          lastRecordId,
          actualCwd,
          assistantMessageId,
          isResumeFromInterrupt,
          preSavedUserRecordId,
        )
        // syncMessages 成功后，将 assistant record 标记为 done（否则 loadDBMessages 查不到）
        await persistenceService.finalizePendingRecords(assistantMessageId, 'done')
      } catch (err) {
        syncError = err instanceof Error ? err : new Error(String(err))
        console.error('[Agent] syncAndCleanup failed:', syncError.message)

        // sync 失败时，将预保存的 pending assistant 记录标记为 error
        if (preSavedUserRecordId && conversationId) {
          try {
            await persistenceService.finalizePendingRecords(assistantMessageId, 'error')
          } catch {
            // finalize 也失败则忽略
          }
        }
      }

      // 存储失败必须向上抛出，让调用方感知到
      if (syncError) {
        throw syncError
      }
    }
  }

  // ─── Stream Event Handlers ──────────────────────────────────────────

  private handleStreamEvent(event: any, tracker: ToolCallTracker, callback: AgentCallback): void {
    if (!event) return
    switch (event.type) {
      case 'content_block_delta':
        this.handleContentBlockDelta(event, tracker, callback)
        break
      case 'content_block_start':
        this.handleContentBlockStart(event, tracker, callback)
        break
      case 'content_block_stop':
        this.handleContentBlockStop(event, tracker, callback)
        break
    }
  }

  private handleContentBlockStart(event: any, tracker: ToolCallTracker, callback: AgentCallback): void {
    const block = event?.content_block
    if (!block) return

    if (block.type === 'thinking') {
      tracker.blockIndexToToolId.set(event.index, '__thinking__')
      return
    }
    if (block.type !== 'tool_use') return

    if (event.index !== undefined) {
      tracker.blockIndexToToolId.set(event.index, block.id)
    }
    tracker.pendingToolCalls.set(block.id, {
      name: block.name,
      input: block.input || {},
      inputJson: '',
    })
    callback({ type: 'tool_use', name: block.name, input: block.input || {}, id: block.id })
  }

  private handleContentBlockDelta(event: any, tracker: ToolCallTracker, callback: AgentCallback): void {
    const delta = event?.delta
    if (!delta) return

    if (delta.type === 'thinking_delta' && delta.thinking) {
      callback({ type: 'thinking', content: delta.thinking })
    } else if (delta.type === 'text_delta' && delta.text) {
      callback({ type: 'text', content: delta.text })
    } else if (delta.type === 'input_json_delta' && delta.partial_json !== undefined) {
      const toolId = tracker.blockIndexToToolId.get(event.index)
      if (toolId && toolId !== '__thinking__') {
        const toolInfo = tracker.pendingToolCalls.get(toolId)
        if (toolInfo) {
          toolInfo.inputJson = (toolInfo.inputJson || '') + delta.partial_json
        }
        tracker.toolInputJsonBuffers.set(toolId, (tracker.toolInputJsonBuffers.get(toolId) || '') + delta.partial_json)
      }
    }
  }

  private handleContentBlockStop(event: any, tracker: ToolCallTracker, callback: AgentCallback): void {
    const toolId = tracker.blockIndexToToolId.get(event.index)
    if (!toolId) return

    if (toolId === '__thinking__') {
      tracker.blockIndexToToolId.delete(event.index)
      return
    }

    const toolInfo = tracker.pendingToolCalls.get(toolId)
    if (toolInfo?.inputJson) {
      try {
        const parsedInput = JSON.parse(toolInfo.inputJson)
        toolInfo.input = parsedInput
        callback({ type: 'tool_use', name: toolInfo.name, input: parsedInput, id: toolId })
      } catch {
        // ignore
      }
    }
    tracker.blockIndexToToolId.delete(event.index)
  }

  private handleToolResults(content: any[], tracker: ToolCallTracker, callback: AgentCallback): void {
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (block.type !== 'tool_result') continue
      const toolUseId = block.tool_use_id
      if (!toolUseId) continue

      // 提取 rawText 供部署URL、二维码解析使用
      const rawText =
        Array.isArray(block.content) && block.content[0]?.text
          ? block.content[0].text
          : typeof block.content === 'string'
            ? block.content
            : null

      // 检测 uploadFiles 结果，提取 CloudBase 部署 URL
      this.tryExtractDeployUrl(block.tool_use_id, rawText, tracker, callback)

      // 检测 publishMiniprogram 结果，提取预览二维码
      this.tryExtractQrcode(block.tool_use_id, rawText, tracker, callback)

      let processedContent = block.content
      if (Array.isArray(block.content) && block.content.length > 0) {
        const firstBlock = block.content[0]
        if (firstBlock.type === 'text' && typeof firstBlock.text === 'string') {
          try {
            processedContent = JSON.parse(firstBlock.text)
          } catch {
            processedContent = firstBlock.text
          }
        }
      }

      tracker.pendingToolCalls.delete(toolUseId)
      tracker.toolInputJsonBuffers.delete(toolUseId)
      callback({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: typeof processedContent === 'string' ? processedContent : JSON.stringify(processedContent),
        is_error: block.is_error,
      })
    }
  }

  /**
   * 尝试从 uploadFiles 工具结果中提取 CloudBase 静态托管部署 URL
   * 结果包含 accessUrl 或 staticDomain 则触发 deploy_url callback
   */
  private tryExtractDeployUrl(
    toolUseId: string,
    rawText: string | null,
    tracker: ToolCallTracker,
    callback: AgentCallback,
  ): void {
    const toolInfo = tracker.pendingToolCalls.get(toolUseId)
    const toolName = toolInfo?.name || ''
    if (!toolName.includes('uploadFiles') && !toolName.includes('cloudbase_uploadFiles')) return
    if (!rawText) return

    try {
      let localPath: string | undefined
      const inputJson = tracker.toolInputJsonBuffers.get(toolUseId)
      if (inputJson) {
        try {
          localPath = JSON.parse(inputJson)?.localPath
        } catch {
          /* ignore */
        }
      }
      if (!localPath) localPath = toolInfo?.input?.localPath as string | undefined

      const isFile = localPath ? /\.[a-zA-Z0-9]+$/.test(localPath.replace(/\/+$/, '').split('/').pop() || '') : false
      const deployUrl = CloudbaseAgentService.extractDeployUrl(rawText, isFile)
      if (deployUrl) {
        callback({ type: 'deploy_url', url: deployUrl })
      }
    } catch {
      // 提取失败不影响主流程
    }
  }

  /**
   * 从 uploadFiles 工具结果 JSON 中递归提取 CloudBase 部署 URL
   * 支持 accessUrl / staticDomain 字段，最多递归 5 层
   */
  private static extractDeployUrl(rawText: string, isFile = false, depth = 0): string | null {
    if (depth > 5) return null
    try {
      const parsed = JSON.parse(rawText)

      if (Array.isArray(parsed)) {
        const firstText = parsed[0]?.text
        if (typeof firstText === 'string') {
          return CloudbaseAgentService.extractDeployUrl(firstText, isFile, depth + 1)
        }
        return null
      }

      if (typeof parsed !== 'object' || parsed === null) return null

      if (parsed.accessUrl) {
        const url = new URL(parsed.accessUrl)
        if (!isFile && url.pathname !== '/' && !url.pathname.endsWith('/')) {
          url.pathname += '/'
        }
        if (!url.searchParams.get('t')) {
          url.searchParams.set('t', String(Date.now()))
        }
        return url.toString()
      }
      if (parsed.staticDomain) return `https://${parsed.staticDomain}/?t=${Date.now()}`

      const innerText = parsed?.res?.content?.[0]?.text || parsed?.content?.[0]?.text
      if (typeof innerText === 'string') {
        return CloudbaseAgentService.extractDeployUrl(innerText, isFile, depth + 1)
      }
    } catch {
      // JSON parse 失败，忽略
    }
    return null
  }

  /**
   * 尝试从 publishMiniprogram 工具结果中提取小程序预览二维码
   * 成功则触发 artifact callback
   */
  private tryExtractQrcode(
    toolUseId: string,
    rawText: string | null,
    tracker: ToolCallTracker,
    callback: AgentCallback,
  ): void {
    const toolInfo = tracker.pendingToolCalls.get(toolUseId)
    const toolName = toolInfo?.name || ''
    if (!toolName.includes('publishMiniprogram') && !toolName.includes('Miniprogram')) return
    if (!rawText) return

    try {
      let parsedResult: any = null
      try {
        parsedResult = JSON.parse(rawText)
      } catch {
        return
      }

      const action = parsedResult?.action || (toolInfo?.input as any)?.action

      // 小程序预览二维码
      if (parsedResult?.result?.qrcode) {
        const qrcode = `data:${parsedResult?.result?.qrcode?.mimeType || 'image/png'};base64,${parsedResult?.result?.qrcode?.base64}`
        callback({
          type: 'artifact',
          artifact: {
            title: '小程序预览二维码',
            description: '使用微信扫码预览小程序',
            contentType: 'image',
            data: qrcode,
            metadata: parsedResult,
          },
        })
        return
      }

      // 上传成功但无二维码
      if (parsedResult?.success && action === 'upload') {
        callback({
          type: 'artifact',
          artifact: {
            title: '小程序上传成功',
            description: '代码已上传到微信后台，可前往微信公众平台提交审核',
            contentType: 'json',
            data: JSON.stringify(parsedResult),
          },
        })
      }
    } catch {
      // 提取失败不影响主流程
    }
  }

  private handleToolNotFoundErrors(msg: any, tracker: ToolCallTracker, callback: AgentCallback): void {
    if (!msg.message?.content) return
    for (const block of msg.message.content) {
      if (block.type !== 'text' || typeof block.text !== 'string') continue
      const match = block.text.match(/Tool\s+(\S+)\s+not\s+found/i)
      if (!match) continue
      const toolName = match[1]
      for (const [toolUseId, toolInfo] of tracker.pendingToolCalls.entries()) {
        if (toolInfo.name === toolName) {
          callback({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify({ error: block.text }),
            is_error: true,
          })
          tracker.pendingToolCalls.delete(toolUseId)
          break
        }
      }
    }
  }
}

export const cloudbaseAgentService = new CloudbaseAgentService()
