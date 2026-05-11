/**
 * AGS Sandbox Manager
 *
 * Pure HTTP + @cloudbase/manager-node. No e2b SDK dependency.
 * Control plane: manager-node commonService (create/pause/resume/stop)
 * Data plane: HTTP fetch to TRW via TCB gateway
 *
 * Required environment variables:
 *   TCB_API_KEY        — TCB gateway auth token (X-Cloudbase-Authorization header)
 *
 * Instance connection (one of):
 *   AGS_SANDBOX_ID     — Pre-created instance ID (shared/dev mode, skips creation)
 *   AGS_TOOL_ID        — AGS tool ID (dynamic creation mode)
 *
 * Data plane routing:
 *   AGS_SANDBOX_URL    — TCB gateway base URL (e.g. https://<env>.api.tcloudbasegateway.com/v1/sandbox/-)
 *
 * Dynamic creation only (optional):
 *   TCB_ENV_ID         — CloudBase environment ID
 *   TCB_SECRET_ID      — Tencent Cloud SecretId
 *   TCB_SECRET_KEY     — Tencent Cloud SecretKey
 *   TCB_TOKEN          — Tencent Cloud temporary token (optional)
 */

import { checkHealth, buildDataPlaneHeaders } from './sandbox-backend.js'

// ─── Types ────────────────────────────────────────────────────────────────

export type SandboxMode = 'per-conversation' | 'shared'

export type SandboxProgressCallback = (message: {
  phase: 'reuse' | 'create' | 'wait_creating' | 'pull_image' | 'wait_ready' | 'init_mcp' | 'ready' | 'error'
  message: string
}) => void

// ─── SandboxInstance ──────────────────────────────────────────────────────

export class SandboxInstance {
  readonly sandboxId: string
  readonly conversationId: string
  readonly baseUrl: string
  readonly status: 'creating' | 'ready' | 'error'
  readonly mode: SandboxMode

  private readonly tcbApiKey: string

  // Compat aliases for code that references old SCF SandboxInstance fields
  get functionName(): string {
    return this.sandboxId
  }
  get envId(): string {
    return this.conversationId
  }
  get sandboxEnvId(): string {
    return process.env.TCB_ENV_ID || ''
  }

  readonly mcpConfig?: {
    type: 'sse' | 'http'
    url: string
    headers?: Record<string, string | undefined>
  }

  constructor(ctx: {
    sandboxId: string
    conversationId: string
    baseUrl: string
    status: 'creating' | 'ready' | 'error'
    mode: SandboxMode
    tcbApiKey: string
    mcpConfig?: SandboxInstance['mcpConfig']
  }) {
    this.sandboxId = ctx.sandboxId
    this.conversationId = ctx.conversationId
    this.baseUrl = ctx.baseUrl
    this.status = ctx.status
    this.mode = ctx.mode
    this.tcbApiKey = ctx.tcbApiKey
    this.mcpConfig = ctx.mcpConfig
  }

  /** Compat: returns TCB API key */
  async getAccessToken(): Promise<string> {
    return this.tcbApiKey
  }

  getAuthHeaders(): Record<string, string> {
    return buildDataPlaneHeaders({ tcbApiKey: this.tcbApiKey, sandboxId: this.sandboxId })
  }

  async getToolOverrideConfig(): Promise<{ url: string; headers: Record<string, string> }> {
    return {
      url: this.baseUrl,
      headers: this.getAuthHeaders(),
    }
  }

  async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers as Record<string, string> | undefined),
      },
    })
  }

  /** Health check via HTTP — replaces e2b isRunning() */
  async isRunning(): Promise<boolean> {
    return checkHealth(this.baseUrl, this.getAuthHeaders())
  }
}

// ─── AgsSandboxManager ────────────────────────────────────────────────────

export class AgsSandboxManager {
  private instanceCache = new Map<string, SandboxInstance>()

  private getConfig() {
    const tcbApiKey = process.env.TCB_API_KEY || ''
    const toolId = process.env.AGS_TOOL_ID || ''
    const preCreatedId = process.env.AGS_SANDBOX_ID || ''
    const sandboxUrl = process.env.AGS_SANDBOX_URL || ''

    if (!tcbApiKey) {
      throw new Error('Missing TCB_API_KEY for AGS sandbox')
    }

    return { tcbApiKey, toolId, preCreatedId, sandboxUrl }
  }

  private buildHeaders(sandboxId?: string): Record<string, string> {
    return buildDataPlaneHeaders({ tcbApiKey: this.getConfig().tcbApiKey, sandboxId })
  }

  private buildBaseUrl(_sandboxId: string): string {
    const { sandboxUrl } = this.getConfig()
    if (!sandboxUrl) {
      throw new Error('Missing AGS_SANDBOX_URL — TCB gateway URL required for data plane')
    }
    return sandboxUrl
  }

  private buildMcpConfig(baseUrl: string, sandboxId: string): SandboxInstance['mcpConfig'] {
    return {
      type: 'http' as const,
      url: `${baseUrl}/mcp`,
      headers: this.buildHeaders(sandboxId),
    }
  }

