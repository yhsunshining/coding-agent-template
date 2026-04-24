// ACP Protocol Types - extended session updates for task notifications
// Base ACP types are in ./agent.ts (from Nex)

import type {
  SessionUpdate as BaseSessionUpdate,
  AgentMessageChunkUpdate,
  ToolCallUpdate,
  ToolCallStatusUpdate,
  AvailableCommandsUpdate,
} from './agent'

// Extended session update types for task/logging notifications
export interface LogUpdate {
  sessionUpdate: 'log'
  level: 'info' | 'error' | 'success' | 'command'
  message: string
  timestamp: number
}

export interface TaskProgressUpdate {
  sessionUpdate: 'task_progress'
  progress: number
  status: 'pending' | 'processing' | 'completed' | 'error' | 'stopped'
}

export interface FileChangeUpdate {
  sessionUpdate: 'file_change'
  filename: string
  action: 'add' | 'modify' | 'delete'
}

export interface ThinkingUpdate {
  sessionUpdate: 'thinking'
  content: string
}

export interface AskUserUpdate {
  sessionUpdate: 'ask_user'
  toolCallId: string
  assistantMessageId: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string }>
    multiSelect: boolean
  }>
}

export interface ToolConfirmUpdate {
  sessionUpdate: 'tool_confirm'
  toolCallId: string
  assistantMessageId: string
  toolName: string
  input: Record<string, unknown>
}

export interface ArtifactUpdate {
  sessionUpdate: 'artifact'
  artifact: {
    title: string
    description?: string
    contentType: 'image' | 'link' | 'json'
    data: string
    metadata?: Record<string, unknown>
  }
}

// Extended SessionUpdate type (base + custom)
export type ExtendedSessionUpdate =
  | BaseSessionUpdate
  | LogUpdate
  | TaskProgressUpdate
  | FileChangeUpdate
  | ThinkingUpdate
  | AskUserUpdate
  | ToolConfirmUpdate
  | ArtifactUpdate

// Re-export base types for convenience
export type {
  BaseSessionUpdate,
  AgentMessageChunkUpdate,
  ToolCallUpdate,
  ToolCallStatusUpdate,
  AvailableCommandsUpdate,
}

// Re-export permission action type for frontend single-point import
export type { PermissionAction } from './agent'

// ─── Stream Event Persistence Types ──────────────────────────────────

export type AgentRunStatus = 'running' | 'completed' | 'error' | 'cancelled'

export interface StreamEvent {
  eventId: string
  conversationId: string
  turnId: string
  envId: string
  userId: string
  event: ExtendedSessionUpdate
  seq: number
  createTime: number
}
