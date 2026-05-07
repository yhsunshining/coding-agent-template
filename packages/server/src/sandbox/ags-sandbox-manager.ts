/**
 * AGS Sandbox Manager
 *
 * Uses e2b-tcb JS SDK to manage AGS sandbox instances via TCB gateway.
 * Replaces SCF-based sandbox creation with AGS instance lifecycle.
 *
 * Environment variables:
 *   E2B_API_KEY        — AGS API key (Authorization header)
 *   E2B_API_URL        — TCB gateway URL (https://<env>.api.tcloudbasegateway.com/v1/sandbox/-)
 *   E2B_SANDBOX_URL    — Same as E2B_API_URL
 *   E2B_TEMPLATE       — AGS tool name (e.g. trw-sandbox-tcb)
 *   TCB_API_KEY        — TCB token for X-Cloudbase-Authorization header
 *   AGS_SANDBOX_ID     — (optional) Pre-created instance ID to connect to instead of creating new
 */

import { Sandbox } from 'e2b'

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

  private readonly e2bSandbox: Sandbox
  private readonly tcbApiKey: string

  // Compat aliases for code that references old SCF SandboxInstance fields
  get functionName(): string { return this.sandboxId }
  get envId(): string { return this.conversationId }
  get sandboxEnvId(): string { return process.env.TCB_ENV_ID || '' }

  readonly mcpConfig?: {
    type: 'sse' | 'http'
    url: string
    headers?: Record<string, string | undefined>
  }

  constructor(ctx: {
    e2bSandbox: Sandbox
    conversationId: string
    baseUrl: string
    status: 'creating' | 'ready' | 'error'
    mode: SandboxMode
    tcbApiKey: string
    mcpConfig?: SandboxInstance['mcpConfig']
  }) {
    this.e2bSandbox = ctx.e2bSandbox
    this.sandboxId = ctx.e2bSandbox.sandboxId
    this.conversationId = ctx.conversationId
    this.baseUrl = ctx.baseUrl
    this.status = ctx.status
    this.mode = ctx.mode
    this.tcbApiKey = ctx.tcbApiKey
    this.mcpConfig = ctx.mcpConfig
  }

  /** Get the underlying E2B Sandbox instance for direct SDK operations */
  getE2bSandbox(): Sandbox {
    return this.e2bSandbox
  }

  /** Compat: returns TCB API key (replaces old SCF access token) */
  async getAccessToken(): Promise<string> {
    return this.tcbApiKey
  }

  getAuthHeaders(): Record<string, string> {
    return {
      'X-Cloudbase-Authorization': `Bearer ${this.tcbApiKey}`,
    }
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
}

// ─── AgsSandboxManager ────────────────────────────────────────────────────

export class AgsSandboxManager {
  private instanceCache = new Map<string, SandboxInstance>()

  private getConfig() {
    const tcbApiKey = process.env.TCB_API_KEY || ''
    const template = process.env.E2B_TEMPLATE || 'trw-sandbox-tcb'
    const apiUrl = process.env.E2B_API_URL || ''
    const preCreatedId = process.env.AGS_SANDBOX_ID || ''

    if (!tcbApiKey) {
      throw new Error('Missing TCB_API_KEY for AGS sandbox')
    }

    return { tcbApiKey, template, apiUrl, preCreatedId }
  }

  private buildHeaders(): Record<string, string> {
    const { tcbApiKey } = this.getConfig()
    return {
      'X-Cloudbase-Authorization': `Bearer ${tcbApiKey}`,
    }
  }

  private buildBaseUrl(sandboxId: string): string {
    // TRW port 9000 exposed via TCB gateway sandbox URL
    const apiUrl = process.env.E2B_API_URL || ''
    if (apiUrl) {
      // E2B_API_URL is the control plane; sandbox data plane uses sandboxUrl
      // For TRW HTTP API, we route through the same gateway
      return apiUrl
    }
    return `https://${sandboxId}.api.tcloudbasegateway.com`
  }

  private buildMcpConfig(baseUrl: string): SandboxInstance['mcpConfig'] {
    return {
      type: 'http' as const,
      url: `${baseUrl}/mcp`,
      headers: this.buildHeaders(),
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
    const { tcbApiKey, template, preCreatedId } = this.getConfig()

    // Cache key: shared mode uses 'shared', per-conversation uses conversationId
    const cacheKey = mode === 'shared' ? 'shared' : conversationId

    // Check cache
    const cached = this.instanceCache.get(cacheKey)
    if (cached) {
      try {
        const isRunning = await cached.getE2bSandbox().isRunning()
        if (isRunning) {
          progress({ phase: 'reuse', message: 'Reusing existing sandbox\n' })
          return cached
        }
      } catch {
        // Stale, remove from cache
        this.instanceCache.delete(cacheKey)
      }
    }

    const headers = this.buildHeaders()

    let e2bSandbox: Sandbox

    if (preCreatedId) {
      // Connect to pre-created instance (test/dev mode)
      progress({ phase: 'wait_ready', message: 'Connecting to AGS instance...\n' })
      e2bSandbox = await Sandbox.connect(preCreatedId, {
        timeoutMs: 300_000,
        headers,
      })
    } else {
      // Create new instance via SDK control plane
      progress({ phase: 'create', message: 'Creating AGS sandbox...\n' })
      e2bSandbox = await Sandbox.create(template, {
        timeoutMs: 300_000,
        headers,
      })
    }

    progress({ phase: 'ready', message: 'Sandbox ready\n' })

    const baseUrl = this.buildBaseUrl(e2bSandbox.sandboxId)
    const instance = new SandboxInstance({
      e2bSandbox,
      conversationId,
      baseUrl,
      status: 'ready',
      mode,
      tcbApiKey,
      mcpConfig: this.buildMcpConfig(baseUrl),
    })

    this.instanceCache.set(cacheKey, instance)
    return instance
  }

  /**
   * Get an existing sandbox instance (no creation).
   * Returns null if not cached or not running.
   */
  async getExisting(conversationId: string, _scfSessionId: string): Promise<SandboxInstance | null> {
    const cached = this.instanceCache.get('shared') || this.instanceCache.get(conversationId)
    if (!cached) return null

    try {
      const isRunning = await cached.getE2bSandbox().isRunning()
      if (isRunning) return cached
    } catch {
      // Not running
    }
    return null
  }
}

export const agsSandboxManager = new AgsSandboxManager()
