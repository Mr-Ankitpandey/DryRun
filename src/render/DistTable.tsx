/** Distance table for graphs: one row per node with its current label text
 *  (∞ when none) and mark. Rows link to the graph node on hover. */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';

export function DistTable({ scene, title = 'dist' }: { scene: Scene; title?: string }) {
  const nodes = primsOf(scene, 'gnode');
  if (nodes.length === 0) return null;
  return (
    <section data-testid="dist-table" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>
      <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--rule)', borderRadius: 4, background: 'var(--surface)' }}>
        <thead>
          <tr style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 11 }}>
            <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 500 }}>node</th>
            <th style={{ textAlign: 'right', padding: '2px 8px', fontWeight: 500 }}>{title}</th>
            <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 500 }}>state</th>
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
    <tr data-id={id} data-linked={linked ? 'true' : undefined} {...handlers} style={{ borderTop: '1px solid var(--grid)', background: linked ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent' }}>
      <td style={{ padding: '2px 8px' }}>{label}</td>
      <td style={{ padding: '2px 8px', textAlign: 'right', fontWeight: mark === 'settled' ? 700 : 400 }}>{text ?? '∞'}</td>
      <td style={{ padding: '2px 8px', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 11 }}>
        {mark ?? ''}
        {mark === 'settled' ? ' ✓' : ''}
      </td>
    </tr>
  );
}
