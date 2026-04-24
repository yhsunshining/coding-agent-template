/**
 * SessionPermissionsManager
 *
 * 内存单例，按 sessionId 维护工具白名单。用于支持 `allow_always` 决策：
 * 用户选择"总是允许（本会话）"后，同 sessionId 下同名工具后续调用自动放行，
 * 不再触发 tool_confirm 中断。
 *
 * 存储：进程内 Map。服务重启即清空，不跨实例同步。
 * 生命周期：任务（sessionId）维度；可选通过 clearSession() 主动清理。
 */

/**
 * 将工具名归一化为白名单 key。
 *
 * MCP 工具名形如 `mcp__<server>__<toolName>`，去除前缀后保留核心名称；
 * 非 MCP 工具（Claude 内置）原样保留。
 *
 * 该规则必须与 canUseTool / PreToolUse Hook 中的归一化一致，否则白名单永远无法命中。
 */
export function normalizeToolName(toolName: string): string {
  return toolName.startsWith('mcp__') ? toolName.split('__').slice(2).join('__') || toolName : toolName
}

export class SessionPermissionsManager {
  private sessions = new Map<string, Set<string>>()

  /** 判断指定 session 下该工具是否已在白名单中 */
  isAllowed(sessionId: string, toolName: string): boolean {
    if (!sessionId || !toolName) return false
    const set = this.sessions.get(sessionId)
    if (!set) return false
    return set.has(normalizeToolName(toolName))
  }

  /** 将工具添加到指定 session 的白名单中（幂等） */
  allowAlways(sessionId: string, toolName: string): void {
    if (!sessionId || !toolName) return
    const key = normalizeToolName(toolName)
    let set = this.sessions.get(sessionId)
    if (!set) {
      set = new Set<string>()
      this.sessions.set(sessionId, set)
    }
    set.add(key)
  }

  /** 清理指定 session 的所有白名单项（可选，任务结束/取消时调用） */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /** 调试用：返回指定 session 的白名单副本 */
  getAllowedTools(sessionId: string): string[] {
    const set = this.sessions.get(sessionId)
    return set ? Array.from(set) : []
  }
}

/** 全局单例 */
export const sessionPermissions = new SessionPermissionsManager()
