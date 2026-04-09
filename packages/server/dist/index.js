var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  adminLogs: () => adminLogs,
  connectors: () => connectors,
  deployments: () => deployments,
  keys: () => keys,
  localCredentials: () => localCredentials,
  miniprogramApps: () => miniprogramApps,
  settings: () => settings,
  tasks: () => tasks,
  userResources: () => userResources,
  users: () => users
});
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
var now2, users, localCredentials, tasks, connectors, miniprogramApps, accounts, keys, userResources, settings, deployments, adminLogs;
var init_schema = __esm({
  "src/db/schema.ts"() {
    "use strict";
    now2 = () => Date.now();
    users = sqliteTable(
      "users",
      {
        id: text("id").primaryKey(),
        provider: text("provider").notNull(),
        // 'github' | 'local'
        externalId: text("external_id").notNull(),
        accessToken: text("access_token").notNull().default(""),
        refreshToken: text("refresh_token"),
        scope: text("scope"),
        username: text("username").notNull(),
        email: text("email"),
        name: text("name"),
        avatarUrl: text("avatar_url"),
        // Role and status fields for admin system
        role: text("role").notNull().default("user"),
        // 'user' | 'admin'
        status: text("status").notNull().default("active"),
        // 'active' | 'disabled'
        disabledReason: text("disabled_reason"),
        disabledAt: integer("disabled_at"),
        disabledBy: text("disabled_by"),
        // Admin user ID who disabled this user
        createdAt: integer("created_at").notNull().$defaultFn(now2),
        updatedAt: integer("updated_at").notNull().$defaultFn(now2),
        lastLoginAt: integer("last_login_at").notNull().$defaultFn(now2)
      },
      (table) => ({
        providerExternalIdUnique: uniqueIndex("users_provider_external_id_idx").on(table.provider, table.externalId)
      })
    );
    localCredentials = sqliteTable("local_credentials", {
      userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
      passwordHash: text("password_hash").notNull(),
      createdAt: integer("created_at").notNull().$defaultFn(now2),
      updatedAt: integer("updated_at").notNull().$defaultFn(now2)
    });
    tasks = sqliteTable("tasks", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      prompt: text("prompt").notNull(),
      title: text("title"),
      repoUrl: text("repo_url"),
      selectedAgent: text("selected_agent").default("claude"),
      selectedModel: text("selected_model"),
      installDependencies: integer("install_dependencies", { mode: "boolean" }).default(false),
      maxDuration: integer("max_duration").default(parseInt(process.env.MAX_SANDBOX_DURATION || "300", 10)),
      keepAlive: integer("keep_alive", { mode: "boolean" }).default(false),
      enableBrowser: integer("enable_browser", { mode: "boolean" }).default(false),
      status: text("status").notNull().default("pending"),
      progress: integer("progress").default(0),
      logs: text("logs"),
      // JSON string of LogEntry[]
      error: text("error"),
      branchName: text("branch_name"),
      sandboxId: text("sandbox_id"),
      agentSessionId: text("agent_session_id"),
      sandboxUrl: text("sandbox_url"),
      previewUrl: text("preview_url"),
      prUrl: text("pr_url"),
      prNumber: integer("pr_number"),
      prStatus: text("pr_status"),
      prMergeCommitSha: text("pr_merge_commit_sha"),
      mcpServerIds: text("mcp_server_ids"),
      // JSON string of string[]
      createdAt: integer("created_at").notNull().$defaultFn(now2),
      updatedAt: integer("updated_at").notNull().$defaultFn(now2),
      completedAt: integer("completed_at"),
      deletedAt: integer("deleted_at")
    });
    connectors = sqliteTable("connectors", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      type: text("type").notNull().default("remote"),
      // 'local' | 'remote'
      baseUrl: text("base_url"),
      oauthClientId: text("oauth_client_id"),
      oauthClientSecret: text("oauth_client_secret"),
      command: text("command"),
      env: text("env"),
      status: text("status").notNull().default("disconnected"),
      // 'connected' | 'disconnected'
      createdAt: integer("created_at").notNull().$defaultFn(now2),
      updatedAt: integer("updated_at").notNull().$defaultFn(now2)
    });
    miniprogramApps = sqliteTable("miniprogram_apps", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      appId: text("app_id").notNull(),
      privateKey: text("private_key").notNull(),
      // stored encrypted via lib/crypto
      description: text("description"),
      createdAt: integer("created_at").notNull().$defaultFn(now2),
      updatedAt: integer("updated_at").notNull().$defaultFn(now2)
    });
    accounts = sqliteTable(
      "accounts",
      {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        provider: text("provider").notNull().default("github"),
        // 'github'
        externalUserId: text("external_user_id").notNull(),
        accessToken: text("access_token").notNull(),
        refreshToken: text("refresh_token"),
        expiresAt: integer("expires_at"),
        scope: text("scope"),
        username: text("username").notNull(),
        createdAt: integer("created_at").notNull().$defaultFn(now2),
        updatedAt: integer("updated_at").notNull().$defaultFn(now2)
      },
      (table) => ({
        userIdProviderUnique: uniqueIndex("accounts_user_id_provider_idx").on(table.userId, table.provider)
      })
    );
    keys = sqliteTable(
      "keys",
      {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        provider: text("provider").notNull(),
        // 'anthropic' | 'openai' | 'cursor' | 'gemini' | 'aigateway'
        value: text("value").notNull(),
        createdAt: integer("created_at").notNull().$defaultFn(now2),
        updatedAt: integer("updated_at").notNull().$defaultFn(now2)
      },
      (table) => ({
        userIdProviderUnique: uniqueIndex("keys_user_id_provider_idx").on(table.userId, table.provider)
      })
    );
    userResources = sqliteTable("user_resources", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      status: text("status").notNull().default("pending"),
      envId: text("env_id"),
      camUsername: text("cam_username"),
      camSecretId: text("cam_secret_id"),
      camSecretKey: text("cam_secret_key"),
      policyId: integer("policy_id"),
      failStep: text("fail_step"),
      failReason: text("fail_reason"),
      createdAt: integer("created_at").notNull().$defaultFn(now2),
      updatedAt: integer("updated_at").notNull().$defaultFn(now2)
    });
    settings = sqliteTable(
      "settings",
      {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        key: text("key").notNull(),
        value: text("value").notNull(),
        createdAt: integer("created_at").notNull().$defaultFn(now2),
        updatedAt: integer("updated_at").notNull().$defaultFn(now2)
      },
      (table) => ({
        userIdKeyUnique: uniqueIndex("settings_user_id_key_idx").on(table.userId, table.key)
      })
    );
    deployments = sqliteTable(
      "deployments",
      {
        id: text("id").primaryKey(),
        taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        // 'web' | 'miniprogram'
        // For web deployments
        url: text("url"),
        path: text("path"),
        // Extracted URL path for deduplication
        // For miniprogram deployments
        qrCodeUrl: text("qr_code_url"),
        pagePath: text("page_path"),
        appId: text("app_id"),
        // Metadata
        label: text("label"),
        // Optional display name
        metadata: text("metadata"),
        // JSON string for additional fields
        createdAt: integer("created_at").notNull().$defaultFn(now2),
        updatedAt: integer("updated_at").notNull().$defaultFn(now2),
        deletedAt: integer("deleted_at")
      },
      (table) => ({
        // Indexes for faster queries (deduplication handled in application logic)
        taskIdIdx: index("deployments_task_id_idx").on(table.taskId),
        taskTypePathIdx: index("deployments_task_type_path_idx").on(table.taskId, table.type, table.path)
      })
    );
    adminLogs = sqliteTable(
      "admin_logs",
      {
        id: text("id").primaryKey(),
        adminUserId: text("admin_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        action: text("action").notNull(),
        // 'user_disable' | 'user_enable' | 'user_role_change' | 'password_reset' | ...
        targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
        details: text("details"),
        // JSON string
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        createdAt: integer("created_at").notNull().$defaultFn(now2)
      },
      (table) => ({
        adminUserIdIdx: index("admin_logs_admin_user_id_idx").on(table.adminUserId),
        targetUserIdIdx: index("admin_logs_target_user_id_idx").on(table.targetUserId),
        actionIdx: index("admin_logs_action_idx").on(table.action),
        createdAtIdx: index("admin_logs_created_at_idx").on(table.createdAt)
      })
    );
  }
});

// src/db/drizzle/client.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";
var DB_PATH, sqlite, drizzleDb;
var init_client = __esm({
  "src/db/drizzle/client.ts"() {
    "use strict";
    init_schema();
    DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    drizzleDb = drizzle(sqlite, { schema: schema_exports });
  }
});

// src/db/drizzle/repositories.ts
var repositories_exports = {};
__export(repositories_exports, {
  createDrizzleProvider: () => createDrizzleProvider
});
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { nanoid as nanoid2 } from "nanoid";
function createDrizzleProvider() {
  return {
    users: new DrizzleUserRepository(),
    localCredentials: new DrizzleLocalCredentialRepository(),
    tasks: new DrizzleTaskRepository(),
    connectors: new DrizzleConnectorRepository(),
    miniprogramApps: new DrizzleMiniProgramAppRepository(),
    accounts: new DrizzleAccountRepository(),
    keys: new DrizzleKeyRepository(),
    userResources: new DrizzleUserResourceRepository(),
    settings: new DrizzleSettingRepository(),
    deployments: new DrizzleDeploymentRepository(),
    adminLogs: new DrizzleAdminLogRepository()
  };
}
var now3, DrizzleUserRepository, DrizzleLocalCredentialRepository, DrizzleTaskRepository, DrizzleConnectorRepository, DrizzleMiniProgramAppRepository, DrizzleAccountRepository, DrizzleKeyRepository, DrizzleUserResourceRepository, DrizzleSettingRepository, DrizzleDeploymentRepository, DrizzleAdminLogRepository;
var init_repositories = __esm({
  "src/db/drizzle/repositories.ts"() {
    "use strict";
    init_client();
    init_schema();
    now3 = () => Date.now();
    DrizzleUserRepository = class {
      async findById(id) {
        const [row] = await drizzleDb.select().from(users).where(eq(users.id, id)).limit(1);
        return row ?? null;
      }
      async findByProviderAndExternalId(provider, externalId) {
        const [row] = await drizzleDb.select().from(users).where(and(eq(users.provider, provider), eq(users.externalId, externalId))).limit(1);
        return row ?? null;
      }
      async create(user) {
        const ts = now3();
        const values = {
          ...user,
          createdAt: user.createdAt ?? ts,
          updatedAt: user.updatedAt ?? ts,
          lastLoginAt: user.lastLoginAt ?? ts
        };
        await drizzleDb.insert(users).values(values);
        return values;
      }
      async update(id, data) {
        await drizzleDb.update(users).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(users.id, id));
        return this.findById(id);
      }
      async deleteById(id) {
        await drizzleDb.delete(users).where(eq(users.id, id));
      }
      // Admin methods
      async findAll(limit = 20, offset = 0) {
        const rows = await drizzleDb.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
        return rows;
      }
      async count() {
        const [result] = await drizzleDb.select({ count: users.id }).from(users);
        return result ? 1 : 0;
      }
      async updateRole(id, role) {
        await drizzleDb.update(users).set({ role, updatedAt: now3() }).where(eq(users.id, id));
        return this.findById(id);
      }
      async disable(id, reason, adminUserId) {
        await drizzleDb.update(users).set({
          status: "disabled",
          disabledReason: reason,
          disabledAt: now3(),
          disabledBy: adminUserId,
          updatedAt: now3()
        }).where(eq(users.id, id));
        return this.findById(id);
      }
      async enable(id) {
        await drizzleDb.update(users).set({
          status: "active",
          disabledReason: null,
          disabledAt: null,
          disabledBy: null,
          updatedAt: now3()
        }).where(eq(users.id, id));
        return this.findById(id);
      }
    };
    DrizzleLocalCredentialRepository = class {
      async findByUserId(userId) {
        const [row] = await drizzleDb.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1);
        return row ?? null;
      }
      async create(credential) {
        const ts = now3();
        const values = {
          ...credential,
          createdAt: credential.createdAt ?? ts,
          updatedAt: credential.updatedAt ?? ts
        };
        await drizzleDb.insert(localCredentials).values(values);
        return values;
      }
      async update(userId, data) {
        await drizzleDb.update(localCredentials).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(localCredentials.userId, userId));
        return this.findByUserId(userId);
      }
    };
    DrizzleTaskRepository = class {
      async findById(id) {
        const [row] = await drizzleDb.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        return row ?? null;
      }
      async findByIdAndUserId(id, userId) {
        const [row] = await drizzleDb.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt))).limit(1);
        return row ?? null;
      }
      async findByUserId(userId) {
        const rows = await drizzleDb.select().from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt))).orderBy(desc(tasks.createdAt));
        return rows;
      }
      async findByRepoAndPr(userId, prNumber, repoUrl) {
        const rows = await drizzleDb.select().from(tasks).where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.prNumber, prNumber),
            eq(tasks.repoUrl, repoUrl),
            isNull(tasks.deletedAt)
          )
        ).limit(1);
        return rows;
      }
      async findAll(limit, offset, filters) {
        const conditions = [isNull(tasks.deletedAt)];
        if (filters?.userId) conditions.push(eq(tasks.userId, filters.userId));
        if (filters?.status) conditions.push(eq(tasks.status, filters.status));
        const rows = await drizzleDb.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset);
        return rows;
      }
      async count(filters) {
        const conditions = [isNull(tasks.deletedAt)];
        if (filters?.userId) conditions.push(eq(tasks.userId, filters.userId));
        if (filters?.status) conditions.push(eq(tasks.status, filters.status));
        const rows = await drizzleDb.select({ count: sql`count(*)` }).from(tasks).where(and(...conditions));
        return Number(rows[0]?.count ?? 0);
      }
      async create(task) {
        const ts = now3();
        const values = {
          ...task,
          createdAt: task.createdAt ?? ts,
          updatedAt: task.updatedAt ?? ts
        };
        await drizzleDb.insert(tasks).values(values);
        const [row] = await drizzleDb.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
        return row;
      }
      async update(id, data) {
        await drizzleDb.update(tasks).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(tasks.id, id));
        return this.findById(id);
      }
      async updateUserId(fromUserId, toUserId) {
        await drizzleDb.update(tasks).set({ userId: toUserId }).where(eq(tasks.userId, fromUserId));
      }
      async softDelete(id) {
        await drizzleDb.update(tasks).set({ deletedAt: now3() }).where(eq(tasks.id, id));
      }
    };
    DrizzleConnectorRepository = class {
      async findByUserId(userId) {
        const rows = await drizzleDb.select().from(connectors).where(eq(connectors.userId, userId));
        return rows;
      }
      async findByIdAndUserId(id, userId) {
        const [row] = await drizzleDb.select().from(connectors).where(and(eq(connectors.id, id), eq(connectors.userId, userId))).limit(1);
        return row ?? null;
      }
      async create(connector) {
        const ts = now3();
        const values = {
          ...connector,
          createdAt: connector.createdAt ?? ts,
          updatedAt: connector.updatedAt ?? ts
        };
        await drizzleDb.insert(connectors).values(values);
        return values;
      }
      async update(id, userId, data) {
        await drizzleDb.update(connectors).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(and(eq(connectors.id, id), eq(connectors.userId, userId)));
        return this.findByIdAndUserId(id, userId);
      }
      async updateUserId(fromUserId, toUserId) {
        await drizzleDb.update(connectors).set({ userId: toUserId }).where(eq(connectors.userId, fromUserId));
      }
      async delete(id, userId) {
        await drizzleDb.delete(connectors).where(and(eq(connectors.id, id), eq(connectors.userId, userId)));
      }
    };
    DrizzleMiniProgramAppRepository = class {
      async findByUserId(userId) {
        const rows = await drizzleDb.select().from(miniprogramApps).where(eq(miniprogramApps.userId, userId));
        return rows;
      }
      async findByIdAndUserId(id, userId) {
        const [row] = await drizzleDb.select().from(miniprogramApps).where(and(eq(miniprogramApps.id, id), eq(miniprogramApps.userId, userId))).limit(1);
        return row ?? null;
      }
      async findByAppIdAndUserId(appId, userId) {
        const [row] = await drizzleDb.select().from(miniprogramApps).where(and(eq(miniprogramApps.appId, appId), eq(miniprogramApps.userId, userId))).limit(1);
        return row ?? null;
      }
      async create(app8) {
        const ts = now3();
        const values = {
          ...app8,
          createdAt: app8.createdAt ?? ts,
          updatedAt: app8.updatedAt ?? ts
        };
        await drizzleDb.insert(miniprogramApps).values(values);
        return values;
      }
      async update(id, userId, data) {
        await drizzleDb.update(miniprogramApps).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(and(eq(miniprogramApps.id, id), eq(miniprogramApps.userId, userId)));
        return this.findByIdAndUserId(id, userId);
      }
      async updateUserId(fromUserId, toUserId) {
        await drizzleDb.update(miniprogramApps).set({ userId: toUserId }).where(eq(miniprogramApps.userId, fromUserId));
      }
      async delete(id, userId) {
        await drizzleDb.delete(miniprogramApps).where(and(eq(miniprogramApps.id, id), eq(miniprogramApps.userId, userId)));
      }
    };
    DrizzleAccountRepository = class {
      async findByUserIdAndProvider(userId, provider) {
        const [row] = await drizzleDb.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider))).limit(1);
        return row ?? null;
      }
      async findByProviderAndExternalUserId(provider, externalUserId) {
        const [row] = await drizzleDb.select().from(accounts).where(and(eq(accounts.provider, provider), eq(accounts.externalUserId, externalUserId))).limit(1);
        return row ?? null;
      }
      async create(account) {
        const ts = now3();
        const values = {
          ...account,
          createdAt: account.createdAt ?? ts,
          updatedAt: account.updatedAt ?? ts
        };
        await drizzleDb.insert(accounts).values(values);
        return values;
      }
      async update(id, data) {
        await drizzleDb.update(accounts).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(accounts.id, id));
        const [row] = await drizzleDb.select().from(accounts).where(eq(accounts.id, id)).limit(1);
        return row ?? null;
      }
      async updateUserId(fromUserId, toUserId) {
        await drizzleDb.update(accounts).set({ userId: toUserId }).where(eq(accounts.userId, fromUserId));
      }
      async delete(userId, provider) {
        await drizzleDb.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
      }
    };
    DrizzleKeyRepository = class {
      async findByUserId(userId) {
        const rows = await drizzleDb.select().from(keys).where(eq(keys.userId, userId));
        return rows;
      }
      async findByUserIdAndProvider(userId, provider) {
        const [row] = await drizzleDb.select().from(keys).where(and(eq(keys.userId, userId), eq(keys.provider, provider))).limit(1);
        return row ?? null;
      }
      async upsert(key) {
        const ts = now3();
        const existing = await this.findByUserIdAndProvider(key.userId, key.provider);
        if (existing) {
          await drizzleDb.update(keys).set({ value: key.value, updatedAt: ts }).where(and(eq(keys.userId, key.userId), eq(keys.provider, key.provider)));
          return { ...existing, value: key.value, updatedAt: ts };
        }
        const values = {
          ...key,
          id: key.id || nanoid2(),
          createdAt: key.createdAt ?? ts,
          updatedAt: key.updatedAt ?? ts
        };
        await drizzleDb.insert(keys).values(values);
        return values;
      }
      async updateUserId(fromUserId, toUserId) {
        await drizzleDb.update(keys).set({ userId: toUserId }).where(eq(keys.userId, fromUserId));
      }
      async delete(userId, provider) {
        await drizzleDb.delete(keys).where(and(eq(keys.userId, userId), eq(keys.provider, provider)));
      }
    };
    DrizzleUserResourceRepository = class {
      async findByUserId(userId) {
        const [row] = await drizzleDb.select().from(userResources).where(eq(userResources.userId, userId)).limit(1);
        return row ?? null;
      }
      async create(resource) {
        const ts = now3();
        const values = {
          ...resource,
          createdAt: resource.createdAt ?? ts,
          updatedAt: resource.updatedAt ?? ts
        };
        await drizzleDb.insert(userResources).values(values);
        return values;
      }
      async update(id, data) {
        await drizzleDb.update(userResources).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(userResources.id, id));
        const [row] = await drizzleDb.select().from(userResources).where(eq(userResources.id, id)).limit(1);
        return row ?? null;
      }
    };
    DrizzleSettingRepository = class {
      async findByUserIdAndKey(userId, key) {
        const [row] = await drizzleDb.select().from(settings).where(and(eq(settings.userId, userId), eq(settings.key, key))).limit(1);
        return row ?? null;
      }
      async findByUserId(userId) {
        const rows = await drizzleDb.select().from(settings).where(eq(settings.userId, userId));
        return rows;
      }
      async upsert(setting) {
        const ts = now3();
        const existing = await this.findByUserIdAndKey(setting.userId, setting.key);
        if (existing) {
          await drizzleDb.update(settings).set({ value: setting.value, updatedAt: ts }).where(and(eq(settings.userId, setting.userId), eq(settings.key, setting.key)));
          return { ...existing, value: setting.value, updatedAt: ts };
        }
        const values = {
          ...setting,
          id: setting.id || nanoid2(),
          createdAt: setting.createdAt ?? ts,
          updatedAt: setting.updatedAt ?? ts
        };
        await drizzleDb.insert(settings).values(values);
        return values;
      }
    };
    DrizzleDeploymentRepository = class {
      async findByTaskId(taskId) {
        const rows = await drizzleDb.select().from(deployments).where(and(eq(deployments.taskId, taskId), isNull(deployments.deletedAt)));
        return rows;
      }
      async findByTaskIdAndTypePath(taskId, type, path5) {
        const conditions = [eq(deployments.taskId, taskId), eq(deployments.type, type), isNull(deployments.deletedAt)];
        if (path5 !== null) {
          conditions.push(eq(deployments.path, path5));
        } else {
          conditions.push(isNull(deployments.path));
        }
        const [row] = await drizzleDb.select().from(deployments).where(and(...conditions)).limit(1);
        return row ?? null;
      }
      async findByTaskIdAndUserId(taskId, userId) {
        const [row] = await drizzleDb.select().from(deployments).innerJoin(tasks, eq(deployments.taskId, tasks.id)).where(and(eq(deployments.taskId, taskId), eq(tasks.userId, userId), isNull(deployments.deletedAt))).limit(1);
        return row ? row.deployments : null;
      }
      async create(deployment) {
        const ts = now3();
        const values = {
          ...deployment,
          createdAt: deployment.createdAt ?? ts,
          updatedAt: deployment.updatedAt ?? ts
        };
        await drizzleDb.insert(deployments).values(values);
        return values;
      }
      async update(id, data) {
        await drizzleDb.update(deployments).set({ ...data, updatedAt: data.updatedAt ?? now3() }).where(eq(deployments.id, id));
        const [row] = await drizzleDb.select().from(deployments).where(eq(deployments.id, id)).limit(1);
        return row ?? null;
      }
      async softDelete(id) {
        await drizzleDb.update(deployments).set({ deletedAt: now3() }).where(eq(deployments.id, id));
      }
    };
    DrizzleAdminLogRepository = class {
      async create(log) {
        const ts = now3();
        const values = {
          ...log,
          createdAt: log.createdAt ?? ts
        };
        await drizzleDb.insert(adminLogs).values(values);
        return values;
      }
      async findByAdminUserId(adminUserId, limit = 50) {
        const rows = await drizzleDb.select().from(adminLogs).where(eq(adminLogs.adminUserId, adminUserId)).limit(limit).orderBy(desc(adminLogs.createdAt));
        return rows;
      }
      async findByTargetUserId(targetUserId, limit = 50) {
        const rows = await drizzleDb.select().from(adminLogs).where(eq(adminLogs.targetUserId, targetUserId)).limit(limit).orderBy(desc(adminLogs.createdAt));
        return rows;
      }
      async findAll(limit = 50, offset = 0) {
        const rows = await drizzleDb.select().from(adminLogs).limit(limit).offset(offset).orderBy(desc(adminLogs.createdAt));
        return rows;
      }
    };
  }
});

// src/index.ts
import { serve } from "@hono/node-server";
import { Hono as Hono17 } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync as existsSync2 } from "fs";
import { resolve, dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/middleware/auth.ts
import { getCookie } from "hono/cookie";

// src/lib/session.ts
import { EncryptJWT, jwtDecrypt, base64url } from "jose";
async function encryptJWE(payload, expirationTime, secret = process.env.JWE_SECRET) {
  if (!secret) {
    throw new Error("Missing JWE secret");
  }
  return new EncryptJWT(payload).setExpirationTime(expirationTime).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).encrypt(base64url.decode(secret));
}
async function decryptJWE(cyphertext, secret = process.env.JWE_SECRET) {
  if (!secret) {
    throw new Error("Missing JWE secret");
  }
  if (typeof cyphertext !== "string") return;
  try {
    const { payload } = await jwtDecrypt(cyphertext, base64url.decode(secret));
    const decoded = payload;
    if (typeof decoded === "object" && decoded !== null) {
      delete decoded.iat;
      delete decoded.exp;
    }
    return decoded;
  } catch {
  }
}

// src/db/cloudbase/repositories.ts
import { nanoid } from "nanoid";

// src/db/cloudbase/client.ts
import CloudBase from "@cloudbase/node-sdk";
var COLLECTION_PREFIX = process.env.DB_COLLECTION_PREFIX || "vibe_agent_";
var app = null;
function getApp() {
  if (app) return app;
  const envId = process.env.TCB_ENV_ID;
  const region = process.env.TCB_REGION || "ap-shanghai";
  const secretId = process.env.TCB_SECRET_ID;
  const secretKey = process.env.TCB_SECRET_KEY;
  const token = process.env.TCB_TOKEN || void 0;
  if (!envId || !secretId || !secretKey) {
    throw new Error("CloudBase credentials not configured: TCB_ENV_ID, TCB_SECRET_ID, TCB_SECRET_KEY are required");
  }
  app = CloudBase.init({
    env: envId,
    region,
    secretId,
    secretKey,
    ...token ? { sessionToken: token } : {}
  });
  return app;
}
function getDatabase() {
  return getApp().database();
}
function getCommand() {
  return getApp().database().command;
}
var ensuredCollections = /* @__PURE__ */ new Set();
function getCollectionName(name) {
  return `${COLLECTION_PREFIX}${name}`;
}
async function getCollection(name) {
  const db = getDatabase();
  const fullName = getCollectionName(name);
  if (!ensuredCollections.has(fullName)) {
    try {
      await db.createCollection(fullName);
    } catch {
    }
    ensuredCollections.add(fullName);
  }
  return db.collection(fullName);
}

