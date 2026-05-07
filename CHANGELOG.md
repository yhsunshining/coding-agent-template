# Changelog

本文件记录 `coding-agent-template` 面向用户/开发者的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [SemVer](https://semver.org/)。

## [Unreleased]

### Added
- **预览沙箱 & Browser 工具栏**: 新建 coding 模式任务后自动冷启动沙箱；右侧预览面板支持浏览器地址栏、刷新/返回/前进、设备尺寸切换；首次加载有骨架屏。
- **Agent Mode 任务切换**: 任务表单支持选择 `default` / `coding` 模式（单一 `Coding / Default` 药丸按钮）。
- **CAM 环境策略脚本**: 新增 `packages/server/src/scripts/refresh-policy.ts`，通过 CAM `UpdatePolicy` 把本地 policy 定义刷新到已部署 policyId，免重新 provision（约 1 分钟生效）。
- **TaskListPanel**: 聊天输入框上方新增可折叠任务进度面板，从 TaskCreate/TaskUpdate 工具调用提取任务列表（状态图标 + subject/activeForm + 进度计数）；TaskCreate/TaskUpdate/TaskList/TaskGet 工具卡片从消息流中隐藏，改为面板展示。
- **预览新窗口打开**: 编码模式预览工具栏新增 ExternalLink 按钮，点击在新窗口打开预览 URL，方便分享。
- **Coding mode dev server 改进**: 使用 PTY 启动 dev server；自动 patch vite.config.ts 适配 CloudBase 沙箱预览（`--base=/preview/`, `host 0.0.0.0`, `allowedHosts`）；跳过已有 package.json 但缺 node_modules 的重复 clone。
- **CAM NoSQL 数据库权限**: `buildUserEnvPolicyStatements` 新增 `tcb:QueryRecords / PutItem / UpdateItem / DeleteItem / CreateTable`（resource `*`）。

### Fixed
- **死循环: confirm-resume 工具调用**（核心）: 用户点击"允许"后 SDK 重复生成新 `callId` 再次触发 canUseTool → deny 的无限循环。综合 3 处修复：
  1. `restoreAssistantRecord` 按 `record.parts` 原序遍历，不再强制把 text part 放最后。
  2. `updateToolResult` 新增 `extraMetadata` 参数，自动剥离 SDK deny 标记（`providerData.skipRun / error`）并合并调用方补齐的字段。
  3. 方案 2 真实 MCP 执行后回填 baseline 等价 metadata（`providerData.{messageId, model, agent, toolResult{content, renderer}}` + 顶层 `sessionId`）。
  离线仿真 JSONL 与 baseline canonical identical；真机验证 SDK resume 不再重发，进入下一步调用。
- **AskUserQuestion resume 同步修复**: `askAnswers` 分支的 `updateToolResult` 补全与 toolConfirmation 相同的 providerData/sessionId。
- **乐观 UI: 允许/拒绝工具后本地即时反馈**: `handleConfirmTool` 在网络 resume 前插入本地 `tool_result`（deny→终态红叉；allow→`status:'executing'` 过渡态保持 Loader2），`apply-session-update` 只对 `'executing'` 占位做替换保证最终一致性。
- **AgentStatusIndicator 仅在最新 group 渲染**: 补 `isLatestGroup` 约束，避免下一轮对话时"模型响应中..."挂在历史 assistant 消息末尾。
- **刷新后恢复 InterruptionCard**: 从 DB `tool_result.metadata.status === 'incomplete'` 重建 `toolConfirm`，支持 `input` 为 JSON 字符串或对象两种容错。
- **confirmTool 后 UI 无反应**: resume 时把本地 `stream-xxx` 消息 id remap 到服务端 `assistantMessageId`，避免后续 SSE 找不到目标 message 而丢帧。
- **切换 task 交互态残留**: `use-chat-stream` 用 `prevTaskIdRef` 跳过 initial mount 的 reset，防止踩踏 `sendInitialPrompt` 已进入的 `streaming` 状态。
- **Phase 指示器 & 工具确认卡就地渲染**: `AgentStatusIndicator` 和 `InterruptionCard` 不再固定在输入框上方，改挂到对应 agentMessage 末尾并随滚动。
- **CAM policy 修复**: `buildUserEnvPolicyStatements` 删除非法 `flexdb:*`，新增 `tcb:CreateFunction / UpdateFunctionCode / GetFunction / InvokeFunction / ListFunctions`（resource `*`），`tcb:CreateFunction` 权限不再缺失。
- **UI 识别错误清理**: 删除 `task-form.tsx` 中重复的 `isCodingMode / mode` 定义与对象字面量重复 key；`Code` 图标引用改为已导入的 `Code2`；删除 `task-chat.tsx` 中重复的 `isCodingMode`。
- **Stream event cleanup 竞态**: 先 flush eventBuffer 再 cleanup stream events；cleanup 延迟到 `completeAgent()` 之后 600ms，让 poll loop 先排空剩余事件。
- **TCR docker login 子账号**: `setup-tcr.mjs` 通过 `STS.GetCallerIdentity` 获取 `callerUin`，子账号 docker login 用 `callerUin` 而非主账号 AppID。

### Changed
- `toolConfirmation` 真实执行从 sandbox 启动**之前**推迟到 sandbox + sandboxMcpClient ready **之后**，避免 sandbox 未就绪时写入占位文本误触发 SDK 重试。

---

## [2.0.0] — Chat-Detail 重构（ACP + UI）

本次重大版本面向 `chat-detail` 交互做系统性升级，借鉴官方 CodeBuddy Code 实现。目标：权限模型 / Plan 模式 / 协议层 / Phase 可视化 / 工具渲染 / Subagent 嵌套。

### P1 · 权限模型升级
- **`PermissionAction` 四值**: `allow` / `allow_always` / `deny` / `reject_and_exit_plan`。
- **`InterruptionCard`**: 新卡片 UI 替代旧 `ToolConfirmDialog` 弹窗，消息流内渲染，不打断上下文。
- **`sessionPermissions` 白名单**: 按 sessionId 维护"本会话总是允许"的工具名集合；`canUseTool` 命中白名单直接放行。
- **双入口协同**: `canUseTool` 与 `PreToolUse hook` 都过白名单，保持行为一致。
- 文件: `packages/server/src/agent/session-permissions.ts`（新）、`packages/web/src/components/chat/interruption-card.tsx`（新）、`packages/shared/src/types/agent.ts`、`cloudbase-agent.service.ts`、`use-chat-stream.ts`。

### P2 · PlanMode + ExitPlanMode
- **Plan 模式**: 前端传 `permissionMode: 'plan'`，SDK 切入 Plan；除 Read/Glob/Grep/ExitPlanMode 等只读工具外，写操作会被挡住。
- **`PlanModeCard`**: Rocket 图标 + 三按钮（允许执行 / 继续完善 / 拒绝退出）。
- **`plan-content.ts`**: 宽松提取器，兼容 `plan` / `allowedPrompts` / `steps` 三种 SDK 输出。
- **Plan 状态原子**: `planModeAtomFamily`（active / planContent / toolCallId），跨组件共享。
- 文件: `plan-mode-card.tsx`（新）、`plan-content.ts`（新）、`lib/atoms/plan-mode.ts`（新）、`shared/types/agent.ts`、`acp.ts`、`cloudbase-agent.service.ts`、`routes/acp.ts`、`use-chat-stream.ts`、`interruption-card.tsx`。

### P3 · 协议层独立（AcpClient）
- **`AcpClient` 类**: `initializeSession` / `request` / `notify` / `stream` (AsyncIterable) / `observe` (AsyncIterable) / `cancel`。
- **`fetch-with-retry`**: 5xx 与网络错误指数退避重试。
- **纯函数抽离**: `apply-session-update.ts` 从 223 行 switch 剥离；`use-chat-stream.ts` 由 785 行减到 446 行，SSE 解析全部迁到 `AcpClient.stream`。
- 文件: `lib/acp/acp-client.ts`（新）、`lib/acp/fetch-with-retry.ts`（新）、`lib/acp/index.ts`（新）、`hooks/apply-session-update.ts`（新）、`hooks/use-chat-stream.ts`。

### P4 · Agent Phase 可视化
- **服务端 `emitPhase` helper**: 在 5 处边界发射 `agent_phase` 事件（preparing / model_responding / tool_executing / compacting / idle）。
- **`AgentStatusIndicator`**: 4 种 phase 配 Rocket / Sparkles / Hammer / Archive 图标；`aria-live="polite"` 支持屏幕阅读器。
- **Timestamp 乱序防护**: `apply-session-update` 中 `case 'agent_phase'` 比较 ts，后到但时间更早的事件不覆盖。
- 文件: `agent-status-indicator.tsx`（新）、`cloudbase-agent.service.ts`、`shared/types/agent.ts` + `acp.ts`、`apply-session-update.ts`、`use-chat-stream.ts`、`task-chat.tsx`。

### P6 · 工具渲染注册表
- **`TOOL_RENDERERS` 注册表**: 10 个专属渲染器（Bash / Read / Write / Edit / Grep / Glob / Web / Todo / Task + default），各自提供 Icon、getSummary、renderInput、renderOutput。
- **Edit 渲染器集成 git-diff-view**: 文件编辑显示 before/after unified diff。
- **`default.renderer`**: 剥 MCP 外壳（解开 `[{type:'text',text:...}]` 取纯文本），JSON 参数折叠展开。
- **`ToolCallCard` 接入注册表**: 外部 API 保持不变，调用方（task-chat）零改动。
- **DEV 预览页**: `/__preview/tool-renderers`，可视化检查所有渲染器效果。
- 文件: `components/chat/tool-renderers/*`（新 11 个）、`tool-call-card.tsx`、`pages/tool-renderers-preview.tsx`（新 DEV-only）。

### P7 · Subagent 嵌套 UI
- **`SubagentCard`**: 紫色边框容器（`border-purple-500/40`）+ Bot 图标 + 子工具数量徽章，递归渲染支持多层嵌套。
- **`parent_tool_use_id` 透传**: SDK 顶层 → 5 个服务端 handler → `convertToSessionUpdate` 3 个 case → 前端 `MessagePart.parentToolCallId`。
- **自引用防御**: Task tool result.parent 指向自身时不再陷入无限嵌套。
- 文件: `subagent-card.tsx`（新）、`shared/types/agent.ts`、`cloudbase-agent.service.ts`、`types/task-chat.ts`、`apply-session-update.ts`。

### 其它
- **手动回归测试清单**: `docs/manual-test-checklist.md`（新），覆盖 P1-P7 所有典型交互路径。
- **P5 Checkpoint 回滚**: ⏳ 待开始（依赖服务端 git 集成）。

---

## 里程碑

| 里程碑 | 组成 | 状态 |
|---|---|---|
| **M1** | P1 + P2 + P4 | ✅ 完成 |
| **M2** | P6 + P7 | ✅ 完成 |
| **M3** | P5 | ⏳ 待开始 |

详细实施计划与文件清单见 [`docs/REFACTOR-PLAN.md`](./docs/REFACTOR-PLAN.md)。
