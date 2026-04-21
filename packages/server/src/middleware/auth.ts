import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { decryptJWE } from '../lib/session'
import { getDb } from '../db/index.js'
import { encrypt } from '../lib/crypto.js'
import CloudBaseManager from '@cloudbase/manager-node'
import { buildUserEnvPolicyStatements } from '../cloudbase/provision.js'

export interface SessionUser {
  id: string
  username: string
  email: string | undefined
  avatar: string
  name?: string
}

export interface AppSession {
  created: number
  authProvider: 'github' | 'local' | 'cloudbase' | 'api-key'
  user: SessionUser
}

/** 下游通过 c.get('userEnv') 获取，凭证已解析好，可直接使用 */
export interface UserEnv {
  envId: string
  userId: string
  /** 已解析的凭证（永久密钥或临时密钥） */
  credentials: {
    secretId: string
    secretKey: string
    sessionToken?: string
  }
}

export type AppEnv = {
  Variables: {
    session: AppSession | undefined
    userEnv: UserEnv | undefined
    /** Scopes from Server API Key auth, undefined for cookie auth */
    apiKeyScopes: string[] | undefined
  }
}

const SESSION_COOKIE_NAME = 'nex_session'

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  // 1. Try Bearer token (Server API Key: sak_xxx)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer sak_')) {
    try {
      const plainKey = authHeader.slice(7) // Remove "Bearer "
      const encryptedKey = encrypt(plainKey)
      const db = getDb()
      const user = await db.users.findByApiKey(encryptedKey)
      if (user) {
        c.set('session', {
          created: Date.now(),
          authProvider: 'api-key' as AppSession['authProvider'],
          user: {
            id: user.id,
            username: user.username,
            email: user.email || undefined,
            avatar: user.avatarUrl || '',
            name: user.name || undefined,
          },
        })
        c.set('apiKeyScopes', ['acp'])
      }
    } catch {
      // Invalid API key, continue without auth
    }
    return next()
  }

  // 2. Try session cookie
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME)
  if (sessionCookie) {
    try {
      const session = await decryptJWE<AppSession>(sessionCookie)
      c.set('session', session)
    } catch (e) {
      // Invalid session, continue without auth
    }
  }
  await next()
}

// Helper to require authentication
export function requireAuth(c: Context<AppEnv>) {
  const session = c.get('session')
  if (!session?.user?.id) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return null
}

// ─── 临时密钥签发 ──────────────────────────────────────────────────────

// 缓存：userId -> { credentials, expireTime }
const tempCredentialCache = new Map<
  string,
  { credentials: { secretId: string; secretKey: string; sessionToken: string }; expireTime: number }
>()

/**
 * 使用支撑身份签发限定在用户 envId 下的临时密钥
 */
export async function issueTempCredentials(
  envId: string,
  userId: string,
): Promise<{ secretId: string; secretKey: string; sessionToken: string } | undefined> {
  // 检查缓存（提前 5 分钟过期）
  const cached = tempCredentialCache.get(userId)
  if (cached && cached.expireTime > Date.now() / 1000 + 300) {
    return cached.credentials
  }

  const systemSecretId = process.env.TCB_SECRET_ID
  const systemSecretKey = process.env.TCB_SECRET_KEY
  const systemEnvId = process.env.TCB_ENV_ID

  if (!systemSecretId || !systemSecretKey || !systemEnvId) return undefined

  try {
    const app = new CloudBaseManager({ secretId: systemSecretId, secretKey: systemSecretKey, envId: systemEnvId })

    const result = await app.commonService('sts').call({
      Action: 'GetFederationToken',
      Param: {
        Name: `vibe-user-${userId.slice(0, 8)}`,
        DurationSeconds: 7200,
        Policy: JSON.stringify({
          version: '2.0',
          statement: buildUserEnvPolicyStatements(envId),
        }),
      },
    })

    const creds = (result as any)?.Credentials
    if (creds?.TmpSecretId && creds?.TmpSecretKey && creds?.Token) {
      const credentials = {
        secretId: creds.TmpSecretId,
        secretKey: creds.TmpSecretKey,
        sessionToken: creds.Token,
      }
      tempCredentialCache.set(userId, {
        credentials,
        expireTime: (result as any)?.ExpiredTime || Date.now() / 1000 + 7200,
      })
      return credentials
    }
  } catch (err) {
    console.error('[Auth] issueTempCredentials failed:', (err as Error).message)
  }
  return undefined
}

// ─── requireUserEnv 中间件 ─────────────────────────────────────────────

/**
 * 中间件：校验登录 + 环境就绪 + 解析凭证
 * 下游通过 c.get('userEnv') 获取 { envId, userId, credentials }
 * credentials 已解析好（永久密钥 or 临时密钥），可直接使用
 */
export async function requireUserEnv(c: Context<AppEnv>, next: Next) {
  const authErr = requireAuth(c)
  if (authErr) return authErr

  const session = c.get('session')!
  const userId = session.user.id

  const resource = await getDb().userResources.findByUserId(userId)

  if (!resource?.envId) {
    return c.json({ error: 'User environment not ready' }, 400)
  }

  const envId = resource.envId

  // 解析凭证：优先永久密钥，否则签发临时密钥
  let credentials: UserEnv['credentials'] | undefined

  if (resource.camSecretId && resource.camSecretKey) {
    credentials = { secretId: resource.camSecretId, secretKey: resource.camSecretKey }
  } else {
    credentials = await issueTempCredentials(envId, userId)
  }

  if (!credentials) {
    return c.json({ error: 'Failed to obtain user credentials' }, 500)
  }

  c.set('userEnv', { envId, userId, credentials })

  await next()
}