// src/db/cloudbase/repositories.ts
var now = () => Date.now();
function stripCloudBaseId(doc) {
  const { _id, ...rest } = doc;
  return rest;
}
var CloudBaseUserRepository = class {
  async findById(id) {
    const _ = getCommand();
    const collection = await getCollection("users");
    const { data } = await collection.where({ id: _.eq(id) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByProviderAndExternalId(provider, externalId) {
    const _ = getCommand();
    const collection = await getCollection("users");
    const { data } = await collection.where({ provider: _.eq(provider), externalId: _.eq(externalId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(user) {
    const collection = await getCollection("users");
    const ts = now();
    const doc = {
      ...user,
      createdAt: user.createdAt ?? ts,
      updatedAt: user.updatedAt ?? ts,
      lastLoginAt: user.lastLoginAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, data) {
    const _ = getCommand();
    const collection = await getCollection("users");
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    return this.findById(id);
  }
  async deleteById(id) {
    const _ = getCommand();
    const collection = await getCollection("users");
    await collection.where({ id: _.eq(id) }).remove();
  }
  // Admin methods
  async findAll(limit = 20, offset = 0) {
    const collection = await getCollection("users");
    const { data } = await collection.limit(limit).skip(offset).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async count() {
    const collection = await getCollection("users");
    const { total } = await collection.count();
    return total;
  }
  async updateRole(id, role) {
    const _ = getCommand();
    const collection = await getCollection("users");
    await collection.where({ id: _.eq(id) }).update({ role, updatedAt: now() });
    return this.findById(id);
  }
  async disable(id, reason, adminUserId) {
    const _ = getCommand();
    const collection = await getCollection("users");
    await collection.where({ id: _.eq(id) }).update({
      status: "disabled",
      disabledReason: reason,
      disabledAt: now(),
      disabledBy: adminUserId,
      updatedAt: now()
    });
    return this.findById(id);
  }
  async enable(id) {
    const _ = getCommand();
    const collection = await getCollection("users");
    await collection.where({ id: _.eq(id) }).update({
      status: "active",
      disabledReason: null,
      disabledAt: null,
      disabledBy: null,
      updatedAt: now()
    });
    return this.findById(id);
  }
};
var CloudBaseLocalCredentialRepository = class {
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("local_credentials");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(credential) {
    const collection = await getCollection("local_credentials");
    const ts = now();
    const doc = {
      ...credential,
      createdAt: credential.createdAt ?? ts,
      updatedAt: credential.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(userId, data) {
    const _ = getCommand();
    const collection = await getCollection("local_credentials");
    await collection.where({ userId: _.eq(userId) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    return this.findByUserId(userId);
  }
};
var CloudBaseTaskRepository = class {
  async findById(id) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const { data } = await collection.where({ id: _.eq(id) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByIdAndUserId(id, userId) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const { data } = await collection.where({ id: _.eq(id), userId: _.eq(userId), deletedAt: _.eq(null) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const { data } = await collection.where({ userId: _.eq(userId), deletedAt: _.eq(null) }).orderBy("createdAt", "desc").limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByRepoAndPr(userId, prNumber, repoUrl) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const { data } = await collection.where({ userId: _.eq(userId), prNumber: _.eq(prNumber), repoUrl: _.eq(repoUrl), deletedAt: _.eq(null) }).limit(1).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findAll(limit, offset, filters) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const where = { deletedAt: _.eq(null) };
    if (filters?.userId) where.userId = _.eq(filters.userId);
    if (filters?.status) where.status = _.eq(filters.status);
    const { data } = await collection.where(where).orderBy("createdAt", "desc").skip(offset).limit(limit).get();
    if (!data) return [];
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async count(filters) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    const where = { deletedAt: _.eq(null) };
    if (filters?.userId) where.userId = _.eq(filters.userId);
    if (filters?.status) where.status = _.eq(filters.status);
    const { total } = await collection.where(where).count();
    return total;
  }
  async create(task) {
    const collection = await getCollection("tasks");
    const ts = now();
    const doc = {
      ...task,
      createdAt: task.createdAt ?? ts,
      updatedAt: task.updatedAt ?? ts,
      completedAt: task.completedAt ?? null,
      deletedAt: task.deletedAt ?? null
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, data) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    return this.findById(id);
  }
  async updateUserId(fromUserId, toUserId) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId });
  }
  async softDelete(id) {
    const _ = getCommand();
    const collection = await getCollection("tasks");
    await collection.where({ id: _.eq(id) }).update({ deletedAt: now() });
  }
};
var CloudBaseConnectorRepository = class {
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("connectors");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByIdAndUserId(id, userId) {
    const _ = getCommand();
    const collection = await getCollection("connectors");
    const { data } = await collection.where({ id: _.eq(id), userId: _.eq(userId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(connector) {
    const collection = await getCollection("connectors");
    const ts = now();
    const doc = {
      ...connector,
      createdAt: connector.createdAt ?? ts,
      updatedAt: connector.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, userId, data) {
    const _ = getCommand();
    const collection = await getCollection("connectors");
    await collection.where({ id: _.eq(id), userId: _.eq(userId) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    return this.findByIdAndUserId(id, userId);
  }
  async updateUserId(fromUserId, toUserId) {
    const _ = getCommand();
    const collection = await getCollection("connectors");
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId });
  }
  async delete(id, userId) {
    const _ = getCommand();
    const collection = await getCollection("connectors");
    await collection.where({ id: _.eq(id), userId: _.eq(userId) }).remove();
  }
};
var CloudBaseMiniProgramAppRepository = class {
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByIdAndUserId(id, userId) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    const { data } = await collection.where({ id: _.eq(id), userId: _.eq(userId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByAppIdAndUserId(appId, userId) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    const { data } = await collection.where({ appId: _.eq(appId), userId: _.eq(userId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(app8) {
    const collection = await getCollection("miniprogram_apps");
    const ts = now();
    const doc = {
      ...app8,
      createdAt: app8.createdAt ?? ts,
      updatedAt: app8.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, userId, data) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    await collection.where({ id: _.eq(id), userId: _.eq(userId) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    return this.findByIdAndUserId(id, userId);
  }
  async updateUserId(fromUserId, toUserId) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId });
  }
  async delete(id, userId) {
    const _ = getCommand();
    const collection = await getCollection("miniprogram_apps");
    await collection.where({ id: _.eq(id), userId: _.eq(userId) }).remove();
  }
};
var CloudBaseAccountRepository = class {
  async findByUserIdAndProvider(userId, provider) {
    const _ = getCommand();
    const collection = await getCollection("accounts");
    const { data } = await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByProviderAndExternalUserId(provider, externalUserId) {
    const _ = getCommand();
    const collection = await getCollection("accounts");
    const { data } = await collection.where({ provider: _.eq(provider), externalUserId: _.eq(externalUserId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(account) {
    const collection = await getCollection("accounts");
    const ts = now();
    const doc = {
      ...account,
      createdAt: account.createdAt ?? ts,
      updatedAt: account.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, data) {
    const _ = getCommand();
    const collection = await getCollection("accounts");
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    const { data: rows } = await collection.where({ id: _.eq(id) }).limit(1).get();
    if (!rows || rows.length === 0) return null;
    return stripCloudBaseId(rows[0]);
  }
  async updateUserId(fromUserId, toUserId) {
    const _ = getCommand();
    const collection = await getCollection("accounts");
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId });
  }
  async delete(userId, provider) {
    const _ = getCommand();
    const collection = await getCollection("accounts");
    await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).remove();
  }
};
var CloudBaseKeyRepository = class {
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("keys");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByUserIdAndProvider(userId, provider) {
    const _ = getCommand();
    const collection = await getCollection("keys");
    const { data } = await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async upsert(key) {
    const ts = now();
    const existing = await this.findByUserIdAndProvider(key.userId, key.provider);
    if (existing) {
      const _ = getCommand();
      const collection2 = await getCollection("keys");
      await collection2.where({ userId: _.eq(key.userId), provider: _.eq(key.provider) }).update({ value: key.value, updatedAt: ts });
      return { ...existing, value: key.value, updatedAt: ts };
    }
    const collection = await getCollection("keys");
    const doc = {
      ...key,
      id: key.id || nanoid(),
      createdAt: key.createdAt ?? ts,
      updatedAt: key.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async updateUserId(fromUserId, toUserId) {
    const _ = getCommand();
    const collection = await getCollection("keys");
    await collection.where({ userId: _.eq(fromUserId) }).update({ userId: toUserId });
  }
  async delete(userId, provider) {
    const _ = getCommand();
    const collection = await getCollection("keys");
    await collection.where({ userId: _.eq(userId), provider: _.eq(provider) }).remove();
  }
};
var CloudBaseUserResourceRepository = class {
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("user_resources");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(resource) {
    const collection = await getCollection("user_resources");
    const ts = now();
    const doc = {
      ...resource,
      createdAt: resource.createdAt ?? ts,
      updatedAt: resource.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, data) {
    const _ = getCommand();
    const collection = await getCollection("user_resources");
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    const { data: rows } = await collection.where({ id: _.eq(id) }).limit(1).get();
    if (!rows || rows.length === 0) return null;
    return stripCloudBaseId(rows[0]);
  }
};
var CloudBaseSettingRepository = class {
  async findByUserIdAndKey(userId, key) {
    const _ = getCommand();
    const collection = await getCollection("settings");
    const { data } = await collection.where({ userId: _.eq(userId), key: _.eq(key) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByUserId(userId) {
    const _ = getCommand();
    const collection = await getCollection("settings");
    const { data } = await collection.where({ userId: _.eq(userId) }).limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async upsert(setting) {
    const ts = now();
    const existing = await this.findByUserIdAndKey(setting.userId, setting.key);
    if (existing) {
      const _ = getCommand();
      const collection2 = await getCollection("settings");
      await collection2.where({ userId: _.eq(setting.userId), key: _.eq(setting.key) }).update({ value: setting.value, updatedAt: ts });
      return { ...existing, value: setting.value, updatedAt: ts };
    }
    const collection = await getCollection("settings");
    const doc = {
      ...setting,
      id: setting.id || nanoid(),
      createdAt: setting.createdAt ?? ts,
      updatedAt: setting.updatedAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
};
var CloudBaseDeploymentRepository = class {
  async findByTaskId(taskId) {
    const _ = getCommand();
    const collection = await getCollection("deployments");
    const { data } = await collection.where({ taskId: _.eq(taskId), deletedAt: _.eq(null) }).limit(1e3).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByTaskIdAndTypePath(taskId, type, path5) {
    const _ = getCommand();
    const collection = await getCollection("deployments");
    const where = {
      taskId: _.eq(taskId),
      type: _.eq(type),
      deletedAt: _.eq(null)
    };
    if (path5 !== null) {
      where.path = _.eq(path5);
    } else {
      where.path = _.eq(null);
    }
    const { data } = await collection.where(where).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async findByTaskIdAndUserId(taskId, userId) {
    const _ = getCommand();
    const collection = await getCollection("deployments");
    const { data } = await collection.where({ taskId: _.eq(taskId), deletedAt: _.eq(null) }).limit(1).get();
    if (!data || data.length === 0) return null;
    return stripCloudBaseId(data[0]);
  }
  async create(deployment) {
    const collection = await getCollection("deployments");
    const ts = now();
    const doc = {
      ...deployment,
      createdAt: deployment.createdAt ?? ts,
      updatedAt: deployment.updatedAt ?? ts,
      deletedAt: deployment.deletedAt ?? null
    };
    await collection.add(doc);
    return doc;
  }
  async update(id, data) {
    const _ = getCommand();
    const collection = await getCollection("deployments");
    await collection.where({ id: _.eq(id) }).update({ ...data, updatedAt: data.updatedAt ?? now() });
    const { data: rows } = await collection.where({ id: _.eq(id) }).limit(1).get();
    if (!rows || rows.length === 0) return null;
    return stripCloudBaseId(rows[0]);
  }
  async softDelete(id) {
    const _ = getCommand();
    const collection = await getCollection("deployments");
    await collection.where({ id: _.eq(id) }).update({ deletedAt: now() });
  }
};
var CloudBaseAdminLogRepository = class {
  async create(log) {
    const collection = await getCollection("admin_logs");
    const ts = now();
    const doc = {
      ...log,
      createdAt: log.createdAt ?? ts
    };
    await collection.add(doc);
    return doc;
  }
  async findByAdminUserId(adminUserId, limit = 50) {
    const _ = getCommand();
    const collection = await getCollection("admin_logs");
    const { data } = await collection.where({ adminUserId: _.eq(adminUserId) }).limit(limit).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findByTargetUserId(targetUserId, limit = 50) {
    const _ = getCommand();
    const collection = await getCollection("admin_logs");
    const { data } = await collection.where({ targetUserId: _.eq(targetUserId) }).limit(limit).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
  async findAll(limit = 50, offset = 0) {
    const collection = await getCollection("admin_logs");
    const { data } = await collection.limit(limit).skip(offset).get();
    return data.map((doc) => stripCloudBaseId(doc));
  }
};
function createCloudBaseProvider() {
  return {
    users: new CloudBaseUserRepository(),
    localCredentials: new CloudBaseLocalCredentialRepository(),
    tasks: new CloudBaseTaskRepository(),
    connectors: new CloudBaseConnectorRepository(),
    miniprogramApps: new CloudBaseMiniProgramAppRepository(),
    accounts: new CloudBaseAccountRepository(),
    keys: new CloudBaseKeyRepository(),
    userResources: new CloudBaseUserResourceRepository(),
    settings: new CloudBaseSettingRepository(),
    deployments: new CloudBaseDeploymentRepository(),
    adminLogs: new CloudBaseAdminLogRepository()
  };
}

// src/db/index.ts
var _provider = null;
function getDb() {
  if (_provider) return _provider;
  const backend = process.env.DB_PROVIDER || "cloudbase";
  if (backend === "drizzle") {
    const { createDrizzleProvider: createDrizzleProvider2 } = (init_repositories(), __toCommonJS(repositories_exports));
    _provider = createDrizzleProvider2();
  } else {
    _provider = createCloudBaseProvider();
  }
  return _provider;
}

// src/middleware/auth.ts
import CloudBaseManager from "@cloudbase/manager-node";

// src/cloudbase/provision.ts
import tencentcloud from "tencentcloud-sdk-nodejs";
var CamClient = tencentcloud.cam.v20190116.Client;
var TcbClient = tencentcloud.tcb.v20180608.Client;
function buildUserEnvPolicyStatements(envId) {
  return [
    {
      action: [
        "tcb:DescribeEnvs",
        "tcb:DescribePackages",
        "tcb:CheckTcbService",
        "tcb:DescribeBillingInfo",
        "tcb:DescribeEnvLimit",
        "tcb:GetUserKeyList",
        "tcb:DescribeMonitorMetric",
        "tcb:ListTables"
      ],
      effect: "allow",
      resource: ["*"]
    },
    {
      action: ["tcb:*"],
      effect: "allow",
      resource: [`qcs::tcb:::env/${envId}`]
    },
    {
      action: ["cos:*"],
      effect: "allow",
      resource: ["*"]
    },
    {
      action: ["scf:*"],
      effect: "allow",
      resource: ["*"]
    },
    {
      action: ["sts:GetFederationToken"],
      effect: "allow",
      resource: ["*"]
    }
  ];
}
function getClients() {
  const credential = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENT_SECRET_ID || "",
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENT_SECRET_KEY || "",
    token: process.env.TCB_TOKEN || process.env.TENCENTCLOUD_SESSIONTOKEN || ""
  };
  const camClient = new CamClient({
    credential,
    region: "",
    profile: { httpProfile: { endpoint: "cam.tencentcloudapi.com" } }
  });
  const tcbClient = new TcbClient({
    credential,
    region: "ap-shanghai",
    profile: { httpProfile: { endpoint: "tcb.tencentcloudapi.com" } }
  });
  return { camClient, tcbClient };
}
function generatePassword(length = 16) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*()-_=+";
  const all = upper + lower + digits + special;
  const password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];
  for (let i = password.length; i < length; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
}
async function provisionUserResources(userId, username) {
  const { camClient, tcbClient } = getClients();
  const camUsername = `oc_${userId.substring(0, 20)}`;
  let subAccountUin;
  let password;
  try {
    const getUserResp = await camClient.GetUser({ Name: camUsername });
    subAccountUin = getUserResp.Uin;
    password = generatePassword();
    try {
      await camClient.UpdateUser({
        Name: camUsername,
        ConsoleLogin: 1,
        Password: password,
        NeedResetPassword: 0
      });
    } catch {
      password = void 0;
    }
  } catch {
    password = generatePassword();
    const addUserResp = await camClient.AddUser({
      Name: camUsername,
      Remark: `coder user: ${username}`,
      ConsoleLogin: 1,
      Password: password,
      NeedResetPassword: 0,
      UseApi: 0
    });
    subAccountUin = addUserResp.Uin;
  }
  let camSecretId;
  let camSecretKey;
  const listKeysResp = await camClient.ListAccessKeys({ TargetUin: subAccountUin });
  const existingKeys = listKeysResp.AccessKeys || [];
  const activeKey = existingKeys.find((k) => k.Status === "Active");
  if (activeKey) {
    camSecretId = activeKey.AccessKeyId;
  } else {
    const createKeyResp = await camClient.CreateAccessKey({ TargetUin: subAccountUin });
    camSecretId = createKeyResp.AccessKey.AccessKeyId;
    camSecretKey = createKeyResp.AccessKey.SecretAccessKey;
  }
  const envAlias = `coder-${userId.substring(0, 14)}`;
  let envId;
  try {
    const descResp = await tcbClient.DescribeEnvs({});
    const found = (descResp.EnvList || []).find((e) => e.Alias === envAlias);
    if (found) envId = found.EnvId;
  } catch {
  }
  if (!envId) {
    const createEnvResp = await tcbClient.CreateEnv({
      Alias: envAlias,
      PackageId: "baas_personal",
      Resources: ["flexdb", "storage", "function"]
    });
    envId = createEnvResp.EnvId;
  }
  const policyName = `coder_policy_${envId}`;
  let policyId;
  try {
    const listResp = await camClient.ListPolicies({ Keyword: policyName, Scope: "Local" });
    const found = (listResp.List || []).find((p) => p.PolicyName === policyName);
    if (found) policyId = found.PolicyId;
  } catch {
  }
  if (!policyId) {
    const policyDocument = JSON.stringify({
      version: "2.0",
      statement: buildUserEnvPolicyStatements(envId)
    });
    const createPolicyResp = await camClient.CreatePolicy({
      PolicyName: policyName,
      PolicyDocument: policyDocument,
      Description: `Coder env ${envId} access`
    });
    policyId = createPolicyResp.PolicyId;
  }
  await camClient.AttachUserPolicy({
    AttachUin: subAccountUin,
    PolicyId: policyId
  });
  return {
    envId,
    camUsername,
    camSecretId,
    camSecretKey,
    policyId
  };
}

// src/middleware/auth.ts
var SESSION_COOKIE_NAME = "nex_session";
async function authMiddleware(c, next) {
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionCookie) {
    try {
      const session = await decryptJWE(sessionCookie);
      c.set("session", session);
    } catch (e) {
    }
  }
  await next();
}
function requireAuth(c) {
  const session = c.get("session");
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}
var tempCredentialCache = /* @__PURE__ */ new Map();
async function issueTempCredentials(envId, userId) {
  const cached = tempCredentialCache.get(userId);
  if (cached && cached.expireTime > Date.now() / 1e3 + 300) {
    return cached.credentials;
  }
  const systemSecretId = process.env.TCB_SECRET_ID;
  const systemSecretKey = process.env.TCB_SECRET_KEY;
  const systemEnvId = process.env.TCB_ENV_ID;
  if (!systemSecretId || !systemSecretKey || !systemEnvId) return void 0;
  try {
    const app8 = new CloudBaseManager({ secretId: systemSecretId, secretKey: systemSecretKey, envId: systemEnvId });
    const result = await app8.commonService("sts").call({
      Action: "GetFederationToken",
      Param: {
        Name: `vibe-user-${userId.slice(0, 8)}`,
        DurationSeconds: 7200,
        Policy: JSON.stringify({
          version: "2.0",
          statement: buildUserEnvPolicyStatements(envId)
        })
      }
    });
    const creds = result?.Credentials;
    if (creds?.TmpSecretId && creds?.TmpSecretKey && creds?.Token) {
      const credentials = {
        secretId: creds.TmpSecretId,
        secretKey: creds.TmpSecretKey,
        sessionToken: creds.Token
      };
      tempCredentialCache.set(userId, {
        credentials,
        expireTime: result?.ExpiredTime || Date.now() / 1e3 + 7200
      });
      return credentials;
    }
  } catch (err) {
    console.error("[Auth] issueTempCredentials failed:", err.message);
  }
  return void 0;
}
async function requireUserEnv(c, next) {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const resource = await getDb().userResources.findByUserId(userId);
  if (!resource?.envId) {
    return c.json({ error: "User environment not ready" }, 400);
  }
  const envId = resource.envId;
  let credentials;
  if (resource.camSecretId && resource.camSecretKey) {
    credentials = { secretId: resource.camSecretId, secretKey: resource.camSecretKey };
  } else {
    credentials = await issueTempCredentials(envId, userId);
  }
  if (!credentials) {
    return c.json({ error: "Failed to obtain user credentials" }, 500);
  }
  c.set("userEnv", { envId, userId, credentials });
  await next();
}

// src/routes/auth.ts
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { nanoid as nanoid3 } from "nanoid";
var SESSION_COOKIE_NAME2 = "nex_session";
var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
var auth = new Hono();
auth.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return c.json({ error: "Username and password are required" }, 400);
    }
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return c.json({ error: "Username must be at least 3 characters" }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }
    const existing = await getDb().users.findByProviderAndExternalId("local", trimmedUsername);
    if (existing) {
      return c.json({ error: "Username already taken" }, 409);
    }
    const userId = nanoid3();
    const now4 = Date.now();
    const passwordHash = await bcrypt.hash(password, 12);
    await getDb().users.create({
      id: userId,
      provider: "local",
      externalId: trimmedUsername,
      accessToken: "",
      refreshToken: null,
      scope: null,
      username: trimmedUsername,
      email: null,
      name: null,
      avatarUrl: null,
      createdAt: now4,
      updatedAt: now4,
      lastLoginAt: now4
    });
    await getDb().localCredentials.create({
      userId,
      passwordHash,
      createdAt: now4,
      updatedAt: now4
    });
    const session = {
      created: now4,
      authProvider: "github",
      user: {
        id: userId,
        username: trimmedUsername,
        email: void 0,
        name: trimmedUsername,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff`
      }
    };
    const sessionValue = await encryptJWE(session, "1y");
    const provisionMode = process.env.TCB_PROVISION_MODE || "shared";
    if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
      const resourceId = nanoid3();
      if (provisionMode === "isolated") {
        await getDb().userResources.create({
          id: resourceId,
          userId,
          status: "processing",
          envId: null,
          camUsername: null,
          camSecretId: null,
          camSecretKey: null,
          policyId: null,
          failStep: null,
          failReason: null,
          createdAt: now4,
          updatedAt: now4
        });
        provisionUserResources(userId, trimmedUsername).then(async (result) => {
          await getDb().userResources.update(resourceId, {
            status: "success",
            envId: result.envId,
            camUsername: result.camUsername,
            camSecretId: result.camSecretId,
            camSecretKey: result.camSecretKey || null,
            policyId: result.policyId,
            updatedAt: Date.now()
          });
          console.log(`[provision] User ${trimmedUsername} env ready: ${result.envId}`);
        }).catch(async (err) => {
          await getDb().userResources.update(resourceId, {
            status: "failed",
            failReason: err.message,
            updatedAt: Date.now()
          });
          console.error(`[provision] User ${trimmedUsername} failed:`, err.message);
        });
      } else {
        await getDb().userResources.create({
          id: resourceId,
          userId,
          status: "success",
          envId: process.env.TCB_ENV_ID || null,
          camUsername: null,
          camSecretId: process.env.TCB_SECRET_ID || null,
          camSecretKey: process.env.TCB_SECRET_KEY || null,
          policyId: null,
          failStep: null,
          failReason: null,
          createdAt: now4,
          updatedAt: now4
        });
        console.log(`[provision] User ${trimmedUsername} shared env: ${process.env.TCB_ENV_ID}`);
      }
    }
    setCookie(c, SESSION_COOKIE_NAME2, sessionValue, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "Lax"
    });
    return c.json({ success: true, username: trimmedUsername });
  } catch (error) {
    console.error("Error registering local user:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return c.json({ error: "Username and password are required" }, 400);
    }
    const trimmedUsername = username.trim().toLowerCase();
    const user = await getDb().users.findByProviderAndExternalId("local", trimmedUsername);
    if (!user) {
      return c.json({ error: "Invalid username or password" }, 401);
    }
    const cred = await getDb().localCredentials.findByUserId(user.id);
    if (!cred) {
      return c.json({ error: "Invalid username or password" }, 401);
    }
    const valid = await bcrypt.compare(password, cred.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid username or password" }, 401);
    }
    if (user.status === "disabled") {
      return c.json({ error: "Account has been disabled" }, 403);
    }
    await getDb().users.update(user.id, { lastLoginAt: Date.now(), updatedAt: Date.now() });
    const session = {
      created: Date.now(),
      authProvider: "github",
      user: {
        id: user.id,
        username: user.username,
        email: user.email || void 0,
        name: user.name || user.username,
        avatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`
      }
    };
    const sessionValue = await encryptJWE(session, "1y");
    setCookie(c, SESSION_COOKIE_NAME2, sessionValue, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "Lax"
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error logging in local user:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});
auth.post("/signout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME2, { path: "/" });
  return c.json({ success: true });
});
auth.get("/me", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ user: void 0 });
  }
  const user = await getDb().users.findById(session.user.id);
  if (user?.status === "disabled") {
    deleteCookie(c, SESSION_COOKIE_NAME2, { path: "/" });
    return c.json({ user: void 0 });
  }
  let envId;
  try {
    const resource = await getDb().userResources.findByUserId(session.user.id);
    envId = resource?.envId || void 0;
  } catch {
  }
  return c.json({
    user: {
      ...session.user,
      role: user?.role || "user"
    },
    authProvider: session.authProvider,
    envId
  });
});
auth.get("/provision-status", async (c) => {
  const session = c.get("session");
  if (!session?.user?.id) return c.json({ error: "Unauthorized" }, 401);
  const resource = await getDb().userResources.findByUserId(session.user.id);
  if (!resource) return c.json({ status: "not_started" });
  return c.json({
    status: resource.status,
    envId: resource.envId,
    camUsername: resource.camUsername,
    camSecretId: resource.camSecretId,
    failReason: resource.failReason,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt
  });
});
auth.get("/rate-limit", async (c) => {
  const session = c.get("session");
  if (!session?.user?.id) return c.json({ error: "Unauthorized" }, 401);
  return c.json({
    allowed: true,
    remaining: 100,
    used: 0,
    total: 100,
    resetAt: new Date(Date.now() + 864e5).toISOString()
  });
});
var auth_default = auth;

// src/routes/github-auth.ts
import { Hono as Hono2 } from "hono";
import { getCookie as getCookie2, setCookie as setCookie2, deleteCookie as deleteCookie2 } from "hono/cookie";
import { nanoid as nanoid4 } from "nanoid";

// src/lib/crypto.ts
import crypto from "crypto";
var ALGORITHM = "aes-256-cbc";
var IV_LENGTH = 16;
var getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    return null;
  }
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 32-byte hex string (64 characters). Generate one with: openssl rand -hex 32"
    );
  }
  return keyBuffer;
};
var encrypt = (text2) => {
  if (!text2) return text2;
  const ENCRYPTION_KEY = getEncryptionKey();
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for MCP encryption. Generate one with: openssl rand -hex 32"
    );
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text2, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};
var decrypt = (encryptedText) => {
  if (!encryptedText) return encryptedText;
  const ENCRYPTION_KEY = getEncryptionKey();
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for MCP decryption. Generate one with: openssl rand -hex 32"
    );
  }
  if (!encryptedText.includes(":")) {
    throw new Error("Invalid encrypted text format");
  }
  try {
    const [ivHex, encryptedHex] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("Failed to decrypt: " + (error instanceof Error ? error.message : "unknown error"));
  }
};

// src/routes/github-auth.ts
var SESSION_COOKIE_NAME3 = "nex_session";
var COOKIE_MAX_AGE2 = 60 * 60 * 24 * 365;
function generateState() {
  return nanoid4(32);
}
var githubAuth = new Hono2();
githubAuth.get("/signin", async (c) => {
  const session = c.get("session");
  if (!session?.user) {
    return c.redirect("/");
  }
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/github/callback`;
  if (!clientId) {
    return c.redirect("/?error=github_not_configured");
  }
  const state = generateState();
  const next = c.req.query("next") ?? "/";
  const redirectTo = next.startsWith("/") ? next : "/";
  setCookie2(c, "github_oauth_redirect_to", redirectTo, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "Lax"
  });
  setCookie2(c, "github_oauth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "Lax"
  });
  setCookie2(c, "github_oauth_user_id", session.user.id, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "Lax"
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo,read:user,user:email",
    state
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});
githubAuth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const authMode = getCookie2(c, "github_auth_mode") ?? null;
  const isSignInFlow = authMode === "signin";
  const storedState = getCookie2(c, authMode ? "github_auth_state" : "github_oauth_state") ?? null;
  const storedRedirectTo = getCookie2(c, authMode ? "github_auth_redirect_to" : "github_oauth_redirect_to") ?? null;
  const storedUserId = getCookie2(c, "github_oauth_user_id") ?? null;
  if (isSignInFlow) {
    if (!code || !state || storedState !== state || !storedRedirectTo) {
      return c.text("Invalid OAuth state", 400);
    }
  } else {
    if (!code || !state || storedState !== state || !storedRedirectTo || !storedUserId) {
      return c.text("Invalid OAuth state", 400);
    }
  }
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.text("GitHub OAuth not configured", 500);
  }
  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    if (!tokenResponse.ok) {
      console.error("[GitHub Callback] Token exchange failed");
      return c.text("Failed to exchange code for token", 400);
    }
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error("[GitHub Callback] Failed to get GitHub access token");
      return c.text(
        `Failed to authenticate with GitHub: ${tokenData.error_description || tokenData.error || "Unknown error"}`,
        400
      );
    }
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    const githubUser = await userResponse.json();
    if (isSignInFlow) {
      let email = githubUser.email;
      if (!email) {
        try {
          const emailsResponse = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: "application/vnd.github.v3+json"
            }
          });
          if (emailsResponse.ok) {
            const emails = await emailsResponse.json();
            const primaryEmail = emails.find((e) => e.primary && e.verified);
            email = primaryEmail?.email || emails[0]?.email || null;
          }
        } catch {
        }
      }
      const now4 = Date.now();
      const externalId = `${githubUser.id}`;
      const encryptedToken = encrypt(tokenData.access_token);
      const existing = await getDb().users.findByProviderAndExternalId("github", externalId);
      let userId;
      if (existing) {
        if (existing.status === "disabled") {
          const loginUrl = new URL("/login", c.req.url);
          loginUrl.searchParams.set("error", "disabled");
          return c.redirect(loginUrl.toString());
        }
        userId = existing.id;
        await getDb().users.update(userId, {
          accessToken: encryptedToken,
          scope: tokenData.scope,
          username: githubUser.login,
          email: email || null,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          updatedAt: now4,
          lastLoginAt: now4
        });
      } else {
        userId = nanoid4();
        await getDb().users.create({
          id: userId,
          provider: "github",
          externalId,
          accessToken: encryptedToken,
          refreshToken: null,
          scope: tokenData.scope,
          username: githubUser.login,
          email: email || null,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          createdAt: now4,
          updatedAt: now4,
          lastLoginAt: now4
        });
      }
      const session = {
        created: now4,
        authProvider: "github",
        user: {
          id: userId,
          username: githubUser.login,
          email: email || void 0,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url
        }
      };
      const sessionValue = await encryptJWE(session, "1y");
      deleteCookie2(c, "github_auth_state", { path: "/" });
      deleteCookie2(c, "github_auth_redirect_to", { path: "/" });
      deleteCookie2(c, "github_auth_mode", { path: "/" });
      setCookie2(c, SESSION_COOKIE_NAME3, sessionValue, {
        path: "/",
        maxAge: COOKIE_MAX_AGE2,
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production"
      });
      return c.redirect(storedRedirectTo);
    } else {
      const encryptedToken = encrypt(tokenData.access_token);
      const existingAccount = await getDb().accounts.findByUserIdAndProvider(storedUserId, "github");
      const accountByExternal = await getDb().accounts.findByProviderAndExternalUserId("github", `${githubUser.id}`);
      if (accountByExternal) {
        const connectedUserId = accountByExternal.userId;
        if (connectedUserId !== storedUserId) {
          await getDb().tasks.updateUserId(connectedUserId, storedUserId);
          await getDb().connectors.updateUserId(connectedUserId, storedUserId);
          await getDb().accounts.updateUserId(connectedUserId, storedUserId);
          await getDb().keys.updateUserId(connectedUserId, storedUserId);
          await getDb().users.deleteById(connectedUserId);
          await getDb().accounts.update(accountByExternal.id, {
            userId: storedUserId,
            accessToken: encryptedToken,
            scope: tokenData.scope,
            username: githubUser.login,
            updatedAt: Date.now()
          });
        } else {
          await getDb().accounts.update(accountByExternal.id, {
            accessToken: encryptedToken,
            scope: tokenData.scope,
            username: githubUser.login,
            updatedAt: Date.now()
          });
        }
      } else {
        await getDb().accounts.create({
          id: nanoid4(),
          userId: storedUserId,
          provider: "github",
          externalUserId: `${githubUser.id}`,
          accessToken: encryptedToken,
          refreshToken: null,
          expiresAt: null,
          scope: tokenData.scope,
          username: githubUser.login
        });
      }
      if (authMode) {
        deleteCookie2(c, "github_auth_state", { path: "/" });
        deleteCookie2(c, "github_auth_redirect_to", { path: "/" });
        deleteCookie2(c, "github_auth_mode", { path: "/" });
      } else {
        deleteCookie2(c, "github_oauth_state", { path: "/" });
        deleteCookie2(c, "github_oauth_redirect_to", { path: "/" });
      }
      deleteCookie2(c, "github_oauth_user_id", { path: "/" });
      return c.redirect(storedRedirectTo);
    }
  } catch (error) {
    console.error("[GitHub Callback] OAuth callback error:", error);
    return c.text("Failed to complete GitHub authentication", 500);
  }
});
githubAuth.get("/status", async (c) => {
  const session = c.get("session");
  if (!session?.user) {
    return c.json({ connected: false });
  }
  if (!session.user.id) {
    console.error("GitHub status check: session.user.id is undefined");
    return c.json({ connected: false });
  }
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(session.user.id, "github");
    if (account) {
      return c.json({
        connected: true,
        username: account.username,
        connectedAt: account.createdAt
      });
    }
    const user = await getDb().users.findById(session.user.id);
    if (user && user.provider === "github") {
      return c.json({
        connected: true,
        username: user.username,
        connectedAt: user.createdAt
      });
    }
    return c.json({ connected: false });
  } catch (error) {
    console.error("Error checking GitHub connection status:", error);
    return c.json({ connected: false, error: "Failed to check status" }, 500);
  }
});
githubAuth.post("/disconnect", async (c) => {
  const session = c.get("session");
  if (!session?.user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  if (!session.user.id) {
    console.error("Session user.id is undefined");
    return c.json({ error: "Invalid session - user ID missing" }, 400);
  }
  if (session.authProvider === "github") {
    return c.json({ error: "Cannot disconnect primary authentication method" }, 400);
  }
  try {
    await getDb().accounts.delete(session.user.id, "github");
    return c.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting GitHub:", error);
    return c.json({ error: "Failed to disconnect" }, 500);
  }
});
var github_auth_default = githubAuth;

// src/routes/github.ts
import { Hono as Hono3 } from "hono";
import { Octokit } from "@octokit/rest";
var github = new Hono3();
async function getGitHubToken(userId) {
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(userId, "github");
    if (account?.accessToken) {
      return decrypt(account.accessToken);
    }
    const user = await getDb().users.findById(userId);
    if (user?.provider === "github" && user.accessToken) {
      return decrypt(user.accessToken);
    }
    return null;
  } catch (error) {
    console.error("Error fetching user GitHub token:", error);
    return null;
  }
}
github.get("/user", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      throw new Error("GitHub API error");
    }
    const user = await response.json();
    return c.json({
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url
    });
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    return c.json({ error: "Failed to fetch user data" }, 500);
  }
});
github.get("/repos", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const owner = c.req.query("owner");
    if (!owner) {
      return c.json({ error: "Owner parameter is required" }, 400);
    }
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    let isAuthenticatedUser = false;
    if (userResponse.ok) {
      const user = await userResponse.json();
      isAuthenticatedUser = user.login === owner;
    }
    const allRepos = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      let apiUrl;
      if (isAuthenticatedUser) {
        apiUrl = `https://api.github.com/user/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}&visibility=all&affiliation=owner`;
      } else {
        const orgResponse = await fetch(`https://api.github.com/orgs/${owner}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json"
          }
        });
        if (orgResponse.ok) {
          apiUrl = `https://api.github.com/orgs/${owner}/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}`;
        } else {
          apiUrl = `https://api.github.com/users/${owner}/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}`;
        }
      }
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json"
        }
      });
      if (!response.ok) {
        throw new Error("GitHub API error");
      }
      const repos = await response.json();
      if (repos.length === 0) {
        break;
      }
      allRepos.push(...repos);
      if (repos.length < perPage) {
        break;
      }
      page++;
    }
    const uniqueRepos = allRepos.filter(
      (repo, index2, self) => index2 === self.findIndex((r) => r.full_name === repo.full_name)
    );
    uniqueRepos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return c.json(
      uniqueRepos.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        clone_url: repo.clone_url,
        updated_at: repo.updated_at,
        language: repo.language
      }))
    );
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error);
    return c.json({ error: "Failed to fetch repositories" }, 500);
  }
});
github.get("/user-repos", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const page = parseInt(c.req.query("page") || "1", 10);
    const perPage = parseInt(c.req.query("per_page") || "25", 10);
    const search = c.req.query("search") || "";
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!userResponse.ok) {
      return c.json({ error: "Failed to fetch user" }, 401);
    }
    const user = await userResponse.json();
    const username = user.login;
    if (search.trim()) {
      const searchQuery = encodeURIComponent(`${search} in:name user:${username} fork:true`);
      const searchUrl = `https://api.github.com/search/repositories?q=${searchQuery}&sort=updated&order=desc&per_page=${perPage}&page=${page}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json"
        }
      });
      if (!searchResponse.ok) {
        throw new Error("Failed to search repositories");
      }
      const searchResult = await searchResponse.json();
      return c.json({
        repos: searchResult.items.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          owner: repo.owner.login,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          updated_at: repo.updated_at,
          language: repo.language
        })),
        page,
        per_page: perPage,
        has_more: searchResult.total_count > page * perPage,
        total_count: searchResult.total_count,
        username
      });
    }
    const githubPerPage = 100;
    const githubPage = Math.ceil(page * perPage / githubPerPage);
    const apiUrl = `https://api.github.com/user/repos?sort=updated&direction=desc&per_page=${githubPerPage}&page=${githubPage}&visibility=all&affiliation=owner,organization_member`;
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      throw new Error("Failed to fetch repositories");
    }
    const repos = await response.json();
    const offsetInGithubPage = (page - 1) * perPage % githubPerPage;
    const slicedRepos = repos.slice(offsetInGithubPage, offsetInGithubPage + perPage);
    const hasMore = repos.length === githubPerPage || slicedRepos.length === perPage;
    return c.json({
      repos: slicedRepos.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        private: repo.private,
        clone_url: repo.clone_url,
        updated_at: repo.updated_at,
        language: repo.language
      })),
      page,
      per_page: perPage,
      has_more: hasMore,
      username
    });
  } catch (error) {
    console.error("Error fetching user repositories:", error);
    return c.json({ error: "Failed to fetch repositories" }, 500);
  }
});
github.get("/orgs", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const response = await fetch("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      throw new Error("GitHub API error");
    }
    const orgs = await response.json();
    return c.json(
      orgs.map((org) => ({
        login: org.login,
        name: org.name || org.login,
        avatar_url: org.avatar_url
      }))
    );
  } catch (error) {
    console.error("Error fetching GitHub organizations:", error);
    return c.json({ error: "Failed to fetch organizations" }, 500);
  }
});
github.post("/repos/create", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub token not found. Please reconnect your GitHub account." }, 401);
    }
    const body = await c.req.json();
    const { name, description, private: isPrivate, owner, template } = body;
    if (!name || typeof name !== "string") {
      return c.json({ error: "Repository name is required" }, 400);
    }
    const repoNamePattern = /^[a-zA-Z0-9._-]+$/;
    if (!repoNamePattern.test(name)) {
      return c.json(
        { error: "Repository name can only contain alphanumeric characters, periods, hyphens, and underscores" },
        400
      );
    }
    const octokit = new Octokit({ auth: token });
    try {
      let repo;
      if (owner) {
        const { data: user } = await octokit.users.getAuthenticated();
        if (user.login === owner) {
          repo = await octokit.repos.createForAuthenticatedUser({
            name,
            description: description || void 0,
            private: isPrivate || false,
            auto_init: true
          });
        } else {
          try {
            repo = await octokit.repos.createInOrg({
              org: owner,
              name,
              description: description || void 0,
              private: isPrivate || false,
              auto_init: true
            });
          } catch (error) {
            if (error && typeof error === "object" && "status" in error && error.status === 404) {
              return c.json(
                { error: "Organization not found or you do not have permission to create repositories" },
                403
              );
            }
            throw error;
          }
        }
      } else {
        repo = await octokit.repos.createForAuthenticatedUser({
          name,
          description: description || void 0,
          private: isPrivate || false,
          auto_init: true
        });
      }
      if (template) {
        try {
          await populateRepoFromTemplate(octokit, repo.data.owner.login, repo.data.name, template);
        } catch (error) {
          console.error("Error populating repository from template:", error);
        }
      }
      return c.json({
        success: true,
        name: repo.data.name,
        full_name: repo.data.full_name,
        clone_url: repo.data.clone_url,
        html_url: repo.data.html_url,
        private: repo.data.private
      });
    } catch (error) {
      console.error("GitHub API error:", error);
      if (error && typeof error === "object" && "status" in error) {
        if (error.status === 422) {
          return c.json({ error: "Repository already exists or name is invalid" }, 422);
        }
        if (error.status === 403) {
          return c.json({ error: "You do not have permission to create repositories in this organization" }, 403);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating repository:", error);
    return c.json({ error: "Failed to create repository" }, 500);
  }
});
github.post("/verify-repo", async (c) => {
  try {
    const session = c.get("session");
    if (!session?.user?.id) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return c.json({ error: "GitHub not connected" }, 401);
    }
    let owner = c.req.query("owner");
    let repo = c.req.query("repo");
    if (!owner || !repo) {
      try {
        const body = await c.req.json();
        owner = owner || body.owner;
        repo = repo || body.repo;
      } catch {
      }
    }
    if (!owner || !repo) {
      return c.json({ error: "Owner and repo parameters are required" }, 400);
    }
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ accessible: false, error: "Repository not found" });
      }
      return c.json({ accessible: false, error: "Failed to verify repository" });
    }
    const repoData = await response.json();
    return c.json({
      accessible: true,
      owner: {
        login: repoData.owner.login,
        name: repoData.owner.login,
        avatar_url: repoData.owner.avatar_url
      },
      repo: {
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        clone_url: repoData.clone_url,
        language: repoData.language
      }
    });
  } catch (error) {
    console.error("Error verifying GitHub repository:", error);
    return c.json({ accessible: false, error: "Failed to verify repository" }, 500);
  }
});
async function copyFilesRecursively(octokit, sourceOwner, sourceRepoName, sourcePath, repoOwner, repoName, basePath) {
  try {
    const { data: contents } = await octokit.repos.getContent({
      owner: sourceOwner,
      repo: sourceRepoName,
      path: sourcePath
    });
    if (!Array.isArray(contents)) {
      return;
    }
    for (const item of contents) {
      if (item.type === "file" && item.download_url) {
        try {
          const response = await fetch(item.download_url);
          if (!response.ok) {
            throw new Error("Failed to fetch file");
          }
          const content = await response.text();
          const relativePath = basePath ? item.path.startsWith(basePath + "/") ? item.path.substring(basePath.length + 1) : item.name : item.path;
          await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: relativePath,
            message: `Add ${relativePath} from template`,
            content: Buffer.from(content).toString("base64")
          });
        } catch (error) {
          console.error("Error copying file:", error);
        }
      } else if (item.type === "dir") {
        await copyFilesRecursively(octokit, sourceOwner, sourceRepoName, item.path, repoOwner, repoName, basePath);
      }
    }
  } catch (error) {
    console.error("Error processing directory:", error);
  }
}
async function populateRepoFromTemplate(octokit, repoOwner, repoName, template) {
  if (!template.cloneUrl) {
    return;
  }
  const cloneMatch = template.cloneUrl.match(/github\.com\/([\w-]+)\/([\w-]+?)(?:\.git)?$/);
  if (!cloneMatch) {
    throw new Error("Invalid clone URL");
  }
  const [, sourceOwner, sourceRepoName] = cloneMatch;
  try {
    await copyFilesRecursively(octokit, sourceOwner, sourceRepoName, "", repoOwner, repoName, "");
  } catch (error) {
    console.error("Error populating repository from template:", error);
    throw error;
  }
}
var github_default = github;

// src/routes/acp.ts
import { Hono as Hono4 } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv43 } from "uuid";
import {
  ACP_PROTOCOL_VERSION,
  NEX_AGENT_INFO,
  JSON_RPC_ERRORS
} from "@coder/shared";

// src/agent/cloudbase-agent.service.ts
import { mkdirSync as mkdirSync2 } from "fs";
import path4 from "path";
import { fileURLToPath } from "url";
import { query, ExecutionError } from "@tencent-ai/agent-sdk";
import { v4 as uuidv42 } from "uuid";

// src/agent/persistence.service.ts
import * as fs2 from "fs/promises";
import { realpathSync } from "fs";
import * as path3 from "path";
import { v4 as uuidv4 } from "uuid";
import CloudBase2 from "@cloudbase/node-sdk";

