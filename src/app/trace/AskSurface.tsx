/** The in-flow question panel (desktop trace screen and the compact player):
 *  the same surface as the design system's Sheet in panel mode, rising on the
 *  sheet spring when it opens. It is drawn with Motion's `m` component so the
 *  landing hero does not pull the full `motion` bundle that src/ui's Sheet
 *  uses (reported as an interface change request). */

import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { useEnterInstant, useTransition } from '@/render/MotionMode';

export function AskSurface({ children, label = 'Question' }: { children: ReactNode; label?: string }) {
  const rise = useTransition('sheet');
  const inst = useEnterInstant();
  if (children === null || children === undefined || children === false) return null;
  return (
    <m.section aria-label={label} initial={inst ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise} className="w-full rounded-sm border border-rule bg-surface p-4 text-ink" data-testid="ask-surface">
      {children}
    </m.section>
  );
}
