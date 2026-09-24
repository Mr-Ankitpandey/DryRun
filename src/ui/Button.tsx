import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'quiet' | 'danger';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** `md` is the default 44 px tap target; `sm` (36 px) only inside dense rows. */
  size?: 'md' | 'sm';
  /** Optional leading icon (16 px). */
  icon?: ReactNode;
  children: ReactNode;
}

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-sm border font-medium leading-none ' +
  'whitespace-nowrap transition-colors duration-(--dur-xs) ease-(--ease-out) ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const sizes = {
  md: 'h-11 min-w-11 px-4 text-base',
  sm: 'h-9 min-w-9 px-3 text-sm',
} as const;

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-pen bg-pen text-bg hover:border-ink hover:bg-ink data-hover:border-ink data-hover:bg-ink',
  quiet:
    'border-rule bg-surface text-ink hover:border-ink data-hover:border-ink',
  danger:
    'border-red bg-surface text-red hover:bg-red hover:text-bg data-hover:bg-red data-hover:text-bg',
};

/** The one button. Primary is pen blue (one per screen), quiet is the default,
 *  danger is outlined red until hovered. */
export function Button({
  variant = 'quiet',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {icon ? (
        <span aria-hidden="true" className="-ml-1 inline-flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
