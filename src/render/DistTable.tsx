/** Distance table for graphs: one row per node with its current label text
 *  (∞ when none) and mark. Rows link to the graph node on hover. Settled rows
 *  are bold with a drawn tick (not colour alone). */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';
import { TICK_PATH } from './marks';

export function DistTable({ scene, title = 'Distance' }: { scene: Scene; title?: string }) {
  const nodes = primsOf(scene, 'gnode');
  if (nodes.length === 0) return null;
  return (
    <section data-testid="dist-table" className="min-w-0 font-mono text-sm">
      <h3 className="mb-1 font-sans text-sm font-medium text-ink-2">{title}</h3>
      <table className="w-full border-collapse overflow-hidden rounded-sm border border-rule bg-surface">
        <thead>
          <tr className="font-sans text-xs text-ink-2">
            <th className="px-2 py-0.5 text-left font-medium">node</th>
            <th className="px-2 py-0.5 text-right font-medium">dist</th>
            <th className="px-2 py-0.5 text-left font-medium">state</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <DistRow key={n.id} id={n.id} label={n.label} text={n.text} mark={n.mark} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DistRow({ id, label, text, mark }: { id: string; label: string; text: string | null; mark: string | null }) {
  const linked = useLinked(id);
  const handlers = useHoverHandlers(id);
  return (
    <tr data-id={id} data-linked={linked ? 'true' : undefined} {...handlers} className={`border-t border-grid ${linked ? 'bg-hatch' : ''}`}>
      <td className="px-2 py-0.5">{label}</td>
      <td className={`px-2 py-0.5 text-right ${mark === 'settled' ? 'font-bold' : ''}`}>{text ?? '∞'}</td>
      <td className="px-2 py-0.5 font-sans text-xs text-ink-2">
        <span className="inline-flex items-center gap-1">
          {mark ?? ''}
          {mark === 'settled' && (
            <svg aria-hidden="true" viewBox="-1 -1 12 10" className="h-2.5 w-3">
              <path d={TICK_PATH} fill="none" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          )}
        </span>
      </td>
    </tr>
  );
}
