import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field, inputClass } from './Field';
import { cx } from './cx';

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'className' | 'value' | 'onChange'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Controlled value; null when the field is empty or unparsable. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Unit shown after the number ("ms", "items"). */
  suffix?: ReactNode;
  id?: string;
  className?: string;
}

/** A numeric input in the mono face (values always read as values). */
export function NumberField({ label, hint, error, value, onChange, suffix, id, className, ...rest }: NumberFieldProps) {
  const auto = useId();
  const inputId = id ?? `nf-${auto}`;
  const descId = `${inputId}-desc`;
  const described = error || hint ? descId : undefined;
  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error} describedById={descId} className={className}>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            if (raw === '') return onChange(null);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={cx(inputClass, 'font-mono', suffix ? 'pr-12' : undefined)}
          {...rest}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center font-mono text-sm text-ink-2"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}
