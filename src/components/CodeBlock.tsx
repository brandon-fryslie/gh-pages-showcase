export interface CodeBlockProps {
  /** Code content to render. */
  code: string;
  /** Language hint shown in the upper-right corner. Decorative only. */
  language?: string;
  /** Optional className on the root. */
  className?: string;
}

/**
 * Plain `<pre><code>` styled. No syntax highlighting — keep it the consumer's
 * call to bring in highlight.js / shiki / prism if they want it. The block
 * stays useful without one.
 */
export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <div className={['sk-code', className].filter(Boolean).join(' ')}>
      {language ? <span className="sk-code-lang">{language}</span> : null}
      <pre className="sk-code-pre"><code>{code}</code></pre>
    </div>
  );
}
