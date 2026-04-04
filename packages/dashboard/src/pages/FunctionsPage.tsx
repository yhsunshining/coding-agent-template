import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { functionsAPI, FunctionInfo } from '../services/functions'
import { Button } from '../components/ui'
import { RefreshCw, Zap, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { envIdAtom } from '../atoms/env'

function formatSize(bytes: number) {
  if (!bytes) return '-'
  const kb = bytes / 1024
  return kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(1) + ' KB'
}

// 运行时图标 & 颜色
function RuntimeBadge({ runtime }: { runtime: string }) {
  const r = runtime.toLowerCase()
  let icon = '⬡'
  let cls = 'text-fg-muted bg-bg-surface-300'

  if (r.includes('nodejs') || r.includes('node')) {
    icon = '⬡'
    cls = 'text-emerald-400 bg-emerald-400/10'
  } else if (r.includes('python')) {
    icon = '🐍'
    cls = 'text-blue-400 bg-blue-400/10'
  } else if (r.includes('php')) {
    icon = '🐘'
    cls = 'text-violet-400 bg-violet-400/10'
  } else if (r.includes('java')) {
    icon = '☕'
    cls = 'text-amber-400 bg-amber-400/10'
  } else if (r.includes('go')) {
    icon = '◈'
    cls = 'text-cyan-400 bg-cyan-400/10'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${cls}`}
    >
      <span>{icon}</span>
      {runtime}
    </span>
  )
}

// 状态指示
function StatusDot({ status }: { status: string }) {
  if (status === 'Active')
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(152_76%_55%/0.7)]" />
        <span className="text-xs text-emerald-400">运行中</span>
      </div>
    )
  if (status === 'Failed')
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
        <span className="text-xs text-destructive">异常</span>
      </div>
    )
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-1.5 rounded-full bg-fg-muted" />
      <span className="text-xs text-fg-muted">{status || '-'}</span>
    </div>
  )
}

export default function FunctionsPage() {
  const envId = useAtomValue(envIdAtom)
  console.log('[FunctionsPage] envId from atom:', envId)
  const [functions, setFunctions] = useState<FunctionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    functionsAPI
      .list()
      .then(setFunctions)
      .catch((e) => {
        setError(e.message)
        toast.error('加载函数列表失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (name: string) => {
    if (!envId) {
      toast.error('环境未就绪，请刷新页面重试')
      return
    }
    if (!confirm(`确认删除云函数 "${name}"？此操作不可恢复。`)) return
    setDeleting(name)
    try {
      // 通过 capi 调用 DeleteFunction
      const apiBase = import.meta.env.VITE_API_BASE || '/api'
      const r = await fetch(`${apiBase}/capi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          service: 'scf',
          version: '20180416',
          action: 'DeleteFunction',
          params: {
            FunctionName: name,
            Namespace: envId,
          },
          region: 'ap-shanghai',
        }),
      })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || '删除失败')
      toast.success(`已删除函数 "${name}"`)
      setFunctions((prev) => prev.filter((f) => f.name !== name))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-default/70">
      {/* Header */}
      <div className="flex min-h-12 items-center justify-between border-b border-border-muted px-4 bg-bg-surface-100/30 shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-brand" strokeWidth={1.5} />
          <span className="text-sm font-medium text-fg-default">云函数</span>
          <span className="text-xs text-fg-muted">·</span>
          <span className="text-xs text-fg-lighter">{functions.length} 个函数</span>
        </div>
        <Button variant="ghost" size="tiny" onClick={load} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 刷新
        </Button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="flex items-center justify-center h-40 text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 gap-2">
            <Loader2 size={16} className="animate-spin text-brand" />
            <span className="text-sm text-fg-lighter">加载中...</span>
          </div>
        ) : functions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Zap size={28} className="text-fg-muted" strokeWidth={1.5} />
            <p className="text-sm text-fg-lighter">暂无云函数</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-surface-200/80 backdrop-blur-sm border-b border-border-default sticky top-0 z-10">
                  <th
                    className="text-left px-5 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider"
                    style={{ width: 180 }}
                  >
                    函数名称
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-40">
                    运行环境
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-20">
                    状态
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-20">
                    类型
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-20">
                    代码大小
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-16">
                    内存
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-14">
                    超时
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-36">
                    创建时间
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wider w-36">
                    更新时间
                  </th>
                  {/* 固定操作列 */}
                  <th className="sticky right-0 bg-bg-surface-200/80 backdrop-blur-sm px-4 py-2.5 w-12 border-l border-border-muted/30" />
                </tr>
              </thead>
              <tbody>
                {functions.map((fn) => (
                  <tr
                    key={fn.name}
                    className="border-b border-border-muted hover:bg-bg-surface-100 transition-colors group"
                  >
                    {/* 函数名称 — 固定宽度 + truncate */}
                    <td className="px-5 py-3" style={{ width: 180, maxWidth: 180 }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap size={13} className="text-brand shrink-0" strokeWidth={1.5} />
                        <span
                          className="text-xs font-medium text-fg-default truncate max-w-[160px] block"
                          title={fn.name}
                        >
                          {fn.name}
                        </span>
                      </div>
                      {fn.description && (
                        <p className="text-[11px] text-fg-muted mt-0.5 pl-5 truncate">{fn.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RuntimeBadge runtime={fn.runtime} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot status={fn.status} />
                    </td>
                    {/* 类型 */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-fg-lighter">
                        {fn.type === 'Event' ? '事件触发' : fn.type === 'HTTP' ? 'HTTP' : fn.type || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-lighter tabular-nums">{formatSize(fn.codeSize)}</td>
                    <td className="px-4 py-3 text-xs text-fg-lighter tabular-nums">
                      {fn.memSize ? fn.memSize + ' MB' : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-lighter tabular-nums">
                      {fn.timeout ? fn.timeout + 's' : '-'}
                    </td>
                    {/* 创建时间 */}
                    <td className="px-4 py-3 text-[11px] text-fg-lighter tabular-nums whitespace-nowrap">
                      {fn.addTime ? fn.addTime.replace('T', ' ').slice(0, 16) : '-'}
                    </td>
                    {/* 更新时间 */}
                    <td className="px-4 py-3 text-[11px] text-fg-lighter tabular-nums whitespace-nowrap">
                      {fn.modTime ? fn.modTime.replace('T', ' ').slice(0, 16) : '-'}
                    </td>
                    {/* 固定操作列 — 始终显示 */}
                    <td className="sticky right-0 bg-bg-default group-hover:bg-bg-surface-100 px-4 py-3 border-l border-border-muted/30 transition-colors">
                      <div className="flex items-center justify-end">
                        {deleting === fn.name ? (
                          <Loader2 size={13} className="animate-spin text-fg-muted" />
                        ) : (
                          <button
                            onClick={() => handleDelete(fn.name)}
                            className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="删除函数"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      {functions.length > 0 && (
        <div className="shrink-0 flex items-center px-5 h-8 border-t border-border-muted text-xs text-fg-muted">
          共 {functions.length} 个函数
        </div>
      )}
    </div>
  )
}
