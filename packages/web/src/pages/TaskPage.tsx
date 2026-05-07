import { useParams } from 'react-router'
import { TaskPageClient } from '@/components/task-page-client'

export function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()

  if (!taskId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No task ID provided</p>
      </div>
    )
  }

  // key={taskId} 确保切换 task 时整个页面组件树重建，
  // 清空所有本地状态（preview URL、文件标签、pane 状态等）
  return <TaskPageClient key={taskId} taskId={taskId} user={null} authProvider={null} />
}
