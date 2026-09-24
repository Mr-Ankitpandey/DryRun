import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Level". */
  label: string;
  size?: 'md' | 'sm';
  className?: string;
}

/** A row of keys for a small set of modes (level, code/viz). Each segment is a
 *  full 44 px target; the selected one is filled ink, like a pressed key. Arrow
 *  keys move the selection. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className }: SegmentedProps<T>) {
  const enabled = options.filter((o) => !o.disabled);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = enabled.findIndex((o) => o.value === value);
    if (idx < 0 || enabled.length === 0) return;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else return;
    e.preventDefault();
    const target = enabled[next];
    if (!target) return;
    onChange(target.value);
    const el = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${target.value}"]`);
    el?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('inline-flex', size === 'md' ? 'h-11' : 'h-9', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={o.value}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative -ml-px inline-flex h-full min-w-11 select-none items-center justify-center border px-3 font-medium leading-none',
              'first:ml-0 first:rounded-l-sm last:rounded-r-sm',
              'transition-colors duration-(--dur-xs) ease-(--ease-out)',
              size === 'md' ? 'text-sm' : 'text-xs',
              'border-rule bg-surface text-ink-2 hover:z-10 hover:border-ink-2 hover:text-ink data-hover:z-10 data-hover:border-ink-2 data-hover:text-ink',
              'focus-visible:z-20 aria-checked:z-10 aria-checked:border-ink aria-checked:bg-ink aria-checked:text-bg',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
