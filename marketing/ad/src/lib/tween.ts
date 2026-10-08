/** Blends two consecutive scenes for a frame of the ad. The app animates with
 *  real-time springs; a video is rendered frame by frame, so here every frame
 *  is an explicit scene: numeric geometry is interpolated between scene k and
 *  k + 1 by id (the same stable ids the app animates), which keeps object
 *  constancy exact. Prims that only exist on one side switch at t = 0.5. */

import type { Scene } from '@/engine/scene';

type PrimLike = Record<string, unknown> & { kind: string; id: string };

/** Height of the pick-up-and-place arc (same as the app's LIFT). */
export const LIFT = 10;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ease in-out (cubic), the feel of the app's `inOut` easing. */
export function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function tweenScene(a: Scene, b: Scene, t: number): Scene {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const prims = new Map<string, unknown>();
  const late = t >= 0.5;
  for (const [id, pb] of b.prims) {
    const pa = a.prims.get(id) as PrimLike | undefined;
    const nb = pb as unknown as PrimLike;
    if (!pa || pa.kind !== nb.kind) {
      if (late) prims.set(id, pb);
      continue;
    }
    const out: PrimLike = { ...(late ? nb : pa) };
    for (const key of Object.keys(nb)) {
      const va = pa[key];
      const vb = nb[key];
      if (typeof va === 'number' && typeof vb === 'number') out[key] = lerp(va, vb, t);
    }
    // Pick up and place: an array element travelling sideways arcs (right: over,
    // left: under), so a swap's two elements pass each other without overlap.
    if (nb.kind === 'bar' && typeof pa.x === 'number' && typeof nb.x === 'number' && pa.x !== nb.x && typeof out.y === 'number') {
      out.y = out.y + (nb.x > pa.x ? -1 : 1) * LIFT * Math.sin(Math.PI * t);
    }
    prims.set(id, out);
  }
  if (!late) for (const [id, pa] of a.prims) if (!b.prims.has(id)) prims.set(id, pa);
  return { ...b, prims: prims as Scene['prims'], width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t) };
}
