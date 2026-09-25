/** "Edit input" (DESIGN §5, trace header): the module's presets, one field per
 *  URL parameter of its input (validated by the module, whose error text is
 *  shown as is), the variant, level and mode, and a fresh random input.
 *  Applying anything navigates to the new URL: the URL is the trace's identity. */

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import { traceUrl } from '@/lib/url';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Segmented';
import { TextField } from '@/ui/TextField';
import { freshTraceUrl } from './urls';

/** Plain names for input parameters; unknown keys show as themselves. */
const FIELD_LABELS: Record<string, string> = {
  i: 'Values, in order',
  x: 'Target',
  g: 'Edges (a-b or a-b:weight)',
  n: 'Number of nodes',
  s: 'Source node',
  w: 'Weights',
  v: 'Values',
  W: 'Capacity',
};

/** The URL key that carries the module's variant, if any (found by value, so no module is special-cased). */
export function variantKey(module: AlgorithmModule<unknown>, input: unknown): string | null {
  if (module.meta.variants.length < 2) return null;
  const v = module.variantOf(input);
  const hit = Object.entries(module.encode(input)).find(([, value]) => value === v);
  return hit ? hit[0] : null;
}

export interface EditInputProps {
  module: AlgorithmModule<unknown>;
  input: unknown;
  mode: 'trace' | 'watch';
  level: Level;
  onNavigate: (url: string) => void;
  onClose: () => void;
}

export function EditInput({ module, input, mode, level, onNavigate, onClose }: EditInputProps) {
  const vKey = variantKey(module, input);
  const current = module.encode(input);
  const [fields, setFields] = useState<Record<string, string>>(current);
  const [error, setError] = useState<string | null>(null);
  const [lvl, setLvl] = useState<Level>(level);
  const [md, setMd] = useState<'trace' | 'watch'>(mode);

  const go = (params: Record<string, string>, seed?: string) => onNavigate(traceUrl(module.meta.id, { ...params, seed, mode: md, level: lvl }));
  const apply = () => {
    const r = module.validate(fields);
    if (!r.ok) return setError(r.error);
    go(module.encode(r.input));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div data-own-keys onKeyDown={onKeyDown} className="flex max-h-[75dvh] flex-col gap-5 overflow-y-auto" data-testid="edit-input">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {vKey && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Variant</span>
            <Segmented
              label="Variant"
              size="sm"
              value={fields[vKey] ?? ''}
              onChange={(v) => setFields((f) => ({ ...f, [vKey]: v }))}
              options={module.meta.variants.map((v) => ({ value: v.id, label: v.title }))}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Questions</span>
          <Segmented label="Level" size="sm" value={lvl} onChange={setLvl} options={[{ value: 'guided', label: 'Guided' }, { value: 'full', label: 'Full' }]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Mode</span>
          <Segmented label="Mode" size="sm" value={md} onChange={setMd} options={[{ value: 'trace', label: 'Trace' }, { value: 'watch', label: 'Watch' }]} />
        </div>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        {Object.keys(current)
          .filter((k) => k !== vKey)
          .map((k) => (
            <TextField
              key={k}
              label={FIELD_LABELS[k] ?? k}
              mono
              autoComplete="off"
              spellCheck={false}
              value={fields[k] ?? ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setFields((f) => ({ ...f, [k]: value }));
                setError(null);
              }}
              data-field={k}
            />
          ))}
        {error && (
          <p role="alert" className="m-0 text-sm text-red" data-testid="input-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" data-testid="apply-input">
            Trace this input
          </Button>
          <Button onClick={() => onNavigate(freshTraceUrl(module, input, md, lvl))}>Random input</Button>
        </div>
      </form>

      <section aria-label="Presets" className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-medium text-ink-2">Presets</h3>
        <ul className="m-0 flex list-none flex-col p-0">
          {module.presets.map((p) => (
            <li key={p.id} className="border-t border-grid first:border-t-0">
              <button type="button" data-preset={p.id} onClick={() => go(module.encode(p.input))} className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xs px-1 py-2 text-left hover:bg-hatch">
                <span className="text-base text-ink">{p.title}</span>
                <span className="text-sm text-ink-2">{p.why}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
