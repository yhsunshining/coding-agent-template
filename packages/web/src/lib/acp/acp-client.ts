/**
 * AcpClient — ACP 协议客户端
 *
 * P3: 把散落在 `use-chat-stream.ts` 里的协议逻辑（JSON-RPC 拼装、SSE 解析、
 * initialize/session/load/session/new 序列、409 重连）统一到此处。
 *
 * 设计要点（参考反编译 01-acp-client.ts 的 Wi 类）：
 * 1. **每 taskId 一个实例**：`taskId` 在构造时注入，所有方法隐式绑定到该会话；
 *    调用方不再需要每次传 sessionId。
 * 2. **非流式方法**（request/initializeSession/cancel）带 5xx 自动重试；
 *    `request` 还在 409 时尝试 reconnect 一次原请求（最多 2 次）。
 * 3. **流式方法**（stream/observe）返回 `AsyncIterable<ExtendedSessionUpdate>`，
 *    不做自动重试（流中断后的状态恢复由 hook 的 reconnectToStream 负责）。
 * 4. **错误统一抛 AcpStreamError**：SSE 帧里的 `{ error: {...} }` 会作为异常抛出，
 *    让 hook 用单个 try/catch 覆盖传输错误 + 协议错误。
 * 5. **单调递增 id**：避免反编译版本用 `Date.now()` 可能冲突的问题。
 *
 * 不包含：
 * - pub/sub 事件总线（hook 保留 for-await 控制权）
 * - XHR（本项目始终用 fetch + ReadableStream）
 * - React state（这里是纯协议层，不感知 UI）
 */
import type { ExtendedSessionUpdate } from '@coder/shared'
import { fetchWithRetry } from './fetch-with-retry'

export interface AcpClientOptions {
  /** 非流式 JSON-RPC 基地址，如 `/api/agent/acp` */
  baseUrl: string
  /** 流式 observe 基地址，如 `/api/agent/observe`；默认由 baseUrl 推导 */
  observeBaseUrl?: string
  /** 会话/任务 ID，所有方法的 sessionId 都绑定到此 */
  taskId: string
}

/**
 * ACP 流式请求中携带的协议错误。
 * hook 层用 `err instanceof AcpStreamError` 即可区分协议错误 vs 传输错误（但通常两者一视同仁）。
 */
export class AcpStreamError extends Error {
  public readonly rpcMethod: string
  constructor(message: string, rpcMethod: string) {
    super(message)
    this.name = 'AcpStreamError'
    this.rpcMethod = rpcMethod
  }
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc?: string
  id?: number | string | null
  result?: T
  error?: { code?: number; message?: string }
}

export class AcpClient {
  private readonly baseUrl: string
  private readonly observeBaseUrl: string
  private readonly taskId: string

  /** 单调递增的 JSON-RPC id（避免 Date.now() 同毫秒冲突） */
  private nextId = 1

  /** 已成功 initialize 的标记；`initializeSession` 多次调用幂等 */
  private sessionInitialized = false

  /** initialize 正在进行时的 latch，防止并发重复初始化 */
  private initializing: Promise<void> | null = null

  constructor(options: AcpClientOptions) {
    this.baseUrl = options.baseUrl
    this.observeBaseUrl = options.observeBaseUrl ?? options.baseUrl.replace(/\/acp$/, '/observe')
    this.taskId = options.taskId
  }

  // ────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────

  /**
   * 保证 ACP 会话已初始化。幂等，并发安全。
   *
   * 流程：initialize → session/load → （若失败）session/new。
   */
  async initializeSession(): Promise<void> {
    if (this.sessionInitialized) return
    if (this.initializing) return this.initializing

    this.initializing = this.doInitialize()
    try {
      await this.initializing
      this.sessionInitialized = true
    } finally {
      this.initializing = null
    }
  }

