import type { MistakeKind } from '@/trace/asks';
import { barFraction } from './chart';

export interface MistakeBarsProps {
  kinds: readonly { kind: MistakeKind; label: string; count: number }[];
}

/** Mistakes by kind as a bar list: one series, so every bar is the same red
 *  (the red pencil of the ghost), bars share one baseline and the count sits at
 *  each bar's tip, so no value needs a hover to be read. */
export function MistakeBars({ kinds }: MistakeBarsProps) {
  const max = kinds.reduce((m, k) => Math.max(m, k.count), 0);
  return (
    <ul className="flex max-w-3xl flex-col gap-3" aria-label="Mistakes by kind">
      {kinds.map((k) => (
        <li key={k.kind} data-testid="mistake-bar" className="grid max-w-none grid-cols-1 gap-1 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
          <span className="text-sm text-ink">{k.label}</span>
          {/* The right padding is room for the count when the bar is full length. */}
          <span className="flex min-w-0 items-center gap-2 pr-10">
            <span
              aria-hidden="true"
              className="block h-2.5 min-w-1 shrink-0 rounded-r-xs bg-red"
              style={{ width: `${barFraction(k.count, max) * 100}%` }}
            />
            <span className="shrink-0 font-mono text-sm text-ink">{k.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
