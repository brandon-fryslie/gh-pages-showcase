import type { ReactNode } from 'react';

export interface MetadataLink {
  label: string;
  href: string;
}

export interface MetadataFooterProps {
  /** GitHub repo URL. Renders as a primary link. */
  github?: string;
  /** License identifier, e.g. "MIT". */
  license?: string;
  /** One-line install command, rendered in monospace. */
  install?: string;
  /** Primary language tag. */
  language?: string;
  /** Additional named links (docs, changelog, etc.). */
  links?: ReadonlyArray<MetadataLink>;
  /** Free-form trailing content (copyright, disclaimer, etc.). */
  trailing?: ReactNode;
  className?: string;
}

export function MetadataFooter({
  github,
  license,
  install,
  language,
  links,
  trailing,
  className,
}: MetadataFooterProps) {
  return (
    <footer className={['sk-meta-footer', className].filter(Boolean).join(' ')}>
      <div className="sk-meta-inner">
        {install ? (
          <div className="sk-meta-install">
            <span className="sk-meta-label">Install</span>
            <code className="sk-meta-code">{install}</code>
          </div>
        ) : null}
        <div className="sk-meta-links">
          {github ? (
            <a className="sk-meta-link sk-meta-link-primary" href={github} rel="noopener noreferrer">
              View on GitHub
            </a>
          ) : null}
          {links?.map((l) => (
            <a key={l.href} className="sk-meta-link" href={l.href} rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </div>
        <div className="sk-meta-tags">
          {language ? <span className="sk-meta-tag">{language}</span> : null}
          {license ? <span className="sk-meta-tag">{license}</span> : null}
        </div>
        {trailing ? <div className="sk-meta-trailing">{trailing}</div> : null}
      </div>
    </footer>
  );
}
