import { Hono } from 'hono'
import { Octokit } from '@octokit/rest'
import { getDb } from '../db/index.js'
import { decrypt } from '../lib/crypto'
import { requireAuth, type AppEnv } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Helper: get GitHub token for the current session user
async function getGitHubToken(userId: string): Promise<string | null> {
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(userId, 'github')

    if (account?.accessToken) {
      return decrypt(account.accessToken)
    }

    const user = await getDb().users.findById(userId)

    if (user?.provider === 'github' && user.accessToken) {
      return decrypt(user.accessToken)
    }

    return null
  } catch {
    return null
  }
}

// GET /api/repos/:owner/:repo/commits
app.get('/:owner/:repo/commits', async (c) => {
  try {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')

    const session = c.get('session')
    const token = session?.user?.id ? await getGitHubToken(session.user.id) : null

    if (!token) {
      return c.json({ error: 'GitHub authentication required' }, 401)
    }

    const octokit = new Octokit({ auth: token })
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 30,
    })

    return c.json({ commits })
  } catch (error) {
    console.error('Error fetching commits:', error)
    return c.json({ error: 'Failed to fetch commits' }, 500)
  }
})

// GET /api/repos/:owner/:repo/issues
app.get('/:owner/:repo/issues', async (c) => {
  try {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')

    const session = c.get('session')
    const token = session?.user?.id ? await getGitHubToken(session.user.id) : null

    if (!token) {
      return c.json({ error: 'GitHub authentication required' }, 401)
    }

    const octokit = new Octokit({ auth: token })
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 30,
    })

    const filteredIssues = issues.filter((issue) => !issue.pull_request)

    return c.json({ issues: filteredIssues })
  } catch (error) {
    console.error('Error fetching issues:', error)
    return c.json({ error: 'Failed to fetch issues' }, 500)
  }
})

// GET /api/repos/:owner/:repo/pull-requests
app.get('/:owner/:repo/pull-requests', async (c) => {
  try {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')

    const session = c.get('session')
    const token = session?.user?.id ? await getGitHubToken(session.user.id) : null

    if (!token) {
      return c.json({ error: 'GitHub authentication required' }, 401)
    }

    const octokit = new Octokit({ auth: token })
    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 30,
      sort: 'updated',
      direction: 'desc',
    })

    return c.json({ pullRequests })
  } catch (error) {
    console.error('Error fetching pull requests:', error)
    return c.json({ error: 'Failed to fetch pull requests' }, 500)
  }
})

// GET /api/repos/:owner/:repo/pull-requests/:pr_number/check-task
app.get('/:owner/:repo/pull-requests/:pr_number/check-task', async (c) => {
  try {
    const authErr = requireAuth(c)
    if (authErr) return authErr
    const session = c.get('session')!
    const userId = session.user.id

    const owner = c.req.param('owner')
    const repo = c.req.param('repo')
    const prNumberStr = c.req.param('pr_number')
    const prNumber = parseInt(prNumberStr, 10)

    if (isNaN(prNumber)) {
      return c.json({ error: 'Invalid PR number' }, 400)
    }

    const repoUrl = `https://github.com/${owner}/${repo}`

    // This compound query (userId + prNumber + repoUrl + isNull(deletedAt)) doesn't map to a repository method
    const existingTasks = await getDb().tasks.findByRepoAndPr(userId, prNumber, repoUrl)

    return c.json({
      hasTask: existingTasks.length > 0,
      taskId: existingTasks.length > 0 ? existingTasks[0].id : null,
    })
  } catch (error) {
    console.error('Error checking for existing task:', error)
    return c.json({ error: 'Failed to check for existing task' }, 500)
  }
})

// PATCH /api/repos/:owner/:repo/pull-requests/:pr_number/close
app.patch('/:owner/:repo/pull-requests/:pr_number/close', async (c) => {
  try {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')
    const prNumberStr = c.req.param('pr_number')
    const prNumber = parseInt(prNumberStr, 10)

    if (isNaN(prNumber)) {
      return c.json({ error: 'Invalid pull request number' }, 400)
    }

    const session = c.get('session')
    const token = session?.user?.id ? await getGitHubToken(session.user.id) : null

    if (!token) {
      return c.json({ error: 'GitHub authentication required' }, 401)
    }

    const octokit = new Octokit({ auth: token })
    const { data: pullRequest } = await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      state: 'closed',
    })

    return c.json({ pullRequest })
  } catch (error) {
    console.error('Error closing pull request:', error)
    return c.json({ error: 'Failed to close pull request' }, 500)
  }
})

export default app
