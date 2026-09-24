import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { tabId, tabPanelId } from './tab-ids';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Base id for aria wiring; defaults to the label. */
  idBase?: string;
  className?: string;
}

/** Underlined tabs for switching views (code / variables). The current tab has
 *  a 2 px pen underline and ink text; the others are secondary. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idBase, className }: TabsProps<T>) {
  const base = idBase ?? label.toLowerCase().replace(/\s+/g, '-');
  const enabled = tabs.filter((t) => !t.disabled);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = enabled.findIndex((t) => t.id === value);
    if (idx < 0) return;
    let next: number;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else return;
    e.preventDefault();
    const target = enabled[next];
    if (!target) return;
    onChange(target.id);
    document.getElementById(tabId(base, target.id))?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('flex gap-1 border-b border-rule', className)}
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            id={tabId(base, t.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(base, t.id)}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px inline-flex h-11 min-w-11 select-none items-center border-b-2 px-3 text-sm font-medium leading-none',
              'transition-colors duration-(--dur-xs) ease-(--ease-out)',
              'border-transparent text-ink-2 hover:text-ink data-hover:text-ink',
              'aria-selected:border-pen aria-selected:text-ink',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
