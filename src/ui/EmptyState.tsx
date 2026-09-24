import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  title: ReactNode;
  /** One or two sentences: what this is and what to do. */
  children?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  className?: string;
}

/** An empty list or bank. The sketch is three dashed cells: an array with
 *  nothing written in it yet. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex max-w-md flex-col items-start gap-3 py-6', className)}>
      <svg aria-hidden="true" viewBox="0 0 88 32" className="h-8 w-22 stroke-ink-2" fill="none" strokeWidth="1.5">
        <rect x="1" y="1" width="26" height="30" strokeDasharray="3 3" />
        <rect x="31" y="1" width="26" height="30" strokeDasharray="3 3" />
        <rect x="61" y="1" width="26" height="30" strokeDasharray="3 3" />
      </svg>
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {children ? <p className="text-base text-ink-2">{children}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
