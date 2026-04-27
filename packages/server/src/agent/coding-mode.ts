import type { SandboxInstance } from '../sandbox/scf-sandbox-manager.js'

const TEMPLATE_REPO = 'https://github.com/TencentCloudBase/awesome-cloudbase-examples.git'
const TEMPLATE_SUBDIR = 'web/cloudbase-react-template'
const DEV_SERVER_PORT = 5173

/**
 * Vite base 路径策略
 *
 * CloudBase 沙箱预览网关挂在 /preview/ 路径下，并用 _preview_port cookie 路由到对应端口。
 * - 访问 /preview/5173/?cloudbase_session_id=... → 设置 cookie _preview_port=5173
 * - 后续 /preview/* 请求 → gateway 根据 _preview_port cookie 路由到 Vite 端口
 *
 * `--base=/preview/` 告诉 Vite dev server 它被挂载在 /preview/ 子路径，
 * 所有资源路径都会带上 /preview/ 前缀，如 /preview/@vite/client，
 * 这样浏览器请求的绝对路径 /preview/@vite/client 能正确被网关路由到 Vite。
 *
 * `--host 0.0.0.0` 确保 Vite 监听所有网络接口，让 CloudBase 网关反向代理能到达。
 */
const VITE_BASE = '/preview/'
const VITE_HOST = '0.0.0.0'

/**
 * The correct vite.config.ts content for CloudBase sandbox preview.
 * - server.host "0.0.0.0": required for the CloudBase gateway to proxy the dev server
 * - server.allowedHosts true: allows requests from the gateway domain
 * - No "base" in config: managed via CLI flag --base=/preview/
 */
const SANDBOX_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CloudBase sandbox preview setup:
// - server.host "0.0.0.0" lets the CloudBase gateway proxy reach the dev server
// - server.allowedHosts true allows requests from the gateway domain
// The dev server is launched with --base=/preview/ so asset paths carry the
// /preview/ prefix, matching the CloudBase preview gateway routing.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
});
`

/**
 * Patch vite.config.ts in the workspace to use the correct sandbox preview settings.
 * Safe to call multiple times (idempotent).
 */
async function patchViteConfig(sandbox: SandboxInstance, workspace: string): Promise<void> {
  try {
    const writeRes = await sandbox.request('/api/tools/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${workspace}/vite.config.ts`, content: SANDBOX_VITE_CONFIG }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!writeRes.ok) {
      console.warn('[CodingMode] write tool returned', writeRes.status, '— vite.config.ts not patched')
    } else {
      console.log('[CodingMode] vite.config.ts patched for sandbox preview')
    }
  } catch (err) {
    console.warn('[CodingMode] Failed to patch vite.config.ts:', (err as Error).message)
  }
}


