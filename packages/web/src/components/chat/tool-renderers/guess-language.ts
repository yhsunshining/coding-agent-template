/**
 * 根据文件名/路径猜测语言 ID,用于 streamdown/shiki 代码块高亮
 * 以及 @git-diff-view 的 language prop。
 *
 * 未命中时返回 'text' — streamdown 会退化为无高亮代码块。
 */

const EXT_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  vue: 'vue',
  svelte: 'svelte',
}

/**
 * 根据文件路径推断语言 id。未知扩展名返回 'text'。
 */
export function guessLanguage(filePath?: string): string {
  if (!filePath) return 'text'
  const basename = filePath.split('/').pop() || filePath
  const lower = basename.toLowerCase()

  // 先匹配完整文件名(Dockerfile / Makefile 等无扩展名文件)
  if (lower === 'dockerfile') return 'dockerfile'
  if (lower === 'makefile') return 'makefile'

  const dot = basename.lastIndexOf('.')
  if (dot < 0) return 'text'
  const ext = basename.slice(dot + 1).toLowerCase()
  return EXT_LANG_MAP[ext] || 'text'
}