// src/config/store.ts
import fs from "fs";
import path2 from "path";
import os from "os";
var CONFIG_DIR = path2.join(os.homedir(), ".coder");
var CONFIG_FILE = path2.join(CONFIG_DIR, "config.json");
function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// src/agent/persistence.service.ts
import { AGENT_ID } from "@coder/shared";
var COLLECTION_NAME = "vibe_agent_messages";
function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || "";
}
function getProjectHash(cwd) {
  return cwd.replace(/[/\\:]/g, "-").replace(/^-+/, "").replace(/-+$/, "").replace(/-+/g, "-");
}
function getLocalMessageFilePath(sessionId, cwd) {
  let resolvedCwd = cwd;
  try {
    resolvedCwd = realpathSync(cwd);
  } catch {
  }
  const projectDirName = getProjectHash(resolvedCwd);
  const homeDir = getHomeDir();
  const coderProjectsDir = path3.join(homeDir, ".codebuddy", "projects");
  return path3.join(coderProjectsDir, projectDirName, `${sessionId}.jsonl`);
}
var PersistenceService = class {
  /**
   * 使用【支撑身份】初始化 CloudBase SDK
   * 凭证来源：系统环境变量（永久密钥），用于操作支撑环境的数据库
   * 注意：DB 记录中的 envId 字段是【用户环境 ID】，由 caller 传入，用于数据隔离
   */
  async getCloudBaseApp() {
    const config = loadConfig();
    const envId = process.env.TCB_ENV_ID || config.cloudbase?.envId;
    const region = process.env.TCB_REGION || config.cloudbase?.region || "ap-shanghai";
    if (!envId) {
      throw new Error("\u7F3A\u5C11\u652F\u6491\u73AF\u5883\u914D\u7F6E\uFF0C\u8BF7\u8BBE\u7F6E TCB_ENV_ID \u73AF\u5883\u53D8\u91CF");
    }
    const secretId = process.env.TCB_SECRET_ID;
    const secretKey = process.env.TCB_SECRET_KEY;
    const token = process.env.TCB_TOKEN || void 0;
    if (!secretId || !secretKey) {
      throw new Error("\u7F3A\u5C11\u652F\u6491\u8EAB\u4EFD\u5BC6\u94A5\uFF0C\u8BF7\u8BBE\u7F6E TCB_SECRET_ID \u548C TCB_SECRET_KEY \u73AF\u5883\u53D8\u91CF");
    }
    return CloudBase2.init({
      env: envId,
      region,
      secretId,
      secretKey,
      ...token ? { sessionToken: token } : {}
    });
  }
  collectionEnsured = false;
  async getCollection() {
    const app8 = await this.getCloudBaseApp();
    const db = app8.database();
    if (!this.collectionEnsured) {
      try {
        await db.createCollection(COLLECTION_NAME);
      } catch {
      }
      this.collectionEnsured = true;
    }
    return db.collection(COLLECTION_NAME);
  }
  // ========== Message Conversion ==========
  transformDBMessagesToCodeBuddyMessages(records, sessionId) {
    const messages = [];
    for (const record of records) {
      const timestamp = record.createTime || Date.now();
      if (record.role === "user") {
        this.restoreUserRecord(record, timestamp, sessionId, messages);
      } else if (record.role === "assistant") {
        this.restoreAssistantRecord(record, timestamp, sessionId, messages);
      }
    }
    this.fixSelfReferencingParentIds(messages);
    return messages;
  }
  fixSelfReferencingParentIds(messages) {
    const idSet = /* @__PURE__ */ new Set();
    const idTypeMap = /* @__PURE__ */ new Map();
    for (const msg of messages) {
      if (msg.id) {
        idSet.add(msg.id);
        idTypeMap.set(msg.id, msg.type);
      }
    }
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      let needsFix = false;
      if (msg.parentId && msg.parentId === msg.id) {
        needsFix = true;
      } else if (msg.parentId) {
        const parentType = idTypeMap.get(msg.parentId);
        if (!parentType || parentType === "file-history-snapshot") {
          needsFix = true;
        }
      } else if (msg.type === "function_call" || msg.type === "function_call_result") {
        needsFix = true;
      }
      if (needsFix) {
        if (i === 0) {
          msg.parentId = void 0;
        } else {
          for (let j = i - 1; j >= 0; j--) {
            const prevMsg = messages[j];
            if (prevMsg.id && prevMsg.type !== "file-history-snapshot" && prevMsg.id !== prevMsg.parentId) {
              msg.parentId = prevMsg.id;
              break;
            }
          }
        }
      }
    }
  }
  restoreUserRecord(record, _timestamp, _sessionId, messages) {
    for (const part of record.parts || []) {
      const msg = this.restorePartToMessage(part);
      if (msg) messages.push(msg);
    }
  }
  restoreAssistantRecord(record, _timestamp, _sessionId, messages) {
    const pendingMessages = [];
    let messagePartMsg = null;
    for (const part of record.parts || []) {
      if (part.contentType === "text") {
        messagePartMsg = this.restorePartToMessage(part);
      } else {
        const msg = this.restorePartToMessage(part);
        if (msg) pendingMessages.push(msg);
      }
    }
    messages.push(...pendingMessages);
    if (messagePartMsg) messages.push(messagePartMsg);
  }
  restorePartToMessage(part) {
    const metadata = part.metadata;
    if (!metadata) return null;
    if (part.contentType === "text") {
      const { contentBlocks, ...rest } = metadata;
      if (contentBlocks) {
        return { ...rest, content: contentBlocks };
      }
      const blockType = rest.role === "assistant" ? "output_text" : "input_text";
      return {
        ...rest,
        content: [{ type: blockType, text: part.content || "" }]
      };
    }
    if (part.contentType === "tool_call") {
      const { toolCallName, ...rest } = metadata;
      return {
        ...rest,
        name: toolCallName,
        callId: part.toolCallId,
        arguments: part.content
      };
    }
    if (part.contentType === "tool_result") {
      let output = part.content || "";
      try {
        const parsed = JSON.parse(output);
        if (typeof parsed === "object" && parsed !== null) output = parsed;
      } catch {
      }
      return { ...metadata, callId: part.toolCallId, output };
    }
    if (part.contentType === "reasoning") {
      return {
        ...metadata,
        type: "reasoning"
      };
    }
    return { ...metadata };
  }
  // ========== Local File Operations ==========
  async writeLocalMessageFile(filePath, messages) {
    const dir = path3.dirname(filePath);
    await fs2.mkdir(dir, { recursive: true });
    const content = messages.map((m) => JSON.stringify(m)).join("\n");
    await fs2.writeFile(filePath, content + "\n", "utf-8");
  }
  async readLocalMessageFile(filePath) {
    try {
      const content = await fs2.readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      return lines.map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
  async cleanupLocalFile(filePath) {
    try {
      await fs2.unlink(filePath);
    } catch {
    }
  }
  // ========== Database Operations ==========
  async loadDBMessages(conversationId, envId, userId, limit = 20) {
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      const { data } = await collection.where({
        conversationId: _.eq(conversationId),
        envId: _.eq(envId),
        userId: _.eq(userId),
        agentId: _.eq(AGENT_ID)
      }).orderBy("createTime", "desc").limit(limit).get();
      const sorted = data.reverse();
      const firstUserIdx = sorted.findIndex((r) => r.role === "user");
      const valid = firstUserIdx >= 0 ? sorted.slice(firstUserIdx) : sorted;
      return valid.map((r) => ({
        recordId: r.recordId,
        conversationId: r.conversationId,
        replyTo: r.replyTo,
        role: r.role,
        status: r.status,
        envId: r.envId,
        userId: r.userId,
        agentId: r.agentId,
        content: r.content,
        parts: r.parts || [],
        createTime: r.createTime || Date.now()
      }));
    } catch {
      return [];
    }
  }
  async saveRecordToDB(record) {
    const collection = await this.getCollection();
    const now4 = Date.now();
    const doc = {
      ...record,
      createTime: record.createTime || now4,
      updateTime: now4
    };
    await collection.add(doc);
    return {
      ...doc,
      createTime: doc.createTime
    };
  }
  async updateRecordStatus(recordId, status) {
    const collection = await this.getCollection();
    const app8 = await this.getCloudBaseApp();
    const _ = app8.database().command;
    await collection.where({ recordId: _.eq(recordId) }).update({ status, updateTime: Date.now() });
  }
  async appendPartsToRecord(recordId, parts) {
    if (parts.length === 0) return;
    const collection = await this.getCollection();
    const app8 = await this.getCloudBaseApp();
    const _ = app8.database().command;
    const { data } = await collection.where({ recordId: _.eq(recordId) }).get();
    if (!data || data.length === 0) return;
    const existingRecord = data[0];
    const existingParts = existingRecord.parts || [];
    const updatedParts = [...existingParts, ...parts];
    await collection.where({ recordId: _.eq(recordId) }).update({ parts: updatedParts, updateTime: Date.now() });
  }
  async replacePartsInRecord(recordId, parts) {
    const collection = await this.getCollection();
    const app8 = await this.getCloudBaseApp();
    const _ = app8.database().command;
    await collection.where({ recordId: _.eq(recordId) }).update({ parts, updateTime: Date.now() });
  }
  // ========== Message Grouping ==========
  groupMessages(messages) {
    const groups = [];
    let currentGroup = [];
    for (const msg of messages) {
      if (msg.type !== "message") {
        currentGroup.push(msg);
        continue;
      }
      const isRealUserInput = msg.role === "user" && this.isUserTextMessage(msg);
      if (isRealUserInput) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        groups.push([msg]);
      } else {
        currentGroup.push(msg);
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  }
  isUserTextMessage(msg) {
    if (!msg.content || msg.content.length === 0) return false;
    const hasInputText = msg.content.some((b) => b.type === "input_text");
    const onlyToolResult = msg.content.every((b) => b.type === "tool_result");
    return hasInputText && !onlyToolResult;
  }
  isToolResultMessage(msg) {
    if (msg.type === "file-history-snapshot") return false;
    if (!msg.content || msg.content.length === 0) return false;
    return msg.content.every((b) => b.type === "tool_result");
  }
  extractPartsFromMessage(msg) {
    if (msg.type === "message") {
      const { content: contentBlocks, ...messageMeta } = msg;
      const blocks = contentBlocks || [];
      const textBlocks = blocks.filter((b) => b.type === "input_text" || b.type === "output_text");
      const plainText = textBlocks.map((b) => b.text || "").join("\n");
      const isSimple = blocks.length === 1 && textBlocks.length === 1 && Object.keys(blocks[0]).filter((k) => k !== "type" && k !== "text").length === 0;
      const metadata = { ...messageMeta };
      if (!isSimple) {
        metadata.contentBlocks = blocks;
      }
      return [
        {
          partId: uuidv4(),
          contentType: "text",
          content: plainText,
          metadata
        }
      ];
    }
    if (msg.type === "function_call") {
      const { arguments: _args, callId: _callId, name: _name, ...rest } = msg;
      return [
        {
          partId: uuidv4(),
          contentType: "tool_call",
          toolCallId: _callId,
          content: _args,
          metadata: { ...rest, toolCallName: _name }
        }
      ];
    }
    if (msg.type === "function_call_result") {
      const { output: _output, callId: _callId, ...rest } = msg;
      return [
        {
          partId: uuidv4(),
          contentType: "tool_result",
          toolCallId: _callId,
          content: typeof _output === "string" ? _output : JSON.stringify(_output),
          metadata: rest
        }
      ];
    }
    if (msg.type === "reasoning") {
      const rawContent = msg.rawContent || [];
      const reasoningText = rawContent.filter((block) => block.type === "reasoning_text" && block.text).map((block) => block.text || "").join("");
      return [
        {
          partId: uuidv4(),
          contentType: "reasoning",
          content: reasoningText,
          metadata: { ...msg }
        }
      ];
    }
    return [
      {
        partId: uuidv4(),
        contentType: "raw",
        metadata: { ...msg }
      }
    ];
  }
  // ========== Public API ==========
  async restoreMessages(conversationId, envId, userId, cwd) {
    try {
      const dbRecords = await this.loadDBMessages(conversationId, envId, userId);
      const lastRecordId = dbRecords.length > 0 ? dbRecords[dbRecords.length - 1].recordId : null;
      const lastAssistantRecord = [...dbRecords].reverse().find((r) => r.role === "assistant");
      const lastAssistantRecordId = lastAssistantRecord?.recordId ?? null;
      if (dbRecords.length === 0) {
        return { messages: [], lastRecordId: null, lastAssistantRecordId: null };
      }
      const messages = this.transformDBMessagesToCodeBuddyMessages(dbRecords, conversationId);
      const localFilePath = getLocalMessageFilePath(conversationId, cwd);
      await this.writeLocalMessageFile(localFilePath, messages);
      return { messages, lastRecordId, lastAssistantRecordId };
    } catch {
      return { messages: [], lastRecordId: null, lastAssistantRecordId: null };
    }
  }
  async syncMessages(conversationId, envId, userId, historicalMessages, lastRecordId, cwd, assistantRecordId, isResumeFromInterrupt, preSavedUserRecordId) {
    const localFilePath = getLocalMessageFilePath(conversationId, cwd);
    try {
      const allMessages = await this.readLocalMessageFile(localFilePath);
      if (allMessages.length === 0) return;
      const historicalIds = new Set(historicalMessages.map((m) => m.id));
      let newMessages = allMessages.filter((m) => !historicalIds.has(m.id));
      const map = {};
      newMessages = newMessages.reduce((list, item) => {
        if (item.type === "function_call") {
          if (!map[item.callId || ""]) {
            map[item.callId || ""] = true;
            list.push(item);
          }
        } else {
          list.push(item);
        }
        return list;
      }, []);
      if (isResumeFromInterrupt && newMessages.length > 0) {
        const firstUserMsgIndex = newMessages.findIndex((m) => m.type === "message" && m.role === "user");
        if (firstUserMsgIndex === 0) {
          const removedMsg = newMessages[0];
          const removedParentId = removedMsg.parentId;
          for (let i = 1; i < newMessages.length; i++) {
            if (newMessages[i].parentId === removedMsg.id) {
              newMessages[i] = { ...newMessages[i], parentId: removedParentId };
            }
          }
          newMessages = newMessages.slice(1);
        }
      }
      if (newMessages.length === 0) return;
      await this.appendMessagesToDB(
        conversationId,
        envId,
        userId,
        newMessages,
        lastRecordId,
        assistantRecordId,
        isResumeFromInterrupt,
        preSavedUserRecordId
      );
    } finally {
      await this.cleanupLocalFile(localFilePath);
    }
  }
  async appendMessagesToDB(conversationId, envId, userId, newMessages, lastRecordId, assistantRecordId, isResumeFromInterrupt, preSavedUserRecordId) {
    const groups = this.groupMessages(newMessages);
    let prevRecordId = lastRecordId;
    let firstAssistantGroupHandled = false;
    let preSavedUserRecordHandled = false;
    for (const group of groups) {
      if (group.length === 0) continue;
      const firstMsg = group.find((m) => !this.isToolResultMessage(m)) || group[0];
      const role = firstMsg.role || "assistant";
      const primaryMsg = group.find((m) => m.type === "message");
      const recordId = role === "assistant" && assistantRecordId ? assistantRecordId : primaryMsg?.id || uuidv4();
      const parts = [];
      for (const msg of group) {
        parts.push(...this.extractPartsFromMessage(msg));
      }
      if (parts.length === 0) continue;
      if ((isResumeFromInterrupt || !!assistantRecordId) && role === "assistant" && assistantRecordId && !firstAssistantGroupHandled) {
        await this.appendPartsToRecord(assistantRecordId, parts);
        await this.updateRecordStatus(assistantRecordId, "done");
        firstAssistantGroupHandled = true;
        continue;
      }
      if (preSavedUserRecordId && role === "user" && !preSavedUserRecordHandled) {
        await this.replacePartsInRecord(preSavedUserRecordId, parts);
        await this.updateRecordStatus(preSavedUserRecordId, "done");
        preSavedUserRecordHandled = true;
        prevRecordId = preSavedUserRecordId;
        continue;
      }
      const record = await this.saveRecordToDB({
        recordId,
        conversationId,
        envId,
        userId,
        agentId: AGENT_ID,
        role,
        replyTo: role === "assistant" ? prevRecordId ?? void 0 : void 0,
        status: "done",
        parts
      });
      if (role === "user") {
        prevRecordId = record.recordId;
      }
    }
  }
  async preSavePendingRecords(params) {
    const { conversationId, envId, userId, prompt, prevRecordId } = params;
    const assistantRecordId = params.assistantRecordId || uuidv4();
    const userRecordId = uuidv4();
    const userParts = [
      {
        partId: uuidv4(),
        contentType: "text",
        content: prompt,
        metadata: {
          id: userRecordId,
          type: "message",
          role: "user",
          sessionId: conversationId,
          timestamp: Date.now()
        }
      }
    ];
    await this.saveRecordToDB({
      recordId: userRecordId,
      conversationId,
      envId,
      userId,
      agentId: AGENT_ID,
      role: "user",
      replyTo: prevRecordId || void 0,
      status: "done",
      parts: userParts
    });
    await this.saveRecordToDB({
      recordId: assistantRecordId,
      conversationId,
      envId,
      userId,
      agentId: AGENT_ID,
      role: "assistant",
      replyTo: userRecordId,
      status: "pending",
      parts: []
    });
    return { userRecordId, assistantRecordId };
  }
  async getLatestRecordStatus(conversationId, userId, envId) {
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      const { data } = await collection.where({
        conversationId: _.eq(conversationId),
        envId: _.eq(envId),
        userId: _.eq(userId),
        role: _.eq("assistant")
      }).orderBy("createTime", "desc").limit(1).get();
      if (!data || data.length === 0) return null;
      return {
        recordId: data[0].recordId,
        status: data[0].status || "done"
      };
    } catch {
      return null;
    }
  }
  async conversationExists(conversationId, userId, envId) {
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      const { data } = await collection.where({
        conversationId: _.eq(conversationId),
        envId: _.eq(envId),
        userId: _.eq(userId)
      }).limit(1).get();
      return data.length > 0;
    } catch {
      return false;
    }
  }
  async finalizePendingRecords(assistantRecordId, status) {
    await this.updateRecordStatus(assistantRecordId, status);
  }
  /**
   * 更新已存在的 tool_result 记录（DB only）
   *
   * interrupt=true 时 CLI 已写入 status=incomplete 的 tool_result，
   * resume 时需要将其更新为用户实际回答的内容（而非追加新记录）
   *
   * @param conversationId 会话 ID（用于越权防护）
   * @param recordId 消息记录 ID
   * @param callId function_call 的 toolCallId
   * @param output 用户回答的内容
   * @param status 更新后的状态，默认 'completed'
   */
  async updateToolResult(conversationId, recordId, callId, output, status = "completed") {
    const outputStr = typeof output === "string" ? output : JSON.stringify(output);
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      const { data } = await collection.where({
        conversationId: _.eq(conversationId),
        recordId: _.eq(recordId)
      }).limit(1).get();
      if (!data || data.length === 0) return;
      const record = data[0];
      const parts = [...record.parts || []];
      const toolResultIndex = parts.findIndex((p) => p.contentType === "tool_result" && p.toolCallId === callId);
      if (toolResultIndex >= 0) {
        parts[toolResultIndex] = {
          ...parts[toolResultIndex],
          content: outputStr,
          metadata: {
            ...parts[toolResultIndex].metadata || {},
            status
          }
        };
      } else {
        const toolCallIndex = parts.findIndex((p) => p.contentType === "tool_call" && p.toolCallId === callId);
        if (toolCallIndex >= 0) {
          parts.push({
            partId: uuidv4(),
            contentType: "tool_result",
            toolCallId: callId,
            content: outputStr,
            metadata: { status }
          });
        }
      }
      await collection.where({
        conversationId: _.eq(conversationId),
        recordId: _.eq(recordId)
      }).update({
        parts,
        updateTime: Date.now()
      });
    } catch (error) {
      console.error("Failed to update tool result:", error);
    }
  }
  /**
   * 获取对话历史，返回消息列表和工具调用列表
   */
  async getChatHistory(conversationId, envId, userId) {
    const records = await this.loadDBMessages(conversationId, envId, userId);
    const messages = [];
    const toolCallMap = /* @__PURE__ */ new Map();
    for (const record of records) {
      const role = record.role;
      const timestamp = record.createTime || Date.now();
      for (const part of record.parts || []) {
        if (part.contentType === "text") {
          const content = part.content || "";
          if (content) {
            messages.push({ id: record.recordId, role, content, timestamp });
          }
        } else if (part.contentType === "tool_call" && part.toolCallId) {
          const metadata = part.metadata;
          const toolName = metadata?.toolCallName || "";
          let input = {};
          if (part.content) {
            try {
              input = JSON.parse(part.content);
            } catch {
            }
          }
          toolCallMap.set(part.toolCallId, {
            id: part.toolCallId,
            name: toolName,
            input,
            status: "completed"
          });
        } else if (part.contentType === "tool_result" && part.toolCallId) {
          const existing = toolCallMap.get(part.toolCallId);
          const metadata = part.metadata;
          const isError = metadata?.status === "error";
          if (existing) {
            existing.output = part.content || "";
            existing.status = isError ? "error" : "completed";
          } else {
            toolCallMap.set(part.toolCallId, {
              id: part.toolCallId,
              name: "",
              input: {},
              output: part.content || "",
              status: isError ? "error" : "completed"
            });
          }
        }
      }
    }
    return {
      messages,
      toolCalls: Array.from(toolCallMap.values())
    };
  }
  /**
   * 获取工具调用信息（用于 resume 时手动执行工具）
   *
   * @param conversationId 会话 ID
   * @param recordId 消息记录 ID
   * @param callId function_call 的 toolCallId
   * @returns 工具名称和参数，或 null
   */
  async getToolCallInfo(conversationId, recordId, callId) {
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      const { data } = await collection.where({
        conversationId: _.eq(conversationId),
        recordId: _.eq(recordId)
      }).limit(1).get();
      if (!data || data.length === 0) return null;
      const record = data[0];
      const parts = record.parts || [];
      const toolCallPart = parts.find((p) => p.contentType === "tool_call" && p.toolCallId === callId);
      if (!toolCallPart) return null;
      const metadata = toolCallPart.metadata;
      const toolName = metadata?.toolCallName;
      const inputStr = toolCallPart.content;
      let input = {};
      if (inputStr) {
        try {
          input = JSON.parse(inputStr);
        } catch {
        }
      }
      return toolName ? { toolName, input } : null;
    } catch {
      return null;
    }
  }
  /**
   * 删除指定会话的所有消息记录
   *
   * @param conversationId 会话 ID
   * @param envId 用户环境 ID
   * @param userId 用户 ID
   */
  async deleteConversationMessages(conversationId, envId, userId) {
    try {
      const collection = await this.getCollection();
      const app8 = await this.getCloudBaseApp();
      const _ = app8.database().command;
      await collection.where({
        conversationId: _.eq(conversationId),
        envId: _.eq(envId),
        userId: _.eq(userId),
        agentId: _.eq(AGENT_ID)
      }).remove();
    } catch {
      console.error("Failed to delete conversation messages");
    }
  }
};
var persistenceService = new PersistenceService();

// src/sandbox/scf-sandbox-manager.ts
import CloudBase3 from "@cloudbase/manager-node";
import { sign } from "@cloudbase/signature-nodejs";
var SandboxInstance = class _SandboxInstance {
  constructor(deps, ctx) {
    this.deps = deps;
    this.functionName = ctx.functionName;
    this.conversationId = ctx.conversationId;
    this.envId = ctx.envId;
    this.sandboxEnvId = this.deps.sandboxEnvId;
    this.baseUrl = `https://${this.deps.sandboxEnvId}.api.tcloudbasegateway.com/v1/functions/${ctx.functionName}`;
    this.status = ctx.status;
    this.mode = ctx.mode;
    this.mcpConfig = ctx.mcpConfig;
  }
  deps;
  functionName;
  conversationId;
  envId;
  sandboxEnvId;
  baseUrl;
  status;
  mode;
  mcpConfig;
  async getAccessToken() {
    return this.deps.getAccessToken();
  }
  static buildAuthHeaders(accessToken, sessionId) {
    return {
      Authorization: `Bearer ${accessToken}`,
      "X-Cloudbase-Session-Id": sessionId,
      "X-Tcb-Webfn": "true"
    };
  }
  async getAuthHeaders() {
    const accessToken = await this.getAccessToken();
    return {
      ..._SandboxInstance.buildAuthHeaders(accessToken, this.envId),
      "X-Conversation-Id": this.conversationId
    };
  }
  async getToolOverrideConfig() {
    return {
      url: this.baseUrl,
      headers: await this.getAuthHeaders()
    };
  }
  async request(path5, options = {}) {
    return fetch(`${this.baseUrl}${path5}`, {
      ...options,
      headers: {
        ...await this.getAuthHeaders(),
        ...options.headers
      }
    });
  }
};
var ScfSandboxManager = class {
  config = {
    timeoutMs: 30 * 60 * 1e3,
    maxCacheSize: 50,
    functionPrefix: "sandbox",
    runtime: "Nodejs16.13",
    memory: 2048,
    timeout: 900
  };
  cachedAccessToken = null;
  getEnvConfig() {
    return {
      envId: process.env.TCB_ENV_ID || "",
      secretId: process.env.TCB_SECRET_ID || "",
      secretKey: process.env.TCB_SECRET_KEY || "",
      token: process.env.TCB_TOKEN || "",
      functionPrefix: process.env.SCF_SANDBOX_FUNCTION_PREFIX || "sandbox",
      imageConfig: {
        ImageType: process.env.SCF_SANDBOX_IMAGE_TYPE || "personal",
        ImageUri: process.env.SCF_SANDBOX_IMAGE_URI || "",
        ContainerImageAccelerate: process.env.SCF_SANDBOX_IMAGE_ACCELERATE === "true",
        ImagePort: parseInt(process.env.SCF_SANDBOX_IMAGE_PORT || "9000", 10)
      }
    };
  }
  async getAdminAccessToken() {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiry) {
      return this.cachedAccessToken.token;
    }
    const envConfig = this.getEnvConfig();
    const { secretId, secretKey, token, envId } = envConfig;
    if (!secretId || !secretKey || !envId) {
      throw new Error("Missing TCB_SECRET_ID, TCB_SECRET_KEY or TCB_ENV_ID");
    }
    const host = `${envId}.api.tcloudbasegateway.com`;
    const url = `https://${host}/auth/v1/token/clientCredential`;
    const method = "POST";
    const headers = {
      "Content-Type": "application/json",
      Host: host
    };
    const data = { grant_type: "client_credentials" };
    const { authorization, timestamp } = sign({
      secretId,
      secretKey,
      method,
      url,
      headers,
      params: data,
      timestamp: Math.floor(Date.now() / 1e3) - 1,
      withSignedParams: false,
      isCloudApi: true
    });
    headers["Authorization"] = `${authorization}, Timestamp=${timestamp}${token ? `, Token=${token}` : ""}`;
    headers["X-Signature-Expires"] = "600";
    headers["X-Timestamp"] = String(timestamp);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(data)
      });
      const body = await res.json();
      const accessToken = body?.access_token;
      const expiresIn = body?.expires_in || 0;
      if (!accessToken) {
        throw new Error("clientCredential response missing access_token");
      }
      if (expiresIn) {
        this.cachedAccessToken = {
          token: accessToken,
          expiry: Date.now() + expiresIn * 1e3 / 2
        };
      } else {
        this.cachedAccessToken = {
          token: accessToken,
          expiry: Date.now() + 3600 * 1e3
        };
      }
      console.log("[ScfSandbox] Got admin access token, expires_in:", expiresIn);
      return accessToken;
    } catch (err) {
      console.error("[ScfSandbox] getAdminAccessToken failed:", err.message);
      throw err;
    }
  }
  async buildInstanceDeps() {
    const envConfig = this.getEnvConfig();
    return {
      sandboxEnvId: envConfig.envId,
      getAccessToken: () => this.getAdminAccessToken()
    };
  }
  async buildSandboxMcpConfig(functionName, scfSessionId, conversationId, sandboxEnvId) {
    const accessToken = await this.getAdminAccessToken();
    const url = `https://${sandboxEnvId}.api.tcloudbasegateway.com/v1/functions/${functionName}/mcp`;
    return {
      type: "http",
      url,
      headers: {
        ...SandboxInstance.buildAuthHeaders(accessToken, scfSessionId),
        "X-Conversation-Id": conversationId
      }
    };
  }
  async getOrCreate(conversationId, envId, options, onProgress) {
    const progress = onProgress || (() => {
    });
    const mode = options?.mode || "shared";
    const envConfig = this.getEnvConfig();
    const functionPrefix = envConfig.functionPrefix || this.config.functionPrefix;
    const functionKey = mode === "shared" ? "shared" : conversationId;
    const functionName = this.generateFunctionName(functionKey, functionPrefix);
    const { exists: functionExists } = await this.checkFunctionExists(functionName);
    if (functionExists) {
      await this.waitForFunctionReady(functionName);
      const instanceDeps = await this.buildInstanceDeps();
      const mcpConfig = await this.buildSandboxMcpConfig(functionName, envId, conversationId, instanceDeps.sandboxEnvId);
      return new SandboxInstance(instanceDeps, {
        functionName,
        conversationId,
        envId,
        status: "ready",
        mode,
        mcpConfig
      });
    }
    return this.createNewFunction(functionName, conversationId, envId, mode, options, progress);
  }
  /**
   * 获取已存在的沙箱实例（不创建新实例）
   * 适用于任务删除等场景，沙箱不存在时返回 null
   */
  async getExisting(conversationId, envId) {
    const envConfig = this.getEnvConfig();
    const functionPrefix = envConfig.functionPrefix || this.config.functionPrefix;
    const functionName = this.generateFunctionName("shared", functionPrefix);
    const { exists } = await this.checkFunctionExists(functionName);
    if (!exists) return null;
    const instanceDeps = await this.buildInstanceDeps();
    return new SandboxInstance(instanceDeps, {
      functionName,
      conversationId,
      envId,
      status: "ready",
      mode: "shared"
    });
  }
  async createNewFunction(functionName, conversationId, envId, mode, options, onProgress) {
    const progress = onProgress || (() => {
    });
    try {
      progress({ phase: "create", message: "\u6B63\u5728\u521B\u5EFA\u5DE5\u4F5C\u7A7A\u95F4...\n" });
      await this.createFunction(functionName);
      try {
        await Promise.all([this.waitForFunctionReady(functionName), this.createGatewayApi(functionName)]);
      } catch (networkError) {
        console.error(`[ScfSandbox] Network setup failed, rolling back: ${networkError.message}`);
        await this.deleteFunction(functionName).catch((delErr) => {
          console.warn(`[ScfSandbox] Failed to delete function during rollback: ${delErr.message}`);
        });
        throw new Error(`\u7F51\u7EDC\u914D\u7F6E\u5931\u8D25: ${networkError.message}`);
      }
      const instanceDeps = await this.buildInstanceDeps();
      const mcpConfig = await this.buildSandboxMcpConfig(functionName, envId, conversationId, instanceDeps.sandboxEnvId);
      return new SandboxInstance(instanceDeps, {
        functionName,
        conversationId,
        envId,
        status: "ready",
        mode,
        mcpConfig
      });
    } catch (error) {
      console.error(`[ScfSandbox] Creation failed: ${functionName}`);
      progress({ phase: "error", message: `\u5DE5\u4F5C\u7A7A\u95F4\u521B\u5EFA\u5931\u8D25: ${error.message}
` });
      throw new Error(`\u521B\u5EFA\u5DE5\u4F5C\u7A7A\u95F4\u5931\u8D25: ${error.message}`);
    }
  }
  generateFunctionName(cacheKey, prefix) {
    const sanitized = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `${prefix || this.config.functionPrefix}-${sanitized}`.substring(0, 60);
  }
  async createFunction(functionName) {
    const envConfig = this.getEnvConfig();
    try {
      const app8 = new CloudBase3({
        secretId: envConfig.secretId,
        secretKey: envConfig.secretKey,
        token: envConfig.token,
        envId: envConfig.envId
      });
      const createParams = {
        FunctionName: functionName,
        Namespace: envConfig.envId,
        Stamp: "MINI_QCBASE",
        Role: "TCB_QcsRole",
        Code: {
          ImageConfig: envConfig.imageConfig
        },
        Type: "HTTP",
        ProtocolType: "WS",
        ProtocolParams: {
          WSParams: {
            IdleTimeOut: 7200
          }
        },
        MemorySize: this.config.memory,
        DiskSize: 1024,
        Timeout: this.config.timeout,
        InitTimeout: 90,
        InstanceConcurrencyConfig: {
          MaxConcurrency: 100,
          DynamicEnabled: "FALSE",
          InstanceIsolationEnabled: "TRUE",
          Type: "Session-Based",
          SessionConfig: {
            SessionSource: "HEADER",
            SessionName: "X-Cloudbase-Session-Id",
            MaximumConcurrencySessionPerInstance: 1,
            MaximumTTLInSeconds: 600,
            MaximumIdleTimeInSeconds: 300,
            IdleTimeoutStrategy: "PAUSE"
          }
        },
        Environment: {
          Variables: this.buildGitArchiveVars()
        },
        Description: "SCF Sandbox for conversation (Image-based)"
      };
      await app8.commonService("scf").call({
        Action: "CreateFunction",
        Param: createParams
      });
    } catch (error) {
      if (error.message?.includes("already exists") || error.code === "ResourceInUse") {
        console.warn(`[ScfSandbox] Function already exists: ${functionName}`);
        return;
      }
      throw error;
    }
  }
  async createGatewayApi(functionName) {
    const envConfig = this.getEnvConfig();
    try {
      const app8 = new CloudBase3({
        secretId: envConfig.secretId,
        secretKey: envConfig.secretKey,
        token: envConfig.token,
        envId: envConfig.envId
      });
      const domain = `${envConfig.envId}.ap-shanghai.app.tcloudbase.com`;
      await app8.commonService().call({
        Action: "CreateCloudBaseGWAPI",
        Param: {
          ServiceId: envConfig.envId,
          Name: functionName,
          Path: `/${functionName}/preview`,
          Type: 6,
          EnableUnion: true,
          AuthSwitch: 2,
          PathTransmission: 1,
          EnableRegion: true,
          Domain: domain
        }
      });
    } catch (error) {
      if (error.message?.includes("already exists") || error.message?.includes("ResourceInUse") || error.code === "ResourceInUse") {
        console.warn(`[ScfSandbox] Gateway API already exists: ${functionName}`);
        return;
      }
      throw error;
    }
  }
  async checkFunctionExists(functionName) {
    const envConfig = this.getEnvConfig();
    try {
      const app8 = new CloudBase3({
        secretId: envConfig.secretId,
        secretKey: envConfig.secretKey,
        token: envConfig.token,
        envId: envConfig.envId
      });
      const result = await app8.commonService().call({
        Action: "GetFunction",
        Param: {
          FunctionName: functionName,
          EnvId: envConfig.envId,
          Namespace: envConfig.envId,
          ShowCode: "TRUE"
        }
      });
      if (!result || result.Status === void 0) {
        return { exists: false };
      }
      const currentImageUri = result.ImageConfig?.ImageUri;
      return { exists: true, currentImageUri };
    } catch {
      return { exists: false };
    }
  }
  async waitForFunctionReady(functionName, maxRetries = 120, retryInterval = 3e3) {
    const envConfig = this.getEnvConfig();
    const app8 = new CloudBase3({
      secretId: envConfig.secretId,
      secretKey: envConfig.secretKey,
      token: envConfig.token,
      envId: envConfig.envId
    });
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await app8.commonService().call({
          Action: "GetFunction",
          Param: {
            FunctionName: functionName,
            EnvId: envConfig.envId,
            Namespace: envConfig.envId,
            ShowCode: "TRUE"
          }
        });
        const status = result?.Status;
        if (status === "Active" || status === "active" || status === "Running" || status === "running") {
          return;
        }
      } catch (error) {
        if (error.code === "ResourceNotFound" || error.message?.includes("ResourceNotFound") || error.message?.includes("not exist") || error.message?.includes("not found")) {
          throw new Error(`Function ${functionName} does not exist`);
        }
        if (i < 5) {
          console.warn(`[ScfSandbox] Check function status error: ${error.message}`);
        }
      }
      await new Promise((resolve2) => setTimeout(resolve2, retryInterval));
    }
    throw new Error(
      `Function ${functionName} not ready after ${maxRetries} retries (${maxRetries * retryInterval / 1e3}s)`
    );
  }
  buildGitArchiveVars() {
    const repo = process.env.GIT_ARCHIVE_REPO;
    const token = process.env.GIT_ARCHIVE_TOKEN;
    const user = process.env.GIT_ARCHIVE_USER;
    if (!repo || !token) return [];
    return [
      { Key: "GIT_ARCHIVE_REPO", Value: repo },
      { Key: "GIT_ARCHIVE_TOKEN", Value: token },
      { Key: "GIT_ARCHIVE_USER", Value: user || "" }
    ];
  }
  async deleteFunction(functionName) {
    const envConfig = this.getEnvConfig();
    try {
      const app8 = new CloudBase3({
        secretId: envConfig.secretId,
        secretKey: envConfig.secretKey,
        token: envConfig.token,
        envId: envConfig.envId
      });
      await app8.commonService().call({
        Action: "DeleteFunction",
        Param: {
          FunctionName: functionName,
          Namespace: envConfig.envId
        }
      });
    } catch (error) {
      console.warn(`[ScfSandbox] Delete function error: ${error.message}`);
    }
  }
};
var scfSandboxManager = new ScfSandboxManager();