export async function initCodingProject(sandbox: SandboxInstance, workspace: string): Promise<void> {
  // Check if project already initialized (package.json + node_modules both exist)
  const checkRes = await sandbox.request('/api/tools/bash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: `test -f "${workspace}/package.json" && test -d "${workspace}/node_modules" && echo "ready" || (test -f "${workspace}/package.json" && echo "needs_install" || echo "not_found")`,
      timeout: 5000,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  const checkData = (await checkRes.json()) as { result?: { output?: string } }
  const checkStatus = checkData.result?.output?.trim()

  if (checkStatus === 'ready') {
    console.log('[CodingMode] Project already initialized')
    return
  }

  if (checkStatus === 'needs_install') {
    // package.json exists but node_modules doesn't — install deps + patch config
    console.log('[CodingMode] Installing missing dependencies')
    await patchViteConfig(sandbox, workspace)
    const installRes = await sandbox.request('/api/tools/bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `cd "${workspace}" && npm install 2>&1`,
        timeout: 120000,
      }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!installRes.ok) {
      throw new Error('Failed to install dependencies')
    }
    console.log('[CodingMode] Dependencies installed')
    return
  }

  // Clone template repo (sparse checkout for the specific subdir)
  console.log('[CodingMode] Initializing project from template')
  const initScript = [
    `cd /tmp`,
    `git clone --depth 1 --filter=blob:none --sparse ${TEMPLATE_REPO} _template_repo 2>&1 || true`,
    `cd _template_repo`,
    `git sparse-checkout set ${TEMPLATE_SUBDIR} 2>&1`,
    `cp -r ${TEMPLATE_SUBDIR}/. "${workspace}/"`,
    `cd /tmp && rm -rf _template_repo`,
  ].join(' && ')

  const cloneRes = await sandbox.request('/api/tools/bash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: initScript, timeout: 60000 }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!cloneRes.ok) {
    throw new Error('Failed to clone template')
  }

  // Patch vite.config.ts for CloudBase sandbox preview compatibility
  await patchViteConfig(sandbox, workspace)

  // Install dependencies
  console.log('[CodingMode] Installing dependencies')
  const installRes = await sandbox.request('/api/tools/bash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: `cd "${workspace}" && npm install 2>&1`,
      timeout: 120000,
    }),
    signal: AbortSignal.timeout(180_000),
  })

  if (!installRes.ok) {
    throw new Error('Failed to install dependencies')
  }

  console.log('[CodingMode] Project initialized')
}

/**
 * Start the Vite dev server in the background inside the sandbox.
 * Returns once the server is confirmed running.
 */
export async function startDevServer(sandbox: SandboxInstance, workspace: string): Promise<void> {
  // Check if dev server is already running
  const checkRes = await sandbox.request('/api/tools/bash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_SERVER_PORT}/ 2>/dev/null || echo "0"`,
      timeout: 5000,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  const checkData = (await checkRes.json()) as { result?: { output?: string } }
  const statusCode = checkData.result?.output?.trim()
  if (statusCode === '200' || statusCode === '304') {
    console.log('[CodingMode] Dev server already running')
    return
  }

  // Start dev server via PTY (persistent process in sandbox's network namespace)
  console.log('[CodingMode] Starting dev server')
  const devCmd = `cd "${workspace}" && npm run dev -- --base=${VITE_BASE} --host ${VITE_HOST} > /tmp/devserver.log 2>&1`
  try {
    const ptyRes = await sandbox.request('/api/tools/pty_create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/bin/bash', args: ['-c', devCmd], height: 50, width: 220 }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!ptyRes.ok) {
      // fallback
      await sandbox.request('/api/tools/bash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `nohup /bin/bash -c ${JSON.stringify(devCmd)} &`, timeout: 10000 }),
        signal: AbortSignal.timeout(15_000),
      })
    }
  } catch {
    // ignore start error, poll will catch it
  }

  // Wait for dev server to be ready (poll up to 30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const pollRes = await sandbox.request('/api/tools/bash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_SERVER_PORT}/ 2>/dev/null || echo "0"`,
          timeout: 5000,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const pollData = (await pollRes.json()) as { result?: { output?: string } }
      const code = pollData.result?.output?.trim()
      if (code === '200' || code === '304' || code === '302') {
        console.log('[CodingMode] Dev server ready')
        return
      }
    } catch {
      // continue polling
    }
  }

  console.log('[CodingMode] Dev server may not be ready, continuing anyway')
}

/**
 * Returns the system prompt that constrains the agent to the coding tech stack.
 */