  async getOrCreate(
    conversationId: string,
    _envId: string,
    options?: {
      mode?: SandboxMode
      workspaceIsolation?: 'shared' | 'isolated'
      sandboxSessionId?: string
    },
    onProgress?: SandboxProgressCallback,
  ): Promise<SandboxInstance> {
    const progress = onProgress || (() => {})
    const mode = options?.mode || 'shared'
    const { tcbApiKey, toolId, preCreatedId } = this.getConfig()

    // Cache key: shared mode uses 'shared', per-conversation uses conversationId
    const cacheKey = mode === 'shared' ? 'shared' : conversationId

    // Check cache — health check via HTTP
    const cached = this.instanceCache.get(cacheKey)
    if (cached) {
      const alive = await cached.isRunning()
      if (alive) {
        progress({ phase: 'reuse', message: 'Reusing existing sandbox\n' })
        return cached
      }
      this.instanceCache.delete(cacheKey)
    }

    let sandboxId: string

    if (preCreatedId) {
      // Connect to pre-created instance (shared/dev mode)
      progress({ phase: 'wait_ready', message: 'Connecting to AGS instance...\n' })
      sandboxId = preCreatedId
    } else if (toolId) {
      // Create new instance via @cloudbase/manager-node
      progress({ phase: 'create', message: 'Creating AGS sandbox...\n' })
      sandboxId = await this.createInstance(toolId)
      // Wait for instance to become ready
      progress({ phase: 'wait_ready', message: 'Waiting for instance...\n' })
      await this.waitForReady(sandboxId)
    } else {
      throw new Error('AGS sandbox requires either AGS_SANDBOX_ID or AGS_TOOL_ID')
    }

    const baseUrl = this.buildBaseUrl(sandboxId)

    // Final health check
    const headers = this.buildHeaders(sandboxId)
    const healthy = await checkHealth(baseUrl, headers)
    if (!healthy) {
      progress({ phase: 'error', message: 'Sandbox health check failed\n' })
      throw new Error(`AGS sandbox ${sandboxId} is not healthy at ${baseUrl}`)
    }

    progress({ phase: 'ready', message: 'Sandbox ready\n' })

    const instance = new SandboxInstance({
      sandboxId,
      conversationId,
      baseUrl,
      status: 'ready',
      mode,
      tcbApiKey,
      mcpConfig: this.buildMcpConfig(baseUrl, sandboxId),
    })

    this.instanceCache.set(cacheKey, instance)
    return instance
  }

  /**
   * Get an existing sandbox instance (no creation).
   */
  async getExisting(conversationId: string, _scfSessionId: string): Promise<SandboxInstance | null> {
    const cached = this.instanceCache.get('shared') || this.instanceCache.get(conversationId)
    if (!cached) return null
    const alive = await cached.isRunning()
    return alive ? cached : null
  }

  // ─── Control Plane (via @cloudbase/manager-node) ──────────────────────

  private async callManagerApi(action: string, param: Record<string, any>): Promise<any> {
    const CloudBase = (await import('@cloudbase/manager-node')).default
    const app = new CloudBase({
      secretId: process.env.TCB_SECRET_ID || '',
      secretKey: process.env.TCB_SECRET_KEY || '',
      token: process.env.TCB_TOKEN || '',
      envId: process.env.TCB_ENV_ID || '',
    })
    return (app.commonService('ags') as any).call({ Action: action, Param: param })
  }

  private async createInstance(toolId: string): Promise<string> {
    const result = await this.callManagerApi('StartSandboxInstance', {
      ToolId: toolId,
      Timeout: '30m',
      AuthMode: 'NONE',
    })
    const instanceId = result?.InstanceId || result?.data?.Instance?.InstanceId || ''
    if (!instanceId) {
      throw new Error(`Failed to create AGS instance: ${JSON.stringify(result)}`)
    }
    return instanceId
  }

  private async waitForReady(instanceId: string, maxWaitMs = 120_000): Promise<void> {
    const baseUrl = this.buildBaseUrl(instanceId)
    const headers = this.buildHeaders(instanceId)
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      if (await checkHealth(baseUrl, headers)) return
      await new Promise((r) => setTimeout(r, 3000))
    }
    throw new Error(`AGS instance ${instanceId} did not become ready within ${maxWaitMs}ms`)
  }

  async pause(instanceId: string): Promise<void> {
    await this.callManagerApi('PauseSandboxInstance', { InstanceId: instanceId })
  }

  async resume(instanceId: string): Promise<void> {
    await this.callManagerApi('ResumeSandboxInstance', { InstanceId: instanceId })
  }

  async destroy(instanceId: string): Promise<void> {
    await this.callManagerApi('StopSandboxInstance', { InstanceId: instanceId })
    // Remove from cache
    for (const [key, inst] of this.instanceCache) {
      if (inst.sandboxId === instanceId) {
        this.instanceCache.delete(key)
        break
      }
    }
  }
  /**
   * Preview base URL for AGS mode.
   * Preview routes through the same TCB gateway baseUrl + /preview path.
   */
  async ensurePreviewGateway(): Promise<string> {
    const { sandboxUrl } = this.getConfig()
    if (sandboxUrl) return `${sandboxUrl}/preview`
    const cached = this.instanceCache.get('shared')
    if (cached) return `${cached.baseUrl}/preview`
    return '/preview'
  }
}

export const agsSandboxManager = new AgsSandboxManager()
