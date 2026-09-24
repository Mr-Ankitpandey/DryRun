import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { cx } from './cx';

export interface TopBarProps {
  /** What this screen is, next to the wordmark ("Binary search", "Styleguide"). */
  title?: ReactNode;
  /** Controls that belong to the screen (variant, level). */
  children?: ReactNode;
  /** Right edge: step counter, help. */
  end?: ReactNode;
  wordmarkHref?: string;
  className?: string;
}

/** 56 px bar on a surface with a bottom rule. The wordmark is the only place
 *  the display face appears in chrome. */
export function TopBar({ title, children, end, wordmarkHref = '/', className }: TopBarProps) {
  return (
    <header
      className={cx(
        'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-surface px-4 text-ink sm:gap-4',
        className,
      )}
    >
      <Link href={wordmarkHref} className="font-display shrink-0 rounded-xs text-xl leading-none">
        DryRun
      </Link>
      {title ? (
        <>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
          <span className="min-w-0 truncate text-base text-ink">{title}</span>
        </>
      ) : null}
      {children ? <div className="flex min-w-0 items-center gap-2">{children}</div> : null}
      {end ? <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div> : null}
    </header>
  );
}
