import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Field } from './Field';
import { cx } from './cx';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className' | 'value' | 'onChange'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: ReadonlyArray<SelectOption<T>>;
  value: T;
  onChange: (value: T) => void;
  id?: string;
  className?: string;
}

/** A native select with the paper styling and a drawn chevron. Native keeps the
 *  phone's own picker, which is the right thing on a bus. */
export function Select<T extends string>({ label, hint, error, options, value, onChange, id, className, ...rest }: SelectProps<T>) {
  const auto = useId();
  const selectId = id ?? `sel-${auto}`;
  const descId = `${selectId}-desc`;
  const described = error || hint ? descId : undefined;
  return (
    <Field htmlFor={selectId} label={label} hint={hint} error={error} describedById={descId} className={className}>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value as T)}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={cx(
            'h-11 w-full appearance-none rounded-sm border border-rule bg-surface pr-10 pl-3 text-base text-ink',
            'transition-colors duration-(--dur-xs) hover:border-ink-2 data-hover:border-ink-2 focus:border-ink',
            'aria-invalid:border-red disabled:bg-bg disabled:opacity-50',
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 stroke-ink-2"
          fill="none"
          strokeWidth="1.75"
        >
          <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Field>
  );
}