  /**
   * 非流式 JSON-RPC 调用。
   * - 5xx / 网络错误：自动指数退避重试（经 fetchWithRetry）
   * - 409 连接丢失：重新 initialize 后重试原请求（最多重试 2 次）
   * - 成功返回 `result`；协议错误 / HTTP 错误抛 Error
   */
  async request<T = unknown>(method: string, params: unknown, _reconnectAttempt = 0): Promise<T> {
    const body = this.buildRequestBody(method, params)
    const res = await fetchWithRetry(this.baseUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    // 409: 连接丢失，尝试 reconnect 后重试
    if (res.status === 409 && method !== 'initialize' && _reconnectAttempt < 2) {
      console.warn('ACP connection lost (409), reinitializing and retrying')
      this.sessionInitialized = false
      await this.initializeSession()
      return this.request<T>(method, params, _reconnectAttempt + 1)
    }

    if (!res.ok) {
      const msg = await extractErrorMessage(res)
      throw new Error(msg || `ACP request failed: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as JsonRpcResponse<T>
    if (json.error) {
      throw new Error(json.error.message || 'ACP protocol error')
    }
    return json.result as T
  }

  /**
   * Fire-and-forget 通知（无 id，无响应）。网络错误被吞掉。
   */
  async notify(method: string, params: unknown): Promise<void> {
    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params }),
      })
    } catch {
      // swallow: notify 是 fire-and-forget
    }
  }

  /**
   * 流式 session/prompt。打开 SSE POST，yield 每个 `session/update` 事件的 `update` 字段。
   *
   * 异常：
   * - fetch 拒绝 / body 读失败 → 抛原生错误
   * - SSE 帧携带 `{ error: {...} }` → 抛 `AcpStreamError`
   * - 正常 `data: [DONE]` 或流结束 → 生成器 return（for-await 退出 body）
   *
   * 不做自动重试（流中断后的恢复由调用方的 reconnectToStream 负责）。
   */
  async *stream(method: 'session/prompt', params: unknown, signal?: AbortSignal): AsyncIterable<ExtendedSessionUpdate> {
    const body = this.buildRequestBody(method, params)
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok || !res.body) {
      const msg = await extractErrorMessage(res)
      throw new AcpStreamError(msg || `ACP stream failed: ${res.status} ${res.statusText}`, method)
    }

    yield* parseSseBody(res, method)
  }

  /**
   * 重连到进行中的流（观察路由）。GET /api/agent/observe/:taskId?turnId=...
   *
   * 契约同 `stream()`：AsyncIterable，正常结束 return，错误 throw。
   */
  async *observe(turnId: string, signal?: AbortSignal): AsyncIterable<ExtendedSessionUpdate> {
    const url = `${this.observeBaseUrl}/${this.taskId}?turnId=${encodeURIComponent(turnId)}`
    const res = await fetch(url, { credentials: 'include', signal })

    if (!res.ok || !res.body) {
      const msg = await extractErrorMessage(res)
      throw new AcpStreamError(msg || `ACP observe failed: ${res.status} ${res.statusText}`, 'observe')
    }

    yield* parseSseBody(res, 'observe')
  }

  /**
   * POST session/cancel。
   */
  async cancel(): Promise<void> {
    await this.request('session/cancel', { sessionId: this.taskId })
  }

  // ────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────

  private buildRequestBody(method: string, params: unknown) {
    return {
      jsonrpc: '2.0' as const,
      id: this.nextId++,
      method,
      params,
    }
  }

  /**
   * 真正的 initialize 流程（给 initializeSession 复用）。
   *
   * 三段：
   * 1. initialize（协议版本协商）
   * 2. session/load（基于 taskId 加载已有会话）
   * 3. 若 load 报错（通常是 "session not found"）→ session/new
   *
   * 这里 **不走 `request()`**（会造成初始化循环）；直接 fetchWithRetry，
   * 语义与 request() 基本一致但不做 409 重连。
   */
  private async doInitialize(): Promise<void> {
    // 1. initialize
    await this.postJsonRpc('initialize', { protocolVersion: 1 })

    // 2. session/load（可能失败）
    let loadedOk = false
    try {
      await this.postJsonRpc('session/load', { sessionId: this.taskId })
      loadedOk = true
    } catch {
      // 失败通常是 session not found，走 new 分支
    }

    // 3. session/new
    if (!loadedOk) {
      await this.postJsonRpc('session/new', { conversationId: this.taskId })
    }
  }

  /**
   * 非流式 JSON-RPC POST（内部使用，不触发 409 重连逻辑）。
   * 失败时抛 Error。
   */
  private async postJsonRpc(method: string, params: unknown): Promise<unknown> {
    const body = this.buildRequestBody(method, params)
    const res = await fetchWithRetry(this.baseUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const msg = await extractErrorMessage(res)
      throw new Error(msg || `ACP ${method} failed: ${res.status}`)
    }
    const json = (await res.json()) as JsonRpcResponse
    if (json.error) {
      throw new Error(json.error.message || `ACP ${method} protocol error`)
    }
    return json.result
  }
}

// ────────────────────────────────────────────────────────────────────
// Module-level helpers
// ────────────────────────────────────────────────────────────────────

/**
 * 解析 SSE response.body，yield 每个 `session/update` 的 update 字段。
 *
 * SSE 格式契约（与当前 readSSEStream 一致）：
 * - 每行 `data: {...}\n`
 * - `data: [DONE]` 表示正常结束
 * - `{... error: {message}}` 帧抛 AcpStreamError
 * - 其余帧若 `method === 'session/update'`，yield `params.update`
 * - 解析失败的行静默跳过
 */
async function* parseSseBody(res: Response, rpcMethod: string): AsyncIterable<ExtendedSessionUpdate> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        if (line.trim() === 'data: [DONE]') continue

        let event: JsonRpcResponse & { method?: string; params?: { update?: ExtendedSessionUpdate } }
        try {
          event = JSON.parse(line.slice(6))
        } catch {
          continue
        }

        if (event.error) {
          throw new AcpStreamError(event.error.message || 'ACP stream error', rpcMethod)
        }
        if (event.method === 'session/update' && event.params?.update) {
          yield event.params.update
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
}

/**
 * 尽力从 Response 里提取 error.message（JSON 解析失败则退回 statusText）。
 */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.clone().json()) as JsonRpcResponse
    return json.error?.message || res.statusText
  } catch {
    return res.statusText
  }
}
