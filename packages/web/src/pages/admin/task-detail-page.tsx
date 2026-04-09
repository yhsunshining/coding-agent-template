import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Task } from '@coder/shared'
import { TaskChat } from '../../components/task-chat'

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '等待中', variant: 'outline' },
  processing: { label: '执行中', variant: 'default' },
  completed: { label: '已完成', variant: 'secondary' },
  error: { label: '失败', variant: 'destructive' },
  stopped: { label: '已停止', variant: 'outline' },
}

export function AdminTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTask = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const data = (await api.get(`/api/admin/tasks/${taskId}`)) as { task: Task; username?: string }
      setTask(data.task)
      setUsername((data as any).username || data.task.userId)
    } catch {
      toast.error('加载任务详情失败')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    loadTask()
  }, [loadTask])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!task) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">任务不存在</div>
  }

  const meta = statusLabels[task.status] || { label: task.status, variant: 'outline' as const }

  return (
    <div className="flex flex-col h-full -mx-4 -mb-4 -mt-0">
      {/* Top bar with back navigation and task info */}
      <div className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          任务列表
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{task.title || task.id}</span>
          <Badge variant={meta.variant} className="shrink-0">
            {meta.label}
          </Badge>
          {username && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {username}
            </Badge>
          )}
        </div>
      </div>

      {/* TaskChat in read-only mode */}
      <div className="flex-1 min-h-0">
        <TaskChat taskId={taskId!} task={task} readOnly messagesApiBase="/api/admin" />
      </div>
    </div>
  )
}
