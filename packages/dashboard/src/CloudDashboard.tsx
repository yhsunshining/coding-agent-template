/**
 * CloudDashboard - 可嵌入的 Dashboard 入口
 * 不依赖 React Router，内部用 state 切换页面
 * 供外部项目直接 import 使用
 */
import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { Provider as JotaiProvider, useSetAtom } from 'jotai'
import { Home, Database, HardDrive, Code2, Zap, PanelLeftClose, PanelLeft, PanelLeftOpen } from 'lucide-react'
import HomePage from './pages/HomePage'
import DatabasePage from './pages/DatabasePage'
import StoragePage from './pages/StoragePage'
import SqlPage from './pages/SqlPage'
import FunctionsPage from './pages/FunctionsPage'
import { DatabaseMenu } from './components/navigation/DatabaseMenu'
import { StorageMenu } from './components/navigation/StorageMenu'
import { cn } from './utils/helpers'
import { envIdAtom } from './atoms/env'
import type { Theme } from './hooks/useTheme'
export type { Theme }

export type CloudPage = 'home' | 'database' | 'storage' | 'sql' | 'functions'
type SidebarMode = 'icon' | 'hover' | 'expanded'

const MODE_CYCLE: SidebarMode[] = ['hover', 'expanded', 'icon']
const MODE_META: Record<SidebarMode, { label: string; icon: typeof PanelLeft }> = {
  icon: { label: '图标模式', icon: PanelLeftClose },
  hover: { label: 'Hover 展开', icon: PanelLeft },
  expanded: { label: '固定展开', icon: PanelLeftOpen },
}

const NAV = [
  { id: 'home' as CloudPage, icon: Home, label: '首页' },
  { id: 'database' as CloudPage, icon: Database, label: '数据库' },
  { id: 'storage' as CloudPage, icon: HardDrive, label: '存储' },
  { id: 'sql' as CloudPage, icon: Code2, label: 'SQL' },
  { id: 'functions' as CloudPage, icon: Zap, label: '函数' },
]

const HAS_SIDEBAR: CloudPage[] = ['database', 'storage']

const PAGE_TITLE: Record<CloudPage, string> = {
  home: '首页',
  database: '数据库',
  storage: '存储',
  sql: 'SQL 编辑器',
  functions: '云函数',
}

function CloudShell({ defaultPage, theme = 'dark' }: { defaultPage?: CloudPage; theme?: Theme }) {
  const [page, setPage] = useState<CloudPage>(defaultPage || 'home')
  const [mode, setMode] = useState<SidebarMode>('hover')
  const [hovered, setHovered] = useState(false)
  const hasSidebar = HAS_SIDEBAR.includes(page)

  const isExpanded = mode === 'expanded' || (mode === 'hover' && hovered)
  const { label: modeLabel, icon: ModeIcon } = MODE_META[mode]

  const cycleMode = () =>
    setMode((prev) => {
      const idx = MODE_CYCLE.indexOf(prev)
      return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]
    })

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--background-default))' }}>
      {/* 左侧导航 — 支持 hover/expanded/icon 三种模式 */}
      <aside
        className={cn(
          'flex flex-col shrink-0 border-r border-border-muted transition-[width] duration-200 ease-in-out overflow-hidden',
          isExpanded ? 'w-44' : 'w-10',
        )}
        style={{ backgroundColor: 'hsl(var(--background-alternative-default))' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo */}
        <div className="flex h-10 w-full items-center border-b border-border-muted shrink-0 overflow-hidden">
          <div className="flex items-center gap-2.5 pl-2 pr-3">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand text-white text-[9px] font-bold">
              CB
            </div>
            <span
              className={cn(
                'text-xs font-semibold text-fg-default whitespace-nowrap transition-all duration-200',
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none',
              )}
            >
              CloudBase
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 py-2 px-1.5 overflow-hidden">
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={isExpanded ? undefined : label}
              onClick={() => setPage(id)}
              className={cn(
                'relative flex h-8 items-center gap-2.5 pl-1.5 pr-2 rounded transition-all duration-150 overflow-hidden',
                page === id
                  ? 'bg-bg-surface-400 text-fg-default'
                  : 'text-fg-muted hover:bg-bg-surface-200 hover:text-fg-lighter',
              )}
            >
              <Icon size={15} strokeWidth={page === id ? 2 : 1.5} className="shrink-0" />
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap transition-all duration-200',
                  isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
                )}
              >
                {label}
              </span>
              {page === id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-r bg-brand" />
              )}
            </button>
          ))}
        </nav>

        {/* 分割线 */}
        <div className="px-3 pb-1">
          <div className="h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        </div>

        {/* Mode 切换按钮 */}
        <div className="py-2 px-1.5 shrink-0">
          <button
            onClick={cycleMode}
            title={isExpanded ? undefined : `侧栏：${modeLabel}`}
            className="flex h-8 w-full items-center gap-2.5 pl-1.5 pr-2 rounded text-fg-muted hover:bg-bg-surface-200 hover:text-fg-lighter transition-all duration-150 overflow-hidden"
          >
            <ModeIcon size={15} strokeWidth={1.5} className="shrink-0" />
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap transition-all duration-200',
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
              )}
            >
              {modeLabel}
            </span>
          </button>
        </div>
      </aside>

      {/* 侧栏（数据库、存储有） */}
      {hasSidebar && (
        <div className="w-44 shrink-0 flex flex-col border-r border-border-muted bg-bg-sidebar">
          <div className="flex min-h-10 items-center border-b border-border-muted px-3 bg-bg-surface-100/30">
            <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{PAGE_TITLE[page]}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {page === 'database' && <DatabaseMenu />}
            {page === 'storage' && <StorageMenu />}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden min-w-0">
        {page === 'home' && <HomePage />}
        {page === 'database' && <DatabasePage />}
        {page === 'storage' && <StoragePage />}
        {page === 'sql' && <SqlPage />}
        {page === 'functions' && <FunctionsPage />}
      </div>

      <Toaster theme={theme} position="bottom-right" richColors />
    </div>
  )
}

interface CloudDashboardProps {
  defaultPage?: CloudPage
  envId?: string
  theme?: Theme
  className?: string
  style?: React.CSSProperties
}

function EnvIdSetter({ envId }: { envId?: string }) {
  const setEnvId = useSetAtom(envIdAtom)
  useEffect(() => {
    console.log('[Dashboard] EnvIdSetter envId:', envId)
    if (envId) setEnvId(envId)
  }, [envId, setEnvId])
  return null
}

export function CloudDashboard({ defaultPage, envId, theme, className = '', style }: CloudDashboardProps) {
  const resolvedTheme = theme ?? 'dark'

  return (
    <JotaiProvider>
      <EnvIdSetter envId={envId} />
      <div className={className} data-theme={resolvedTheme} style={{ height: '100%', ...style }}>
        <CloudShell defaultPage={defaultPage} theme={resolvedTheme} />
      </div>
    </JotaiProvider>
  )
}

export default CloudDashboard
