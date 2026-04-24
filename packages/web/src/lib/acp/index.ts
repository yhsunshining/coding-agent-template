/**
 * ACP 协议层模块 barrel（P3）
 *
 * 前端统一从此处引入协议客户端与重试工具：
 *   import { AcpClient, AcpStreamError } from '@/lib/acp'
 */
export { AcpClient, AcpStreamError } from './acp-client'
export type { AcpClientOptions } from './acp-client'
export { fetchWithRetry } from './fetch-with-retry'
export type { RetryConfig } from './fetch-with-retry'
