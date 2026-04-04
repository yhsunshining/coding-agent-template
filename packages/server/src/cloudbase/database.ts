import CloudBase from '@cloudbase/manager-node'
import type { CollectionInfo, CollectionListResult, DocumentQueryResult } from '@coder/shared'

// ─── 获取 Manager 实例（按请求初始化，使用用户凭证）──────────

export interface CloudBaseCredentials {
  envId: string
  secretId: string
  secretKey: string
  sessionToken?: string
}

export function createManager(creds: CloudBaseCredentials): CloudBase {
  return new CloudBase({
    secretId: creds.secretId,
    secretKey: creds.secretKey,
    token: creds.sessionToken || '',
    envId: creds.envId,
    proxy: process.env.http_proxy,
  })
}

// ─── 获取数据库实例 ID ──────────────────────────────────

async function getDatabaseInstanceId(manager: CloudBase): Promise<string> {
  const { EnvInfo } = await manager.env.getEnvInfo()
  if (!EnvInfo?.Databases?.[0]?.InstanceId) {
    throw new Error('无法获取数据库实例ID')
  }
  return EnvInfo.Databases[0].InstanceId
}

// ─── 集合管理 ───────────────────────────────────────────

export async function listCollections(creds: CloudBaseCredentials): Promise<CollectionListResult> {
  const manager = createManager(creds)
  const result = await manager.database.listCollections({
    MgoOffset: 0,
    MgoLimit: 1000,
  })
  const collections: CollectionInfo[] = (result.Collections || []).map((c: any) => ({
    CollectionName: c.CollectionName,
    Count: c.Count,
    Size: c.Size,
    IndexCount: c.IndexCount,
    IndexSize: c.IndexSize,
  }))
  return {
    collections,
    total: result.Pager?.Total ?? collections.length,
  }
}

export async function createCollection(creds: CloudBaseCredentials, name: string): Promise<void> {
  const manager = createManager(creds)
  await manager.database.createCollection(name)
  await waitForCollectionReady(manager, name)
}

export async function deleteCollection(creds: CloudBaseCredentials, name: string): Promise<void> {
  const manager = createManager(creds)
  await manager.database.deleteCollection(name)
}

// ─── 文档 CRUD ──────────────────────────────────────────

export async function queryDocuments(
  creds: CloudBaseCredentials,
  collection: string,
  page = 1,
  pageSize = 50,
  where?: Record<string, unknown>,
): Promise<DocumentQueryResult> {
  const manager = createManager(creds)
  const instanceId = await getDatabaseInstanceId(manager)
  const offset = (page - 1) * pageSize

  const mgoQuery = where && Object.keys(where).length > 0 ? JSON.stringify(where) : '{}'

  const result = await manager.commonService('tcb', '2018-06-08').call({
    Action: 'QueryRecords',
    Param: {
      TableName: collection,
      MgoQuery: mgoQuery,
      MgoLimit: pageSize,
      MgoOffset: offset,
      Tag: instanceId,
    },
  })

  const documents = (result.Data || []).map((item: unknown) => {
    if (typeof item === 'string') {
      try {
        const parsed = JSON.parse(item)
        return typeof parsed === 'object' && parsed !== null ? parsed : item
      } catch {
        return item
      }
    }
    return item
  }) as Record<string, unknown>[]

  return {
    documents,
    total: result.Pager?.Total ?? documents.length,
    page,
    pageSize,
  }
}

export async function insertDocument(
  creds: CloudBaseCredentials,
  collection: string,
  data: Record<string, unknown>,
): Promise<string> {
  const manager = createManager(creds)
  const instanceId = await getDatabaseInstanceId(manager)

  const result = await manager.commonService('tcb', '2018-06-08').call({
    Action: 'PutItem',
    Param: {
      TableName: collection,
      MgoDocs: [JSON.stringify(data)],
      Tag: instanceId,
    },
  })

  return result.InsertedIds?.[0] ?? ''
}

export async function updateDocument(
  creds: CloudBaseCredentials,
  collection: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const manager = createManager(creds)
  const instanceId = await getDatabaseInstanceId(manager)

  const { _id, ...updateData } = data

  await manager.commonService('tcb', '2018-06-08').call({
    Action: 'UpdateItem',
    Param: {
      TableName: collection,
      MgoQuery: JSON.stringify({ _id: docId }),
      MgoUpdate: JSON.stringify({ $set: updateData }),
      MgoIsMulti: false,
      MgoUpsert: false,
      Tag: instanceId,
    },
  })
}

export async function deleteDocument(creds: CloudBaseCredentials, collection: string, docId: string): Promise<void> {
  const manager = createManager(creds)
  const instanceId = await getDatabaseInstanceId(manager)

  await manager.commonService('tcb', '2018-06-08').call({
    Action: 'DeleteItem',
    Param: {
      TableName: collection,
      MgoQuery: JSON.stringify({ _id: docId }),
      MgoIsMulti: false,
      Tag: instanceId,
    },
  })
}

// ─── 工具函数 ───────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForCollectionReady(
  manager: CloudBase,
  name: string,
  timeoutMs = 10000,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    try {
      const result = await manager.database.checkCollectionExists(name)
      if (result.Exists) return
    } catch {
      // 继续轮询
    }
    if (Date.now() + intervalMs > deadline) break
    await delay(intervalMs)
  }
  throw new Error(`Collection ${name} creation timed out`)
}
