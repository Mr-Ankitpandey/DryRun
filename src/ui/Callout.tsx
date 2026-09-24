import type { ReactNode } from 'react';
import { cx } from './cx';

export interface CalloutProps {
  /** Small label above the sentence; defaults to "Invariant". */
  label?: ReactNode;
  /** The sentence. Wrap live variables in <code> so they read as values. */
  children: ReactNode;
  className?: string;
}

/** The invariant sentence above the stage. The hatched strip on the left is
 *  the same 45° hatch the region uses on the stage, so the two read as one. */
export function Callout({ label = 'Invariant', children, className }: CalloutProps) {
  return (
    <aside
      aria-label={typeof label === 'string' ? label : undefined}
      className={cx('flex w-full max-w-prose overflow-hidden rounded-sm border border-rule bg-surface', className)}
    >
      <span aria-hidden="true" className="hatch-45 w-3 shrink-0 border-r border-rule" />
      <div className="min-w-0 px-3 py-2.5">
        <span className="block text-xs leading-tight text-ink-2">{label}</span>
        <p className="mt-0.5 text-base leading-snug text-ink [&_code]:rounded-xs [&_code]:bg-hatch [&_code]:px-1 [&_code]:text-[0.9375em]">
          {children}
        </p>
      </div>
    </aside>
  );
}
