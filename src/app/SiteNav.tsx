/** Primary navigation for the TopBar `end` slot. Owned by WP-F (site chrome);
 *  this is the minimal version other screens import meanwhile. Props are frozen. */

import { Link, useLocation } from 'wouter';
import { NAV } from './config';

export interface SiteNavProps {
  /** Override the active item (defaults to the current path prefix). */
  current?: string;
}

export function SiteNav({ current }: SiteNavProps) {
  const [location] = useLocation();
  const active = current ?? location;
  return (
    <nav aria-label="Primary" className="flex items-center gap-3 text-sm">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} aria-current={active.startsWith(item.href) ? 'page' : undefined} className="text-ink-2 aria-[current=page]:text-ink">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