export function getCodingSystemPrompt(): string {
  return `You are a frontend coding assistant. You are working on a React project with the following tech stack:

- React 18 + TypeScript
- Vite 6 (dev server and build tool)
- Tailwind CSS (utility-first CSS framework)
- DaisyUI (Tailwind component library)
- React Router (client-side routing)
- Framer Motion (animations)

IMPORTANT RULES:
1. Only use the above technologies. Do NOT introduce new frameworks or libraries unless explicitly asked.
2. Use Tailwind CSS classes and DaisyUI components for all styling. Do NOT write custom CSS unless absolutely necessary.
3. All new components should be placed in src/components/.
4. All new pages should be placed in src/pages/ and registered in src/App.tsx routes.
5. Use functional components with hooks. Do NOT use class components.
6. Keep the code clean and well-structured. Use TypeScript for new files (.tsx/.ts).
7. After modifying code, the dev server will auto-reload via Vite HMR — no need to restart it.
8. When creating new UI, prefer DaisyUI components (btn, card, modal, navbar, etc.) over building from scratch.

VITE CONFIG RULES (critical — do not change these):
9. The vite.config.ts MUST always have \`server.host: "0.0.0.0"\` and \`server.allowedHosts: true\`.
   These settings allow the CloudBase preview gateway to reach the dev server.
   Never set host to "127.0.0.1" or "localhost" — those block the gateway.
10. Do NOT add or change the \`base\` option in vite.config.ts.
    The dev server is launched with \`--base=/preview/\` as a CLI flag — this is managed automatically.
    If you add \`base\` to the config file it will conflict with the CLI flag.
11. When you need to reference the base path in code (e.g. for asset imports), use Vite's \`import.meta.env.BASE_URL\`.

CORRECT vite.config.ts structure:
\`\`\`typescript
${SANDBOX_VITE_CONFIG.trim()}
\`\`\``
}

export const CODING_DEV_SERVER_PORT = DEV_SERVER_PORT

interface PreviewPortInfo {
  port: number
  service?: string
  kind?: string
}

/**
 * Detect a running dev server inside the sandbox.
 * First tries the /preview/ports API endpoint (remote-workspace service).
 * Falls back to a bash-based port scan if that endpoint isn't available.
 * Returns the port number of the running dev server, or 0 if none found.
 */
async function detectDevServerPort(sandbox: SandboxInstance): Promise<number> {
  // Attempt 1: bash-based detection via devserver.log — most reliable
  // Vite prints "Local: http://localhost:PORT/" in its output
  try {
    const res = await sandbox.request('/api/tools/bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: [
          // Must have a vite process running
          `pgrep -f "vite" > /dev/null 2>&1 || exit 1`,
          // Extract port from devserver.log (Vite prints "Local:   http://127.0.0.1:PORT/")
          `grep -oE '(localhost|127\\.0\\.0\\.1):[0-9]+' /tmp/devserver.log 2>/dev/null | tail -1 | grep -oE '[0-9]+$'`,
        ].join(' && '),
        timeout: 5000,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await res.json()) as { result?: { output?: string } }
    const portStr = data.result?.output?.trim()
    if (portStr && /^\d+$/.test(portStr)) {
      const port = parseInt(portStr, 10)
      if (port > 0) return port
    }
  } catch {
    // fall through
  }

  // Attempt 2: HTTP ping on known default Vite port
  try {
    const res = await sandbox.request('/api/tools/bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_SERVER_PORT}/ 2>/dev/null || echo "0"`,
        timeout: 5000,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await res.json()) as { result?: { output?: string } }
    const code = data.result?.output?.trim()
    // Vite with --base=/preview/ redirects root / to /preview/ (302), which is also "running"
    if (code === '200' || code === '304' || code === '302') return DEV_SERVER_PORT
  } catch {
    // fall through
  }

  // Attempt 3: /preview/ports API (remote-workspace endpoint) — filter by vite service
  try {
    const res = await sandbox.request('/preview/ports', {
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { ports?: PreviewPortInfo[] }
      // Look for vite specifically to avoid picking up ttyd/other services
      const vitePort = data.ports?.find(
        (p) => p.service?.toLowerCase().includes('vite') || p.kind === 'vite-dev',
      )
      if (vitePort?.port) return vitePort.port
    }
  } catch {
    // fall through
  }

  return 0
}

