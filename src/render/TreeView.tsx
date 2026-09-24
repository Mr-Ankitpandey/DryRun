/** BST: edges (keyed by child) under nodes. Both enter/exit through
 *  AnimatePresence; a relinked node's <g> is reused and travels. */

import { AnimatePresence } from 'motion/react';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Edge } from './Edge';
import { TNode } from './TNode';

export function TreeView({ scene }: { scene: Scene }) {
  const nodes = primsOf(scene, 'tnode');
  if (nodes.length === 0) return null;
  const edges = primsOf(scene, 'tedge');
  return (
    <g data-view="tree">
      <AnimatePresence initial={false}>
        {edges.map((e) => (
          <Edge key={e.id} p={e} />
        ))}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {nodes.map((n) => (
          <TNode key={n.id} p={n} />
        ))}
      </AnimatePresence>
    </g>
  );
}
