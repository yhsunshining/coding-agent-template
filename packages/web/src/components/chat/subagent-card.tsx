import { useState, useMemo } from 'react'
import { Bot, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { MessagePart } from '@/types/task-chat'
import { ToolCallCard } from './tool-call-card'

/**
 * SubagentCard — 子代理（Task 工具）嵌套渲染卡片（P7）
 *
 * 官方反编译对应：05-tool-call-components.tsx 的 `h_` 组件。
 *
 * 职责：
 * - 接收一个 Task 工具的 tool_call + 所有 `parentToolCallId === task.toolCallId` 的子部件
 * - 紫色主题与普通 ToolCallCard 区分
 * - 默认展开态：流式执行中且尚未有 taskToolResult；否则折叠
 * - 内部对每个子 tool_call 用常规 ToolCallCard 渲染（复用 P6 注册表）
 * - **P7-fix**：若子工具本身是 Task（嵌套 subagent），则递归渲染 SubagentCard，
 *   保证 3 层及以上嵌套时孙子工具不丢失
 * - fallback：childParts 为空时展示 Task 本身的简要信息（description / prompt）
 */
interface SubagentCardProps {
  /** Task 工具的 tool_call part（toolName === 'Task'） */
  taskToolCall: Extract<MessagePart, { type: 'tool_call' }>
  /** Task 工具的 tool_result（尚未完成时为 undefined） */
  taskToolResult?: Extract<MessagePart, { type: 'tool_result' }>
  /** 所有 parentToolCallId === taskToolCall.toolCallId 的子 tool_call + tool_result */
  childParts: MessagePart[]
  /** 是否还在流式响应中（用于决定初始展开态） */
  isStreaming: boolean
  /**
   * P7-fix: 完整的 agentMessage.parts 快照。仅在子 Task 递归时用于查找孙子部件；
   * 顶层调用可不传（默认 = childParts）。保持 optional 以向后兼容。
   */
  allParts?: MessagePart[]
}

interface TaskInputShape {
  description?: string
  prompt?: string
  subagent_type?: string
}

export function SubagentCard({ taskToolCall, taskToolResult, childParts, isStreaming, allParts }: SubagentCardProps) {
  // P7-fix: 递归查找孙子部件的数据源。顶层没传 allParts 时退化为 childParts(= 直接子),
  // 等同于修复前的行为;内层调用时外层会把完整 parts[] 透传下来。
  const partsForLookup = allParts ?? childParts
  // 解析 Task input（服务端回放时可能是 JSON 字符串，流式时已是对象）
  const parsedInput = useMemo<TaskInputShape>(() => {
    const raw = taskToolCall.input
    if (raw && typeof raw === 'object') return raw as TaskInputShape
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as TaskInputShape
      } catch {
        return {}
      }
    }
    return {}
  }, [taskToolCall.input])

  const isPending = !taskToolResult
  const isError = taskToolResult?.isError === true

  // 默认展开：执行中；完成或失败后默认折叠（保持 timeline 清爽）
  const [expanded, setExpanded] = useState<boolean>(isStreaming && isPending)

  const childToolCalls = useMemo(
    () => childParts.filter((p): p is Extract<MessagePart, { type: 'tool_call' }> => p.type === 'tool_call'),
    [childParts],
  )
  const childToolResults = useMemo(
    () => childParts.filter((p): p is Extract<MessagePart, { type: 'tool_result' }> => p.type === 'tool_result'),
    [childParts],
  )

  const displayName = parsedInput.subagent_type || parsedInput.description?.slice(0, 60) || 'Task'
  const subtitle =
    parsedInput.subagent_type && parsedInput.description ? parsedInput.description.slice(0, 80) : undefined

  // 容器颜色：pending/紫色 → failed/红色 → done/默认
  const containerClass = isPending
    ? 'border-purple-500/40 bg-purple-500/5'
    : isError
      ? 'border-red-500/40 bg-red-500/5'
      : 'border-border/50 bg-muted/20'

  return (
    <div className={`border rounded-lg overflow-hidden ${containerClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-purple-500/10 transition-colors"
      >
        {/* 左侧状态圆点 */}
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        )}
        {/* Bot 图标 */}
        <div className="flex items-center justify-center rounded-full bg-purple-500/20 p-0.5 flex-shrink-0">
          <Bot className="h-3 w-3 text-purple-500" />
        </div>
        {/* 标题 */}
        <span className="font-semibold text-purple-600 dark:text-purple-400">{displayName}</span>
        {subtitle && <span className="text-muted-foreground truncate max-w-[280px]">{subtitle}</span>}
        {/* 子工具计数 */}
        {childToolCalls.length > 0 && (
          <span className="text-muted-foreground">
            · {childToolCalls.length} {childToolCalls.length === 1 ? 'tool' : 'tools'}
          </span>
        )}
        {/* 展开/收起 chevron */}
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-purple-500/20">
          {childToolCalls.length === 0 ? (
            // Fallback: 没有子工具时展示 Task 本身的 prompt
            <div className="text-xs text-muted-foreground">
              {parsedInput.prompt ? (
                <pre className="whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{parsedInput.prompt}</pre>
              ) : (
                '子代理尚未产生工具调用...'
              )}
            </div>
          ) : (
            // 嵌套渲染：左侧紫色竖线 + 子 ToolCallCard / SubagentCard 列表
            <div className="ml-1 pl-3 border-l border-purple-500/25 space-y-1.5">
              {childToolCalls.map((tc, i) => {
                const result = childToolResults.find((r) => r.toolCallId === tc.toolCallId)
                // P7-fix: 子工具本身是 Task -> 递归渲染 SubagentCard,孙子工具层层展开
                if (tc.toolName === 'Task') {
                  const grandChildren = partsForLookup.filter(
                    (p) => (p.type === 'tool_call' || p.type === 'tool_result') && p.parentToolCallId === tc.toolCallId,
                  )
                  const grandResult = partsForLookup.find(
                    (p) => p.type === 'tool_result' && p.toolCallId === tc.toolCallId,
                  )
                  return (
                    <SubagentCard
                      key={`nested-subagent-${tc.toolCallId}-${i}`}
                      taskToolCall={tc}
                      taskToolResult={grandResult?.type === 'tool_result' ? grandResult : undefined}
                      childParts={grandChildren}
                      isStreaming={isStreaming}
                      allParts={partsForLookup}
                    />
                  )
                }
                return (
                  <ToolCallCard
                    key={`child-${tc.toolCallId}-${i}`}
                    toolName={tc.toolName || 'tool'}
                    toolCallId={tc.toolCallId}
                    input={tc.input}
                    result={result?.content}
                    isError={result?.isError}
                    isPending={!result}
                  />
                )
              })}
              {/* 任务级别的结果（若与子工具共存则额外展示为简洁一行） */}
              {taskToolResult?.content && (
                <div className="mt-2 pt-2 border-t border-purple-500/15 text-[11px] text-muted-foreground">
                  <span className="font-medium">Task result:</span>{' '}
                  <span className="whitespace-pre-wrap break-words">
                    {taskToolResult.content.slice(0, 200)}
                    {taskToolResult.content.length > 200 ? '…' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
