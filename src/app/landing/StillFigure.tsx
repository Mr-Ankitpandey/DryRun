/** One still from a real trace, drawn with the same renderers as the trace
 *  screen (Stage + ArrayView) in instant mode, so nothing on it animates. The
 *  reveal still adds the ghost: the red-pencil dashed outline with an × badge
 *  (DESIGN §2 "error / ghost") on the learner's wrong pick. */

import type { Id } from '@/engine/events';
import type { Scene } from '@/engine/scene';
import type { Layout } from '@/engine/layout';
import { ArrayView } from '@/render/ArrayView';
import { MotionModeProvider } from '@/render/MotionMode';
import { Stage } from '@/render/Stage';

export interface StillFigureProps {
  scene: Scene;
  layout: Layout;
  label: string;
  ghost?: Id | null;
}

function Ghost({ scene, id }: { scene: Scene; id: Id }) {
  const p = scene.prims.get(id);
  if (!p || p.kind !== 'bar') return null;
  const x = p.x - 2;
  const y = p.y - 5;
  const w = p.w + 4;
  const h = p.h + 10;
  return (
    <g data-ghost={id} aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} rx={3} fill="var(--red)" fillOpacity={0.08} stroke="var(--red)" strokeWidth={2} strokeDasharray="5 4" />
      <g transform={`translate(${x + w} ${y})`}>
        <circle r={8} fill="var(--red)" />
        <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="var(--surface)" strokeWidth={1.75} strokeLinecap="round" />
      </g>
    </g>
  );
}

export function StillFigure({ scene, layout, label, ghost = null }: StillFigureProps) {
  return (
    <MotionModeProvider reduced>
      <Stage scene={scene} label={label} minWidth={0}>
        <ArrayView scene={scene} layout={layout} />
        {ghost ? <Ghost scene={scene} id={ghost} /> : null}
      </Stage>
    </MotionModeProvider>
  );
}
