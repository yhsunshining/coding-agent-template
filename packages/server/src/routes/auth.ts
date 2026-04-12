import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { getDb } from '../db/index.js'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { encryptJWE } from '../lib/session'
import { encrypt } from '../lib/crypto'
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
    const existing = await getDb().users.findByProviderAndExternalId('local', trimmedUsername)

    if (existing) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    // Create user
    const userId = nanoid()
    const now = Date.now()
    const passwordHash = await bcrypt.hash(password, 12)

    await getDb().users.create({
      id: userId,
      provider: 'local',
      externalId: trimmedUsername,
      accessToken: '',
      refreshToken: null,
      scope: null,
      username: trimmedUsername,
      email: null,
      name: null,
      avatarUrl: null,
      apiKey: encrypt(`sak_${nanoid(40)}`),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })

    await getDb().localCredentials.create({
      userId,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    // Create session
    const session: AppSession = {
      created: now,
      authProvider: 'local',
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
        await getDb().userResources.create({
          id: resourceId,
          userId,
          status: 'processing',
          envId: null,
          camUsername: null,
          camSecretId: null,
          camSecretKey: null,
          policyId: null,
          failStep: null,
          failReason: null,
          createdAt: now,
          updatedAt: now,
        })

        provisionUserResources(userId, trimmedUsername)
          .then(async (result) => {
            await getDb().userResources.update(resourceId, {
              status: 'success',
              envId: result.envId,
              camUsername: result.camUsername,
              camSecretId: result.camSecretId,
              camSecretKey: result.camSecretKey || null,
              policyId: result.policyId,
              updatedAt: Date.now(),
            })
            console.log(`[provision] User ${trimmedUsername} env ready: ${result.envId}`)
          })
          .catch(async (err) => {
            await getDb().userResources.update(resourceId, {
              status: 'failed',
              failReason: err.message,
              updatedAt: Date.now(),
            })
            console.error(`[provision] User ${trimmedUsername} failed:`, err.message)
          })
      } else {
        // shared 模式：直接写入主环境信息，即时就绪
        await getDb().userResources.create({
          id: resourceId,
          userId,
          status: 'success',
          envId: process.env.TCB_ENV_ID || null,
          camUsername: null,
          camSecretId: process.env.TCB_SECRET_ID || null,
          camSecretKey: process.env.TCB_SECRET_KEY || null,
          policyId: null,
          failStep: null,
          failReason: null,
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
    const user = await getDb().users.findByProviderAndExternalId('local', trimmedUsername)

    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Get credentials
    const cred = await getDb().localCredentials.findByUserId(user.id)

    if (!cred) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Verify password
    const valid = await bcrypt.compare(password, cred.passwordHash)
    if (!valid) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Check if user is disabled
    if (user.status === 'disabled') {
      return c.json({ error: 'Account has been disabled' }, 403)
    }

    // Update last login
    await getDb().users.update(user.id, { lastLoginAt: Date.now(), updatedAt: Date.now() })

    // Create session
    const session: AppSession = {
      created: Date.now(),
      authProvider: 'local',
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

  // Get user role and check status
  const user = await getDb().users.findById(session.user.id)

  // If user is disabled, clear session and return no user
  if (user?.status === 'disabled') {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
    return c.json({ user: undefined })
  }

  // Get user's envId and provision status
  let envId: string | undefined
  let provisionStatus: string = 'not_started'
  try {
    const resource = await getDb().userResources.findByUserId(session.user.id)
    envId = resource?.envId || undefined
    provisionStatus = resource?.status || 'not_started'
  } catch {
    // ignore
  }

  return c.json({
    user: {
      ...session.user,
      role: user?.role || 'user',
    },
    authProvider: session.authProvider,
    envId,
    provisionStatus,
  })
})

// 查询当前用户的 CloudBase 环境状态
auth.get('/provision-status', async (c) => {
  const session = c.get('session')
  if (!session?.user?.id) return c.json({ error: 'Unauthorized' }, 401)

  const resource = await getDb().userResources.findByUserId(session.user.id)

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

// Retry failed provision
auth.post('/provision-retry', async (c) => {
  const session = c.get('session')
  if (!session?.user?.id) return c.json({ error: 'Unauthorized' }, 401)

  const resource = await getDb().userResources.findByUserId(session.user.id)
  if (!resource) return c.json({ error: 'No resource record found' }, 404)
  if (resource.status !== 'failed') return c.json({ error: 'Can only retry failed provisions' }, 400)

  // Reset to processing and retry
  await getDb().userResources.update(resource.id, {
    status: 'processing',
    failReason: null,
    failStep: null,
    updatedAt: Date.now(),
  })

  const user = await getDb().users.findById(session.user.id)
  const username = user?.username || session.user.username || 'unknown'

  provisionUserResources(session.user.id, username)
    .then(async (result) => {
      await getDb().userResources.update(resource.id, {
        status: 'success',
        envId: result.envId,
        camUsername: result.camUsername,
        camSecretId: result.camSecretId,
        camSecretKey: result.camSecretKey || null,
        policyId: result.policyId,
        updatedAt: Date.now(),
      })
      console.log('[provision-retry] User env ready')
    })
    .catch(async (err) => {
      await getDb().userResources.update(resource.id, {
        status: 'failed',
        failReason: err.message,
        updatedAt: Date.now(),
      })
      console.error('[provision-retry] Failed:', err.message)
    })

  return c.json({ status: 'processing' })
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

// GET /auth-config - Expose auth configuration to frontend (no session required)
auth.get('/auth-config', (c) => {
  const providers = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || 'local').split(',').map((s) => s.trim())
  const githubMode = process.env.AUTH_GITHUB_MODE || 'direct' // 'direct' | 'cloudbase'
  const tcbEnvId = process.env.TCB_ENV_ID || ''
  return c.json({ providers, githubMode, tcbEnvId })
})

// ─── API Key (view / reset) ────────────────────────────────────────────────

// Get current user's API key
auth.get('/api-key', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!
  const user = await getDb().users.findById(session.user.id)
  if (!user) return c.json({ error: 'User not found' }, 404)

  if (!user.apiKey) {
    return c.json({ apiKey: null })
  }

  try {
    const { decrypt } = await import('../lib/crypto.js')
    return c.json({ apiKey: decrypt(user.apiKey) })
  } catch {
    return c.json({ apiKey: null })
  }
})

// Reset (regenerate) current user's API key
auth.post('/api-key/reset', async (c) => {
  const authErr = requireAuth(c)
  if (authErr) return authErr
  const session = c.get('session')!

  const plainKey = `sak_${nanoid(40)}`
  const encryptedKey = encrypt(plainKey)

  await getDb().users.update(session.user.id, { apiKey: encryptedKey })

  return c.json({ apiKey: plainKey })
})

export default auth
