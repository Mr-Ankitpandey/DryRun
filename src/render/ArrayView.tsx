/** Arrays: static slot outlines and index labels from the layout, then the
 *  regions (behind), bars and carets from the scene. Bars inside a visible
 *  'eliminated' region render at 50 % opacity. */

import { AnimatePresence } from 'motion/react';
import type { Layout } from '@/engine/layout';
import { slotCenter } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Bar } from './Bar';
import { Caret } from './Caret';
import { Region } from './Region';

export function ArrayView({ scene, layout }: { scene: Scene; layout: Layout }) {
  const al = layout.array;
  if (!al) return null;
  const regions = primsOf(scene, 'region');
  const bars = primsOf(scene, 'bar');
  const carets = primsOf(scene, 'caret');
  const eliminated = regions.filter((r) => r.visible && r.kind2 === 'eliminated');
  const dim = (arr: string, x: number) => eliminated.some((r) => r.arr === arr && x >= r.x - 0.5 && x < r.x + r.w - 0.5);
  const stackAt = new Map<string, number>();
  const stacks = carets.map((c) => {
    const key = `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    const k = c.visible ? (stackAt.get(key) ?? 0) : 0;
    if (c.visible) stackAt.set(key, k + 1);
    return k;
  });
  return (
    <g data-view="array">
      {al.order.map((name) => {
        const row = al.rows[name];
        if (!row) return null;
        return (
          <g key={name} data-row={name}>
            {name !== 'a' && (
              <text x={row.x0} y={row.y - 8} fontSize={10} fill="var(--ink-2)">
                {name}
              </text>
            )}
            {Array.from({ length: row.n }, (_, i) => (
              <g key={i}>
                <rect x={row.x0 + i * row.cellW + 2} y={row.y} width={row.cellW - 4} height={row.barH} fill="none" stroke="var(--grid)" strokeWidth={1} />
                <text x={slotCenter(row, i)} y={row.y + row.barH + 11} textAnchor="middle" fontSize={9} fill="var(--ink-2)">
                  {i}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      {regions.map((r) => (
        <Region key={r.id} p={r} />
      ))}
      <AnimatePresence initial={false}>
        {bars.map((b) => (
          <Bar key={b.id} p={b} dim={dim(b.arr, b.x)} />
        ))}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {carets.map((c, i) => (
          <Caret key={c.id} p={c} stack={stacks[i] ?? 0} />
        ))}
      </AnimatePresence>
    </g>
  );
}