// src/sandbox/sandbox-mcp-proxy.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { tool as sdkTool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
var AuthRequiredError = class extends Error {
  constructor(status) {
    super(`MCP_AUTH_REQUIRED: gateway returned ${status}`);
    this.name = "AuthRequiredError";
  }
};
function jsonSchemaToZodRawShape(schema) {
  if (!schema || schema.type !== "object" || !schema.properties) {
    return {};
  }
  const shape = {};
  const required = new Set(schema.required || []);
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let zodType = jsonSchemaPropertyToZod(propSchema);
    if (!required.has(key)) {
      zodType = zodType.optional();
    }
    shape[key] = zodType;
  }
  return shape;
}
function jsonSchemaPropertyToZod(propSchema) {
  if (!propSchema) return z.any();
  const { type, description, enum: enumValues, items, properties, required } = propSchema;
  let zodType;
  if (enumValues && Array.isArray(enumValues)) {
    zodType = z.enum(enumValues);
  } else if (type === "string") {
    zodType = z.string();
  } else if (type === "number" || type === "integer") {
    zodType = z.number();
  } else if (type === "boolean") {
    zodType = z.boolean();
  } else if (type === "array") {
    const itemType = items ? jsonSchemaPropertyToZod(items) : z.any();
    zodType = z.array(itemType);
  } else if (type === "object") {
    if (properties) {
      const shape = {};
      const reqSet = new Set(required || []);
      for (const [k, v] of Object.entries(properties)) {
        let propType = jsonSchemaPropertyToZod(v);
        if (!reqSet.has(k)) propType = propType.optional();
        shape[k] = propType;
      }
      zodType = z.object(shape);
    } else {
      zodType = z.record(z.string(), z.any());
    }
  } else {
    zodType = z.any();
  }
  if (description) {
    zodType = zodType.describe(description);
  }
  return zodType;
}
async function createSandboxMcpClient(deps) {
  const {
    baseUrl,
    scfSessionId,
    conversationId,
    getAccessToken,
    getCredentials,
    bashTimeoutMs = 3e4,
    workspaceFolderPaths = "",
    log = (msg) => console.log(msg),
    onDeployUrl,
    getMpDeployCredentials
  } = deps;
  async function buildHeaders() {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      ...SandboxInstance.buildAuthHeaders(token, scfSessionId),
      "X-Conversation-Id": conversationId
    };
  }
  async function apiCall(tool, body, timeoutMs = bashTimeoutMs) {
    const headers = await buildHeaders();
    const res = await fetch(`${baseUrl}/api/tools/${tool}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.status === 401 || res.status === 403) {
      throw new AuthRequiredError(res.status);
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? `${tool} call failed`);
    return data.result;
  }
  async function bashCall(command, timeoutMs = bashTimeoutMs) {
    return apiCall("bash", { command, timeout: timeoutMs }, timeoutMs);
  }
  async function injectCredentials() {
    const creds = await getCredentials();
    const headers = await buildHeaders();
    const res = await fetch(`${baseUrl}/api/session/env`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        conversationId,
        CLOUDBASE_ENV_ID: creds.cloudbaseEnvId,
        TENCENTCLOUD_SECRETID: creds.secretId,
        TENCENTCLOUD_SECRETKEY: creds.secretKey,
        TENCENTCLOUD_SESSIONTOKEN: creds.sessionToken ?? "",
        INTEGRATION_IDE: "codebuddy",
        WORKSPACE_FOLDER_PATHS: workspaceFolderPaths
      })
    });
    if (res.status === 401 || res.status === 403) throw new AuthRequiredError(res.status);
    const data = await res.json();
    if (!data.success) throw new Error(`Failed to inject credentials: ${data.error}`);
  }
  async function fetchCloudbaseSchema() {
    const tmpPath = `.mcporter-schema.json`;
    await bashCall(`mcporter list cloudbase --schema --output json > ${tmpPath} 2>&1`, 2e4);
    const headers = await buildHeaders();
    const res = await fetch(`${baseUrl}/e2b-compatible/files?path=${encodeURIComponent(tmpPath)}`, {
      headers
    });
    if (!res.ok) throw new Error(`Failed to read schema file: ${res.status}`);
    const parsed = await res.json();
    if (!Array.isArray(parsed.tools)) throw new Error("No tools array in schema response");
    return parsed.tools;
  }
  function serializeFnCall(toolName, args) {
    if (!args || Object.keys(args).length === 0) return `cloudbase.${toolName}()`;
    const parts = Object.entries(args).map(([k, v]) => {
      if (v === void 0 || v === null) return null;
      if (typeof v === "string") return `${k}: ${JSON.stringify(v)}`;
      if (typeof v === "boolean" || typeof v === "number") return `${k}: ${v}`;
      return `${k}: ${JSON.stringify(v)}`;
    }).filter(Boolean).join(", ");
    return `cloudbase.${toolName}(${parts})`;
  }
  async function mcporterCall(toolName, args) {
    const expr = serializeFnCall(toolName, args);
    const escaped = expr.replace(/'/g, "'\\''");
    const cmd = `mcporter call '${escaped}' 2>&1`;
    log(`[sandbox-mcp] bash cmd: ${cmd}
`);
    return bashCall(cmd, 6e4);
  }
  function isFilePath(localPath) {
    const basename = localPath.replace(/\/+$/, "").split("/").pop() || "";
    return /\.[a-zA-Z0-9]+$/.test(basename);
  }
  function extractDeployUrl(rawText, isFile = false, depth = 0) {
    if (depth > 5) return null;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const firstText = parsed[0]?.text;
        if (typeof firstText === "string") return extractDeployUrl(firstText, isFile, depth + 1);
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      if (parsed.accessUrl) {
        const url = new URL(parsed.accessUrl);
        if (!isFile && url.pathname !== "/" && !url.pathname.endsWith("/")) url.pathname += "/";
        if (!url.searchParams.get("t")) url.searchParams.set("t", String(Date.now()));
        return url.toString();
      }
      if (parsed.staticDomain) return `https://${parsed.staticDomain}/?t=${Date.now()}`;
      const innerText = parsed?.res?.content?.[0]?.text || parsed?.content?.[0]?.text;
      if (typeof innerText === "string") return extractDeployUrl(innerText, isFile, depth + 1);
    } catch {
    }
    return null;
  }
  function isCredentialError(output) {
    return output.includes("AUTH_REQUIRED") || output.includes("The SecretId is not found") || output.includes("SecretId is not found") || output.includes("InvalidParameter.SecretIdNotFound") || output.includes("AuthFailure");
  }
  try {
    await injectCredentials();
    log(`[sandbox-mcp] Credentials injected successfully
`);
  } catch (e) {
    log(`[sandbox-mcp] Failed to inject credentials: ${e.message}
`);
  }
  let cloudbaseTools = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      cloudbaseTools = await fetchCloudbaseSchema();
      log(`[sandbox-mcp] Discovered ${cloudbaseTools.length} CloudBase tools (attempt ${attempt})
`);
      break;
    } catch (e) {
      log(`[sandbox-mcp] Schema fetch failed (attempt ${attempt}/3): ${e.message}
`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3e3));
      else log(`[sandbox-mcp] Starting in degraded mode (workspace tools only)
`);
    }
  }
  const server = new McpServer({ name: "cloudbase-sandbox-proxy", version: "2.0.0" });
  const SKIP = /* @__PURE__ */ new Set(["logout"]);
  for (const tool of cloudbaseTools) {
    if (SKIP.has(tool.name)) continue;
    if (tool.name === "login") {
      server.tool(
        "login",
        "Re-authenticate CloudBase credentials for this workspace session. No parameters needed.",
        {},
        async () => {
          try {
            await injectCredentials();
            return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
          } catch (e) {
            return {
              content: [{ type: "text", text: JSON.stringify({ ok: false, message: e.message }) }],
              isError: true
            };
          }
        }
      );
      continue;
    }
    const zodShape = jsonSchemaToZodRawShape(tool.inputSchema);
    server.tool(
      tool.name,
      (tool.description ?? `CloudBase tool: ${tool.name}`) + "\n\nNOTE: localPath refers to paths inside the container workspace.",
      zodShape,
      async (args) => {
        if (tool.name === "downloadTemplate") args = { ...args, ide: "codebuddy" };
        const attemptCall = async () => {
          const result = await mcporterCall(tool.name, args);
          return result.output ?? "";
        };
        try {
          let output = await attemptCall();
          if (isCredentialError(output)) {
            log(`[sandbox-mcp] Credential error for ${tool.name}, re-injecting...
`);
            await injectCredentials();
            output = await attemptCall();
            if (isCredentialError(output)) {
              return {
                content: [
                  {
                    type: "text",
                    text: output + "\n\nCredential re-injection attempted but error persists."
                  }
                ],
                isError: true
              };
            }
          }
          return { content: [{ type: "text", text: output }] };
        } catch (e) {
          return {
            content: [{ type: "text", text: `Error: ${e.message}` }],
            isError: true
          };
        }
      }
    );
  }
  if (cloudbaseTools.length === 0) {
    server.tool("__noop__", "Placeholder tool. CloudBase tools are unavailable in degraded mode.", {}, async () => ({
      content: [{ type: "text", text: "CloudBase tools unavailable (degraded mode)" }],
      isError: true
    }));
  }
  server.tool(
    "auth",
    'Re-authenticate and inject fresh CloudBase credentials. Call with action "start_auth" when credentials expire.',
    { action: z.enum(["start_auth"]).describe("Authentication action") },
    async () => {
      try {
        await injectCredentials();
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: true, message: "Credentials refreshed" }) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, message: e.message }) }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "publishMiniprogram",
    "\u5C0F\u7A0B\u5E8F\u53D1\u5E03/\u9884\u89C8\u5DE5\u5177\u3002\u652F\u6301\u9884\u89C8\uFF08preview\uFF09\u548C\u4E0A\u4F20\uFF08upload\uFF09\u4E24\u79CD\u64CD\u4F5C\u3002\u9884\u89C8\u4F1A\u751F\u6210\u4E8C\u7EF4\u7801\u4F9B\u626B\u7801\u4F53\u9A8C\uFF0C\u4E0A\u4F20\u4F1A\u5C06\u4EE3\u7801\u63D0\u4EA4\u5230\u5FAE\u4FE1\u540E\u53F0\u3002\u90E8\u7F72\u53EF\u80FD\u8017\u65F6\u8F83\u957F\uFF0C\u82E5\u8D85\u8FC7 60s \u672A\u5B8C\u6210\u4F1A\u8FD4\u56DE async=true \u548C jobId\uFF0C\u8BF7\u4F7F\u7528 getDeployJobStatus \u5DE5\u5177\u67E5\u8BE2\u7ED3\u679C\u3002",
    {
      action: z.enum(["preview", "upload"]).describe("\u64CD\u4F5C\u7C7B\u578B\uFF1Apreview=\u9884\u89C8, upload=\u4E0A\u4F20"),
      projectPath: z.string().describe("\u5C0F\u7A0B\u5E8F\u9879\u76EE\u8DEF\u5F84\uFF08\u6C99\u7BB1\u5185\u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF09"),
      appId: z.string().describe("\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F AppId"),
      version: z.string().optional().describe('\u7248\u672C\u53F7\uFF08upload \u65F6\u5EFA\u8BAE\u63D0\u4F9B\uFF0C\u5982 "1.0.0"\uFF09'),
      description: z.string().optional().describe("\u7248\u672C\u63CF\u8FF0"),
      robot: z.number().optional().describe("CI \u673A\u5668\u4EBA\u7F16\u53F7\uFF081-30\uFF09\uFF0C\u9ED8\u8BA4 1")
    },
    async (args) => {
      try {
        let privateKey;
        const appId = args.appId;
        if (getMpDeployCredentials) {
          const creds = await getMpDeployCredentials(appId);
          if (creds) {
            privateKey = creds.privateKey;
          }
        }
        if (!privateKey) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  message: `\u672A\u627E\u5230 appId ${appId} \u7684\u90E8\u7F72\u5BC6\u94A5\uFF0C\u8BF7\u5148\u5728\u5C0F\u7A0B\u5E8F\u7BA1\u7406\u4E2D\u5173\u8054\u8BE5 appId`
                })
              }
            ],
            isError: true
          };
        }
        const headers = await buildHeaders();
        const res = await fetch(`${baseUrl}/api/miniprogram/deploy`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            appid: appId,
            privateKey,
            action: args.action,
            projectPath: args.projectPath,
            version: args.version,
            description: args.description,
            robot: args.robot
          }),
          signal: AbortSignal.timeout(12e4)
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  status: res.status,
                  message: body?.error || body?.message || `HTTP ${res.status}`
                })
              }
            ],
            isError: true
          };
        }
        if (body.async) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  async: true,
                  jobId: body.jobId,
                  message: "\u90E8\u7F72\u4ECD\u5728\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u4F7F\u7528 getDeployJobStatus \u5DE5\u5177\u67E5\u8BE2\u7ED3\u679C"
                })
              }
            ]
          };
        }
        if (!body.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  message: body.error || body.result?.errMsg || "Deploy failed",
                  result: body.result
                })
              }
            ],
            isError: true
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(body) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: true, message: e.message }) }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "getDeployJobStatus",
    "\u67E5\u8BE2\u5C0F\u7A0B\u5E8F\u53D1\u5E03/\u9884\u89C8\u4EFB\u52A1\u7684\u72B6\u6001\u3002\u5F53 publishMiniprogram \u8FD4\u56DE async=true \u65F6\u4F7F\u7528\u6B64\u5DE5\u5177\u8F6E\u8BE2\u7ED3\u679C\u3002",
    { jobId: z.string().describe("publishMiniprogram \u8FD4\u56DE\u7684 jobId") },
    async (args) => {
      try {
        const headers = await buildHeaders();
        const res = await fetch(
          `${baseUrl}/api/miniprogram/deploy/status?jobId=${encodeURIComponent(args.jobId)}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(3e4)
          }
        );
        const body = await res.json().catch(() => null);
        return {
          content: [{ type: "text", text: JSON.stringify(body ?? { error: true, status: res.status }) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: true, message: e.message }) }],
          isError: true
        };
      }
    }
  );
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "cloudbase-agent", version: "1.0.0" });
  await client.connect(clientTransport);
  const sdkTools = cloudbaseTools.filter((t) => t.name !== "logout").map((t) => {
    const zodShape = jsonSchemaToZodRawShape(t.inputSchema);
    return sdkTool(
      t.name,
      (t.description ?? `CloudBase tool: ${t.name}`) + "\n\nNOTE: localPath refers to paths inside the container workspace.",
      zodShape,
      async (args) => {
        try {
          const result = await mcporterCall(t.name, args);
          const output = result.output ?? "";
          if (t.name === "uploadFiles" && onDeployUrl && output) {
            try {
              const deployUrl = extractDeployUrl(output, isFilePath(String(args.localPath || "")));
              if (deployUrl) {
                log(`[sandbox-mcp] deploy_url detected: ${deployUrl}
`);
                onDeployUrl(deployUrl);
              }
            } catch {
            }
          }
          return { content: [{ type: "text", text: output }] };
        } catch (e) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
      }
    );
  });
  sdkTools.push(
    sdkTool(
      "auth",
      'Re-authenticate and inject fresh CloudBase credentials. Call with action "start_auth" when credentials expire.',
      { action: z.enum(["start_auth"]).describe("Authentication action") },
      async () => {
        try {
          await injectCredentials();
          return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        } catch (e) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
      }
    )
  );
  sdkTools.push(
    sdkTool(
      "publishMiniprogram",
      "\u5C0F\u7A0B\u5E8F\u53D1\u5E03/\u9884\u89C8\u5DE5\u5177\u3002\u652F\u6301\u9884\u89C8\uFF08preview\uFF09\u548C\u4E0A\u4F20\uFF08upload\uFF09\u4E24\u79CD\u64CD\u4F5C\u3002",
      {
        action: z.enum(["preview", "upload"]).describe("\u64CD\u4F5C\u7C7B\u578B"),
        projectPath: z.string().describe("\u5C0F\u7A0B\u5E8F\u9879\u76EE\u8DEF\u5F84"),
        appId: z.string().describe("\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F AppId"),
        version: z.string().optional().describe("\u7248\u672C\u53F7"),
        description: z.string().optional().describe("\u7248\u672C\u63CF\u8FF0"),
        robot: z.number().optional().describe("CI \u673A\u5668\u4EBA\u7F16\u53F7")
      },
      async (args) => {
        try {
          let privateKey;
          const appId = args.appId;
          if (getMpDeployCredentials) {
            const creds = await getMpDeployCredentials(appId);
            if (creds) privateKey = creds.privateKey;
          }
          if (!privateKey) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: true, message: `\u672A\u627E\u5230 appId ${appId} \u7684\u90E8\u7F72\u5BC6\u94A5` })
                }
              ],
              isError: true
            };
          }
          const headers = await buildHeaders();
          const res = await fetch(`${baseUrl}/api/miniprogram/deploy`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              appid: appId,
              privateKey,
              action: args.action,
              projectPath: args.projectPath,
              version: args.version,
              description: args.description,
              robot: args.robot
            }),
            signal: AbortSignal.timeout(12e4)
          });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: true, status: res.status }) }],
              isError: true
            };
          }
          return { content: [{ type: "text", text: JSON.stringify(body) }] };
        } catch (e) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
      }
    )
  );
  sdkTools.push(
    sdkTool(
      "getDeployJobStatus",
      "\u67E5\u8BE2\u5C0F\u7A0B\u5E8F\u53D1\u5E03/\u9884\u89C8\u4EFB\u52A1\u7684\u72B6\u6001\u3002",
      { jobId: z.string().describe("publishMiniprogram \u8FD4\u56DE\u7684 jobId") },
      async (args) => {
        try {
          const headers = await buildHeaders();
          const res = await fetch(
            `${baseUrl}/api/miniprogram/deploy/status?jobId=${encodeURIComponent(args.jobId)}`,
            {
              method: "GET",
              headers,
              signal: AbortSignal.timeout(3e4)
            }
          );
          const body = await res.json().catch(() => null);
          return {
            content: [{ type: "text", text: JSON.stringify(body ?? { error: true, status: res.status }) }]
          };
        } catch (e) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
      }
    )
  );
  const sdkServer = createSdkMcpServer({
    name: "cloudbase",
    version: "1.0.0",
    tools: sdkTools
  });
  log(
    `[sandbox-mcp] Ready. baseUrl=${baseUrl} session=${scfSessionId} conversation=${conversationId} tools=${cloudbaseTools.length}
`
  );
  return {
    client,
    server,
    sdkServer,
    close: async () => {
      try {
        await client.close();
      } catch {
      }
      try {
        await server.close();
      } catch {
      }
    }
  };
}

// src/sandbox/git-archive.ts
function getConfig() {
  const repo = process.env.GIT_ARCHIVE_REPO;
  const token = process.env.GIT_ARCHIVE_TOKEN;
  const user = process.env.GIT_ARCHIVE_USER;
  if (!repo || !token) {
    return null;
  }
  let apiDomain = "https://api.cnb.cool";
  try {
    const url = new URL(repo);
    apiDomain = `https://api.${url.hostname}`;
  } catch {
  }
  return { repo, token, user, apiDomain };
}
async function archiveToGit(sandbox, conversationId, prompt) {
  if (!conversationId) return;
  const config = getConfig();
  if (!config) {
    console.log("[GitArchive] Not configured, skipping archive");
    return;
  }
  try {
    const promptSummary = prompt.slice(0, 50).replace(/\n/g, " ");
    const commitMessage = `${conversationId}: ${promptSummary}`;
    const gitPushRes = await sandbox.request("/api/tools/git_push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage }),
      signal: AbortSignal.timeout(3e4)
    });
    if (gitPushRes.ok) {
      console.log("[GitArchive] Push completed");
    } else {
      console.warn(`[GitArchive] Push failed: status=${gitPushRes.status}`);
    }
  } catch (err) {
    console.error("[GitArchive] Error:", err?.message);
  }
}
async function deleteConversationViaSandbox(sandbox, envId, conversationId) {
  const workspace = `/tmp/workspace/${envId}/${conversationId}`;
  try {
    const res = await sandbox.request("/api/tools/bash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: `rm -rf "${workspace}"`, timeout: 1e4 }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return;
    }
    await archiveToGit(sandbox, conversationId, `delete conversation ${conversationId}`);
  } catch (err) {
    console.warn(`[GitArchive] deleteConversationViaSandbox failed: ${err.message}`);
  }
}

// src/agent/cloudbase-agent.service.ts
var DEFAULT_MODEL = "glm-5.0";
var OAUTH_TOKEN_ENDPOINT = "https://copilot.tencent.com/oauth2/token";
var CONNECT_TIMEOUT_MS = 6e4;
var ITERATION_TIMEOUT_MS = 45 * 1e3;
var HEALTH_MAX_RETRIES = 20;
var HEALTH_INTERVAL_MS = 2e3;
var cachedModels = null;
var STATIC_MODELS = [
  { id: "minimax-m2.5", name: "MiniMax-M2.5" },
  { id: "kimi-k2.5", name: "Kimi-K2.5" },
  { id: "kimi-k2-thinking", name: "Kimi-K2-Thinking" },
  { id: "glm-5.0", name: "GLM-5.0" },
  { id: "glm-4.7", name: "GLM-4.7" },
  { id: "deepseek-v3-2-volc", name: "DeepSeek-V3.2" }
];
async function getSupportedModels() {
  if (cachedModels) return cachedModels;
  cachedModels = STATIC_MODELS;
  return cachedModels;
}
async function waitForSandboxHealth(sandbox, callback) {
  for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
    try {
      const res = await sandbox.request("/health", {
        signal: AbortSignal.timeout(4e3)
      });
      if (res.ok) {
        console.log("[Agent] Sandbox health check passed");
        return true;
      }
    } catch {
    }
    if (i === 0) {
      callback({ type: "text", content: "\u6B63\u5728\u7B49\u5F85\u5DE5\u4F5C\u7A7A\u95F4\u5C31\u7EEA...\n" });
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  return false;
}
async function initSandboxWorkspace(sandbox, secret, conversationId) {
  try {
    const res = await sandbox.request("/api/session/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        env: {
          CLOUDBASE_ENV_ID: secret.envId,
          TENCENTCLOUD_SECRETID: secret.secretId,
          TENCENTCLOUD_SECRETKEY: secret.secretKey,
          ...secret.token ? { TENCENTCLOUD_SESSIONTOKEN: secret.token } : {}
        }
      }),
      signal: AbortSignal.timeout(15e3)
    });
    if (res.ok) {
      const workspace = `/tmp/workspace/${secret.envId}/${conversationId}`;
      console.log("[Agent] initSandboxWorkspace success, workspace:", workspace);
      const mkdirRes = await sandbox.request("/api/tools/bash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `mkdir -p "${workspace}"`,
          timeout: 5e3
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (mkdirRes.ok) {
        console.log("[Agent] Workspace directory created:", workspace);
      }
      return workspace;
    }
    console.error("[Agent] initSandboxWorkspace failed, status:", res.status);
  } catch (e) {
    console.error("[Agent] initSandboxWorkspace error:", e.message);
  }
  return void 0;
}
var WRITE_TOOLS = true ? /* @__PURE__ */ new Set([]) : /* @__PURE__ */ new Set([
  // 数据库相关 (4个)
  "writeNoSqlDatabaseStructure",
  // 修改 NoSQL 数据库结构
  "writeNoSqlDatabaseContent",
  // 修改 NoSQL 数据库内容
  "executeWriteSQL",
  // 执行写入 SQL
  "modifyDataModel",
  // 修改数据模型
  // 云函数相关 (7个)
  "createFunction",
  // 创建云函数
  "updateFunctionCode",
  // 更新云函数代码
  "updateFunctionConfig",
  // 更新云函数配置
  "invokeFunction",
  // 调用云函数
  "manageFunctionTriggers",
  // 管理云函数触发器
  "writeFunctionLayers",
  // 管理云函数层
  "createFunctionHTTPAccess",
  // 创建云函数 HTTP 访问
  // 存储相关 (2个) - uploadFiles 不拦截（静态托管部署需要）
  "deleteFiles",
  // 删除文件
  "manageStorage",
  // 管理云存储
  // 其他 (5个)
  "domainManagement",
  // 域名管理
  "interactiveDialog",
  // 交互式对话
  "manageCloudRun",
  // 管理云托管
  "writeSecurityRule",
  // 写入安全规则
  "activateInviteCode",
  // 激活邀请码
  "callCloudApi"
  // 调用云 API
]);
var cachedToken = null;
async function getOAuthToken() {
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token;
  }
  const clientId = process.env.CODEBUDDY_CLIENT_ID;
  const clientSecret = process.env.CODEBUDDY_CLIENT_SECRET;
  const endpoint = process.env.CODEBUDDY_OAUTH_ENDPOINT || OAUTH_TOKEN_ENDPOINT;
  if (!clientId || !clientSecret) {
    throw new Error("Missing CODEBUDDY_CLIENT_ID or CODEBUDDY_CLIENT_SECRET environment variables");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }).toString()
  });
  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status}`);
  }
  const data = await response.json();
  if (!data.access_token) {
    throw new Error("OAuth2 response missing access_token");
  }
  const token = data.access_token;
  const expiresIn = data.expires_in || 3600;
  const expiry = Date.now() + expiresIn * 1e3 - 6e4;
  cachedToken = { token, expiry };
  return token;
}
function createToolCallTracker() {
  return {
    pendingToolCalls: /* @__PURE__ */ new Map(),
    blockIndexToToolId: /* @__PURE__ */ new Map(),
    toolInputJsonBuffers: /* @__PURE__ */ new Map()
  };
}
function getToolOverridePath() {
  const __dirname2 = path4.dirname(fileURLToPath(import.meta.url));
  return path4.resolve(__dirname2, "../../dist/sandbox/tool-override.cjs");
}
function buildAppendPrompt(sandboxCwd, conversationId, envId) {
  const base = `\u4F60\u662F\u4E00\u4E2A\u901A\u7528 AI \u7F16\u7A0B\u52A9\u624B\uFF0C\u540C\u65F6\u5177\u5907\u817E\u8BAF\u4E91\u5F00\u53D1\uFF08CloudBase\uFF09\u80FD\u529B\uFF0C\u53EF\u901A\u8FC7\u5DE5\u5177\u64CD\u4F5C\u4E91\u51FD\u6570\u3001\u6570\u636E\u5E93\u3001\u5B58\u50A8\u3001\u4E91\u6258\u7BA1\u7B49\u8D44\u6E90\u3002
\u4F18\u5148\u4F7F\u7528\u5DE5\u5177\u5B8C\u6210\u4EFB\u52A1\uFF1B\u5220\u9664\u7B49\u7834\u574F\u6027\u64CD\u4F5C\u9700\u786E\u8BA4\u7528\u6237\u610F\u56FE\u3002
\u9ED8\u8BA4\u4F7F\u7528\u4E2D\u6587\u4E0E\u7528\u6237\u6C9F\u901A\u3002

Bash \u8D85\u65F6\u5904\u7406\u7B56\u7565\uFF1A\u5BF9\u4E8E\u8017\u65F6\u8F83\u957F\u7684\u547D\u4EE4\uFF08\u5982 npm install\u3001yarn install\u3001\u5927\u578B\u9879\u76EE\u6784\u5EFA\u7B49\uFF09\uFF0C\u5982\u679C\u6267\u884C\u8D85\u65F6\uFF1A
1. \u6539\u4E3A\u540E\u53F0\u6267\u884C, \u6DFB\u52A0 run_in_background\uFF0C\u53EF\u4EE5\u83B7\u53D6 pid
2. \u5B9A\u671F\u68C0\u67E5\u8FDB\u7A0B\u72B6\u6001\uFF1Aps aux | grep '<\u5173\u952E\u8BCD>' | grep -v grep
3. \u901A\u8FC7 BashOutput \u7ED3\u5408 pid \u67E5\u770B\u8F93\u51FA\u7ED3\u679C
4. \u4E5F\u53EF\u4EE5\u901A\u8FC7 KillShell \u5173\u95ED\u540E\u53F0\u6267\u884C\u7684\u4EFB\u52A1

${false ? `\u5C0F\u7A0B\u5E8F\u5F00\u53D1\u89C4\u5219\uFF1A
\u5F53\u7528\u6237\u7684\u9700\u6C42\u6D89\u53CA\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u5F00\u53D1\uFF08\u521B\u5EFA\u3001\u4FEE\u6539\u3001\u90E8\u7F72\u5C0F\u7A0B\u5E8F\u9879\u76EE\uFF09\u65F6\uFF1A
1. \u5FC5\u987B\u5148\u4F7F\u7528 AskUserQuestion \u5DE5\u5177\u83B7\u53D6\u7528\u6237\u7684\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F appId
   - options \u7684\u7B2C\u4E00\u4E2A\u9009\u9879\u7684 label \u5FC5\u987B\u56FA\u5B9A\u4E3A "ask:miniprogram_appid"\uFF08\u7CFB\u7EDF\u636E\u6B64\u8BC6\u522B\u95EE\u9898\u7C7B\u522B\u5E76\u66FF\u6362\u4E3A\u9884\u7F6E\u5185\u5BB9\uFF09
   - \u5176\u4F59\u5B57\u6BB5\u53EF\u4EFB\u610F\u586B\u5199\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u66FF\u6362\u4E3A\u6807\u51C6\u95EE\u9898
   - \u793A\u4F8B: AskUserQuestion({ questions: [{ question: "\u9009\u62E9\u5C0F\u7A0B\u5E8F", header: "AppId", options: [{ label: "ask:miniprogram_appid", description: "\u9009\u62E9\u5C0F\u7A0B\u5E8F" }, { label: "\u8DF3\u8FC7", description: "\u8DF3\u8FC7" }], multiSelect: false }] })
2. \u83B7\u53D6\u5230 appId \u540E\uFF0C\u5728\u751F\u6210 project.config.json \u65F6\u4F7F\u7528\u8BE5 appId
3. \u5728\u8C03\u7528 publishMiniprogram \u90E8\u7F72\u524D\uFF0C\u786E\u4FDD\u5DF2\u83B7\u53D6\u5230\u6709\u6548\u7684 appId` : ""}`;
  if (sandboxCwd) {
    return `${base}
\u5DE5\u5177\u9ED8\u8BA4\u5728 Home: /tmp/workspace/${envId} \u4E0B\u6267\u884C
\u4E3A\u9879\u76EE\u5F00\u8F9F\u5DE5\u4F5C\u76EE\u5F55\u4E3A: ${sandboxCwd}
\u4F7F\u7528\u7684\u4E91\u5F00\u53D1\u73AF\u5883\u4E3A: ${envId}
\u8BF7\u6CE8\u610F\uFF1A
- \u6240\u6709\u6587\u4EF6\u8BFB\u5199\u3001\u7EC8\u7AEF\u547D\u4EE4\u90FD\u5E94\u5728\u5DE5\u4F5C\u76EE\u5F55\u4E2D\u6267\u884C\uFF0C\u6CE8\u610F cd \u5230\u5DE5\u4F5C\u76EE\u5F55\u64CD\u4F5C\u3002
- \u4F7F\u7528 cloudbase_uploadFiles \u90E8\u7F72\u6587\u4EF6\u65F6\uFF0ClocalPath \u5FC5\u987B\u662F\u5BB9\u5668\u5185\u7684**\u7EDD\u5BF9\u8DEF\u5F84**\uFF08\u5373\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55 ${sandboxCwd} \u4E0B\u7684\u8DEF\u5F84\uFF09\uFF0C\u4F8B\u5982 ${sandboxCwd}/index.html
- \u5982\u7528\u6237\u6CA1\u6709\u7279\u522B\u8981\u6C42\uFF0CcloudPath \u9700\u8981\u4E3A ${conversationId}\uFF0C\u5373\u5728\u5F53\u524D\u4F1A\u8BDD\u8DEF\u5F84\u4E0B
- \u4E0D\u8981\u4F7F\u7528\u76F8\u5BF9\u8DEF\u5F84\u7ED9 cloudbase_uploadFiles`;
  }
  return base;
}
var CloudbaseAgentService = class _CloudbaseAgentService {
  async chatStream(prompt, callback, options = {}) {
    const {
      conversationId = uuidv42(),
      envId,
      userId,
      userCredentials,
      maxTurns = 50,
      cwd,
      askAnswers,
      toolConfirmation,
      model
    } = options;
    const modelId = model || DEFAULT_MODEL;
    console.log(
      "[Agent] chatStream start, model:",
      modelId,
      "conversationId:",
      conversationId,
      "prompt:",
      prompt.slice(0, 50)
    );
    const userContext = { envId: envId || "", userId: userId || "anonymous" };
    console.log("[Agent] userContext:", JSON.stringify(userContext));
    const actualCwd = cwd || `/tmp/workspace/${userContext.envId}/${conversationId}`;
    mkdirSync2(actualCwd, { recursive: true });
    console.log("[Agent] cwd:", actualCwd);
    let historicalMessages = [];
    let lastRecordId = null;
    let hasHistory = false;
    let sandboxMcpClient = null;
    const isResumeFromInterrupt = askAnswers && Object.keys(askAnswers).length > 0 || !!toolConfirmation;
    let assistantMessageId = uuidv42();
    if (isResumeFromInterrupt && conversationId && userContext.envId) {
      const record = await persistenceService.getLatestRecordStatus(
        conversationId,
        userContext.userId,
        userContext.envId
      );
      if (record) {
        assistantMessageId = record.recordId;
      }
    }
    if (conversationId && userContext.envId) {
      if (askAnswers && Object.keys(askAnswers).length > 0) {
        for (const [recordId, { toolCallId, answers }] of Object.entries(askAnswers)) {
          const output = {
            type: "text",
            text: Object.entries(answers).map(([key, value]) => ` \xB7 ${key} \u2192 ${value}`).join("\n")
          };
          await persistenceService.updateToolResult(conversationId, recordId, toolCallId, output, "completed");
          if (recordId !== assistantMessageId) {
            await persistenceService.updateToolResult(
              conversationId,
              assistantMessageId,
              toolCallId,
              output,
              "completed"
            );
          }
        }
      }
      if (toolConfirmation) {
        const isAllowed = toolConfirmation.payload.action === "allow";
        if (isAllowed && sandboxMcpClient) {
          const mcpClient = sandboxMcpClient.client;
          const toolCallInfo = await persistenceService.getToolCallInfo(
            conversationId,
            assistantMessageId,
            toolConfirmation.interruptId
          );
          if (toolCallInfo) {
            const normalizedToolName = toolCallInfo.toolName.startsWith("mcp__") ? toolCallInfo.toolName.split("__").slice(2).join("__") || toolCallInfo.toolName : toolCallInfo.toolName;
            try {
              const res = await mcpClient.callTool({
                name: normalizedToolName,
                arguments: toolCallInfo.input
              });
              const toolResult = res.content || { result: res };
              await persistenceService.updateToolResult(
                conversationId,
                assistantMessageId,
                toolConfirmation.interruptId,
                {
                  type: "text",
                  text: JSON.stringify(toolResult)
                },
                "completed"
              );
            } catch (err) {
              const errorResult = {
                error: true,
                message: err.message || "\u5DE5\u5177\u6267\u884C\u5931\u8D25"
              };
              await persistenceService.updateToolResult(
                conversationId,
                assistantMessageId,
                toolConfirmation.interruptId,
                {
                  type: "text",
                  text: JSON.stringify(errorResult)
                },
                "error"
              );
            }
          }
        } else {
          await persistenceService.updateToolResult(
            conversationId,
            assistantMessageId,
            toolConfirmation.interruptId,
            {
              type: "text",
              text: "\u7528\u6237\u62D2\u7EDD\u4E86\u6B64\u64CD\u4F5C"
            },
            "completed"
          );
        }
      }
      const restored = await persistenceService.restoreMessages(
        conversationId,
        userContext.envId,
        userContext.userId,
        actualCwd
      );
      historicalMessages = restored.messages;
      lastRecordId = restored.lastRecordId;
      hasHistory = historicalMessages.length > 0;
      if (!hasHistory && isResumeFromInterrupt) {
        hasHistory = true;
      }
    }
    let preSavedUserRecordId = null;
    if (conversationId && userContext.envId && !isResumeFromInterrupt) {
      const preSaved = await persistenceService.preSavePendingRecords({
        conversationId,
        envId: userContext.envId,
        userId: userContext.userId,
        prompt,
        prevRecordId: lastRecordId,
        assistantRecordId: assistantMessageId
      });
      preSavedUserRecordId = preSaved.userRecordId;
    }
    const wrappedCallback = (msg) => {
      if (msg.type === "ask_user" || msg.type === "tool_confirm") {
        callback({ ...msg, assistantMessageId });
      } else {
        callback({ ...msg, id: msg.id || assistantMessageId, assistantMessageId });
      }
    };
    let sandboxInstance = null;
    let toolOverrideConfig = null;
    const sandboxEnabled = process.env.TCB_ENV_ID && process.env.SCF_SANDBOX_IMAGE_URI;
    if (sandboxEnabled) {
      try {
        sandboxInstance = await scfSandboxManager.getOrCreate(conversationId, userContext.envId, {
          mode: "shared"
        });
        toolOverrideConfig = await sandboxInstance.getToolOverrideConfig();
        const sandboxReady = await waitForSandboxHealth(sandboxInstance, wrappedCallback);
        if (!sandboxReady) {
          wrappedCallback({ type: "text", content: "\u6C99\u7BB1\u542F\u52A8\u8D85\u65F6\uFF0C\u5C06\u4F7F\u7528\u53D7\u9650\u6A21\u5F0F\u7EE7\u7EED\u5BF9\u8BDD\u3002\n\n" });
          sandboxInstance = null;
        } else {
          const sandboxCwd = await initSandboxWorkspace(
            sandboxInstance,
            {
              envId: userContext.envId,
              secretId: userCredentials?.secretId || "",
              secretKey: userCredentials?.secretKey || "",
              token: userCredentials?.sessionToken
            },
            conversationId
          );
          if (sandboxCwd) {
            wrappedCallback({ type: "session", sandboxCwd });
            console.log(`[Agent] Sandbox workspace initialized, cwd: ${sandboxCwd}`);
          }
          sandboxMcpClient = await createSandboxMcpClient({
            baseUrl: sandboxInstance.baseUrl,
            scfSessionId: userContext.envId,
            conversationId,
            getAccessToken: () => sandboxInstance.getAccessToken(),
            getCredentials: async () => ({
              cloudbaseEnvId: userContext.envId,
              secretId: userCredentials?.secretId || "",
              secretKey: userCredentials?.secretKey || "",
              sessionToken: userCredentials?.sessionToken
            }),
            workspaceFolderPaths: actualCwd,
            log: (msg) => console.log(msg),
            onDeployUrl: (url) => {
              wrappedCallback({ type: "deploy_url", url });
            },
            getMpDeployCredentials: async (appId) => {
              const app8 = await getDb().miniprogramApps.findByAppIdAndUserId(appId, userContext.userId);
              if (!app8) return null;
              return { appId: app8.appId, privateKey: decrypt(app8.privateKey) };
            }
          });
          console.log("[Agent] Sandbox ready");
          try {
            await getDb().tasks.update(conversationId, {
              sandboxId: sandboxInstance.functionName
            });
          } catch {
          }
        }
      } catch (err) {
        console.error("[Agent] Sandbox creation failed:", err.message);
        wrappedCallback({
          type: "text",
          content: `\u3010\u6C99\u7BB1\u73AF\u5883\u521B\u5EFA\u5931\u8D25\u3011${err.message}\u3002\u5C06\u4F7F\u7528\u53D7\u9650\u6A21\u5F0F\u7EE7\u7EED\u5BF9\u8BDD\u3002

