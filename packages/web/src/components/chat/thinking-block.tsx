import { useState } from 'react'
import { Brain, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

export function ThinkingBlock({ text, isThinking }: { text: string; isThinking: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Brain className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">{isThinking ? '思考中...' : '已思考'}</span>
        {isThinking && <Loader2 className="h-3 w-3 animate-spin" />}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap mt-2 leading-relaxed italic">{text}</p>
        </div>
      )}
    </div>
  )
}
