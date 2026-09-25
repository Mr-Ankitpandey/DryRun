/** Graph: fixed topology; edges under nodes. Only marks and labels change. */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Edge } from './Edge';
import { GNode } from './GNode';

export function GraphView({ scene }: { scene: Scene }) {
  const nodes = primsOf(scene, 'gnode');
  if (nodes.length === 0) return null;
  const edges = primsOf(scene, 'gedge');
  return (
    <g data-view="graph">
      {edges.map((e) => (
        <Edge key={e.id} p={e} />
      ))}
      {nodes.map((n) => (
        <GNode key={n.id} p={n} />
      ))}
    </g>
  );
}
