/** The one `<motion.g>` every positioned primitive lives in: keyed by the prim
 *  id by its parent, animates x/y with a spring and opacity on enter/exit,
 *  publishes hover for linked views. Only transforms and opacity animate. */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { Id } from '@/engine/events';
import { useHoverHandlers, useLinked } from './HoverProvider';
import { useInstant, useTransition } from './MotionMode';
import type { SpringKind } from './springs';

export interface PrimGroupProps {
  id: Id;
  /** Secondary id this prim stands for (panel rows → node); hover on either links it. */
  linkRef?: Id | null;
  x: number;
  y: number;
  opacity?: number;
  kind?: SpringKind;
  children: (linked: boolean) => ReactNode;
}

export function PrimGroup({ id, linkRef = null, x, y, opacity = 1, kind = 'move', children }: PrimGroupProps) {
  const move = useTransition(kind);
  const fade = useTransition('fade');
  const inst = useInstant();
  const linked = useLinked(id, linkRef);
  const handlers = useHoverHandlers(id);
  return (
    <motion.g
      data-id={id}
      data-linked={linked ? 'true' : undefined}
      initial={inst ? false : { x, y, opacity: 0 }}
      animate={{ x, y, opacity }}
      exit={{ opacity: 0, transition: fade }}
      transition={{ ...move, opacity: fade }}
      {...handlers}
    >
      {children(linked)}
    </motion.g>
  );
}
