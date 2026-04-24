# Chat-Detail 重构计划：借鉴官方 CodeBuddy Code 实现

> 目标：以反编译版本（`CodeBuddy Code_decompiled/`）为参考，系统地增强当前 `coding-agent-template` 的聊天交互能力
>
> 范围：**request_permission、AskUserQuestion、PlanMode/ExitPlanMode、Checkpoint、流式通信、UI 交互**

---

## 📊 实施进度（2026/04/24 最新）

| Phase | 状态 | 关键交付 |
|-------|------|---------|
| **P1 权限模型升级** | ✅ 已完成 | `PermissionAction` 四值决策 / `InterruptionCard` / `sessionPermissions` 白名单 |
| **P2 PlanMode + ExitPlanMode** | ✅ 已完成 | `permissionMode: 'plan'` / `PlanModeCard` / `planModeAtomFamily` / `extractPlanContent` |
| **P3 协议层独立 (AcpClient)** | ✅ 已完成 | `AcpClient` (AsyncIterable + 重试) / `apply-session-update.ts` 纯函数抽离 |
| **P4 Agent Phase 可视化** | ✅ 已完成 | 服务端 `emitPhase` + `AgentStatusIndicator` 前端组件 + 5 种 phase 状态机 |
| **P5 Checkpoint 回滚** | ⏳ 待开始 | 最晚做(需要服务端 git 集成) |
| **P6 工具渲染注册表** | ✅ 已完成 | `TOOL_RENDERERS` + 10 个专属渲染器 + Edit 集成 git-diff-view |
| **P7 Subagent 嵌套 UI** | ✅ 已完成 | `parent_tool_use_id` 透传 + `SubagentCard` 紫色嵌套容器 |

> 里程碑进度:**M1 (P1+P2+P4)** ✅ 完成 3/3 · **M2 (P6+P7)** ✅ 完成 2/2 · 仅剩 **P5 Checkpoint**

### 已完成 Phase 的实际文件清单

**P1 权限模型升级**
- 新增: `packages/server/src/agent/session-permissions.ts`
- 新增: `packages/web/src/components/chat/interruption-card.tsx`
- 修改: `packages/shared/src/types/agent.ts` — `PermissionAction` 四值
- 修改: `packages/server/src/agent/cloudbase-agent.service.ts` — canUseTool + PreToolUse 双入口白名单
- 修改: `packages/web/src/hooks/use-chat-stream.ts` — `confirmTool` 接受四值
- 删除: `packages/web/src/components/chat/tool-confirm-dialog.tsx`(弹窗已被 InterruptionCard 替代)

**P2 PlanMode + ExitPlanMode**
- 新增: `packages/web/src/lib/atoms/plan-mode.ts` — `planModeAtomFamily`(active/planContent/toolCallId)
- 新增: `packages/web/src/components/chat/plan-mode-card.tsx` — Rocket 图标 + 三按钮
- 新增: `packages/web/src/components/chat/plan-content.ts` — 宽松提取器(支持 plan / allowedPrompts / steps)
- 修改: `packages/shared/src/types/agent.ts` — `AgentPermissionMode = 'default' | 'plan'`
- 修改: `packages/shared/src/types/acp.ts` — `ToolConfirmUpdate.planContent`
- 修改: `packages/server/src/agent/cloudbase-agent.service.ts` — ExitPlanMode canUseTool 分支 + `sdkPermissionMode` 映射
- 修改: `packages/server/src/routes/acp.ts` — session/prompt 透传 `permissionMode`
- 修改: `packages/web/src/hooks/use-chat-stream.ts` — plan-mode atom 接入 + 下一轮 permissionMode
- 修改: `packages/web/src/components/chat/interruption-card.tsx` — ExitPlanMode 委托 PlanModeCard

**P6 工具渲染注册表**
- 新增: `packages/web/src/components/chat/tool-renderers/index.ts` — 注册表 + `getToolRenderer`
- 新增: `packages/web/src/components/chat/tool-renderers/default.tsx` — fallback + `extractResultText`(剥 MCP 外壳)
- 新增: `packages/web/src/components/chat/tool-renderers/bash.tsx` — `$ command` 风格
- 新增: `packages/web/src/components/chat/tool-renderers/read.tsx` — 路径 + offset/limit
- 新增: `packages/web/src/components/chat/tool-renderers/write.tsx` — 路径 + 完整内容
- 新增: `packages/web/src/components/chat/tool-renderers/edit.tsx` — **集成 @git-diff-view/react**
- 新增: `packages/web/src/components/chat/tool-renderers/grep.tsx`
- 新增: `packages/web/src/components/chat/tool-renderers/glob.tsx`
- 新增: `packages/web/src/components/chat/tool-renderers/web.tsx` — WebFetch + WebSearch
- 新增: `packages/web/src/components/chat/tool-renderers/todo.tsx` — TodoWrite 列表
- 新增: `packages/web/src/components/chat/tool-renderers/task.tsx` — Task/Agent 子代理预览
- 修改: `packages/web/src/components/chat/tool-call-card.tsx` — 接入注册表(外部 API 兼容)
- 新增(DEV-only): `packages/web/src/pages/tool-renderers-preview.tsx` + `/__preview/tool-renderers` 路由

