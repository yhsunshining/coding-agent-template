import { Hono } from 'hono'
import { db } from '../db/client'
import { tasks, accounts, users, deployments } from '../db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { requireAuth, requireUserEnv, type AppEnv } from '../middleware/auth'
import { createTaskLogger } from '../lib/task-logger'
import { decrypt } from '../lib/crypto'
import { Octokit } from '@octokit/rest'
import { Sandbox } from '@vercel/sandbox'
import { persistenceService } from '../agent/persistence.service'
import type { Octokit as OctokitType } from '@octokit/rest'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_DIR = '/vercel/sandbox/project'
const MAX_SANDBOX_DURATION = parseInt(process.env.MAX_SANDBOX_DURATION || '300', 10)

// ---------------------------------------------------------------------------
// In-memory sandbox registry
// ---------------------------------------------------------------------------

const activeSandboxes = new Map<string, Sandbox>()

function registerSandbox(taskId: string, sandbox: Sandbox): void {
  activeSandboxes.set(taskId, sandbox)
}

function unregisterSandbox(taskId: string): void {
  activeSandboxes.delete(taskId)
}

function getSandbox(taskId: string): Sandbox | undefined {
  return activeSandboxes.get(taskId)
}

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

async function getUserGitHubToken(userId: string): Promise<string | null> {
  try {
    const account = await db
      .select({ accessToken: accounts.accessToken })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')))
      .limit(1)

    if (account[0]?.accessToken) {
      return decrypt(account[0].accessToken)
    }

    const user = await db
      .select({ accessToken: users.accessToken, provider: users.provider })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.provider, 'github')))
      .limit(1)

    if (user[0]?.accessToken) {
      return decrypt(user[0].accessToken)
    }

    return null
  } catch (error) {
    console.error('Error fetching user GitHub token:', error)
    return null
  }
}

async function getOctokit(userId: string): Promise<OctokitType> {
  const token = await getUserGitHubToken(userId)
  return new Octokit({ auth: token || undefined })
}

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
  if (match) {
    return { owner: match[1], repo: match[2] }
  }
  return null
}

// ---------------------------------------------------------------------------
// Sandbox helpers
// ---------------------------------------------------------------------------

interface CommandResult {
  success: boolean
  exitCode?: number
  output?: string
  error?: string
}

async function runCommandInSandbox(sandbox: Sandbox, command: string, args: string[] = []): Promise<CommandResult> {
  try {
    const result = await sandbox.runCommand(command, args)
    let stdout = ''
    let stderr = ''
    try {
      stdout = await (result.stdout as () => Promise<string>)()
    } catch {
      // ignore
    }
    try {
      stderr = await (result.stderr as () => Promise<string>)()
    } catch {
      // ignore
    }
    return { success: result.exitCode === 0, exitCode: result.exitCode, output: stdout, error: stderr }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Command failed' }
  }
}

async function runInProject(sandbox: Sandbox, command: string, args: string[] = []): Promise<CommandResult> {
  const escapeArg = (arg: string) => `'${arg.replace(/'/g, "'\\''")}'`
  const fullCommand = args.length > 0 ? `${command} ${args.map(escapeArg).join(' ')}` : command
  return runCommandInSandbox(sandbox, 'sh', ['-c', `cd ${PROJECT_DIR} && ${fullCommand}`])
}

async function reconnectSandbox(task: { sandboxId: string | null }): Promise<Sandbox | null> {
  const sandboxToken = process.env.SANDBOX_VERCEL_TOKEN
  const teamId = process.env.SANDBOX_VERCEL_TEAM_ID
  const projectId = process.env.SANDBOX_VERCEL_PROJECT_ID

  if (!sandboxToken || !teamId || !projectId || !task.sandboxId) return null

  try {
    return await Sandbox.get({
      sandboxId: task.sandboxId,
      teamId,
      projectId,
      token: sandboxToken,
    })
  } catch {
    return null
  }
}

async function getOrReconnectSandbox(taskId: string, task: { sandboxId: string | null }): Promise<Sandbox | null> {
  let sandbox = getSandbox(taskId)
  if (!sandbox) {
    sandbox = await reconnectSandbox(task)
  }
  return sandbox || null
}

type PackageManager = 'pnpm' | 'yarn' | 'npm'

async function detectPackageManager(sandbox: Sandbox): Promise<PackageManager> {
  const pnpmCheck = await runInProject(sandbox, 'test', ['-f', 'pnpm-lock.yaml'])
  if (pnpmCheck.success) return 'pnpm'
  const yarnCheck = await runInProject(sandbox, 'test', ['-f', 'yarn.lock'])
  if (yarnCheck.success) return 'yarn'
  return 'npm'
}

// ---------------------------------------------------------------------------
// File helpers (for diff/file-content routes)
// ---------------------------------------------------------------------------

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    sql: 'sql',
  }
  return langMap[ext || ''] || 'text'
}

function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'].includes(ext || '')
}

function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  const binaryExtensions = [
    'zip',
    'tar',
    'gz',
    'rar',
    '7z',
    'bz2',
    'exe',
    'dll',
    'so',
    'dylib',
    'db',
    'sqlite',
    'sqlite3',
    'mp3',
    'mp4',
    'avi',
    'mov',
    'wav',
    'flac',
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'ttf',
    'otf',
    'woff',
    'woff2',
    'eot',
    'bin',
    'dat',
    'dmg',
    'iso',
    'img',
  ]
  return binaryExtensions.includes(ext || '') || isImageFile(filename)
}

async function getFileContentFromGitHub(
  octokit: OctokitType,
  owner: string,
  repo: string,
  path: string,
  ref: string,
  isImage: boolean,
): Promise<{ content: string; isBase64: boolean }> {
  try {
    const response = await octokit.rest.repos.getContent({ owner, repo, path, ref })
    if ('content' in response.data && typeof response.data.content === 'string') {
      if (isImage) return { content: response.data.content, isBase64: true }
      return { content: Buffer.from(response.data.content, 'base64').toString('utf-8'), isBase64: false }
    }
    return { content: '', isBase64: false }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return { content: '', isBase64: false }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Helpers for Vite config in sandbox
// ---------------------------------------------------------------------------

const SANDBOX_VITE_CONFIG = `import { defineConfig, mergeConfig } from 'vite'

let userConfig = {}
try {
  const importedConfig = await import('./vite.config.js')
  userConfig = importedConfig.default || {}
} catch {
  // No user config or import failed
}

export default mergeConfig(userConfig, defineConfig({
  server: {
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: undefined,
  }
}))`

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const tasksRouter = new Hono<AppEnv>()

// List tasks
tasksRouter.get('/', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const userTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .orderBy(desc(tasks.createdAt))

  const parsedTasks = userTasks.map((t) => ({
    ...t,
    logs: t.logs ? JSON.parse(t.logs) : [],
    mcpServerIds: t.mcpServerIds ? JSON.parse(t.mcpServerIds) : null,
  }))

  return c.json({ tasks: parsedTasks })
})

// Create task
tasksRouter.post('/', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const body = await c.req.json()
  const {
    prompt,
    repoUrl,
    selectedAgent = 'claude',
    selectedModel,
    installDependencies = false,
    maxDuration = 300,
    keepAlive = false,
    enableBrowser = false,
  } = body

  if (!prompt || typeof prompt !== 'string') {
    return c.json({ error: 'prompt is required' }, 400)
  }

  const taskId = body.id || nanoid(12)
  const now = Date.now()

  await db.insert(tasks).values({
    id: taskId,
    userId: session.user.id,
    prompt,
    repoUrl: repoUrl || null,
    selectedAgent,
    selectedModel: selectedModel || null,
    installDependencies,
    maxDuration,
    keepAlive,
    enableBrowser,
    status: 'pending',
    progress: 0,
    logs: '[]',
    createdAt: now,
    updatedAt: now,
  })

  const [newTask] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)

  // TODO: In the future, trigger agent execution here via ACP

  return c.json({
    task: {
      ...newTask,
      logs: [],
      mcpServerIds: null,
    },
  })
})

// Get single task
tasksRouter.get('/:taskId', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const { taskId } = c.req.param()

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  return c.json({
    task: {
      ...task,
      logs: task.logs ? JSON.parse(task.logs) : [],
      mcpServerIds: task.mcpServerIds ? JSON.parse(task.mcpServerIds) : null,
    },
  })
})

// Update task (stop action)
tasksRouter.patch('/:taskId', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const { taskId } = c.req.param()
  const body = await c.req.json()

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!existing) {
    return c.json({ error: 'Task not found' }, 404)
  }

  if (body.action === 'stop') {
    if (existing.status !== 'processing') {
      return c.json({ error: 'Can only stop processing tasks' }, 400)
    }
    const logger = createTaskLogger(taskId)
    await logger.info('Task stopped by user')
    await logger.updateStatus('stopped', 'Task was stopped by user')

    const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    return c.json({ message: 'Task stopped', task: updated })
  }

  return c.json({ error: 'Invalid action' }, 400)
})

// Delete task (soft delete)
tasksRouter.delete('/:taskId', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const { taskId } = c.req.param()

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!existing) {
    return c.json({ error: 'Task not found' }, 404)
  }

  await db.update(tasks).set({ deletedAt: Date.now() }).where(eq(tasks.id, taskId))

  return c.json({ message: 'Task deleted' })
})

