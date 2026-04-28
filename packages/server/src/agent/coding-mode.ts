import type { SandboxInstance } from '../sandbox/scf-sandbox-manager.js'

const TEMPLATE_REPO = 'https://cnb.cool/tencent/cloud/cloudbase/awesome-cloudbase-examples.git'
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
// - base "./" for static hosting deployment (relative asset paths)
// - dev server is launched with --base=/preview/ CLI flag which overrides this
// - server.host "0.0.0.0" lets the CloudBase gateway proxy reach the dev server
// - server.allowedHosts true allows requests from the gateway domain
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
});
`

// ─── Supervisor state file ─────────────────────────────────────────────────
// /tmp/devserver.state 的值:
//   starting        supervisor 刚启动
//   installing      正在 npm install
//   install_failed  npm install 失败
//   workspace_error 找不到 workspace / package.json
//   running         dev server 正在运行
//   restarting      dev server 崩溃，supervisor 准备重启
const SUPERVISOR_STATE_FILE = '/tmp/devserver.state'
const SUPERVISOR_LOG_FILE = '/tmp/devserver.log'
const SUPERVISOR_SCRIPT_PATH = '/tmp/dev-supervisor.sh'

/**
 * 生成 supervisor 脚本内容。
 *
 * 模仿 VmDevServer (Freestyle) 的 systemd 模式：
 *   1. dev-server-install (oneshot): 如果 node_modules 不存在则 npm install
 *   2. dev-server (persistent):     npm run dev，退出后自动重启 (Restart=always)
 *
 * 状态写入 /tmp/devserver.state，方便后端轮询而无需解析日志。
 */
function buildSupervisorScript(workspace: string): string {
  return `#!/bin/bash
set -o pipefail

LOG="${SUPERVISOR_LOG_FILE}"
STATE="${SUPERVISOR_STATE_FILE}"
WORKSPACE="${workspace}"
TAR_FILE="$WORKSPACE/node_modules.tar.gz"
HASH_FILE="$WORKSPACE/node_modules.tar.gz.hash"

echo "starting" > "$STATE"
echo "[supervisor] started at $(date)" > "$LOG"
echo "[supervisor] workspace=$WORKSPACE" >> "$LOG"

# ── Step 1: verify workspace ─────────────────────────────────────────────────
if [ ! -f "$WORKSPACE/package.json" ]; then
  echo "workspace_error" > "$STATE"
  echo "[supervisor] ERROR: package.json not found at $WORKSPACE" >> "$LOG"
  ls "$(dirname "$WORKSPACE")" >> "$LOG" 2>&1 || true
  exit 1
fi
echo "[supervisor] workspace OK" >> "$LOG"

# ── Step 2: restore node_modules from tar cache if available ─────────────────
# tar 包存在 git archive 里，是单个二进制 blob，避免 git 追踪几万个小文件
if [ -f "$TAR_FILE" ] && [ ! -d "$WORKSPACE/node_modules" ]; then
  echo "installing" > "$STATE"
  echo "[supervisor] extracting node_modules from cache..." >> "$LOG"
  tar -xzf "$TAR_FILE" -C "$WORKSPACE" >> "$LOG" 2>&1 && \
    echo "[supervisor] cache extracted OK" >> "$LOG" || \
    echo "[supervisor] cache extract failed, will run npm install" >> "$LOG"
fi

# ── Step 3: npm install (always — 有缓存时秒退，有新包时只装增量) ────────────
echo "installing" > "$STATE"
echo "[supervisor] running npm install..." >> "$LOG"
cd "$WORKSPACE" && npm install >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
  echo "install_failed" > "$STATE"
  echo "[supervisor] npm install failed" >> "$LOG"
  exit 1
fi
echo "[supervisor] npm install done" >> "$LOG"

# ── Step 4: 如果 package-lock.json 有变化则重新打包 tar ─────────────────────
# lockfile hash 不变说明依赖没变，跳过打包节省时间
LOCK_HASH=$(md5sum "$WORKSPACE/package-lock.json" 2>/dev/null | cut -d' ' -f1 || echo "none")
OLD_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
if [ "$LOCK_HASH" != "$OLD_HASH" ]; then
  echo "[supervisor] package-lock.json changed, repacking node_modules cache..." >> "$LOG"
  tar -czf "$TAR_FILE" -C "$WORKSPACE" node_modules >> "$LOG" 2>&1 && \
    echo "$LOCK_HASH" > "$HASH_FILE" && \
    echo "[supervisor] cache repacked OK ($(du -sh $TAR_FILE | cut -f1))" >> "$LOG" || \
    echo "[supervisor] cache repack failed (non-fatal)" >> "$LOG"
