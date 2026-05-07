import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { Task } from '@coder/shared'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export function useTask(taskId: string) {
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTask = useCallback(async () => {
    try {
      const data = await api.get<{ task: Task }>(`/api/tasks/${taskId}`)
      setTask(data.task)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch task')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  // Only poll when task is still running
  useEffect(() => {
    if (!task || TERMINAL_STATUSES.has(task.status)) return
    const interval = setInterval(fetchTask, 15000)
    return () => clearInterval(interval)
  }, [task?.status, fetchTask])

  return { task, isLoading, error, refetch: fetchTask }
}
