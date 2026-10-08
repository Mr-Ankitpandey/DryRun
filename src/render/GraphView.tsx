/** Graph: fixed topology; edges under nodes (arcs with arrowheads when the
 *  graph is directed). Only marks and labels change.
 *  Weight badges are placed once per topology so they clear every node and
 *  its labels (./edge-badges). */

import { useMemo } from 'react';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { Arc } from './Arc';
import { placeWeightBadges } from './edge-badges';
import { Edge } from './Edge';
import { GNode } from './GNode';

export function GraphView({ scene }: { scene: Scene }) {
  const nodes = primsOf(scene, 'gnode');
  const edges = primsOf(scene, 'gedge');
  // Topology is fixed for a run: re-place only when a position or weight changes.
  const topo = nodes.map((n) => `${n.x},${n.y}`).join(';') + '|' + edges.map((e) => `${e.id}:${e.x1},${e.y1},${e.x2},${e.y2},${e.w}`).join(';');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const badges = useMemo(() => placeWeightBadges(nodes, edges, GRAPH_NODE_R), [topo]);
  if (nodes.length === 0) return null;
  return (
    <g data-view="graph">
      {edges.map((e) => {
        const b = badges.get(e.id);
        if (e.directed) return <Arc key={e.id} p={e} {...(b ? { badge: b } : {})} />;
        return <Edge key={e.id} p={e} {...(b ? { badge: b } : {})} />;
      })}
      {nodes.map((n) => (
        <GNode key={n.id} p={n} />
      ))}
    </g>
  );
}
