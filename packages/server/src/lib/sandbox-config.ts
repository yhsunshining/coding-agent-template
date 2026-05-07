/**
 * Sandbox config resolution helper.
 *
 * Centralises the logic for computing sandboxMode / sandboxSessionId / sandboxCwd
 * so that task creation, agent start, preview-url, and scripts all follow the
 * same rules.
 */

export interface SandboxConfig {
  sandboxMode: 'shared' | 'isolated'
  sandboxSessionId: string
  sandboxCwd: string
}

interface ResolveParams {
  sandboxMode?: string | null
  sandboxSessionId?: string | null
  sandboxCwd?: string | null
  envId: string
  taskId: string
}

/**
 * Resolve a complete sandbox config from (possibly partial) task record fields.
 *
 * Rules:
 *  1. sandboxMode  = DB value || WORKSPACE_ISOLATION env || 'shared'
 *  2. sandboxSessionId = DB value || (shared ? envId : taskId)
 *  3. sandboxCwd   = DB value || (shared ? /tmp/workspace/${envId}/${taskId} : /tmp/workspace/${taskId})
 */
export function resolveSandboxConfig(params: ResolveParams): SandboxConfig {
  const { envId, taskId } = params

  const sandboxMode: 'shared' | 'isolated' =
    (params.sandboxMode as 'shared' | 'isolated') ||
    (process.env.WORKSPACE_ISOLATION === 'isolated' ? 'isolated' : 'shared')

  const sandboxSessionId: string = params.sandboxSessionId || (sandboxMode === 'shared' ? envId : taskId)

  const sandboxCwd: string =
    params.sandboxCwd || (sandboxMode === 'shared' ? `/tmp/workspace/${envId}/${taskId}` : `/tmp/workspace/${taskId}`)

  return { sandboxMode, sandboxSessionId, sandboxCwd }
}

/**
 * Check if a task record is missing any sandbox config fields and, if so,
 * compute and persist the backfilled values. Returns true when an update was written.
 */
export async function backfillSandboxConfig(
  taskId: string,
  existing: {
    sandboxMode?: string | null
    sandboxSessionId?: string | null
    sandboxCwd?: string | null
  },
  envId: string,
  db: { tasks: { update: (id: string, data: Record<string, unknown>) => Promise<unknown> } },
): Promise<boolean> {
  if (existing.sandboxMode && existing.sandboxSessionId && existing.sandboxCwd) {
    return false
  }

  const config = resolveSandboxConfig({
    sandboxMode: existing.sandboxMode,
    sandboxSessionId: existing.sandboxSessionId,
    sandboxCwd: existing.sandboxCwd,
    envId,
    taskId,
  })

  await db.tasks.update(taskId, {
    sandboxMode: config.sandboxMode,
    sandboxSessionId: config.sandboxSessionId,
    sandboxCwd: config.sandboxCwd,
    updatedAt: Date.now(),
  })

  return true
}
