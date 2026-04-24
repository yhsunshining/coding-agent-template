import { FilePlus } from 'lucide-react'
import type { ToolRenderer, ToolRenderContext } from './index'
import { MarkdownBlock } from '../markdown-block'
import { guessLanguage } from './guess-language'

interface WriteInput {
  file_path?: string
  content?: string
}

function shortenPath(path: string, maxLen = 48): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 2) return `…${path.slice(-(maxLen - 1))}`
  return `…/${parts.slice(-2).join('/')}`
}

/** 与 bash.tsx 相同的 fence 保护:用户内容含 4+反引号时用 ~~~ 分隔 */
function fenceCodeBlock(text: string, lang: string): string {
  const hasBigBacktick = /````+/.test(text)
  const fence = hasBigBacktick ? '~~~' : '```'
  return `${fence}${lang}\n${text}\n${fence}`
}

/**
 * Write 工具渲染器。
 * Write 通常是"从 0 创建",没有 old 文本,这里只展示即将写入的完整内容
 * (截断 300 行;完整内容用户可通过文件树查看)。
 *
 * P6+: 按 file_path 扩展名推断语言,包成 streamdown 代码块获得 shiki 语法高亮。
 */
export const writeRenderer: ToolRenderer = {
  Icon: FilePlus,
  getSummary: ({ input }) => {
    const p = (input as WriteInput)?.file_path
    return p ? shortenPath(p) : undefined
  },
  renderInput: ({ input }: ToolRenderContext) => {
    const { file_path, content } = (input as WriteInput) || {}
    if (!file_path && !content) return null
    const lang = guessLanguage(file_path)
    return (
      <div className="space-y-2">
        {file_path && (
          <div className="text-[11px] font-mono">
            <span className="text-foreground">{file_path}</span>
            <span className="ml-2 text-muted-foreground">· {lang}</span>
          </div>
        )}
        {content && (
          <div className="text-[11px] max-h-[300px] overflow-y-auto">
            <MarkdownBlock>{fenceCodeBlock(content, lang)}</MarkdownBlock>
          </div>
        )}
      </div>
    )
  },
}