**P3 协议层独立 (AcpClient)**
- 新增: `packages/web/src/lib/acp/acp-client.ts` — `AcpClient` 类(initializeSession / request / notify / stream AsyncIterable / observe AsyncIterable / cancel)
- 新增: `packages/web/src/lib/acp/fetch-with-retry.ts` — 5xx/网络错误指数退避重试 wrapper
- 新增: `packages/web/src/lib/acp/index.ts` — barrel re-export
- 新增: `packages/web/src/hooks/apply-session-update.ts` — 把 223 行 switch 抽到纯函数(接收 setter/ref 作参数)
- 修改: `packages/web/src/hooks/use-chat-stream.ts` — 由 785 行减到 446 行;SSE 解析全部迁到 `AcpClient.stream`

**P4 Agent Phase 可视化**
- 修改(前序 commit): `packages/server/src/agent/cloudbase-agent.service.ts` — `emitPhase` helper 在 5 处边界发射 `agent_phase` 事件
- 修改(前序 commit): `packages/shared/src/types/agent.ts` — `AgentCallbackMessage` union 加 `'agent_phase'` + `phase` + `phaseToolName`
- 修改(前序 commit): `packages/shared/src/types/acp.ts` — `AgentPhaseName` 类型(preparing / model_responding / tool_executing / compacting / idle)
- 新增: `packages/web/src/components/chat/agent-status-indicator.tsx` — 4 种 phase 配 Rocket/Sparkles/Hammer/Archive 图标,`aria-live="polite"`
- 修改(前序 commit): `packages/web/src/hooks/apply-session-update.ts` — `case 'agent_phase'` + timestamp 乱序防护
- 修改: `packages/web/src/hooks/use-chat-stream.ts` — `IDLE_PHASE` 初始化 + `exitStreaming` 复位 + 对外导出 `agentPhase`
- 修改(前序 commit): `packages/web/src/components/task-chat.tsx` — 输入框上方条件渲染 `AgentStatusIndicator`

**P7 Subagent 嵌套 UI**
- 新增: `packages/web/src/components/chat/subagent-card.tsx` — 紫色容器(border-purple-500/40) + Bot 图标 + 子工具计数
- 修改: `packages/shared/src/types/agent.ts` — `AgentCallbackMessage.parent_tool_use_id` + `ToolCallUpdate.parentToolCallId` + `ToolCallStatusUpdate.parentToolCallId`
- 修改: `packages/server/src/agent/cloudbase-agent.service.ts` — SDK 顶层 `parent_tool_use_id` 透传到 5 个 handler + `convertToSessionUpdate` 3 个 case 注入
- 修改: `packages/web/src/types/task-chat.ts` — `MessagePart.tool_call / tool_result` 加 `parentToolCallId`
- 修改: `packages/web/src/hooks/apply-session-update.ts` — tool_call 写 parent + tool_result 从同 id tool_call 继承 + 自引用防御(Task result parent=self)
- 修改: `packages/web/src/components/task-chat.tsx` — parts.map 过滤子工具(parentExists) + Task 分支渲染 SubagentCard

### 未启动 Phase

1. **P5 Checkpoint 回滚**(大工作量,需服务端 git 集成) — 仅剩的高级功能

---

## 一、差距分析（Current vs Decompiled）

### 1.1 协议层差距

| 维度 | 当前实现 | 反编译官方版 | 差距 |
|------|---------|------------|------|
| **传输** | POST + SSE（单向流） | XHR `onprogress` 双向流 + GET SSE 长连接 | 官方支持后台断线重连 SSE |
| **连接标识** | taskId 作为 sessionId | connectionId + sessionToken + sessionId 三层 | 官方支持**多连接复用同会话** |
| **自定义头** | 无 | `x-codebuddy-request: 1` | 官方可识别请求来源 |
| **JSON-RPC 方法** | initialize / session/new / session/load / session/prompt / session/cancel | 全部 + `_codebuddy.ai/*` 扩展 | 缺 `_codebuddy.ai/question` 扩展方法、`_codebuddy.ai/delegateTool`、`_codebuddy.ai/checkpoint` |
| **重试** | 无 | 409 重连、5xx 指数退避、网络错误/超时重试 | 网络不稳时用户体验差 |
| **消息 ID** | 无全局 rpcId 管理 | `pendingRequests: Map<id, {resolve, reject}>` | 并发请求无法精确匹配响应 |

### 1.2 权限模型差距

| 决策 | 当前 | 官方 | 说明 |
|------|------|------|------|
| `allow` | ✅ | ✅ | 一次性允许 |
| `deny` / `reject` | ✅ | ✅ | 拒绝 |
| `allowAll` | ❌ | ✅ | 整会话永久允许（同工具） |
| `rejectAndExitPlan` | ❌ | ✅ | 拒绝并退出 Plan 模式 |

