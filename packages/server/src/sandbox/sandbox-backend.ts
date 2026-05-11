/**
 * Sandbox Backend — shared utilities for AGS/Lightbox sandbox.
 *
 * Data plane: pure HTTP via TCB gateway.
 * Headers: X-Cloudbase-Authorization + E2b-Sandbox-Id + E2b-Sandbox-Port
 */

/**
 * Build data-plane HTTP headers for TCB gateway routing.
 * Includes sandbox instance routing headers (E2b-Sandbox-Id + E2b-Sandbox-Port).
 */
export function buildDataPlaneHeaders(opts: {
  tcbApiKey?: string
  sandboxId?: string
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Cloudbase-Authorization': `Bearer ${opts.tcbApiKey || process.env.TCB_API_KEY || ''}`,
  }
  if (opts.sandboxId) {
    headers['E2b-Sandbox-Id'] = opts.sandboxId
    headers['E2b-Sandbox-Port'] = '9000'
  }
  return headers
}

/**
 * Health check via HTTP GET /health.
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
