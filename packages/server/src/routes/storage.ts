import { Hono } from 'hono'
import { requireUserEnv, type AppEnv } from '../middleware/auth.js'
import type { CloudBaseCredentials } from '../cloudbase/database.js'
import {
  getBuckets,
  listStorageFiles,
  listHostingFiles,
  getDownloadUrl,
  deleteFile,
  deleteHostingFile,
} from '../cloudbase/storage.js'

const router = new Hono<AppEnv>()

function getCreds(c: any): CloudBaseCredentials {
  const { envId, credentials } = c.get('userEnv')!
  return {
    envId,
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken,
  }
}

router.get('/buckets', requireUserEnv, async (c) => {
  try {
    return c.json(await getBuckets(getCreds(c)))
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.get('/files', requireUserEnv, async (c) => {
  try {
    const prefix = c.req.query('prefix') || ''
    const bucketType = c.req.query('bucketType') || 'storage'
    const cdnDomain = c.req.query('cdnDomain') || ''
    const creds = getCreds(c)

    const files =
      bucketType === 'static' ? await listHostingFiles(creds, prefix, cdnDomain) : await listStorageFiles(creds, prefix)

    return c.json(files)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.get('/url', requireUserEnv, async (c) => {
  try {
    const path = c.req.query('path') || ''
    if (!path) return c.json({ error: '缺少 path 参数' }, 400)
    return c.json({ url: await getDownloadUrl(getCreds(c), path) })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.delete('/files', requireUserEnv, async (c) => {
  try {
    const { path, bucketType } = await c.req.json()
    if (!path) return c.json({ error: '缺少 path 参数' }, 400)
    const creds = getCreds(c)
    if (bucketType === 'static') {
      await deleteHostingFile(creds, path)
    } else {
      await deleteFile(creds, path)
    }
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default router
