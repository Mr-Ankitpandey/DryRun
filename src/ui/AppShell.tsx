import type { ReactNode } from 'react';
import { cx } from './cx';

export interface AppShellProps {
  /** Usually a <TopBar>. */
  topBar?: ReactNode;
  children: ReactNode;
  /** Pinned under the content (timeline strip, ask sheet on desktop). */
  bottom?: ReactNode;
  /** `content`: left-aligned column, max 72 rem, 16 px gutter. `full`: edge to edge. */
  width?: 'content' | 'full';
  className?: string;
}

/** Page frame: skip link, top bar, main, optional bottom slot. The page itself
 *  is the paper (body carries the grid); panels are surfaces placed on it. */
export function AppShell({ topBar, children, bottom, width = 'content', className }: AppShellProps) {
  return (
    <div className={cx('flex min-h-dvh flex-col text-ink', className)}>
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-surface px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {topBar}
      <main id="main" className={cx('flex-1', width === 'content' ? 'w-full max-w-6xl px-4 py-6' : 'w-full')}>
        {children}
      </main>
      {bottom}
    </div>
  );
}
