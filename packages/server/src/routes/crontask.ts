import { Hono } from 'hono'
import { getDb } from '../db/index.js'
import { nanoid } from 'nanoid'
import cron from 'node-cron'
import { requireAuth, type AppEnv } from '../middleware/auth'
import { scheduleTask, unscheduleTask } from '../services/cron-scheduler.js'

const app = new Hono<AppEnv>()

// GET / - List all cron tasks for user
app.get('/', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!
  const userId = session.user.id

  const tasks = await getDb().cronTasks.findByUserId(userId)
  return c.json({ success: true, data: tasks })
})

// POST / - Create a new cron task
app.post('/', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!
  const userId = session.user.id
  const body = await c.req.json()

  const { name, prompt, cronExpression, enabled = true, repoUrl, selectedAgent, selectedModel } = body
  if (!name || !prompt || !cronExpression) {
    return c.json({ error: 'name, prompt, and cronExpression are required' }, 400)
  }

  if (!cron.validate(cronExpression)) {
    return c.json({ error: 'Invalid cron expression' }, 400)
  }

  const newTask = await getDb().cronTasks.create({
    id: nanoid(),
    userId,
    name,
    prompt,
    cronExpression,
    enabled,
    repoUrl: repoUrl || null,
    selectedAgent: selectedAgent || 'codebuddy',
    selectedModel: selectedModel || null,
    lastRunAt: null,
    nextRunAt: null,
  })

  if (newTask.enabled) {
    scheduleTask(newTask)
  }

  return c.json({ success: true, data: newTask }, 201)
})

// PATCH /:id - Update a cron task
app.patch('/:id', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!
  const userId = session.user.id
  const { id } = c.req.param()
  const body = await c.req.json()

  const existing = await getDb().cronTasks.findByIdAndUserId(id, userId)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (body.cronExpression !== undefined && !cron.validate(body.cronExpression)) {
    return c.json({ error: 'Invalid cron expression' }, 400)
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.prompt !== undefined) update.prompt = body.prompt
  if (body.cronExpression !== undefined) update.cronExpression = body.cronExpression
  if (body.enabled !== undefined) update.enabled = body.enabled
  if (body.repoUrl !== undefined) update.repoUrl = body.repoUrl
  if (body.selectedAgent !== undefined) update.selectedAgent = body.selectedAgent
  if (body.selectedModel !== undefined) update.selectedModel = body.selectedModel

  const updated = await getDb().cronTasks.update(id, userId, update)

  if (updated) {
    if (updated.enabled) {
      scheduleTask(updated)
    } else {
      unscheduleTask(updated.id)
    }
  }

  return c.json({ success: true, data: updated })
})

// DELETE /:id - Delete a cron task
app.delete('/:id', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!
  const userId = session.user.id
  const { id } = c.req.param()

  const existing = await getDb().cronTasks.findByIdAndUserId(id, userId)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  unscheduleTask(id)

  await getDb().cronTasks.delete(id, userId)
  return c.json({ success: true, message: 'Deleted' })
})

export default app
