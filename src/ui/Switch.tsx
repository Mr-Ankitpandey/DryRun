import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label; rendered to the left of the track. */
  label: ReactNode;
  /** Secondary line under the label. */
  hint?: ReactNode;
}

/** A slide switch. The knob position is the non-color cue; the track turns pen
 *  blue when on. The whole row is the 44 px tap target. */
export function Switch({ checked, onChange, label, hint, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'group inline-flex min-h-11 w-full max-w-md select-none items-center justify-between gap-4 rounded-sm text-left',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-base leading-tight text-ink">{label}</span>
        {hint ? <span className="mt-0.5 text-sm leading-tight text-ink-2">{hint}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-block h-6 w-11 shrink-0 rounded-sm border transition-colors duration-(--dur-xs)',
          'border-rule bg-bg group-hover:border-ink-2 group-data-hover:border-ink-2',
          'group-aria-checked:border-pen group-aria-checked:bg-pen',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 block size-4 rounded-xs border border-rule bg-surface',
            'transition-transform duration-(--dur-s) ease-(--ease-out)',
            'group-aria-checked:translate-x-5 group-aria-checked:border-pen',
          )}
        />
      </span>
    </button>
  );
}
