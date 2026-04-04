import { Hono } from 'hono'
import { requireUserEnv, type AppEnv } from '../middleware/auth.js'
import type { CloudBaseCredentials } from '../cloudbase/database.js'
import {
  listCollections,
  createCollection,
  deleteCollection,
  queryDocuments,
  insertDocument,
  updateDocument,
  deleteDocument,
} from '../cloudbase/database.js'

const router = new Hono<AppEnv>()

/** 从 userEnv 构建 CloudBase 凭证 */
function getCreds(c: any): CloudBaseCredentials {
  const { envId, credentials } = c.get('userEnv')!
  return {
    envId,
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken,
  }
}

router.get('/collections', requireUserEnv, async (c) => {
  try {
    const result = await listCollections(getCreds(c))
    return c.json(result.collections)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.post('/collections', requireUserEnv, async (c) => {
  try {
    const { name } = await c.req.json()
    await createCollection(getCreds(c), name)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.delete('/collections/:name', requireUserEnv, async (c) => {
  try {
    await deleteCollection(getCreds(c), c.req.param('name'))
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.get('/collections/:name/documents', requireUserEnv, async (c) => {
  try {
    const name = c.req.param('name')
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '50')
    const search = c.req.query('search')?.trim()

    let where: Record<string, unknown> | undefined
    if (search) {
      if (search.includes(':')) {
        const [field, ...rest] = search.split(':')
        const val = rest.join(':')
        where = { [field.trim()]: val.trim() }
      } else {
        where = { _id: search }
      }
    }

    const result = await queryDocuments(getCreds(c), name, page, pageSize, where)
    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.post('/collections/:name/documents', requireUserEnv, async (c) => {
  try {
    const data = await c.req.json()
    const id = await insertDocument(getCreds(c), c.req.param('name'), data)
    return c.json({ _id: id })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.put('/collections/:name/documents/:id', requireUserEnv, async (c) => {
  try {
    const data = await c.req.json()
    await updateDocument(getCreds(c), c.req.param('name'), c.req.param('id'), data)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.delete('/collections/:name/documents/:id', requireUserEnv, async (c) => {
  try {
    await deleteDocument(getCreds(c), c.req.param('name'), c.req.param('id'))
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default router