`
        });
      }
    }
    const envVars = {};
    if (process.env.CODEBUDDY_API_KEY) {
      envVars.CODEBUDDY_API_KEY = process.env.CODEBUDDY_API_KEY;
      if (process.env.CODEBUDDY_INTERNET_ENVIRONMENT) {
        envVars.CODEBUDDY_INTERNET_ENVIRONMENT = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
      }
    } else {
      const authToken = await getOAuthToken();
      envVars.CODEBUDDY_AUTH_TOKEN = authToken;
    }
    let connectTimer;
    let iterationTimeoutTimer;
    try {
      const sessionOpts = hasHistory ? { resume: conversationId, sessionId: conversationId } : { persistSession: true, sessionId: conversationId };
      if (toolOverrideConfig) {
        envVars.CODEBUDDY_TOOL_OVERRIDE = getToolOverridePath();
        envVars.CODEBUDDY_TOOL_OVERRIDE_CONFIG = JSON.stringify(toolOverrideConfig);
      }
      const mcpServers = {};
      if (sandboxMcpClient) {
        mcpServers.cloudbase = sandboxMcpClient.sdkServer;
      }
      const abortController = new AbortController();
      const pendingToolInterrupt = { value: null };
      const queryArgs = {
        prompt,
        options: {
          model: modelId,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns,
          cwd: actualCwd,
          ...sessionOpts,
          includePartialMessages: true,
          systemPrompt: {
            append: buildAppendPrompt(actualCwd, conversationId, userContext.envId)
          },
          mcpServers,
          abortController,
          canUseTool: async (toolName, input, _options) => {
            const toolUseId = _options?.toolUseID;
            if (toolName === "AskUserQuestion") {
              wrappedCallback({
                type: "ask_user",
                id: toolUseId,
                input
              });
              return {
                behavior: "deny",
                message: "\u7B49\u5F85\u7528\u6237\u56DE\u7B54\u95EE\u9898",
                interrupt: true
              };
            }
            const normalizedToolName = toolName.startsWith("mcp__") ? toolName.split("__").slice(2).join("__") || toolName : toolName;
            if (WRITE_TOOLS.has(normalizedToolName)) {
              if (toolConfirmation && toolConfirmation.interruptId === toolUseId) {
                if (toolConfirmation.payload.action === "allow") {
                  return {
                    behavior: "allow",
                    updatedInput: input
                  };
                }
                return { behavior: "deny", message: "\u7528\u6237\u62D2\u7EDD\u4E86\u6B64\u64CD\u4F5C" };
              }
              if (toolUseId && pendingToolInterrupt) {
                pendingToolInterrupt.value = {
                  callId: toolUseId,
                  toolName,
                  input
                };
              }
              wrappedCallback({
                type: "tool_confirm",
                id: toolUseId,
                name: toolName,
                input
              });
              return {
                behavior: "deny",
                message: "\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u5199\u64CD\u4F5C",
                interrupt: true
              };
            }
            return { behavior: "allow", updatedInput: input };
          },
          hooks: {
            PreToolUse: [
              {
                // 匹配所有 MCP 工具（mcp__ 开头）
                matcher: "^mcp__",
                hooks: [
                  async (hookInput, toolUseId, { signal }) => {
                    const toolName = hookInput.tool_name;
                    const toolInput = hookInput.tool_input;
                    const actualToolUseId = toolUseId || hookInput.tool_use_id;
                    const normalizedToolName = toolName.startsWith("mcp__") ? toolName.split("__").slice(2).join("__") || toolName : toolName;
                    if (WRITE_TOOLS.has(normalizedToolName)) {
                      if (toolConfirmation && toolConfirmation.interruptId === actualToolUseId) {
                        if (toolConfirmation.payload.action === "allow") {
                          return {
                            continue: true,
                            hookSpecificOutput: {
                              hookEventName: "PreToolUse",
                              permissionDecision: "allow"
                            }
                          };
                        }
                        return {
                          continue: false,
                          decision: "block",
                          reason: "\u7528\u6237\u62D2\u7EDD\u4E86\u6B64\u64CD\u4F5C",
                          hookSpecificOutput: {
                            hookEventName: "PreToolUse",
                            permissionDecision: "deny",
                            permissionDecisionReason: "\u7528\u6237\u62D2\u7EDD\u4E86\u6B64\u64CD\u4F5C"
                          }
                        };
                      }
                      if (actualToolUseId && pendingToolInterrupt) {
                        pendingToolInterrupt.value = {
                          callId: actualToolUseId,
                          toolName,
                          input: toolInput
                        };
                      }
                      return {
                        continue: false,
                        decision: "block",
                        reason: "\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u5199\u64CD\u4F5C",
                        hookSpecificOutput: {
                          hookEventName: "PreToolUse",
                          permissionDecision: "ask",
                          permissionDecisionReason: "\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u5199\u64CD\u4F5C"
                        }
                      };
                    }
                    return { continue: true };
                  }
                ]
              }
            ]
          },
          env: envVars,
          stderr: (data) => {
            console.error("[Agent CLI stderr]", data.trim());
          }
          // disallowedTools: ['AskUserQuestion'],
        }
      };
      console.log("[Agent] calling query(), model:", modelId, "sessionOpts:", JSON.stringify(sessionOpts));
      const q = query(queryArgs);
      console.log("[Agent] query() returned, entering message loop...");
      connectTimer = setTimeout(() => {
        abortController.abort();
      }, CONNECT_TIMEOUT_MS);
      let firstMessageReceived = false;
      const tracker = createToolCallTracker();
      iterationTimeoutTimer = setTimeout(() => {
        abortController.abort();
        q.cleanup?.();
      }, ITERATION_TIMEOUT_MS);
      try {
        console.log("[Agent] starting for-await loop...");
        messageLoop: for await (const message of q) {
          console.log("[Agent] message type:", message.type, JSON.stringify(message).slice(0, 300));
          if (iterationTimeoutTimer) {
            clearTimeout(iterationTimeoutTimer);
          }
          iterationTimeoutTimer = setTimeout(() => {
            abortController.abort();
            q.cleanup?.();
          }, ITERATION_TIMEOUT_MS);
          if (!firstMessageReceived) {
            firstMessageReceived = true;
            clearTimeout(connectTimer);
          }
          switch (message.type) {
            case "system": {
              const sid = message.session_id;
              if (sid) wrappedCallback({ type: "session", sessionId: sid });
              break;
            }
            case "error": {
              const errorMsg = message.error || "Unknown error";
              throw new Error(errorMsg);
            }
            case "stream_event":
              this.handleStreamEvent(message.event, tracker, wrappedCallback);
              break;
            case "user": {
              const content = message.message?.content;
              if (content) this.handleToolResults(content, tracker, wrappedCallback);
              break;
            }
            case "assistant":
              this.handleToolNotFoundErrors(message, tracker, wrappedCallback);
              break;
            case "result":
              wrappedCallback({
                type: "result",
                content: JSON.stringify({
                  subtype: message.subtype,
                  duration_ms: message.duration_ms
                })
              });
              break messageLoop;
            default:
              break;
          }
        }
      } catch (err) {
        console.error("[Agent] message loop error:", err);
        if (err instanceof ExecutionError) {
          console.log("[Agent] ExecutionError (interrupt), returning");
          return;
        }
        if (err instanceof Error && err.message === "Transport closed") {
          console.error("[Agent] CLI process exited unexpectedly");
          return;
        }
        throw err;
      }
    } finally {
      console.log("[Agent] entering finally block");
      if (connectTimer) clearTimeout(connectTimer);
      if (iterationTimeoutTimer) clearTimeout(iterationTimeoutTimer);
      if (sandboxInstance) {
        try {
          await archiveToGit(sandboxInstance, conversationId, prompt);
        } catch (err) {
          console.error("[Agent] Archive to git failed:", err.message);
        }
      }
      if (sandboxMcpClient) {
        try {
          await sandboxMcpClient.close();
        } catch {
        }
      }
      let syncError;
      try {
        await persistenceService.syncMessages(
          conversationId,
          userContext.envId,
          userContext.userId,
          historicalMessages,
          lastRecordId,
          actualCwd,
          assistantMessageId,
          isResumeFromInterrupt,
          preSavedUserRecordId
        );
        await persistenceService.finalizePendingRecords(assistantMessageId, "done");
      } catch (err) {
        syncError = err instanceof Error ? err : new Error(String(err));
        console.error("[Agent] syncAndCleanup failed:", syncError.message);
        if (preSavedUserRecordId && conversationId) {
          try {
            await persistenceService.finalizePendingRecords(assistantMessageId, "error");
          } catch {
          }
        }
      }
      if (syncError) {
        throw syncError;
      }
    }
  }
  // ─── Stream Event Handlers ──────────────────────────────────────────
  handleStreamEvent(event, tracker, callback) {
    if (!event) return;
    switch (event.type) {
      case "content_block_delta":
        this.handleContentBlockDelta(event, tracker, callback);
        break;
      case "content_block_start":
        this.handleContentBlockStart(event, tracker, callback);
        break;
      case "content_block_stop":
        this.handleContentBlockStop(event, tracker, callback);
        break;
    }
  }
  handleContentBlockStart(event, tracker, callback) {
    const block = event?.content_block;
    if (!block) return;
    if (block.type === "thinking") {
      tracker.blockIndexToToolId.set(event.index, "__thinking__");
      return;
    }
    if (block.type !== "tool_use") return;
    if (event.index !== void 0) {
      tracker.blockIndexToToolId.set(event.index, block.id);
    }
    tracker.pendingToolCalls.set(block.id, {
      name: block.name,
      input: block.input || {},
      inputJson: ""
    });
    callback({ type: "tool_use", name: block.name, input: block.input || {}, id: block.id });
  }
  handleContentBlockDelta(event, tracker, callback) {
    const delta = event?.delta;
    if (!delta) return;
    if (delta.type === "thinking_delta" && delta.thinking) {
      callback({ type: "thinking", content: delta.thinking });
    } else if (delta.type === "text_delta" && delta.text) {
      callback({ type: "text", content: delta.text });
    } else if (delta.type === "input_json_delta" && delta.partial_json !== void 0) {
      const toolId = tracker.blockIndexToToolId.get(event.index);
      if (toolId && toolId !== "__thinking__") {
        const toolInfo = tracker.pendingToolCalls.get(toolId);
        if (toolInfo) {
          toolInfo.inputJson = (toolInfo.inputJson || "") + delta.partial_json;
        }
        tracker.toolInputJsonBuffers.set(toolId, (tracker.toolInputJsonBuffers.get(toolId) || "") + delta.partial_json);
      }
    }
  }
  handleContentBlockStop(event, tracker, callback) {
    const toolId = tracker.blockIndexToToolId.get(event.index);
    if (!toolId) return;
    if (toolId === "__thinking__") {
      tracker.blockIndexToToolId.delete(event.index);
      return;
    }
    const toolInfo = tracker.pendingToolCalls.get(toolId);
    if (toolInfo?.inputJson) {
      try {
        const parsedInput = JSON.parse(toolInfo.inputJson);
        toolInfo.input = parsedInput;
        callback({ type: "tool_use", name: toolInfo.name, input: parsedInput, id: toolId });
      } catch {
      }
    }
    tracker.blockIndexToToolId.delete(event.index);
  }
  handleToolResults(content, tracker, callback) {
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (block.type !== "tool_result") continue;
      const toolUseId = block.tool_use_id;
      if (!toolUseId) continue;
      const rawText = Array.isArray(block.content) && block.content[0]?.text ? block.content[0].text : typeof block.content === "string" ? block.content : null;
      this.tryExtractDeployUrl(block.tool_use_id, rawText, tracker, callback);
      this.tryExtractQrcode(block.tool_use_id, rawText, tracker, callback);
      let processedContent = block.content;
      if (Array.isArray(block.content) && block.content.length > 0) {
        const firstBlock = block.content[0];
        if (firstBlock.type === "text" && typeof firstBlock.text === "string") {
          try {
            processedContent = JSON.parse(firstBlock.text);
          } catch {
            processedContent = firstBlock.text;
          }
        }
      }
      tracker.pendingToolCalls.delete(toolUseId);
      tracker.toolInputJsonBuffers.delete(toolUseId);
      callback({
        type: "tool_result",
        tool_use_id: toolUseId,
        content: typeof processedContent === "string" ? processedContent : JSON.stringify(processedContent),
        is_error: block.is_error
      });
    }
  }
  /**
   * 尝试从 uploadFiles 工具结果中提取 CloudBase 静态托管部署 URL
   * 结果包含 accessUrl 或 staticDomain 则触发 deploy_url callback
   */
  tryExtractDeployUrl(toolUseId, rawText, tracker, callback) {
    const toolInfo = tracker.pendingToolCalls.get(toolUseId);
    const toolName = toolInfo?.name || "";
    if (!toolName.includes("uploadFiles") && !toolName.includes("cloudbase_uploadFiles")) return;
    if (!rawText) return;
    try {
      let localPath;
      const inputJson = tracker.toolInputJsonBuffers.get(toolUseId);
      if (inputJson) {
        try {
          localPath = JSON.parse(inputJson)?.localPath;
        } catch {
        }
      }
      if (!localPath) localPath = toolInfo?.input?.localPath;
      const isFile = localPath ? /\.[a-zA-Z0-9]+$/.test(localPath.replace(/\/+$/, "").split("/").pop() || "") : false;
      const deployUrl = _CloudbaseAgentService.extractDeployUrl(rawText, isFile);
      if (deployUrl) {
        callback({ type: "deploy_url", url: deployUrl });
      }
    } catch {
    }
  }
  /**
   * 从 uploadFiles 工具结果 JSON 中递归提取 CloudBase 部署 URL
   * 支持 accessUrl / staticDomain 字段，最多递归 5 层
   */
  static extractDeployUrl(rawText, isFile = false, depth = 0) {
    if (depth > 5) return null;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const firstText = parsed[0]?.text;
        if (typeof firstText === "string") {
          return _CloudbaseAgentService.extractDeployUrl(firstText, isFile, depth + 1);
        }
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      if (parsed.accessUrl) {
        const url = new URL(parsed.accessUrl);
        if (!isFile && url.pathname !== "/" && !url.pathname.endsWith("/")) {
          url.pathname += "/";
        }
        if (!url.searchParams.get("t")) {
          url.searchParams.set("t", String(Date.now()));
        }
        return url.toString();
      }
      if (parsed.staticDomain) return `https://${parsed.staticDomain}/?t=${Date.now()}`;
      const innerText = parsed?.res?.content?.[0]?.text || parsed?.content?.[0]?.text;
      if (typeof innerText === "string") {
        return _CloudbaseAgentService.extractDeployUrl(innerText, isFile, depth + 1);
      }
    } catch {
    }
    return null;
  }
  /**
   * 尝试从 publishMiniprogram 工具结果中提取小程序预览二维码
   * 成功则触发 artifact callback
   */
  tryExtractQrcode(toolUseId, rawText, tracker, callback) {
    const toolInfo = tracker.pendingToolCalls.get(toolUseId);
    const toolName = toolInfo?.name || "";
    if (!toolName.includes("publishMiniprogram") && !toolName.includes("Miniprogram")) return;
    if (!rawText) return;
    try {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(rawText);
      } catch {
        return;
      }
      const action = parsedResult?.action || toolInfo?.input?.action;
      if (parsedResult?.result?.qrcode) {
        const qrcode = `data:${parsedResult?.result?.qrcode?.mimeType || "image/png"};base64,${parsedResult?.result?.qrcode?.base64}`;
        callback({
          type: "artifact",
          artifact: {
            title: "\u5C0F\u7A0B\u5E8F\u9884\u89C8\u4E8C\u7EF4\u7801",
            description: "\u4F7F\u7528\u5FAE\u4FE1\u626B\u7801\u9884\u89C8\u5C0F\u7A0B\u5E8F",
            contentType: "image",
            data: qrcode,
            metadata: parsedResult
          }
        });
        return;
      }
      if (parsedResult?.success && action === "upload") {
        callback({
          type: "artifact",
          artifact: {
            title: "\u5C0F\u7A0B\u5E8F\u4E0A\u4F20\u6210\u529F",
            description: "\u4EE3\u7801\u5DF2\u4E0A\u4F20\u5230\u5FAE\u4FE1\u540E\u53F0\uFF0C\u53EF\u524D\u5F80\u5FAE\u4FE1\u516C\u4F17\u5E73\u53F0\u63D0\u4EA4\u5BA1\u6838",
            contentType: "json",
            data: JSON.stringify(parsedResult)
          }
        });
      }
    } catch {
    }
  }
  handleToolNotFoundErrors(msg, tracker, callback) {
    if (!msg.message?.content) return;
    for (const block of msg.message.content) {
      if (block.type !== "text" || typeof block.text !== "string") continue;
      const match = block.text.match(/Tool\s+(\S+)\s+not\s+found/i);
      if (!match) continue;
      const toolName = match[1];
      for (const [toolUseId, toolInfo] of tracker.pendingToolCalls.entries()) {
        if (toolInfo.name === toolName) {
          callback({
            type: "tool_result",
            tool_use_id: toolUseId,
            content: JSON.stringify({ error: block.text }),
            is_error: true
          });
          tracker.pendingToolCalls.delete(toolUseId);
          break;
        }
      }
    }
  }
};
var cloudbaseAgentService = new CloudbaseAgentService();

