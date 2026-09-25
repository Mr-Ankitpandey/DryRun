/** Session end (trace screen only): the score, each mistake kind with the
 *  rules that were broken, and the two ways on: a fresh input (new seed, the
 *  module's constrained random input) or back to the library. */

import { useLocation } from 'wouter';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import type { Session } from '@/trace/session';
import { correctCount } from '@/trace/session';
import { traceUrl } from '@/lib/url';
import { Button } from '@/ui/Button';
import { LinkButton } from '@/ui/LinkButton';
import { mistakesByKind, scoreLine } from './logic';
import { freshTraceUrl } from './urls';

export interface SummaryProps {
  module: AlgorithmModule<unknown>;
  session: Session;
  mode: 'trace' | 'watch';
  level: Level;
  input: unknown;
  steps: number;
}

export function Summary({ module, session, mode, level, input, steps }: SummaryProps) {
  const [, navigate] = useLocation();
  const asked = session.answers.length;
  const right = correctCount(session);
  const groups = mistakesByKind(session);
  const again = () => navigate(freshTraceUrl(module, input, mode, level));
  const traceThis = () => navigate(traceUrl(module.meta.id, { ...module.encode(input), seed: session.meta.seed, mode: 'trace', level }));
  return (
    <section data-testid="summary" aria-label="Session summary" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl font-medium text-ink">{mode === 'watch' ? 'End of the run' : 'Trace complete'}</h2>
      {mode === 'watch' ? (
        <p className="m-0 text-base text-ink">You watched all {steps} steps. Watching is the fallback: trace it and predict each move.</p>
      ) : (
        <p className="m-0 text-base text-ink" data-testid="score">
          {scoreLine(asked, right) ?? 'No questions at this level.'}
        </p>
      )}
      {groups.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="summary-mistakes">
          {groups.map((g) => (
            <li key={g.kind} className="flex flex-col gap-0.5">
              <span className="text-sm text-ink-2">
                <span className="font-mono text-red">{g.count}×</span> {g.label}
              </span>
              {g.rules.map((r) => (
                <span key={r} className="text-base text-ink">
                  {r}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {mode === 'trace' && asked > 0 && groups.length === 0 && <p className="m-0 text-base text-ink">No mistakes on this input.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {mode === 'watch' ? (
          <Button variant="primary" onClick={traceThis} data-testid="trace-this">
            Trace this input
          </Button>
        ) : (
          <Button variant="primary" onClick={again} data-testid="trace-again">
            Trace again with a new input
          </Button>
        )}
        <LinkButton href="/algorithms">Back to algorithms</LinkButton>
      </div>
    </section>
  );
}
