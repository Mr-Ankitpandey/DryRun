import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field, inputClass } from './Field';
import { cx } from './cx';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'className'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Use the mono face (custom inputs such as "3, 7, 9, 12"). */
  mono?: boolean;
  id?: string;
  className?: string;
}

/** A single-line text input with label, hint and error. */
export function TextField({ label, hint, error, mono, id, className, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? `tf-${auto}`;
  const descId = `${inputId}-desc`;
  const described = error || hint ? descId : undefined;
  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error} describedById={descId} className={className}>
      <input
        id={inputId}
        type="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={cx(inputClass, mono && 'font-mono')}
        {...rest}
      />
    </Field>
  );
}
