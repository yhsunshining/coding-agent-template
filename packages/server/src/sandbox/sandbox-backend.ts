/**
 * Sandbox Backend — shared utilities for multi-backend sandbox support.
 *
 * SANDBOX_BACKEND env var selects the backend:
 *   - scf (default): SCF cloud function via @cloudbase/manager-node
 *   - ags: AGS container via @cloudbase/manager-node SandboxService
 *   - lightbox: Lightbox microVM via E2B-compatible HTTP API
 */

export type SandboxBackend = 'scf' | 'ags' | 'lightbox'

export function getSandboxBackend(): SandboxBackend {
  const v = (process.env.SANDBOX_BACKEND || 'scf').trim().toLowerCase()
  if (v === 'ags' || v === 'lightbox') return v
  return 'scf'
}

/**
 * Build data-plane HTTP headers based on backend type.
 * - SCF: Authorization + X-Cloudbase-Session-Id (TCB gateway routing)
 * - AGS/Lightbox: X-Cloudbase-Authorization + E2b-Sandbox-Id + E2b-Sandbox-Port (TCB gateway routing)
 */
export function buildDataPlaneHeaders(
  backend: SandboxBackend,
  opts?: { accessToken?: string; sessionId?: string; tcbApiKey?: string; sandboxId?: string },
): Record<string, string> {
  switch (backend) {
    case 'scf':
      return {
        Authorization: `Bearer ${opts?.accessToken || ''}`,
        'X-Cloudbase-Session-Id': opts?.sessionId || '',
        'X-Tcb-Webfn': 'true',
      }
    case 'ags':
    case 'lightbox': {
      const headers: Record<string, string> = {
        'X-Cloudbase-Authorization': `Bearer ${opts?.tcbApiKey || process.env.TCB_API_KEY || ''}`,
      }
      if (opts?.sandboxId) {
        headers['E2b-Sandbox-Id'] = opts.sandboxId
        headers['E2b-Sandbox-Port'] = '9000'
      }
      return headers
    }
  }
}

/**
 * Health check via HTTP GET /health. No envd WebSocket needed.
 */
export async function checkHealth(baseUrl: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
