# 用户权限管理系统使用指南

## 创建管理员账户

使用以下命令创建管理员账户：

```bash
cd packages/server
tsx src/scripts/create-admin.ts <用户名> <密码>
```

示例：
```bash
tsx src/scripts/create-admin.ts admin mypassword123
```

## 管理员功能

### 1. 访问管理后台
- 使用管理员账户登录
- 点击右上角用户头像
- 选择"管理后台"菜单项

### 2. 用户管理

#### 查看用户列表
- 支持分页显示
- 显示用户名、邮箱、角色、状态等信息

#### 创建新用户
- 点击"创建用户"按钮
- 填写用户名、密码、邮箱（可选）
- 选择角色（普通用户/管理员）
- 提交创建

#### 禁用/启用用户
- 点击用户操作栏的"禁用"按钮
- 填写禁用原因
- 已禁用的用户可以点击"启用"重新激活

#### 设置管理员
- 对于普通用户，点击"设为管理员"
- 确认后用户将获得管理员权限

### 3. 环境管理
- 查看所有用户的 CloudBase 环境状态
- 需要后端扩展支持

### 4. 任务管理
- 查看所有用户的任务
- 支持按用户和状态过滤
- 需要后端扩展支持

### 5. 操作日志
- 记录所有管理操作
- 包括用户创建、禁用、启用、角色变更等
- 显示操作时间、操作人、目标用户等信息

## 安全注意事项

1. **管理员权限**：只有管理员才能访问管理后台
2. **操作审计**：所有管理操作都会记录到日志中
3. **权限限制**：
   - 管理员不能禁用自己
   - 管理员不能禁用其他管理员
   - 管理员不能修改自己的角色
4. **会话管理**：被禁用的用户下次请求时会被自动登出

## API 端点

### 用户管理
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users/create` - 创建新用户
- `GET /api/admin/users/:userId` - 获取用户详情
- `POST /api/admin/users/:userId/disable` - 禁用用户
- `POST /api/admin/users/:userId/enable` - 启用用户
- `POST /api/admin/users/:userId/set-role` - 设置角色
- `POST /api/admin/users/:userId/reset-password` - 重置密码

### 其他管理功能
- `GET /api/admin/environments` - 获取环境列表
- `GET /api/admin/tasks` - 获取任务列表
- `GET /api/admin/logs` - 获取操作日志

## 数据库字段说明

### users 表新增字段
- `role`: 用户角色 ('user' | 'admin')
- `status`: 账户状态 ('active' | 'disabled')
- `disabledReason`: 禁用原因
- `disabledAt`: 禁用时间
- `disabledBy`: 禁用操作人ID

### admin_logs 表
- `id`: 日志ID
- `adminUserId`: 操作人ID
- `action`: 操作类型
- `targetUserId`: 目标用户ID
- `details`: 操作详情(JSON)
- `ipAddress`: IP地址
- `userAgent`: 用户代理
- `createdAt`: 创建时间
