import { useEffect, useState } from 'react'
import { BarChart3, Database, HardDrive, Activity, Zap, Code2, ArrowUpRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { databaseAPI } from '../services/database'
import { capiClient } from '../services/capi'
import { envIdAtom } from '../atoms/env'
import type { CloudPage } from '../CloudDashboard'

interface EnvInfo {
  envId: string
  alias: string
  region: string
  status: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  Normal: { label: '运行中', color: 'bg-success' },
  Developing: { label: '开发中', color: 'bg-warning' },
  Creating: { label: '创建中', color: 'bg-warning' },
  Offline: { label: '已关闭', color: 'bg-fg-muted' },
}

export default function HomePage({ onNavigate }: { onNavigate?: (page: CloudPage) => void }) {
  const envId = useAtomValue(envIdAtom)
  const [collectionCount, setCollectionCount] = useState(0)
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [envLoading, setEnvLoading] = useState(true)

  useEffect(() => {
    databaseAPI
      .getCollections()
      .then((c) => setCollectionCount(c.length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!envId) {
      setEnvLoading(false)
      return
    }
    setEnvLoading(true)
    capiClient
      .tcb('DescribeEnvs', { EnvId: envId })
      .then((data: any) => {
        const envList = data?.EnvList || []
        if (envList.length > 0) {
          setEnvInfo({
            envId: envList[0].EnvId || envId,
            alias: envList[0].Alias || '',
            region: envList[0].Region || '',
            status: envList[0].Status || 'Normal',
          })
        } else {
          setEnvInfo({ envId, alias: '', region: '', status: 'Normal' })
        }
      })
      .catch(() => {
        setEnvInfo({ envId, alias: '', region: '', status: 'Normal' })
      })
      .finally(() => setEnvLoading(false))
  }, [envId])

  const stats = [
    { label: '集合数', value: String(collectionCount), icon: Database, accent: '#3b82f6' },
    { label: '存储桶', value: '2', icon: HardDrive, accent: '#8b5cf6' },
    { label: 'API 请求', value: '12.4K', icon: Activity, accent: '#f59e0b' },
    { label: '使用率', value: '24%', icon: BarChart3, accent: '#10b981' },
  ]

  const modules = [
    {
      page: 'database' as CloudPage,
      to: '/database',
      icon: Database,
      label: '数据库',
      desc: 'NoSQL 集合与文档管理',
      color: '#3b82f6',
    },
    {
      page: 'storage' as CloudPage,
      to: '/storage',
      icon: HardDrive,
      label: '存储',
      desc: '云存储和静态托管',
      color: '#8b5cf6',
    },
    {
      page: 'sql' as CloudPage,
      to: '/sql',
      icon: Code2,
      label: 'SQL 编辑器',
      desc: '关系数据库查询',
      color: '#06b6d4',
    },
    {
      page: 'functions' as CloudPage,
      to: '/functions',
      icon: Zap,
      label: '云函数',
      desc: 'Serverless 函数管理',
      color: '#f59e0b',
    },
  ]

  const statusMeta = envInfo ? STATUS_MAP[envInfo.status] || STATUS_MAP.Normal : STATUS_MAP.Normal

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-default">
      {/* Header */}
      <div className="flex min-h-12 items-center gap-2 border-b border-border-muted px-4 bg-bg-surface-100/30">
        <h1 className="text-sm font-medium text-fg-default">仪表盘</h1>
        <span className="text-xs text-fg-muted">·</span>
        <span className="text-xs text-fg-lighter">CloudBase 管理概览</span>
      </div>

      <div className="flex-1 p-5 space-y-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="relative overflow-hidden rounded-xl border border-border-default bg-bg-surface-100 p-5 transition-all duration-200 hover:border-border-strong hover:shadow-xl hover:shadow-black/20 group"
              >
                <div
                  className="absolute inset-0 transition-opacity group-hover:brightness-110"
                  style={{
                    background: `linear-gradient(to right, ${s.accent}40 0%, ${s.accent}18 35%, transparent 65%)`,
                    opacity: 'var(--card-glow-opacity, 1)',
                  }}
                />
                <div
                  className="absolute -right-3 -top-3 h-20 w-20 rounded-full transition-opacity group-hover:opacity-[0.22]"
                  style={{
                    background: `radial-gradient(circle, ${s.accent}, transparent)`,
                    opacity: `calc(var(--card-glow-opacity, 1) * 0.12)`,
                  }}
                />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-fg-lighter uppercase tracking-wider">{s.label}</p>
                    <p className="mt-2 text-3xl font-bold text-fg-default tabular-nums">{s.value}</p>
                  </div>
                  <Icon size={20} className="text-fg-muted mt-0.5" strokeWidth={1.5} />
                </div>
              </div>
            )
          })}
        </div>

        {/* 功能模块 */}
        <div>
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-4">功能模块</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modules.map((m) => {
              const Icon = m.icon
              const handleClick = () => {
                if (onNavigate) {
                  onNavigate(m.page)
                }
              }

              if (onNavigate) {
                return (
                  <button
                    key={m.page}
                    type="button"
                    onClick={handleClick}
                    className="group relative overflow-hidden flex items-center gap-4 rounded-xl border border-border-default bg-bg-surface-100 p-4 transition-all duration-200 hover:border-border-strong hover:shadow-lg hover:shadow-black/15 text-left w-full"
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-24 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(to right, ${m.color}12, transparent)` }}
                    />
                    <div
                      className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-bg-surface-300 transition-colors group-hover:bg-bg-surface-400"
                      style={{ boxShadow: `0 0 0 1px ${m.color}25` }}
                    >
                      <Icon size={20} strokeWidth={1.5} style={{ color: m.color }} />
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg-default">{m.label}</p>
                      <p className="text-xs text-fg-lighter mt-0.5">{m.desc}</p>
                    </div>
                    <ArrowUpRight
                      size={15}
                      className="relative text-fg-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                    />
                  </button>
                )
              }

              return (
                <Link
                  key={m.to}
                  to={m.to}
                  className="group relative overflow-hidden flex items-center gap-4 rounded-xl border border-border-default bg-bg-surface-100 p-4 transition-all duration-200 hover:border-border-strong hover:shadow-lg hover:shadow-black/15"
                >
                  <div
                    className="absolute left-0 top-0 h-full w-24 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(to right, ${m.color}12, transparent)` }}
                  />
                  <div
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-bg-surface-300 transition-colors group-hover:bg-bg-surface-400"
                    style={{ boxShadow: `0 0 0 1px ${m.color}25` }}
                  >
                    <Icon size={20} strokeWidth={1.5} style={{ color: m.color }} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg-default">{m.label}</p>
                    <p className="text-xs text-fg-lighter mt-0.5">{m.desc}</p>
                  </div>
                  <ArrowUpRight
                    size={15}
                    className="relative text-fg-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                  />
                </Link>
              )
            })}
          </div>
        </div>

        {/* 环境信息 */}
        <div className="rounded-xl border border-border-default bg-bg-surface-100/80 overflow-hidden shimmer">
          <div className="border-b border-border-default px-6 py-3 bg-bg-surface-200/50">
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">环境信息</h2>
          </div>
          {envLoading ? (
            <div className="px-6 py-8 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-fg-muted" />
            </div>
          ) : (
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-fg-muted uppercase tracking-wider">环境 ID</p>
                <p className="text-fg-light font-mono text-xs bg-bg-surface-200 px-2 py-1 rounded">
                  {envInfo?.envId || envId || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-fg-muted uppercase tracking-wider">地域</p>
                <p className="text-sm text-fg-default">{envInfo?.region ? `${envInfo.region}` : '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-fg-muted uppercase tracking-wider">状态</p>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${statusMeta.color} shadow-sm shadow-success/50 animate-pulse`}
                  />
                  <span className="text-sm text-fg-default">{statusMeta.label}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
