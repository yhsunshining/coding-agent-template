import CloudBase from '@cloudbase/node-sdk'

const COLLECTION_PREFIX = process.env.DB_COLLECTION_PREFIX || 'vibe_agent_'

const COLLECTION_NAMES = [
  'users',
  'local_credentials',
  'tasks',
  'connectors',
  'accounts',
  'keys',
  'user_resources',
  'settings',
  'deployments',
] as const

let app: ReturnType<typeof CloudBase.init> | null = null

function getApp(): ReturnType<typeof CloudBase.init> {
  if (app) return app

  const envId = process.env.TCB_ENV_ID
  const region = process.env.TCB_REGION || 'ap-shanghai'
  const secretId = process.env.TCB_SECRET_ID
  const secretKey = process.env.TCB_SECRET_KEY
  const token = process.env.TCB_TOKEN || undefined

  if (!envId || !secretId || !secretKey) {
    throw new Error('CloudBase credentials not configured: TCB_ENV_ID, TCB_SECRET_ID, TCB_SECRET_KEY are required')
  }

  app = CloudBase.init({
    env: envId,
    region,
    secretId,
    secretKey,
    ...(token ? { sessionToken: token } : {}),
  })

  return app
}

export function getDatabase() {
  return getApp().database()
}

export function getCommand() {
  return getApp().database().command
}

const ensuredCollections = new Set<string>()

export function getCollectionName(name: string): string {
  return `${COLLECTION_PREFIX}${name}`
}

export async function getCollection(name: (typeof COLLECTION_NAMES)[number]) {
  const db = getDatabase()
  const fullName = getCollectionName(name)

  if (!ensuredCollections.has(fullName)) {
    try {
      await db.createCollection(fullName)
    } catch {
      // Collection already exists, ignore error
    }
    ensuredCollections.add(fullName)
  }

  return db.collection(fullName)
}