**影响**：用户每次都要点"允许"，重复性强；无 Plan 模式时无法收集用户意图后一次性执行。

### 1.3 交互组件差距

| 组件 | 当前 | 官方 | 说明 |
|------|------|------|------|
| **InterruptionCard** | 仅 `ToolConfirmDialog`（弹窗） | 内嵌式卡片 `Hv` + 三/四按钮组 | 官方 inline 展示 + 保留上下文 |
| **AskUserForm** | ✅ 基础版 | ✅ 带多选、badge、自定义输入、提交 | 当前已基本对齐 |
| **PlanMode** | ❌ | ✅ 独立工具 + 特殊渲染 | 完全缺失 |
| **ExitPlanMode** | ❌ | ✅ 带 Rocket 图标 + "准备好开始编码" + planContent 预览 | 完全缺失 |
| **Checkpoint UI** | ❌ | ✅ 历史回滚时间线 + `revertToCheckpoint(scope)` | 完全缺失 |
| **SubagentCard** | ❌ | ✅ 子代理嵌套时间线 | 无多代理支持 |
| **ToolCallGroup** | ❌ | ✅ 连续工具自动折叠 | 长对话可读性差 |
| **StreamingText** | ❌ | ✅ 流式工具输出实时显示 | 工具运行中看不到进度 |

### 1.4 状态管理差距

| Store | 当前 | 官方 | 说明 |
|-------|------|------|------|
| **chat state** | useState 分散 | 集中的 `useChatStore` (`tt`) | 当前状态散布于 hook 返回值 |
| **childToolCalls** | ❌ | ✅ Map 独立存储子工具调用 | 子代理嵌套无法渲染 |
| **agentPhaseLabel** | ❌ | ✅ preparing/model_requesting/tool_executing/... | 无法给用户"代理在做什么"的反馈 |
| **progressLabel** | ❌ | ✅ progress.compact / progress.compacting | 长会话无进度感知 |
| **hasPendingInterruption** | ❌ | ✅ 全局锁防抖 | 同时多个中断时状态紊乱 |
| **checkpoint store** | ❌ | ✅ `useFileChangesStore` | 无法回滚 |
| **team store** | ❌ | ✅ `useTeamStore` + memberHistories | 无多代理隔离 |

---

## 二、重构目标与分层策略

### 设计原则

1. **兼容优先**：不破坏现有 `useChatStream`、`TaskChat`、`AskUserForm`、`ToolConfirmDialog` 的 API
2. **增量升级**：每个 Phase 独立可上线，失败可单独回滚
3. **协议先行**：协议/类型先定义，UI 后跟进
4. **数据驱动**：工具渲染用**注册表模式**（`TOOL_RENDERERS`），方便新增工具

### 分层架构

```
┌─────────────────────────────────────────────────────┐
│  A. UI 层                                            │
│  InterruptionCard / PlanModeCard / CheckpointTimeline │
│  ToolCallGroup / SubagentCard / ToolRendererRegistry  │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  B. Hook 层（useChatStream v2）                      │
│  - 多中断并发处理                                     │
│  - checkpoint 事件订阅                                │
│  - agent phase 追踪                                   │
│  - 工具流式输出                                       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  C. 协议层（acpClient.ts - 新增）                     │
│  - JSON-RPC 请求管理 (pendingRequests)               │
│  - 错误重试 (fetchWithRetry)                         │
│  - 权限决策映射 (allowAll/rejectAndExitPlan)          │
│  - Checkpoint 事件                                    │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  D. 服务端扩展                                        │
│  - permissionDecision: allow_always                  │
│  - session/request_permission 扩展 options            │
│  - ExitPlanMode 工具处理                              │
│  - checkpoint 事件广播                                │
└─────────────────────────────────────────────────────┘
```

---

## 三、分 Phase 实施计划

### Phase 1：权限模型升级（最高优先级）

**目标**：将 `allow/deny` 二值决策升级为四值，实现"总是允许"。

#### 1.1 协议扩展（服务端）

**文件**：`packages/server/src/agent/cloudbase-agent.service.ts`

```typescript
// 当前 (line ~1022)
if (toolConfirmation.payload.action === 'allow') {
  // 仅允许当次
  permissionDecision: 'allow'
}

// 重构为
type PermissionAction = 'allow' | 'allow_always' | 'deny' | 'reject_and_exit_plan'

interface ToolConfirmationPayload {
  action: PermissionAction
  scope?: 'once' | 'session' | 'always'  // allow_always 时传 'session'
}

// 服务端维护 sessionAllowedTools: Set<string>
if (toolConfirmation.payload.action === 'allow_always') {
  sessionAllowedTools.add(toolUseId.toolName)
  permissionDecision = 'allow'
}

// 后续同工具自动跳过中断
if (sessionAllowedTools.has(toolName)) {
  // skip canUseTool 询问
}
```

