#!/usr/bin/env npx tsx
/**
 * Purge Deleted Tasks Script
 *
 * Cleans up orphaned data for soft-deleted tasks:
 *   - vibe_agent_messages records in CloudBase (conversation history)
 *
 * Git archive directories are deleted synchronously at task deletion time,
 * so this script only handles CloudBase message records.
 *
 * Usage:
 *   npx tsx scripts/purge-deleted-tasks.ts [--dry-run]
 *
 * Environment variables required (same as server):
 *   TCB_ENV_ID      - CloudBase support environment ID
 *   TCB_SECRET_ID   - CloudBase secret ID
 *   TCB_SECRET_KEY  - CloudBase secret key
 *   DATABASE_PATH   - Path to SQLite DB (optional, defaults to ./data/app.db)
 */

import { isNotNull, eq } from 'drizzle-orm'
import CloudBase from '@cloudbase/node-sdk'
import { drizzleDb } from '../packages/server/src/db/drizzle/client.js'
import { tasks, userResources } from '../packages/server/src/db/schema.js'
import { AGENT_ID } from '../packages/shared/src/index.js'

const DRY_RUN = process.argv.includes('--dry-run')
const COLLECTION_NAME = 'vibe_agent_messages'
const BATCH_SIZE = 10

async function getCloudBaseApp() {
  const envId = process.env.TCB_ENV_ID
  const secretId = process.env.TCB_SECRET_ID
  const secretKey = process.env.TCB_SECRET_KEY
  const region = process.env.TCB_REGION || 'ap-shanghai'

  if (!envId || !secretId || !secretKey) {
    throw new Error('Missing required env vars: TCB_ENV_ID, TCB_SECRET_ID, TCB_SECRET_KEY')
  }

  return CloudBase.init({ env: envId, region, secretId, secretKey })
}

async function deleteMessages(
  app: ReturnType<typeof CloudBase.init>,
  conversationId: string,
  envId: string,
  userId: string,
): Promise<number> {
  const db = app.database()
  const _ = db.command
  const collection = db.collection(COLLECTION_NAME)

  const { data } = await collection
    .where({
      conversationId: _.eq(conversationId),
      envId: _.eq(envId),
      userId: _.eq(userId),
      agentId: _.eq(AGENT_ID),
    })
    .count()

  const count = (data as any)?.total ?? 0
  if (count === 0) return 0

  if (!DRY_RUN) {
    await collection
      .where({
        conversationId: _.eq(conversationId),
        envId: _.eq(envId),
        userId: _.eq(userId),
        agentId: _.eq(AGENT_ID),
      })
      .remove()
  }

  return count
}

async function main() {
  console.log(`[purge] mode=${DRY_RUN ? 'dry-run' : 'live'}`)

  // Find all soft-deleted tasks joined with user_resources for envId
  const rows = await drizzleDb
    .select({
      taskId: tasks.id,
      userId: tasks.userId,
      envId: userResources.envId,
    })
    .from(tasks)
    .innerJoin(userResources, eq(userResources.userId, tasks.userId))
    .where(isNotNull(tasks.deletedAt))

  const eligible = rows.filter((r) => r.envId != null) as Array<{
    taskId: string
    userId: string
    envId: string
  }>

  console.log(`[purge] Found ${eligible.length} deleted tasks with envId`)

  if (eligible.length === 0) {
    console.log('[purge] Nothing to purge.')
    return
  }

  const app = await getCloudBaseApp()
  let totalDeleted = 0
  let errors = 0

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async ({ taskId, userId, envId }) => {
        try {
          const count = await deleteMessages(app, taskId, envId, userId)
          if (count > 0) {
            console.log(`[purge] ${DRY_RUN ? '[dry]' : 'deleted'} ${count} messages for task=${taskId} env=${envId}`)
            totalDeleted += count
          }
        } catch (err) {
          console.error(`[purge] Failed for task=${taskId}:`, (err as Error).message)
          errors++
        }
      }),
    )
  }

  console.log(`[purge] Done. messages=${DRY_RUN ? 'would delete' : 'deleted'} ${totalDeleted}, errors=${errors}`)
}

main().catch((err) => {
  console.error('[purge] Fatal:', err)
  process.exit(1)
})
