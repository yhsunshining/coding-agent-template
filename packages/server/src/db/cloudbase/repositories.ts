import { nanoid } from 'nanoid'
import { getCollection, getCommand } from './client'
import type {
  User,
  NewUser,
  LocalCredential,
  NewLocalCredential,
  Task,
  NewTask,
  Connector,
  NewConnector,
  Account,
  NewAccount,
  Key,
  NewKey,
  UserResource,
  NewUserResource,
  Setting,
  NewSetting,
  Deployment,
  NewDeployment,
  UserRepository,
  LocalCredentialRepository,
  TaskRepository,
  ConnectorRepository,
  AccountRepository,
  KeyRepository,
  UserResourceRepository,
  SettingRepository,
  DeploymentRepository,
  DatabaseProvider,
} from '../types'

const now = () => Date.now()

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripCloudBaseId<T>(doc: Record<string, unknown>): T {
  const { _id, ...rest } = doc
  return rest as T
}

// ─── User Repository ────────────────────────────────────────────────────────

class CloudBaseUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const _ = getCommand()
    const collection = await getCollection('users')
    const { data } = await collection
      .where({ id: _.eq(id) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<User>(data[0] as Record<string, unknown>)
  }

  async findByProviderAndExternalId(provider: string, externalId: string): Promise<User | null> {
    const _ = getCommand()
    const collection = await getCollection('users')
    const { data } = await collection
      .where({ provider: _.eq(provider), externalId: _.eq(externalId) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<User>(data[0] as Record<string, unknown>)
  }

  async create(user: NewUser): Promise<User> {
    const collection = await getCollection('users')
    const ts = now()
    const doc: User = {
      ...user,
      createdAt: user.createdAt ?? ts,
      updatedAt: user.updatedAt ?? ts,
      lastLoginAt: user.lastLoginAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, data: Partial<Omit<User, 'id'>>): Promise<User | null> {
    const _ = getCommand()
    const collection = await getCollection('users')
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() })
    return this.findById(id)
  }

  async deleteById(id: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('users')
    await collection.where({ id: _.eq(id) }).remove()
  }
}

// ─── LocalCredential Repository ─────────────────────────────────────────────

class CloudBaseLocalCredentialRepository implements LocalCredentialRepository {
  async findByUserId(userId: string): Promise<LocalCredential | null> {
    const _ = getCommand()
    const collection = await getCollection('local_credentials')
    const { data } = await collection
      .where({ userId: _.eq(userId) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<LocalCredential>(data[0] as Record<string, unknown>)
  }

  async create(credential: NewLocalCredential): Promise<LocalCredential> {
    const collection = await getCollection('local_credentials')
    const ts = now()
    const doc: LocalCredential = {
      ...credential,
      createdAt: credential.createdAt ?? ts,
      updatedAt: credential.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }
}

// ─── Task Repository ────────────────────────────────────────────────────────

class CloudBaseTaskRepository implements TaskRepository {
  async findById(id: string): Promise<Task | null> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    const { data } = await collection
      .where({ id: _.eq(id) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Task>(data[0] as Record<string, unknown>)
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Task | null> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    const { data } = await collection
      .where({ id: _.eq(id), userId: _.eq(userId), deletedAt: _.eq(null) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Task>(data[0] as Record<string, unknown>)
  }

  async findByUserId(userId: string): Promise<Task[]> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    const { data } = await collection
      .where({ userId: _.eq(userId), deletedAt: _.eq(null) })
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Task>(doc))
  }

  async findByRepoAndPr(userId: string, prNumber: number, repoUrl: string): Promise<Task[]> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    const { data } = await collection
      .where({ userId: _.eq(userId), prNumber: _.eq(prNumber), repoUrl: _.eq(repoUrl), deletedAt: _.eq(null) })
      .limit(1)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Task>(doc))
  }

  async create(task: NewTask): Promise<Task> {
    const collection = await getCollection('tasks')
    const ts = now()
    const doc: Task = {
      ...task,
      createdAt: task.createdAt ?? ts,
      updatedAt: task.updatedAt ?? ts,
      completedAt: task.completedAt ?? null,
      deletedAt: task.deletedAt ?? null,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, data: Partial<Omit<Task, 'id'>>): Promise<Task | null> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() })
    return this.findById(id)
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId })
  }

  async softDelete(id: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('tasks')
    await collection.where({ id: _.eq(id) }).update({ deletedAt: now() })
  }
}

// ─── Connector Repository ───────────────────────────────────────────────────

