import cron from 'node-cron'
import { nanoid } from 'nanoid'
import { hostname } from 'os'
import { getDb } from '../db/index.js'
import type { CronTask } from '../db/types.js'

// Map of cronTaskId -> ScheduledTask
const scheduledJobs = new Map<string, cron.ScheduledTask>()

// Unique pod identifier for distributed locking
const POD_ID = `${hostname()}-${process.pid}`

// Lock expires after 5 minutes (safety net if pod crashes mid-execution)
const LOCK_TTL_MS = 5 * 60 * 1000

/**
 * Called on server startup: load all enabled cron tasks and schedule them.
 */
export async function initCronScheduler(): Promise<void> {
  const enabledTasks = await getDb().cronTasks.findAllEnabled()
  console.log('Cron scheduler initializing, loading enabled tasks')

  for (const task of enabledTasks) {
    scheduleTask(task)
  }
}

/**
 * Schedule (or re-schedule) a single cron task.
 */
export function scheduleTask(cronTask: CronTask): void {
  unscheduleTask(cronTask.id)

  if (!cronTask.enabled) return

  if (!cron.validate(cronTask.cronExpression)) {
    console.error('Invalid cron expression for cron task')
    return
  }

  const job = cron.schedule(cronTask.cronExpression, () => {
    executeCronTask(cronTask.id, cronTask.userId).catch((err) => {
      console.error('Cron task execution failed:', err)
    })
  })

  scheduledJobs.set(cronTask.id, job)
}

/**
 * Remove a scheduled job.
 */
export function unscheduleTask(cronTaskId: string): void {
  const existing = scheduledJobs.get(cronTaskId)
  if (existing) {
    existing.stop()
    scheduledJobs.delete(cronTaskId)
  }
}

/**
 * Execute a cron task with distributed locking.
 * Only the pod that acquires the lock will create the task.
 */
async function executeCronTask(cronTaskId: string, userId: string): Promise<void> {
  // Re-read from DB to get latest state
  const task = await getDb().cronTasks.findByIdAndUserId(cronTaskId, userId)
  if (!task || !task.enabled) {
    unscheduleTask(cronTaskId)
    return
  }

  // Try to acquire distributed lock (atomic CAS)
  const locked = await getDb().cronTasks.tryLock(cronTaskId, POD_ID, LOCK_TTL_MS)
  if (!locked) {
    // Another pod already acquired the lock, skip
    return
  }

  try {
    const ts = Date.now()
    const taskId = nanoid(12)

    // Create a new agent task record
    await getDb().tasks.create({
      id: taskId,
      userId: task.userId,
      prompt: task.prompt,
      title: null,
      repoUrl: task.repoUrl || null,
      selectedAgent: task.selectedAgent || 'codebuddy',
      selectedModel: task.selectedModel || null,
      installDependencies: false,
      maxDuration: 300,
      keepAlive: false,
      enableBrowser: false,
      status: 'pending',
      progress: 0,
      logs: '[]',
      error: null,
      branchName: null,
      sandboxId: null,
      agentSessionId: null,
      sandboxUrl: null,
      previewUrl: null,
      prUrl: null,
      prNumber: null,
      prStatus: null,
      prMergeCommitSha: null,
      mcpServerIds: null,
      createdAt: ts,
      updatedAt: ts,
    })

    // Update lastRunAt
    await getDb().cronTasks.update(task.id, task.userId, {
      lastRunAt: ts,
    })

    console.log('Cron task created new task')
  } finally {
    // Always release the lock
    await getDb()
      .cronTasks.releaseLock(cronTaskId, POD_ID)
      .catch(() => {})
  }
}

/**
 * Graceful shutdown: stop all scheduled jobs.
 */
export function stopAllCronJobs(): void {
  for (const [, job] of scheduledJobs) {
    job.stop()
  }
  scheduledJobs.clear()
}
