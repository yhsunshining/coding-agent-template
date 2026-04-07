import { eq, and, isNull, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { drizzleDb } from './client'
import {
  users,
  localCredentials,
  tasks,
  connectors,
  accounts,
  keys,
  userResources,
  settings,
  deployments,
} from '../schema'
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

// ─── User Repository ────────────────────────────────────────────────────────

class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await drizzleDb.select().from(users).where(eq(users.id, id)).limit(1)
    return (row as User) ?? null
  }

  async findByProviderAndExternalId(provider: string, externalId: string): Promise<User | null> {
    const [row] = await drizzleDb
      .select()
      .from(users)
      .where(and(eq(users.provider, provider), eq(users.externalId, externalId)))
      .limit(1)
    return (row as User) ?? null
  }

  async create(user: NewUser): Promise<User> {
    const ts = now()
    const values = {
      ...user,
      createdAt: user.createdAt ?? ts,
      updatedAt: user.updatedAt ?? ts,
      lastLoginAt: user.lastLoginAt ?? ts,
    }
    await drizzleDb.insert(users).values(values)
    return values as User
  }

  async update(id: string, data: Partial<Omit<User, 'id'>>): Promise<User | null> {
    await drizzleDb
      .update(users)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(eq(users.id, id))
    return this.findById(id)
  }

  async deleteById(id: string): Promise<void> {
    await drizzleDb.delete(users).where(eq(users.id, id))
  }
}

// ─── LocalCredential Repository ─────────────────────────────────────────────

class DrizzleLocalCredentialRepository implements LocalCredentialRepository {
  async findByUserId(userId: string): Promise<LocalCredential | null> {
    const [row] = await drizzleDb.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1)
    return (row as LocalCredential) ?? null
  }

  async create(credential: NewLocalCredential): Promise<LocalCredential> {
    const ts = now()
    const values = {
      ...credential,
      createdAt: credential.createdAt ?? ts,
      updatedAt: credential.updatedAt ?? ts,
    }
    await drizzleDb.insert(localCredentials).values(values)
    return values as LocalCredential
  }
}

// ─── Task Repository ────────────────────────────────────────────────────────

class DrizzleTaskRepository implements TaskRepository {
  async findById(id: string): Promise<Task | null> {
    const [row] = await drizzleDb.select().from(tasks).where(eq(tasks.id, id)).limit(1)
    return (row as unknown as Task) ?? null
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Task | null> {
    const [row] = await drizzleDb
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
      .limit(1)
    return (row as unknown as Task) ?? null
  }

  async findByUserId(userId: string): Promise<Task[]> {
    const rows = await drizzleDb
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
      .orderBy(desc(tasks.createdAt))
    return rows as unknown as Task[]
  }

  async findByRepoAndPr(userId: string, prNumber: number, repoUrl: string): Promise<Task[]> {
    const rows = await drizzleDb
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.prNumber, prNumber),
          eq(tasks.repoUrl, repoUrl),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1)
    return rows as unknown as Task[]
  }

  async create(task: NewTask): Promise<Task> {
    const ts = now()
    const values = {
      ...task,
      createdAt: task.createdAt ?? ts,
      updatedAt: task.updatedAt ?? ts,
    }
    await drizzleDb.insert(tasks).values(values)
    const [row] = await drizzleDb.select().from(tasks).where(eq(tasks.id, task.id)).limit(1)
    return row as unknown as Task
  }

  async update(id: string, data: Partial<Omit<Task, 'id'>>): Promise<Task | null> {
    await drizzleDb
      .update(tasks)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(eq(tasks.id, id))
    return this.findById(id)
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    await drizzleDb.update(tasks).set({ userId: toUserId }).where(eq(tasks.userId, fromUserId))
  }

  async softDelete(id: string): Promise<void> {
    await drizzleDb.update(tasks).set({ deletedAt: now() }).where(eq(tasks.id, id))
  }
}

// ─── Connector Repository ───────────────────────────────────────────────────

