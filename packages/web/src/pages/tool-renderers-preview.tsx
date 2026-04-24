/**
 * DEV-ONLY 预览页: /__preview/tool-renderers
 *
 * 用不同 toolName + mock input/result 逐一渲染所有注册的工具渲染器,
 * 供开发期肉眼验证 P6 重构的视觉效果。生产环境不要链接到这里。
 */
import { ToolCallCard } from '@/components/chat/tool-call-card'
import { TOOL_RENDERERS } from '@/components/chat/tool-renderers'
import { PlanModeCard } from '@/components/chat/plan-mode-card'
import { MarkdownBlock } from '@/components/chat/markdown-block'

type MockCase = {
  toolName: string
  input: unknown
  result?: string
  isError?: boolean
  isPending?: boolean
  note?: string
}

/** 每种工具给 1~2 个典型样本 */
const CASES: MockCase[] = [
  // Bash
  {
    toolName: 'Bash',
    input: {
      command: 'ls -la && cat package.json | head -5',
      description: 'List project files and show package.json head',
    },
    result: JSON.stringify({
      type: 'text',
      text: 'total 24\ndrwxr-xr-x  5 root  root  160 Apr 24 10:00 .\n-rw-r--r--  1 root  root  1024 Apr 24 09:00 package.json',
    }),
    note: 'Bash: P6+ shiki 高亮命令 + 纯文本输出',
  },
  {
    toolName: 'Bash',
    input: {
      command: 'for i in 1 2 3; do\n  echo "iter $i"\n  curl -s https://api.example.com/item/$i\ndone',
      description: 'Loop over items',
    },
    result: 'iter 1\n{"ok":true}\niter 2\n{"ok":true}\niter 3\n{"ok":false}',
    note: 'Bash: P6+ 多行脚本高亮',
  },
  {
    toolName: 'Bash',
    input: { command: 'npm test' },
    result: 'Error: command failed with exit code 1',
    isError: true,
    note: 'Bash: 失败态(红色输出)',
  },

  // Read
  {
    toolName: 'Read',
    input: { file_path: '/Users/yang/project/packages/web/src/main.tsx', offset: 10, limit: 50 },
    result: JSON.stringify({
      type: 'text',
      text:
        '     1→import React from "react"\n' +
        '     2→import ReactDOM from "react-dom/client"\n' +
        '     3→\n' +
        '     4→function App() {\n' +
        '     5→  return <div>Hello</div>\n' +
        '     6→}\n' +
        '     7→\n' +
        '     8→ReactDOM.createRoot(document.getElementById("root")!).render(<App />)',
    }),
    note: 'Read: P6+ 去行号 + shiki 高亮',
  },

  // Write
  {
    toolName: 'Write',
    input: {
      file_path: '/Users/yang/project/src/Counter.tsx',
      content:
        'import { useState } from "react"\n\n' +
        'export function Counter() {\n' +
        '  const [count, setCount] = useState(0)\n' +
        '  return (\n' +
        '    <button onClick={() => setCount(c => c + 1)}>\n' +
        '      Clicked {count} times\n' +
        '    </button>\n' +
        '  )\n' +
        '}\n',
    },
    result: JSON.stringify({ type: 'text', text: 'File created successfully' }),
    note: 'Write: P6+ 按 .tsx 高亮 (TypeScript JSX)',
  },
  {
    toolName: 'Write',
    input: {
      file_path: '/Users/yang/project/data.json',
      content: '{\n  "name": "demo",\n  "version": "1.0.0",\n  "items": [1, 2, 3]\n}\n',
    },
    note: 'Write: P6+ JSON 高亮',
  },

  // Edit
  {
    toolName: 'Edit',
    input: {
      file_path: '/Users/yang/project/foo.ts',
      old_string: 'export const hello = "world"',
      new_string: 'export const hello = "universe"',
      replace_all: false,
    },
    result: JSON.stringify({ type: 'text', text: 'File edited successfully' }),
    note: 'Edit: 集成 diff view',
  },

  // Grep
  {
    toolName: 'Grep',
    input: { pattern: 'useAtom\\(planMode', type: 'ts', glob: '**/*.ts', output_mode: 'content', '-i': false },
    result: JSON.stringify({
      type: 'text',
      text: '/Users/yang/hooks/use-chat-stream.ts:66: const [planMode, setPlanMode] = useAtom(planModeAtomFamily(taskId))',
    }),
    note: 'Grep: 带 type/glob/mode 限定',
  },

  // Glob
  {
    toolName: 'Glob',
    input: { pattern: '**/*.tsx', path: '/Users/yang/project/packages/web/src' },
    result: '...(128 files matched)',
    note: 'Glob: pattern + 搜索起点',
  },

  // WebFetch
  {
    toolName: 'WebFetch',
    input: { url: 'https://docs.anthropic.com/en/api/overview', prompt: '总结 API 使用要点' },
    result: 'Claude API 概述页面内容...',
    note: 'WebFetch: URL (可点击) + prompt',
  },

  // WebSearch
  {
    toolName: 'WebSearch',
    input: {
      query: 'React 19 新特性 2024',
      allowed_domains: ['react.dev', 'github.com'],
    },
    result: '10 results found',
    note: 'WebSearch: query + 域名过滤',
  },

  // TodoWrite
  {
    toolName: 'TodoWrite',
    input: {
      todos: [
        { content: '创建项目骨架', activeForm: '创建中', status: 'completed' },
        { content: '实现 TodoList 组件', activeForm: '编写中', status: 'in_progress' },
        { content: '添加持久化', activeForm: '开发', status: 'pending' },
        { content: '集成测试', activeForm: '测试', status: 'pending' },
      ],
    },
    note: 'TodoWrite: 带状态图标的列表(完成/进行中/待办)',
  },

  // Task / Agent
  {
    toolName: 'Task',
    input: {
      description: 'Audit branch readiness',
      prompt: 'Check git status, list uncommitted changes, verify tests pass, report under 200 words.',
      subagent_type: 'general-purpose',
      model: 'haiku',
    },
    result: 'Subagent completed with summary.',
    note: 'Task: 子代理描述 + prompt 摘要',
  },

  // MCP 工具(剥前缀)
  {
    toolName: 'mcp__cloudbase__listEnv',
    input: { action: 'list' },
    result: JSON.stringify({ type: 'text', text: '[{"EnvId":"abc","Alias":"demo"}]' }),
    note: 'MCP 工具: 自动剥掉 mcp__cloudbase__ 前缀,fallback 到 default',
  },

  // 默认 fallback
  {
    toolName: 'UnknownTool_42',
    input: { foo: 'bar', nested: { baz: [1, 2, 3] } },
    result: 'some plain output',
    note: 'Unknown: 走 default(Wrench 图标 + JSON)',
  },

  // Pending 状态
  {
    toolName: 'Bash',
    input: { command: 'npm run build' },
    isPending: true,
    note: 'Pending: 蓝色 Loader 图标',
  },
]

