/** The algorithm table (docs/DESIGN.md §5 "Library"): a real <table>, not
 *  cards. `full` (library): name, family, what you practise, your accuracy,
 *  review, minutes. `brief` (landing): name, what you practise, minutes.
 *  At 640 px and below it collapses to two columns: name with the practise
 *  line under it, and on the right accuracy with the review status. */

import { Link } from 'wouter';
import { cx } from '@/ui/cx';
import type { LibraryRow } from './rows';
import { FAMILY_LABELS, formatAccuracy, formatReview } from './rows';

export interface AlgorithmTableProps {
  rows: readonly LibraryRow[];
  mode?: 'full' | 'brief';
  caption: string;
  className?: string;
}

const wide = 'hidden min-[641px]:table-cell';
const narrowOnly = 'min-[641px]:hidden';
const th = 'px-3 py-2 text-left text-sm font-medium text-ink-2 first:pl-4 last:pr-4';
const td = 'px-3 py-3 align-top first:pl-4 last:pr-4';

function ReviewMark({ row }: { row: LibraryRow }) {
  const text = formatReview(row.review);
  if (row.review.kind === 'due') {
    return <span className="inline-flex h-6 items-center rounded-xs border border-pen px-1.5 text-sm font-medium whitespace-nowrap text-pen">{text}</span>;
  }
  return (
    <span className="text-sm text-ink-2">
      {text === '—' ? (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">not scheduled</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}

function Accuracy({ row }: { row: LibraryRow }) {
  if (row.accuracy === null) {
    return (
      <span className="font-mono text-base text-ink-2">
        <span aria-hidden="true">—</span>
        <span className="sr-only">no answers yet</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-mono text-base text-ink">{formatAccuracy(row.accuracy)}</span>
      <span className="text-xs text-ink-2">
        {row.correct} of {row.asked} right
      </span>
    </span>
  );
}

export function AlgorithmTable({ rows, mode = 'full', caption, className }: AlgorithmTableProps) {
  const full = mode === 'full';
  return (
    <div className={cx('border border-rule bg-surface', className)}>
      <table className="w-full border-collapse text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className={th}>
              Algorithm
            </th>
            {full ? (
              <th scope="col" className={cx(th, wide)}>
                Family
              </th>
            ) : null}
            <th scope="col" className={cx(th, wide)}>
              What you practise
            </th>
            {full ? (
              <>
                <th scope="col" className={cx(th, 'text-right')}>
                  <span className="hidden min-[641px]:inline">Your accuracy</span>
                  <span className={narrowOnly}>Accuracy</span>
                </th>
                <th scope="col" className={cx(th, wide)}>
                  Review
                </th>
              </>
            ) : null}
            <th scope="col" className={cx(th, full ? wide : '', 'text-right')}>
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={`algo-row-${row.id}`} data-family={row.family} className="border-b border-rule last:border-b-0">
              <td className={td}>
                <Link href={row.href} className="group block rounded-xs">
                  <span className="text-base font-medium text-ink underline decoration-rule underline-offset-4 group-hover:decoration-ink">{row.title}</span>
                  <span className={cx('mt-1 block text-sm text-ink-2', narrowOnly)}>{row.practice}</span>
                </Link>
              </td>
              {full ? <td className={cx(td, wide, 'text-sm text-ink-2')}>{FAMILY_LABELS[row.family]}</td> : null}
              <td className={cx(td, wide, 'max-w-[40ch] text-sm text-ink')}>{row.practice}</td>
              {full ? (
                <>
                  <td className={cx(td, 'text-right')}>
                    <Accuracy row={row} />
                    {row.review.kind === 'none' ? null : (
                      <div className={cx('mt-1', narrowOnly)}>
                        <ReviewMark row={row} />
                      </div>
                    )}
                  </td>
                  <td className={cx(td, wide)}>
                    <ReviewMark row={row} />
                  </td>
                </>
              ) : null}
              <td className={cx(td, full ? wide : '', 'text-right font-mono text-sm whitespace-nowrap text-ink-2')}>~{row.minutes} min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