#### 1.2 类型层（前端）

**文件**：`packages/web/src/types/task-chat.ts`（修改）

```typescript
// 扩展 ToolConfirmData
export interface ToolConfirmData {
  toolCallId: string
  assistantMessageId: string
  toolName: string
  toolTitle?: string              // 新增：友好显示名
  input: Record<string, unknown>
  availableActions?: PermissionAction[]  // 新增：服务端声明可用决策
  planContent?: string            // 新增：ExitPlanMode 的计划内容
}

export type PermissionAction = 'allow' | 'allow_always' | 'deny' | 'reject_and_exit_plan'
```

#### 1.3 UI 升级

**文件**：`packages/web/src/components/chat/tool-confirm-dialog.tsx`（重写为内嵌卡片）

**新增**：`packages/web/src/components/chat/interruption-card.tsx`

```tsx
// 参考反编译 05-tool-call-components.tsx:660 的 Hv 实现
export function InterruptionCard({ data, isSending, onConfirm }: Props) {
  const isExitPlanMode = data.toolName === 'ExitPlanMode'
  
  if (isExitPlanMode) {
    return (
      <Card className="border-accent-brand">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-accent-brand" />
          <span>准备开始编码</span>
        </div>
        {data.planContent && <PlanPreview content={data.planContent} />}
        <ButtonGroup>
          <Button onClick={() => onConfirm('allow')}>是，开始</Button>
          <Button variant="outline" onClick={() => onConfirm('deny')}>继续规划</Button>
          <Button variant="ghost" onClick={() => onConfirm('reject_and_exit_plan')}>退出 Plan</Button>
        </ButtonGroup>
      </Card>
    )
  }
  
  // 标准权限卡片：allow / allow_always / deny
  return (
    <Card className="border-orange-500/50">
      <ShieldAlert /> {data.toolTitle || data.toolName}
      <ToolInputPreview input={data.input} />
      <ButtonGroup>
        <Button onClick={() => onConfirm('allow')}>允许</Button>
        <Button variant="outline" onClick={() => onConfirm('allow_always')}>
          总是允许（本会话）
        </Button>
        <Button variant="outline" onClick={() => onConfirm('deny')}>拒绝</Button>
      </ButtonGroup>
    </Card>
  )
}
```

#### 1.4 Hook 层

**文件**：`packages/web/src/hooks/use-chat-stream.ts`（line 597）

```typescript
const confirmTool = useCallback(
  async (action: PermissionAction) => {  // 改为 PermissionAction
    // ...
    toolConfirmation: {
      interruptId: data.toolCallId,
      payload: { action },  // 支持新的 action 类型
    }
  },
  ...
)
```

**验收标准**：
- [ ] "总是允许"后，同会话中同工具不再弹确认
- [ ] ExitPlanMode 显示专属 UI
- [ ] `rejectAndExitPlan` 正确退出计划模式
- [ ] 旧数据（`allow/deny`）向后兼容

---

### Phase 2：PlanMode + ExitPlanMode 支持

**目标**：完整复刻官方 "先规划后执行" 的 Plan 模式。

#### 2.1 服务端工具注册

**文件**：`packages/server/src/agent/coding-mode.ts`

新增两个工具：

```typescript
// ExitPlanMode - 模型主动声明"计划完成"
{
  name: 'ExitPlanMode',
  description: 'Present plan to user and exit plan mode when approved',
  inputSchema: {
    type: 'object',
    properties: {
      plan: { type: 'string', description: 'Markdown plan to show user' }
    },
    required: ['plan']
  },
  // 总是触发中断（用户审批后才退出）
  requiresInterruption: true,
}
```

#### 2.2 Plan 模式状态管理

**新增文件**：`packages/web/src/lib/atoms/plan-mode.ts`

```typescript
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export interface PlanModeState {
  active: boolean
  planContent: string | null   // 当前规划内容（Markdown）
  toolCallId: string | null    // 对应 ExitPlanMode 的 toolCallId
}

export const planModeAtomFamily = atomFamily((_taskId: string) =>
  atom<PlanModeState>({ active: false, planContent: null, toolCallId: null })
)
```

#### 2.3 SSE 事件处理

**文件**：`packages/web/src/hooks/use-chat-stream.ts`

```typescript
// applyStreamUpdate 新增分支
case 'tool_call':
  if (u.title === 'ExitPlanMode') {
    setPlanMode({
      active: true,
      planContent: u.input?.plan || '',
      toolCallId: u.toolCallId,
    })
    // 仍然触发 tool_confirm 流程
  }
  break
```

#### 2.4 PlanModeCard 组件

**新增文件**：`packages/web/src/components/chat/plan-mode-card.tsx`