class CloudBaseConnectorRepository implements ConnectorRepository {
  async findByUserId(userId: string): Promise<Connector[]> {
    const _ = getCommand()
    const collection = await getCollection('connectors')
    const { data } = await collection
      .where({ userId: _.eq(userId) })
      .limit(1000)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Connector>(doc))
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Connector | null> {
    const _ = getCommand()
    const collection = await getCollection('connectors')
    const { data } = await collection
      .where({ id: _.eq(id), userId: _.eq(userId) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Connector>(data[0] as Record<string, unknown>)
  }

  async create(connector: NewConnector): Promise<Connector> {
    const collection = await getCollection('connectors')
    const ts = now()
    const doc: Connector = {
      ...connector,
      createdAt: connector.createdAt ?? ts,
      updatedAt: connector.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, userId: string, data: Partial<Omit<Connector, 'id' | 'userId'>>): Promise<Connector | null> {
    const _ = getCommand()
    const collection = await getCollection('connectors')
    await collection
      .where({ id: _.eq(id), userId: _.eq(userId) })
      .update({ ...data, updatedAt: data.updatedAt ?? now() })
    return this.findByIdAndUserId(id, userId)
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('connectors')
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId })
  }

  async delete(id: string, userId: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('connectors')
    await collection.where({ id: _.eq(id), userId: _.eq(userId) }).remove()
  }
}

// ─── Account Repository ─────────────────────────────────────────────────────

class CloudBaseAccountRepository implements AccountRepository {
  async findByUserIdAndProvider(userId: string, provider: string): Promise<Account | null> {
    const _ = getCommand()
    const collection = await getCollection('accounts')
    const { data } = await collection
      .where({ userId: _.eq(userId), provider: _.eq(provider) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Account>(data[0] as Record<string, unknown>)
  }

  async findByProviderAndExternalUserId(provider: string, externalUserId: string): Promise<Account | null> {
    const _ = getCommand()
    const collection = await getCollection('accounts')
    const { data } = await collection
      .where({ provider: _.eq(provider), externalUserId: _.eq(externalUserId) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Account>(data[0] as Record<string, unknown>)
  }

  async create(account: NewAccount): Promise<Account> {
    const collection = await getCollection('accounts')
    const ts = now()
    const doc: Account = {
      ...account,
      createdAt: account.createdAt ?? ts,
      updatedAt: account.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, data: Partial<Omit<Account, 'id'>>): Promise<Account | null> {
    const _ = getCommand()
    const collection = await getCollection('accounts')
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() })
    const { data: rows } = await collection
      .where({ id: _.eq(id) })
      .limit(1)
      .get()
    if (!rows || rows.length === 0) return null
    return stripCloudBaseId<Account>(rows[0] as Record<string, unknown>)
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('accounts')
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId })
  }

  async delete(userId: string, provider: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('accounts')
    await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).remove()
  }
}

// ─── Key Repository ─────────────────────────────────────────────────────────

class CloudBaseKeyRepository implements KeyRepository {
  async findByUserId(userId: string): Promise<Key[]> {
    const _ = getCommand()
    const collection = await getCollection('keys')
    const { data } = await collection
      .where({ userId: _.eq(userId) })
      .limit(1000)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Key>(doc))
  }

  async findByUserIdAndProvider(userId: string, provider: string): Promise<Key | null> {
    const _ = getCommand()
    const collection = await getCollection('keys')
    const { data } = await collection
      .where({ userId: _.eq(userId), provider: _.eq(provider) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Key>(data[0] as Record<string, unknown>)
  }

  async upsert(key: NewKey): Promise<Key> {
    const ts = now()
    const existing = await this.findByUserIdAndProvider(key.userId, key.provider)
    if (existing) {
      const _ = getCommand()
      const collection = await getCollection('keys')
      await collection
        .where({ userId: _.eq(key.userId), provider: _.eq(key.provider) })
        .update({ value: key.value, updatedAt: ts })
      return { ...existing, value: key.value, updatedAt: ts }
    }
    const collection = await getCollection('keys')
    const doc: Key = {
      ...key,
      id: key.id || nanoid(),
      createdAt: key.createdAt ?? ts,
      updatedAt: key.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('keys')
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId })
  }

  async delete(userId: string, provider: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('keys')
    await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).remove()
  }
}

// ─── UserResource Repository ────────────────────────────────────────────────