// src/routes/acp.ts
import { nanoid as nanoid5 } from "nanoid";
var acp = new Hono4();
acp.use("/*", async (c, next) => {
  if (c.req.path.endsWith("/health") || c.req.path.endsWith("/config")) {
    return next();
  }
  return requireUserEnv(c, next);
});
function rpcOk(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcErr(id, code, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message }
  };
}
acp.get("/health", (c) => {
  return c.json({ status: "ok", service: "acp" });
});
acp.post("/conversation", async (c) => {
  const body = await c.req.json();
  const conversationId = body?.conversationId || uuidv43();
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json({ error: "CloudBase environment not bound" }, 400);
  }
  const exists = await persistenceService.conversationExists(conversationId, userId, envId);
  if (exists) {
    return c.json({ conversationId, exists: true });
  }
  return c.json({ conversationId });
});
acp.get("/conversations", async (c) => {
  return c.json({ total: 0, data: [] });
});
acp.get("/conversation/records", async (c) => {
  const conversationId = c.req.query("conversationId");
  const limit = parseInt(c.req.query("limit") || "10");
  const sort = c.req.query("sort") || "DESC";
  const type = c.req.query("type") || "agui";
  if (!conversationId) {
    return c.json({ error: "conversationId is required" }, 400);
  }
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json({ error: "CloudBase environment not bound" }, 400);
  }
  const records = await persistenceService.loadDBMessages(conversationId, envId, userId, limit);
  const ALLOWED_CONTENT_TYPES = /* @__PURE__ */ new Set(["text", "tool_use", "tool_result", "reasoning"]);
  const filteredRecords = records.map((record) => ({
    ...record,
    parts: (record.parts || []).filter((p) => ALLOWED_CONTENT_TYPES.has(p.contentType))
  }));
  if (type === "agui") {
    const DB_TO_AGUI_CONTENT_TYPE = {
      tool_call: "tool_use"
    };
    for (const record of filteredRecords) {
      for (const part of record.parts) {
        if (DB_TO_AGUI_CONTENT_TYPE[part.contentType]) {
          part.contentType = DB_TO_AGUI_CONTENT_TYPE[part.contentType];
        }
        if (part.contentType === "tool_result" && typeof part.content === "string") {
          try {
            const contents = JSON.parse(part.content);
            const arr = Array.isArray(contents) ? contents : [contents];
            part.content = arr.filter((c2) => c2.type === "text").map((c2) => c2.text || "").join("");
          } catch {
          }
        }
      }
    }
  }
  return c.json({ total: records.length, data: filteredRecords });
});
acp.get("/conversation/:conversationId/messages", async (c) => {
  const conversationId = c.req.param("conversationId");
  const limit = parseInt(c.req.query("limit") || "50");
  const sort = c.req.query("sort") || "DESC";
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json({ error: "CloudBase environment not bound" }, 400);
  }
  const records = await persistenceService.loadDBMessages(conversationId, envId, userId, limit);
  const data = records.map((r) => ({
    recordId: r.recordId,
    conversationId: r.conversationId,
    role: r.role,
    parts: r.parts,
    createTime: r.createTime
  }));
  if (sort === "DESC") {
    data.reverse();
  }
  return c.json({ total: data.length, data });
});
acp.delete("/conversation/:conversationId", async (c) => {
  return c.json({ status: "success" });
});
acp.post("/chat", async (c) => {
  const body = await c.req.json();
  const { prompt, conversationId, model } = body;
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json({ error: "CloudBase environment not bound" }, 400);
  }
  const actualConversationId = conversationId || uuidv43();
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      data: JSON.stringify({
        type: "session",
        conversationId: actualConversationId
      })
    });
    let fullContent = "";
    let stopReason = "end_turn";
    const callback = async (msg) => {
      if (msg.type === "text" && msg.content) {
        fullContent += msg.content;
        await stream.writeSSE({
          data: JSON.stringify({
            type: "text",
            content: msg.content
          })
        });
      } else if (msg.type === "thinking" && msg.content) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "thinking",
            content: msg.content
          })
        });
      } else if (msg.type === "tool_use") {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "tool_use",
            name: msg.name,
            input: msg.input,
            id: msg.id
          })
        });
      } else if (msg.type === "tool_result") {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "tool_result",
            tool_use_id: msg.tool_use_id,
            content: msg.content,
            is_error: msg.is_error
          })
        });
      } else if (msg.type === "error") {
        stopReason = "error";
        await stream.writeSSE({
          data: JSON.stringify({
            type: "error",
            content: msg.content
          })
        });
      } else if (msg.type === "result") {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "result"
          })
        });
      }
    };
    try {
      await cloudbaseAgentService.chatStream(prompt, callback, {
        conversationId: actualConversationId,
        envId,
        userId,
        userCredentials,
        model
      });
    } catch (error) {
      stopReason = "error";
      await stream.writeSSE({
        data: JSON.stringify({
          type: "error",
          content: error instanceof Error ? error.message : String(error)
        })
      });
    }
    await stream.writeSSE({ data: "[DONE]" });
  });
});
acp.post("/acp", async (c) => {
  const body = await c.req.json();
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return c.json(rpcErr(body?.id ?? null, JSON_RPC_ERRORS.INVALID_REQUEST, "Invalid JSON-RPC 2.0 request"), 400);
  }
  const { id, method, params } = body;
  const isNotification = id === void 0 || id === null;
  switch (method) {
    case "initialize":
      return handleInitialize(c, id);
    case "session/new":
      return handleSessionNew(c, id, params);
    case "session/load":
      return handleSessionLoad(c, id, params);
    case "session/prompt":
      return handleSessionPrompt(c, id, params);
    case "session/cancel":
      return handleSessionCancel(c, id ?? null, params, isNotification);
    default:
      if (isNotification) {
        return c.text("", 200);
      }
      return c.json(rpcErr(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method '${method}' not found`));
  }
});
async function handleInitialize(c, id) {
  getSupportedModels().catch(() => {
  });
  const models = await getSupportedModels();
  const result = {
    protocolVersion: ACP_PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: false
      }
    },
    agentInfo: NEX_AGENT_INFO,
    authMethods: [],
    supportedModels: models
  };
  return c.json(rpcOk(id, result));
}
async function handleSessionNew(c, id, params) {
  const conversationId = params?.conversationId || uuidv43();
  const sessionId = conversationId;
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, "CloudBase environment not bound"));
  }
  try {
    const exists = await persistenceService.conversationExists(conversationId, userId, envId);
    let hasHistory = false;
    if (exists) {
      const messages = await persistenceService.loadDBMessages(conversationId, envId, userId, 1);
      hasHistory = messages.length > 0;
    }
    const result = { sessionId, hasHistory };
    return c.json(rpcOk(id, result));
  } catch (error) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, error.message));
  }
}
async function handleSessionLoad(c, id, params) {
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, "sessionId is required"));
  }
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, "CloudBase environment not bound"));
  }
  const exists = await persistenceService.conversationExists(sessionId, userId, envId);
  if (!exists) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, `Session '${sessionId}' not found`));
  }
  return c.json(rpcOk(id, { sessionId }));
}
async function handleSessionPrompt(c, id, params) {
  const sessionId = params?.sessionId;
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (!envId) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INTERNAL, "CloudBase environment not bound"));
  }
  const exists = await persistenceService.conversationExists(sessionId, userId, envId);
  const latestStatus = await persistenceService.getLatestRecordStatus(sessionId, userId, envId);
  if (latestStatus && (latestStatus.status === "pending" || latestStatus.status === "streaming")) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_REQUEST, "A prompt turn is already in progress"));
  }
  const prompt = (params?.prompt ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const hasResumePayload = params?.askAnswers && Object.keys(params.askAnswers).length > 0 || !!params?.toolConfirmation;
  if (!prompt.trim() && !hasResumePayload) {
    return c.json(rpcErr(id, JSON_RPC_ERRORS.INVALID_PARAMS, "prompt must contain at least one text block"));
  }
  const effectivePrompt = prompt.trim() ? prompt : hasResumePayload ? "continue" : prompt;
  let selectedModel;
  try {
    const task = await getDb().tasks.findById(sessionId);
    selectedModel = task?.selectedModel || void 0;
  } catch {
  }
  try {
    await getDb().tasks.update(sessionId, { status: "pending", updatedAt: Date.now() });
  } catch {
  }
  return streamSSE(c, async (stream) => {
    let fullContent = "";
    let stopReason = "end_turn";
    const notify = async (method, notifParams) => {
      await stream.writeSSE({
        data: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params: notifParams
        })
      });
    };
    const callback = async (msg) => {
      if (msg.type === "text" && msg.content) {
        fullContent += msg.content;
        await notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: msg.content }
          }
        });
      } else if (msg.type === "thinking" && msg.content) {
        await notify("session/update", {
          sessionId,
          update: { sessionUpdate: "agent_thought_chunk", content: msg.content }
        });
      } else if (msg.type === "tool_use") {
        const toolCallId = msg.id || uuidv43();
        await notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId,
            title: msg.name || "tool",
            kind: "function",
            status: "in_progress",
            input: msg.input,
            assistantMessageId: msg.assistantMessageId
          }
        });
      } else if (msg.type === "tool_result") {
        await notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: msg.tool_use_id || "",
            status: msg.is_error ? "failed" : "completed",
            result: msg.content
          }
        });
      } else if (msg.type === "error") {
        stopReason = "error";
        await notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "log",
            level: "error",
            message: msg.content || "Unknown error",
            timestamp: Date.now()
          }
        });
      } else if (msg.type === "deploy_url") {
        const deploymentType = msg.deploymentType || "web";
        const now4 = Date.now();
        try {
          if (deploymentType === "miniprogram") {
            const existing = await getDb().deployments.findByTaskIdAndTypePath(sessionId, "miniprogram", null);
            if (existing) {
              await getDb().deployments.update(existing.id, {
                qrCodeUrl: msg.qrCodeUrl || existing.qrCodeUrl,
                pagePath: msg.pagePath || existing.pagePath,
                appId: msg.appId || existing.appId,
                label: msg.label || existing.label,
                metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : existing.metadata,
                updatedAt: now4
              });
            } else {
              await getDb().deployments.create({
                id: nanoid5(12),
                taskId: sessionId,
                type: "miniprogram",
                url: null,
                path: null,
                qrCodeUrl: msg.qrCodeUrl || null,
                pagePath: msg.pagePath || null,
                appId: msg.appId || null,
                label: msg.label || null,
                metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : null,
                createdAt: now4,
                updatedAt: now4
              });
            }
          } else if (msg.url) {
            let path5 = null;
            try {
              const urlObj = new URL(msg.url);
              path5 = urlObj.pathname;
            } catch {
            }
            if (path5) {
              const existing = await getDb().deployments.findByTaskIdAndTypePath(sessionId, "web", path5);
              if (existing) {
                await getDb().deployments.update(existing.id, {
                  url: msg.url,
                  label: msg.label || existing.label,
                  metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : existing.metadata,
                  updatedAt: now4
                });
              } else {
                await getDb().deployments.create({
                  id: nanoid5(12),
                  taskId: sessionId,
                  type: "web",
                  url: msg.url,
                  path: path5,
                  qrCodeUrl: null,
                  pagePath: null,
                  appId: null,
                  label: msg.label || null,
                  metadata: msg.deploymentMetadata ? JSON.stringify(msg.deploymentMetadata) : null,
                  createdAt: now4,
                  updatedAt: now4
                });
              }
            }
          }
          if (msg.url) {
            await getDb().tasks.update(sessionId, { previewUrl: msg.url });
          }
        } catch (err) {
          console.error("Failed to create deployment:", err);
        }
        await notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "deploy_url",
            url: msg.url,
            type: deploymentType,
            qrCodeUrl: msg.qrCodeUrl,
            pagePath: msg.pagePath,
            appId: msg.appId,
            label: msg.label
          }
        });
      } else if (msg.type === "artifact" && msg.artifact) {
        await notify("session/update", {
          sessionId,
          update: { sessionUpdate: "artifact", artifact: msg.artifact }
        });
      }
    };
    try {
      await cloudbaseAgentService.chatStream(effectivePrompt, callback, {
        conversationId: sessionId,
        envId,
        userId,
        userCredentials,
        model: selectedModel,
        askAnswers: params.askAnswers,
        toolConfirmation: params.toolConfirmation
      });
    } catch (error) {
      stopReason = "error";
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[ACP] chatStream error:", errMsg);
      await notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "log",
          level: "error",
          message: errMsg,
          timestamp: Date.now()
        }
      });
    }
    try {
      await getDb().tasks.update(sessionId, {
        status: stopReason === "error" ? "error" : "completed",
        completedAt: Date.now(),
        updatedAt: Date.now()
      });
    } catch (dbErr) {
      console.error("[ACP] Failed to update task status:", dbErr);
    }
    await stream.writeSSE({
      data: JSON.stringify(rpcOk(id, { stopReason }))
    });
    await stream.writeSSE({ data: "[DONE]" });
  });
}
async function handleSessionCancel(c, id, params, isNotification) {
  const sessionId = params?.sessionId;
  const { envId, userId, credentials: userCredentials } = c.get("userEnv");
  if (sessionId && envId) {
    const latestStatus = await persistenceService.getLatestRecordStatus(sessionId, userId, envId);
    if (latestStatus && (latestStatus.status === "pending" || latestStatus.status === "streaming")) {
      await persistenceService.updateRecordStatus(latestStatus.recordId, "cancel");
    }
  }
  if (isNotification) {
    return c.text("", 200);
  }
  return c.json(rpcOk(id ?? "", null));
}
acp.get("/config", (c) => {
  const config = loadConfig();
  return c.json({
    configured: !!(config.llm?.apiKey && config.llm?.endpoint),
    model: config.llm?.model || "claude-3-5-sonnet-20241022"
  });
});
var acp_default = acp;

// src/routes/tasks.ts
import { Hono as Hono5 } from "hono";
import { nanoid as nanoid6 } from "nanoid";

// src/lib/task-logger.ts
var TaskLogger = class {
  taskId;
  acpNotify;
  constructor(taskId) {
    this.taskId = taskId;
  }
  registerACPNotifier(notify) {
    this.acpNotify = notify;
  }
  async appendLog(level, message) {
    const entry = { type: level, message, timestamp: Date.now() };
    try {
      const task = await getDb().tasks.findById(this.taskId);
      const existingLogs = task?.logs ? JSON.parse(task.logs) : [];
      const newLogs = [...existingLogs, entry];
      await getDb().tasks.update(this.taskId, { logs: JSON.stringify(newLogs), updatedAt: Date.now() });
    } catch {
    }
    if (this.acpNotify) {
      this.acpNotify({ sessionUpdate: "log", level, message, timestamp: entry.timestamp });
    }
  }
  async info(message) {
    await this.appendLog("info", message);
  }
  async error(message) {
    await this.appendLog("error", message);
  }
  async success(message) {
    await this.appendLog("success", message);
  }
  async command(message) {
    await this.appendLog("command", message);
  }
  async updateProgress(progress, message) {
    try {
      if (message) {
        const entry = { type: "info", message, timestamp: Date.now() };
        const task = await getDb().tasks.findById(this.taskId);
        const existingLogs = task?.logs ? JSON.parse(task.logs) : [];
        const newLogs = [...existingLogs, entry];
        await getDb().tasks.update(this.taskId, { progress, logs: JSON.stringify(newLogs), updatedAt: Date.now() });
      } else {
        await getDb().tasks.update(this.taskId, { progress, updatedAt: Date.now() });
      }
    } catch {
    }
    if (this.acpNotify) {
      const task = await getDb().tasks.findById(this.taskId).catch(() => null);
      this.acpNotify({
        sessionUpdate: "task_progress",
        progress,
        status: task?.status ?? "processing"
      });
    }
  }
  async updateStatus(status, error) {
    try {
      const updateData = { status, updatedAt: Date.now() };
      if (status === "completed") updateData.completedAt = Date.now();
      if (error) updateData.error = error;
      await getDb().tasks.update(this.taskId, updateData);
    } catch {
    }
  }
};
function createTaskLogger(taskId) {
  return new TaskLogger(taskId);
}

// src/routes/tasks.ts
import { Octokit as Octokit2 } from "@octokit/rest";

// src/sandbox/tool-override.ts
var TOOL_NAME_MAPPING = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  Glob: "glob",
  Grep: "grep"
};
var SANDBOX_REQUIRED_TOOLS = [
  ...Object.keys(TOOL_NAME_MAPPING),
  "MultiEdit",
  "Bash",
  "BashOutput",
  "TaskOutput",
  "TaskStop",
  "KillShell"
];
var ansiRegex = (function() {
  const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";
  const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`;
  const csi = "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";
  return new RegExp(`${osc}|${csi}`, "g");
})();

// src/routes/tasks.ts
var MAX_SANDBOX_DURATION = parseInt(process.env.MAX_SANDBOX_DURATION || "300", 10);
async function getUserGitHubToken(userId) {
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(userId, "github");
    if (account?.accessToken) {
      return decrypt(account.accessToken);
    }
    const user = await getDb().users.findById(userId);
    if (user?.provider === "github" && user.accessToken) {
      return decrypt(user.accessToken);
    }
    return null;
  } catch (error) {
    console.error("Error fetching user GitHub token:", error);
    return null;
  }
}
async function getOctokit(userId) {
  const token = await getUserGitHubToken(userId);
  return new Octokit2({ auth: token || void 0 });
}
function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}
async function runCommandInScfSandbox(sandbox, command, timeout = 3e4) {
  try {
    const response = await sandbox.request("/api/tools/bash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, timeout })
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || "Command failed" };
    }
    return {
      success: data.result?.exitCode === 0,
      exitCode: data.result?.exitCode,
      output: data.result?.output || ""
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Command failed" };
  }
}
async function getScfSandbox(task, envId) {
  if (!task.sandboxId) return null;
  try {
    return await scfSandboxManager.getExisting(task.sandboxId, envId) ?? null;
  } catch {
    return null;
  }
}
async function detectPackageManager(sandbox) {
  const pnpmCheck = await runCommandInScfSandbox(sandbox, 'test -f pnpm-lock.yaml && echo "yes" || echo "no"');
  if (pnpmCheck.output?.trim() === "yes") return "pnpm";
  const yarnCheck = await runCommandInScfSandbox(sandbox, 'test -f yarn.lock && echo "yes" || echo "no"');
  if (yarnCheck.output?.trim() === "yes") return "yarn";
  return "npm";
}
async function readFileFromSandbox(sandbox, filePath) {
  try {
    const response = await sandbox.request("/api/tools/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath })
    });
    const data = await response.json();
    if (data.success && data.result?.content !== void 0) {
      return { content: data.result.content, found: true };
    }
    return { content: "", found: false };
  } catch {
    return { content: "", found: false };
  }
}
async function writeFileToSandbox(sandbox, filePath, content) {
  try {
    const response = await sandbox.request("/api/tools/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content })
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}
function getLanguageFromFilename(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    sql: "sql"
  };
  return langMap[ext || ""] || "text";
}
function isImageFile(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "tiff", "tif"].includes(ext || "");
}
function isBinaryFile(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const binaryExtensions = [
    "zip",
    "tar",
    "gz",
    "rar",
    "7z",
    "bz2",
    "exe",
    "dll",
    "so",
    "dylib",
    "db",
    "sqlite",
    "sqlite3",
    "mp3",
    "mp4",
    "avi",
    "mov",
    "wav",
    "flac",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "ttf",
    "otf",
    "woff",
    "woff2",
    "eot",
    "bin",
    "dat",
    "dmg",
    "iso",
    "img"
  ];
  return binaryExtensions.includes(ext || "") || isImageFile(filename);
}
async function getFileContentFromGitHub(octokit, owner, repo, path5, ref, isImage) {
  try {
    const response = await octokit.rest.repos.getContent({ owner, repo, path: path5, ref });
    if ("content" in response.data && typeof response.data.content === "string") {
      if (isImage) return { content: response.data.content, isBase64: true };
      return { content: Buffer.from(response.data.content, "base64").toString("utf-8"), isBase64: false };
    }
    return { content: "", isBase64: false };
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return { content: "", isBase64: false };
    }
    throw error;
  }
}
var tasksRouter = new Hono5();
tasksRouter.get("/", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userTasks = await getDb().tasks.findByUserId(session.user.id);
  const parsedTasks = userTasks.map((t) => ({
    ...t,
    logs: t.logs ? JSON.parse(t.logs) : [],
    mcpServerIds: t.mcpServerIds ? JSON.parse(t.mcpServerIds) : null
  }));
  return c.json({ tasks: parsedTasks });
});
tasksRouter.post("/", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const body = await c.req.json();
  const {
    prompt,
    repoUrl,
    selectedAgent = "claude",
    selectedModel,
    installDependencies = false,
    maxDuration = 300,
    keepAlive = false,
    enableBrowser = false
  } = body;
  if (!prompt || typeof prompt !== "string") return c.json({ error: "prompt is required" }, 400);
  const taskId = body.id || nanoid6(12);
  const now4 = Date.now();
  await getDb().tasks.create({
    id: taskId,
    userId: session.user.id,
    prompt,
    title: null,
    repoUrl: repoUrl || null,
    selectedAgent,
    selectedModel: selectedModel || null,
    installDependencies,
    maxDuration,
    keepAlive,
    enableBrowser,
    status: "pending",
    progress: 0,
    logs: "[]",
    error: null,
    branchName: null,
    sandboxId: null,
    agentSessionId: null,
    sandboxUrl: null,
    previewUrl: null,
    prUrl: null,
    prNumber: null,
    prStatus: null,
    prMergeCommitSha: null,
    mcpServerIds: null,
    createdAt: now4,
    updatedAt: now4
  });
  const newTask = await getDb().tasks.findById(taskId);
  return c.json({ task: { ...newTask, logs: [], mcpServerIds: null } });
});
tasksRouter.get("/:taskId", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const { taskId } = c.req.param();
  const task = await getDb().tasks.findByIdAndUserId(taskId, session.user.id);
  if (!task || task.deletedAt) return c.json({ error: "Task not found" }, 404);
  return c.json({
    task: {
      ...task,
      logs: task.logs ? JSON.parse(task.logs) : [],
      mcpServerIds: task.mcpServerIds ? JSON.parse(task.mcpServerIds) : null
    }
  });
});
tasksRouter.patch("/:taskId", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const { taskId } = c.req.param();
  const body = await c.req.json();
  const existing = await getDb().tasks.findByIdAndUserId(taskId, session.user.id);
  if (!existing || existing.deletedAt) return c.json({ error: "Task not found" }, 404);
  if (body.action === "stop") {
    if (existing.status !== "processing") return c.json({ error: "Can only stop processing tasks" }, 400);
    const logger = createTaskLogger(taskId);
    await logger.info("Task stopped by user");
    await logger.updateStatus("stopped", "Task was stopped by user");
    const updated = await getDb().tasks.findById(taskId);
    return c.json({ message: "Task stopped", task: updated });
  }
  return c.json({ error: "Invalid action" }, 400);
});
tasksRouter.delete("/:taskId", requireUserEnv, async (c) => {
  const session = c.get("session");
  const { envId } = c.get("userEnv");
  const { taskId } = c.req.param();
  const existing = await getDb().tasks.findByIdAndUserId(taskId, session.user.id);
  if (!existing || existing.deletedAt) return c.json({ error: "Task not found" }, 404);
  await getDb().tasks.softDelete(taskId);
  (async () => {
    try {
      const sandbox = await scfSandboxManager.getExisting(taskId, envId).catch(() => null);
      if (sandbox) {
        await deleteConversationViaSandbox(sandbox, envId, taskId);
      }
    } catch (e) {
      console.log("clean conversation workspace error");
    }
  })();
  return c.json({ message: "Task deleted" });
});
tasksRouter.get("/:taskId/messages", requireUserEnv, async (c) => {
  const session = c.get("session");
  const { envId, userId } = c.get("userEnv");
  const { taskId } = c.req.param();
  const task = await getDb().tasks.findByIdAndUserId(taskId, session.user.id);
  if (!task || task.deletedAt) return c.json({ error: "Task not found" }, 404);
  try {
    const cloudbaseRecords = await persistenceService.loadDBMessages(taskId, envId, userId, 100);
    const messages = cloudbaseRecords.map((record) => {
      const parts = (record.parts || []).map((p) => {
        if (p.contentType === "text") return { type: "text", text: p.content || "" };
        else if (p.contentType === "reasoning") return { type: "thinking", text: p.content || "" };
        else if (p.contentType === "tool_call")
          return {
            type: "tool_call",
            toolCallId: p.toolCallId || p.partId,
            toolName: p.metadata?.toolCallName || p.metadata?.toolName || "tool",
            input: p.content || p.metadata?.input,
            status: p.metadata?.status || void 0
          };
        else if (p.contentType === "tool_result")
          return {
            type: "tool_result",
            toolCallId: p.toolCallId || p.partId,
            toolName: p.metadata?.toolName || void 0,
            content: p.content || "",
            isError: p.metadata?.isError,
            status: p.metadata?.status || void 0
          };
        return { type: "text", text: p.content || "" };
      });
      const textContent = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
      return {
        id: record.recordId,
        taskId,
        role: record.role === "user" ? "user" : "agent",
        content: textContent,
        parts,
        status: record.status,
        createdAt: record.createTime || Date.now()
      };
    });
    return c.json({ messages });
  } catch {
    return c.json({ messages: [] });
  }
});
tasksRouter.post("/:taskId/continue", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const { taskId } = c.req.param();
  const body = await c.req.json();
  const { prompt } = body;
  if (!prompt) return c.json({ error: "prompt is required" }, 400);
  const task = await getDb().tasks.findByIdAndUserId(taskId, session.user.id);
  if (!task || task.deletedAt) return c.json({ error: "Task not found" }, 404);
  await getDb().tasks.update(taskId, { status: "processing", updatedAt: Date.now() });
  return c.json({ message: "Message sent" });
});
async function findActiveTask(taskId, userId) {
  const task = await getDb().tasks.findByIdAndUserId(taskId, userId);
  if (!task || task.deletedAt) return null;
  return task;
}
function addToFileTree(tree, filename, fileObj) {
  const parts = filename.split("/");
  let currentLevel = tree;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i === parts.length - 1;
    if (isLastPart) {
      currentLevel[part] = {
        type: "file",
        filename: fileObj.filename,
        status: fileObj.status,
        additions: fileObj.additions,
        deletions: fileObj.deletions,
        changes: fileObj.changes
      };
    } else {
      if (!currentLevel[part]) currentLevel[part] = { type: "directory", children: {} };
      currentLevel = currentLevel[part].children;
    }
  }
}
tasksRouter.get("/:taskId/files", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const mode = c.req.query("mode") || "remote";
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.branchName) return c.json({ success: true, files: [], fileTree: {}, branchName: null });
    const repoUrl = task.repoUrl;
    if (!repoUrl) return c.json({ success: true, files: [], fileTree: {}, branchName: task.branchName });
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ success: false, error: "GitHub authentication required" }, 401);
    const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!githubMatch) return c.json({ success: false, error: "Invalid repository URL format" }, 400);
    const [, owner, repo] = githubMatch;
    let files = [];
    if (mode === "local") {
      if (!task.sandboxId) return c.json({ success: false, error: "Sandbox is not running" }, 410);
      try {
        const sandbox = await getScfSandbox(task, envId);
        if (!sandbox)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Sandbox not found"
          });
        const statusResult = await runCommandInScfSandbox(sandbox, "git status --porcelain");
        if (!statusResult.success)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Failed to get local changes"
          });
        const statusOutput = statusResult.output || "";
        const statusLines = statusOutput.trim().split("\n").filter((line) => line.trim());
        const checkRemoteResult = await runCommandInScfSandbox(
          sandbox,
          `git rev-parse --verify origin/${task.branchName}`
        );
        const remoteBranchExists = checkRemoteResult.success;
        const compareRef = remoteBranchExists ? `origin/${task.branchName}` : "HEAD";
        const numstatResult = await runCommandInScfSandbox(sandbox, `git diff --numstat ${compareRef}`);
        const diffStats = {};
        if (numstatResult.success) {
          const numstatOutput = numstatResult.output || "";
          for (const line of numstatOutput.trim().split("\n").filter((l) => l.trim())) {
            const parts = line.split("	");
            if (parts.length >= 3)
              diffStats[parts[2]] = { additions: parseInt(parts[0]) || 0, deletions: parseInt(parts[1]) || 0 };
          }
        }
        const filePromises = statusLines.map(async (line) => {
          const indexStatus = line.charAt(0);
          const worktreeStatus = line.charAt(1);
          let filename = line.substring(2).trim();
          if (indexStatus === "R" || worktreeStatus === "R") {
            const arrowIndex = filename.indexOf(" -> ");
            if (arrowIndex !== -1) filename = filename.substring(arrowIndex + 4).trim();
          }
          let status = "modified";
          if (indexStatus === "R" || worktreeStatus === "R") status = "renamed";
          else if (indexStatus === "A" || worktreeStatus === "A" || indexStatus === "?" && worktreeStatus === "?")
            status = "added";
          else if (indexStatus === "D" || worktreeStatus === "D") status = "deleted";
          let stats = diffStats[filename] || { additions: 0, deletions: 0 };
          if (indexStatus === "?" && worktreeStatus === "?" || indexStatus === "A" && !stats.additions && !stats.deletions) {
            const wcResult = await runCommandInScfSandbox(sandbox, `wc -l '${filename.replace(/'/g, "'\\''")}'`);
            if (wcResult.success) {
              stats = { additions: parseInt((wcResult.output || "").trim().split(/\s+/)[0]) || 0, deletions: 0 };
            }
          }
          return {
            filename,
            status,
            additions: stats.additions,
            deletions: stats.deletions,
            changes: stats.additions + stats.deletions
          };
        });
        files = await Promise.all(filePromises);
      } catch {
        return c.json({ success: false, error: "Failed to fetch local changes" }, 500);
      }
    } else if (mode === "all-local") {
      if (!task.sandboxId) return c.json({ success: false, error: "Sandbox is not running" }, 410);
      try {
        const sandbox = await getScfSandbox(task, envId);
        if (!sandbox)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Sandbox not found"
          });
        const findResult = await runCommandInScfSandbox(
          sandbox,
          "find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.vercel/*'"
        );
        if (!findResult.success)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Failed to list files"
          });
        const findOutput = findResult.output || "";
        const fileLines = findOutput.trim().split("\n").filter((line) => line.trim() && line !== ".").map((line) => line.replace(/^\.\//, ""));
        const statusResult = await runCommandInScfSandbox(sandbox, "git status --porcelain");
        const changedFilesMap = {};
        if (statusResult.success) {
          const statusOutput = statusResult.output || "";
          for (const line of statusOutput.trim().split("\n").filter((l) => l.trim())) {
            const indexStatus = line.charAt(0);
            const worktreeStatus = line.charAt(1);
            let filename = line.substring(2).trim();
            if (indexStatus === "R" || worktreeStatus === "R") {
              const arrowIndex = filename.indexOf(" -> ");
              if (arrowIndex !== -1) filename = filename.substring(arrowIndex + 4).trim();
            }
            let status = "modified";
            if (indexStatus === "R" || worktreeStatus === "R") status = "renamed";
            else if (indexStatus === "A" || worktreeStatus === "A" || indexStatus === "?" && worktreeStatus === "?")
              status = "added";
            else if (indexStatus === "D" || worktreeStatus === "D") status = "deleted";
            changedFilesMap[filename] = status;
          }
        }
        files = fileLines.map((filename) => {
          const trimmed = filename.trim();
          const status = changedFilesMap[trimmed] || "renamed";
          return { filename: trimmed, status, additions: 0, deletions: 0, changes: 0 };
        });
      } catch {
        return c.json({ success: false, error: "Failed to fetch local files" }, 500);
      }
    } else if (mode === "all") {
      try {
        const treeResponse = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: task.branchName,
          recursive: "true"
        });
        files = treeResponse.data.tree.filter((item) => item.type === "blob" && item.path).map((item) => ({
          filename: item.path,
          status: "modified",
          additions: 0,
          deletions: 0,
          changes: 0
        }));
      } catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 404)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Branch not found or still being created"
          });
        return c.json({ success: false, error: "Failed to fetch repository tree from GitHub" }, 500);
      }
    } else {
      try {
        try {
          await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName });
        } catch (branchError) {
          if (branchError && typeof branchError === "object" && "status" in branchError && branchError.status === 404)
            return c.json({
              success: true,
              files: [],
              fileTree: {},
              branchName: task.branchName,
              message: "Branch is being created..."
            });
          throw branchError;
        }
        let comparison;
        try {
          comparison = await octokit.rest.repos.compareCommits({ owner, repo, base: "main", head: task.branchName });
        } catch (mainError) {
          if (mainError && typeof mainError === "object" && "status" in mainError && mainError.status === 404) {
            try {
              comparison = await octokit.rest.repos.compareCommits({
                owner,
                repo,
                base: "master",
                head: task.branchName
              });
            } catch (masterError) {
              if (masterError && typeof masterError === "object" && "status" in masterError && masterError.status === 404)
                return c.json({
                  success: true,
                  files: [],
                  fileTree: {},
                  branchName: task.branchName,
                  message: "No base branch found for comparison"
                });
              throw masterError;
            }
          } else {
            throw mainError;
          }
        }
        files = comparison.data.files?.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          changes: file.changes || 0
        })) || [];
      } catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 404)
          return c.json({
            success: true,
            files: [],
            fileTree: {},
            branchName: task.branchName,
            message: "Branch not found or still being created"
          });
        return c.json({ success: false, error: "Failed to fetch file changes from GitHub" }, 500);
      }
    }
    const fileTree = {};
    for (const file of files) addToFileTree(fileTree, file.filename, file);
    return c.json({ success: true, files, fileTree, branchName: task.branchName });
  } catch (error) {
    console.error("Error fetching task files:", error);
    return c.json({ success: false, error: "Failed to fetch task files" }, 500);
  }
});
tasksRouter.get("/:taskId/file-content", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const rawFilename = c.req.query("filename");
    const mode = c.req.query("mode") || "remote";
    if (!rawFilename) return c.json({ error: "Missing filename parameter" }, 400);
    const filename = decodeURIComponent(rawFilename);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.branchName || !task.repoUrl)
      return c.json({ error: "Task does not have branch or repository information" }, 400);
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub authentication required" }, 401);
    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!githubMatch) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const [, owner, repo] = githubMatch;
    const isImage = isImageFile(filename);
    const isBinary = isBinaryFile(filename);
    if (isBinary && !isImage)
      return c.json({
        success: true,
        data: { filename, oldContent: "", newContent: "", language: "text", isBinary: true, isImage: false }
      });
    const isNodeModulesFile = filename.includes("/node_modules/");
    let oldContent = "";
    let newContent = "";
    let isBase64 = false;
    let fileFound = false;
    if (mode === "local") {
      if (!isNodeModulesFile) {
        const remoteResult = await getFileContentFromGitHub(octokit, owner, repo, filename, task.branchName, isImage);
        oldContent = remoteResult.content;
        isBase64 = remoteResult.isBase64;
      }
      if (task.sandboxId) {
        try {
          const sandbox = await getScfSandbox(task, envId);
          if (sandbox) {
            const normalizedPath = filename.startsWith("/") ? filename.substring(1) : filename;
            const result = await readFileFromSandbox(sandbox, normalizedPath);
            if (result.found) {
              newContent = result.content;
              fileFound = true;
            }
          }
        } catch (sandboxError) {
          console.error("Error reading from sandbox:", sandboxError);
        }
      }
      if (!fileFound) return c.json({ error: "File not found in sandbox" }, 404);
    } else {
      let content = "";
      if (isNodeModulesFile && task.sandboxId) {
        try {
          const sandbox = await getScfSandbox(task, envId);
          if (sandbox) {
            const normalizedPath = filename.startsWith("/") ? filename.substring(1) : filename;
            const result = await readFileFromSandbox(sandbox, normalizedPath);
            if (result.found) {
              content = result.content;
              fileFound = true;
            }
          }
        } catch (sandboxError) {
          console.error("Error reading node_modules file from sandbox:", sandboxError);
        }
      } else {
        const result = await getFileContentFromGitHub(octokit, owner, repo, filename, task.branchName, isImage);
        content = result.content;
        isBase64 = result.isBase64;
        if (content || isImage) fileFound = true;
      }
      if (!fileFound && !isImage && !isNodeModulesFile && task.sandboxId) {
        try {
          const sandbox = await getScfSandbox(task, envId);
          if (sandbox) {
            const normalizedPath = filename.startsWith("/") ? filename.substring(1) : filename;
            const result = await readFileFromSandbox(sandbox, normalizedPath);
            if (result.found) {
              content = result.content;
              fileFound = true;
            }
          }
        } catch (sandboxError) {
          console.error("Error reading from sandbox:", sandboxError);
        }
      }
      if (!fileFound && !isImage) return c.json({ error: "File not found in branch" }, 404);
      oldContent = "";
      newContent = content;
    }
    return c.json({
      success: true,
      data: {
        filename,
        oldContent,
        newContent,
        language: getLanguageFromFilename(filename),
        isBinary: false,
        isImage,
        isBase64
      }
    });
  } catch (error) {
    console.error("Error in file-content API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/save-file", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { filename, content } = body;
    if (!filename || content === void 0) return c.json({ error: "Missing filename or content" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ error: "Task does not have an active sandbox" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ error: "Sandbox not available" }, 400);
    const success = await writeFileToSandbox(sandbox, filename, content);
    if (!success) return c.json({ error: "Failed to write file to sandbox" }, 500);
    return c.json({ success: true, message: "File saved successfully" });
  } catch (error) {
    console.error("Error in save-file API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/create-file", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { filename } = body;
    if (!filename || typeof filename !== "string") return c.json({ success: false, error: "Filename is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found or inactive" }, 400);
    const pathParts = filename.split("/");
    if (pathParts.length > 1) {
      const dirPath = pathParts.slice(0, -1).join("/");
      const mkdirResult = await runCommandInScfSandbox(sandbox, `mkdir -p '${dirPath.replace(/'/g, "'\\''")}'`);
      if (!mkdirResult.success) return c.json({ success: false, error: "Failed to create parent directories" }, 500);
    }
    const touchResult = await runCommandInScfSandbox(sandbox, `touch '${filename.replace(/'/g, "'\\''")}'`);
    if (!touchResult.success) return c.json({ success: false, error: "Failed to create file" }, 500);
    return c.json({ success: true, message: "File created successfully", filename });
  } catch {
    return c.json({ success: false, error: "An error occurred while creating the file" }, 500);
  }
});
tasksRouter.post("/:taskId/create-folder", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { foldername } = body;
    if (!foldername || typeof foldername !== "string")
      return c.json({ success: false, error: "Foldername is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found or inactive" }, 400);
    const mkdirResult = await runCommandInScfSandbox(sandbox, `mkdir -p '${foldername.replace(/'/g, "'\\''")}'`);
    if (!mkdirResult.success) return c.json({ success: false, error: "Failed to create folder" }, 500);
    return c.json({ success: true, message: "Folder created successfully", foldername });
  } catch {
    return c.json({ success: false, error: "An error occurred while creating the folder" }, 500);
  }
});
tasksRouter.delete("/:taskId/delete-file", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { filename } = body;
    if (!filename || typeof filename !== "string") return c.json({ success: false, error: "Filename is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found or inactive" }, 400);
    const rmResult = await runCommandInScfSandbox(sandbox, `rm '${filename.replace(/'/g, "'\\''")}'`);
    if (!rmResult.success) return c.json({ success: false, error: "Failed to delete file" }, 500);
    return c.json({ success: true, message: "File deleted successfully", filename });
  } catch {
    return c.json({ success: false, error: "An error occurred while deleting the file" }, 500);
  }
});
tasksRouter.post("/:taskId/discard-file-changes", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { filename } = body;
    if (!filename) return c.json({ success: false, error: "Missing filename parameter" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found or inactive" }, 400);
    const escapedFilename = filename.replace(/'/g, "'\\''");
    const lsFilesResult = await runCommandInScfSandbox(sandbox, `git ls-files '${escapedFilename}'`);
    const isTracked = (lsFilesResult.output || "").trim().length > 0;
    if (isTracked) {
      const checkoutResult = await runCommandInScfSandbox(sandbox, `git checkout HEAD -- '${escapedFilename}'`);
      if (!checkoutResult.success) return c.json({ success: false, error: "Failed to discard changes" }, 500);
    } else {
      const rmResult = await runCommandInScfSandbox(sandbox, `rm '${escapedFilename}'`);
      if (!rmResult.success) return c.json({ success: false, error: "Failed to delete file" }, 500);
    }
    return c.json({
      success: true,
      message: isTracked ? "Changes discarded successfully" : "New file deleted successfully"
    });
  } catch {
    return c.json({ success: false, error: "An error occurred while discarding changes" }, 500);
  }
});
tasksRouter.get("/:taskId/diff", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const filename = c.req.query("filename");
    const mode = c.req.query("mode");
    if (!filename) return c.json({ error: "Missing filename parameter" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.branchName || !task.repoUrl)
      return c.json({ error: "Task does not have branch or repository information" }, 400);
    if (mode === "local") {
      if (!task.sandboxId) return c.json({ error: "Sandbox not available" }, 400);
      try {
        const sandbox = await getScfSandbox(task, envId);
        if (!sandbox) return c.json({ error: "Sandbox not found or inactive" }, 400);
        await runCommandInScfSandbox(sandbox, `git fetch origin ${task.branchName}`);
        const checkRemoteResult = await runCommandInScfSandbox(
          sandbox,
          `git rev-parse --verify origin/${task.branchName}`
        );
        const remoteBranchExists = checkRemoteResult.success;
        if (!remoteBranchExists) {
          const oldContentResult2 = await runCommandInScfSandbox(sandbox, `git show HEAD:${filename}`);
          const oldContent3 = oldContentResult2.success ? oldContentResult2.output || "" : "";
          const newContentFile2 = await readFileFromSandbox(sandbox, filename);
          const newContent3 = newContentFile2.found ? newContentFile2.content : "";
          return c.json({
            success: true,
            data: {
              filename,
              oldContent: oldContent3,
              newContent: newContent3,
              language: getLanguageFromFilename(filename),
              isBinary: false,
              isImage: false
            }
          });
        }
        const remoteBranchRef = `origin/${task.branchName}`;
        const oldContentResult = await runCommandInScfSandbox(sandbox, `git show ${remoteBranchRef}:${filename}`);
        const oldContent2 = oldContentResult.success ? oldContentResult.output || "" : "";
        const newContentFile = await readFileFromSandbox(sandbox, filename);
        const newContent2 = newContentFile.found ? newContentFile.content : "";
        return c.json({
          success: true,
          data: {
            filename,
            oldContent: oldContent2,
            newContent: newContent2,
            language: getLanguageFromFilename(filename),
            isBinary: false,
            isImage: false
          }
        });
      } catch {
        return c.json({ error: "Failed to get local diff" }, 500);
      }
    }
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub authentication required" }, 401);
    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!githubMatch) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const [, owner, repo] = githubMatch;
    const isImage = isImageFile(filename);
    const isBinary = isBinaryFile(filename);
    if (isBinary && !isImage)
      return c.json({
        success: true,
        data: { filename, oldContent: "", newContent: "", language: "text", isBinary: true, isImage: false }
      });
    let oldContent = "";
    let newContent = "";
    let newIsBase64 = false;
    let baseRef = "main";
    let headRef = task.branchName;
    if (task.prNumber) {
      try {
        const prResponse = await octokit.rest.pulls.get({ owner, repo, pull_number: task.prNumber });
        baseRef = prResponse.data.base.sha;
        headRef = prResponse.data.head.sha;
        if (prResponse.data.merged_at && prResponse.data.merge_commit_sha && !task.prMergeCommitSha) {
          await getDb().tasks.update(task.id, {
            prMergeCommitSha: prResponse.data.merge_commit_sha,
            updatedAt: Date.now()
          });
        }
      } catch {
      }
    }
    try {
      const result = await getFileContentFromGitHub(octokit, owner, repo, filename, baseRef, isImage);
      oldContent = result.content;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404 && baseRef === "main") {
        try {
          const result = await getFileContentFromGitHub(octokit, owner, repo, filename, "master", isImage);
          oldContent = result.content;
        } catch {
          oldContent = "";
        }
      }
    }
    try {
      const result = await getFileContentFromGitHub(octokit, owner, repo, filename, headRef, isImage);
      newContent = result.content;
      newIsBase64 = result.isBase64;
    } catch {
      newContent = "";
    }
    if (!oldContent && !newContent) return c.json({ error: "File not found in either branch" }, 404);
    return c.json({
      success: true,
      data: {
        filename,
        oldContent: oldContent || "",
        newContent: newContent || "",
        language: getLanguageFromFilename(filename),
        isBinary: false,
        isImage,
        isBase64: newIsBase64
      }
    });
  } catch (error) {
    console.error("Error in diff API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/pr", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { title, body: prBody, baseBranch = "main" } = body;
    if (!title) return c.json({ error: "PR title is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.repoUrl || !task.branchName)
      return c.json({ error: "Task does not have repository or branch information" }, 400);
    if (task.prUrl)
      return c.json({ success: true, data: { prUrl: task.prUrl, prNumber: task.prNumber, alreadyExists: true } });
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub account not connected" }, 401);
    const parsed = parseGitHubUrl(task.repoUrl);
    if (!parsed) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const { owner, repo } = parsed;
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: prBody || "",
      head: task.branchName,
      base: baseBranch
    });
    const updatedTask = await getDb().tasks.update(taskId, {
      prUrl: response.data.html_url,
      prNumber: response.data.number,
      prStatus: "open",
      updatedAt: Date.now()
    });
    return c.json({
      success: true,
      data: { prUrl: response.data.html_url, prNumber: response.data.number, task: updatedTask }
    });
  } catch (error) {
    console.error("Error creating pull request:", error);
    return c.json({ error: "Failed to create pull request" }, 500);
  }
});
tasksRouter.post("/:taskId/sync-changes", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const { commitMessage } = body;
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    if (!task.branchName) return c.json({ success: false, error: "Branch not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found or inactive" }, 400);
    const addResult = await runCommandInScfSandbox(sandbox, "git add .");
    if (!addResult.success) return c.json({ success: false, error: "Failed to add changes" }, 500);
    const statusResult = await runCommandInScfSandbox(sandbox, "git status --porcelain");
    if (!statusResult.success) return c.json({ success: false, error: "Failed to check status" }, 500);
    const statusOutput = statusResult.output || "";
    if (!statusOutput.trim())
      return c.json({ success: true, message: "No changes to sync", committed: false, pushed: false });
    const message = commitMessage || "Sync local changes";
    const escapedMessage = message.replace(/'/g, "'\\''");
    const commitResult = await runCommandInScfSandbox(sandbox, `git commit -m '${escapedMessage}'`);
    if (!commitResult.success) return c.json({ success: false, error: "Failed to commit changes" }, 500);
    const pushResult = await runCommandInScfSandbox(sandbox, `git push origin ${task.branchName}`);
    if (!pushResult.success) return c.json({ success: false, error: "Failed to push changes" }, 500);
    return c.json({ success: true, message: "Changes synced successfully", committed: true, pushed: true });
  } catch {
    return c.json({ success: false, error: "An error occurred while syncing changes" }, 500);
  }
});
tasksRouter.post("/:taskId/sync-pr", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.repoUrl || !task.prNumber)
      return c.json({ error: "Task does not have repository or PR information" }, 400);
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub account not connected" }, 401);
    const parsed = parseGitHubUrl(task.repoUrl);
    if (!parsed) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const { owner, repo } = parsed;
    const response = await octokit.rest.pulls.get({ owner, repo, pull_number: task.prNumber });
    let status;
    if (response.data.merged_at) status = "merged";
    else if (response.data.state === "closed") status = "closed";
    else status = "open";
    const mergeCommitSha = response.data.merge_commit_sha || null;
    const updateData = {
      prStatus: status,
      prMergeCommitSha: mergeCommitSha,
      updatedAt: Date.now()
    };
    if (status === "merged") updateData.completedAt = Date.now();
    await getDb().tasks.update(taskId, updateData);
    return c.json({ success: true, data: { status, mergeCommitSha } });
  } catch (error) {
    console.error("Error syncing pull request status:", error);
    return c.json({ error: "Failed to sync pull request status" }, 500);
  }
});
tasksRouter.post("/:taskId/merge-pr", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { commitTitle, commitMessage, mergeMethod = "squash" } = body;
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.repoUrl || !task.prNumber)
      return c.json({ error: "Task does not have repository or PR information" }, 400);
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub account not connected" }, 401);
    const parsed = parseGitHubUrl(task.repoUrl);
    if (!parsed) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const { owner, repo } = parsed;
    const response = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: task.prNumber,
      commit_title: commitTitle,
      commit_message: commitMessage,
      merge_method: mergeMethod
    });
    await getDb().tasks.update(taskId, {
      prStatus: "merged",
      prMergeCommitSha: response.data.sha || null,
      sandboxId: null,
      sandboxUrl: null,
      completedAt: Date.now(),
      updatedAt: Date.now()
    });
    return c.json({
      success: true,
      data: { merged: response.data.merged, message: response.data.message, sha: response.data.sha }
    });
  } catch (error) {
    console.error("Error merging pull request:", error);
    return c.json({ error: "Failed to merge pull request" }, 500);
  }
});
tasksRouter.post("/:taskId/close-pr", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.repoUrl || !task.prNumber) return c.json({ error: "Task does not have a pull request" }, 400);
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub authentication required" }, 401);
    const parsed = parseGitHubUrl(task.repoUrl);
    if (!parsed) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const { owner, repo } = parsed;
    try {
      await octokit.rest.pulls.update({ owner, repo, pull_number: task.prNumber, state: "closed" });
      await getDb().tasks.update(task.id, { prStatus: "closed", updatedAt: Date.now() });
      return c.json({ success: true, message: "Pull request closed successfully" });
    } catch (error) {
      if (error && typeof error === "object" && "status" in error) {
        const status = error.status;
        if (status === 404) return c.json({ error: "Pull request not found" }, 404);
        if (status === 403) return c.json({ error: "Permission denied. Check repository access" }, 403);
      }
      return c.json({ error: "Failed to close pull request" }, 500);
    }
  } catch (error) {
    console.error("Error in close PR API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/reopen-pr", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.repoUrl || !task.prNumber) return c.json({ error: "Task does not have a pull request" }, 400);
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ error: "GitHub authentication required" }, 401);
    const parsed = parseGitHubUrl(task.repoUrl);
    if (!parsed) return c.json({ error: "Invalid GitHub repository URL" }, 400);
    const { owner, repo } = parsed;
    try {
      await octokit.rest.pulls.update({ owner, repo, pull_number: task.prNumber, state: "open" });
      await getDb().tasks.update(task.id, { prStatus: "open", updatedAt: Date.now() });
      return c.json({ success: true, message: "Pull request reopened successfully" });
    } catch (error) {
      if (error && typeof error === "object" && "status" in error) {
        const status = error.status;
        if (status === 404) return c.json({ error: "Pull request not found" }, 404);
        if (status === 403) return c.json({ error: "Permission denied. Check repository access" }, 403);
      }
      return c.json({ error: "Failed to reopen pull request" }, 500);
    }
  } catch (error) {
    console.error("Error in reopen PR API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.get("/:taskId/project-files", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ error: "Task does not have an active sandbox" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ error: "Sandbox not available" }, 400);
    return c.json({ success: true, files: [] });
  } catch (error) {
    console.error("Error in project-files API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/lsp", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const task = await getDb().tasks.findById(taskId);
    if (!task || task.userId !== session.user.id) return c.json({ error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ error: "Task does not have an active sandbox" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ error: "Sandbox not available" }, 400);
    const body = await c.req.json();
    const { method, filename, position } = body;
    const absoluteFilename = filename.startsWith("/") ? filename : `/${filename}`;
    switch (method) {
      case "textDocument/definition": {
        const scriptPath = ".lsp-helper.mjs";
        const helperScript = `
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
const filename = '${absoluteFilename.replace(/'/g, "\\'")}';
const line = ${position.line};
const character = ${position.character};
let configPath = process.cwd();
while (configPath !== '/') { const tsconfigPath = path.join(configPath, 'tsconfig.json'); if (fs.existsSync(tsconfigPath)) { break; } configPath = path.dirname(configPath); }
const tsconfigPath = path.join(configPath, 'tsconfig.json');
const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configPath);
const files = new Map();
const host = {
  getScriptFileNames: () => parsedConfig.fileNames,
  getScriptVersion: (fileName) => { const file = files.get(fileName); return file && file.version ? file.version.toString() : '0'; },
  getScriptSnapshot: (fileName) => { if (!fs.existsSync(fileName)) return undefined; const content = fs.readFileSync(fileName, 'utf8'); return ts.ScriptSnapshot.fromString(content); },
  getCurrentDirectory: () => configPath,
  getCompilationSettings: () => parsedConfig.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories,
};
const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const fullPath = path.resolve(configPath, filename.replace(/^\\/*/g, ''));
const program = service.getProgram();
if (!program) { console.error(JSON.stringify({ error: 'Failed to get program' })); process.exit(1); }
const sourceFile = program.getSourceFile(fullPath);
if (!sourceFile) { console.error(JSON.stringify({ error: 'File not found', filename: fullPath })); process.exit(1); }
const offset = ts.getPositionOfLineAndCharacter(sourceFile, line, character);
const definitions = service.getDefinitionAtPosition(fullPath, offset);
if (definitions && definitions.length > 0) {
  const results = definitions.map(def => { const defSourceFile = program.getSourceFile(def.fileName); if (!defSourceFile) return null; const start = ts.getLineAndCharacterOfPosition(defSourceFile, def.textSpan.start); const end = ts.getLineAndCharacterOfPosition(defSourceFile, def.textSpan.start + def.textSpan.length); return { uri: 'file://' + def.fileName, range: { start, end } }; }).filter(def => def !== null);
  console.log(JSON.stringify({ definitions: results }));
} else { console.log(JSON.stringify({ definitions: [] })); }
`;
        const writeSuccess = await writeFileToSandbox(sandbox, scriptPath, helperScript);
        if (!writeSuccess) return c.json({ definitions: [], error: "Failed to write helper script" });
        const result = await runCommandInScfSandbox(sandbox, `node ${scriptPath}`);
        await runCommandInScfSandbox(sandbox, `rm ${scriptPath}`);
        if (!result.success) return c.json({ definitions: [], error: "Script execution failed" });
        try {
          return c.json(JSON.parse((result.output || "").trim()));
        } catch {
          return c.json({ definitions: [], error: "Failed to parse TypeScript response" });
        }
      }
      case "textDocument/hover":
        return c.json({ hover: null });
      case "textDocument/completion":
        return c.json({ completions: [] });
      default:
        return c.json({ error: "Unsupported LSP method" }, 400);
    }
  } catch (error) {
    console.error("LSP request error:", error);
    return c.json({ error: "Failed to process LSP request" }, 500);
  }
});
tasksRouter.post("/:taskId/terminal", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const { command } = await c.req.json();
    if (!command || typeof command !== "string") return c.json({ success: false, error: "Command is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "No sandbox found for this task" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not available" }, 400);
    try {
      const result = await runCommandInScfSandbox(sandbox, command);
      return c.json({
        success: true,
        data: {
          exitCode: result.exitCode ?? (result.success ? 0 : 1),
          stdout: result.output || "",
          stderr: result.error || ""
        }
      });
    } catch (error) {
      console.error("Error executing command:", error);
      return c.json({ success: false, error: "Command execution failed" }, 500);
    }
  } catch (error) {
    console.error("Error in terminal endpoint:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
tasksRouter.post("/:taskId/autocomplete", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const { partial, cwd } = await c.req.json();
    if (typeof partial !== "string") return c.json({ success: false, error: "Partial text is required" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "No sandbox found for this task" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not available" }, 400);
    try {
      const pwdResult = await runCommandInScfSandbox(sandbox, "pwd");
      let actualCwd = cwd || "/home/user";
      if (pwdResult.success && pwdResult.output && pwdResult.output.trim()) {
        actualCwd = pwdResult.output.trim();
      }
      const parts = partial.split(/\s+/);
      const lastPart = parts[parts.length - 1] || "";
      let dir = actualCwd;
      let prefix = "";
      if (lastPart.includes("/")) {
        const lastSlash = lastPart.lastIndexOf("/");
        const pathPart = lastPart.substring(0, lastSlash + 1);
        prefix = lastPart.substring(lastSlash + 1);
        if (pathPart.startsWith("/")) dir = pathPart;
        else if (pathPart.startsWith("~/")) dir = "/home/user/" + pathPart.substring(2);
        else dir = `${actualCwd}/${pathPart}`;
      } else {
        prefix = lastPart;
      }
      const escapedDir = "'" + dir.replace(/'/g, "'\\''") + "'";
      const lsCommand = `cd ${escapedDir} 2>/dev/null && ls -1ap 2>/dev/null || echo ""`;
      const result = await runCommandInScfSandbox(sandbox, lsCommand);
      const stdout = result.output || "";
      if (!stdout) return c.json({ success: true, data: { completions: [] } });
      const completionFiles = stdout.trim().split("\n").filter((f) => f && f.toLowerCase().startsWith(prefix.toLowerCase())).map((f) => ({ name: f, isDirectory: f.endsWith("/") }));
      return c.json({ success: true, data: { completions: completionFiles, prefix } });
    } catch (error) {
      console.error("Error getting completions:", error);
      return c.json({ success: false, error: "Failed to get completions" }, 500);
    }
  } catch (error) {
    console.error("Error in autocomplete endpoint:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
tasksRouter.get("/:taskId/check-runs", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.branchName || !task.repoUrl) return c.json({ success: false, error: "Task does not have a branch" }, 400);
    const repoMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!repoMatch) return c.json({ success: false, error: "Invalid repository URL" }, 400);
    const [, owner, repo] = repoMatch;
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ success: false, error: "GitHub authentication required" }, 401);
    let branchData;
    try {
      branchData = await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName });
    } catch (branchError) {
      if (branchError && typeof branchError === "object" && "status" in branchError && branchError.status === 404)
        return c.json({ success: true, checkRuns: [] });
      throw branchError;
    }
    const commitSha = branchData.data.commit.sha;
    const { data: checkRunsData } = await octokit.rest.checks.listForRef({ owner, repo, ref: commitSha });
    return c.json({
      success: true,
      checkRuns: checkRunsData.check_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        started_at: run.started_at,
        completed_at: run.completed_at
      }))
    });
  } catch (error) {
    console.error("Error fetching check runs:", error);
    return c.json({ success: false, error: "Failed to fetch check runs" }, 500);
  }
});
function convertFeedbackUrlToDeploymentUrl(url) {
  const feedbackMatch = url.match(/vercel\.live\/open-feedback\/(.+)/);
  if (feedbackMatch) return `https://${feedbackMatch[1]}`;
  return url;
}
tasksRouter.get("/:taskId/deployment", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.previewUrl) {
      const previewUrl = convertFeedbackUrlToDeploymentUrl(task.previewUrl);
      if (previewUrl !== task.previewUrl) await getDb().tasks.update(taskId, { previewUrl });
      return c.json({ success: true, data: { hasDeployment: true, previewUrl, cached: true } });
    }
    if (!task.branchName || !task.repoUrl)
      return c.json({
        success: true,
        data: { hasDeployment: false, message: "Task does not have branch or repository information" }
      });
    const githubMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!githubMatch)
      return c.json({ success: true, data: { hasDeployment: false, message: "Invalid GitHub repository URL" } });
    const [, owner, repo] = githubMatch;
    try {
      const octokit = await getOctokit(session.user.id);
      if (!octokit.auth)
        return c.json({ success: true, data: { hasDeployment: false, message: "GitHub account not connected" } });
      let latestCommitSha = null;
      try {
        const { data: branch } = await octokit.rest.repos.getBranch({ owner, repo, branch: task.branchName });
        latestCommitSha = branch.commit.sha;
      } catch (branchError) {
        if (branchError && typeof branchError === "object" && "status" in branchError && branchError.status === 404)
          return c.json({ success: true, data: { hasDeployment: false, message: "Branch not found" } });
        throw branchError;
      }
      if (latestCommitSha) {
        try {
          const { data: checkRuns } = await octokit.rest.checks.listForRef({
            owner,
            repo,
            ref: latestCommitSha,
            per_page: 100
          });
          const extractPreviewUrl = (check) => {
            if (check.output?.summary) {
              const urlMatch = check.output.summary.match(/https?:\/\/[^\s\)\]<]+\.vercel\.app/i);
              if (urlMatch) return urlMatch[0];
            }
            if (check.output?.text) {
              const urlMatch = check.output.text.match(/https?:\/\/[^\s\)\]<]+\.vercel\.app/i);
              if (urlMatch) return urlMatch[0];
            }
            return null;
          };
          const vercelPreviewCheck = checkRuns.check_runs.find(
            (check) => check.app?.slug === "vercel" && check.name === "Vercel Preview Comments" && check.status === "completed"
          );
          const vercelDeploymentCheck = checkRuns.check_runs.find(
            (check) => check.app?.slug === "vercel" && check.name === "Vercel" && check.conclusion === "success" && check.status === "completed"
          );
          let previewUrl = null;
          if (vercelPreviewCheck) previewUrl = extractPreviewUrl(vercelPreviewCheck);
          if (!previewUrl && vercelDeploymentCheck) previewUrl = extractPreviewUrl(vercelDeploymentCheck);
          if (!previewUrl && vercelDeploymentCheck?.details_url)
            previewUrl = convertFeedbackUrlToDeploymentUrl(vercelDeploymentCheck.details_url);
          if (previewUrl) {
            await getDb().tasks.update(taskId, { previewUrl });
            return c.json({
              success: true,
              data: {
                hasDeployment: true,
                previewUrl,
                checkId: vercelDeploymentCheck?.id || vercelPreviewCheck?.id,
                createdAt: vercelDeploymentCheck?.completed_at || vercelPreviewCheck?.completed_at
              }
            });
          }
        } catch (checksError) {
          console.error("Error checking GitHub Checks:", checksError);
        }
      }
      try {
        const { data: ghDeployments } = await octokit.rest.repos.listDeployments({
          owner,
          repo,
          ref: task.branchName,
          per_page: 10
        });
        if (ghDeployments && ghDeployments.length > 0) {
          for (const deployment of ghDeployments) {
            if (deployment.environment === "Preview" || deployment.environment === "preview" || deployment.description?.toLowerCase().includes("vercel")) {
              const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
                owner,
                repo,
                deployment_id: deployment.id,
                per_page: 1
              });
              if (statuses && statuses.length > 0) {
                const status = statuses[0];
                if (status.state === "success") {
                  let previewUrl = status.environment_url || status.target_url;
                  if (previewUrl) {
                    previewUrl = convertFeedbackUrlToDeploymentUrl(previewUrl);
                    await getDb().tasks.update(taskId, { previewUrl });
                    return c.json({
                      success: true,
                      data: {
                        hasDeployment: true,
                        previewUrl,
                        deploymentId: deployment.id,
                        createdAt: deployment.created_at
                      }
                    });
                  }
                }
              }
            }
          }
        }
      } catch (deploymentsError) {
        console.error("Error checking GitHub Deployments:", deploymentsError);
      }
      if (latestCommitSha) {
        try {
          const { data: statuses } = await octokit.rest.repos.listCommitStatusesForRef({
            owner,
            repo,
            ref: latestCommitSha,
            per_page: 100
          });
          const vercelStatus = statuses.find(
            (s) => s.context?.toLowerCase().includes("vercel") && s.state === "success" && s.target_url
          );
          if (vercelStatus && vercelStatus.target_url) {
            const previewUrl = convertFeedbackUrlToDeploymentUrl(vercelStatus.target_url);
            await getDb().tasks.update(taskId, { previewUrl });
            return c.json({
              success: true,
              data: { hasDeployment: true, previewUrl, createdAt: vercelStatus.created_at }
            });
          }
        } catch (statusError) {
          console.error("Error checking commit statuses:", statusError);
        }
      }
      return c.json({ success: true, data: { hasDeployment: false, message: "No successful deployment found" } });
    } catch (error) {
      console.error("Error fetching deployment status:", error);
      if (error && typeof error === "object" && "status" in error && error.status === 404)
        return c.json({ success: true, data: { hasDeployment: false, message: "Branch or repository not found" } });
      return c.json({ success: true, data: { hasDeployment: false, message: "Failed to fetch deployment status" } });
    }
  } catch (error) {
    console.error("Error in deployment API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
tasksRouter.get("/:taskId/deployments", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    const taskDeployments = await getDb().deployments.findByTaskId(taskId);
    return c.json({
      deployments: taskDeployments.map((d) => ({ ...d, metadata: d.metadata ? JSON.parse(d.metadata) : null }))
    });
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return c.json({ error: "Failed to fetch deployments" }, 500);
  }
});
tasksRouter.post("/:taskId/deployments", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { type = "web", url, qrCodeUrl, pagePath, appId, label, metadata } = body;
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    let path5 = null;
    if (type === "web" && url) {
      try {
        const urlObj = new URL(url);
        path5 = urlObj.pathname;
      } catch {
      }
    }
    const now4 = Date.now();
    const deploymentId = nanoid6(12);
    if (type === "miniprogram") {
      const existing = await getDb().deployments.findByTaskIdAndTypePath(taskId, "miniprogram", null);
      if (existing) {
        const updated = await getDb().deployments.update(existing.id, {
          qrCodeUrl: qrCodeUrl || existing.qrCodeUrl,
          pagePath: pagePath || existing.pagePath,
          appId: appId || existing.appId,
          label: label || existing.label,
          metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
          updatedAt: now4
        });
        return c.json({ deployment: { ...updated, metadata } });
      }
    } else if (type === "web" && path5) {
      const existing = await getDb().deployments.findByTaskIdAndTypePath(taskId, "web", path5);
      if (existing) {
        const updated = await getDb().deployments.update(existing.id, {
          url: url || existing.url,
          label: label || existing.label,
          metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
          updatedAt: now4
        });
        return c.json({ deployment: { ...updated, metadata } });
      }
    }
    const newDeployment = await getDb().deployments.create({
      id: deploymentId,
      taskId,
      type,
      url: url || null,
      path: path5 || null,
      qrCodeUrl: qrCodeUrl || null,
      pagePath: pagePath || null,
      appId: appId || null,
      label: label || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now4,
      updatedAt: now4
    });
    return c.json({ deployment: { ...newDeployment, metadata } });
  } catch (error) {
    console.error("Error creating deployment:", error);
    return c.json({ error: "Failed to create deployment" }, 500);
  }
});
tasksRouter.delete("/:taskId/deployments/:deploymentId", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId, deploymentId } = c.req.param();
    const deployment = await getDb().deployments.findByTaskIdAndUserId(taskId, session.user.id);
    if (!deployment || deployment.id !== deploymentId) return c.json({ error: "Deployment not found" }, 404);
    await getDb().deployments.softDelete(deploymentId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting deployment:", error);
    return c.json({ error: "Failed to delete deployment" }, 500);
  }
});
tasksRouter.get("/:taskId/sandbox-health", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ status: "not_found" });
    if (!task.sandboxId) return c.json({ status: "not_available", message: "Sandbox not created yet" });
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ status: "stopped", message: "Sandbox not available" });
    const result = await runCommandInScfSandbox(sandbox, "echo ok");
    if (result.success) return c.json({ status: "running", message: "Sandbox is running" });
    return c.json({ status: "error", message: "Sandbox is not responding" });
  } catch (error) {
    console.error("Error checking sandbox health:", error);
    return c.json({ status: "error", message: "Failed to check sandbox health" });
  }
});
tasksRouter.post("/:taskId/start-sandbox", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const task = await getDb().tasks.findById(taskId);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.userId !== session.user.id) return c.json({ error: "Unauthorized" }, 403);
    if (!task.keepAlive) return c.json({ error: "Keep-alive is not enabled for this task" }, 400);
    const logger = createTaskLogger(taskId);
    if (task.sandboxId) {
      try {
        const existingSandbox = await getScfSandbox(task, envId);
        if (existingSandbox) {
          const testResult = await runCommandInScfSandbox(existingSandbox, "echo test");
          if (testResult.success) return c.json({ error: "Sandbox is already running" }, 400);
        }
      } catch {
        await logger.info("Existing sandbox not accessible, creating new one");
        await getDb().tasks.update(taskId, { sandboxId: null, sandboxUrl: null, updatedAt: Date.now() });
      }
    }
    await logger.info("Starting sandbox");
    const sandbox = await scfSandboxManager.getOrCreate(taskId, envId);
    await getDb().tasks.update(taskId, { sandboxId: sandbox.functionName, updatedAt: Date.now() });
    await logger.info("Sandbox started successfully");
    return c.json({ success: true, message: "Sandbox started successfully", sandboxId: sandbox.functionName });
  } catch (error) {
    console.error("Error starting sandbox:", error);
    return c.json({ error: "Failed to start sandbox" }, 500);
  }
});
tasksRouter.post("/:taskId/stop-sandbox", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await getDb().tasks.findById(taskId);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.userId !== session.user.id) return c.json({ error: "Unauthorized" }, 403);
    if (!task.sandboxId) return c.json({ error: "Sandbox is not active" }, 400);
    await getDb().tasks.update(taskId, { sandboxId: null, sandboxUrl: null, updatedAt: Date.now() });
    return c.json({ success: true, message: "Sandbox stopped successfully" });
  } catch (error) {
    console.error("Error stopping sandbox:", error);
    return c.json({ error: "Failed to stop sandbox" }, 500);
  }
});
tasksRouter.post("/:taskId/restart-dev", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const task = await getDb().tasks.findById(taskId);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.userId !== session.user.id) return c.json({ error: "Unauthorized" }, 403);
    if (!task.sandboxId) return c.json({ error: "Sandbox is not active" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ error: "Sandbox not available" }, 400);
    const packageJsonFile = await readFileFromSandbox(sandbox, "package.json");
    if (!packageJsonFile.found) return c.json({ error: "No package.json found in sandbox" }, 400);
    let packageJson;
    try {
      packageJson = JSON.parse(packageJsonFile.content);
    } catch {
      return c.json({ error: "Could not parse package.json" }, 500);
    }
    if (!packageJson?.scripts?.dev) return c.json({ error: "No dev script found in package.json" }, 400);
    const hasVite = packageJson?.dependencies?.vite || packageJson?.devDependencies?.vite;
    const devPort = hasVite ? 5173 : 3e3;
    await runCommandInScfSandbox(sandbox, `lsof -ti:${devPort} | xargs -r kill -9 2>/dev/null || true`);
    const packageManager = await detectPackageManager(sandbox);
    const devCommand = packageManager === "npm" ? "npm run dev" : `${packageManager} dev`;
    await runCommandInScfSandbox(sandbox, `nohup ${devCommand} > /dev/null 2>&1 &`);
    return c.json({ success: true, message: "Dev server restarted successfully" });
  } catch (error) {
    console.error("Error restarting dev server:", error);
    return c.json({ error: "Failed to restart dev server" }, 500);
  }
});
tasksRouter.post("/:taskId/clear-logs", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    await getDb().tasks.update(taskId, { logs: "[]" });
    return c.json({ success: true, message: "Logs cleared successfully" });
  } catch (error) {
    console.error("Error clearing logs:", error);
    return c.json({ success: false, error: "Failed to clear logs" }, 500);
  }
});
tasksRouter.get("/:taskId/pr-comments", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const { taskId } = c.req.param();
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.prNumber || !task.repoUrl) return c.json({ success: false, error: "Task does not have a PR" }, 400);
    const repoMatch = task.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!repoMatch) return c.json({ success: false, error: "Invalid repository URL" }, 400);
    const [, owner, repo] = repoMatch;
    const octokit = await getOctokit(session.user.id);
    if (!octokit.auth) return c.json({ success: false, error: "GitHub authentication required" }, 401);
    const [issueCommentsResponse, reviewCommentsResponse] = await Promise.all([
      octokit.rest.issues.listComments({ owner, repo, issue_number: task.prNumber }),
      octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: task.prNumber })
    ]);
    const allComments = [
      ...issueCommentsResponse.data.map((comment) => ({
        id: comment.id,
        user: { login: comment.user?.login || "unknown", avatar_url: comment.user?.avatar_url || "" },
        body: comment.body || "",
        created_at: comment.created_at,
        html_url: comment.html_url
      })),
      ...reviewCommentsResponse.data.map((comment) => ({
        id: comment.id,
        user: { login: comment.user?.login || "unknown", avatar_url: comment.user?.avatar_url || "" },
        body: comment.body || "",
        created_at: comment.created_at,
        html_url: comment.html_url
      }))
    ];
    allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return c.json({ success: true, comments: allComments });
  } catch (error) {
    console.error("Error fetching PR comments:", error);
    return c.json({ success: false, error: "Failed to fetch PR comments" }, 500);
  }
});
tasksRouter.post("/:taskId/file-operation", requireUserEnv, async (c) => {
  try {
    const session = c.get("session");
    const { envId } = c.get("userEnv");
    const { taskId } = c.req.param();
    const body = await c.req.json();
    const { operation, sourceFile, targetPath } = body;
    if (!operation || !sourceFile) return c.json({ success: false, error: "Missing required parameters" }, 400);
    const task = await findActiveTask(taskId, session.user.id);
    if (!task) return c.json({ success: false, error: "Task not found" }, 404);
    if (!task.sandboxId) return c.json({ success: false, error: "Sandbox not available" }, 400);
    const sandbox = await getScfSandbox(task, envId);
    if (!sandbox) return c.json({ success: false, error: "Sandbox not found" }, 404);
    const sourceBasename = sourceFile.split("/").pop();
    const targetFile = targetPath ? `${targetPath}/${sourceBasename}` : sourceBasename;
    const escapedSource = sourceFile.replace(/'/g, "'\\''");
    const escapedTarget = targetFile.replace(/'/g, "'\\''");
    if (operation === "copy") {
      const copyResult = await runCommandInScfSandbox(sandbox, `cp -r '${escapedSource}' '${escapedTarget}'`);
      if (!copyResult.success) return c.json({ success: false, error: "Failed to copy file" }, 500);
      return c.json({ success: true, message: "File copied successfully" });
    } else if (operation === "cut") {
      const mvResult = await runCommandInScfSandbox(sandbox, `mv '${escapedSource}' '${escapedTarget}'`);
      if (!mvResult.success) return c.json({ success: false, error: "Failed to move file" }, 500);
      return c.json({ success: true, message: "File moved successfully" });
    } else return c.json({ success: false, error: "Invalid operation" }, 400);
  } catch (error) {
    console.error("Error performing file operation:", error);
    return c.json({ success: false, error: "Failed to perform file operation" }, 500);
  }
});
var tasks_default = tasksRouter;

// src/routes/connectors.ts
import { Hono as Hono6 } from "hono";
import { nanoid as nanoid7 } from "nanoid";
var app2 = new Hono6();
app2.get("/", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const userConnectors = await getDb().connectors.findByUserId(userId);
    const decryptedConnectors = userConnectors.map((connector) => ({
      ...connector,
      oauthClientSecret: connector.oauthClientSecret ? decrypt(connector.oauthClientSecret) : null,
      env: connector.env ? JSON.parse(decrypt(connector.env)) : null
    }));
    return c.json({
      success: true,
      data: decryptedConnectors
    });
  } catch (error) {
    console.error("Error fetching connectors:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch connectors",
        data: []
      },
      { status: 500 }
    );
  }
});
app2.post("/", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const body = await c.req.json();
    const connectorData = {
      id: nanoid7(),
      userId,
      name: body.name,
      description: body.description?.trim() || void 0,
      type: body.type || "remote",
      baseUrl: body.baseUrl?.trim() || void 0,
      oauthClientId: body.oauthClientId?.trim() || void 0,
      oauthClientSecret: body.oauthClientSecret?.trim() || void 0,
      command: body.command?.trim() || void 0,
      env: body.env,
      status: "connected"
    };
    await getDb().connectors.create({
      id: connectorData.id,
      userId: connectorData.userId,
      name: connectorData.name,
      description: connectorData.description || null,
      type: connectorData.type,
      baseUrl: connectorData.baseUrl || null,
      oauthClientId: connectorData.oauthClientId || null,
      oauthClientSecret: connectorData.oauthClientSecret ? encrypt(connectorData.oauthClientSecret) : null,
      command: connectorData.command || null,
      env: connectorData.env ? encrypt(JSON.stringify(connectorData.env)) : null,
      status: connectorData.status
    });
    return c.json({
      success: true,
      message: "Connector created successfully",
      data: { id: connectorData.id }
    });
  } catch (error) {
    console.error("Error creating connector:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create connector"
      },
      { status: 500 }
    );
  }
});
app2.patch("/:id", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const id = c.req.param("id");
    const body = await c.req.json();
    const connectorData = {
      userId,
      name: body.name,
      description: body.description?.trim() || void 0,
      type: body.type || "remote",
      baseUrl: body.baseUrl?.trim() || void 0,
      oauthClientId: body.oauthClientId?.trim() || void 0,
      oauthClientSecret: body.oauthClientSecret?.trim() || void 0,
      command: body.command?.trim() || void 0,
      env: body.env,
      status: body.status || "connected"
    };
    const validatedData = connectorData;
    await getDb().connectors.update(id, userId, {
      name: validatedData.name,
      description: validatedData.description || null,
      type: validatedData.type,
      baseUrl: validatedData.baseUrl || null,
      oauthClientId: validatedData.oauthClientId || null,
      oauthClientSecret: validatedData.oauthClientSecret ? encrypt(validatedData.oauthClientSecret) : null,
      command: validatedData.command || null,
      env: validatedData.env ? encrypt(JSON.stringify(validatedData.env)) : null,
      status: validatedData.status,
      updatedAt: Date.now()
    });
    return c.json({
      success: true,
      message: "Connector updated successfully"
    });
  } catch (error) {
    console.error("Error updating connector:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update connector"
      },
      { status: 500 }
    );
  }
});
app2.delete("/:id", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const id = c.req.param("id");
    await getDb().connectors.delete(id, userId);
    return c.json({
      success: true,
      message: "Connector deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting connector:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete connector"
      },
      { status: 500 }
    );
  }
});
app2.patch("/:id/status", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const id = c.req.param("id");
    const body = await c.req.json();
    const status = body.status;
    if (!["connected", "disconnected"].includes(status)) {
      return c.json(
        {
          success: false,
          error: "Invalid status"
        },
        { status: 400 }
      );
    }
    await getDb().connectors.update(id, userId, { status });
    return c.json({
      success: true,
      message: `Connector ${status === "connected" ? "connected" : "disconnected"} successfully`
    });
  } catch (error) {
    console.error("Error toggling connector status:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update connector status"
      },
      { status: 500 }
    );
  }
});
var connectors_default = app2;