```tsx
export function PlanModeCard({ plan, onConfirm, isSending }: Props) {
  return (
    <Card className="border-accent-brand bg-accent-brand/5">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="h-4 w-4 text-accent-brand" />
        <span className="font-semibold">准备开始编码</span>
      </div>
      <div className="prose prose-sm max-h-96 overflow-y-auto">
        <ReactMarkdown>{plan}</ReactMarkdown>
      </div>
      <ButtonGroup>
        <Button onClick={() => onConfirm('allow')}>是，开始编码</Button>
        <Button variant="outline" onClick={() => onConfirm('deny')}>继续规划</Button>
        <Button variant="ghost" onClick={() => onConfirm('reject_and_exit_plan')}>
          退出 Plan 模式
        </Button>
      </ButtonGroup>
    </Card>
  )
}
```

**验收标准**：
- [ ] 用户能主动开启 Plan 模式（通过 `/plan` 命令或模型自动进入）
- [ ] 计划内容以 Markdown 格式清晰展示
- [ ] 批准后工具依次执行，拒绝后仅对话

---

### Phase 3：协议层独立（AcpClient 引入）

**目标**：把分散在 `useChatStream` 里的协议代码抽到独立的 `AcpClient` 类，参考反编译的 `Wi`。

#### 3.1 新增文件

**`packages/web/src/lib/acp/acp-client.ts`**

```typescript
/**
 * ACP 协议客户端
 * 封装：
 * - JSON-RPC 请求/响应
 * - SSE 流处理
 * - 错误重试
 * - 事件分发（pub/sub）
 *
 * 不直接操作 React state，只通过事件通知上层。
 */
export class AcpClient {
  private pendingRequests = new Map<number, { resolve, reject }>()
  private listeners = new Map<string, Set<Listener>>()
  private nextId = 1
  
  async request(method: string, params: any): Promise<any> {
    // 参考反编译 01-acp-client.ts:200+
    // XHR 流式读取 SSE 响应
  }
  
  on(event: string, listener: Listener): () => void { /* ... */ }
  emit(event: string, data: any): void { /* ... */ }
  
  // 工厂方法
  async prompt(params: PromptParams): Promise<void> { /* ... */ }
  async respondToInterruption(params: InterruptionResponse): Promise<void> { /* ... */ }
  async respondToQuestion(toolCallId: string, answers: any): Promise<void> { /* ... */ }
  async cancel(sessionId: string): Promise<void> { /* ... */ }
}
```

**`packages/web/src/lib/acp/fetch-with-retry.ts`**

```typescript
// 参考反编译 01-acp-client.ts:35 的 fetchWithRetry
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config?: { maxRetries?: number; baseDelay?: number }
): Promise<Response> {
  // 5xx / 网络错误指数退避重试
}
```

#### 3.2 useChatStream 重构

`useChatStream` 从协议细节中解耦，只订阅 AcpClient 事件：

```typescript
export function useChatStream({ taskId, ... }) {
  const client = useMemo(() => new AcpClient({ baseUrl: '/api/agent/acp' }), [])
  
  useEffect(() => {
    const unsubscribers = [
      client.on('agent_message_chunk', handleMessageChunk),
      client.on('thinking', handleThinking),
      client.on('tool_call', handleToolCall),
      client.on('tool_confirm', handleToolConfirm),  // 不变
      client.on('ask_user', handleAskUser),          // 不变
      client.on('checkpoint_created', handleCheckpoint),  // 新
      client.on('agent_phase', handleAgentPhase),    // 新
    ]
    return () => unsubscribers.forEach(fn => fn())
  }, [client])
  
  const confirmTool = async (action) => {
    await client.respondToInterruption({
      sessionId: taskId,
      toolCallId: data.toolCallId,
      action,
    })
  }
  
  // ...
}
```

**验收标准**：
- [ ] `useChatStream` 代码行数从 725 下降到 400 以内
- [ ] 新增事件（checkpoint/phase）只需修改 `AcpClient` 和 hook 订阅
- [ ] 网络抖动时自动重试，用户无感知

---

### Phase 4：Agent Phase 可视化

**目标**：让用户清晰知道"代理在做什么"，减少焦虑。

#### 4.1 服务端上报 phase

**文件**：`packages/server/src/agent/cloudbase-agent.service.ts`

在流中插入 `session_info_update` 事件（参考反编译的 `_meta["codebuddy.ai/agentPhase"]`）：

```typescript
// 模型请求前
await callback({
  method: 'session/update',
  params: {
    sessionId,
    update: {
      sessionUpdate: 'session_info_update',
      _meta: { 'codebuddy.ai/agentPhase': { phase: 'model_requesting' } }
    }
  }
})

// 工具执行前
_meta: { 'codebuddy.ai/agentPhase': { phase: 'tool_executing', toolName: 'Bash' } }

// 进度上报
_meta: { 'codebuddy.ai/progress': { type: 'compacting' } }
```

#### 4.2 前端状态

**文件**：`packages/web/src/hooks/use-chat-stream.ts`

