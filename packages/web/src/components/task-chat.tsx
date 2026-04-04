import { CloudDashboard } from '@coder/dashboard/CloudDashboard'
import type { Task, ExtendedSessionUpdate, LogUpdate } from '@coder/shared'

interface TaskMessage {
  id: string
  taskId: string
  role: 'user' | 'agent'
  content: string
  createdAt: number
}
import { useState, useEffect, useRef, useCallback, Children, isValidElement } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowUp,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Square,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  MoreVertical,
  MessageSquare,
  Shield,
  ShieldAlert,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Brain,
  Wrench,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Streamdown } from 'streamdown'
import { useAtom, useAtomValue } from 'jotai'
import { taskChatInputAtomFamily } from '@/lib/atoms/task'
import { sessionAtom } from '@/lib/atoms/session'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface AskUserQuestionData {
  toolCallId: string
  assistantMessageId: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string }>
    multiSelect: boolean
  }>
}

interface ToolConfirmData {
  toolCallId: string
  assistantMessageId: string
  toolName: string
  input: Record<string, unknown>
}

interface TaskChatProps {
  taskId: string
  task: Task
  /** 当 ACP 对话轮次完成时（stream DONE）通知父组件刷新 task */
  onStreamComplete?: () => void
  /** 从 URL 参数传入的初始 prompt，存在时自动发起 ACP 请求 */
  initialPrompt?: string
}

interface PRComment {
  id: number
  user: {
    login: string
    avatar_url: string
  }
  body: string
  created_at: string
  html_url: string
}

interface CheckRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
  started_at: string
  completed_at: string | null
}

