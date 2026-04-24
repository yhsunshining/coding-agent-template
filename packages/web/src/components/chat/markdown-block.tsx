import { Children, isValidElement } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { Streamdown } from 'streamdown'

/**
 * MarkdownBlock — 聊天 UI 里 Markdown 渲染的统一入口(P6+)。
 *
 * 基于 streamdown(内部已集成 shiki 语法高亮 + remark-gfm + KaTeX),
 * 统一我们项目的小字号 + daisyUI 风格的 prose 样式:
 *   - 代码块用 !text-xs 保持紧凑
 *   - 列表缩进 / 间距按聊天气泡的上下文调整
 *
 * 原先每个消费者(TaskChat / PlanModeCard / ToolRenderer)都要自己写一份 `mdComponents`,
 * 样式容易漂;全部迁移到此处后,调一次样式全站生效。
 *
 * 典型用法:
 *   <MarkdownBlock>{plan}</MarkdownBlock>
 *   <MarkdownBlock components={{ p: MyCustomP }}>{text}</MarkdownBlock>
 */

/** 聊天上下文下的 Markdown 默认组件映射 */
const defaultMdComponents = {
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => (
    <code className={`${className || ''} !text-xs`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
    <pre className="!text-xs" {...props}>
      {children}
    </pre>
  ),
  p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => <p {...props}>{children}</p>,
  ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="text-xs list-disc ml-4" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="text-xs list-decimal ml-4" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className="text-xs mb-2" {...props}>
      {/* streamdown 会插入一些非 element 中间节点,过滤一下避免 React key 报错 */}
      {Children.toArray(children).filter((c) => typeof c === 'string' || isValidElement(c))}
    </li>
  ),
}

/**
 * 兼容旧 API 的导出:其它组件里如果需要直接传给 Streamdown,
 * 可以 `<Streamdown components={mdComponents}>` 这样使用而不必引入 MarkdownBlock。
 */
export const mdComponents = defaultMdComponents

interface MarkdownBlockProps {
  children: string
  /** 传入则会在 defaults 之上 override 对应 tag */
  components?: Record<string, React.ComponentType<any>>
  /** 额外 className 包在 wrapper div 上 */
  className?: string
}

export function MarkdownBlock({ children, components, className }: MarkdownBlockProps) {
  const merged = components ? { ...defaultMdComponents, ...components } : defaultMdComponents
  // Streamdown 是直接渲染块级,如果需要统一的容器 padding,在外层 div 设置
  if (className) {
    return (
      <div className={className}>
        <Streamdown components={merged as any}>{children}</Streamdown>
      </div>
    )
  }
  return <Streamdown components={merged as any}>{children}</Streamdown>
}
