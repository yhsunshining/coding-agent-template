import { FileText } from 'lucide-react'
import type { ToolRenderer, ToolRenderContext } from './index'
import { extractResultText } from './default'
import { MarkdownBlock } from '../markdown-block'
import { guessLanguage } from './guess-language'

interface ReadInput {
  file_path?: string
  offset?: number
  limit?: number
  pages?: string
}

/** 把长路径收敛为 `…/<dir>/<file>`,便于头部摘要展示 */
function shortenPath(path: string, maxLen = 48): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 2) return `…${path.slice(-(maxLen - 1))}`
  return `…/${parts.slice(-2).join('/')}`
}

/**
 * Agent SDK 的 Read 工具会在输出前加 `   1→` 风格的行号前缀,
 * 直接把这串喂给 shiki 会打断分词(数字 + → 被当成语法)。
 * 这里把行号前缀去掉,返回干净代码 + 起始行号,便于后续展示。
 *
 * 例如输入:
 *   ```
 *      1→import React from 'react'
 *      2→function App() { return <div /> }
 *   ```
 * 返回 { code: "import React...", startLine: 1 }
 */
function stripLineNumbers(text: string): { code: string; startLine: number | null } {
  const lines = text.split('\n')
  const rx = /^\s*(\d+)→(.*)$/
  let startLine: number | null = null
  const stripped: string[] = []
  let lineNumbersFound = 0
  for (const l of lines) {
    const m = l.match(rx)
    if (m) {
      if (startLine === null) startLine = Number(m[1])
      stripped.push(m[2])
      lineNumbersFound++
    } else {
      stripped.push(l)
    }
  }
  // 如果识别到的行号行少于一半,可能不是 Read 格式,整段保留原样
  if (lineNumbersFound < Math.max(1, lines.length / 2)) {
    return { code: text, startLine: null }
  }
  return { code: stripped.join('\n'), startLine }
}

/** fence 保护:content 含连续反引号时切 ~~~ */
function fenceCodeBlock(text: string, lang: string): string {
  const hasBigBacktick = /````+/.test(text)
  const fence = hasBigBacktick ? '~~~' : '```'
  return `${fence}${lang}\n${text}\n${fence}`
}

/**
 * Read 工具渲染器。
 * 展示被读取的文件路径 + 可选的行范围。
 *
 * P6+: 输出文本剥掉 Agent SDK 加的 "  N→" 行号前缀后,
 *      根据文件扩展名用 streamdown 代码块做 shiki 高亮。
 */
export const readRenderer: ToolRenderer = {
  Icon: FileText,
  getSummary: ({ input }) => {
    const p = (input as ReadInput)?.file_path
    return p ? shortenPath(p) : undefined
  },
  renderInput: ({ input }: ToolRenderContext) => {
    const { file_path, offset, limit, pages } = (input as ReadInput) || {}
    if (!file_path) return null
    const range =
      offset != null || limit != null
        ? ` · ${offset ?? 0}${limit != null ? `+${limit}` : ''}`
        : pages
          ? ` · pages ${pages}`
          : ''
    return (
      <div className="text-[11px] font-mono text-muted-foreground">
        <span className="text-foreground">{file_path}</span>
        {range}
      </div>
    )
  },
  renderOutput: ({ result, isError, input }: ToolRenderContext) => {
    if (!result) return null
    const text = extractResultText(result)
    if (isError) {
      // 错误信息保留 pre+红色,不走高亮
      return (
        <pre className="bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto font-mono text-red-400">
          {text}
        </pre>
      )
    }
    const filePath = (input as ReadInput)?.file_path
    const lang = guessLanguage(filePath)
    const { code, startLine } = stripLineNumbers(text)
    return (
      <div className="space-y-1">
        {startLine !== null && (
          <div className="text-[10px] text-muted-foreground">
            起始行 {startLine} · 语言 {lang}
          </div>
        )}
        <div className="text-[11px] max-h-[300px] overflow-y-auto">
          <MarkdownBlock>{fenceCodeBlock(code, lang)}</MarkdownBlock>
        </div>
      </div>
    )
  },
}
