/**
 * PreviewPlaceholder — 预览加载占位骨架屏(借鉴 Adorable 的 PreviewPlaceholder)
 *
 * 在 previewUrl 尚未拿到前展示,模拟一个典型 Web 应用的视觉结构:
 *   - 顶部:假浏览器工具栏(3 小图标 + 1 地址栏)
 *   - 中部:英雄区(标题 + CTA + 副标题)
 *   - 底部:3 个特性卡片
 *
 * 比空白屏 / 纯 Loader 更能降低用户焦虑感 —— 让等待期间的 UI 结构可预测。
 *
 * 无状态、无 props、纯装饰组件。
 */
export function PreviewPlaceholder() {
  return (
    <div className="flex h-full flex-col bg-muted/5">
      {/* 顶部工具栏 */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2">
        <div className="size-5 rounded bg-muted-foreground/8" />
        <div className="size-5 rounded bg-muted-foreground/8" />
        <div className="size-5 rounded bg-muted-foreground/8" />
        <div className="ml-1 h-5 flex-1 rounded-md bg-muted/50" />
      </div>

      {/* 正文 */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="mx-auto max-w-md space-y-8">
          {/* 假 Nav */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
            <div className="flex gap-4">
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
            </div>
          </div>

          {/* 英雄区 */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-6 w-56 animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted/30" />
            <div className="mt-2 h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
          </div>

          {/* 特性卡片 */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-muted/30 p-3">
                <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
                <div className="h-2 w-3/4 animate-pulse rounded bg-muted/25" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-muted/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