interface DeploymentInfo {
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

interface ArtifactInfo {
  title: string
  description?: string
  contentType: 'image' | 'link' | 'json'
  data: string
  metadata?: Record<string, unknown>
}

// ─── Thinking Block ────────────────────────────────────────────────────

function ThinkingBlock({ text, isThinking }: { text: string; isThinking: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Brain className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">{isThinking ? '思考中...' : '已思考'}</span>
        {isThinking && <Loader2 className="h-3 w-3 animate-spin" />}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap mt-2 leading-relaxed italic">{text}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tool Call Card ────────────────────────────────────────────────────

function ToolCallCard({
  toolName,
  toolCallId,
  input,
  result,
  isError,
  isPending,
}: {
  toolName: string
  toolCallId?: string
  input?: unknown
  result?: string
  isError?: boolean
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        )}
        <Wrench className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
        <span className="font-medium text-foreground">{toolName !== 'tool' ? toolName : 'Tool'}</span>
        {toolCallId && <span className="text-muted-foreground/50">{toolCallId}</span>}
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/30 text-xs">
          {input && (
            <div className="px-3 py-2">
              <div className="text-muted-foreground font-medium mb-1">参数</div>
              <pre className="bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div className="px-3 py-2 border-t border-border/20">
              <div className="text-muted-foreground font-medium mb-1">结果</div>
              <pre
                className={`bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto ${isError ? 'text-red-400' : ''}`}
              >
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TaskChat({ taskId, task, onStreamComplete, initialPrompt }: TaskChatProps) {
  const [messages, setMessages] = useState<TaskMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useAtom(taskChatInputAtomFamily(taskId))
  const session = useAtomValue(sessionAtom)
  const [isSending, setIsSending] = useState(false)
  const [isStreamingResponse, setIsStreamingResponse] = useState(false)
  const isStreamingRef = useRef(false) // ref 版本，供 fetchMessages 使用（不触发重建）
  const acpSessionReady = useRef(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isStopping, setIsStopping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(0)
  const previousMessagesHashRef = useRef('')
  const wasAtBottomRef = useRef(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'comments' | 'actions' | 'deployments' | 'cloud'>('chat')
  const [prComments, setPrComments] = useState<PRComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [checkRuns, setCheckRuns] = useState<CheckRun[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [actionsError, setActionsError] = useState<string | null>(null)
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [loadingDeployment, setLoadingDeployment] = useState(false)
  const [deploymentError, setDeploymentError] = useState<string | null>(null)
  const [deploymentNotifications, setDeploymentNotifications] = useState<DeploymentInfo[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [userMessageHeights, setUserMessageHeights] = useState<Record<string, number>>({})
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [overflowingMessages, setOverflowingMessages] = useState<Set<string>>(new Set())
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // AskUserQuestion and ToolConfirm state
  const [askUserQuestion, setAskUserQuestion] = useState<AskUserQuestionData | null>(null)
  const [toolConfirm, setToolConfirm] = useState<ToolConfirmData | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})

  // Track if each tab has been loaded to avoid refetching on tab switch
  const commentsLoadedRef = useRef(false)
  const actionsLoadedRef = useRef(false)

  const isNearBottom = () => {
    const container = scrollContainerRef.current
    if (!container) return true // Default to true if no container

    const threshold = 100 // pixels from bottom
    const position = container.scrollTop + container.clientHeight
    const bottom = container.scrollHeight

    return position >= bottom - threshold
  }

  const scrollToBottom = () => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  const fetchMessages = useCallback(
    async (showLoading = true) => {
      // 流式响应期间不覆盖 optimistic messages（用 ref，不依赖 state 避免重建循环）
      if (isStreamingRef.current) return
      if (showLoading) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}/messages`)
        const data = await response.json()

        // 再次检查：异步请求期间可能已开始流式响应
        if (isStreamingRef.current) return

        if (response.ok && data.messages) {
          setMessages(data.messages)
        } else {
          setError(data.error || 'Failed to fetch messages')
        }
      } catch (err) {
        console.error('Error fetching messages:', err)
        setError('Failed to fetch messages')
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [taskId],
  )

  const fetchPRComments = useCallback(
    async (showLoading = true) => {
      if (!task.prNumber || !task.repoUrl) return

      // Don't refetch if already loaded
      if (commentsLoadedRef.current && showLoading) return

      if (showLoading) {
        setLoadingComments(true)
      }
      setCommentsError(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}/pr-comments`)
        const data = await response.json()

        if (response.ok && data.success) {
          setPrComments(data.comments || [])
          commentsLoadedRef.current = true
        } else {
          setCommentsError(data.error || 'Failed to fetch comments')
        }
      } catch (err) {
        console.error('Error fetching PR comments:', err)
        setCommentsError('Failed to fetch comments')
      } finally {
        if (showLoading) {
          setLoadingComments(false)
        }
      }
    },
    [taskId, task.prNumber, task.repoUrl],
  )

  const fetchCheckRuns = useCallback(
    async (showLoading = true) => {
      if (!task.branchName || !task.repoUrl) return

      // Don't refetch if already loaded
      if (actionsLoadedRef.current && showLoading) return

      if (showLoading) {
        setLoadingActions(true)
      }
      setActionsError(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}/check-runs`)
        const data = await response.json()

        if (response.ok && data.success) {
          setCheckRuns(data.checkRuns || [])
          actionsLoadedRef.current = true
        } else {
          setActionsError(data.error || 'Failed to fetch check runs')
        }
      } catch (err) {
        console.error('Error fetching check runs:', err)
        setActionsError('Failed to fetch check runs')
      } finally {
        if (showLoading) {
          setLoadingActions(false)
        }
      }
    },
    [taskId, task.branchName, task.repoUrl],
  )

  const fetchDeployments = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoadingDeployment(true)
      }
      setDeploymentError(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}/deployments`)
        const data = await response.json()

        if (response.ok) {
          setDeployments(data.deployments || [])
        } else {
          setDeploymentError(data.error || 'Failed to fetch deployments')
        }
      } catch (err) {
        console.error('Error fetching deployments:', err)
        setDeploymentError('Failed to fetch deployments')
      } finally {
        if (showLoading) {
          setLoadingDeployment(false)
        }
      }
    },
    [taskId],
  )

  const handleRefresh = useCallback(() => {
    switch (activeTab) {
      case 'chat':
        fetchMessages(false)
        break
      case 'comments':
        if (task.prNumber) {
          commentsLoadedRef.current = false
          fetchPRComments()
        }
        break
      case 'actions':
        if (task.branchName) {
          actionsLoadedRef.current = false
          fetchCheckRuns()
        }
        break
      case 'deployments':
        fetchDeployments()
        break
    }
  }, [activeTab, task.prNumber, task.branchName, fetchMessages, fetchPRComments, fetchCheckRuns, fetchDeployments])

  useEffect(() => {
    // Load historical messages once on mount (no polling)
    fetchMessages(true)
  }, [fetchMessages])

  // Auto-refresh for active tab (Comments, Checks, Deployments)
  useEffect(() => {
    if (activeTab === 'chat') return // Chat already has its own refresh

    const refreshInterval = 30000 // 30 seconds

    const interval = setInterval(() => {
      switch (activeTab) {
        case 'comments':
          if (task.prNumber) {
            commentsLoadedRef.current = false
            fetchPRComments(false) // Don't show loading on auto-refresh
          }
          break
        case 'actions':
          if (task.branchName) {
            actionsLoadedRef.current = false
            fetchCheckRuns(false) // Don't show loading on auto-refresh
          }
          break
        case 'deployments':
          fetchDeployments(false) // Don't show loading on auto-refresh
          break
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [activeTab, task.prNumber, task.branchName, fetchPRComments, fetchCheckRuns, fetchDeployments])

  // Reset cache and refetch when PR number changes (PR created/updated)
  useEffect(() => {
    if (task.prNumber) {
      commentsLoadedRef.current = false
      if (activeTab === 'comments') {
        fetchPRComments()
      }
    }
  }, [task.prNumber, activeTab, fetchPRComments])

  // Reset cache and refetch when branch name changes (branch created)
  useEffect(() => {
    if (task.branchName) {
      actionsLoadedRef.current = false
      if (activeTab === 'actions') {
        fetchCheckRuns()
      }
    }
  }, [task.branchName, activeTab, fetchCheckRuns])

  // Fetch PR comments when tab switches to comments
  useEffect(() => {
    if (activeTab === 'comments' && task.prNumber) {
      fetchPRComments()
    }
  }, [activeTab, task.prNumber, fetchPRComments])

  // Fetch check runs when tab switches to actions
  useEffect(() => {
    if (activeTab === 'actions' && task.branchName) {
      fetchCheckRuns()
    }
  }, [activeTab, task.branchName, fetchCheckRuns])

  // Fetch deployment when tab switches to deployments
  useEffect(() => {
    if (activeTab === 'deployments') {
      fetchDeployments()
    }
  }, [activeTab, fetchDeployments])

  // Track scroll position to maintain scroll at bottom when content updates
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      wasAtBottomRef.current = isNearBottom()
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate heights for user messages to create proper sticky stacking
  useEffect(() => {
    const displayMessages = messages.slice(-10)
    const userMessages = displayMessages.filter((m) => m.role === 'user')

    if (userMessages.length === 0) return

    const measureHeights = () => {
      const newHeights: Record<string, number> = {}
      const newOverflowing = new Set<string>()

      userMessages.forEach((message) => {
        const el = messageRefs.current[message.id]
        const contentEl = contentRefs.current[message.id]

        if (el) {
          newHeights[message.id] = el.offsetHeight
        }

        // Check if content is overflowing the max-height (72px ~ 4 lines)
        if (contentEl && contentEl.scrollHeight > 72) {
          newOverflowing.add(message.id)
        }
      })

      setUserMessageHeights(newHeights)
      setOverflowingMessages(newOverflowing)
    }

    // Measure after render
    setTimeout(measureHeights, 0)

    // Remeasure on window resize
    window.addEventListener('resize', measureHeights)
    return () => window.removeEventListener('resize', measureHeights)
  }, [messages])

  // Auto-scroll when messages change if user was at bottom
  useEffect(() => {
    const currentMessageCount = messages.length
    const previousMessageCount = previousMessageCountRef.current

    // Create a hash of current messages to detect actual content changes
    const currentHash = messages.map((m) => `${m.id}:${m.content.length}`).join('|')
    const previousHash = previousMessagesHashRef.current

    // Only proceed if content actually changed
    const contentChanged = currentHash !== previousHash

    // Always scroll on initial load
    if (previousMessageCount === 0 && currentMessageCount > 0) {
      setTimeout(() => scrollToBottom(), 0)
      wasAtBottomRef.current = true
      previousMessageCountRef.current = currentMessageCount
      previousMessagesHashRef.current = currentHash
      return
    }

    // Only scroll if content changed AND user was at bottom
    if (contentChanged && wasAtBottomRef.current) {
      // Use setTimeout to ensure DOM has updated with new content
      setTimeout(() => {
        if (wasAtBottomRef.current) {
          scrollToBottom()
        }
      }, 50)
    }

    previousMessageCountRef.current = currentMessageCount
    previousMessagesHashRef.current = currentHash
  }, [messages])

  // Timer for duration display
  useEffect(() => {
    if (task.status === 'processing' || task.status === 'pending') {
      const interval = setInterval(() => {
        setCurrentTime(Date.now())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [task.status])

  const formatDuration = (messageCreatedAt: Date | number) => {
    const startTime = new Date(messageCreatedAt).getTime()

    // Find the next agent message after this user message
    const messageIndex = messages.findIndex((m) => new Date(m.createdAt).getTime() === startTime)
    const nextAgentMessage = messages.slice(messageIndex + 1).find((m) => m.role === 'agent')

    const endTime = nextAgentMessage
      ? new Date(nextAgentMessage.createdAt).getTime()
      : task.completedAt
        ? new Date(task.completedAt).getTime()
        : currentTime

    const durationMs = Math.max(0, endTime - startTime) // Ensure non-negative
    const durationSeconds = Math.floor(durationMs / 1000)

    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Ensure ACP session is ready
  const ensureACPSession = useCallback(async () => {
    if (acpSessionReady.current) return true
    try {
      // Initialize ACP
      await fetch('/api/agent/acp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: { protocolVersion: 1 } }),
      })
      // Create or load session (taskId = sessionId)
      const loadRes = await fetch('/api/agent/acp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'session/load', id: 2, params: { sessionId: taskId } }),
      })
      const loadText = await loadRes.text()
      if (loadText.includes('error')) {
        // Session doesn't exist, create new one
        await fetch('/api/agent/acp', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'session/new', id: 3, params: { conversationId: taskId } }),
        })
      }
      acpSessionReady.current = true
      return true
    } catch (err) {
      console.error('Failed to init ACP session:', err)
      return false
    }
  }, [taskId])

  // 从 URL 参数携带的初始 prompt 触发 ACP 请求
  const initialTriggered = useRef(false)
  useEffect(() => {
    if (!initialPrompt || initialTriggered.current) return
    initialTriggered.current = true
    // 首页已完成 initialize + session/new，直接标记 ready
    acpSessionReady.current = true

    const userMsg: TaskMessage = {
      id: `user-${Date.now()}`,
      taskId,
      role: 'user',
      content: initialPrompt,
      parts: [{ type: 'text', text: initialPrompt }],
      createdAt: Date.now(),
    }
    const assistantMsgId = `stream-${Date.now()}`
    const agentMsg: TaskMessage = {
      id: assistantMsgId,
      taskId,
      role: 'agent',
      content: '',
      parts: [],
      createdAt: Date.now(),
    }

    setMessages([userMsg, agentMsg])
    isStreamingRef.current = true
    setIsSending(true)
    setIsStreamingResponse(true)
    ;(async () => {
      try {
        // 首页已完成 initialize + session/new，直接发 session/prompt
        const res = await fetch('/api/agent/acp', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'session/prompt',
            id: Date.now(),
            params: { sessionId: taskId, prompt: [{ type: 'text', text: initialPrompt }] },
          }),
        })
        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
          const errMsg = errData.error?.message || 'Agent request failed'
          setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errMsg}` } : m)))
          toast.error(errMsg)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.trim() === 'data: [DONE]') continue
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))
              if (event.error) {
                const errMsg = event.error.message || 'Agent error'
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errMsg}` } : m)),
                )
                toast.error(errMsg)
                continue
              }
              if (event.method === 'session/update') {
                const update = event.params.update
                if (update.sessionUpdate === 'agent_message_chunk') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantMsgId) return m
                      const newText = (update as any).content?.text || ''
                      const prevParts = m.parts || []
                      const lastPart = prevParts[prevParts.length - 1]
                      const newParts =
                        lastPart?.type === 'text'
                          ? [...prevParts.slice(0, -1), { ...lastPart, text: lastPart.text + newText }]
                          : [...prevParts, { type: 'text' as const, text: newText }]
                      return { ...m, content: (m.content || '') + newText, parts: newParts }
                    }),
                  )
                  if (wasAtBottomRef.current) requestAnimationFrame(scrollToBottom)
                } else if (update.sessionUpdate === 'agent_thought_chunk') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantMsgId) return m
                      const prevParts = m.parts || []
                      const lastPart = prevParts[prevParts.length - 1]
                      // 追加到最后一个 thinking part（流式拼接），否则新建
                      if (lastPart?.type === 'thinking') {
                        return {
                          ...m,
                          parts: [
                            ...prevParts.slice(0, -1),
                            { ...lastPart, text: lastPart.text + ((update as any).content || '') },
                          ],
                        }
                      }
                      return {
                        ...m,
                        parts: [...prevParts, { type: 'thinking' as const, text: (update as any).content || '' }],
                      }
                    }),
                  )
                } else if (update.sessionUpdate === 'tool_call') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantMsgId) return m
                      const prevParts = m.parts || []
                      const existingIdx = prevParts.findIndex(
                        (p) => p.type === 'tool_call' && p.toolCallId === (update as any).toolCallId,
                      )
                      const newPart = {
                        type: 'tool_call' as const,
                        toolCallId: (update as any).toolCallId || '',
                        toolName: (update as any).title || 'tool',
                        input: (update as any).input,
                      }
                      if (existingIdx >= 0) {
                        // 更新已有的 tool_call（补充 input 等字段）
                        const updated = [...prevParts]
                        updated[existingIdx] = newPart
                        return { ...m, parts: updated }
                      }
                      return { ...m, parts: [...prevParts, newPart] }
                    }),
                  )
                } else if (update.sessionUpdate === 'tool_call_update') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantMsgId) return m
                      const prevParts = m.parts || []
                      const alreadyHasResult = prevParts.some(
                        (p) => p.type === 'tool_result' && p.toolCallId === (update as any).toolCallId,
                      )
                      if (!alreadyHasResult) {
                        const toolCallPart = prevParts.find(
                          (p) => p.type === 'tool_call' && p.toolCallId === (update as any).toolCallId,
                        )
                        return {
                          ...m,
                          parts: [
                            ...prevParts,
                            {
                              type: 'tool_result' as const,
                              toolCallId: (update as any).toolCallId || '',
                              toolName: toolCallPart?.type === 'tool_call' ? toolCallPart.toolName : undefined,
                              content: String((update as any).result || ''),
                              isError: (update as any).status === 'failed',
                            },
                          ],
                        }
                      }
                      return m
                    }),
                  )
                } else if (update.sessionUpdate === 'ask_user') {
                  setAskUserQuestion({
                    toolCallId: (update as any).toolCallId,
                    assistantMessageId: (update as any).assistantMessageId,
                    questions: (update as any).questions || [],
                  })
                } else if (update.sessionUpdate === 'tool_confirm') {
                  setToolConfirm({
                    toolCallId: (update as any).toolCallId,
                    assistantMessageId: (update as any).assistantMessageId,
                    toolName: (update as any).toolName,
                    input: (update as any).input || {},
                  })
                } else if (update.sessionUpdate === 'deploy_url') {
                  // Add deployment notification and refresh list
                  const deployUpdate = update as any
                  if (deployUpdate.url) {
                    setDeploymentNotifications((prev) => {
                      // Avoid duplicates by URL
                      if (prev.some((d) => d.url === deployUpdate.url)) return prev
                      return [
                        ...prev,
                        {
                          id: `notify-${Date.now()}`,
                          taskId: taskId,
                          type: deployUpdate.type || 'web',
                          url: deployUpdate.url,
                          path: null,
                          qrCodeUrl: deployUpdate.qrCodeUrl || null,
                          pagePath: deployUpdate.pagePath || null,
                          appId: deployUpdate.appId || null,
                          label: deployUpdate.label || null,
                          metadata: null,
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                        },
                      ]
                    })
                  }
                  fetchDeployments(false)
                } else if (update.sessionUpdate === 'artifact' && (update as any).artifact) {
                  setArtifacts((prev) => [...prev, (update as any).artifact])
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error('Initial ACP trigger failed:', err)
      } finally {
        isStreamingRef.current = false
        setIsSending(false)
        setIsStreamingResponse(false)
        onStreamComplete?.()
      }
    })()
  }, [initialPrompt, taskId, ensureACPSession])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    const messageToSend = newMessage.trim()
    setNewMessage('')

    // Add user message optimistically
    const userMsg: TaskMessage = {
      id: `local-${Date.now()}`,
      taskId,
      role: 'user',
      content: messageToSend,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      // Ensure ACP session is ready
      const ready = await ensureACPSession()
      if (!ready) {
        // Fallback to REST API
        const response = await fetch(`/api/tasks/${taskId}/continue`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: messageToSend }),
        })
        if (!response.ok) {
          const data = await response.json()
          toast.error(data.error || 'Failed to send message')
          setNewMessage(messageToSend)
        } else {
          await fetchMessages(false)
        }
        return
      }

      // Add placeholder assistant message
      const assistantMsgId = `stream-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, taskId, role: 'agent', content: '', parts: [], createdAt: Date.now() },
      ])
      isStreamingRef.current = true
      setIsStreamingResponse(true)

      // Send via ACP session/prompt (SSE stream)
      const res = await fetch('/api/agent/acp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'session/prompt',
          id: Date.now(),
          params: {
            sessionId: taskId,
            prompt: [{ type: 'text', text: messageToSend }],
          },
        }),
      })

      // Check for non-SSE error response
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
        const errMsg = errData.error?.message || 'Agent request failed'
        setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errMsg}` } : m)))
        toast.error(errMsg)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue
          try {
            const event = JSON.parse(line.slice(6))
            // Check for JSON-RPC error response
            if (event.error) {
              const errMsg = event.error.message || 'Agent error'
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errMsg}` } : m)),
              )
              toast.error(errMsg)
              continue
            }
            if (event.method === 'session/update') {
              const update: ExtendedSessionUpdate = event.params.update
              console.log('[ACP follow-up] update:', update.sessionUpdate)
              if (update.sessionUpdate === 'agent_message_chunk') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    const newText = (update as any).content?.text || ''
                    const prevParts = m.parts || []
                    const lastPart = prevParts[prevParts.length - 1]
                    const newParts =
                      lastPart?.type === 'text'
                        ? [...prevParts.slice(0, -1), { ...lastPart, text: lastPart.text + newText }]
                        : [...prevParts, { type: 'text' as const, text: newText }]
                    return { ...m, content: (m.content || '') + newText, parts: newParts }
                  }),
                )
                if (wasAtBottomRef.current) requestAnimationFrame(scrollToBottom)
              } else if (update.sessionUpdate === 'agent_thought_chunk') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    const prevParts = m.parts || []
                    const lastPart = prevParts[prevParts.length - 1]
                    if (lastPart?.type === 'thinking') {
                      return {
                        ...m,
                        parts: [
                          ...prevParts.slice(0, -1),
                          { ...lastPart, text: lastPart.text + ((update as any).content || '') },
                        ],
                      }
                    }
                    return {
                      ...m,
                      parts: [...prevParts, { type: 'thinking' as const, text: (update as any).content || '' }],
                    }
                  }),
                )
              } else if (update.sessionUpdate === 'tool_call') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    const prevParts = m.parts || []
                    const existingIdx = prevParts.findIndex(
                      (p) => p.type === 'tool_call' && p.toolCallId === (update as any).toolCallId,
                    )
                    const newPart = {
                      type: 'tool_call' as const,
                      toolCallId: (update as any).toolCallId || '',
                      toolName: (update as any).title || 'tool',
                      input: (update as any).input,
                    }
                    if (existingIdx >= 0) {
                      const updated = [...prevParts]
                      updated[existingIdx] = newPart
                      return { ...m, parts: updated }
                    }
                    return { ...m, parts: [...prevParts, newPart] }
                  }),
                )
              } else if (update.sessionUpdate === 'tool_call_update') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    const prevParts = m.parts || []
                    const alreadyHasResult = prevParts.some(
                      (p) => p.type === 'tool_result' && p.toolCallId === (update as any).toolCallId,
                    )
                    if (!alreadyHasResult) {
                      const toolCallPart = prevParts.find(
                        (p) => p.type === 'tool_call' && p.toolCallId === (update as any).toolCallId,
                      )
                      return {
                        ...m,
                        parts: [
                          ...prevParts,
                          {
                            type: 'tool_result' as const,
                            toolCallId: (update as any).toolCallId || '',
                            toolName: toolCallPart?.type === 'tool_call' ? toolCallPart.toolName : undefined,
                            content: String((update as any).result || ''),
                            isError: (update as any).status === 'failed',
                          },
                        ],
                      }
                    }
                    return m
                  }),
                )
              } else if (update.sessionUpdate === 'ask_user') {
                setAskUserQuestion({
                  toolCallId: (update as any).toolCallId,
                  assistantMessageId: (update as any).assistantMessageId,
                  questions: (update as any).questions || [],
                })
              } else if (update.sessionUpdate === 'tool_confirm') {
                setToolConfirm({
                  toolCallId: (update as any).toolCallId,
                  assistantMessageId: (update as any).assistantMessageId,
                  toolName: (update as any).toolName,
                  input: (update as any).input || {},
                })
              } else if (update.sessionUpdate === 'deploy_url') {
                const deployUpdate = update as any
                if (deployUpdate.url) {
                  setDeploymentNotifications((prev) => {
                    // Avoid duplicates by URL
                    if (prev.some((d) => d.url === deployUpdate.url)) return prev
                    return [
                      ...prev,
                      {
                        id: `notify-${Date.now()}`,
                        taskId: taskId,
                        type: deployUpdate.type || 'web',
                        url: deployUpdate.url,
                        path: null,
                        qrCodeUrl: deployUpdate.qrCodeUrl || null,
                        pagePath: deployUpdate.pagePath || null,
                        appId: deployUpdate.appId || null,
                        label: deployUpdate.label || null,
                        metadata: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      },
                    ]
                  })
                }
              } else if (update.sessionUpdate === 'artifact' && (update as any).artifact) {
                setArtifacts((prev) => [...prev, (update as any).artifact])
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Refresh from server to get persisted messages
      await fetchMessages(false)
    } catch (err) {
      console.error('Error sending message:', err)
      toast.error('Failed to send message')
      setNewMessage(messageToSend)
    } finally {
      isStreamingRef.current = false
      setIsSending(false)
      setIsStreamingResponse(false)
      onStreamComplete?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
      toast.error('Failed to copy message')
    }
  }

  const handleRetryMessage = async (content: string) => {
    if (isSending) return

    setIsSending(true)

    try {
      const response = await fetch(`/api/tasks/${taskId}/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Refresh messages to show the new user message without loading state
        await fetchMessages(false)
      } else {
        toast.error(data.error || 'Failed to resend message')
      }
    } catch (err) {
      console.error('Error resending message:', err)
      toast.error('Failed to resend message')
    } finally {
      setIsSending(false)
    }
  }

  const handleStopTask = async () => {
    setIsStopping(true)

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      })

      if (response.ok) {
        toast.success('Task stopped successfully!')
        // Task will update through polling
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      toast.error('Failed to stop task')
    } finally {
      setIsStopping(false)
    }
  }

  // Process stream response
  const processStreamResponse = useCallback(async (res: Response) => {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.method === 'session/update') {
            const update: ExtendedSessionUpdate = event.params.update
            if (update.sessionUpdate === 'ask_user') {
              setAskUserQuestion({
                toolCallId: (update as any).toolCallId,
                assistantMessageId: (update as any).assistantMessageId,
                questions: (update as any).questions || [],
              })
            } else if (update.sessionUpdate === 'tool_confirm') {
              setToolConfirm({
                toolCallId: (update as any).toolCallId,
                assistantMessageId: (update as any).assistantMessageId,
                toolName: (update as any).toolName,
                input: (update as any).input || {},
              })
            } else if (update.sessionUpdate === 'deploy_url' && (update as any).url) {
              setDeployment({ hasDeployment: true, previewUrl: (update as any).url })
            } else if (update.sessionUpdate === 'artifact' && (update as any).artifact) {
              setArtifacts((prev) => [...prev, (update as any).artifact])
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }, [])

  // Answer AskUserQuestion
  const handleAnswerQuestion = useCallback(async () => {
    if (!askUserQuestion) return

    // Collect answers from state
    const answers: Record<string, string> = {}
    for (const question of askUserQuestion.questions) {
      const header = question.header
      // Use manual input if provided, otherwise use selected answer
      if (manualInputs[header]) {
        answers[header] = manualInputs[header]
      } else if (questionAnswers[header]) {
        answers[header] = questionAnswers[header]
      }
    }

    setAskUserQuestion(null)
    setQuestionAnswers({})
    setManualInputs({})
    setIsSending(true)
    setIsStreamingResponse(true)

    try {
      const res = await fetch('/api/agent/acp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'session/prompt',
          id: Date.now(),
          params: {
            sessionId: taskId,
            prompt: [{ type: 'text', text: '' }],
            askAnswers: {
              [askUserQuestion.assistantMessageId]: {
                toolCallId: askUserQuestion.toolCallId,
                answers,
              },
            },
          },
        }),
      })

      await processStreamResponse(res)
    } catch (err) {
      console.error('Error answering question:', err)
      toast.error('Failed to submit answer')
    } finally {
      isStreamingRef.current = false
      setIsSending(false)
      setIsStreamingResponse(false)
    }
  }, [askUserQuestion, questionAnswers, manualInputs, taskId, processStreamResponse])

  // Confirm/Deny tool call
  const handleConfirmTool = useCallback(
    async (action: 'allow' | 'deny') => {
      if (!toolConfirm) return

      setToolConfirm(null)
      setIsSending(true)
      setIsStreamingResponse(true)

      try {
        const res = await fetch('/api/agent/acp', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'session/prompt',
            id: Date.now(),
            params: {
              sessionId: taskId,
              prompt: [{ type: 'text', text: '' }],
              toolConfirmation: {
                interruptId: toolConfirm.toolCallId,
                payload: { action },
              },
            },
          }),
        })

        await processStreamResponse(res)
      } catch (err) {
        console.error('Error confirming tool:', err)
        toast.error('Failed to confirm tool')
      } finally {
        isStreamingRef.current = false
        setIsSending(false)
        setIsStreamingResponse(false)
      }
    },
    [toolConfirm, taskId, processStreamResponse],
  )

  const parseAgentMessage = (message: TaskMessage): string => {
    // 优先从 parts 提取文本
    if (message.parts && message.parts.length > 0) {
      return message.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('')
    }
    // 兼容旧的纯文本 content
    const content = message.content || ''
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && 'result' in parsed && typeof parsed.result === 'string') {
        return parsed.result
      }
      return content
    } catch {
      return content
    }
  }

  const handleSendCommentAsFollowUp = (comment: PRComment) => {
    // Format the message to indicate it came from a PR comment
    const formattedMessage = `**PR Comment from @${comment.user.login}:**\n\n${comment.body}\n\n---\n\nPlease address the above PR comment and make the necessary changes to ensure the feedback is accurately addressed.`

    // Set the message in the chat input
    setNewMessage(formattedMessage)

    // Switch to chat tab
    setActiveTab('chat')

    // Show success toast
    toast.success('Comment added to chat input')
  }

  // Use a non-narrowed variable for tab button comparisons
  const currentTab = activeTab as string

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-2 text-xs md:text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // Render tab content
  const renderTabContent = () => {
    if (activeTab === 'cloud') {
      return (
        <div className="flex-1 overflow-hidden -mx-3 -mt-3">
          <CloudDashboard envId={session.envId} style={{ height: '100%' }} />
        </div>
      )
    }

    if (activeTab === 'deployments') {
      const handleDeleteDeployment = async (deploymentId: string) => {
        try {
          const response = await fetch(`/api/tasks/${taskId}/deployments/${deploymentId}`, {
            method: 'DELETE',
          })
          if (response.ok) {
            setDeployments((prev) => prev.filter((d) => d.id !== deploymentId))
          }
        } catch (err) {
          console.error('Error deleting deployment:', err)
        }
      }

      return (
        <div className="flex-1 overflow-y-auto pb-4">
          {loadingDeployment ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deploymentError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-destructive mb-2 text-xs md:text-sm">{deploymentError}</p>
              </div>
            </div>
          ) : deployments.length === 0 && artifacts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
              <div className="text-sm md:text-base">暂无部署结果</div>
            </div>
          ) : (
            <div className="space-y-2 px-2 pt-2">
              {/* Web deployments */}
              {deployments
                .filter((d) => d.type === 'web' && d.url)
                .map((deployment) => (
                  <div key={deployment.id} className="flex items-center gap-2 group">
                    <a
                      href={deployment.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors border border-border flex-1"
                    >
                      <svg
                        className="w-5 h-5 flex-shrink-0 text-blue-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{deployment.label || 'Web Preview'}</div>
                        <div className="text-xs text-muted-foreground truncate">{deployment.url}</div>
                        <div className="text-xs text-muted-foreground">
                          {`部署于 ${new Date(deployment.createdAt).toLocaleString()}`}
                        </div>
                      </div>
                    </a>
                    <button
                      onClick={() => handleDeleteDeployment(deployment.id)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

              {/* Miniprogram deployments */}
              {deployments
                .filter((d) => d.type === 'miniprogram' && d.qrCodeUrl)
                .map((deployment) => (
                  <div key={deployment.id} className="flex items-center gap-2 group">
                    <div className="flex items-center gap-3 p-2 rounded-md border border-border flex-1">
                      <img src={deployment.qrCodeUrl!} alt="QR Code" className="w-16 h-16 rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{deployment.label || '小程序'}</div>
                        {deployment.pagePath && (
                          <div className="text-xs text-muted-foreground">Page: {deployment.pagePath}</div>
                        )}
                        {deployment.appId && (
                          <div className="text-xs text-muted-foreground">AppID: {deployment.appId}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {`部署于 ${new Date(deployment.createdAt).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDeployment(deployment.id)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

              {/* Artifacts（小程序二维码、上传结果等） */}
              {artifacts.map((artifact, idx) => (
                <div key={idx} className="border border-border rounded-md p-3 space-y-2">
                  <div className="text-xs font-medium">{artifact.title}</div>
                  {artifact.description && <div className="text-xs text-muted-foreground">{artifact.description}</div>}
                  {artifact.contentType === 'image' && (
                    <img src={artifact.data} alt={artifact.title} className="max-w-[200px] mx-auto block rounded" />
                  )}
                  {artifact.contentType === 'link' && (
                    <a
                      href={artifact.data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline break-all"
                    >
                      {artifact.data}
                    </a>
                  )}
                  {artifact.contentType === 'json' && (
                    <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(artifact.data), null, 2)
                        } catch {
                          return artifact.data
                        }
                      })()}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'actions') {
      const getStatusIcon = (status: string, conclusion: string | null) => {
        if (status === 'completed') {
          if (conclusion === 'success') {
            return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          } else if (conclusion === 'failure') {
            return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          } else if (conclusion === 'cancelled') {
            return <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          }
        } else if (status === 'in_progress') {
          return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
        }
        return <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      }

      return (
        <div className="flex-1 overflow-y-auto pb-4">
          {!task.branchName ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
              <div className="text-sm md:text-base">
                No branch yet. GitHub Checks will appear here once a branch is created.
              </div>
            </div>
          ) : loadingActions ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : actionsError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-destructive mb-2 text-xs md:text-sm">{actionsError}</p>
              </div>
            </div>
          ) : checkRuns.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <div className="text-sm md:text-base">No checks running</div>
            </div>
          ) : (
            <div className="space-y-2 px-2">
              {checkRuns.map((check) => (
                <a
                  key={check.id}
                  href={check.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {getStatusIcon(check.status, check.conclusion)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{check.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {check.status === 'completed' && check.completed_at
                        ? `Completed ${new Date(check.completed_at).toLocaleString()}`
                        : check.status === 'in_progress'
                          ? 'In progress...'
                          : 'Queued'}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'comments') {
      return (
        <div className="flex-1 overflow-y-auto pb-4">
          {!task.prNumber ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
              <div className="text-sm md:text-base">No pull request yet. Create a PR to see comments here.</div>
            </div>
          ) : loadingComments ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : commentsError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-destructive mb-2 text-xs md:text-sm">{commentsError}</p>
              </div>
            </div>
          ) : prComments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <div className="text-sm md:text-base">No comments yet</div>
            </div>
          ) : (
            <div className="space-y-4">
              {prComments.map((comment) => (
                <div key={comment.id} className="px-2">
                  <div className="flex items-start gap-2 mb-2">
                    <img
                      src={comment.user.avatar_url}
                      alt={comment.user.login}
                      className="w-6 h-6 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{comment.user.login}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-foreground">
                        <Streamdown
                          components={{
                            code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) => (
                              <code className={`${className} !text-xs`} {...props}>
                                {children}
                              </code>
                            ),
                            pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
                              <pre className="!text-xs" {...props}>
                                {children}
                              </pre>
                            ),
                            p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
                              <p className="text-xs" {...props}>
                                {children}
                              </p>
                            ),
                            a: ({ children, href, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                {...props}
                              >
                                {children}
                              </a>
                            ),
                            ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
                              <ul className="text-xs list-disc ml-4" {...props}>
                                {children}
                              </ul>
                            ),
                            ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
                              <ol className="text-xs list-decimal ml-4" {...props}>
                                {children}
                              </ol>
                            ),
                            li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
                              <li className="text-xs mb-2" {...props}>
                                {Children.toArray(children).filter((c) => typeof c === 'string' || isValidElement(c))}
                              </li>
                            ),
                          }}
                        >
                          {comment.body}
                        </Streamdown>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleSendCommentAsFollowUp(comment)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send as Follow-Up
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Chat tab (default)
    // 确保始终有 user 消息用于分组渲染
    if (messages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
          <div className="text-sm md:text-base">No messages yet</div>
        </div>
      )
    }

    const displayMessages = messages.slice(-10)
    const hiddenMessagesCount = messages.length - displayMessages.length

    // Group messages by user message boundaries and calculate min-heights
    const messageGroups: { userMessage: TaskMessage; agentMessages: TaskMessage[]; minHeight: number }[] = []

    displayMessages.forEach((message) => {
      if (message.role === 'user') {
        messageGroups.push({ userMessage: message, agentMessages: [], minHeight: 0 })
      } else if (messageGroups.length > 0) {
        messageGroups[messageGroups.length - 1].agentMessages.push(message)
      }
    })

    // Calculate min-height for each group based on subsequent user messages
    messageGroups.forEach((group, groupIndex) => {
      let minHeight = 0
      for (let i = groupIndex + 1; i < messageGroups.length; i++) {
        const height = userMessageHeights[messageGroups[i].userMessage.id]
        if (height !== undefined) {
          minHeight += height + 16 // 16px for mt-4 margin
        }
      }
      group.minHeight = minHeight
    })

    return (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
        {hiddenMessagesCount > 0 && (
          <div className="text-xs text-center text-muted-foreground opacity-50 mb-4 italic">
            {hiddenMessagesCount} older message{hiddenMessagesCount !== 1 ? 's' : ''} hidden
          </div>
        )}
        {messageGroups.map((group, groupIndex) => {
          return (
            <div
              key={group.userMessage.id}
              className="flex flex-col"
              style={group.minHeight > 0 ? { minHeight: `${group.minHeight}px` } : undefined}
            >
              <div
                ref={(el) => {
                  messageRefs.current[group.userMessage.id] = el
                }}
                className={`${groupIndex > 0 ? 'mt-4' : ''} sticky top-0 z-10 before:content-[""] before:absolute before:inset-0 before:bg-background before:-z-10`}
              >
                <Card className="px-2 py-2 bg-card rounded-md relative z-10 gap-0.5">
                  <div
                    ref={(el) => {
                      contentRefs.current[group.userMessage.id] = el
                    }}
                    className="relative max-h-[72px] overflow-hidden"
                  >
                    <div className="text-xs">
                      <Streamdown
                        components={{
                          code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) => (
                            <code className={`${className} !text-xs`} {...props}>
                              {children}
                            </code>
                          ),
                          pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
                            <pre className="!text-xs" {...props}>
                              {children}
                            </pre>
                          ),
                          p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
                            <p className="text-xs" {...props}>
                              {children}
                            </p>
                          ),
                          ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
                            <ul className="text-xs list-disc ml-4" {...props}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
                            <ol className="text-xs list-decimal ml-4" {...props}>
                              {children}
                            </ol>
                          ),
                          li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
                            <li className="text-xs mb-2" {...props}>
                              {Children.toArray(children).filter((c) => typeof c === 'string' || isValidElement(c))}
                            </li>
                          ),
                        }}
                      >
                        {group.userMessage.content}
                      </Streamdown>
                    </div>
                    {overflowingMessages.has(group.userMessage.id) && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      onClick={() => handleRetryMessage(group.userMessage.content)}
                      disabled={isSending}
                      className="h-3.5 w-3.5 opacity-30 hover:opacity-70 flex items-center justify-center disabled:opacity-20"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleCopyMessage(group.userMessage.id, group.userMessage.content)}
                      className="h-3.5 w-3.5 opacity-30 hover:opacity-70 flex items-center justify-center"
                    >
                      {copiedMessageId === group.userMessage.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </Card>
              </div>

              {/* Render agent messages in this group */}
              {group.agentMessages.map((agentMessage) => (
                <div key={agentMessage.id} className="mt-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground px-2">
                      {!agentMessage.content.trim() && (task.status === 'processing' || task.status === 'pending')
                        ? (() => {
                            return (
                              <div className="opacity-50">
                                <div className="italic">Generating response...</div>
                                <div className="text-right font-mono opacity-70 mt-1">
                                  {formatDuration(group.userMessage.createdAt)}
                                </div>
                              </div>
                            )
                          })()
                        : (() => {
                            // Determine if this is the last agent message
                            const allAgentMessages = displayMessages.filter((m) => m.role === 'agent')
                            const isLastAgentMessage =
                              allAgentMessages.length > 0 &&
                              allAgentMessages[allAgentMessages.length - 1].id === agentMessage.id

                            return (
                              <div className="space-y-2">
                                {/* Render all parts in order: thinking, tool_call, text */}
                                {agentMessage.parts &&
                                  agentMessage.parts.map((part, pi) => {
                                    if (part.type === 'thinking' && part.text) {
                                      const hasMoreThinking = agentMessage.parts
                                        ?.slice(pi + 1)
                                        .some((p) => p.type === 'thinking')
                                      const isThinking =
                                        isStreamingResponse &&
                                        (hasMoreThinking || pi === (agentMessage.parts?.length || 0) - 1)
                                      return (
                                        <ThinkingBlock
                                          key={`thinking-${pi}`}
                                          text={part.text}
                                          isThinking={isThinking}
                                        />
                                      )
                                    }
                                    if (part.type === 'tool_call') {
                                      const resultPart = agentMessage.parts?.find(
                                        (p) => p.type === 'tool_result' && p.toolCallId === part.toolCallId,
                                      )
                                      const isPending = !resultPart
                                      return (
                                        <ToolCallCard
                                          key={`tool-${pi}`}
                                          toolName={part.toolName || 'tool'}
                                          toolCallId={part.toolCallId}
                                          input={part.input}
                                          result={resultPart?.type === 'tool_result' ? resultPart.content : undefined}
                                          isError={resultPart?.type === 'tool_result' ? resultPart.isError : false}
                                          isPending={isPending}
                                        />
                                      )
                                    }
                                    if (part.type === 'text' && part.text) {
                                      return (
                                        <Streamdown
                                          key={`text-${pi}`}
                                          components={{
                                            code: ({
                                              className,
                                              children,
                                              ...props
                                            }: React.ComponentPropsWithoutRef<'code'>) => (
                                              <code className={`${className} !text-xs`} {...props}>
                                                {children}
                                              </code>
                                            ),
                                            pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
                                              <pre className="!text-xs" {...props}>
                                                {children}
                                              </pre>
                                            ),
                                            p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
                                              <p {...props}>{children}</p>
                                            ),
                                            ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
                                              <ul className="text-xs list-disc ml-4" {...props}>
                                                {children}
                                              </ul>
                                            ),
                                            ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
                                              <ol className="text-xs list-decimal ml-4" {...props}>
                                                {children}
                                              </ol>
                                            ),
                                            li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
                                              <li className="text-xs mb-2" {...props}>
                                                {Children.toArray(children).filter(
                                                  (ch) => typeof ch === 'string' || isValidElement(ch),
                                                )}
                                              </li>
                                            ),
                                          }}
                                        >
                                          {part.text}
                                        </Streamdown>
                                      )
                                    }
                                    return null
                                  })}
                              </div>
                            )
                          })()}
                    </div>
                    <div className="flex items-center gap-0.5 justify-end">
                      {/* Show copy button only when task is complete */}
                      {task.status !== 'processing' && task.status !== 'pending' && (
                        <button
                          onClick={() => handleCopyMessage(agentMessage.id, parseAgentMessage(agentMessage))}
                          className="h-3.5 w-3.5 opacity-30 hover:opacity-70 flex items-center justify-center"
                        >
                          {copiedMessageId === agentMessage.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {/* Show deployment notifications in chat */}
        {deploymentNotifications.length > 0 && (
          <div className="mt-4 px-2">
            <div className="space-y-2">
              {deploymentNotifications.map((deployment, idx) => (
                <button
                  key={deployment.id}
                  onClick={() => {
                    setActiveTab('deployments')
                    setDeploymentNotifications((prev) => prev.filter((_, i) => i !== idx))
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors border border-border bg-muted/30 text-left"
                >
                  {deployment.type === 'web' ? (
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-green-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-purple-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium flex items-center gap-1">
                      <span className="text-green-600">Deployment Ready</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {deployment.type === 'web' ? 'Web' : 'Mini Program'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {deployment.type === 'web' ? deployment.url : deployment.pagePath || 'View QR Code'}
                    </div>
                  </div>
                  <span className="text-xs text-blue-500 flex-shrink-0">View →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show sandbox setup progress or "Awaiting response..." if task is processing and latest message is from user without response */}
        {(task.status === 'processing' || task.status === 'pending') &&
          displayMessages.length > 0 &&
          (() => {
            const lastMessage = displayMessages[displayMessages.length - 1]
            // Show placeholder if last message is a user message (no agent response yet)
            if (lastMessage.role === 'user') {
              // Check if this is the first user message (sandbox initialization)
              const userMessages = displayMessages.filter((m) => m.role === 'user')
              const isFirstMessage = userMessages.length === 1

              // Get the latest logs to show progress (filter out server logs)
              const setupLogs = (task.logs || []).filter((log) => !log.message.startsWith('[SERVER]')).slice(-8) // Show last 8 logs

              // If first message and we have logs, show sandbox setup progress
              if (isFirstMessage && setupLogs.length > 0) {
                return (
                  <div className="mt-4">
                    <div className="text-xs px-2">
                      <div className="space-y-1">
                        <div className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Setting up sandbox...
                        </div>
                        <div className="space-y-0.5 pl-5">
                          {setupLogs.map((log, idx) => {
                            const isLatest = idx === setupLogs.length - 1
                            return (
                              <div
                                key={idx}
                                className={`truncate ${
                                  isLatest
                                    ? 'text-foreground'
                                    : log.type === 'error'
                                      ? 'text-red-500/60'
                                      : log.type === 'success'
                                        ? 'text-green-500/60'
                                        : 'text-muted-foreground/60'
                                }`}
                              >
                                {log.message}
                              </div>
                            )
                          })}
                        </div>
                        <div className="text-right font-mono text-muted-foreground/50 mt-2">
                          {formatDuration(lastMessage.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              // Otherwise show simple awaiting response
              return (
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground px-2">
                    <div className="opacity-50">
                      <div className="italic flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Awaiting response...
                      </div>
                      <div className="text-right font-mono opacity-70 mt-1">
                        {formatDuration(lastMessage.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Tabs */}
      <div className="py-2 px-3 flex items-center justify-between gap-1 flex-shrink-0 h-[46px] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`text-sm font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              currentTab === 'chat' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chat
          </button>
          {/* <button
            onClick={() => setActiveTab('comments')}
            className={`text-sm font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              currentTab === 'comments' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`text-sm font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              currentTab === 'actions' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Checks
          </button> */}
          <button
            onClick={() => setActiveTab('deployments')}
            className={`text-sm font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              currentTab === 'deployments' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Deployments
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`text-sm font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              currentTab === 'cloud' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cloud
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-6 w-6 p-0 flex-shrink-0" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 px-3 pt-3 flex flex-col overflow-hidden">{renderTabContent()}</div>

      {/* AskUserQuestion Dialog */}
      {activeTab === 'chat' && askUserQuestion && (
        <div className="flex-shrink-0 px-3 pb-2">
          <Card className="p-3 border-primary/50 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Agent需要您的输入</span>
            </div>
            <div className="space-y-3">
              {askUserQuestion.questions.map((question, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {question.header}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{question.question}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {question.options.map((option, optIdx) => (
                      <Button
                        key={optIdx}
                        variant={questionAnswers[question.header] === option.label ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setQuestionAnswers((prev) => ({
                            ...prev,
                            [question.header]: option.label,
                          }))
                          setManualInputs((prev) => {
                            const next = { ...prev }
                            delete next[question.header]
                            return next
                          })
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {question.options.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">或手动输入:</span>
                      <Input
                        className="h-7 text-xs flex-1"
                        placeholder="输入自定义值..."
                        value={manualInputs[question.header] || ''}
                        onChange={(e) => {
                          setManualInputs((prev) => ({
                            ...prev,
                            [question.header]: e.target.value,
                          }))
                          setQuestionAnswers((prev) => {
                            const next = { ...prev }
                            delete next[question.header]
                            return next
                          })
                        }}
                      />
                    </div>
                  )}
                  {question.options.length === 0 && (
                    <Input
                      className="h-7 text-xs"
                      placeholder="输入您的回答..."
                      value={manualInputs[question.header] || ''}
                      onChange={(e) => {
                        setManualInputs((prev) => ({
                          ...prev,
                          [question.header]: e.target.value,
                        }))
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAnswerQuestion}
                disabled={
                  isSending ||
                  !askUserQuestion.questions.every((q) => questionAnswers[q.header] || manualInputs[q.header])
                }
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : '提交'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ToolConfirm Dialog */}
      {activeTab === 'chat' && toolConfirm && (
        <div className="flex-shrink-0 px-3 pb-2">
          <Card className="p-3 border-orange-500/50 bg-orange-500/5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">工具调用需要确认</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {toolConfirm.toolName}
                </Badge>
              </div>
              <div className="bg-muted/50 rounded p-2 max-h-32 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(toolConfirm.input, null, 2)}
                </pre>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmTool('deny')}
                disabled={isSending}
                className="text-red-500 border-red-500/50 hover:bg-red-500/10"
              >
                拒绝
              </Button>
              <Button size="sm" onClick={() => handleConfirmTool('allow')} disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : '允许'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Input Area (only for chat tab) */}
      {activeTab === 'chat' && (
        <div className="flex-shrink-0 px-3 pb-3">
          <div className="relative">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a follow-up message..."
              className="w-full min-h-[60px] max-h-[120px] resize-none pr-12 text-base md:text-xs"
              disabled={isSending}
            />
            {(task.status === 'processing' || task.status === 'pending') && isSending ? (
              <button
                onClick={handleStopTask}
                disabled={isStopping}
                className="absolute bottom-2 right-2 rounded-full h-5 w-5 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square className="h-3 w-3" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                className="absolute bottom-2 right-2 rounded-full h-5 w-5 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
