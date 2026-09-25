/** The one `<m.g>` every positioned primitive lives in, keyed by the prim id
 *  by its parent. The outer group travels (x/y on a spring, opacity fades in
 *  on enter); the inner group carries the pick-up-and-place arc: when x
 *  changes and the step says this element lifts, y runs [0, −10, 0] (over) or
 *  [0, +10, 0] (under) while x follows the spring. Shifts slide flat.
 *  Only transforms and opacity animate (DESIGN §3a). Hover publishes the id
 *  for linked views. */

import * as m from 'motion/react-m';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Id } from '@/engine/events';
import { useHoverHandlers, useLinked } from './HoverProvider';
import type { Lift } from './motion-hints';
import { useEnterInstant, useInstant, useTransition } from './MotionMode';
import type { RenderMotion } from './springs';

/** Height of the arc in scene units (DESIGN §3a). */
export const LIFT = 10;

export interface PrimGroupProps {
  id: Id;
  /** Secondary id this prim stands for (panel rows → node); hover on either links it. */
  linkRef?: Id | null;
  x: number;
  y: number;
  opacity?: number;
  kind?: RenderMotion;
  /** How this element travels in the current step. */
  lift?: Lift | undefined;
  children: (linked: boolean) => ReactNode;
}

const LIFT_VARIANTS = {
  rest: { y: 0 },
  over0: { y: [0, -LIFT, 0] },
  over1: { y: [0, -LIFT, 0] },
  under0: { y: [0, LIFT, 0] },
  under1: { y: [0, LIFT, 0] },
};

export function PrimGroup({ id, linkRef = null, x, y, opacity = 1, kind = 'move', lift, children }: PrimGroupProps) {
  const move = useTransition(kind);
  const fade = useTransition('fade');
  const liftT = useTransition('lift');
  const inst = useInstant();
  const enterInstant = useEnterInstant();
  const linked = useLinked(id, linkRef);
  const handlers = useHoverHandlers(id);
  // Each arcing x change flips the variant label (…0 ↔ …1) so the keyframes
  // run again; adjusting state during render is React's "derive from props" pattern.
  const [arc, setArc] = useState<{ x: number; label: keyof typeof LIFT_VARIANTS }>({ x, label: 'rest' });
  if (arc.x !== x) {
    const dir = lift === 'over' || lift === 'under' ? lift : null;
    const flip = arc.label.endsWith('0') ? '1' : '0';
    setArc({ x, label: dir && !inst ? (`${dir}${flip}` as keyof typeof LIFT_VARIANTS) : 'rest' });
  }
  return (
    <m.g
      data-id={id}
      data-linked={linked ? 'true' : undefined}
      initial={enterInstant ? false : { x, y, opacity: 0 }}
      animate={{ x, y, opacity }}
      transition={{ x: move, y: move, opacity: fade }}
      {...handlers}
    >
      <m.g initial={false} animate={arc.label} variants={LIFT_VARIANTS} transition={liftT}>
        {children(linked)}
      </m.g>
    </m.g>
  );
}
