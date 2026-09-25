import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { buttonClass } from './Button';
import type { ButtonVariant } from './Button';
import { cx } from './cx';

export interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}

/** Navigation that looks like a Button. It stays an <a> so it opens in a new tab
 *  and reads as a link to screen readers. */
export function LinkButton({ href, variant = 'quiet', size = 'md', className, children, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}