else
  echo "[supervisor] package-lock.json unchanged, skipping repack" >> "$LOG"
fi

# ── Step 5: supervisor loop (Restart=always) ─────────────────────────────────
echo "running" > "$STATE"
while true; do
  echo "[supervisor] starting vite dev server..." >> "$LOG"
  cd "$WORKSPACE" && npm run dev -- --base=${VITE_BASE} --host ${VITE_HOST} >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[supervisor] vite exited with code $EXIT_CODE at $(date)" >> "$LOG"
  echo "restarting" > "$STATE"
  sleep 2
  echo "running" > "$STATE"
done
`
}

// ─── Sandbox helpers ──────────────────────────────────────────────────────

async function bashExec(sandbox: SandboxInstance, command: string, timeout = 10000): Promise<string> {
  try {
    const res = await sandbox.request('/api/tools/bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 5000),
    })
    const data = (await res.json()) as { result?: { output?: string } }
    return data.result?.output?.trim() ?? ''
  } catch {
    return ''
  }
}

async function writeFile(sandbox: SandboxInstance, path: string, content: string): Promise<boolean> {
  try {
    const res = await sandbox.request('/api/tools/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── vite.config.ts patch ─────────────────────────────────────────────────

/**
 * Patch vite.config.ts in the workspace to use the correct sandbox preview settings.
 * Safe to call multiple times (idempotent).
 */
async function patchViteConfig(sandbox: SandboxInstance, workspace: string): Promise<void> {
  const ok = await writeFile(sandbox, `${workspace}/vite.config.ts`, SANDBOX_VITE_CONFIG)
  if (!ok) {
    console.warn('[CodingMode] Failed to patch vite.config.ts (write returned error)')
  } else {
    console.log('[CodingMode] vite.config.ts patched for sandbox preview')
  }
}

// ─── Project init (clone only, no install) ───────────────────────────────
// npm install 由 supervisor 在后台异步完成，不阻塞 LLM 编码

export async function initCodingProject(sandbox: SandboxInstance, workspace: string): Promise<void> {
  // Check project state: ready | needs_install | not_found
  const checkStatus = await bashExec(
    sandbox,
    `if [ -f "${workspace}/package.json" ]; then echo "exists"; else echo "not_found"; fi`,
    5000,
  )

  if (checkStatus === 'exists') {
    console.log('[CodingMode] Project already cloned, skipping')
    return
  }

  // Clone template repo (sparse checkout for the specific subdir)
  console.log('[CodingMode] Cloning project template')
  const initScript = [
    `mkdir -p "${workspace}"`,
    `cd /tmp`,
    `rm -rf _template_repo`,
    `git clone --depth 1 --filter=blob:none --sparse ${TEMPLATE_REPO} _template_repo 2>&1`,
    `cd _template_repo`,
    `git sparse-checkout set ${TEMPLATE_SUBDIR} 2>&1`,
    `cp -r ${TEMPLATE_SUBDIR}/. "${workspace}/"`,
    `cd /tmp && rm -rf _template_repo`,
  ].join(' && ')

  const cloneOut = await bashExec(sandbox, initScript, 60000)
  console.log('[CodingMode] clone output:', cloneOut.slice(-200))

  // Verify package.json was actually copied
  const verifyOut = await bashExec(sandbox, `test -f "${workspace}/package.json" && echo "ok" || echo "missing"`, 5000)
  if (verifyOut.trim() !== 'ok') {
    throw new Error(
      `Template copy failed — package.json missing at ${workspace}. Clone output: ${cloneOut.slice(-300)}`,
    )
  }

  // Patch vite.config.ts for CloudBase sandbox preview compatibility
  await patchViteConfig(sandbox, workspace)

  // NOTE: npm install is NOT called here — supervisor handles it asynchronously
  console.log('[CodingMode] Project cloned, supervisor will handle npm install')
}

// ─── Supervisor management ────────────────────────────────────────────────

type SupervisorState =
  | 'starting'
  | 'installing'
  | 'install_failed'
  | 'workspace_error'
  | 'running'
  | 'restarting'
  | 'unknown'

async function readSupervisorState(sandbox: SandboxInstance): Promise<SupervisorState> {
  const out = await bashExec(sandbox, `cat ${SUPERVISOR_STATE_FILE} 2>/dev/null || echo "unknown"`, 3000)
  const valid: SupervisorState[] = [
    'starting',
    'installing',
    'install_failed',
    'workspace_error',
    'running',
    'restarting',
  ]
  return valid.includes(out as SupervisorState) ? (out as SupervisorState) : 'unknown'
}

async function readSupervisorLog(sandbox: SandboxInstance, lines = 30): Promise<string> {
  return bashExec(sandbox, `tail -${lines} ${SUPERVISOR_LOG_FILE} 2>/dev/null || echo "(no log)"`, 5000)
}

/**
 * Check if dev server is actually responding on the expected port.
 */
async function pingDevServer(sandbox: SandboxInstance): Promise<boolean> {
  const code = await bashExec(
    sandbox,
    `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_SERVER_PORT}/ 2>/dev/null || echo "0"`,
    5000,
  )
  return code === '200' || code === '302' || code === '304'
}

/**
 * Check if the supervisor is already running (state file exists and is recent).
 */
/**
 * Write supervisor script to sandbox and start it via PTY.
 * Returns the PID of the supervisor process if started successfully.
 */
async function startSupervisor(sandbox: SandboxInstance, workspace: string): Promise<boolean> {
  const script = buildSupervisorScript(workspace)

  // Write script via /api/tools/write
  const written = await writeFile(sandbox, SUPERVISOR_SCRIPT_PATH, script)
  if (!written) {
    // Fallback: write via bash heredoc
    console.warn('[CodingMode] write tool failed, trying heredoc fallback')
    await bashExec(sandbox, `cat > ${SUPERVISOR_SCRIPT_PATH} << 'SUPERVISOR_EOF'\n${script}\nSUPERVISOR_EOF`, 10000)
  }

  await bashExec(sandbox, `chmod +x ${SUPERVISOR_SCRIPT_PATH}`, 3000)

  // Clear old state + log
  await bashExec(
    sandbox,
    `echo "starting" > ${SUPERVISOR_STATE_FILE}; truncate -s 0 ${SUPERVISOR_LOG_FILE} 2>/dev/null; true`,
    3000,
  )

  // Start via PTY (persistent process in sandbox's network namespace)
  try {
    const ptyRes = await sandbox.request('/api/tools/pty_create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: '/bin/bash',
        args: [SUPERVISOR_SCRIPT_PATH],
        height: 50,
        width: 220,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (ptyRes.ok) {
      const ptyData = (await ptyRes.json()) as { success?: boolean; result?: { pid?: number } }
      if (ptyData.success && ptyData.result?.pid) {
        console.log(`[CodingMode] Supervisor started via PTY with PID ${ptyData.result.pid}`)
        return true
      }
    }
    console.warn('[CodingMode] PTY create returned non-success, falling back to nohup')
  } catch (err) {
    console.warn('[CodingMode] PTY start failed:', (err as Error).message)
  }

  // Fallback: nohup
  await bashExec(sandbox, `nohup ${SUPERVISOR_SCRIPT_PATH} > /dev/null 2>&1 &`, 5000)
  console.log('[CodingMode] Supervisor started via nohup fallback')
  return true
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Ensure the dev server is running via a supervisor process.
 *
 * Mirrors the VmDevServer (Freestyle / systemd) pattern:
 *   - supervisor handles npm install (oneshot) + npm run dev (persistent, auto-restart)
 *   - state is communicated via /tmp/devserver.state
 *   - logs in /tmp/devserver.log
 *
 * @param options.maxWaitSeconds  Max total seconds to wait. Default 45.
 *   When npm install is needed, this should be ≥ 90s.
 *   When node_modules already exists, 15s is enough for Vite to start.
 */
export async function detectAndEnsureDevServer(
  sandbox: SandboxInstance,
  workspace: string,
  options?: { maxPollSeconds?: number },
): Promise<number> {
  const maxWaitSeconds = options?.maxPollSeconds ?? 45

  // ── Step 1: check if already running and healthy ─────────────────────────
  const state = await readSupervisorState(sandbox)
  const running = state === 'running' || state === 'restarting'

  if (running) {
    const alive = await pingDevServer(sandbox)
    if (alive) {
      console.log(`[CodingMode] Dev server already running on port ${DEV_SERVER_PORT}`)
      return DEV_SERVER_PORT
    }
    // state=running 但 HTTP 不通：supervisor 可能已死（PTY 被杀）
    // 给 supervisor 自动重启一次机会（最多等 6s）
    console.log('[CodingMode] State=running but HTTP not responding, waiting for auto-restart...')
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      if (await pingDevServer(sandbox)) {
        console.log('[CodingMode] Dev server recovered')
        return DEV_SERVER_PORT
      }
    }
    // 6s 后仍不通 → supervisor 已死，强制重启
    console.log('[CodingMode] Supervisor appears dead, force-restarting...')
  }

  // ── Step 2: start supervisor (or restart if terminal/dead) ───────────────
  const terminalStates: SupervisorState[] = ['install_failed', 'workspace_error', 'unknown']
  const needsStart = !running || terminalStates.includes(state)
  if (needsStart || !running) {
    console.log(`[CodingMode] Starting supervisor for workspace: ${workspace}`)
    await startSupervisor(sandbox, workspace)
  }

  // ── Step 3: poll state file + HTTP until ready ───────────────────────────
  const pollInterval = 2000
  const maxPolls = Math.ceil((maxWaitSeconds * 1000) / pollInterval)
  const logDumpPoll = Math.max(2, Math.floor(maxPolls * 0.4)) // dump log at ~40% timeout

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval))

    const currentState = await readSupervisorState(sandbox)

    // Terminal error states — fail fast
    if (currentState === 'install_failed') {
      const log = await readSupervisorLog(sandbox)
      console.error('[CodingMode] npm install failed:\n', log)
      throw new Error('npm install failed — check devserver log')
    }
    if (currentState === 'workspace_error') {
      const log = await readSupervisorLog(sandbox)
      console.error('[CodingMode] Workspace error:\n', log)
      throw new Error(`Workspace error at ${workspace} — package.json not found`)
    }

    // HTTP ping when state says running
    if (currentState === 'running' || currentState === 'restarting') {
      const alive = await pingDevServer(sandbox)
      if (alive) {
        console.log(`[CodingMode] Dev server ready on port ${DEV_SERVER_PORT} (state=${currentState})`)
        return DEV_SERVER_PORT
      }
    }

    // Periodic log dump for diagnostics
    if (i === logDumpPoll) {
      const log = await readSupervisorLog(sandbox)
      console.log(`[CodingMode] supervisor state=${currentState}, log:\n${log}`)
    }
  }

  // Final log dump before giving up
  const finalLog = await readSupervisorLog(sandbox)
  const finalState = await readSupervisorState(sandbox)
  console.error(`[CodingMode] Timeout. state=${finalState}\n${finalLog}`)
  throw new Error(`Dev server failed to start within ${maxWaitSeconds}s (state=${finalState})`)
}

// ─── Exports ───────────────────────────────────────────────────────────────

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
9. COMPLETE THE ENTIRE TASK IN ONE TURN. Do not split work across multiple conversation turns.
   Write all necessary files, install dependencies (if needed), and ensure the app runs — all in a single response.
   Do not end your turn early expecting the user to ask you to continue.

VITE CONFIG RULES (critical — do not change these):
10. The vite.config.ts MUST always have \`server.host: "0.0.0.0"\` and \`server.allowedHosts: true\`.
    These settings allow the CloudBase preview gateway to reach the dev server.
    Never set host to "127.0.0.1" or "localhost" — those block the gateway.
11. Do NOT add or change the \`base\` option in vite.config.ts.
    The dev server is launched with \`--base=/preview/\` as a CLI flag — this is managed automatically.
    If you add \`base\` to the config file it will conflict with the CLI flag.
12. When you need to reference the base path in code (e.g. for asset imports), use Vite's \`import.meta.env.BASE_URL\`.

CORRECT vite.config.ts structure:
\`\`\`typescript
${SANDBOX_VITE_CONFIG.trim()}
\`\`\``
}

export const CODING_DEV_SERVER_PORT = DEV_SERVER_PORT

/**
 * @deprecated Use detectAndEnsureDevServer instead.
 */
export async function startDevServer(sandbox: SandboxInstance, workspace: string): Promise<void> {
  await detectAndEnsureDevServer(sandbox, workspace)
}