// src/routes/miniprogram.ts
import { Hono as Hono7 } from "hono";
import { nanoid as nanoid8 } from "nanoid";
var app3 = new Hono7();
app3.get("/", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const apps = await getDb().miniprogramApps.findByUserId(userId);
  const masked = apps.map((app8) => ({
    ...app8,
    privateKey: "***"
  }));
  return c.json({ success: true, data: masked });
});
app3.post("/", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const body = await c.req.json();
  const { name, appId, privateKey, description } = body;
  if (!name || !appId || !privateKey) {
    return c.json({ error: "name, appId, and privateKey are required" }, 400);
  }
  const app8 = await getDb().miniprogramApps.create({
    id: nanoid8(),
    userId,
    name,
    appId,
    privateKey: encrypt(privateKey),
    description: description || null
  });
  return c.json({ success: true, data: { ...app8, privateKey: "***" } }, 201);
});
app3.patch("/:id", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const { id } = c.req.param();
  const body = await c.req.json();
  const existing = await getDb().miniprogramApps.findByIdAndUserId(id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const update = {};
  if (body.name !== void 0) update.name = body.name;
  if (body.appId !== void 0) update.appId = body.appId;
  if (body.privateKey !== void 0) update.privateKey = encrypt(body.privateKey);
  if (body.description !== void 0) update.description = body.description;
  const updated = await getDb().miniprogramApps.update(id, userId, update);
  return c.json({ success: true, data: updated ? { ...updated, privateKey: "***" } : null });
});
app3.delete("/:id", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const { id } = c.req.param();
  const existing = await getDb().miniprogramApps.findByIdAndUserId(id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);
  await getDb().miniprogramApps.delete(id, userId);
  return c.json({ success: true, message: "Deleted" });
});
app3.get("/by-appid/:appId", async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const userId = session.user.id;
  const { appId } = c.req.param();
  const record = await getDb().miniprogramApps.findByAppIdAndUserId(appId, userId);
  if (!record) return c.json({ error: "Not found" }, 404);
  return c.json({
    success: true,
    data: {
      ...record,
      privateKey: decrypt(record.privateKey)
    }
  });
});
var miniprogram_default = app3;

// src/routes/api-keys.ts
import { Hono as Hono8 } from "hono";
import { nanoid as nanoid9 } from "nanoid";
var VALID_PROVIDERS = ["openai", "gemini", "cursor", "anthropic", "aigateway"];
var AGENT_PROVIDER_MAP = {
  claude: "aigateway",
  codex: "aigateway",
  copilot: null,
  // uses GitHub token
  cursor: "cursor",
  gemini: "gemini",
  opencode: "openai"
};
function isAnthropicModel(model) {
  return ["claude", "sonnet", "opus"].some((p) => model.toLowerCase().includes(p));
}
function isOpenAIModel(model) {
  return ["gpt", "openai"].some((p) => model.toLowerCase().includes(p));
}
function isGeminiModel(model) {
  return model.toLowerCase().includes("gemini");
}
async function getUserGitHubToken2(userId) {
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(userId, "github");
    if (account?.accessToken) {
      return decrypt(account.accessToken);
    }
    const user = await getDb().users.findById(userId);
    if (user?.provider === "github" && user.accessToken) {
      return decrypt(user.accessToken);
    }
    return null;
  } catch {
    return null;
  }
}
async function getUserApiKey(userId, provider) {
  const systemKeys = {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    cursor: process.env.CURSOR_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    aigateway: process.env.AI_GATEWAY_API_KEY
  };
  try {
    const userKey = await getDb().keys.findByUserIdAndProvider(userId, provider);
    if (userKey?.value) {
      return decrypt(userKey.value);
    }
  } catch {
  }
  return systemKeys[provider];
}
var app4 = new Hono8();
app4.get("/", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const userKeys = await getDb().keys.findByUserId(userId);
    return c.json({
      success: true,
      apiKeys: userKeys.map((k) => ({ provider: k.provider, createdAt: k.createdAt }))
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return c.json({ error: "Failed to fetch API keys" }, 500);
  }
});
app4.post("/", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const body = await c.req.json();
    const { provider, apiKey } = body;
    if (!provider || !apiKey) {
      return c.json({ error: "Provider and API key are required" }, 400);
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      return c.json({ error: "Invalid provider" }, 400);
    }
    const encryptedKey = encrypt(apiKey);
    await getDb().keys.upsert({
      id: nanoid9(),
      userId,
      provider,
      value: encryptedKey
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving API key:", error);
    return c.json({ error: "Failed to save API key" }, 500);
  }
});
app4.delete("/", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const provider = c.req.query("provider");
    if (!provider) {
      return c.json({ error: "Provider is required" }, 400);
    }
    await getDb().keys.delete(userId, provider);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return c.json({ error: "Failed to delete API key" }, 500);
  }
});
app4.get("/check", async (c) => {
  try {
    const agent = c.req.query("agent");
    const model = c.req.query("model");
    if (!agent) {
      return c.json({ error: "Agent parameter is required" }, 400);
    }
    if (!(agent in AGENT_PROVIDER_MAP)) {
      return c.json({ error: "Invalid agent" }, 400);
    }
    if (agent === "copilot") {
      const session2 = c.get("session");
      const userId2 = session2?.user?.id;
      const githubToken = userId2 ? await getUserGitHubToken2(userId2) : null;
      return c.json({
        success: true,
        hasKey: !!githubToken,
        provider: "github",
        agentName: "Copilot"
      });
    }
    let provider = AGENT_PROVIDER_MAP[agent];
    if (model && (agent === "cursor" || agent === "opencode")) {
      if (isAnthropicModel(model)) {
        provider = "anthropic";
      } else if (isGeminiModel(model)) {
        provider = "gemini";
      } else if (isOpenAIModel(model)) {
        provider = "aigateway";
      }
    }
    const session = c.get("session");
    const userId = session?.user?.id;
    const apiKey = userId ? await getUserApiKey(userId, provider) : process.env[`${provider.toUpperCase()}_API_KEY`];
    const hasKey = !!apiKey;
    return c.json({
      success: true,
      hasKey,
      provider,
      agentName: agent.charAt(0).toUpperCase() + agent.slice(1)
    });
  } catch (error) {
    console.error("Error checking API key:", error);
    return c.json({ error: "Failed to check API key" }, 500);
  }
});
var api_keys_default = app4;

// src/routes/misc.ts
import { Hono as Hono9 } from "hono";
var GITHUB_REPO = "vercel-labs/coding-agent-template";
var CACHE_DURATION_MS = 5 * 60 * 1e3;
var cachedStars = null;
var lastFetch = 0;
var app5 = new Hono9();
app5.get("/github-stars", async (c) => {
  try {
    const now4 = Date.now();
    if (cachedStars !== null && now4 - lastFetch < CACHE_DURATION_MS) {
      return c.json({ stars: cachedStars });
    }
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "coding-agent-template"
      }
    });
    if (!response.ok) {
      throw new Error("GitHub API request failed");
    }
    const data = await response.json();
    cachedStars = data.stargazers_count;
    lastFetch = now4;
    return c.json({ stars: cachedStars });
  } catch (error) {
    console.error("Error fetching GitHub stars:", error);
    return c.json({ stars: cachedStars || 1200 });
  }
});
app5.get("/sandboxes", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const allTasks = await getDb().tasks.findByUserId(userId);
    const runningSandboxes = allTasks.filter((t) => t.sandboxId && !t.deletedAt).map((t) => ({
      id: t.id,
      taskId: t.id,
      prompt: t.prompt,
      repoUrl: t.repoUrl,
      branchName: t.branchName,
      sandboxId: t.sandboxId,
      sandboxUrl: t.sandboxUrl,
      createdAt: t.createdAt,
      status: t.status,
      keepAlive: t.keepAlive,
      maxDuration: t.maxDuration
    }));
    return c.json({ sandboxes: runningSandboxes });
  } catch (error) {
    console.error("Error fetching sandboxes:", error);
    return c.json({ error: "Failed to fetch sandboxes" }, 500);
  }
});
app5.get("/vercel/teams", (c) => {
  return c.json({ scopes: [] });
});
var misc_default = app5;