/**
 * Detect the running dev server port, starting one if not found.
 * - First checks for an existing process via pgrep + ss / /proc/net/tcp6
 * - If none found, starts `npm run dev` in the workspace background
 * - Polls up to 15s for the server to become ready
 * Returns the port number, or throws if the server fails to start.
 */
export async function detectAndEnsureDevServer(sandbox: SandboxInstance, workspace: string): Promise<number> {
  // Step 1: check for already-running dev server
  const existingPort = await detectDevServerPort(sandbox)
  if (existingPort > 0) {
    // 检查是否以正确的 base 启动——看 devserver.log 是否包含正确标记。
    // 若不含(旧版启动方式),kill 掉重新拉起。
    let needRestart = false
    try {
      const logCheck = await sandbox.request('/api/tools/bash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `grep -q -- '--base=/preview/' /tmp/devserver.log 2>/dev/null && grep -q -- '--host' /tmp/devserver.log 2>/dev/null && echo "ok" || echo "restart"`,
          timeout: 5000,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const logData = (await logCheck.json()) as { result?: { output?: string } }
      needRestart = logData.result?.output?.trim() === 'restart'
    } catch {
      // 若检查失败，保守起见不重启
    }

    if (!needRestart) {
      console.log(`[CodingMode] Dev server already running on port ${existingPort} (with correct flags)`)
      return existingPort
    }

    // 旧版 dev server 未带正确标记，kill 后重启
    console.log('[CodingMode] Dev server needs restart with correct --base=/preview/ --host flags')
    try {
      await sandbox.request('/api/tools/bash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `pkill -f "vite" 2>/dev/null || true; sleep 1`,
          timeout: 5000,
        }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // ignore kill failure
    }
  }

  // Step 2: start dev server using PTY API (persistent process in sandbox's network namespace)
  // - `nohup ... &` gets killed when the bash subprocess exits
  // - tmux runs in a different network namespace, ports not visible to bash tool
  // - PTY creates a persistent process in the same namespace, ports are visible to bash tool
  console.log('[CodingMode] Starting dev server via PTY')
  const devCmd = `cd "${workspace}" && npm run dev -- --base=${VITE_BASE} --host ${VITE_HOST} > /tmp/devserver.log 2>&1`

  let ptyStarted = false
  try {
    const ptyRes = await sandbox.request('/api/tools/pty_create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: '/bin/bash',
        args: ['-c', devCmd],
        height: 50,
        width: 220,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (ptyRes.ok) {
      const ptyData = (await ptyRes.json()) as { success?: boolean; result?: { pid?: number } }
      if (ptyData.success && ptyData.result?.pid) {
        console.log(`[CodingMode] PTY started with PID ${ptyData.result.pid}`)
        ptyStarted = true
      }
    }
  } catch (ptyErr) {
    console.warn('[CodingMode] PTY start failed, falling back to nohup:', (ptyErr as Error).message)
  }

  // Fallback: nohup (may not work in some sandbox configurations)
  if (!ptyStarted) {
    await sandbox.request('/api/tools/bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `nohup /bin/bash -c ${JSON.stringify(devCmd)} > /dev/null 2>&1 &`,
        timeout: 10000,
      }),
      signal: AbortSignal.timeout(15_000),
    })
  }

  // Step 3: poll until port is detected (up to ~30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const port = await detectDevServerPort(sandbox)
    if (port > 0) {
      console.log(`[CodingMode] Dev server ready on port ${port}`)
      return port
    }
    if (i === 4) {
      // After 10s, dump the devserver log to help diagnose issues
      try {
        const logRes = await sandbox.request('/api/tools/bash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `tail -30 /tmp/devserver.log 2>/dev/null || echo "(no log)"`, timeout: 5000 }),
          signal: AbortSignal.timeout(10_000),
        })
        const logData = (await logRes.json()) as { result?: { output?: string } }
        console.log('[CodingMode] devserver.log:', logData.result?.output)
      } catch {
        // ignore
      }
    }
  }

  throw new Error('Dev server failed to start within timeout')
}
