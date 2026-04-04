import { Hono } from 'hono'
import { requireUserEnv, type AppEnv } from '../middleware/auth.js'
import { createManager, type CloudBaseCredentials } from '../cloudbase/database.js'

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

router.get('/', requireUserEnv, async (c) => {
  try {
    const manager = createManager(getCreds(c))
    const result = await manager.functions.getFunctionList(100, 0)
    const functions = (result.Functions || []).map((f: any) => ({
      name: f.FunctionName,
      runtime: f.Runtime,
      status: f.Status,
      codeSize: f.CodeSize,
      description: f.Description,
      addTime: f.AddTime,
      modTime: f.ModTime,
      memSize: f.MemorySize,
      timeout: f.Timeout,
      type: f.Type,
    }))
    return c.json(functions)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

router.post('/:name/invoke', requireUserEnv, async (c) => {
  try {
    const manager = createManager(getCreds(c))
    const name = c.req.param('name')
    const body = await c.req.json()
    const result = await manager.functions.invokeFunction(name, body)
    return c.json({ result: result.RetMsg })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default router
