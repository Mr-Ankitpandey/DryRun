/** The invariant lens (DESIGN §6.3): the module's one-sentence invariant in a
 *  Callout above the stage, always visible, with every variable it names shown
 *  with its live value, so "[lo, hi]" reads "[lo = 2, hi = 8]" as the trace runs. */

import type { Scalar } from '@/engine/events';
import { Callout } from '@/ui/Callout';
import { invariantParts } from './logic';

export function InvariantLens({ name, sentence, vars, className }: { name: string; sentence: string; vars: Record<string, Scalar>; className?: string }) {
  const parts = invariantParts(sentence, vars);
  return (
    <Callout label={`Invariant: ${/^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name}`} {...(className ? { className } : {})}>
      <span data-testid="invariant">
        {parts.map((p, i) =>
          'text' in p ? (
            <span key={i}>{p.text}</span>
          ) : (
            <code key={i} className="font-mono">
              {p.name}
              {p.value !== null && (
                <>
                  <span className="text-ink-2"> = </span>
                  {p.value}
                </>
              )}
            </code>
          ),
        )}
      </span>
    </Callout>
  );
}
