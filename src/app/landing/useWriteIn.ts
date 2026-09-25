/** The one non-user-triggered motion on the site (docs/DESIGN.md §3a item 9):
 *  on first load the hero's array writes itself onto the grid cell by cell
 *  (stagger 30 ms, opacity + y 6 units), once, then waits for the click.
 *
 *  The array belongs to TracePlayer (WP-E) and its renderer (WP-A), so this
 *  finds the bars by the renderer's stable attributes (`[data-view=array]`,
 *  bar `<g data-id="e:…">`) and animates their *children* with the Web
 *  Animations API. The bar group's own transform stays Motion's. Only
 *  opacity and transform animate. If the markup is not found within 2 s the
 *  hook does nothing. Reduced motion (system or setting): nothing runs. */

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { durations, easingCss } from '@/ui/motion';

export const WRITE_IN_STAGGER_MS = 30;
const GIVE_UP_MS = 2000;
const BARS = '[data-view="array"] g[data-id^="e:"]';

export function writeIn(root: ParentNode): boolean {
  const bars = Array.from(root.querySelectorAll<SVGGElement>(BARS));
  if (bars.length === 0) return false;
  bars.forEach((bar, i) => {
    for (const child of Array.from(bar.children)) {
      if (typeof child.animate !== 'function') continue;
      child.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: durations.s, delay: i * WRITE_IN_STAGGER_MS, easing: easingCss.out, fill: 'backwards' },
      );
    }
  });
  return true;
}

/** Runs `writeIn` once for the subtree under `ref`, on mount. */
export function useWriteIn(ref: RefObject<HTMLElement | null>, reduced: boolean): void {
  useEffect(() => {
    const root = ref.current;
    if (reduced || !root) return;
    if (writeIn(root)) return;
    const observer = new MutationObserver(() => {
      if (writeIn(root)) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    const timer = setTimeout(() => observer.disconnect(), GIVE_UP_MS);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    // Once per mount by design: a later change of the preference must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
