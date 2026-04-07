import { useState } from 'react'
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, Wrench } from 'lucide-react'

export function ToolCallCard({
  toolName,
  toolCallId,
  input,
  result,
  isError,
  isPending,
}: {
  toolName: string
  toolCallId?: string
  input?: unknown
  result?: string
  isError?: boolean
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        )}
        <Wrench className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
        <span className="font-medium text-foreground">{toolName !== 'tool' ? toolName : 'Tool'}</span>
        {toolCallId && <span className="text-muted-foreground/50">{toolCallId}</span>}
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/30 text-xs">
          {input != null && (
            <div className="px-3 py-2">
              <div className="text-muted-foreground font-medium mb-1">参数</div>
              <pre className="bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div className="px-3 py-2 border-t border-border/20">
              <div className="text-muted-foreground font-medium mb-1">结果</div>
              <pre
                className={`bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto ${isError ? 'text-red-400' : ''}`}
              >
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