export function ToolRenderersPreviewPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 bg-background text-foreground min-h-screen">
      <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
        ⚠️ DEV-only 预览页 · 仅用于肉眼验证工具渲染器视觉效果 · 生产构建会自动移除此路由
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">Tool Renderers Preview (P6)</h1>
        <p className="text-sm text-muted-foreground">
          注册了 {Object.keys(TOOL_RENDERERS).length} 个工具渲染器。点击卡片展开查看详情。
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          已注册: <code className="text-[11px]">{Object.keys(TOOL_RENDERERS).join(', ')}</code>
        </p>
      </div>

      <div className="space-y-6">
        {CASES.map((c, i) => (
          <section key={i} className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono bg-muted rounded px-2 py-0.5">{c.toolName}</span>
              <span className="text-muted-foreground">— {c.note}</span>
            </div>
            <ToolCallCard
              toolName={c.toolName}
              toolCallId={`mock_${i}`}
              input={c.input}
              result={c.result}
              isError={c.isError}
              isPending={c.isPending ?? false}
            />
          </section>
        ))}
      </div>

      {/* P6+: MarkdownBlock 通用渲染示例 */}
      <section className="space-y-2 pt-6 border-t border-border">
        <h2 className="text-lg font-semibold">MarkdownBlock (P6+)</h2>
        <div className="bg-muted/30 rounded p-3">
          <MarkdownBlock>{`### 这是三级标题

这是一个**加粗**文本,带 \`inline code\` 和 [链接](https://example.com)。

列表项:
- 第一项
- 第二项 \`code\`

\`\`\`tsx
import { useState } from 'react'

export function Demo() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>{n}</button>
}
\`\`\`

\`\`\`bash
# shiki 也能高亮 shell 脚本
echo "hello" | tr 'a-z' 'A-Z'
\`\`\`
`}</MarkdownBlock>
        </div>
      </section>

      {/* P6+: PlanModeCard 预览 */}
      <section className="space-y-2 pt-6 border-t border-border">
        <h2 className="text-lg font-semibold">PlanModeCard (P2 + P6+)</h2>
        <p className="text-xs text-muted-foreground">Plan 内容用 MarkdownBlock 渲染,代码块获得 shiki 高亮</p>
        <PlanModeCard
          isSending={false}
          onDecision={(action) => console.log('[preview] decision:', action)}
          planContent={`## 实现计数器组件

### 步骤
1. 创建 \`src/components/Counter.tsx\`
2. 使用 React hooks 管理状态
3. 添加 Tailwind 样式

### 代码示例
\`\`\`tsx
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button className="btn btn-primary" onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
\`\`\`

### 测试计划
- [ ] 初始显示 Count: 0
- [ ] 点击后递增
- [ ] 样式符合 daisyUI`}
        />
      </section>
    </div>
  )
}
