import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { db } from '../db/client'
import { users, localCredentials, userResources } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { encryptJWE } from '../lib/session'
import type { AppEnv, AppSession } from '../middleware/auth'
import { provisionUserResources } from '../cloudbase/provision.js'

const SESSION_COOKIE_NAME = 'nex_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

const auth = new Hono<AppEnv>()

auth.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password } = body

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const trimmedUsername = username.trim().toLowerCase()
    if (trimmedUsername.length < 3) {
      return c.json({ error: 'Username must be at least 3 characters' }, 400)
    }
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400)
    }

    // Check if username already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.provider, 'local'), eq(users.externalId, trimmedUsername)))
      .limit(1)

    if (existing.length > 0) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    // Create user
    const userId = nanoid()
    const now = Date.now()
    const passwordHash = await bcrypt.hash(password, 12)

    await db.insert(users).values({
      id: userId,
      provider: 'local',
      externalId: trimmedUsername,
      accessToken: '',
      username: trimmedUsername,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })

    await db.insert(localCredentials).values({
      userId,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    // Create session
    const session: AppSession = {
      created: now,
      authProvider: 'github',
      user: {
        id: userId,
        username: trimmedUsername,
        email: undefined,
        name: trimmedUsername,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff`,
      },
    }

    const sessionValue = await encryptJWE(session, '1y')

    // CloudBase 环境配置
    // TCB_PROVISION_MODE=isolated → 异步创建独立环境（需 CAM 权限密钥）
    // TCB_PROVISION_MODE=shared   → 复用主环境 TCB_ENV_ID（默认，即时就绪）
    const provisionMode = process.env.TCB_PROVISION_MODE || 'shared'

    if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
      const resourceId = nanoid()

      if (provisionMode === 'isolated') {
        // 异步创建独立环境，注册立即返回，前端轮询 provision-status
        await db.insert(userResources).values({
          id: resourceId,
          userId,
          status: 'processing',
          createdAt: now,
          updatedAt: now,
        })

        provisionUserResources(userId, trimmedUsername)
          .then(async (result) => {
            await db
              .update(userResources)
              .set({
                status: 'success',
                envId: result.envId,
                camUsername: result.camUsername,
                camSecretId: result.camSecretId,
                camSecretKey: result.camSecretKey || null,
                policyId: result.policyId,
                updatedAt: Date.now(),
              })
              .where(eq(userResources.id, resourceId))
            console.log(`[provision] User ${trimmedUsername} env ready: ${result.envId}`)
          })
          .catch(async (err) => {
            await db
              .update(userResources)
              .set({ status: 'failed', failReason: err.message, updatedAt: Date.now() })
              .where(eq(userResources.id, resourceId))
            console.error(`[provision] User ${trimmedUsername} failed:`, err.message)
          })
      } else {
        // shared 模式：直接写入主环境信息，即时就绪
        await db.insert(userResources).values({
          id: resourceId,
          userId,
          status: 'success',
          envId: process.env.TCB_ENV_ID || null,
          camSecretId: process.env.TCB_SECRET_ID || null,
          camSecretKey: process.env.TCB_SECRET_KEY || null,
          createdAt: now,
          updatedAt: now,
        })
        console.log(`[provision] User ${trimmedUsername} shared env: ${process.env.TCB_ENV_ID}`)
      }
    }

    setCookie(c, SESSION_COOKIE_NAME, sessionValue, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
    })

    return c.json({ success: true, username: trimmedUsername })
  } catch (error) {
    console.error('Error registering local user:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password } = body

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const trimmedUsername = username.trim().toLowerCase()

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, 'local'), eq(users.externalId, trimmedUsername)))
      .limit(1)

    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Get credentials
    const [cred] = await db.select().from(localCredentials).where(eq(localCredentials.userId, user.id)).limit(1)

    if (!cred) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Verify password
    const valid = await bcrypt.compare(password, cred.passwordHash)
    if (!valid) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: Date.now(), updatedAt: Date.now() }).where(eq(users.id, user.id))

    // Create session
    const session: AppSession = {
      created: Date.now(),
      authProvider: 'github',
      user: {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        name: user.name || user.username,
        avatar:
          user.avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`,
      },
    }

    const sessionValue = await encryptJWE(session, '1y')

    setCookie(c, SESSION_COOKIE_NAME, sessionValue, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Error logging in local user:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

auth.post('/signout', async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ success: true })
})

auth.get('/me', async (c) => {
  const session = c.get('session')

  if (!session) {
    return c.json({ user: undefined })
  }

  // 查询用户的 envId
  let envId: string | undefined
  try {
    const [resource] = await db.select().from(userResources).where(eq(userResources.userId, session.user.id)).limit(1)
    envId = resource?.envId || undefined
  } catch {
    // ignore
  }

  return c.json({ user: session.user, authProvider: session.authProvider, envId })
})

// 查询当前用户的 CloudBase 环境状态
auth.get('/provision-status', async (c) => {
  const session = c.get('session')
  if (!session?.user?.id) return c.json({ error: 'Unauthorized' }, 401)

  const [resource] = await db.select().from(userResources).where(eq(userResources.userId, session.user.id)).limit(1)

  if (!resource) return c.json({ status: 'not_started' })

  return c.json({
    status: resource.status,
    envId: resource.envId,
    camUsername: resource.camUsername,
    camSecretId: resource.camSecretId,
    failReason: resource.failReason,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  })
})

// Rate limit info
auth.get('/rate-limit', async (c) => {
  const session = c.get('session')
  if (!session?.user?.id) return c.json({ error: 'Unauthorized' }, 401)

  // Return generous default limits
  return c.json({
    allowed: true,
    remaining: 100,
    used: 0,
    total: 100,
    resetAt: new Date(Date.now() + 86400000).toISOString(),
  })
})

export default auth
