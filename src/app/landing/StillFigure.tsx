/** One still from a real trace, drawn with the same renderers as the trace
 *  screen (Stage + ArrayView) in instant mode, so nothing on it animates. The
 *  reveal still adds the trace screen's own Ghost: the red-pencil dashed
 *  outline with an × badge (DESIGN §2 "error / ghost") on the learner's wrong
 *  pick, already sketched in. */

import type { Id } from '@/engine/events';
import type { Scene } from '@/engine/scene';
import type { Layout } from '@/engine/layout';
import { ArrayView } from '@/render/ArrayView';
import { Ghost } from '@/render/Ghost';
import { MotionModeProvider } from '@/render/MotionMode';
import { outlineOf } from '@/render/outline';
import { Stage } from '@/render/Stage';

export interface StillFigureProps {
  scene: Scene;
  layout: Layout;
  label: string;
  ghost?: Id | null;
}

export function StillFigure({ scene, layout, label, ghost = null }: StillFigureProps) {
  const outline = ghost ? outlineOf(scene, ghost, 4) : null;
  return (
    <MotionModeProvider reduced>
      <Stage scene={scene} label={label} minWidth={0}>
        <ArrayView scene={scene} layout={layout} />
        {ghost && outline ? (
          <g data-ghost={ghost}>
            <Ghost outline={outline} />
          </g>
        ) : null}
      </Stage>
    </MotionModeProvider>
  );
}
