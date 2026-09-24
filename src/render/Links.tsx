/** Transient connectors (compare brackets, DP dependency arrows) drawn on top
 *  of every view; they appear for one step and fade out. */

import { AnimatePresence } from 'motion/react';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Link } from './Link';

export function Links({ scene }: { scene: Scene }) {
  const links = primsOf(scene, 'link');
  return (
    <g data-view="links">
      <AnimatePresence initial={false}>
        {links.map((l) => (
          <Link key={l.id} p={l} scene={scene} />
        ))}
      </AnimatePresence>
    </g>
  );
}
