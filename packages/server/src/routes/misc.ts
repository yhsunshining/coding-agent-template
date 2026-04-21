import { Hono } from 'hono'
import { getDb } from '../db/index.js'
import { requireAuth, type AppEnv } from '../middleware/auth'

const GITHUB_REPO = 'TencentCloudBase/openVibeCoding'
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

let cachedStars: number | null = null
let lastFetch = 0

const app = new Hono<AppEnv>()

// GET /api/github-stars - Fetch GitHub star count (cached)
app.get('/github-stars', async (c) => {
  try {
    const now = Date.now()

    if (cachedStars !== null && now - lastFetch < CACHE_DURATION_MS) {
      return c.json({ stars: cachedStars })
    }

    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'coding-agent-template',
      },
    })

    if (!response.ok) {
      throw new Error('GitHub API request failed')
    }

    const data = await response.json()
    cachedStars = data.stargazers_count
    lastFetch = now

    return c.json({ stars: cachedStars })
  } catch (error) {
    console.error('Error fetching GitHub stars:', error)
    return c.json({ stars: cachedStars || 1200 })
  }
})

// GET /api/sandboxes - List active sandboxes for the current user
app.get('/sandboxes', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr
    const session = c.get('session')!
    const userId = session.user.id

    // Filter tasks with active sandboxes using repository interface
    const allTasks = await getDb().tasks.findByUserId(userId)
    const runningSandboxes = allTasks
      .filter((t) => t.sandboxId && !t.deletedAt)
      .map((t) => ({
        id: t.id,
        taskId: t.id,
        prompt: t.prompt,
        repoUrl: t.repoUrl,
        branchName: t.branchName,
        sandboxId: t.sandboxId,
        sandboxUrl: t.sandboxUrl,
        createdAt: t.createdAt,
        status: t.status,
        keepAlive: t.keepAlive,
        maxDuration: t.maxDuration,
      }))

    return c.json({ sandboxes: runningSandboxes })
  } catch (error) {
    console.error('Error fetching sandboxes:', error)
    return c.json({ error: 'Failed to fetch sandboxes' }, 500)
  }
})

export default app
