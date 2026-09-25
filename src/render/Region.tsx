/** An invariant region over a run of array slots: 45° hatch, a dashed outline
 *  and its name on a bracket above; 'eliminated' uses cross-hatch. Always
 *  mounted once declared so it grows and shrinks continuously.
 *
 *  Ruler motion (DESIGN §3a.5) with transforms only: the tint and outline are
 *  a unit rect scaled along x from the region's anchor edge (non-scaling
 *  stroke), on the `ruler` tween. The hatch lines cannot be scaled (the
 *  pattern would stretch), so they snap: while the ruler grows they cover
 *  only the part both ranges share and extend when the ruler lands; while it
 *  shrinks they cut back at once. */

import * as m from 'motion/react-m';
import { memo, useState } from 'react';
import type { RegionPrim } from '@/engine/scene';
import { sameProps } from './memo';
import { usePatterns } from './patterns';
import { useInstant, useTransition } from './MotionMode';

interface Span {
  x: number;
  w: number;
}

function intersect(a: Span, b: Span): Span {
  const x = Math.max(a.x, b.x);
  const r = Math.min(a.x + a.w, b.x + b.w);
  return { x, w: Math.max(0, r - x) };
}

export const Region = memo(function Region({ p }: { p: RegionPrim }) {
  const PATTERN = usePatterns();
  const ruler = useTransition('ruler');
  const fade = useTransition('fade');
  const inst = useInstant();
  const [hatch, setHatch] = useState<{ key: string; span: Span; target: Span; fromEmpty: boolean }>(() => {
    const t = { x: p.x, w: p.visible ? p.w : 0 };
    return { key: `${t.x},${t.w}`, span: t, target: t, fromEmpty: false };
  });
  // A region that empties keeps its last x (it shrinks in place); one that
  // appears starts at its own left edge instead of sliding in from slot 0.
  const target: Span = p.visible && p.w > 0 ? { x: p.x, w: p.w } : { x: hatch.target.x, w: 0 };
  const key = `${target.x},${target.w}`;
  if (hatch.key !== key) setHatch({ key, span: inst ? target : intersect(hatch.span, target), target, fromEmpty: hatch.target.w === 0 });
  const shown = hatch.key === key ? hatch.span : target;
  const fromEmpty = hatch.key === key ? hatch.fromEmpty : hatch.target.w === 0;
  const pattern = p.kind2 === 'eliminated' ? PATTERN.cross : PATTERN.hatch;
  // x and scaleX share one tween, so an edge that does not move stays put
  // (x + w interpolates linearly between two equal values): the ruler grows
  // from whichever edge is anchored.
  const w = Math.max(target.w, 0.0001);
  return (
    <m.g data-id={p.id} data-kind={p.kind2} initial={false} animate={{ opacity: p.visible ? 1 : 0 }} transition={fade}>
      {shown.w > 0 && <rect x={shown.x} y={p.y} width={shown.w} height={p.h} fill={`url(#${pattern})`} />}
      <m.g
        initial={false}
        style={{ originX: 0 }}
        animate={{ x: target.x, scaleX: w }}
        transition={fromEmpty ? { ...ruler, x: { duration: 0 } } : ruler}
        onAnimationComplete={() => setHatch((h) => (h.key === key ? { ...h, span: target } : h))}
      >
        <rect x={0} y={p.y} width={1} height={p.h} fill="var(--hatch)" fillOpacity={0.35} stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      </m.g>
      <m.g initial={false} animate={{ x: target.x }} transition={fromEmpty ? { duration: 0 } : ruler}>
        <path d={`M0 ${p.y - 3} v-5 h${Math.max(0, Math.min(p.w, 14))}`} fill="none" stroke="var(--ink-2)" strokeWidth={1} />
        <text x={4} y={p.y - 10} fontSize={10} fill="var(--ink-2)">
          {REGION_LABEL[p.kind2]}
        </text>
      </m.g>
    </m.g>
  );
}, sameProps);

/** Region names as people say them (sentence case, no identifiers). */
export const REGION_LABEL: Record<RegionPrim['kind2'], string> = {
  sorted: 'sorted',
  eliminated: 'eliminated',
  less: '< pivot',
  greaterEq: '≥ pivot',
  unscanned: 'unscanned',
  window: 'window',
};
