import { FilePen } from 'lucide-react'
import { useMemo } from 'react'
import { DiffView, DiffModeEnum } from '@git-diff-view/react'
import { generateDiffFile } from '@git-diff-view/file'
import '@git-diff-view/react/styles/diff-view-pure.css'
import type { ToolRenderer, ToolRenderContext } from './index'
import { guessLanguage } from './guess-language'

interface EditInput {
  file_path?: string
  old_string?: string
  new_string?: string
  replace_all?: boolean
  // MultiEdit fields (多段 edits 的 SDK 内部仅在 1 次调用里展开)
  edits?: Array<{ old_string: string; new_string: string; replace_all?: boolean }>
}

/** 把长路径收敛为 `…/<dir>/<file>`,便于头部摘要展示 */
function shortenPath(path: string, maxLen = 48): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 2) return `…${path.slice(-(maxLen - 1))}`
  return `…/${parts.slice(-2).join('/')}`
}

/** 把一组 (old,new) 顺序拼成旧/新全文，仅用于 diff-view 对比(非实际还原文件) */
function flattenEdits(input: EditInput): { oldText: string; newText: string } {
  if (Array.isArray(input.edits) && input.edits.length > 0) {
    return {
      oldText: input.edits.map((e) => e.old_string).join('\n\n— edit —\n\n'),
      newText: input.edits.map((e) => e.new_string).join('\n\n— edit —\n\n'),
    }
  }
  return {
    oldText: input.old_string || '',
    newText: input.new_string || '',
  }
}

function DiffBlock({ input }: { input: EditInput }) {
  const filename = input.file_path || 'file'
  const language = guessLanguage(input.file_path)
  const { oldText, newText } = flattenEdits(input)

  const diffFile = useMemo(() => {
    if (!oldText && !newText) return null
    try {
      const f = generateDiffFile(filename, oldText, filename, newText, language, language)
      if (!f) return null
      f.initTheme('light')
      f.init()
      f.buildSplitDiffLines()
      f.buildUnifiedDiffLines()
      return f
    } catch (e) {
      console.warn('[editRenderer] diff generation failed:', e)
      return null
    }
  }, [filename, language, oldText, newText])

  if (!diffFile) {
    return (
      <pre className="bg-muted/30 rounded p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
        {`- ${oldText}\n+ ${newText}`}
      </pre>
    )
  }

  return (
    <div className="rounded border border-border/30 overflow-hidden text-[11px]">
      <DiffView
        diffFile={diffFile}
        diffViewMode={DiffModeEnum.Unified}
        diffViewHighlight={false}
        diffViewWrap={true}
        diffViewFontSize={11}
      />
    </div>
  )
}

/**
 * Edit / MultiEdit 工具渲染器。
 * 复用项目已有的 @git-diff-view/react 组件直接展示 diff,与 FilesTab 的 DiffView 风格一致。
 */
export const editRenderer: ToolRenderer = {
  Icon: FilePen,
  getSummary: ({ input }) => {
    const p = (input as EditInput)?.file_path
    return p ? shortenPath(p) : undefined
  },
  renderInput: ({ input }: ToolRenderContext) => {
    const i = (input as EditInput) || {}
    if (!i.file_path && !i.old_string && !i.new_string && !i.edits) return null
    return (
      <div className="space-y-2">
        {i.file_path && (
          <div className="text-[11px] font-mono text-muted-foreground">
            <span className="text-foreground">{i.file_path}</span>
            {i.replace_all ? <span className="ml-1">· replace_all</span> : null}
            {Array.isArray(i.edits) ? <span className="ml-1">· {i.edits.length} edits</span> : null}
          </div>
        )}
        <DiffBlock input={i} />
      </div>
    )
  },
  // result 仅是 "File updated" 之类简短文字,走默认 pre 即可 → 沿用 default 的 renderOutput
  // 不覆盖 renderOutput, ToolCallCard 会 fallback 到 defaultRenderer.renderOutput
}