```typescript
const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(null)
const [progressLabel, setProgressLabel] = useState<string | null>(null)

case 'session_info_update': {
  const meta = u._meta || {}
  if (meta['codebuddy.ai/agentPhase']) {
    setAgentPhase(meta['codebuddy.ai/agentPhase'])
  }
  if (meta['codebuddy.ai/progress']) {
    setProgressLabel(`progress.${meta['codebuddy.ai/progress'].type}`)
  }
  break
}
```

#### 4.3 UI

**新增**：`packages/web/src/components/chat/agent-status-indicator.tsx`

```tsx
export function AgentStatusIndicator({ phase, progressLabel }: Props) {
  if (!phase && !progressLabel) return null
  
  const label = progressLabel || PHASE_LABELS[phase.phase]
  const detail = phase.toolName ? ` (${phase.toolName})` : ''
  
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{t(label)}{detail}</span>
    </div>
  )
}
```

**验收标准**：
- [ ] 会话期间显示"模型响应中 / 执行工具 / 思考中"等状态
- [ ] 长时间 compact 操作有进度提示

---

### Phase 5：Checkpoint 回滚

**目标**：实现"时间旅行"——用户可以回到任意检查点。

#### 5.1 服务端 checkpoint 机制

**新增**：`packages/server/src/agent/checkpoint.service.ts`

```typescript
interface Checkpoint {
  id: string
  taskId: string
  createdAt: number
  scope: 'code' | 'conversation' | 'both'
  fileChanges: FileChange[]
  messageIds: string[]
  gitCommit?: string  // 可选：关联 git commit
}

class CheckpointService {
  async createCheckpoint(taskId: string, scope: Scope): Promise<Checkpoint>
  async listCheckpoints(taskId: string): Promise<Checkpoint[]>
  async revertTo(checkpointId: string, scope: Scope): Promise<void>
}
```

**事件广播**：
```typescript
callback({
  method: '_codebuddy.ai/checkpoint',
  params: { event: 'created', checkpoint }
})
```

#### 5.2 前端 store

**新增**：`packages/web/src/lib/atoms/checkpoints.ts`

```typescript
export const checkpointsAtomFamily = atomFamily((_taskId: string) =>
  atom<Checkpoint[]>([])
)
```

#### 5.3 UI 组件

**新增**：`packages/web/src/components/chat/checkpoint-timeline.tsx`

```tsx
export function CheckpointTimeline({ checkpoints, onRevert }: Props) {
  return (
    <Sheet>
      <SheetHeader>时间线</SheetHeader>
      {checkpoints.map(cp => (
        <CheckpointItem
          key={cp.id}
          checkpoint={cp}
          onRevert={() => onRevert(cp.id, 'both')}
        />
      ))}
    </Sheet>
  )
}
```

**验收标准**：
- [ ] 每次消息/工具调用自动创建 checkpoint
- [ ] 用户可查看检查点列表
- [ ] 支持三种回滚 scope：仅代码 / 仅对话 / 全部

---

### Phase 6：工具渲染注册表

**目标**：每种工具有专属 UI，对接复用反编译的 `TOOL_RENDERERS`（见 `05-tool-call-components.tsx`）。

#### 6.1 注册表

**新增**：`packages/web/src/components/chat/tool-renderers/index.ts`

```typescript
export interface ToolRenderer {
  icon: React.FC<{ size?: number }>
  renderInput?: (input: any) => React.ReactNode
  renderOutput?: (result: string, input: any) => React.ReactNode
  renderInterruptionPreview?: (input: any) => { subtitle?: string; content: React.ReactNode }
}

export const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  Read: readToolRenderer,
  Write: writeToolRenderer,
  Edit: editToolRenderer,
  Bash: bashToolRenderer,
  Grep: grepToolRenderer,
  Glob: globToolRenderer,
  WebFetch: webFetchRenderer,
  WebSearch: webSearchRenderer,
  // ...
}

// 查找优先级：工具名 -> 工具 kind -> 默认
export function getToolRenderer(toolName: string, kind?: string): ToolRenderer {
  return TOOL_RENDERERS[toolName] || TOOL_RENDERERS[kind || ''] || defaultRenderer
}
```

#### 6.2 具体渲染器

**`renderers/bash.tsx`**

```tsx
export const bashToolRenderer: ToolRenderer = {
  icon: TerminalIcon,
  renderInput: (input) => (
    <pre className="text-xs font-mono bg-muted p-2 rounded">
      $ {input.command}
    </pre>
  ),
  renderOutput: (result) => (
    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
      {extractBashOutput(result)}
    </pre>
  ),
  renderInterruptionPreview: (input) => ({
    subtitle: input.description,
    content: <code className="text-xs">$ {input.command}</code>,
  }),
}
```

**`renderers/edit.tsx`** 集成 diff-viewer：

```tsx
export const editToolRenderer: ToolRenderer = {
  icon: FilePenIcon,
  renderInput: (input) => (
    <div>
      <FilePath path={input.file_path} />
      <DiffView
        oldText={input.old_string}
        newText={input.new_string}
      />
    </div>
  ),
}
```

