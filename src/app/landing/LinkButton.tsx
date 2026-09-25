/** A navigation link dressed as the design-system Button (same classes as
 *  src/ui/Button.tsx primary/quiet, md size). Navigation must be an <a> so it
 *  can be opened in a new tab and read as a link; Button renders a <button>.
 *  Interface request filed in the WP-F report: an `href` form of Button in
 *  src/ui, after which this file goes away. */

import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { cx } from '@/ui/cx';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-sm border font-medium leading-none ' +
  'whitespace-nowrap transition-colors duration-(--dur-xs) ease-(--ease-out) active:translate-y-px ' +
  'h-11 min-w-11 px-4 text-base';

const variants = {
  primary: 'border-pen bg-pen text-bg hover:border-ink hover:bg-ink',
  quiet: 'border-rule bg-surface text-ink hover:border-ink',
} as const;

export interface LinkButtonProps {
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}

export function LinkButton({ href, variant = 'quiet', className, children, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} className={cx(base, variants[variant], className)} {...rest}>
      {children}
    </Link>
  );
}
