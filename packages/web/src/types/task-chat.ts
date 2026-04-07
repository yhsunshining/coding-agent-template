import type { Task } from '@coder/shared'

// ─── Message Types ────────────────────────────────────────────────────

export interface TaskMessage {
  id: string
  taskId: string
  role: 'user' | 'agent'
  content: string
  createdAt: number
  parts?: MessagePart[]
  /** Record-level status: 'done' | 'pending' | 'streaming' | 'error' | 'cancel' */
  status?: string
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | {
      type: 'tool_call'
      toolCallId: string
      toolName: string
      input?: unknown
      assistantMessageId?: string
      status?: string
    }
  | {
      type: 'tool_result'
      toolCallId: string
      toolName?: string
      content: string
      isError?: boolean
      /** 'incomplete' when tool was interrupted (e.g. AskUserQuestion waiting for user answer) */
      status?: string
    }

// ─── Interaction Types ────────────────────────────────────────────────

export interface AskUserQuestionData {
  toolCallId: string
  assistantMessageId: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string }>
    multiSelect: boolean
  }>
}

export interface ToolConfirmData {
  toolCallId: string
  assistantMessageId: string
  toolName: string
  input: Record<string, unknown>
}

// ─── Component Props ──────────────────────────────────────────────────

export interface TaskChatProps {
  taskId: string
  task: Task
  /** 当 ACP 对话轮次完成时（stream DONE）通知父组件刷新 task */
  onStreamComplete?: () => void
  /** 从 URL 参数传入的初始 prompt，存在时自动发起 ACP 请求 */
  initialPrompt?: string
  /** 初始 prompt 已被消费后回调，父组件应清除 initialPrompt 防止 remount 时重复触发 */
  onInitialPromptConsumed?: () => void
}

// ─── Tab Data Types ───────────────────────────────────────────────────

export interface PRComment {
  id: number
  user: {
    login: string
    avatar_url: string
  }
  body: string
  created_at: string
  html_url: string
}

export interface CheckRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
  started_at: string
  completed_at: string | null
}

export interface DeploymentInfo {
  id: string
  taskId: string
  type: 'web' | 'miniprogram'
  url: string | null
  path: string | null
  qrCodeUrl: string | null
  pagePath: string | null
  appId: string | null
  label: string | null
  metadata: Record<string, unknown> | null
  createdAt: number
  updatedAt: number
}

export interface ArtifactInfo {
  title: string
  description?: string
  contentType: 'image' | 'link' | 'json'
  data: string
  metadata?: Record<string, unknown>
}
