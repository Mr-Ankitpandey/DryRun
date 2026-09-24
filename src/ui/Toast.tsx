import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { useTransition } from './motion';

export interface ToastProps {
  open: boolean;
  /** One short sentence. */
  message: ReactNode;
  /** Optional single action ("Undo", "Re-trace"). */
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  /** `fixed` pins it above the bottom edge (default); `inline` renders in flow. */
  placement?: 'fixed' | 'inline';
  className?: string;
}

/** A short status line stamped in ink. Announced politely; never blocks. */
export function Toast({ open, message, action, onDismiss, placement = 'fixed', className }: ToastProps) {
  const t = useTransition('settle');
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        placement === 'fixed' &&
          'pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-start sm:inset-x-auto sm:left-4',
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={t}
            className={cx(
              'pointer-events-auto flex min-h-11 w-full max-w-md items-center gap-3 rounded-sm bg-ink py-2 pr-2 pl-4 text-bg',
            )}
          >
            <span className="flex-1 text-sm leading-snug">{message}</span>
            {action ? (
              <button
                type="button"
                onClick={action.onClick}
                className="h-8 shrink-0 rounded-xs px-2 text-sm font-medium text-bg underline decoration-bg/50 underline-offset-2 hover:decoration-bg data-hover:decoration-bg"
              >
                {action.label}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismiss}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xs text-bg/80 hover:text-bg data-hover:text-bg"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 stroke-current" fill="none" strokeWidth="1.75">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
