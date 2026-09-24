import type { ReactNode } from 'react';
import { cx } from './cx';

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** A key cap: mono, 24 px tall, heavier bottom rule like a real key. */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cx(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-rule border-b-2',
        'bg-surface px-1.5 align-middle font-mono text-xs leading-none text-ink',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
