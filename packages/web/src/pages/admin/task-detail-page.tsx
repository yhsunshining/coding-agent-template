import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, ExternalLink, GitBranch, Server, AlertCircle } from 'lucide-react'

interface TaskDetail {
  id: string
  userId: string
  username: string
  title: string | null
  prompt: string
  status: string
  progress: number | null
  selectedAgent: string | null
  selectedModel: string | null
  repoUrl: string | null
  branchName: string | null
  sandboxId: string | null
  sandboxUrl: string | null
  previewUrl: string | null
  prUrl: string | null
  prNumber: number | null
  prStatus: string | null
  error: string | null
  logs: string | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '等待中', variant: 'outline' },
  processing: { label: '执行中', variant: 'default' },
  completed: { label: '已完成', variant: 'secondary' },
  error: { label: '失败', variant: 'destructive' },
}

export function AdminTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) return
    loadTask()
  }, [taskId])

  async function loadTask() {
    setLoading(true)
    try {
      const data = (await api.get(`/api/admin/tasks/${taskId}`)) as { task: TaskDetail }
      setTask(data.task)
    } catch {
      toast.error('加载任务详情失败')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          任务列表
        </Button>
      </div>

      {/* Title & Status */}
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight truncate">{task.title || task.id}</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">{task.id}</p>
        </div>
        <Badge variant={meta.variant} className="ml-3 shrink-0">
          {meta.label}
        </Badge>
      </div>

      {/* Error */}
      {task.error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400 break-all">{task.error}</p>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
        <InfoField label="用户" value={task.username} />
        <InfoField label="Agent" value={task.selectedAgent || '-'} />
        <InfoField label="模型" value={task.selectedModel || '-'} />
        <InfoField label="进度" value={task.progress != null ? `${task.progress}%` : '-'} />
        <InfoField
          label="仓库"
          value={
            task.repoUrl ? (
              <a
                href={task.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
              >
                {task.repoUrl.replace(/^https?:\/\/github\.com\//, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              '-'
            )
          }
        />
        <InfoField
          label="分支"
          value={
            task.branchName ? (
              <span className="inline-flex items-center gap-1 text-sm">
                <GitBranch className="h-3 w-3" />
                {task.branchName}
              </span>
            ) : (
              '-'
            )
          }
        />
        <InfoField
          label="Sandbox"
          value={
            task.sandboxUrl ? (
              <a
                href={task.sandboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
              >
                <Server className="h-3 w-3" />
                {task.sandboxId?.slice(0, 12) || '打开'}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : task.sandboxId ? (
              <span className="text-sm font-mono">{task.sandboxId.slice(0, 12)}</span>
            ) : (
              '-'
            )
          }
        />
        <InfoField
          label="预览"
          value={
            task.previewUrl ? (
              <a
                href={task.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
              >
                打开预览
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              '-'
            )
          }
        />
        <InfoField
          label="PR"
          value={
            task.prUrl ? (
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
              >
                #{task.prNumber}
                {task.prStatus && <span className="text-muted-foreground ml-1">({task.prStatus})</span>}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : task.prNumber ? (
              <span className="text-sm">#{task.prNumber}</span>
            ) : (
              '-'
            )
          }
        />
        <InfoField label="创建时间" value={new Date(task.createdAt).toLocaleString('zh-CN')} />
        <InfoField
          label="完成时间"
          value={task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '-'}
        />
      </div>

      {/* Prompt */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Prompt</h3>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-sm whitespace-pre-wrap break-words">{task.prompt}</p>
        </div>
      </div>

      {/* Logs */}
      {task.logs && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">日志</h3>
          <div className="rounded-md border bg-muted/30 p-3 max-h-96 overflow-auto">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono">{task.logs}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm">{typeof value === 'string' ? value : value}</dd>
    </div>
  )
}
