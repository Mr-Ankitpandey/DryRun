/** Primary navigation for the TopBar `end` slot (WP-F, site chrome). Props are
 *  frozen. Above 640 px: inline links; the current page is ink, medium weight
 *  and underlined (the underline is the non-colour cue). At 640 px and below:
 *  one "Menu" button that opens the design-system Dialog with the same list.
 *  The Dialog (and Motion with it) is loaded on first use, not with the page. */

import { Suspense, lazy, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/ui/Button';
import { NAV } from './config';

export interface SiteNavProps {
  /** Override the active item (defaults to the current path prefix). */
  current?: string;
}

const loadDialog = () => import('@/ui/Dialog').then((m) => ({ default: m.Dialog }));
const Dialog = lazy(loadDialog);

function isActive(active: string, href: string): boolean {
  return active === href || active.startsWith(`${href}/`);
}

const inlineLink =
  'relative inline-flex h-11 items-center px-2 text-sm text-ink-2 transition-colors duration-(--dur-xs) ease-(--ease-out) ' +
  'hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink ' +
  "aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-2 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-ink aria-[current=page]:after:content-['']";

const menuLink =
  'flex h-12 items-center justify-between px-1 text-base text-ink ' +
  'hover:bg-hatch aria-[current=page]:font-medium';

export function SiteNav({ current }: SiteNavProps) {
  const [location] = useLocation();
  const active = current ?? location;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const openMenu = () => {
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center min-[641px]:flex">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(active, item.href) ? 'page' : undefined} className={inlineLink}>
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openMenu}
        onPointerEnter={() => void loadDialog()}
        onFocus={() => void loadDialog()}
        className="inline-flex h-11 items-center gap-2 rounded-sm border border-rule bg-surface px-3 text-sm font-medium text-ink hover:border-ink min-[641px]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 stroke-current" fill="none" strokeWidth="1.75">
          <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
        </svg>
        Menu
      </button>

      {mounted ? (
        <Suspense fallback={null}>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Go to"
            actions={
              <Button onClick={() => setOpen(false)}>Close</Button>
            }
          >
            <nav aria-label="Primary">
              <ul className="-mx-1 divide-y divide-rule">
                <li>
                  <Link href="/" aria-current={active === '/' ? 'page' : undefined} onClick={() => setOpen(false)} className={menuLink}>
                    Home
                    {active === '/' ? <CurrentMark /> : null}
                  </Link>
                </li>
                {NAV.map((item) => {
                  const here = isActive(active, item.href);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={here ? 'page' : undefined} onClick={() => setOpen(false)} className={menuLink}>
                        {item.label}
                        {here ? <CurrentMark /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </Dialog>
        </Suspense>
      ) : null}
    </>
  );
}

/** "You are here" in words, not only in weight. */
function CurrentMark() {
  return <span className="text-sm font-normal text-ink-2">You are here</span>;
}