**验收标准**：
- [ ] 至少 10 种工具有专属渲染
- [ ] Edit/Write 工具展示 diff 预览
- [ ] Bash 输出有语法高亮
- [ ] 未知工具 fallback 到 JSON pretty print

---

### Phase 7：工具调用分组 + Subagent

**目标**：解决"连续 20 次 Read 刷屏"、"子代理消息混在主会话中"的可读性问题。

#### 7.1 Timeline 分组

**新增**：`packages/web/src/components/chat/timeline-group.tsx`

```typescript 
// 参考反编译 04-chat-message-list.tsx 的 Ah 函数
export function groupMessageParts(parts: MessagePart[]) {
  const groups: RenderGroup[] = []
  for (const part of parts) {
    if (part.type === 'text' || part.type === 'thinking') {
      groups.push({ kind: 'text_or_thinking', entry: part })
    } else {
      // 连续的 tool_call/tool_result 合并
      const last = groups[groups.length - 1]
      if (last?.kind === 'tool_group') {
        last.entries.push(part)
      } else {
        groups.push({ kind: 'tool_group', entries: [part] })
      }
    }
  }
  return groups
}
```

#### 7.2 ToolCallGroup 组件

```tsx
export function ToolCallGroup({ entries }: Props) {
  // ≥2 个工具且全部完成 → 自动折叠
  const allCompleted = entries.every(e => e.status === 'completed')
  const [isExpanded, setIsExpanded] = useState(!allCompleted)
  
  if (!isExpanded) {
    return (
      <button onClick={() => setIsExpanded(true)}>
        已执行 {entries.length} 个工具
        {entries.some(e => e.isError) && <span className="text-red-500">（含失败）</span>}
      </button>
    )
  }
  
  return (
    <div className="space-y-1 pl-2 border-l-2 border-border-muted">
      {entries.map(entry => <ToolCallCard key={entry.toolCallId} toolCall={entry} />)}
    </div>
  )
}
```

#### 7.3 Subagent 支持

**协议扩展**：服务端在 tool_call 的 `_meta` 中标记：

```typescript
_meta: {
  'codebuddy.ai/isSubagent': true,
  'codebuddy.ai/subagentType': 'Explore',
  'codebuddy.ai/parentToolCallId': 'parent_xxx'
}
```

**前端状态**：独立 `childToolCalls: Map<toolCallId, ToolCall>`

**渲染**：`SubagentCard` 嵌套 subagentTimeline

**验收标准**：
- [ ] 连续工具调用 ≥2 个自动折叠
- [ ] Subagent 在独立卡片内渲染
- [ ] 点击展开后可看完整时间线

---

## 四、实施优先级与路线图

### 推荐顺序（ROI 从高到低）

| # | Phase | 业务价值 | 工作量 | 依赖 |
|---|-------|---------|-------|------|
| 1 | **P1 权限模型升级** | ⭐⭐⭐⭐⭐ 高频痛点 | 小 | 无 |
| 2 | **P2 PlanMode/ExitPlanMode** | ⭐⭐⭐⭐ 大项目规划 | 中 | P1 |
| 3 | **P6 工具渲染注册表** | ⭐⭐⭐⭐ 可读性 | 中 | 无（可并行） |
| 4 | **P4 Agent Phase 可视化** | ⭐⭐⭐ 用户体验 | 小 | 无 |
| 5 | **P7 工具分组+Subagent** | ⭐⭐⭐ 长对话 | 中 | P6 |
| 6 | **P3 协议层独立** | ⭐⭐ 代码健康 | 大 | P1/P2 完成后 |
| 7 | **P5 Checkpoint 回滚** | ⭐⭐ 高级功能 | 大 | 服务端 git 集成 |

### 里程碑

**M1 - 交互体验对齐（P1+P2+P4）**
- 四值权限决策
- Plan 模式完整支持
- 代理阶段可视化
- 交付指标：用户每次会话点击确认次数 -50%

**M2 - 可读性升级（P6+P7）**
- 专属工具 UI
- 长会话自动折叠
- 交付指标：工具调用错误定位时间 -70%

**M3 - 架构健康（P3）**
- AcpClient 抽象
- 可靠性提升（重试、事件总线）
- 交付指标：网络故障恢复率 100%

**M4 - 高级能力（P5）**
- 检查点/时间旅行
- 交付指标：支持"撤销最近 5 分钟操作"

---

## 五、文件改动清单

### 新增文件

