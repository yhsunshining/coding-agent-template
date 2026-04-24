import { ShieldAlert, Loader2 } from 'lucide-react'
import type { PermissionAction } from '@coder/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ToolConfirmData } from '@/types/task-chat'

/**
 * InterruptionCard — 工具权限中断卡片
 *
 * 官方反编译对应组件：05-tool-call-components.tsx 的 Hv 组件。
 *
 * P1: 标准权限三按钮 —— 允许 / 总是允许（本会话）/ 拒绝
 * ExitPlanMode 分支留待 P2 接入。
 */
interface InterruptionCardProps {
  data: ToolConfirmData
  isSending: boolean
  onDecision: (action: PermissionAction) => void
}

export function InterruptionCard({ data, isSending, onDecision }: InterruptionCardProps) {
  return (
    <Card className="p-3 border-orange-500/50 bg-orange-500/5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium">工具调用需要确认</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.toolName}
          </Badge>
        </div>
        <div className="bg-muted/50 rounded p-2 max-h-48 overflow-auto">
          <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(data.input, null, 2)}</pre>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDecision('deny')}
          disabled={isSending}
          className="text-red-500 border-red-500/50 hover:bg-red-500/10"
        >
          拒绝
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDecision('allow_always')} disabled={isSending}>
          总是允许（本会话）
        </Button>
        <Button size="sm" onClick={() => onDecision('allow')} disabled={isSending}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : '允许'}
        </Button>
      </div>
    </Card>
  )
}