class DrizzleConnectorRepository implements ConnectorRepository {
  async findByUserId(userId: string): Promise<Connector[]> {
    const rows = await drizzleDb.select().from(connectors).where(eq(connectors.userId, userId))
    return rows as Connector[]
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Connector | null> {
    const [row] = await drizzleDb
      .select()
      .from(connectors)
      .where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
      .limit(1)
    return (row as Connector) ?? null
  }

  async create(connector: NewConnector): Promise<Connector> {
    const ts = now()
    const values = {
      ...connector,
      createdAt: connector.createdAt ?? ts,
      updatedAt: connector.updatedAt ?? ts,
    }
    await drizzleDb.insert(connectors).values(values)
    return values as Connector
  }

  async update(id: string, userId: string, data: Partial<Omit<Connector, 'id' | 'userId'>>): Promise<Connector | null> {
    await drizzleDb
      .update(connectors)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
    return this.findByIdAndUserId(id, userId)
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    await drizzleDb.update(connectors).set({ userId: toUserId }).where(eq(connectors.userId, fromUserId))
  }

  async delete(id: string, userId: string): Promise<void> {
    await drizzleDb.delete(connectors).where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
  }
}

// ─── Account Repository ─────────────────────────────────────────────────────

class DrizzleAccountRepository implements AccountRepository {
  async findByUserIdAndProvider(userId: string, provider: string): Promise<Account | null> {
    const [row] = await drizzleDb
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
      .limit(1)
    return (row as Account) ?? null
  }

  async findByProviderAndExternalUserId(provider: string, externalUserId: string): Promise<Account | null> {
    const [row] = await drizzleDb
      .select()
      .from(accounts)
      .where(and(eq(accounts.provider, provider), eq(accounts.externalUserId, externalUserId)))
      .limit(1)
    return (row as Account) ?? null
  }

  async create(account: NewAccount): Promise<Account> {
    const ts = now()
    const values = {
      ...account,
      createdAt: account.createdAt ?? ts,
      updatedAt: account.updatedAt ?? ts,
    }
    await drizzleDb.insert(accounts).values(values)
    return values as Account
  }

  async update(id: string, data: Partial<Omit<Account, 'id'>>): Promise<Account | null> {
    await drizzleDb
      .update(accounts)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(eq(accounts.id, id))
    const [row] = await drizzleDb.select().from(accounts).where(eq(accounts.id, id)).limit(1)
    return (row as Account) ?? null
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    await drizzleDb.update(accounts).set({ userId: toUserId }).where(eq(accounts.userId, fromUserId))
  }

  async delete(userId: string, provider: string): Promise<void> {
    await drizzleDb.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
  }
}

// ─── Key Repository ─────────────────────────────────────────────────────────

class DrizzleKeyRepository implements KeyRepository {
  async findByUserId(userId: string): Promise<Key[]> {
    const rows = await drizzleDb.select().from(keys).where(eq(keys.userId, userId))
    return rows as Key[]
  }

  async findByUserIdAndProvider(userId: string, provider: string): Promise<Key | null> {
    const [row] = await drizzleDb
      .select()
      .from(keys)
      .where(and(eq(keys.userId, userId), eq(keys.provider, provider)))
      .limit(1)
    return (row as Key) ?? null
  }

  async upsert(key: NewKey): Promise<Key> {
    const ts = now()
    const existing = await this.findByUserIdAndProvider(key.userId, key.provider)
    if (existing) {
      await drizzleDb
        .update(keys)
        .set({ value: key.value, updatedAt: ts })
        .where(and(eq(keys.userId, key.userId), eq(keys.provider, key.provider)))
      return { ...existing, value: key.value, updatedAt: ts }
    }
    const values = {
      ...key,
      id: key.id || nanoid(),
      createdAt: key.createdAt ?? ts,
      updatedAt: key.updatedAt ?? ts,
    }
    await drizzleDb.insert(keys).values(values)
    return values as Key
  }

  async updateUserId(fromUserId: string, toUserId: string): Promise<void> {
    await drizzleDb.update(keys).set({ userId: toUserId }).where(eq(keys.userId, fromUserId))
  }

  async delete(userId: string, provider: string): Promise<void> {
    await drizzleDb.delete(keys).where(and(eq(keys.userId, userId), eq(keys.provider, provider)))
  }
}

// ─── UserResource Repository ────────────────────────────────────────────────

class DrizzleUserResourceRepository implements UserResourceRepository {
  async findByUserId(userId: string): Promise<UserResource | null> {
    const [row] = await drizzleDb.select().from(userResources).where(eq(userResources.userId, userId)).limit(1)
    return (row as UserResource) ?? null
  }

  async create(resource: NewUserResource): Promise<UserResource> {
    const ts = now()
    const values = {
      ...resource,
      createdAt: resource.createdAt ?? ts,
      updatedAt: resource.updatedAt ?? ts,
    }
    await drizzleDb.insert(userResources).values(values)
    return values as UserResource
  }

