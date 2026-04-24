/**
 * fetchWithRetry — 通用重试包装
 *
 * P3: 把协议层的 5xx / 网络错误重试逻辑从各处 fetch 调用统一到此处。
 * 参考反编译 01-acp-client.ts 的 ve() 实现。
 *
 * 设计边界：
 * - 仅处理"传输层"重试（5xx、网络错误）。4xx（含 409）交给调用方自行判断，
 *   因为 409 在 ACP 场景下意味着"会话连接丢失"，需要先 reconnect 再重试，
 *   这个语义由 AcpClient 封装，不属于这里。
 * - 流式（SSE）场景下不能重试（会丢失已推给调用方的更新），通过 `noRetry` 显式 opt-out。
 * - 不做方法白名单检查（PUT/DELETE 本项目不用），保持通用。
 */

export interface RetryConfig {
  /** 最多重试次数，默认 3（共 4 次请求） */
  maxRetries?: number
  /** 指数退避基准毫秒数，默认 500 */
  baseDelay?: number
  /** 跳过所有重试（用于流式 POST/GET） */
  noRetry?: boolean
}

/**
 * 对给定 URL 做 fetch，在 5xx 或网络错误时指数退避重试。
 *
 * @returns 最终响应；重试全部失败时抛最后一次捕获的错误。
 */
export async function fetchWithRetry(url: string, init?: RequestInit, retryConfig?: RetryConfig): Promise<Response> {
  const noRetry = retryConfig?.noRetry ?? false
  const maxRetries = noRetry ? 0 : (retryConfig?.maxRetries ?? 3)
  const baseDelay = retryConfig?.baseDelay ?? 500

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init)

      // 5xx 且还有重试配额 → 退避后重试
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn('Request failed with server error, retrying')
        await delay(baseDelay * Math.pow(2, attempt))
        continue
      }

      return response
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        console.warn('Request failed with network error, retrying')
        await delay(baseDelay * Math.pow(2, attempt))
        continue
      }
      throw error
    }
  }

  // 理论上不可达（循环末尾要么 return 要么 throw），做兜底
  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry: max retries exceeded')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
