/** BST: edges (keyed by child) under nodes. A relinked node's <g> is reused
 *  and travels. Entering nodes fade in; a removed node leaves at once (no
 *  AnimatePresence: an exit still running when stepping back re-adds the same
 *  key is how Motion 13 strands elements at opacity 0). */

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
      {edges.map((e) => (
        <Edge key={e.id} p={e} />
      ))}
      {nodes.map((n) => (
        <TNode key={n.id} p={n} />
      ))}
    </g>
  );
}