// src/routes/repos.ts
import { Hono as Hono10 } from "hono";
import { Octokit as Octokit3 } from "@octokit/rest";
var app6 = new Hono10();
async function getGitHubToken2(userId) {
  try {
    const account = await getDb().accounts.findByUserIdAndProvider(userId, "github");
    if (account?.accessToken) {
      return decrypt(account.accessToken);
    }
    const user = await getDb().users.findById(userId);
    if (user?.provider === "github" && user.accessToken) {
      return decrypt(user.accessToken);
    }
    return null;
  } catch {
    return null;
  }
}
app6.get("/:owner/:repo/commits", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const session = c.get("session");
    const token = session?.user?.id ? await getGitHubToken2(session.user.id) : null;
    if (!token) {
      return c.json({ error: "GitHub authentication required" }, 401);
    }
    const octokit = new Octokit3({ auth: token });
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 30
    });
    return c.json({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return c.json({ error: "Failed to fetch commits" }, 500);
  }
});
app6.get("/:owner/:repo/issues", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const session = c.get("session");
    const token = session?.user?.id ? await getGitHubToken2(session.user.id) : null;
    if (!token) {
      return c.json({ error: "GitHub authentication required" }, 401);
    }
    const octokit = new Octokit3({ auth: token });
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 30
    });
    const filteredIssues = issues.filter((issue) => !issue.pull_request);
    return c.json({ issues: filteredIssues });
  } catch (error) {
    console.error("Error fetching issues:", error);
    return c.json({ error: "Failed to fetch issues" }, 500);
  }
});
app6.get("/:owner/:repo/pull-requests", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const session = c.get("session");
    const token = session?.user?.id ? await getGitHubToken2(session.user.id) : null;
    if (!token) {
      return c.json({ error: "GitHub authentication required" }, 401);
    }
    const octokit = new Octokit3({ auth: token });
    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 30,
      sort: "updated",
      direction: "desc"
    });
    return c.json({ pullRequests });
  } catch (error) {
    console.error("Error fetching pull requests:", error);
    return c.json({ error: "Failed to fetch pull requests" }, 500);
  }
});
app6.get("/:owner/:repo/pull-requests/:pr_number/check-task", async (c) => {
  try {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const session = c.get("session");
    const userId = session.user.id;
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const prNumberStr = c.req.param("pr_number");
    const prNumber = parseInt(prNumberStr, 10);
    if (isNaN(prNumber)) {
      return c.json({ error: "Invalid PR number" }, 400);
    }
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const existingTasks = await getDb().tasks.findByRepoAndPr(userId, prNumber, repoUrl);
    return c.json({
      hasTask: existingTasks.length > 0,
      taskId: existingTasks.length > 0 ? existingTasks[0].id : null
    });
  } catch (error) {
    console.error("Error checking for existing task:", error);
    return c.json({ error: "Failed to check for existing task" }, 500);
  }
});
app6.patch("/:owner/:repo/pull-requests/:pr_number/close", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const prNumberStr = c.req.param("pr_number");
    const prNumber = parseInt(prNumberStr, 10);
    if (isNaN(prNumber)) {
      return c.json({ error: "Invalid pull request number" }, 400);
    }
    const session = c.get("session");
    const token = session?.user?.id ? await getGitHubToken2(session.user.id) : null;
    if (!token) {
      return c.json({ error: "GitHub authentication required" }, 401);
    }
    const octokit = new Octokit3({ auth: token });
    const { data: pullRequest } = await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      state: "closed"
    });
    return c.json({ pullRequest });
  } catch (error) {
    console.error("Error closing pull request:", error);
    return c.json({ error: "Failed to close pull request" }, 500);
  }
});
var repos_default = app6;

// src/routes/database.ts
import { Hono as Hono11 } from "hono";

// src/cloudbase/database.ts
import CloudBase4 from "@cloudbase/manager-node";
function createManager(creds) {
  return new CloudBase4({
    secretId: creds.secretId,
    secretKey: creds.secretKey,
    token: creds.sessionToken || "",
    envId: creds.envId,
    proxy: process.env.http_proxy
  });
}
async function getDatabaseInstanceId(manager) {
  const { EnvInfo } = await manager.env.getEnvInfo();
  if (!EnvInfo?.Databases?.[0]?.InstanceId) {
    throw new Error("\u65E0\u6CD5\u83B7\u53D6\u6570\u636E\u5E93\u5B9E\u4F8BID");
  }
  return EnvInfo.Databases[0].InstanceId;
}
async function listCollections(creds) {
  const manager = createManager(creds);
  const result = await manager.database.listCollections({
    MgoOffset: 0,
    MgoLimit: 1e3
  });
  const collections = (result.Collections || []).map((c) => ({
    CollectionName: c.CollectionName,
    Count: c.Count,
    Size: c.Size,
    IndexCount: c.IndexCount,
    IndexSize: c.IndexSize
  }));
  return {
    collections,
    total: result.Pager?.Total ?? collections.length
  };
}
async function createCollection(creds, name) {
  const manager = createManager(creds);
  await manager.database.createCollection(name);
  await waitForCollectionReady(manager, name);
}
async function deleteCollection(creds, name) {
  const manager = createManager(creds);
  await manager.database.deleteCollection(name);
}
async function queryDocuments(creds, collection, page = 1, pageSize = 50, where) {
  const manager = createManager(creds);
  const instanceId = await getDatabaseInstanceId(manager);
  const offset = (page - 1) * pageSize;
  const mgoQuery = where && Object.keys(where).length > 0 ? JSON.stringify(where) : "{}";
  const result = await manager.commonService("tcb", "2018-06-08").call({
    Action: "QueryRecords",
    Param: {
      TableName: collection,
      MgoQuery: mgoQuery,
      MgoLimit: pageSize,
      MgoOffset: offset,
      Tag: instanceId
    }
  });
  const documents = (result.Data || []).map((item) => {
    if (typeof item === "string") {
      try {
        const parsed = JSON.parse(item);
        return typeof parsed === "object" && parsed !== null ? parsed : item;
      } catch {
        return item;
      }
    }
    return item;
  });
  return {
    documents,
    total: result.Pager?.Total ?? documents.length,
    page,
    pageSize
  };
}
async function insertDocument(creds, collection, data) {
  const manager = createManager(creds);
  const instanceId = await getDatabaseInstanceId(manager);
  const result = await manager.commonService("tcb", "2018-06-08").call({
    Action: "PutItem",
    Param: {
      TableName: collection,
      MgoDocs: [JSON.stringify(data)],
      Tag: instanceId
    }
  });
  return result.InsertedIds?.[0] ?? "";
}
async function updateDocument(creds, collection, docId, data) {
  const manager = createManager(creds);
  const instanceId = await getDatabaseInstanceId(manager);
  const { _id, ...updateData } = data;
  await manager.commonService("tcb", "2018-06-08").call({
    Action: "UpdateItem",
    Param: {
      TableName: collection,
      MgoQuery: JSON.stringify({ _id: docId }),
      MgoUpdate: JSON.stringify({ $set: updateData }),
      MgoIsMulti: false,
      MgoUpsert: false,
      Tag: instanceId
    }
  });
}
async function deleteDocument(creds, collection, docId) {
  const manager = createManager(creds);
  const instanceId = await getDatabaseInstanceId(manager);
  await manager.commonService("tcb", "2018-06-08").call({
    Action: "DeleteItem",
    Param: {
      TableName: collection,
      MgoQuery: JSON.stringify({ _id: docId }),
      MgoIsMulti: false,
      Tag: instanceId
    }
  });
}
function delay(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
async function waitForCollectionReady(manager, name, timeoutMs = 1e4, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      const result = await manager.database.checkCollectionExists(name);
      if (result.Exists) return;
    } catch {
    }
    if (Date.now() + intervalMs > deadline) break;
    await delay(intervalMs);
  }
  throw new Error(`Collection ${name} creation timed out`);
}

// src/routes/database.ts
var router = new Hono11();
function getCreds(c) {
  const { envId, credentials } = c.get("userEnv");
  return {
    envId,
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken
  };
}
router.get("/collections", requireUserEnv, async (c) => {
  try {
    const result = await listCollections(getCreds(c));
    return c.json(result.collections);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.post("/collections", requireUserEnv, async (c) => {
  try {
    const { name } = await c.req.json();
    await createCollection(getCreds(c), name);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.delete("/collections/:name", requireUserEnv, async (c) => {
  try {
    await deleteCollection(getCreds(c), c.req.param("name"));
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.get("/collections/:name/documents", requireUserEnv, async (c) => {
  try {
    const name = c.req.param("name");
    const page = Number(c.req.query("page") || "1");
    const pageSize = Number(c.req.query("pageSize") || "50");
    const search = c.req.query("search")?.trim();
    let where;
    if (search) {
      if (search.includes(":")) {
        const [field, ...rest] = search.split(":");
        const val = rest.join(":");
        where = { [field.trim()]: val.trim() };
      } else {
        where = { _id: search };
      }
    }
    const result = await queryDocuments(getCreds(c), name, page, pageSize, where);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.post("/collections/:name/documents", requireUserEnv, async (c) => {
  try {
    const data = await c.req.json();
    const id = await insertDocument(getCreds(c), c.req.param("name"), data);
    return c.json({ _id: id });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.put("/collections/:name/documents/:id", requireUserEnv, async (c) => {
  try {
    const data = await c.req.json();
    await updateDocument(getCreds(c), c.req.param("name"), c.req.param("id"), data);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router.delete("/collections/:name/documents/:id", requireUserEnv, async (c) => {
  try {
    await deleteDocument(getCreds(c), c.req.param("name"), c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
var database_default = router;

// src/routes/storage.ts
import { Hono as Hono12 } from "hono";

// src/cloudbase/storage.ts
async function getBuckets(creds) {
  const manager = createManager(creds);
  const { EnvInfo } = await manager.env.getEnvInfo();
  const buckets = [];
  const storage = EnvInfo?.Storages?.[0];
  if (storage) {
    buckets.push({
      type: "storage",
      name: storage.Bucket ?? "",
      label: "\u4E91\u5B58\u50A8",
      bucket: storage.Bucket ?? "",
      region: storage.Region ?? "",
      cdnDomain: storage.CdnDomain || "",
      isPublic: false
    });
  }
  try {
    const hostingInfo = await manager.hosting.getInfo();
    const hosting = hostingInfo?.[0];
    if (hosting) {
      buckets.push({
        type: "static",
        name: hosting.Bucket || "static",
        label: "\u9759\u6001\u6258\u7BA1",
        bucket: hosting.Bucket || "",
        region: hosting.Regoin || storage?.Region || "ap-shanghai",
        cdnDomain: hosting.CdnDomain || "",
        isPublic: true
      });
    }
  } catch {
    const staticStore = EnvInfo?.StaticStorages?.[0];
    if (staticStore) {
      buckets.push({
        type: "static",
        name: staticStore.Bucket || "static",
        label: "\u9759\u6001\u6258\u7BA1",
        bucket: staticStore.Bucket || "",
        region: staticStore.Region || storage?.Region || "ap-shanghai",
        cdnDomain: staticStore.CdnDomain || "",
        isPublic: true
      });
    }
  }
  return buckets;
}
async function listStorageFiles(creds, prefix = "") {
  const manager = createManager(creds);
  const files = await manager.storage.walkCloudDir(prefix);
  const fileMap = /* @__PURE__ */ new Map();
  for (const f of files) {
    const key = f.Key;
    if (!key) continue;
    const rel = prefix ? key.slice(prefix.length) : key;
    if (!rel) continue;
    const slashIdx = rel.indexOf("/");
    if (slashIdx !== -1 && slashIdx < rel.length - 1) {
      const dirName = rel.slice(0, slashIdx + 1);
      const dirKey = prefix + dirName;
      if (!fileMap.has(dirKey)) {
        fileMap.set(dirKey, {
          key: dirKey,
          name: dirName.replace(/\/$/, ""),
          size: 0,
          lastModified: f.LastModified,
          isDir: true
        });
      }
    } else {
      fileMap.set(key, {
        key,
        name: rel.replace(/\/$/, ""),
        size: Number(f.Size) || 0,
        lastModified: f.LastModified,
        isDir: false,
        fileId: `cloud://${creds.envId}/${key}`
      });
    }
  }
  return Array.from(fileMap.values());
}
async function listHostingFiles(creds, prefix = "", cdnDomain = "") {
  const manager = createManager(creds);
  const result = await manager.hosting.listFiles();
  const fileMap = /* @__PURE__ */ new Map();
  for (const f of result || []) {
    const key = f.Key || "";
    if (!key) continue;
    if (prefix && !key.startsWith(prefix)) continue;
    const rel = prefix ? key.slice(prefix.length) : key;
    if (!rel) continue;
    const slashIdx = rel.indexOf("/");
    if (slashIdx !== -1 && slashIdx < rel.length - 1) {
      const dirName = rel.slice(0, slashIdx + 1);
      const dirKey = prefix + dirName;
      if (!fileMap.has(dirKey)) {
        fileMap.set(dirKey, {
          key: dirKey,
          name: dirName.replace(/\/$/, ""),
          size: 0,
          lastModified: f.LastModified || "",
          isDir: true
        });
      }
    } else {
      const publicUrl = cdnDomain ? `https://${cdnDomain}/${key}` : "";
      fileMap.set(key, {
        key,
        name: rel.replace(/\/$/, ""),
        size: Number(f.Size) || 0,
        lastModified: f.LastModified || "",
        isDir: false,
        publicUrl
      });
    }
  }
  return Array.from(fileMap.values());
}
async function getDownloadUrl(creds, cloudPath) {
  const manager = createManager(creds);
  const result = await manager.storage.getTemporaryUrl([{ cloudPath, maxAge: 3600 }]);
  return result?.[0]?.url || "";
}
async function deleteFile(creds, cloudPath) {
  const manager = createManager(creds);
  await manager.storage.deleteFile([cloudPath]);
}
async function deleteHostingFile(creds, cloudPath) {
  const manager = createManager(creds);
  await manager.hosting.deleteFiles({ cloudPath, isDir: false });
}

// src/routes/storage.ts
var router2 = new Hono12();
function getCreds2(c) {
  const { envId, credentials } = c.get("userEnv");
  return {
    envId,
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken
  };
}
router2.get("/buckets", requireUserEnv, async (c) => {
  try {
    return c.json(await getBuckets(getCreds2(c)));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router2.get("/files", requireUserEnv, async (c) => {
  try {
    const prefix = c.req.query("prefix") || "";
    const bucketType = c.req.query("bucketType") || "storage";
    const cdnDomain = c.req.query("cdnDomain") || "";
    const creds = getCreds2(c);
    const files = bucketType === "static" ? await listHostingFiles(creds, prefix, cdnDomain) : await listStorageFiles(creds, prefix);
    return c.json(files);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router2.get("/url", requireUserEnv, async (c) => {
  try {
    const path5 = c.req.query("path") || "";
    if (!path5) return c.json({ error: "\u7F3A\u5C11 path \u53C2\u6570" }, 400);
    return c.json({ url: await getDownloadUrl(getCreds2(c), path5) });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router2.delete("/files", requireUserEnv, async (c) => {
  try {
    const { path: path5, bucketType } = await c.req.json();
    if (!path5) return c.json({ error: "\u7F3A\u5C11 path \u53C2\u6570" }, 400);
    const creds = getCreds2(c);
    if (bucketType === "static") {
      await deleteHostingFile(creds, path5);
    } else {
      await deleteFile(creds, path5);
    }
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
var storage_default = router2;

// src/routes/functions.ts
import { Hono as Hono13 } from "hono";
var router3 = new Hono13();
function getCreds3(c) {
  const { envId, credentials } = c.get("userEnv");
  return {
    envId,
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken
  };
}
router3.get("/", requireUserEnv, async (c) => {
  try {
    const manager = createManager(getCreds3(c));
    const result = await manager.functions.getFunctionList(100, 0);
    const functions = (result.Functions || []).map((f) => ({
      name: f.FunctionName,
      runtime: f.Runtime,
      status: f.Status,
      codeSize: f.CodeSize,
      description: f.Description,
      addTime: f.AddTime,
      modTime: f.ModTime,
      memSize: f.MemorySize,
      timeout: f.Timeout,
      type: f.Type
    }));
    return c.json(functions);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
router3.post("/:name/invoke", requireUserEnv, async (c) => {
  try {
    const manager = createManager(getCreds3(c));
    const name = c.req.param("name");
    const body = await c.req.json();
    const result = await manager.functions.invokeFunction(name, body);
    return c.json({ result: result.RetMsg });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
var functions_default = router3;

// src/routes/sql.ts
import { Hono as Hono14 } from "hono";
var router4 = new Hono14();
router4.post("/query", async (c) => {
  return c.json({ error: "\u8BF7\u5148\u914D\u7F6E SQL \u6570\u636E\u5E93\u8FDE\u63A5\uFF08MySQL/PostgreSQL\uFF09" }, 501);
});
var sql_default = router4;

// src/routes/capi.ts
import { Hono as Hono15 } from "hono";
import CloudBase5 from "@cloudbase/manager-node";
var router5 = new Hono15();
router5.post("/", requireUserEnv, async (c) => {
  const { envId, credentials } = c.get("userEnv");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u65E0\u6548\u7684\u8BF7\u6C42\u4F53" }, 400);
  }
  const { service, action, params = {} } = body;
  if (!service || !action) {
    return c.json({ error: "\u7F3A\u5C11 service / action \u53C2\u6570" }, 400);
  }
  try {
    const app8 = new CloudBase5({
      secretId: credentials.secretId,
      secretKey: credentials.secretKey,
      token: credentials.sessionToken || "",
      envId
    });
    const result = await app8.commonService(service).call({
      Action: action,
      Param: params
    });
    return c.json({ result });
  } catch (e) {
    return c.json({ error: e.message, code: e.code }, 500);
  }
});
var capi_default = router5;

// src/routes/admin.ts
import { Hono as Hono16 } from "hono";

// src/middleware/admin.ts
import { deleteCookie as deleteCookie3 } from "hono/cookie";
async function requireAdmin(c, next) {
  const authErr = requireAuth(c);
  if (authErr) return authErr;
  const session = c.get("session");
  const db = getDb();
  const user = await db.users.findById(session.user.id);
  if (!user || user.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  if (user.status === "disabled") {
    return c.json({ error: "Account is disabled" }, 403);
  }
  c.set("adminUser", user);
  await next();
}

// src/routes/admin.ts
import { nanoid as nanoid10 } from "nanoid";
import bcrypt2 from "bcryptjs";
import CloudBase6 from "@cloudbase/manager-node";
var admin = new Hono16();
admin.use("/*", requireAdmin);
var proxyCredentialCache = /* @__PURE__ */ new Map();
async function getProxyCreds(envId) {
  const cached = proxyCredentialCache.get(envId);
  if (cached && cached.expireTime > Date.now() / 1e3 + 300) {
    return cached.credentials;
  }
  const tempCreds = await issueTempCredentials(envId, `admin-proxy-${envId.slice(0, 8)}`);
  if (!tempCreds) throw new Error("Failed to issue proxy credentials");
  const creds = {
    envId,
    secretId: tempCreds.secretId,
    secretKey: tempCreds.secretKey,
    sessionToken: tempCreds.sessionToken
  };
  proxyCredentialCache.set(envId, { credentials: creds, expireTime: Date.now() / 1e3 + 6900 });
  return creds;
}
admin.get("/users", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;
  const db = getDb();
  const users2 = await db.users.findAll(limit, offset);
  const total = await db.users.count();
  const resourceMap = /* @__PURE__ */ new Map();
  await Promise.all(
    users2.map(async (u) => {
      const resource = await db.userResources.findByUserId(u.id);
      if (resource) {
        resourceMap.set(u.id, {
          envId: resource.envId,
          status: resource.status,
          camSecretId: resource.camSecretId,
          camSecretKey: resource.camSecretKey
        });
      }
    })
  );
  return c.json({
    users: users2.map((u) => {
      const res = resourceMap.get(u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        provider: u.provider,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        disabledReason: u.disabledReason,
        disabledAt: u.disabledAt,
        envId: res?.envId || null,
        envStatus: res?.status || null,
        credentialType: res?.camSecretId && res?.camSecretKey ? "permanent" : res?.envId ? "temp" : null
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
admin.get("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const db = getDb();
  const user = await db.users.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  const resource = await db.userResources.findByUserId(userId);
  const tasks2 = await db.tasks.findByUserId(userId);
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    },
    resource: resource ? {
      status: resource.status,
      envId: resource.envId,
      camUsername: resource.camUsername,
      failReason: resource.failReason,
      credentialType: resource.camSecretId && resource.camSecretKey ? "permanent" : "temp"
    } : null,
    taskStats: {
      total: tasks2.length,
      completed: tasks2.filter((t) => t.status === "completed").length,
      failed: tasks2.filter((t) => t.status === "error").length,
      pending: tasks2.filter((t) => t.status === "pending").length
    }
  });
});
admin.post("/users/:userId/disable", async (c) => {
  const userId = c.req.param("userId");
  const adminUser = c.get("adminUser");
  const { reason } = await c.req.json();
  const db = getDb();
  if (userId === adminUser.id) {
    return c.json({ error: "Cannot disable yourself" }, 400);
  }
  const user = await db.users.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  if (user.role === "admin") {
    return c.json({ error: "Cannot disable admin users" }, 403);
  }
  await db.users.disable(userId, reason || "No reason provided", adminUser.id);
  await db.adminLogs.create({
    id: nanoid10(),
    adminUserId: adminUser.id,
    action: "user_disable",
    targetUserId: userId,
    details: JSON.stringify({ reason }),
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent")
  });
  return c.json({ success: true });
});
admin.post("/users/:userId/enable", async (c) => {
  const userId = c.req.param("userId");
  const adminUser = c.get("adminUser");
  const db = getDb();
  const user = await db.users.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  await db.users.enable(userId);
  await db.adminLogs.create({
    id: nanoid10(),
    adminUserId: adminUser.id,
    action: "user_enable",
    targetUserId: userId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent")
  });
  return c.json({ success: true });
});
admin.post("/users/:userId/set-role", async (c) => {
  const userId = c.req.param("userId");
  const adminUser = c.get("adminUser");
  const { role } = await c.req.json();
  if (!["user", "admin"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }
  const db = getDb();
  if (userId === adminUser.id) {
    return c.json({ error: "Cannot change your own role" }, 400);
  }
  const user = await db.users.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  const oldRole = user.role;
  await db.users.updateRole(userId, role);
  await db.adminLogs.create({
    id: nanoid10(),
    adminUserId: adminUser.id,
    action: "user_role_change",
    targetUserId: userId,
    details: JSON.stringify({ oldRole, newRole: role }),
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent")
  });
  return c.json({ success: true });
});
admin.post("/users/:userId/reset-password", async (c) => {
  const userId = c.req.param("userId");
  const adminUser = c.get("adminUser");
  const { newPassword } = await c.req.json();
  if (!newPassword || newPassword.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }
  const db = getDb();
  const user = await db.users.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  if (user.provider !== "local") {
    return c.json({ error: "Can only reset password for local users" }, 400);
  }
  const passwordHash = await bcrypt2.hash(newPassword, 12);
  await db.localCredentials.update(userId, { passwordHash, updatedAt: Date.now() });
  await db.adminLogs.create({
    id: nanoid10(),
    adminUserId: adminUser.id,
    action: "password_reset",
    targetUserId: userId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent")
  });
  return c.json({ success: true });
});
admin.post("/users/create", async (c) => {
  const adminUser = c.get("adminUser");
  const { username, password, email, role = "user" } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: "Username and password are required" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }
  if (!["user", "admin"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }
  const db = getDb();
  const existingUser = await db.users.findByProviderAndExternalId("local", username);
  if (existingUser) {
    return c.json({ error: "User already exists" }, 400);
  }
  const userId = nanoid10();
  const now4 = Date.now();
  await db.users.create({
    id: userId,
    provider: "local",
    externalId: username,
    accessToken: "",
    username,
    email: email || null,
    name: username,
    role,
    status: "active",
    createdAt: now4,
    updatedAt: now4,
    lastLoginAt: now4
  });
  const passwordHash = await bcrypt2.hash(password, 12);
  await db.localCredentials.create({
    userId,
    passwordHash,
    createdAt: now4,
    updatedAt: now4
  });
  const provisionMode = process.env.TCB_PROVISION_MODE || "shared";
  if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
    const resourceId = nanoid10();
    if (provisionMode === "isolated") {
      await db.userResources.create({
        id: resourceId,
        userId,
        status: "processing",
        envId: null,
        camUsername: null,
        camSecretId: null,
        camSecretKey: null,
        policyId: null,
        failStep: null,
        failReason: null,
        createdAt: now4,
        updatedAt: now4
      });
      provisionUserResources(userId, username).then(async (result) => {
        await getDb().userResources.update(resourceId, {
          status: "success",
          envId: result.envId,
          camUsername: result.camUsername,
          camSecretId: result.camSecretId,
          camSecretKey: result.camSecretKey || null,
          policyId: result.policyId,
          updatedAt: Date.now()
        });
        console.log(`[admin-provision] User ${username} env ready: ${result.envId}`);
      }).catch(async (err) => {
        await getDb().userResources.update(resourceId, {
          status: "failed",
          failReason: err.message,
          updatedAt: Date.now()
        });
        console.error(`[admin-provision] User ${username} failed:`, err.message);
      });
    } else {
      await db.userResources.create({
        id: resourceId,
        userId,
        status: "success",
        envId: process.env.TCB_ENV_ID || null,
        camUsername: null,
        camSecretId: process.env.TCB_SECRET_ID || null,
        camSecretKey: process.env.TCB_SECRET_KEY || null,
        policyId: null,
        failStep: null,
        failReason: null,
        createdAt: now4,
        updatedAt: now4
      });
      console.log(`[admin-provision] User ${username} shared env: ${process.env.TCB_ENV_ID}`);
    }
  }
  await db.adminLogs.create({
    id: nanoid10(),
    adminUserId: adminUser.id,
    action: "user_create",
    targetUserId: userId,
    details: JSON.stringify({ username, email, role }),
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent")
  });
  return c.json({
    success: true,
    user: {
      id: userId,
      username,
      email: email || null,
      role,
      status: "active",
      provider: "local",
      createdAt: now4
    }
  });
});
admin.get("/environments", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const db = getDb();
  return c.json({
    resources: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0
    }
  });
});
admin.get("/tasks", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const userId = c.req.query("userId");
  const status = c.req.query("status");
  const db = getDb();
  const filters = {};
  if (userId) filters.userId = userId;
  if (status) filters.status = status;
  const offset = (page - 1) * limit;
  const tasks2 = await db.tasks.findAll(limit, offset, filters);
  const total = await db.tasks.count(filters);
  const userIds = [...new Set(tasks2.map((t) => t.userId))];
  const userMap = /* @__PURE__ */ new Map();
  await Promise.all(
    userIds.map(async (id) => {
      const user = await db.users.findById(id);
      if (user) userMap.set(id, user.username);
    })
  );
  return c.json({
    tasks: tasks2.map((t) => ({
      id: t.id,
      userId: t.userId,
      username: userMap.get(t.userId) || t.userId,
      title: t.title,
      prompt: t.prompt,
      status: t.status,
      selectedAgent: t.selectedAgent,
      repoUrl: t.repoUrl,
      branchName: t.branchName,
      sandboxUrl: t.sandboxUrl,
      previewUrl: t.previewUrl,
      error: t.error,
      createdAt: t.createdAt,
      completedAt: t.completedAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
admin.get("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const db = getDb();
  const task = await db.tasks.findById(taskId);
  if (!task || task.deletedAt) {
    return c.json({ error: "Task not found" }, 404);
  }
  const user = await db.users.findById(task.userId);
  return c.json({
    task: {
      id: task.id,
      userId: task.userId,
      username: user?.username || task.userId,
      title: task.title,
      prompt: task.prompt,
      status: task.status,
      progress: task.progress,
      selectedAgent: task.selectedAgent,
      selectedModel: task.selectedModel,
      installDependencies: task.installDependencies,
      maxDuration: task.maxDuration,
      keepAlive: task.keepAlive,
      enableBrowser: task.enableBrowser,
      repoUrl: task.repoUrl,
      branchName: task.branchName,
      sandboxId: task.sandboxId,
      agentSessionId: task.agentSessionId,
      sandboxUrl: task.sandboxUrl,
      previewUrl: task.previewUrl,
      prUrl: task.prUrl,
      prNumber: task.prNumber,
      prStatus: task.prStatus,
      prMergeCommitSha: task.prMergeCommitSha,
      mcpServerIds: task.mcpServerIds,
      error: task.error,
      logs: task.logs,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      deletedAt: task.deletedAt
    }
  });
});
admin.get("/tasks/:taskId/messages", async (c) => {
  const taskId = c.req.param("taskId");
  const db = getDb();
  const task = await db.tasks.findById(taskId);
  if (!task || task.deletedAt) {
    return c.json({ error: "Task not found" }, 404);
  }
  const userResources2 = await db.userResources.findByUserId(task.userId);
  if (!userResources2?.envId) {
    return c.json({ messages: [] });
  }
  try {
    const cloudbaseRecords = await persistenceService.loadDBMessages(taskId, userResources2.envId, task.userId, 200);
    const messages = cloudbaseRecords.map((record) => {
      const parts = (record.parts || []).map((p) => {
        if (p.contentType === "text") return { type: "text", text: p.content || "" };
        else if (p.contentType === "reasoning") return { type: "thinking", text: p.content || "" };
        else if (p.contentType === "tool_call")
          return {
            type: "tool_call",
            toolCallId: p.toolCallId || p.partId,
            toolName: p.metadata?.toolCallName || p.metadata?.toolName || "tool",
            input: p.content || p.metadata?.input,
            status: p.metadata?.status || void 0
          };
        else if (p.contentType === "tool_result")
          return {
            type: "tool_result",
            toolCallId: p.toolCallId || p.partId,
            toolName: p.metadata?.toolName || void 0,
            content: p.content || "",
            isError: p.metadata?.isError,
            status: p.metadata?.status || void 0
          };
        return { type: "text", text: p.content || "" };
      });
      const textContent = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
      return {
        id: record.recordId,
        taskId,
        role: record.role === "user" ? "user" : "agent",
        content: textContent,
        parts,
        status: record.status,
        createdAt: record.createTime || Date.now()
      };
    });
    return c.json({ messages });
  } catch {
    return c.json({ messages: [] });
  }
});
admin.get("/logs", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const db = getDb();
  const logs = await db.adminLogs.findAll(limit, (page - 1) * limit);
  return c.json({ logs });
});
admin.get("/proxy/:envId/database/collections", async (c) => {
  try {
    const creds = await getProxyCreds(c.req.param("envId"));
    const result = await listCollections(creds);
    return c.json(result.collections);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.post("/proxy/:envId/database/collections", async (c) => {
  try {
    const { name } = await c.req.json();
    await createCollection(await getProxyCreds(c.req.param("envId")), name);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.delete("/proxy/:envId/database/collections/:name", async (c) => {
  try {
    await deleteCollection(await getProxyCreds(c.req.param("envId")), c.req.param("name"));
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.get("/proxy/:envId/database/collections/:name/documents", async (c) => {
  try {
    const name = c.req.param("name");
    const page = Number(c.req.query("page") || "1");
    const pageSize = Number(c.req.query("pageSize") || "50");
    const search = c.req.query("search")?.trim();
    let where;
    if (search) {
      if (search.includes(":")) {
        const [field, ...rest] = search.split(":");
        const val = rest.join(":");
        where = { [field.trim()]: val.trim() };
      } else {
        where = { _id: search };
      }
    }
    const result = await queryDocuments(await getProxyCreds(c.req.param("envId")), name, page, pageSize, where);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.post("/proxy/:envId/database/collections/:name/documents", async (c) => {
  try {
    const data = await c.req.json();
    const id = await insertDocument(await getProxyCreds(c.req.param("envId")), c.req.param("name"), data);
    return c.json({ _id: id });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.put("/proxy/:envId/database/collections/:name/documents/:id", async (c) => {
  try {
    const data = await c.req.json();
    await updateDocument(await getProxyCreds(c.req.param("envId")), c.req.param("name"), c.req.param("id"), data);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.delete("/proxy/:envId/database/collections/:name/documents/:id", async (c) => {
  try {
    await deleteDocument(await getProxyCreds(c.req.param("envId")), c.req.param("name"), c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.get("/proxy/:envId/storage/buckets", async (c) => {
  try {
    return c.json(await getBuckets(await getProxyCreds(c.req.param("envId"))));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.get("/proxy/:envId/storage/files", async (c) => {
  try {
    const prefix = c.req.query("prefix") || "";
    const bucketType = c.req.query("bucketType") || "storage";
    const cdnDomain = c.req.query("cdnDomain") || "";
    const creds = await getProxyCreds(c.req.param("envId"));
    const files = bucketType === "static" ? await listHostingFiles(creds, prefix, cdnDomain) : await listStorageFiles(creds, prefix);
    return c.json(files);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.get("/proxy/:envId/storage/url", async (c) => {
  try {
    const path5 = c.req.query("path") || "";
    if (!path5) return c.json({ error: "\u7F3A\u5C11 path \u53C2\u6570" }, 400);
    return c.json({ url: await getDownloadUrl(await getProxyCreds(c.req.param("envId")), path5) });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.delete("/proxy/:envId/storage/files", async (c) => {
  try {
    const { path: path5, bucketType } = await c.req.json();
    if (!path5) return c.json({ error: "\u7F3A\u5C11 path \u53C2\u6570" }, 400);
    const creds = await getProxyCreds(c.req.param("envId"));
    if (bucketType === "static") {
      await deleteHostingFile(creds, path5);
    } else {
      await deleteFile(creds, path5);
    }
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.post("/proxy/:envId/capi", async (c) => {
  const envId = c.req.param("envId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u65E0\u6548\u7684\u8BF7\u6C42\u4F53" }, 400);
  }
  const { service, action, params = {} } = body;
  if (!service || !action) {
    return c.json({ error: "\u7F3A\u5C11 service / action \u53C2\u6570" }, 400);
  }
  try {
    const creds = await getProxyCreds(envId);
    const app8 = new CloudBase6({
      secretId: creds.secretId,
      secretKey: creds.secretKey,
      token: creds.sessionToken || "",
      envId
    });
    const result = await app8.commonService(service).call({
      Action: action,
      Param: params
    });
    return c.json({ result });
  } catch (e) {
    return c.json({ error: e.message, code: e.code }, 500);
  }
});
admin.get("/proxy/:envId/functions", async (c) => {
  try {
    const manager = createManager(await getProxyCreds(c.req.param("envId")));
    const result = await manager.functions.getFunctionList(100, 0);
    const functions = (result.Functions || []).map((f) => ({
      name: f.FunctionName,
      runtime: f.Runtime,
      status: f.Status,
      codeSize: f.CodeSize,
      description: f.Description,
      addTime: f.AddTime,
      modTime: f.ModTime,
      memSize: f.MemorySize,
      timeout: f.Timeout,
      type: f.Type
    }));
    return c.json(functions);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
admin.post("/proxy/:envId/functions/:name/invoke", async (c) => {
  try {
    const manager = createManager(await getProxyCreds(c.req.param("envId")));
    const name = c.req.param("name");
    const body = await c.req.json();
    const result = await manager.functions.invokeFunction(name, body);
    return c.json({ result: result.RetMsg });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
var admin_default = admin;

// src/index.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname = dirname2(__filename);
process.on("unhandledRejection", (err) => {
  console.error("[Server] Unhandled rejection:", err);
});
var app7 = new Hono17();
app7.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true
  })
);
app7.use("*", authMiddleware);
app7.get("/health", (c) => c.json({ status: "ok" }));
app7.route("/api/auth", auth_default);
app7.route("/api/auth/github", github_auth_default);
app7.route("/api/github", github_default);
app7.route("/api/agent", acp_default);
app7.route("/api/tasks", tasks_default);
app7.route("/api/connectors", connectors_default);
app7.route("/api/miniprogram", miniprogram_default);
app7.route("/api/api-keys", api_keys_default);
app7.route("/api", misc_default);
app7.route("/api/repos", repos_default);
app7.route("/api/database", database_default);
app7.route("/api/storage", storage_default);
app7.route("/api/functions", functions_default);
app7.route("/api/sql", sql_default);
app7.route("/api/capi", capi_default);
app7.route("/api/admin", admin_default);
var webDistPath = resolve(__dirname, "../web/dist");
var serveStaticFiles = existsSync2(webDistPath);
if (serveStaticFiles) {
  console.log(`[Server] Serving static files from: ${webDistPath}`);
  app7.use("/assets/*", serveStatic({ root: webDistPath }));
  app7.use("/*", serveStatic({ root: webDistPath }));
  app7.get("*", async (c, next) => {
    const path5 = c.req.path;
    if (path5.startsWith("/api")) {
      return next();
    }
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
</html>`
    );
  });
} else {
  console.log("[Server] Running in API-only mode (no static files)");
  console.log("[Server] For full-stack mode, build the web package first: pnpm build:web");
}
var PORT = Number(process.env.PORT) || 3001;
serve({ fetch: app7.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (serveStaticFiles) {
    console.log(`Open http://localhost:${PORT} in your browser`);
  } else {
    console.log(`API endpoint: http://localhost:${PORT}/api`);
    console.log(`For development, run: pnpm dev:web`);
  }
});
var index_default = app7;
export {
  index_default as default
};