  async update(id: string, data: Partial<Omit<UserResource, 'id'>>): Promise<UserResource | null> {
    await drizzleDb
      .update(userResources)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(eq(userResources.id, id))
    const [row] = await drizzleDb.select().from(userResources).where(eq(userResources.id, id)).limit(1)
    return (row as UserResource) ?? null
  }
}

// ─── Setting Repository ─────────────────────────────────────────────────────

class DrizzleSettingRepository implements SettingRepository {
  async findByUserIdAndKey(userId: string, key: string): Promise<Setting | null> {
    const [row] = await drizzleDb
      .select()
      .from(settings)
      .where(and(eq(settings.userId, userId), eq(settings.key, key)))
      .limit(1)
    return (row as Setting) ?? null
  }

  async findByUserId(userId: string): Promise<Setting[]> {
    const rows = await drizzleDb.select().from(settings).where(eq(settings.userId, userId))
    return rows as Setting[]
  }

  async upsert(setting: NewSetting): Promise<Setting> {
    const ts = now()
    const existing = await this.findByUserIdAndKey(setting.userId, setting.key)
    if (existing) {
      await drizzleDb
        .update(settings)
        .set({ value: setting.value, updatedAt: ts })
        .where(and(eq(settings.userId, setting.userId), eq(settings.key, setting.key)))
      return { ...existing, value: setting.value, updatedAt: ts }
    }
    const values = {
      ...setting,
      id: setting.id || nanoid(),
      createdAt: setting.createdAt ?? ts,
      updatedAt: setting.updatedAt ?? ts,
    }
    await drizzleDb.insert(settings).values(values)
    return values as Setting
  }
}

// ─── Deployment Repository ──────────────────────────────────────────────────

class DrizzleDeploymentRepository implements DeploymentRepository {
  async findByTaskId(taskId: string): Promise<Deployment[]> {
    const rows = await drizzleDb
      .select()
      .from(deployments)
      .where(and(eq(deployments.taskId, taskId), isNull(deployments.deletedAt)))
    return rows as Deployment[]
  }

  async findByTaskIdAndTypePath(taskId: string, type: string, path: string | null): Promise<Deployment | null> {
    const conditions = [eq(deployments.taskId, taskId), eq(deployments.type, type), isNull(deployments.deletedAt)]
    if (path !== null) {
      conditions.push(eq(deployments.path, path))
    } else {
      conditions.push(isNull(deployments.path))
    }
    const [row] = await drizzleDb
      .select()
      .from(deployments)
      .where(and(...conditions))
      .limit(1)
    return (row as Deployment) ?? null
  }

  async findByTaskIdAndUserId(taskId: string, userId: string): Promise<Deployment | null> {
    const [row] = await drizzleDb
      .select()
      .from(deployments)
      .innerJoin(tasks, eq(deployments.taskId, tasks.id))
      .where(and(eq(deployments.taskId, taskId), eq(tasks.userId, userId), isNull(deployments.deletedAt)))
      .limit(1)
    return row ? (row.deployments as Deployment) : null
  }

  async create(deployment: NewDeployment): Promise<Deployment> {
    const ts = now()
    const values = {
      ...deployment,
      createdAt: deployment.createdAt ?? ts,
      updatedAt: deployment.updatedAt ?? ts,
    }
    await drizzleDb.insert(deployments).values(values)
    return values as Deployment
  }

  async update(id: string, data: Partial<Omit<Deployment, 'id'>>): Promise<Deployment | null> {
    await drizzleDb
      .update(deployments)
      .set({ ...data, updatedAt: data.updatedAt ?? now() })
      .where(eq(deployments.id, id))
    const [row] = await drizzleDb.select().from(deployments).where(eq(deployments.id, id)).limit(1)
    return (row as Deployment) ?? null
  }

  async softDelete(id: string): Promise<void> {
    await drizzleDb.update(deployments).set({ deletedAt: now() }).where(eq(deployments.id, id))
  }
}

// ─── Provider Factory ───────────────────────────────────────────────────────

export function createDrizzleProvider(): DatabaseProvider {
  return {
    users: new DrizzleUserRepository(),
    localCredentials: new DrizzleLocalCredentialRepository(),
    tasks: new DrizzleTaskRepository(),
    connectors: new DrizzleConnectorRepository(),
    accounts: new DrizzleAccountRepository(),
    keys: new DrizzleKeyRepository(),
    userResources: new DrizzleUserResourceRepository(),
    settings: new DrizzleSettingRepository(),
    deployments: new DrizzleDeploymentRepository(),
  }
}
