import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { useTransition } from './motion';
import { DESKTOP_QUERY, useMediaQuery } from './useMediaQuery';

export interface SheetProps {
  open: boolean;
  /** Accessible name and, when `showTitle`, the visible heading. */
  title: string;
  showTitle?: boolean;
  children: ReactNode;
  /** Close control in the corner; the ask sheet has none. */
  onClose?: () => void;
  /** `auto`: bottom sheet under 641 px, panel above. Force one for demos. */
  mode?: 'auto' | 'sheet' | 'panel';
  className?: string;
}

/** The ask container. On a phone it is pinned to the bottom edge in thumb
 *  reach and slides up with the sheet spring; on a desktop it is a panel in
 *  the flow. It is not modal: the stage stays visible and usable. */
export function Sheet({ open, title, showTitle = false, children, onClose, mode = 'auto', className }: SheetProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const asPanel = mode === 'panel' || (mode === 'auto' && desktop);
  const t = useTransition('sheet');
  const titleId = useId();

  const header =
    showTitle || onClose ? (
      <div className="mb-2 flex items-start justify-between gap-3">
        {showTitle ? (
          <h2 id={titleId} className="text-base font-medium text-ink">
            {title}
          </h2>
        ) : (
          <span />
        )}
        {onClose ? (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 inline-flex size-11 items-center justify-center rounded-sm text-ink-2 hover:text-ink data-hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 stroke-current" fill="none" strokeWidth="1.75">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    ) : null;

  const aria = showTitle ? { 'aria-labelledby': titleId } : { 'aria-label': title };

  return (
    <AnimatePresence initial={false}>
      {open ? (
        asPanel ? (
          <motion.section
            key="panel"
            {...aria}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={t}
            className={cx('w-full rounded-sm border border-rule bg-surface p-4 text-ink', className)}
          >
            {header}
            {children}
          </motion.section>
        ) : (
          <motion.section
            key="sheet"
            {...aria}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={t}
            className={cx(
              'fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface px-4 pt-3 text-ink',
              'pb-[max(1rem,env(safe-area-inset-bottom))]',
              className,
            )}
          >
            <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-xs bg-rule" />
            {header}
            {children}
          </motion.section>
        )
      ) : null}
    </AnimatePresence>
  );
}
