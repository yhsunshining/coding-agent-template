import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'

/**
 * BrowserControls — 预览 iframe 的浏览器工具栏(借鉴 Adorable repo-workspace-shell.tsx 的 BrowserControls)
 *
 * 功能:
 *   - 前进 / 后退 / 刷新
 *   - 可编辑地址栏(相对路径),回车触发 iframe 导航
 *
 * 实现说明:
 *   - 前进/后退:iframe.contentWindow.history.back/forward(仅当 iframe 同源可用)
 *   - 刷新:`iframe.src = iframe.src` 触发 re-navigation(保持当前 URL),
 *     比外层 `key` 递增(React 卸载重建 iframe)更轻量、不闪屏
 *   - 地址栏只编辑 pathname,保持 origin 不变;回车时把 `origin + newPath` 赋值给 iframe.src
 *
 * 安全:跨域 iframe 时 contentWindow.history 访问会抛 DOMException,内部 try/catch 吞掉。
 */
interface BrowserControlsProps {
  /** 预览 URL 的完整地址(提取 origin 作为导航基础) */
  previewUrl: string
  /** 外部传入的 iframe ref,BrowserControls 不拥有 iframe */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** 刷新时是否同时让父级 remount iframe(如果外部用 key 方案,可以传此回调) */
  onHardRefresh?: () => void
  className?: string
}

export function BrowserControls({ previewUrl, iframeRef, onHardRefresh, className }: BrowserControlsProps) {
  // 地址栏编辑内容(只存 pathname + search,不含 host)
  const [urlValue, setUrlValue] = useState(() => extractPathFromUrl(previewUrl))

  // previewUrl 由外部更新时(如切换任务 / 重启预览),同步到输入框
  useEffect(() => {
    setUrlValue(extractPathFromUrl(previewUrl))
  }, [previewUrl])

  const baseUrl = (() => {
    try {
      const u = new URL(previewUrl)
      return `${u.protocol}//${u.host}`
    } catch {
      return previewUrl
    }
  })()

  const navigate = (path: string) => {
    const iframe = iframeRef.current
    if (!iframe) return
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    setUrlValue(normalizedPath)
    iframe.src = `${baseUrl}${normalizedPath}`
  }

  const handleReload = () => {
    // 优先走软刷新(保留 iframe DOM + 当前滚动位置)
    const iframe = iframeRef.current
    if (iframe) {
      iframe.src = iframe.src
      return
    }
    // 若 iframe 还没挂,让父级硬刷新
    onHardRefresh?.()
  }

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back()
    } catch {
      // 跨域 iframe 不可访问 history — 静默降级
    }
  }

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward()
    } catch {
      // 跨域 iframe 不可访问 history — 静默降级
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleBack}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="后退"
        aria-label="后退"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleForward}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="前进"
        aria-label="前进"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleReload}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="刷新"
        aria-label="刷新"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </button>
      <form
        className="ml-1 flex-1 min-w-0"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(urlValue)
        }}
      >
        <input
          type="text"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          className="h-6 w-full rounded-md bg-muted/50 px-2 text-[11px] text-foreground transition-colors outline-none focus:bg-muted focus:ring-1 focus:ring-ring"
          aria-label="URL 路径"
          placeholder="/"
        />
      </form>
    </div>
  )
}

function extractPathFromUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return '/'
  }
}