// Get task messages
tasksRouter.get('/:taskId/messages', requireUserEnv, async (c) => {
  const session = c.get('session')!
  const { envId, userId } = c.get('userEnv')!
  const { taskId } = c.req.param()

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  try {
    const cloudbaseRecords = await persistenceService.loadDBMessages(taskId, envId, userId, 100)
    const messages = cloudbaseRecords.map((record) => {
      const parts = (record.parts || []).map((p) => {
        if (p.contentType === 'text') {
          return { type: 'text' as const, text: p.content || '' }
        } else if (p.contentType === 'reasoning') {
          return { type: 'thinking' as const, text: p.content || '' }
        } else if (p.contentType === 'tool_call') {
          return {
            type: 'tool_call' as const,
            toolCallId: p.toolCallId || p.partId,
            toolName: (p.metadata?.toolCallName as string) || (p.metadata?.toolName as string) || 'tool',
            input: p.content || p.metadata?.input,
          }
        } else if (p.contentType === 'tool_result') {
          return {
            type: 'tool_result' as const,
            toolCallId: p.toolCallId || p.partId,
            toolName: (p.metadata?.toolName as string) || undefined,
            content: p.content || '',
            isError: p.metadata?.isError as boolean | undefined,
          }
        }
        return { type: 'text' as const, text: p.content || '' }
      })

      const textContent = parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('')

      return {
        id: record.recordId,
        taskId,
        role: record.role === 'user' ? 'user' : 'agent',
        content: textContent,
        parts,
        createdAt: record.createTime || Date.now(),
      }
    })
    return c.json({ messages })
  } catch {
    return c.json({ messages: [] })
  }
})

// Continue task (send follow-up message)
tasksRouter.post('/:taskId/continue', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const { taskId } = c.req.param()
  const body = await c.req.json()
  const { prompt } = body

  if (!prompt) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  const now = Date.now()

  // Update task status to processing
  await db.update(tasks).set({ status: 'processing', updatedAt: now }).where(eq(tasks.id, taskId))

  // TODO: Trigger agent continuation via ACP in background

  return c.json({
    message: 'Message sent',
  })
})

// ---------------------------------------------------------------------------
// GET /:taskId/files
// ---------------------------------------------------------------------------

interface FileChange {
  filename: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  changes: number
}

interface FileTreeNode {
  type: 'file' | 'directory'
  filename?: string
  status?: string
  additions?: number
  deletions?: number
  changes?: number
  children?: Record<string, FileTreeNode>
}

function addToFileTree(tree: Record<string, FileTreeNode>, filename: string, fileObj: FileChange) {
  const parts = filename.split('/')
  let currentLevel = tree

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isLastPart = i === parts.length - 1

    if (isLastPart) {
      currentLevel[part] = {
        type: 'file',
        filename: fileObj.filename,
        status: fileObj.status,
        additions: fileObj.additions,
        deletions: fileObj.deletions,
        changes: fileObj.changes,
      }
    } else {
      if (!currentLevel[part]) {
        currentLevel[part] = { type: 'directory', children: {} }
      }
      currentLevel = currentLevel[part].children!
    }
  }
}

