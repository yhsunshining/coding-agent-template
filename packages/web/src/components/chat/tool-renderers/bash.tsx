import { Terminal } from 'lucide-react'
import type { ToolRenderer, ToolRenderContext } from './index'
import { extractResultText } from './default'
import { MarkdownBlock } from '../markdown-block'

interface BashInput {
  command?: string
  description?: string
  timeout?: number
}

/**
 * 把任意字符串包成 fenced code block,供 streamdown 按语言高亮。
 * 我们需要**转义**用户文本里的反引号,避免 ``` 碰撞导致解析失败。
 * 简单做法:如果文本中出现 4 个以上连续反引号,就切到 ~~~ 分隔符。
 */
function fenceCodeBlock(text: string, lang: string): string {
  const hasBigBacktick = /````+/.test(text)
  const fence = hasBigBacktick ? '~~~' : '```'
  return `${fence}${lang}\n${text}\n${fence}`
}

/**
 * Bash 工具渲染器。
 * 显示"$ <command>"风格的命令预览 + 命令输出。
 *
 * P6+: 命令部分包成 ```bash 代码块,由 streamdown(内置 shiki)做语法高亮;
 *      输出部分根据错误态切不同颜色,纯文本渲染以保留原始空白。
 */
export const bashRenderer: ToolRenderer = {
  Icon: Terminal,
  getSummary: ({ input }) => {
    const cmd = (input as BashInput)?.command
    if (!cmd) return undefined
    return cmd.length > 60 ? `${cmd.slice(0, 60)}…` : cmd
  },
  renderInput: ({ input }: ToolRenderContext) => {
    const { command, description } = (input as BashInput) || {}
    if (!command) return null
    return (
      <div className="space-y-1">
        {description && <div className="text-[11px] text-muted-foreground">{description}</div>}
        {/* P6+: 用 MarkdownBlock + fenced ```bash 代码块获得 shiki 高亮 */}
        <div className="text-[11px]">
          <MarkdownBlock>{fenceCodeBlock(command, 'bash')}</MarkdownBlock>
        </div>
      </div>
    )
  },
  renderOutput: ({ result, isError }: ToolRenderContext) => {
    if (!result) return null
    const text = extractResultText(result)
    // 输出是命令产物,通常不是合法语言,用 ``` 裸高亮反而乱;保留纯文本+等宽字体
    return (
      <pre
        className={`bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto font-mono ${
          isError ? 'text-red-400' : 'text-muted-foreground'
        }`}
      >
        {text}
      </pre>
    )
  },
}
