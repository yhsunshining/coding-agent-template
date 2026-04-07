import { ShieldAlert, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ToolConfirmData } from '@/types/task-chat'

interface ToolConfirmDialogProps {
  data: ToolConfirmData
  isSending: boolean
  onConfirm: (action: 'allow' | 'deny') => void
}

export function ToolConfirmDialog({ data, isSending, onConfirm }: ToolConfirmDialogProps) {
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
        <div className="bg-muted/50 rounded p-2 max-h-32 overflow-auto">
          <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(data.input, null, 2)}</pre>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConfirm('deny')}
          disabled={isSending}
          className="text-red-500 border-red-500/50 hover:bg-red-500/10"
        >
          拒绝
        </Button>
        <Button size="sm" onClick={() => onConfirm('allow')} disabled={isSending}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : '允许'}
        </Button>
      </div>
    </Card>
  )
}