```
packages/web/src/
├── lib/
│   ├── acp/
│   │   ├── acp-client.ts              [P3] AcpClient 协议客户端
│   │   ├── fetch-with-retry.ts        [P3] 重试工具
│   │   └── types.ts                   [P3] 协议类型
│   └── atoms/
│       ├── plan-mode.ts               [P2] Plan 模式状态
│       ├── checkpoints.ts             [P5] 检查点状态
│       └── agent-phase.ts             [P4] 代理阶段状态
├── components/chat/
│   ├── interruption-card.tsx          [P1] 替代 ToolConfirmDialog
│   ├── plan-mode-card.tsx             [P2] ExitPlanMode UI
│   ├── agent-status-indicator.tsx     [P4] 阶段指示器
│   ├── checkpoint-timeline.tsx        [P5] 检查点时间线
│   ├── tool-call-group.tsx            [P7] 工具调用分组
│   ├── subagent-card.tsx              [P7] 子代理卡片
│   ├── timeline-group.tsx             [P7] 分组逻辑
│   └── tool-renderers/
│       ├── index.ts                   [P6] 注册表
│       ├── bash.tsx                   [P6]
│       ├── edit.tsx                   [P6]
│       ├── read.tsx                   [P6]
│       ├── write.tsx                  [P6]
│       ├── grep.tsx                   [P6]
│       └── default.tsx                [P6]
└── hooks/
    └── use-chat-stream-v2.ts          [P3] 重构后的 hook

packages/server/src/
└── agent/
    ├── checkpoint.service.ts          [P5]
    └── session-permissions.ts         [P1] 会话级权限缓存
```

### 修改文件

| 文件 | Phase | 改动 |
|------|-------|------|
| `types/task-chat.ts` | P1 | 扩展 `ToolConfirmData`、新增 `PermissionAction` |
| `components/chat/tool-confirm-dialog.tsx` | P1 | **弃用**，由 `interruption-card.tsx` 替代 |
| `components/chat/ask-user-form.tsx` | — | 保留（已对齐官方） |
| `components/task-chat.tsx` | P1/P4/P7 | 替换 ToolConfirmDialog → InterruptionCard；渲染 AgentStatusIndicator；用 timeline-group |
| `hooks/use-chat-stream.ts` | P1/P2/P4 | 新增事件处理：checkpoint、agent_phase、plan_mode |
| `server/routes/acp.ts` | P1 | `toolConfirmation.payload.action` 扩展类型 |
| `agent/cloudbase-agent.service.ts` | P1/P2 | 支持 `allow_always`、注册 `ExitPlanMode` 工具 |
| `agent/coding-mode.ts` | P2 | 注册 Plan 模式相关工具 |

---

## 六、风险与兼容性

### 6.1 向后兼容

| 风险点 | 缓解措施 |
|-------|---------|
| 现有 `action: 'allow' \| 'deny'` 数据 | 前端接收时兼容旧值：`action === 'allow'` 视作 `'allow'` |
| 数据库消息格式变更 | 协议字段新增均以 `_meta` 前缀，不破坏现有字段 |
| 老客户端断网重连 | 服务端检测 client version，必要时降级协议 |

### 6.2 性能考量

| 问题 | 方案 |
|------|------|
| SSE 长连接内存占用 | 参考官方指数退避重连 + 心跳 keepalive |
| 大量 tool_call 重渲染 | 使用 `React.memo` + `useMemo` 分组结果 |
| Checkpoint 存储空间 | git 增量快照 / 仅存 diff |

### 6.3 测试策略

每个 Phase 独立验收：

1. **单元测试**：新增组件 + hook 逻辑
2. **集成测试**：模拟 SSE 事件序列，验证 UI 状态
3. **E2E 测试**：Playwright 场景：
   - 用户发起 Bash 请求 → 点击"总是允许" → 再次请求不弹窗
   - 进入 Plan 模式 → 查看计划 → 批准 → 工具执行
   - 网络断开 → 自动重连 → 会话继续

---

## 七、下一步行动

**建议立即启动 Phase 1**（权限模型升级），原因：

1. 改动面小、风险低（仅扩展枚举 + UI）
2. 用户感知最强（"每次都点允许"是最大痛点）
3. 不依赖其他 Phase，可独立交付

**Phase 1 开工清单**：

- [ ] 服务端 `session-permissions.ts`：会话级工具白名单
- [ ] `types/task-chat.ts`：扩展 `PermissionAction` 类型
- [ ] `interruption-card.tsx`：替换现有 `ToolConfirmDialog`
- [ ] `use-chat-stream.ts`：`confirmTool` 接受四值 action
- [ ] `acp.ts` 服务端路由：透传 `action` 到 agent service
- [ ] 写 3 个测试：`allow` / `allow_always` / 兼容旧 `deny`

完工后可立即看到：用户使用 Bash、Read 等高频工具时，点一次"总是允许"，后续全程免打扰。

---

**文档版本**：v1.0
**作者**：基于反编译分析自动生成
**参考文档**：
- `CodeBuddy Code_decompiled/00-acp-client-full.ts`
- `CodeBuddy Code_decompiled/05-tool-call-components.tsx`（第 630-780 行 Hv 组件）
- `CodeBuddy Code_decompiled/02-state-management.ts`（useChatStore）
- `/tmp/chat_architecture.md`（当前实现调研）
