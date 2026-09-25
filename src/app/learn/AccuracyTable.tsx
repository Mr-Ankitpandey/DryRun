import type { AlgorithmProgress } from '@/learn/progress';
import { percent, shortDate } from './format';

export interface AccuracyTableProps {
  rows: readonly AlgorithmProgress[];
  titleOf: (id: string) => string;
}

/** The chart's table twin: every day with answers, per algorithm. Collapsed by
 *  default; it is the version screen readers and exact readers use. */
export function AccuracyTable({ rows, titleOf }: AccuracyTableProps) {
  return (
    <details className="mt-4 max-w-3xl">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xs text-base text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
        Show the numbers as a table
      </summary>
      <div className="mt-2 overflow-x-auto rounded-sm border border-rule bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Prediction accuracy per algorithm and day, days with answers only</caption>
          <thead>
            <tr className="border-b border-rule text-ink-2">
              <th scope="col" className="px-3 py-2 font-medium">Algorithm</th>
              <th scope="col" className="px-3 py-2 font-medium">Day</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Right</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Asked</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((a) =>
              a.series
                .filter((d) => d.asked > 0)
                .map((d) => (
                  <tr key={`${a.algorithm}-${d.date}`} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="px-3 py-1.5 font-normal text-ink">
                      {titleOf(a.algorithm)}
                    </th>
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink">{shortDate(d.date)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink">{d.correct}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink">{d.asked}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink">{percent(d.correct, d.asked)}%</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
