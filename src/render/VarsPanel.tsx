/** Variables as `name = value` pairs (values snap; no animation). Hovering a
 *  var links prims that reference it (compare badges name it). */

import type { Scene } from '@/engine/scene';
import { VARS_PANEL, primsOf } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';

/** Internal bookkeeping vars (e.g. `dist:3`, mirrored by a table) are hidden. */
const hidden = (name: string) => name.includes(':');

export function VarsPanel({ scene }: { scene: Scene }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === VARS_PANEL && !hidden(r.label))
    .sort((a, b) => a.order - b.order);
  return (
    <section data-testid="panel-vars" className="min-w-0 font-mono text-sm">
      <h3 className="mb-1 font-sans text-sm font-medium text-ink-2">Variables</h3>
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 rounded-sm border border-rule bg-surface px-2 py-1.5">
        {rows.length === 0 && <dd className="col-span-2 m-0 text-ink-2">none yet</dd>}
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
  const bg = linked ? 'bg-hatch' : '';
  return (
    <>
      <dt data-id={id} data-linked={linked ? 'true' : undefined} {...handlers} className={`text-pen ${bg}`}>
        {name}
      </dt>
      <dd {...handlers} className={`m-0 truncate ${bg}`}>
        = {value}
      </dd>
    </>
  );
}
