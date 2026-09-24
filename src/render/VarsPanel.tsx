/** Variables as `name = value` pairs (values snap; no animation). Hovering a
 *  var links prims that reference it (compare badges name it). */

import type { Scene } from '@/engine/scene';
import { VARS_PANEL, primsOf } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';

export function VarsPanel({ scene }: { scene: Scene }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === VARS_PANEL)
    .sort((a, b) => a.order - b.order);
  return (
    <section data-testid="panel-vars" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>vars</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 12px', margin: 0, padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 4, background: 'var(--surface)', minHeight: 20 }}>
        {rows.length === 0 && <dd style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--ink-2)' }}>none yet</dd>}
        {rows.map((r) => (
          <VarRow key={r.id} id={r.id} name={r.label} value={r.text ?? ''} />
        ))}
      </dl>
    </section>
  );
}

function VarRow({ id, name, value }: { id: string; name: string; value: string }) {
  const linked = useLinked(id);
  const handlers = useHoverHandlers(id);
  const bg = linked ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent';
  return (
    <>
      <dt data-id={id} data-linked={linked ? 'true' : undefined} {...handlers} style={{ color: 'var(--pen)', background: bg }}>
        {name}
      </dt>
      <dd {...handlers} style={{ margin: 0, background: bg }}>
        = {value}
      </dd>
    </>
  );
}
