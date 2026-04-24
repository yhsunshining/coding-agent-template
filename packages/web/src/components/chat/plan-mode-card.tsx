import { Rocket, Loader2 } from 'lucide-react'
import type { PermissionAction } from '@coder/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarkdownBlock } from './markdown-block'

/**
 * PlanModeCard — 计划审批卡片（专用于 ExitPlanMode 工具）
 *
 * 官方反编译对应：`05-tool-call-components.tsx` 的 Hv 组件 ExitPlanMode 分支（L700-780）。
 *
 * 与 `InterruptionCard` 的普通写工具分支相比，本卡片的特点：
 * 1. 用 Rocket 图标 + 主题高亮替代 ShieldAlert 警示色
 * 2. **P6+**: plan 内容用 MarkdownBlock 渲染,享受代码块语法高亮 / 列表 / 标题 / 链接等
 * 3. 三按钮：是 开始编码 / 继续规划 / 退出 Plan 模式
 *    - allow            → 批准计划，模型开始执行
 *    - deny             → 继续规划（保留 Plan 模式，让模型重新起草）
 *    - reject_and_exit_plan → 放弃 Plan，退出模式回到普通对话
 */
interface PlanModeCardProps {
  planContent: string
  isSending: boolean
  onDecision: (action: PermissionAction) => void
}

export function PlanModeCard({ planContent, isSending, onDecision }: PlanModeCardProps) {
  const hasPlan = planContent && planContent.trim().length > 0
  return (
    <Card className="p-3 border-primary/60 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">准备开始编码</span>
      </div>

      <div className="space-y-2">
        <div className="bg-muted/50 rounded p-2 max-h-96 overflow-auto text-xs">
          {hasPlan ? (
            // P6+: 接入 streamdown,plan 里的 `- ` 列表 / 代码块 / 粗体都会被正确渲染
            <MarkdownBlock>{planContent}</MarkdownBlock>
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-words font-mono leading-5 text-muted-foreground">
              （模型未提供计划内容）
            </pre>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDecision('reject_and_exit_plan')}
          disabled={isSending}
          className="text-muted-foreground"
        >
          退出 Plan 模式
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDecision('deny')} disabled={isSending}>
          继续规划
        </Button>
        <Button size="sm" onClick={() => onDecision('allow')} disabled={isSending}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : '是，开始编码'}
        </Button>
      </div>
    </Card>
  )
}
