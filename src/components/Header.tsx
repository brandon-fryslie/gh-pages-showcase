import type { ReactNode } from 'react';

export interface HeaderProps {
  /** Small line above the name, e.g. "an experiment by brandon-fryslie". */
  eyebrow?: ReactNode;
  /** Project name. Renders as the main heading. */
  name: ReactNode;
  /** One-line description below the name. */
  tagline?: ReactNode;
  /** Tag chips to the right of the heading (e.g. "MCP server", "TypeScript"). */
  badges?: ReadonlyArray<string>;
  /** CTA buttons below the tagline. */
  actions?: ReactNode;
  /** Optional className on the root. */
  className?: string;
}

export function Header({
  eyebrow,
  name,
  tagline,
  badges,
  actions,
  className,
}: HeaderProps) {
  return (
    <header className={['sk-header', className].filter(Boolean).join(' ')}>
      <div className="sk-header-inner">
        {eyebrow ? <p className="sk-header-eyebrow">{eyebrow}</p> : null}
        <h1 className="sk-header-name">{name}</h1>
        {tagline ? <p className="sk-header-tagline">{tagline}</p> : null}
        {badges && badges.length > 0 ? (
          <ul className="sk-header-badges">
            {badges.map((b) => (
              <li key={b} className="sk-header-badge">{b}</li>
            ))}
          </ul>
        ) : null}
        {actions ? <div className="sk-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
