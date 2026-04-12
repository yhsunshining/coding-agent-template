import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Prevent unhandled rejections from crashing the process (agent-sdk Transport errors)
process.on('unhandledRejection', (err) => {
  console.error('[Server] Unhandled rejection:', err)
})

import { authMiddleware } from './middleware/auth'
import type { AppEnv } from './middleware/auth'
import authRoutes from './routes/auth'
import githubAuthRoutes from './routes/github-auth'
import cloudbaseAuthRoutes from './routes/cloudbase-auth'
import githubRoutes from './routes/github'
import acpRoutes from './routes/acp'
import tasksRoutes from './routes/tasks'
import connectorsRoutes from './routes/connectors'
import miniprogramRoutes from './routes/miniprogram'
import crontaskRoutes from './routes/crontask'
import apiKeysRoutes from './routes/api-keys'
import miscRoutes from './routes/misc'
import reposRoutes from './routes/repos'
import databaseRoutes from './routes/database.js'
import storageRoutes from './routes/storage.js'
import functionsRoutes from './routes/functions.js'
import sqlRoutes from './routes/sql.js'
import capiRoutes from './routes/capi.js'
import adminRoutes from './routes/admin'

const app = new Hono<AppEnv>()

// CORS configuration
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  }),
)

// API routes (must be before static files)
app.use('*', authMiddleware)

app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/api/auth', authRoutes)
app.route('/api/auth/github', githubAuthRoutes)
app.route('/api/auth/cloudbase', cloudbaseAuthRoutes)
app.route('/api/github', githubRoutes)
app.route('/api/agent', acpRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/connectors', connectorsRoutes)
app.route('/api/miniprogram', miniprogramRoutes)
app.route('/api/crontask', crontaskRoutes)
app.route('/api/api-keys', apiKeysRoutes)
app.route('/api', miscRoutes)
app.route('/api/repos', reposRoutes)
app.route('/api/database', databaseRoutes)
app.route('/api/storage', storageRoutes)
app.route('/api/functions', functionsRoutes)
app.route('/api/sql', sqlRoutes)
app.route('/api/capi', capiRoutes)
app.route('/api/admin', adminRoutes)

// Static file serving for production (web build output)
const webDistPath = resolve(__dirname, '../web/dist')
const serveStaticFiles = existsSync(webDistPath)

if (serveStaticFiles) {
  console.log(`[Server] Serving static files from: ${webDistPath}`)

  // Serve static assets (JS, CSS, images, etc.)
  app.use('/assets/*', serveStatic({ root: webDistPath }))

  // Serve other static files (favicon, etc.)
  app.use('/*', serveStatic({ root: webDistPath }))

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', async (c, next) => {
    const path = c.req.path
    // Skip API routes
    if (path.startsWith('/api')) {
      return next()
    }
    // Serve index.html for SPA routes
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coding Agent</title>
  <link rel="stylesheet" href="/assets/index.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`,
    )
  })
} else {
  console.log('[Server] Running in API-only mode (no static files)')
  console.log('[Server] For full-stack mode, build the web package first: pnpm build:web')
}

import { initCronScheduler } from './services/cron-scheduler.js'
import { getDb } from './db/index.js'
import { encrypt } from './lib/crypto.js'
import { nanoid } from 'nanoid'

// Backfill apiKey for existing users that don't have one
async function backfillApiKeys() {
  try {
    const db = getDb()
    const users = await db.users.findAll(1000, 0)
    let count = 0
    for (const user of users) {
      if (!user.apiKey) {
        const plainKey = `sak_${nanoid(40)}`
        await db.users.update(user.id, { apiKey: encrypt(plainKey) })
        count++
      }
    }
    if (count > 0) {
      console.log(`[Server] Backfilled API keys for ${count} users`)
    }
  } catch (err) {
    console.error('[Server] Failed to backfill API keys:', err)
  }
}

const PORT = Number(process.env.PORT) || 3001

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (serveStaticFiles) {
    console.log(`Open http://localhost:${PORT} in your browser`)
  } else {
    console.log(`API endpoint: http://localhost:${PORT}/api`)
    console.log(`For development, run: pnpm dev:web`)
  }

  // Initialize cron scheduler
  initCronScheduler().catch((err) => {
    console.error('Failed to initialize cron scheduler:', err)
  })

  // Backfill API keys for existing users
  backfillApiKeys()
})

export default app