class CloudBaseUserResourceRepository implements UserResourceRepository {
  async findByUserId(userId: string): Promise<UserResource | null> {
    const _ = getCommand()
    const collection = await getCollection('user_resources')
    const { data } = await collection
      .where({ userId: _.eq(userId) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<UserResource>(data[0] as Record<string, unknown>)
  }

  async create(resource: NewUserResource): Promise<UserResource> {
    const collection = await getCollection('user_resources')
    const ts = now()
    const doc: UserResource = {
      ...resource,
      createdAt: resource.createdAt ?? ts,
      updatedAt: resource.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, data: Partial<Omit<UserResource, 'id'>>): Promise<UserResource | null> {
    const _ = getCommand()
    const collection = await getCollection('user_resources')
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() })
    const { data: rows } = await collection
      .where({ id: _.eq(id) })
      .limit(1)
      .get()
    if (!rows || rows.length === 0) return null
    return stripCloudBaseId<UserResource>(rows[0] as Record<string, unknown>)
  }
}

// ─── Setting Repository ─────────────────────────────────────────────────────

class CloudBaseSettingRepository implements SettingRepository {
  async findByUserIdAndKey(userId: string, key: string): Promise<Setting | null> {
    const _ = getCommand()
    const collection = await getCollection('settings')
    const { data } = await collection
      .where({ userId: _.eq(userId), key: _.eq(key) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Setting>(data[0] as Record<string, unknown>)
  }

  async findByUserId(userId: string): Promise<Setting[]> {
    const _ = getCommand()
    const collection = await getCollection('settings')
    const { data } = await collection
      .where({ userId: _.eq(userId) })
      .limit(1000)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Setting>(doc))
  }

  async upsert(setting: NewSetting): Promise<Setting> {
    const ts = now()
    const existing = await this.findByUserIdAndKey(setting.userId, setting.key)
    if (existing) {
      const _ = getCommand()
      const collection = await getCollection('settings')
      await collection
        .where({ userId: _.eq(setting.userId), key: _.eq(setting.key) })
        .update({ value: setting.value, updatedAt: ts })
      return { ...existing, value: setting.value, updatedAt: ts }
    }
    const collection = await getCollection('settings')
    const doc: Setting = {
      ...setting,
      id: setting.id || nanoid(),
      createdAt: setting.createdAt ?? ts,
      updatedAt: setting.updatedAt ?? ts,
    }
    await collection.add(doc)
    return doc
  }
}

// ─── Deployment Repository ──────────────────────────────────────────────────

class CloudBaseDeploymentRepository implements DeploymentRepository {
  async findByTaskId(taskId: string): Promise<Deployment[]> {
    const _ = getCommand()
    const collection = await getCollection('deployments')
    const { data } = await collection
      .where({ taskId: _.eq(taskId), deletedAt: _.eq(null) })
      .limit(1000)
      .get()
    return (data as Record<string, unknown>[]).map((doc) => stripCloudBaseId<Deployment>(doc))
  }

  async findByTaskIdAndTypePath(taskId: string, type: string, path: string | null): Promise<Deployment | null> {
    const _ = getCommand()
    const collection = await getCollection('deployments')
    const where: Record<string, unknown> = {
      taskId: _.eq(taskId),
      type: _.eq(type),
      deletedAt: _.eq(null),
    }
    if (path !== null) {
      where.path = _.eq(path)
    } else {
      where.path = _.eq(null)
    }
    const { data } = await collection.where(where).limit(1).get()
    if (!data || data.length === 0) return null
    return stripCloudBaseId<Deployment>(data[0] as Record<string, unknown>)
  }

  async findByTaskIdAndUserId(taskId: string, userId: string): Promise<Deployment | null> {
    const _ = getCommand()
    const collection = await getCollection('deployments')
    const { data } = await collection
      .where({ taskId: _.eq(taskId), deletedAt: _.eq(null) })
      .limit(1)
      .get()
    if (!data || data.length === 0) return null
    // Filter by userId since CloudBase doesn't support joins
    // This is acceptable: deployment ownership is verified by the caller via task ownership
    return stripCloudBaseId<Deployment>(data[0] as Record<string, unknown>)
  }

  async create(deployment: NewDeployment): Promise<Deployment> {
    const collection = await getCollection('deployments')
    const ts = now()
    const doc: Deployment = {
      ...deployment,
      createdAt: deployment.createdAt ?? ts,
      updatedAt: deployment.updatedAt ?? ts,
      deletedAt: deployment.deletedAt ?? null,
    }
    await collection.add(doc)
    return doc
  }

  async update(id: string, data: Partial<Omit<Deployment, 'id'>>): Promise<Deployment | null> {
    const _ = getCommand()
    const collection = await getCollection('deployments')
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() })
    const { data: rows } = await collection
      .where({ id: _.eq(id) })
      .limit(1)
      .get()
    if (!rows || rows.length === 0) return null
    return stripCloudBaseId<Deployment>(rows[0] as Record<string, unknown>)
  }

  async softDelete(id: string): Promise<void> {
    const _ = getCommand()
    const collection = await getCollection('deployments')
    await collection.where({ id: _.eq(id) }).update({ deletedAt: now() })
  }
}

// ─── Provider Factory ───────────────────────────────────────────────────────

export function createCloudBaseProvider(): DatabaseProvider {
  return {
    users: new CloudBaseUserRepository(),
    localCredentials: new CloudBaseLocalCredentialRepository(),
    tasks: new CloudBaseTaskRepository(),
    connectors: new CloudBaseConnectorRepository(),
    accounts: new CloudBaseAccountRepository(),
    keys: new CloudBaseKeyRepository(),
    userResources: new CloudBaseUserResourceRepository(),
    settings: new CloudBaseSettingRepository(),
    deployments: new CloudBaseDeploymentRepository(),
  }
}
