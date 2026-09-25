/** Recursion tree: one pill per call frame under the array, joined to its
 *  parent. Frames persist after they return (greyed, ticked). */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Edge } from './Edge';
import { Frame } from './Frame';

export function RecursionTree({ scene }: { scene: Scene }) {
  const frames = primsOf(scene, 'frame');
  if (frames.length === 0) return null;
  const edges = primsOf(scene, 'fedge');
  return (
    <g data-view="recursion">
      {edges.map((e) => (
        <Edge key={e.id} p={e} />
      ))}
      {frames.map((f) => (
        <Frame key={f.id} p={f} />
      ))}
    </g>
  );
}
