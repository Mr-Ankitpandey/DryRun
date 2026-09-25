import { useState } from 'react';
import { Link } from 'wouter';
import type { Level } from '@/lib/storage';
import type { MistakeKindGroup } from '@/trace/mistakes';
import { retraceUrl } from '@/trace/mistakes';
import { Button } from '@/ui/Button';
import { plural, timeAgo } from './format';
import { algorithmsOf, traceRows } from './mistakes-view';
import { textLink } from './styles';
import { titleOf } from './titles';

export interface MistakeKindRowProps {
  group: MistakeKindGroup;
  now: number;
  level: Level;
  /** Open on first render (the most frequent kind). */
  defaultOpen?: boolean;
}

const PAGE = 8;
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** One mistake kind as an accordion row. The count sits in a dashed red box,
 *  the same red-pencil outline the ghost uses on the stage, so the bank reads
 *  as the collected ghosts. Expanded, it lists the traces with a re-trace link. */
export function MistakeKindRow({ group, now, level, defaultOpen = false }: MistakeKindRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const base = `mistake-${group.kind}`;
  const rows = traceRows(group.occurrences);
  const visible = showAll ? rows : rows.slice(0, PAGE);
  const algs = algorithmsOf(group.occurrences).map(titleOf);
  const manyAlgorithms = algs.length > 1;

  return (
    <li data-testid="mistake-kind" data-kind={group.kind} className="max-w-none">
      <h2>
        <button
          type="button"
          id={`${base}-button`}
          aria-expanded={open}
          aria-controls={`${base}-panel`}
          aria-labelledby={`${base}-label`}
          aria-describedby={`${base}-rule`}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full cursor-pointer items-start gap-4 px-4 py-4 text-left hover:bg-hatch"
        >
          <span
            aria-hidden="true"
            className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xs border border-dashed border-red px-1.5 font-mono text-base text-ink"
          >
            {group.count}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span id={`${base}-label`} className="font-display text-xl text-ink">
                {group.label}
                <span className="sr-only">, {plural(group.count, 'mistake')}</span>
              </span>
              <span className="text-sm font-normal text-ink-2">Last seen {timeAgo(group.lastSeen, now)}</span>
            </span>
            <span id={`${base}-rule`} className="text-base font-normal text-ink-2">
              {group.rule}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-2 size-4 shrink-0 stroke-ink-2 transition-transform duration-(--dur-s) ease-(--ease-out) group-aria-expanded:rotate-90"
            fill="none"
            strokeWidth="1.75"
          >
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div id={`${base}-panel`} role="region" aria-labelledby={`${base}-label`} hidden={!open} className="border-t border-rule px-4 pt-3 pb-4 sm:pl-18">
        <p className="text-sm text-ink-2">
          {plural(rows.length, 'trace')} in {algs.join(', ')}. Re-tracing opens the same input with the same seed.
        </p>
        <ul className="mt-2 divide-y divide-rule">
          {visible.map((r) => (
            <li key={r.key} data-testid="mistake-trace" className="flex max-w-none flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <span className="min-w-0">
                <span className="text-base text-ink">{capitalize(timeAgo(r.lastAt, now))}</span>
                <span className="block text-sm text-ink-2">
                  {manyAlgorithms ? `${titleOf(r.algorithm)}, ` : ''}
                  {plural(r.count, 'mistake')} of this kind in this trace
                </span>
              </span>
              <Link href={retraceUrl(r, level)} className={`${textLink} inline-flex min-h-11 items-center`}>
                Re-trace this input
              </Link>
            </li>
          ))}
        </ul>
        {rows.length > PAGE && !showAll ? (
          <Button size="sm" className="mt-2" onClick={() => setShowAll(true)}>
            Show all {rows.length} traces
          </Button>
        ) : null}
      </div>
    </li>
  );
}
