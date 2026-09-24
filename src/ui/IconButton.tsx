import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** Accessible name; also the tooltip. Required. */
  label: string;
  /** An SVG using currentColor, ideally 20 px. */
  children: ReactNode;
  variant?: 'quiet' | 'primary' | 'bare';
  /** Toggle buttons expose their state. */
  pressed?: boolean;
}

const variants = {
  quiet: 'border border-rule bg-surface text-ink hover:border-ink data-hover:border-ink aria-pressed:bg-ink aria-pressed:text-bg aria-pressed:border-ink',
  primary: 'border border-pen bg-pen text-bg hover:bg-ink hover:border-ink data-hover:bg-ink data-hover:border-ink',
  bare: 'border border-transparent text-ink-2 hover:text-ink data-hover:text-ink aria-pressed:text-ink aria-pressed:bg-hatch',
} as const;

/** A 44 px square button with an icon and a required label. */
export function IconButton({
  label,
  children,
  variant = 'quiet',
  pressed,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(
        'inline-flex size-11 shrink-0 select-none items-center justify-center rounded-sm leading-none',
        'transition-colors duration-(--dur-xs) ease-(--ease-out) active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex size-5 items-center justify-center">
        {children}
      </span>
    </button>
  );
}
