/** Overlay marks for the ad's stages: the app's real Ghost and CorrectRing,
 *  faded in by frame (the app sketches them with springs), and a tap ripple
 *  that shows where a learner pressed. All in scene coordinates. */

import { interpolate, useCurrentFrame } from 'remotion';
import type { Id } from '@/engine/events';
import type { Scene } from '@/engine/scene';
import { CorrectRing } from '@/render/CorrectRing';
import { Ghost } from '@/render/Ghost';
import { outlineOf } from '@/render/outline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function FadeGhost({ scene, id, from }: { scene: Scene; id: Id; from: number }) {
  const frame = useCurrentFrame();
  const o = outlineOf(scene, id, 5);
  if (!o || frame < from) return null;
  return (
    <g opacity={interpolate(frame, [from, from + 8], [0, 1], clamp)}>
      <Ghost outline={o} />
    </g>
  );
}

export function FadeRing({ scene, id, from, tone = 'correct' }: { scene: Scene; id: Id; from: number; tone?: 'correct' | 'truth' }) {
  const frame = useCurrentFrame();
  const o = outlineOf(scene, id, 5);
  if (!o || frame < from) return null;
  return (
    <g opacity={interpolate(frame, [from, from + 8], [0, 1], clamp)}>
      <CorrectRing outline={o} tone={tone} />
    </g>
  );
}

/** A finger tap: a dot and a ring that widens and fades. */
export function Tap({ scene, id, at }: { scene: Scene; id: Id; at: number }) {
  const frame = useCurrentFrame();
  const o = outlineOf(scene, id, 0);
  if (!o || frame < at - 4 || frame > at + 18) return null;
  const t = interpolate(frame, [at, at + 16], [0, 1], clamp);
  const press = interpolate(frame, [at - 4, at, at + 6], [0, 1, 0], clamp);
  return (
    <g transform={`translate(${o.cx} ${o.cy})`} pointerEvents="none">
      <circle r={10 + 26 * t} fill="none" stroke="var(--ink)" strokeWidth={2} opacity={0.5 * (1 - t)} />
      <circle r={9} fill="var(--ink)" opacity={0.35 * press} />
    </g>
  );
}
