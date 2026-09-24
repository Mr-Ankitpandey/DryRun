import type { ReactNode } from 'react';
import { cx } from './cx';

export interface FieldProps {
  /** id of the control this field labels. */
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode | undefined;
  /** Error message. When set the control should carry aria-invalid. */
  error?: ReactNode | undefined;
  /** id for the hint/error line so the control can reference it. */
  describedById: string;
  children: ReactNode;
  className?: string | undefined;
}

/** Label above, control, then one line of hint or error. The error has a
 *  cross glyph so it is not colour alone. */
export function Field({ htmlFor, label, hint, error, describedById, children, className }: FieldProps) {
  return (
    <div className={cx('flex w-full max-w-md flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-tight text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={describedById} role="alert" className="flex items-start gap-1.5 text-sm leading-tight text-red">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-px size-4 shrink-0 stroke-current" fill="none" strokeWidth="1.75">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={describedById} className="text-sm leading-tight text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared input classes for text-like controls. */
export const inputClass =
  'h-11 w-full rounded-sm border border-rule bg-surface px-3 text-base text-ink ' +
  'placeholder:text-ink-2 transition-colors duration-(--dur-xs) ' +
  'hover:border-ink-2 data-hover:border-ink-2 focus:border-ink ' +
  'aria-invalid:border-red disabled:bg-bg disabled:opacity-50';