tasksRouter.get('/:taskId/files', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const mode = c.req.query('mode') || 'remote'

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) {
      return c.json({ success: false, error: 'Task not found' }, 404)
    }

    if (!task.branchName) {
      return c.json({ success: true, files: [], fileTree: {}, branchName: null })
    }

    const repoUrl = task.repoUrl
    if (!repoUrl) {
      return c.json({ success: true, files: [], fileTree: {}, branchName: task.branchName })
    }

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) {
      return c.json({ success: false, error: 'GitHub authentication required' }, 401)
    }

    const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!githubMatch) {
      return c.json({ success: false, error: 'Invalid repository URL format' }, 400)
    }

    const [, owner, repo] = githubMatch
    let files: FileChange[] = []

    if (mode === 'local') {
      if (!task.sandboxId) {
        return c.json({ success: false, error: 'Sandbox is not running' }, 410)
      }

      try {
        let sandbox = getSandbox(taskId)
        if (!sandbox) {
          sandbox = await reconnectSandbox(task)
        }

        if (!sandbox) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Sandbox not found',
          })
        }

        const statusResult = await sandbox.runCommand({ cmd: 'git', args: ['status', '--porcelain'], cwd: PROJECT_DIR })
        if (statusResult.exitCode !== 0) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Failed to get local changes',
          })
        }

        const statusOutput = await statusResult.stdout()
        const statusLines = statusOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim())

        const checkRemoteResult = await sandbox.runCommand({
          cmd: 'git',
          args: ['rev-parse', '--verify', `origin/${task.branchName}`],
          cwd: PROJECT_DIR,
        })
        const remoteBranchExists = checkRemoteResult.exitCode === 0
        const compareRef = remoteBranchExists ? `origin/${task.branchName}` : 'HEAD'

        const numstatResult = await sandbox.runCommand({
          cmd: 'git',
          args: ['diff', '--numstat', compareRef],
          cwd: PROJECT_DIR,
        })
        const diffStats: Record<string, { additions: number; deletions: number }> = {}

        if (numstatResult.exitCode === 0) {
          const numstatOutput = await numstatResult.stdout()
          for (const line of numstatOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim())) {
            const parts = line.split('\t')
            if (parts.length >= 3) {
              diffStats[parts[2]] = { additions: parseInt(parts[0]) || 0, deletions: parseInt(parts[1]) || 0 }
            }
          }
        }

        const filePromises = statusLines.map(async (line) => {
          const indexStatus = line.charAt(0)
          const worktreeStatus = line.charAt(1)
          let filename = line.substring(2).trim()

          if (indexStatus === 'R' || worktreeStatus === 'R') {
            const arrowIndex = filename.indexOf(' -> ')
            if (arrowIndex !== -1) filename = filename.substring(arrowIndex + 4).trim()
          }

          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
          if (indexStatus === 'R' || worktreeStatus === 'R') status = 'renamed'
          else if (indexStatus === 'A' || worktreeStatus === 'A' || (indexStatus === '?' && worktreeStatus === '?'))
            status = 'added'
          else if (indexStatus === 'D' || worktreeStatus === 'D') status = 'deleted'

          let stats = diffStats[filename] || { additions: 0, deletions: 0 }
          if (
            (indexStatus === '?' && worktreeStatus === '?') ||
            (indexStatus === 'A' && !stats.additions && !stats.deletions)
          ) {
            const wcResult = await sandbox!.runCommand({ cmd: 'wc', args: ['-l', filename], cwd: PROJECT_DIR })
            if (wcResult.exitCode === 0) {
              const wcOutput = await wcResult.stdout()
              stats = { additions: parseInt(wcOutput.trim().split(/\s+/)[0]) || 0, deletions: 0 }
            }
          }

          return {
            filename,
            status,
            additions: stats.additions,
            deletions: stats.deletions,
            changes: stats.additions + stats.deletions,
          }
        })

        files = await Promise.all(filePromises)
      } catch (error) {
        const is410 =
          error &&
          typeof error === 'object' &&
          (('status' in error && (error as { status: number }).status === 410) ||
            ('response' in error &&
              typeof (error as { response?: { status?: number } }).response === 'object' &&
              (error as { response?: { status?: number } }).response?.status === 410))
        if (is410) {
          await db.update(tasks).set({ sandboxId: null, sandboxUrl: null }).where(eq(tasks.id, taskId))
          unregisterSandbox(taskId)
          return c.json({ success: false, error: 'Sandbox is not running' }, 410)
        }
        return c.json({ success: false, error: 'Failed to fetch local changes' }, 500)
      }
    } else if (mode === 'all-local') {
      if (!task.sandboxId) {
        return c.json({ success: false, error: 'Sandbox is not running' }, 410)
      }

      try {
        let sandbox = getSandbox(taskId)
        if (!sandbox) sandbox = await reconnectSandbox(task)

        if (!sandbox) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Sandbox not found',
          })
        }

        const findResult = await sandbox.runCommand({
          cmd: 'find',
          args: [
            '.',
            '-type',
            'f',
            '-not',
            '-path',
            '*/.git/*',
            '-not',
            '-path',
            '*/node_modules/*',
            '-not',
            '-path',
            '*/.next/*',
            '-not',
            '-path',
            '*/dist/*',
            '-not',
            '-path',
            '*/build/*',
            '-not',
            '-path',
            '*/.vercel/*',
          ],
          cwd: PROJECT_DIR,
        })

        if (findResult.exitCode !== 0) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Failed to list files',
          })
        }

        const findOutput = await findResult.stdout()
        const fileLines = findOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim() && line !== '.')
          .map((line) => line.replace(/^\.\//, ''))

        const statusResult = await sandbox.runCommand({ cmd: 'git', args: ['status', '--porcelain'], cwd: PROJECT_DIR })
        const changedFilesMap: Record<string, 'added' | 'modified' | 'deleted' | 'renamed'> = {}

        if (statusResult.exitCode === 0) {
          const statusOutput = await statusResult.stdout()
          for (const line of statusOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim())) {
            const indexStatus = line.charAt(0)
            const worktreeStatus = line.charAt(1)
            let filename = line.substring(2).trim()
            if (indexStatus === 'R' || worktreeStatus === 'R') {
              const arrowIndex = filename.indexOf(' -> ')
              if (arrowIndex !== -1) filename = filename.substring(arrowIndex + 4).trim()
            }
            let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
            if (indexStatus === 'R' || worktreeStatus === 'R') status = 'renamed'
            else if (indexStatus === 'A' || worktreeStatus === 'A' || (indexStatus === '?' && worktreeStatus === '?'))
              status = 'added'
            else if (indexStatus === 'D' || worktreeStatus === 'D') status = 'deleted'
            changedFilesMap[filename] = status
          }
        }

        files = fileLines.map((filename) => {
          const trimmed = filename.trim()
          const status = changedFilesMap[trimmed] || ('renamed' as const)
          return { filename: trimmed, status, additions: 0, deletions: 0, changes: 0 }
        })
      } catch (error) {
        const is410 =
          error &&
          typeof error === 'object' &&
          (('status' in error && (error as { status: number }).status === 410) ||
            ('response' in error &&
              typeof (error as { response?: { status?: number } }).response === 'object' &&
              (error as { response?: { status?: number } }).response?.status === 410))
        if (is410) {
          await db.update(tasks).set({ sandboxId: null, sandboxUrl: null }).where(eq(tasks.id, taskId))
          unregisterSandbox(taskId)
          return c.json({ success: false, error: 'Sandbox is not running' }, 410)
        }
        return c.json({ success: false, error: 'Failed to fetch local files' }, 500)
      }
    } else if (mode === 'all') {
      try {
        const treeResponse = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: task.branchName,
          recursive: 'true',
        })
        files = treeResponse.data.tree
          .filter((item) => item.type === 'blob' && item.path)
          .map((item) => ({
            filename: item.path!,
            status: 'modified' as const,
            additions: 0,
            deletions: 0,
            changes: 0,
          }))
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Branch not found or still being created',
          })
        }
        return c.json({ success: false, error: 'Failed to fetch repository tree from GitHub' }, 500)
      }
    } else {
      // remote mode
      try {
        try {
          await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName })
        } catch (branchError: unknown) {
          if (
            branchError &&
            typeof branchError === 'object' &&
            'status' in branchError &&
            (branchError as { status: number }).status === 404
          ) {
            return c.json({
              success: true,
              files: [],
              fileTree: {},
              branchName: task.branchName,
              message: 'Branch is being created...',
            })
          }
          throw branchError
        }

        let comparison
        try {
          comparison = await octokit.rest.repos.compareCommits({ owner, repo, base: 'main', head: task.branchName })
        } catch (mainError: unknown) {
          if (
            mainError &&
            typeof mainError === 'object' &&
            'status' in mainError &&
            (mainError as { status: number }).status === 404
          ) {
            try {
              comparison = await octokit.rest.repos.compareCommits({
                owner,
                repo,
                base: 'master',
                head: task.branchName,
              })
            } catch (masterError: unknown) {
              if (
                masterError &&
                typeof masterError === 'object' &&
                'status' in masterError &&
                (masterError as { status: number }).status === 404
              ) {
                return c.json({
                  success: true,
                  files: [],
                  fileTree: {},
                  branchName: task.branchName,
                  message: 'No base branch found for comparison',
                })
              }
              throw masterError
            }
          } else {
            throw mainError
          }
        }

        files =
          comparison.data.files?.map((file) => ({
            filename: file.filename,
            status: file.status as 'added' | 'modified' | 'deleted' | 'renamed',
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || 0,
          })) || []
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: 'Branch not found or still being created',
          })
        }
        return c.json({ success: false, error: 'Failed to fetch file changes from GitHub' }, 500)
      }
    }

    const fileTree: Record<string, FileTreeNode> = {}
    for (const file of files) {
      addToFileTree(fileTree, file.filename, file)
    }

    return c.json({ success: true, files, fileTree, branchName: task.branchName })
  } catch (error) {
    console.error('Error fetching task files:', error)
    return c.json({ success: false, error: 'Failed to fetch task files' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/file-content
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/file-content', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const rawFilename = c.req.query('filename')
    const mode = c.req.query('mode') || 'remote'

    if (!rawFilename) {
      return c.json({ error: 'Missing filename parameter' }, 400)
    }

    const filename = decodeURIComponent(rawFilename)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.branchName || !task.repoUrl)
      return c.json({ error: 'Task does not have branch or repository information' }, 400)

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub authentication required' }, 401)

    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!githubMatch) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const [, owner, repo] = githubMatch
    const isImage = isImageFile(filename)
    const isBinary = isBinaryFile(filename)

    if (isBinary && !isImage) {
      return c.json({
        success: true,
        data: { filename, oldContent: '', newContent: '', language: 'text', isBinary: true, isImage: false },
      })
    }

    const isNodeModulesFile = filename.includes('/node_modules/')
    let oldContent = ''
    let newContent = ''
    let isBase64 = false
    let fileFound = false

    if (mode === 'local') {
      if (!isNodeModulesFile) {
        const remoteResult = await getFileContentFromGitHub(octokit, owner, repo, filename, task.branchName, isImage)
        oldContent = remoteResult.content
        isBase64 = remoteResult.isBase64
      }

      if (task.sandboxId) {
        try {
          const sandbox = await getOrReconnectSandbox(taskId, task)
          if (sandbox) {
            const normalizedPath = filename.startsWith('/') ? filename.substring(1) : filename
            const catResult = await sandbox.runCommand({ cmd: 'cat', args: [normalizedPath], cwd: PROJECT_DIR })
            if (catResult.exitCode === 0) {
              newContent = await catResult.stdout()
              fileFound = true
            }
          }
        } catch (sandboxError) {
          console.error('Error reading from sandbox:', sandboxError)
        }
      }

      if (!fileFound) return c.json({ error: 'File not found in sandbox' }, 404)
    } else {
      let content = ''

      if (isNodeModulesFile && task.sandboxId) {
        try {
          const sandbox = await getOrReconnectSandbox(taskId, task)
          if (sandbox) {
            const normalizedPath = filename.startsWith('/') ? filename.substring(1) : filename
            const catResult = await sandbox.runCommand('cat', [normalizedPath])
            if (catResult.exitCode === 0) {
              content = await catResult.stdout()
              fileFound = true
            }
          }
        } catch (sandboxError) {
          console.error('Error reading node_modules file from sandbox:', sandboxError)
        }
      } else {
        const result = await getFileContentFromGitHub(octokit, owner, repo, filename, task.branchName, isImage)
        content = result.content
        isBase64 = result.isBase64
        if (content || isImage) fileFound = true
      }

      if (!fileFound && !isImage && !isNodeModulesFile && task.sandboxId) {
        try {
          const sandbox = await getOrReconnectSandbox(taskId, task)
          if (sandbox) {
            const normalizedPath = filename.startsWith('/') ? filename.substring(1) : filename
            const catResult = await sandbox.runCommand('cat', [normalizedPath])
            if (catResult.exitCode === 0) {
              content = await catResult.stdout()
              fileFound = true
            }
          }
        } catch (sandboxError) {
          console.error('Error reading from sandbox:', sandboxError)
        }
      }

      if (!fileFound && !isImage) return c.json({ error: 'File not found in branch' }, 404)
      oldContent = ''
      newContent = content
    }

    return c.json({
      success: true,
      data: {
        filename,
        oldContent,
        newContent,
        language: getLanguageFromFilename(filename),
        isBinary: false,
        isImage,
        isBase64,
      },
    })
  } catch (error) {
    console.error('Error in file-content API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/save-file
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/save-file', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { filename, content } = body

    if (!filename || content === undefined) return c.json({ error: 'Missing filename or content' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ error: 'Task does not have an active sandbox' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ error: 'Sandbox not available' }, 400)

    const escapedFilename = "'" + filename.replace(/'/g, "'\\''") + "'"
    const encodedContent = Buffer.from(content).toString('base64')
    const writeCommand = `echo '${encodedContent}' | base64 -d > ${escapedFilename}`

    const result = await sandbox.runCommand({ cmd: 'sh', args: ['-c', writeCommand], cwd: PROJECT_DIR })
    if (result.exitCode !== 0) {
      return c.json({ error: 'Failed to write file to sandbox' }, 500)
    }

    return c.json({ success: true, message: 'File saved successfully' })
  } catch (error) {
    console.error('Error in save-file API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/create-file
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/create-file', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { filename } = body

    if (!filename || typeof filename !== 'string') return c.json({ success: false, error: 'Filename is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found or inactive' }, 400)

    const pathParts = filename.split('/')
    if (pathParts.length > 1) {
      const dirPath = pathParts.slice(0, -1).join('/')
      const mkdirResult = await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', dirPath], cwd: PROJECT_DIR })
      if (mkdirResult.exitCode !== 0) {
        return c.json({ success: false, error: 'Failed to create parent directories' }, 500)
      }
    }

    const touchResult = await sandbox.runCommand({ cmd: 'touch', args: [filename], cwd: PROJECT_DIR })
    if (touchResult.exitCode !== 0) {
      return c.json({ success: false, error: 'Failed to create file' }, 500)
    }

    return c.json({ success: true, message: 'File created successfully', filename })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
      return c.json({ success: false, error: 'Sandbox is not running' }, 410)
    }
    return c.json({ success: false, error: 'An error occurred while creating the file' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/create-folder
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/create-folder', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { foldername } = body

    if (!foldername || typeof foldername !== 'string')
      return c.json({ success: false, error: 'Foldername is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found or inactive' }, 400)

    const mkdirResult = await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', foldername], cwd: PROJECT_DIR })
    if (mkdirResult.exitCode !== 0) {
      return c.json({ success: false, error: 'Failed to create folder' }, 500)
    }

    return c.json({ success: true, message: 'Folder created successfully', foldername })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
      return c.json({ success: false, error: 'Sandbox is not running' }, 410)
    }
    return c.json({ success: false, error: 'An error occurred while creating the folder' }, 500)
  }
})

// ---------------------------------------------------------------------------
// DELETE /:taskId/delete-file
// ---------------------------------------------------------------------------

tasksRouter.delete('/:taskId/delete-file', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { filename } = body

    if (!filename || typeof filename !== 'string') return c.json({ success: false, error: 'Filename is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found or inactive' }, 400)

    const rmResult = await sandbox.runCommand({ cmd: 'rm', args: [filename], cwd: PROJECT_DIR })
    if (rmResult.exitCode !== 0) {
      return c.json({ success: false, error: 'Failed to delete file' }, 500)
    }

    return c.json({ success: true, message: 'File deleted successfully', filename })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
      return c.json({ success: false, error: 'Sandbox is not running' }, 410)
    }
    return c.json({ success: false, error: 'An error occurred while deleting the file' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/discard-file-changes
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/discard-file-changes', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { filename } = body

    if (!filename) return c.json({ success: false, error: 'Missing filename parameter' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found or inactive' }, 400)

    const lsFilesResult = await sandbox.runCommand({ cmd: 'git', args: ['ls-files', filename], cwd: PROJECT_DIR })
    const isTracked = (await lsFilesResult.stdout()).trim().length > 0

    if (isTracked) {
      const checkoutResult = await sandbox.runCommand({
        cmd: 'git',
        args: ['checkout', 'HEAD', '--', filename],
        cwd: PROJECT_DIR,
      })
      if (checkoutResult.exitCode !== 0) {
        return c.json({ success: false, error: 'Failed to discard changes' }, 500)
      }
    } else {
      const rmResult = await sandbox.runCommand({ cmd: 'rm', args: [filename], cwd: PROJECT_DIR })
      if (rmResult.exitCode !== 0) {
        return c.json({ success: false, error: 'Failed to delete file' }, 500)
      }
    }

    return c.json({
      success: true,
      message: isTracked ? 'Changes discarded successfully' : 'New file deleted successfully',
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
      return c.json({ success: false, error: 'Sandbox is not running' }, 410)
    }
    return c.json({ success: false, error: 'An error occurred while discarding changes' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/diff
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/diff', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const filename = c.req.query('filename')
    const mode = c.req.query('mode')

    if (!filename) return c.json({ error: 'Missing filename parameter' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.branchName || !task.repoUrl)
      return c.json({ error: 'Task does not have branch or repository information' }, 400)

    if (mode === 'local') {
      if (!task.sandboxId) return c.json({ error: 'Sandbox not available' }, 400)

      try {
        const sandbox = await getOrReconnectSandbox(taskId, task)
        if (!sandbox) return c.json({ error: 'Sandbox not found or inactive' }, 400)

        await sandbox.runCommand({ cmd: 'git', args: ['fetch', 'origin', task.branchName], cwd: PROJECT_DIR })

        const checkRemoteResult = await sandbox.runCommand({
          cmd: 'git',
          args: ['rev-parse', '--verify', `origin/${task.branchName}`],
          cwd: PROJECT_DIR,
        })
        const remoteBranchExists = checkRemoteResult.exitCode === 0

        if (!remoteBranchExists) {
          const oldContentResult = await sandbox.runCommand({
            cmd: 'git',
            args: ['show', `HEAD:${filename}`],
            cwd: PROJECT_DIR,
          })
          const oldContent = oldContentResult.exitCode === 0 ? await oldContentResult.stdout() : ''
          const newContentResult = await sandbox.runCommand({ cmd: 'cat', args: [filename], cwd: PROJECT_DIR })
          const newContent = newContentResult.exitCode === 0 ? await newContentResult.stdout() : ''
          return c.json({
            success: true,
            data: {
              filename,
              oldContent,
              newContent,
              language: getLanguageFromFilename(filename),
              isBinary: false,
              isImage: false,
            },
          })
        }

        const remoteBranchRef = `origin/${task.branchName}`
        const oldContentResult = await sandbox.runCommand({
          cmd: 'git',
          args: ['show', `${remoteBranchRef}:${filename}`],
          cwd: PROJECT_DIR,
        })
        const oldContent = oldContentResult.exitCode === 0 ? await oldContentResult.stdout() : ''
        const newContentResult = await sandbox.runCommand({ cmd: 'cat', args: [filename], cwd: PROJECT_DIR })
        const newContent = newContentResult.exitCode === 0 ? await newContentResult.stdout() : ''

        return c.json({
          success: true,
          data: {
            filename,
            oldContent,
            newContent,
            language: getLanguageFromFilename(filename),
            isBinary: false,
            isImage: false,
          },
        })
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
          return c.json({ error: 'Sandbox is not running' }, 410)
        }
        return c.json({ error: 'Failed to get local diff' }, 500)
      }
    }

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub authentication required' }, 401)

    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!githubMatch) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const [, owner, repo] = githubMatch
    const isImage = isImageFile(filename)
    const isBinary = isBinaryFile(filename)

    if (isBinary && !isImage) {
      return c.json({
        success: true,
        data: { filename, oldContent: '', newContent: '', language: 'text', isBinary: true, isImage: false },
      })
    }

    let oldContent = ''
    let newContent = ''
    let newIsBase64 = false
    let baseRef = 'main'
    let headRef = task.branchName

    if (task.prNumber) {
      try {
        const prResponse = await octokit.rest.pulls.get({ owner, repo, pull_number: task.prNumber })
        baseRef = prResponse.data.base.sha
        headRef = prResponse.data.head.sha
        if (prResponse.data.merged_at && prResponse.data.merge_commit_sha && !task.prMergeCommitSha) {
          await db
            .update(tasks)
            .set({ prMergeCommitSha: prResponse.data.merge_commit_sha, updatedAt: Date.now() })
            .where(eq(tasks.id, task.id))
        }
      } catch {
        // fall through to default
      }
    }

    try {
      const result = await getFileContentFromGitHub(octokit, owner, repo, filename, baseRef, isImage)
      oldContent = result.content
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 404 &&
        baseRef === 'main'
      ) {
        try {
          const result = await getFileContentFromGitHub(octokit, owner, repo, filename, 'master', isImage)
          oldContent = result.content
        } catch {
          oldContent = ''
        }
      }
    }

    try {
      const result = await getFileContentFromGitHub(octokit, owner, repo, filename, headRef, isImage)
      newContent = result.content
      newIsBase64 = result.isBase64
    } catch {
      newContent = ''
    }

    if (!oldContent && !newContent) return c.json({ error: 'File not found in either branch' }, 404)

    return c.json({
      success: true,
      data: {
        filename,
        oldContent: oldContent || '',
        newContent: newContent || '',
        language: getLanguageFromFilename(filename),
        isBinary: false,
        isImage,
        isBase64: newIsBase64,
      },
    })
  } catch (error) {
    console.error('Error in diff API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/pr
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/pr', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { title, body: prBody, baseBranch = 'main' } = body

    if (!title) return c.json({ error: 'PR title is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.repoUrl || !task.branchName)
      return c.json({ error: 'Task does not have repository or branch information' }, 400)

    if (task.prUrl) {
      return c.json({ success: true, data: { prUrl: task.prUrl, prNumber: task.prNumber, alreadyExists: true } })
    }

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub account not connected' }, 401)

    const parsed = parseGitHubUrl(task.repoUrl)
    if (!parsed) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const { owner, repo } = parsed

    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: prBody || '',
      head: task.branchName,
      base: baseBranch,
    })

    const [updatedTask] = await db
      .update(tasks)
      .set({ prUrl: response.data.html_url, prNumber: response.data.number, prStatus: 'open', updatedAt: Date.now() })
      .where(eq(tasks.id, taskId))
      .returning()

    return c.json({
      success: true,
      data: { prUrl: response.data.html_url, prNumber: response.data.number, task: updatedTask },
    })
  } catch (error) {
    console.error('Error creating pull request:', error)
    return c.json({ error: 'Failed to create pull request' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/sync-changes
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/sync-changes', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json().catch(() => ({}))
    const { commitMessage } = body

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)
    if (!task.branchName) return c.json({ success: false, error: 'Branch not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found or inactive' }, 400)

    const addResult = await sandbox.runCommand({ cmd: 'git', args: ['add', '.'], cwd: PROJECT_DIR })
    if (addResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to add changes' }, 500)

    const statusResult = await sandbox.runCommand({ cmd: 'git', args: ['status', '--porcelain'], cwd: PROJECT_DIR })
    if (statusResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to check status' }, 500)

    const statusOutput = await statusResult.stdout()
    if (!statusOutput.trim())
      return c.json({ success: true, message: 'No changes to sync', committed: false, pushed: false })

    const message = commitMessage || 'Sync local changes'
    const commitResult = await sandbox.runCommand({ cmd: 'git', args: ['commit', '-m', message], cwd: PROJECT_DIR })
    if (commitResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to commit changes' }, 500)

    const pushResult = await sandbox.runCommand({
      cmd: 'git',
      args: ['push', 'origin', task.branchName],
      cwd: PROJECT_DIR,
    })
    if (pushResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to push changes' }, 500)

    return c.json({ success: true, message: 'Changes synced successfully', committed: true, pushed: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 410) {
      return c.json({ success: false, error: 'Sandbox is not running' }, 410)
    }
    return c.json({ success: false, error: 'An error occurred while syncing changes' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/sync-pr
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/sync-pr', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.repoUrl || !task.prNumber)
      return c.json({ error: 'Task does not have repository or PR information' }, 400)

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub account not connected' }, 401)

    const parsed = parseGitHubUrl(task.repoUrl)
    if (!parsed) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const { owner, repo } = parsed
    const response = await octokit.rest.pulls.get({ owner, repo, pull_number: task.prNumber })

    let status: 'open' | 'closed' | 'merged'
    if (response.data.merged_at) status = 'merged'
    else if (response.data.state === 'closed') status = 'closed'
    else status = 'open'

    const mergeCommitSha = response.data.merge_commit_sha || null
    const updateData: {
      prStatus: 'open' | 'closed' | 'merged'
      prMergeCommitSha: string | null
      completedAt?: number
      updatedAt: number
    } = {
      prStatus: status,
      prMergeCommitSha: mergeCommitSha,
      updatedAt: Date.now(),
    }
    if (status === 'merged') updateData.completedAt = Date.now()

    await db.update(tasks).set(updateData).where(eq(tasks.id, taskId))

    return c.json({ success: true, data: { status, mergeCommitSha } })
  } catch (error) {
    console.error('Error syncing pull request status:', error)
    return c.json({ error: 'Failed to sync pull request status' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/merge-pr
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/merge-pr', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { commitTitle, commitMessage, mergeMethod = 'squash' } = body

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.repoUrl || !task.prNumber)
      return c.json({ error: 'Task does not have repository or PR information' }, 400)

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub account not connected' }, 401)

    const parsed = parseGitHubUrl(task.repoUrl)
    if (!parsed) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const { owner, repo } = parsed
    const response = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: task.prNumber,
      commit_title: commitTitle,
      commit_message: commitMessage,
      merge_method: mergeMethod,
    })

    if (task.sandboxId) {
      try {
        const sandbox = await Sandbox.get({
          sandboxId: task.sandboxId,
          teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
          projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
          token: process.env.SANDBOX_VERCEL_TOKEN!,
        })
        await sandbox.stop()
        unregisterSandbox(taskId)
      } catch (sandboxError) {
        console.error('Error stopping sandbox after merge:', sandboxError)
      }
    }

    await db
      .update(tasks)
      .set({
        prStatus: 'merged',
        prMergeCommitSha: response.data.sha || null,
        sandboxId: null,
        sandboxUrl: null,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(tasks.id, taskId))

    return c.json({
      success: true,
      data: { merged: response.data.merged, message: response.data.message, sha: response.data.sha },
    })
  } catch (error) {
    console.error('Error merging pull request:', error)
    return c.json({ error: 'Failed to merge pull request' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/close-pr
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/close-pr', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.repoUrl || !task.prNumber) return c.json({ error: 'Task does not have a pull request' }, 400)

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub authentication required' }, 401)

    const parsed = parseGitHubUrl(task.repoUrl)
    if (!parsed) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const { owner, repo } = parsed

    try {
      await octokit.rest.pulls.update({ owner, repo, pull_number: task.prNumber, state: 'closed' })
      await db.update(tasks).set({ prStatus: 'closed', updatedAt: Date.now() }).where(eq(tasks.id, task.id))
      return c.json({ success: true, message: 'Pull request closed successfully' })
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status
        if (status === 404) return c.json({ error: 'Pull request not found' }, 404)
        if (status === 403) return c.json({ error: 'Permission denied. Check repository access' }, 403)
      }
      return c.json({ error: 'Failed to close pull request' }, 500)
    }
  } catch (error) {
    console.error('Error in close PR API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/reopen-pr
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/reopen-pr', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.repoUrl || !task.prNumber) return c.json({ error: 'Task does not have a pull request' }, 400)

    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ error: 'GitHub authentication required' }, 401)

    const parsed = parseGitHubUrl(task.repoUrl)
    if (!parsed) return c.json({ error: 'Invalid GitHub repository URL' }, 400)

    const { owner, repo } = parsed

    try {
      await octokit.rest.pulls.update({ owner, repo, pull_number: task.prNumber, state: 'open' })
      await db.update(tasks).set({ prStatus: 'open', updatedAt: Date.now() }).where(eq(tasks.id, task.id))
      return c.json({ success: true, message: 'Pull request reopened successfully' })
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status
        if (status === 404) return c.json({ error: 'Pull request not found' }, 404)
        if (status === 403) return c.json({ error: 'Permission denied. Check repository access' }, 403)
      }
      return c.json({ error: 'Failed to reopen pull request' }, 500)
    }
  } catch (error) {
    console.error('Error in reopen PR API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/project-files
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/project-files', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ error: 'Task does not have an active sandbox' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ error: 'Sandbox not available' }, 400)

    // LSP handles file resolution on demand; no need to pre-load files
    return c.json({ success: true, files: [] })
  } catch (error) {
    console.error('Error in project-files API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/lsp
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/lsp', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)
      .then((rows) => rows[0])

    if (!task || task.userId !== session.user.id) return c.json({ error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ error: 'Task does not have an active sandbox' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ error: 'Sandbox not available' }, 400)

    const body = await c.req.json()
    const { method, filename, position } = body
    const absoluteFilename = filename.startsWith('/') ? filename : `/${filename}`

    switch (method) {
      case 'textDocument/definition': {
        const scriptPath = '.lsp-helper.mjs'
        const helperScript = `
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const filename = '${absoluteFilename.replace(/'/g, "\\'")}';
const line = ${position.line};
const character = ${position.character};

let configPath = process.cwd();
while (configPath !== '/') {
  const tsconfigPath = path.join(configPath, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) { break; }
  configPath = path.dirname(configPath);
}

const tsconfigPath = path.join(configPath, 'tsconfig.json');
const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configPath);

const files = new Map();
const host = {
  getScriptFileNames: () => parsedConfig.fileNames,
  getScriptVersion: (fileName) => { const file = files.get(fileName); return file && file.version ? file.version.toString() : '0'; },
  getScriptSnapshot: (fileName) => { if (!fs.existsSync(fileName)) return undefined; const content = fs.readFileSync(fileName, 'utf8'); return ts.ScriptSnapshot.fromString(content); },
  getCurrentDirectory: () => configPath,
  getCompilationSettings: () => parsedConfig.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const fullPath = path.resolve(configPath, filename.replace(/^\\/*/g, ''));
const program = service.getProgram();
if (!program) { console.error(JSON.stringify({ error: 'Failed to get program' })); process.exit(1); }

const sourceFile = program.getSourceFile(fullPath);
if (!sourceFile) { console.error(JSON.stringify({ error: 'File not found', filename: fullPath })); process.exit(1); }

const offset = ts.getPositionOfLineAndCharacter(sourceFile, line, character);
const definitions = service.getDefinitionAtPosition(fullPath, offset);

if (definitions && definitions.length > 0) {
  const results = definitions.map(def => {
    const defSourceFile = program.getSourceFile(def.fileName);
    if (!defSourceFile) return null;
    const start = ts.getLineAndCharacterOfPosition(defSourceFile, def.textSpan.start);
    const end = ts.getLineAndCharacterOfPosition(defSourceFile, def.textSpan.start + def.textSpan.length);
    return { uri: 'file://' + def.fileName, range: { start, end } };
  }).filter(def => def !== null);
  console.log(JSON.stringify({ definitions: results }));
} else {
  console.log(JSON.stringify({ definitions: [] }));
}
`
        const writeCommand = `cat > '${scriptPath}' << 'EOF'\n${helperScript}\nEOF`
        await sandbox.runCommand('sh', ['-c', writeCommand])
        const result = await sandbox.runCommand('node', [scriptPath])

        let stdout = ''
        let stderr = ''
        try {
          stdout = await result.stdout()
        } catch {
          /* ignore */
        }
        try {
          stderr = await result.stderr()
        } catch {
          /* ignore */
        }

        await sandbox.runCommand('rm', [scriptPath])

        if (result.exitCode !== 0) {
          return c.json({ definitions: [], error: stderr || 'Script execution failed' })
        }

        try {
          return c.json(JSON.parse(stdout.trim()))
        } catch {
          return c.json({ definitions: [], error: 'Failed to parse TypeScript response' })
        }
      }

      case 'textDocument/hover':
        return c.json({ hover: null })

      case 'textDocument/completion':
        return c.json({ completions: [] })

      default:
        return c.json({ error: 'Unsupported LSP method' }, 400)
    }
  } catch (error) {
    console.error('LSP request error:', error)
    return c.json({ error: 'Failed to process LSP request' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/terminal
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/terminal', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const { command } = await c.req.json()

    if (!command || typeof command !== 'string') return c.json({ success: false, error: 'Command is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'No sandbox found for this task' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    try {
      const result = await sandbox.runCommand({ cmd: 'sh', args: ['-c', command], cwd: PROJECT_DIR })
      let stdout = ''
      let stderr = ''
      try {
        stdout = await result.stdout()
      } catch {
        /* ignore */
      }
      try {
        stderr = await result.stderr()
      } catch {
        /* ignore */
      }
      return c.json({ success: true, data: { exitCode: result.exitCode, stdout, stderr } })
    } catch (error) {
      console.error('Error executing command:', error)
      return c.json({ success: false, error: error instanceof Error ? error.message : 'Command execution failed' }, 500)
    }
  } catch (error) {
    console.error('Error in terminal endpoint:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/autocomplete
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/autocomplete', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const { partial, cwd } = await c.req.json()

    if (typeof partial !== 'string') return c.json({ success: false, error: 'Partial text is required' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'No sandbox found for this task' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    try {
      const pwdResult = await sandbox.runCommand('sh', ['-c', 'pwd'])
      let actualCwd = cwd || '/home/vercel-sandbox'
      try {
        const pwdOutput = await pwdResult.stdout()
        if (pwdOutput && pwdOutput.trim()) actualCwd = pwdOutput.trim()
      } catch {
        /* use default */
      }

      const parts = partial.split(/\s+/)
      const lastPart = parts[parts.length - 1] || ''
      let dir = actualCwd
      let prefix = ''

      if (lastPart.includes('/')) {
        const lastSlash = lastPart.lastIndexOf('/')
        const pathPart = lastPart.substring(0, lastSlash + 1)
        prefix = lastPart.substring(lastSlash + 1)
        if (pathPart.startsWith('/')) dir = pathPart
        else if (pathPart.startsWith('~/')) dir = '/home/vercel-sandbox/' + pathPart.substring(2)
        else dir = `${actualCwd}/${pathPart}`
      } else {
        prefix = lastPart
      }

      const escapedDir = "'" + dir.replace(/'/g, "'\\''") + "'"
      const lsCommand = `cd ${escapedDir} 2>/dev/null && ls -1ap 2>/dev/null || echo ""`
      const result = await sandbox.runCommand('sh', ['-c', lsCommand])

      let stdout = ''
      try {
        stdout = await result.stdout()
      } catch {
        /* ignore */
      }

      if (!stdout) return c.json({ success: true, data: { completions: [] } })

      const files = stdout
        .trim()
        .split('\n')
        .filter((f) => f && f.toLowerCase().startsWith(prefix.toLowerCase()))
        .map((f) => ({ name: f, isDirectory: f.endsWith('/') }))

      return c.json({ success: true, data: { completions: files, prefix } })
    } catch (error) {
      console.error('Error getting completions:', error)
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to get completions' },
        500,
      )
    }
  } catch (error) {
    console.error('Error in autocomplete endpoint:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/check-runs
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/check-runs', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.branchName || !task.repoUrl) return c.json({ success: false, error: 'Task does not have a branch' }, 400)

    const repoMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!repoMatch) return c.json({ success: false, error: 'Invalid repository URL' }, 400)

    const [, owner, repo] = repoMatch
    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ success: false, error: 'GitHub authentication required' }, 401)

    let branchData
    try {
      branchData = await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName })
    } catch (branchError) {
      if (
        branchError &&
        typeof branchError === 'object' &&
        'status' in branchError &&
        (branchError as { status: number }).status === 404
      ) {
        return c.json({ success: true, checkRuns: [] })
      }
      throw branchError
    }

    const commitSha = branchData.data.commit.sha
    const { data: checkRunsData } = await octokit.rest.checks.listForRef({ owner, repo, ref: commitSha })

    return c.json({
      success: true,
      checkRuns: checkRunsData.check_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        started_at: run.started_at,
        completed_at: run.completed_at,
      })),
    })
  } catch (error) {
    console.error('Error fetching check runs:', error)
    return c.json({ success: false, error: 'Failed to fetch check runs' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/deployment
// ---------------------------------------------------------------------------

function convertFeedbackUrlToDeploymentUrl(url: string): string {
  const feedbackMatch = url.match(/vercel\.live\/open-feedback\/(.+)/)
  if (feedbackMatch) return `https://${feedbackMatch[1]}`
  return url
}

tasksRouter.get('/:taskId/deployment', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const taskResult = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    const task = taskResult[0]
    if (!task) return c.json({ error: 'Task not found' }, 404)

    if (task.previewUrl) {
      const previewUrl = convertFeedbackUrlToDeploymentUrl(task.previewUrl)
      if (previewUrl !== task.previewUrl) {
        await db.update(tasks).set({ previewUrl }).where(eq(tasks.id, taskId))
      }
      return c.json({ success: true, data: { hasDeployment: true, previewUrl, cached: true } })
    }

    if (!task.branchName || !task.repoUrl) {
      return c.json({
        success: true,
        data: { hasDeployment: false, message: 'Task does not have branch or repository information' },
      })
    }

    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!githubMatch) {
      return c.json({ success: true, data: { hasDeployment: false, message: 'Invalid GitHub repository URL' } })
    }

    const [, owner, repo] = githubMatch

    try {
      const octokit = await getOctokit(session.user.id)
      if (!octokit.auth) {
        return c.json({ success: true, data: { hasDeployment: false, message: 'GitHub account not connected' } })
      }

      let latestCommitSha: string | null = null
      try {
        const { data: branch } = await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName })
        latestCommitSha = branch.commit.sha
      } catch (branchError) {
        if (
          branchError &&
          typeof branchError === 'object' &&
          'status' in branchError &&
          (branchError as { status: number }).status === 404
        ) {
          return c.json({ success: true, data: { hasDeployment: false, message: 'Branch not found' } })
        }
        throw branchError
      }

      if (latestCommitSha) {
        try {
          const { data: checkRuns } = await octokit.rest.checks.listForRef({
            owner,
            repo,
            ref: latestCommitSha,
            per_page: 100,
          })

          const extractPreviewUrl = (check: {
            output?: { summary?: string | null; text?: string | null } | null
          }): string | null => {
            if (check.output?.summary) {
              const urlMatch = check.output.summary.match(/https?:\/\/[^\s\)\]<]+\.vercel\.app/i)
              if (urlMatch) return urlMatch[0]
            }
            if (check.output?.text) {
              const urlMatch = check.output.text.match(/https?:\/\/[^\s\)\]<]+\.vercel\.app/i)
              if (urlMatch) return urlMatch[0]
            }
            return null
          }

          const vercelPreviewCheck = checkRuns.check_runs.find(
            (check) =>
              check.app?.slug === 'vercel' && check.name === 'Vercel Preview Comments' && check.status === 'completed',
          )
          const vercelDeploymentCheck = checkRuns.check_runs.find(
            (check) =>
              check.app?.slug === 'vercel' &&
              check.name === 'Vercel' &&
              check.conclusion === 'success' &&
              check.status === 'completed',
          )

          let previewUrl: string | null = null
          if (vercelPreviewCheck) previewUrl = extractPreviewUrl(vercelPreviewCheck)
          if (!previewUrl && vercelDeploymentCheck) previewUrl = extractPreviewUrl(vercelDeploymentCheck)
          if (!previewUrl && vercelDeploymentCheck?.details_url) {
            previewUrl = convertFeedbackUrlToDeploymentUrl(vercelDeploymentCheck.details_url)
          }

          if (previewUrl) {
            await db.update(tasks).set({ previewUrl }).where(eq(tasks.id, taskId))
            return c.json({
              success: true,
              data: {
                hasDeployment: true,
                previewUrl,
                checkId: vercelDeploymentCheck?.id || vercelPreviewCheck?.id,
                createdAt: vercelDeploymentCheck?.completed_at || vercelPreviewCheck?.completed_at,
              },
            })
          }
        } catch (checksError) {
          console.error('Error checking GitHub Checks:', checksError)
          // Continue to try other methods
        }
      }

      // Fallback: Check GitHub Deployments API
      try {
        const { data: deployments } = await octokit.rest.repos.listDeployments({
          owner,
          repo,
          ref: task.branchName,
          per_page: 10,
        })

        if (deployments && deployments.length > 0) {
          for (const deployment of deployments) {
            if (
              deployment.environment === 'Preview' ||
              deployment.environment === 'preview' ||
              deployment.description?.toLowerCase().includes('vercel')
            ) {
              const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
                owner,
                repo,
                deployment_id: deployment.id,
                per_page: 1,
              })
              if (statuses && statuses.length > 0) {
                const status = statuses[0]
                if (status.state === 'success') {
                  let previewUrl = status.environment_url || status.target_url
                  if (previewUrl) {
                    previewUrl = convertFeedbackUrlToDeploymentUrl(previewUrl)
                    await db.update(tasks).set({ previewUrl }).where(eq(tasks.id, taskId))
                    return c.json({
                      success: true,
                      data: {
                        hasDeployment: true,
                        previewUrl,
                        deploymentId: deployment.id,
                        createdAt: deployment.created_at,
                      },
                    })
                  }
                }
              }
            }
          }
        }
      } catch (deploymentsError) {
        console.error('Error checking GitHub Deployments:', deploymentsError)
      }

      // Final fallback: Check commit statuses
      if (latestCommitSha) {
        try {
          const { data: statuses } = await octokit.rest.repos.listCommitStatusesForRef({
            owner,
            repo,
            ref: latestCommitSha,
            per_page: 100,
          })
          const vercelStatus = statuses.find(
            (s) => s.context?.toLowerCase().includes('vercel') && s.state === 'success' && s.target_url,
          )
          if (vercelStatus && vercelStatus.target_url) {
            const previewUrl = convertFeedbackUrlToDeploymentUrl(vercelStatus.target_url)
            await db.update(tasks).set({ previewUrl }).where(eq(tasks.id, taskId))
            return c.json({
              success: true,
              data: { hasDeployment: true, previewUrl, createdAt: vercelStatus.created_at },
            })
          }
        } catch (statusError) {
          console.error('Error checking commit statuses:', statusError)
        }
      }

      return c.json({ success: true, data: { hasDeployment: false, message: 'No successful Vercel deployment found' } })
    } catch (error) {
      console.error('Error fetching deployment status:', error)
      if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
        return c.json({ success: true, data: { hasDeployment: false, message: 'Branch or repository not found' } })
      }
      return c.json({ success: true, data: { hasDeployment: false, message: 'Failed to fetch deployment status' } })
    }
  } catch (error) {
    console.error('Error in deployment API:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/deployments - List all deployments
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/deployments', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    // Verify task ownership
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const taskDeployments = await db
      .select()
      .from(deployments)
      .where(and(eq(deployments.taskId, taskId), isNull(deployments.deletedAt)))
      .orderBy(desc(deployments.createdAt))

    return c.json({
      deployments: taskDeployments.map((d) => ({
        ...d,
        metadata: d.metadata ? JSON.parse(d.metadata) : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching deployments:', error)
    return c.json({ error: 'Failed to fetch deployments' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/deployments - Create/update deployment
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/deployments', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()

    const { type = 'web', url, qrCodeUrl, pagePath, appId, label, metadata } = body

    // Verify task ownership
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    // Extract path from URL for web deployments (deduplication)
    let path: string | null = null
    if (type === 'web' && url) {
      try {
        const urlObj = new URL(url)
        path = urlObj.pathname
      } catch {
        // Invalid URL, continue without path
      }
    }

    const now = Date.now()
    const deploymentId = nanoid(12)

    if (type === 'miniprogram') {
      // Mini-program: Single deployment per task - update existing or create new
      const [existing] = await db
        .select()
        .from(deployments)
        .where(and(eq(deployments.taskId, taskId), eq(deployments.type, 'miniprogram'), isNull(deployments.deletedAt)))
        .limit(1)

      if (existing) {
        const [updated] = await db
          .update(deployments)
          .set({
            qrCodeUrl: qrCodeUrl || existing.qrCodeUrl,
            pagePath: pagePath || existing.pagePath,
            appId: appId || existing.appId,
            label: label || existing.label,
            metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
            updatedAt: now,
          })
          .where(eq(deployments.id, existing.id))
          .returning()

        return c.json({ deployment: { ...updated, metadata } })
      }
    } else if (type === 'web' && path) {
      // Web: Update existing deployment with same path
      const [existing] = await db
        .select()
        .from(deployments)
        .where(
          and(
            eq(deployments.taskId, taskId),
            eq(deployments.type, 'web'),
            eq(deployments.path, path),
            isNull(deployments.deletedAt),
          ),
        )
        .limit(1)

      if (existing) {
        const [updated] = await db
          .update(deployments)
          .set({
            url: url || existing.url,
            label: label || existing.label,
            metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
            updatedAt: now,
          })
          .where(eq(deployments.id, existing.id))
          .returning()

        return c.json({ deployment: { ...updated, metadata } })
      }
    }

    // Create new deployment
    const [newDeployment] = await db
      .insert(deployments)
      .values({
        id: deploymentId,
        taskId,
        type,
        url: url || null,
        path: path || null,
        qrCodeUrl: qrCodeUrl || null,
        pagePath: pagePath || null,
        appId: appId || null,
        label: label || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return c.json({ deployment: { ...newDeployment, metadata } })
  } catch (error) {
    console.error('Error creating deployment:', error)
    return c.json({ error: 'Failed to create deployment' }, 500)
  }
})

// ---------------------------------------------------------------------------
// DELETE /:taskId/deployments/:deploymentId - Delete deployment
// ---------------------------------------------------------------------------

tasksRouter.delete('/:taskId/deployments/:deploymentId', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId, deploymentId } = c.req.param()

    // Verify deployment exists and belongs to user's task
    const result = await db
      .select()
      .from(deployments)
      .innerJoin(tasks, eq(deployments.taskId, tasks.id))
      .where(
        and(
          eq(deployments.id, deploymentId),
          eq(deployments.taskId, taskId),
          eq(tasks.userId, session.user.id),
          isNull(deployments.deletedAt),
        ),
      )
      .limit(1)

    if (!result.length) {
      return c.json({ error: 'Deployment not found' }, 404)
    }

    await db.update(deployments).set({ deletedAt: Date.now() }).where(eq(deployments.id, deploymentId))

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting deployment:', error)
    return c.json({ error: 'Failed to delete deployment' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/sandbox-health
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/sandbox-health', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const task = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task || task.length === 0) return c.json({ status: 'not_found' })

    const taskData = task[0]
    if (!taskData.sandboxId || !taskData.sandboxUrl) {
      return c.json({ status: 'not_available', message: 'Sandbox not created yet' })
    }

    try {
      const sandbox = await Sandbox.get({
        teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
        projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
        token: process.env.SANDBOX_VERCEL_TOKEN!,
        sandboxId: taskData.sandboxId,
      })

      if (!sandbox) return c.json({ status: 'stopped', message: 'Sandbox has stopped or expired' })

      try {
        const response = await fetch(taskData.sandboxUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
        const contentLength = response.headers.get('content-length')
        const body = await response.text()

        if (response.status === 200 && (contentLength === '0' || body.length === 0)) {
          return c.json({ status: 'starting', message: 'Dev server is starting up' })
        }
        if (response.ok && body.length > 0) {
          return c.json({ status: 'running', message: 'Sandbox and dev server are running' })
        } else if (response.status === 410 || response.status === 502) {
          return c.json({ status: 'stopped', message: 'Sandbox has stopped or expired' })
        } else if (response.status >= 500) {
          return c.json({ status: 'error', message: 'Dev server returned an error', statusCode: response.status })
        } else if (response.status === 404 || response.status === 503) {
          return c.json({ status: 'starting', message: 'Dev server is starting up' })
        } else {
          return c.json({ status: 'starting', message: 'Dev server is initializing' })
        }
      } catch (fetchError) {
        if (fetchError instanceof Error) {
          if (fetchError.name === 'TimeoutError' || fetchError.message.includes('timeout')) {
            return c.json({ status: 'starting', message: 'Dev server is starting or not responding' })
          }
          return c.json({ status: 'stopped', message: 'Cannot connect to sandbox' })
        }
        return c.json({ status: 'starting', message: 'Checking dev server status...' })
      }
    } catch (sandboxError) {
      console.error('Sandbox.get() error:', sandboxError)
      return c.json({ status: 'stopped', message: 'Sandbox no longer exists' })
    }
  } catch (error) {
    console.error('Error checking sandbox health:', error)
    return c.json({ status: 'error', message: 'Failed to check sandbox health' })
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/start-sandbox
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/start-sandbox', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (task.userId !== session.user.id) return c.json({ error: 'Unauthorized' }, 403)
    if (!task.keepAlive) return c.json({ error: 'Keep-alive is not enabled for this task' }, 400)

    const logger = createTaskLogger(taskId)

    if (task.sandboxId && task.sandboxUrl) {
      try {
        const existingSandbox = await Sandbox.get({
          sandboxId: task.sandboxId,
          teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
          projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
          token: process.env.SANDBOX_VERCEL_TOKEN!,
        })
        const testResult = await runCommandInSandbox(existingSandbox, 'echo', ['test'])
        if (testResult.success) return c.json({ error: 'Sandbox is already running' }, 400)
      } catch {
        await logger.info('Existing sandbox not accessible, clearing and creating new one')
        unregisterSandbox(taskId)
        await db
          .update(tasks)
          .set({ sandboxId: null, sandboxUrl: null, updatedAt: Date.now() })
          .where(eq(tasks.id, taskId))
      }
    }

    await logger.info('Starting sandbox')

    // Get GitHub user info
    const githubToken = await getUserGitHubToken(session.user.id)
    let gitName = 'Coding Agent'
    let gitEmail = 'agent@example.com'
    if (githubToken) {
      try {
        const octokit = new Octokit({ auth: githubToken })
        const { data } = await octokit.rest.users.getAuthenticated()
        gitName = data.name || data.login || gitName
        gitEmail = `${data.login}@users.noreply.github.com`
      } catch {
        /* use defaults */
      }
    }

    const maxDurationMinutes = task.maxDuration || MAX_SANDBOX_DURATION

    // Detect port
    let port = 3000
    if (task.repoUrl && githubToken) {
      const urlMatch = task.repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
      if (urlMatch) {
        try {
          const octokit = new Octokit({ auth: githubToken })
          const { data } = await octokit.repos.getContent({
            owner: urlMatch[1],
            repo: urlMatch[2],
            path: 'package.json',
          })
          if ('content' in data && data.type === 'file') {
            const pkgJson = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
            if (pkgJson.dependencies?.vite || pkgJson.devDependencies?.vite) port = 5173
          }
        } catch {
          /* use default */
        }
      }
    }

    const sandbox = await Sandbox.create({
      teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
      projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
      token: process.env.SANDBOX_VERCEL_TOKEN!,
      source:
        task.repoUrl && task.branchName
          ? { type: 'git' as const, url: task.repoUrl, revision: task.branchName, depth: 1 }
          : undefined,
      timeout: maxDurationMinutes * 60 * 1000,
      ports: [port],
      runtime: 'node22',
      resources: { vcpus: 4 },
    })

    const sandboxId = sandbox?.sandboxId
    await logger.info('Sandbox created')
    registerSandbox(taskId, sandbox)

    await logger.info('Configuring Git')
    await runInProject(sandbox, 'git', ['config', 'user.name', gitName])
    await runInProject(sandbox, 'git', ['config', 'user.email', gitEmail])

    const packageJsonCheck = await runInProject(sandbox, 'test', ['-f', 'package.json'])
    const requirementsTxtCheck = await runInProject(sandbox, 'test', ['-f', 'requirements.txt'])

    if (packageJsonCheck.success) {
      await logger.info('Installing Node.js dependencies')
      const packageManager = await detectPackageManager(sandbox)
      const installCmd =
        packageManager === 'pnpm'
          ? ['pnpm', 'install', '--frozen-lockfile']
          : packageManager === 'yarn'
            ? ['yarn', 'install', '--frozen-lockfile']
            : ['npm', 'install', '--no-audit', '--no-fund']
      await logger.info('Installing dependencies')
      const installResult = await runInProject(sandbox, installCmd[0], installCmd.slice(1))
      if (!installResult.success && packageManager !== 'npm') {
        await runInProject(sandbox, 'npm', ['install', '--no-audit', '--no-fund'])
      }
    } else if (requirementsTxtCheck.success) {
      await logger.info('Installing Python dependencies')
      await runInProject(sandbox, 'python3', ['-m', 'pip', 'install', '-r', 'requirements.txt'])
    }

    let sandboxUrl: string | undefined

    if (packageJsonCheck.success) {
      const packageJsonRead = await runInProject(sandbox, 'cat', ['package.json'])
      if (packageJsonRead.success && packageJsonRead.output) {
        const packageJson = JSON.parse(packageJsonRead.output)
        const hasDevScript = packageJson?.scripts?.dev

        if (hasDevScript) {
          await logger.info('Starting development server')
          const packageManager = await detectPackageManager(sandbox)
          const devCommand = packageManager === 'npm' ? 'npm' : packageManager
          let devArgs = packageManager === 'npm' ? ['run', 'dev'] : ['dev']

          const hasVite = packageJson?.dependencies?.vite || packageJson?.devDependencies?.vite
          let devPort = 3000
          if (hasVite) {
            devPort = 5173
            await logger.info('Vite project detected, using port 5173')
            await runInProject(sandbox, 'sh', [
              '-c',
              `cat > vite.sandbox.config.js << 'VITEEOF'\n${SANDBOX_VITE_CONFIG}\nVITEEOF`,
            ])
            if (packageManager === 'npm')
              devArgs = ['run', 'dev', '--', '--config', 'vite.sandbox.config.js', '--host', '0.0.0.0']
            else devArgs = ['dev', '--config', 'vite.sandbox.config.js', '--host', '0.0.0.0']
          }

          const nextVersion = packageJson?.dependencies?.next || packageJson?.devDependencies?.next || ''
          const isNext16 =
            nextVersion.startsWith('16.') || nextVersion.startsWith('^16.') || nextVersion.startsWith('~16.')
          if (isNext16) {
            await logger.info('Next.js 16 detected, adding --webpack flag')
            devArgs = packageManager === 'npm' ? ['run', 'dev', '--', '--webpack'] : ['dev', '--webpack']
          }

          const fullDevCommand = devArgs.length > 0 ? `${devCommand} ${devArgs.join(' ')}` : devCommand
          const { Writable } = await import('stream')

          const captureStdout = new Writable({
            write(chunk: Buffer | string, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
              const lines = chunk
                .toString()
                .split('\n')
                .filter((l: string) => l.trim())
              for (const line of lines) logger.info(`[SERVER] ${line}`).catch(() => {})
              cb()
            },
          })
          const captureStderr = new Writable({
            write(chunk: Buffer | string, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
              const lines = chunk
                .toString()
                .split('\n')
                .filter((l: string) => l.trim())
              for (const line of lines) logger.info(`[SERVER] ${line}`).catch(() => {})
              cb()
            },
          })

          await sandbox.runCommand({
            cmd: 'sh',
            args: ['-c', `cd ${PROJECT_DIR} && ${fullDevCommand}`],
            detached: true,
            stdout: captureStdout,
            stderr: captureStderr,
          })
          await logger.info('Development server started')
          await new Promise((resolve) => setTimeout(resolve, 3000))
          sandboxUrl = sandbox.domain(devPort)
        }
      }
    }

    await db
      .update(tasks)
      .set({ sandboxId, sandboxUrl: sandboxUrl || undefined, updatedAt: Date.now() })
      .where(eq(tasks.id, taskId))
    await logger.info('Sandbox started successfully')

    return c.json({ success: true, message: 'Sandbox started successfully', sandboxId, sandboxUrl })
  } catch (error) {
    console.error('Error starting sandbox:', error)
    return c.json(
      { error: 'Failed to start sandbox', details: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/stop-sandbox
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/stop-sandbox', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (task.userId !== session.user.id) return c.json({ error: 'Unauthorized' }, 403)
    if (!task.sandboxId) return c.json({ error: 'Sandbox is not active' }, 400)

    const sandbox = await Sandbox.get({
      sandboxId: task.sandboxId,
      teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
      projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
      token: process.env.SANDBOX_VERCEL_TOKEN!,
    })

    await sandbox.stop()
    unregisterSandbox(taskId)
    await db.update(tasks).set({ sandboxId: null, sandboxUrl: null, updatedAt: Date.now() }).where(eq(tasks.id, taskId))

    return c.json({ success: true, message: 'Sandbox stopped successfully' })
  } catch (error) {
    console.error('Error stopping sandbox:', error)
    return c.json(
      { error: 'Failed to stop sandbox', details: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/restart-dev
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/restart-dev', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    if (!task) return c.json({ error: 'Task not found' }, 404)
    if (task.userId !== session.user.id) return c.json({ error: 'Unauthorized' }, 403)
    if (!task.sandboxId) return c.json({ error: 'Sandbox is not active' }, 400)

    const sandbox = await Sandbox.get({
      sandboxId: task.sandboxId,
      teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
      projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
      token: process.env.SANDBOX_VERCEL_TOKEN!,
    })

    const logger = createTaskLogger(taskId)

    const packageJsonCheck = await runInProject(sandbox, 'test', ['-f', 'package.json'])
    if (!packageJsonCheck.success) return c.json({ error: 'No package.json found in sandbox' }, 400)

    const packageJsonRead = await runCommandInSandbox(sandbox, 'sh', ['-c', `cd ${PROJECT_DIR} && cat package.json`])
    if (!packageJsonRead.success || !packageJsonRead.output)
      return c.json({ error: 'Could not read package.json' }, 500)

    const packageJson = JSON.parse(packageJsonRead.output)
    if (!packageJson?.scripts?.dev) return c.json({ error: 'No dev script found in package.json' }, 400)

    const hasVite = packageJson?.dependencies?.vite || packageJson?.devDependencies?.vite
    const devPort = hasVite ? 5173 : 3000

    await runCommandInSandbox(sandbox, 'sh', ['-c', `lsof -ti:${devPort} | xargs -r kill -9 2>/dev/null || true`])
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const packageManager = await detectPackageManager(sandbox)
    const devCommand = packageManager === 'npm' ? 'npm' : packageManager
    let devArgs = packageManager === 'npm' ? ['run', 'dev'] : ['dev']

    if (hasVite) {
      await runInProject(sandbox, 'sh', [
        '-c',
        `cat > vite.sandbox.config.js << 'VITEEOF'\n${SANDBOX_VITE_CONFIG}\nVITEEOF`,
      ])
      devArgs =
        packageManager === 'npm'
          ? ['run', 'dev', '--', '--config', 'vite.sandbox.config.js', '--host', '0.0.0.0']
          : ['dev', '--config', 'vite.sandbox.config.js', '--host', '0.0.0.0']
    }

    const nextVersion = packageJson?.dependencies?.next || packageJson?.devDependencies?.next || ''
    const isNext16 = nextVersion.startsWith('16.') || nextVersion.startsWith('^16.') || nextVersion.startsWith('~16.')
    if (isNext16) {
      devArgs = packageManager === 'npm' ? ['run', 'dev', '--', '--webpack'] : ['dev', '--webpack']
    }

    const fullDevCommand = devArgs.length > 0 ? `${devCommand} ${devArgs.join(' ')}` : devCommand
    const { Writable } = await import('stream')

    const captureStdout = new Writable({
      write(chunk: Buffer | string, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
        chunk
          .toString()
          .split('\n')
          .filter((l: string) => l.trim())
          .forEach((line: string) => logger.info(`[SERVER] ${line}`).catch(() => {}))
        cb()
      },
    })
    const captureStderr = new Writable({
      write(chunk: Buffer | string, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
        chunk
          .toString()
          .split('\n')
          .filter((l: string) => l.trim())
          .forEach((line: string) => logger.info(`[SERVER] ${line}`).catch(() => {}))
        cb()
      },
    })

    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `cd ${PROJECT_DIR} && ${fullDevCommand}`],
      detached: true,
      stdout: captureStdout,
      stderr: captureStderr,
    })

    return c.json({ success: true, message: 'Dev server restarted successfully' })
  } catch (error) {
    console.error('Error restarting dev server:', error)
    return c.json(
      { error: 'Failed to restart dev server', details: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/clear-logs
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/clear-logs', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)

    await db.update(tasks).set({ logs: '[]' }).where(eq(tasks.id, taskId))

    return c.json({ success: true, message: 'Logs cleared successfully' })
  } catch (error) {
    console.error('Error clearing logs:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to clear logs' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /:taskId/pr-comments
// ---------------------------------------------------------------------------

tasksRouter.get('/:taskId/pr-comments', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.prNumber || !task.repoUrl) return c.json({ success: false, error: 'Task does not have a PR' }, 400)

    const repoMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!repoMatch) return c.json({ success: false, error: 'Invalid repository URL' }, 400)

    const [, owner, repo] = repoMatch
    const octokit = await getOctokit(session.user.id)
    if (!octokit.auth) return c.json({ success: false, error: 'GitHub authentication required' }, 401)

    const [issueCommentsResponse, reviewCommentsResponse] = await Promise.all([
      octokit.rest.issues.listComments({ owner, repo, issue_number: task.prNumber }),
      octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: task.prNumber }),
    ])

    const allComments = [
      ...issueCommentsResponse.data.map((comment) => ({
        id: comment.id,
        user: { login: comment.user?.login || 'unknown', avatar_url: comment.user?.avatar_url || '' },
        body: comment.body || '',
        created_at: comment.created_at,
        html_url: comment.html_url,
      })),
      ...reviewCommentsResponse.data.map((comment) => ({
        id: comment.id,
        user: { login: comment.user?.login || 'unknown', avatar_url: comment.user?.avatar_url || '' },
        body: comment.body || '',
        created_at: comment.created_at,
        html_url: comment.html_url,
      })),
    ]

    allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return c.json({ success: true, comments: allComments })
  } catch (error) {
    console.error('Error fetching PR comments:', error)
    return c.json({ success: false, error: 'Failed to fetch PR comments' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /:taskId/file-operation
// ---------------------------------------------------------------------------

tasksRouter.post('/:taskId/file-operation', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr

    const session = c.get('session')!
    const { taskId } = c.req.param()
    const body = await c.req.json()
    const { operation, sourceFile, targetPath } = body

    if (!operation || !sourceFile) return c.json({ success: false, error: 'Missing required parameters' }, 400)

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) return c.json({ success: false, error: 'Task not found' }, 404)
    if (!task.sandboxId) return c.json({ success: false, error: 'Sandbox not available' }, 400)

    const sandbox = await getOrReconnectSandbox(taskId, task)
    if (!sandbox) return c.json({ success: false, error: 'Sandbox not found' }, 404)

    const sourceBasename = sourceFile.split('/').pop()
    const targetFile = targetPath ? `${targetPath}/${sourceBasename}` : sourceBasename

    if (operation === 'copy') {
      const copyResult = await sandbox.runCommand({ cmd: 'cp', args: ['-r', sourceFile, targetFile], cwd: PROJECT_DIR })
      if (copyResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to copy file' }, 500)
      return c.json({ success: true, message: 'File copied successfully' })
    } else if (operation === 'cut') {
      const mvResult = await sandbox.runCommand({ cmd: 'mv', args: [sourceFile, targetFile], cwd: PROJECT_DIR })
      if (mvResult.exitCode !== 0) return c.json({ success: false, error: 'Failed to move file' }, 500)
      return c.json({ success: true, message: 'File moved successfully' })
    } else {
      return c.json({ success: false, error: 'Invalid operation' }, 400)
    }
  } catch (error) {
    console.error('Error performing file operation:', error)
    return c.json({ success: false, error: 'Failed to perform file operation' }, 500)
  }
})

export default tasksRouter
