import { useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { DailyPoint } from '@/learn/progress';
import { PANEL, lastDataIndex, linePath, nearestDay, panelSummary, runs, stepToData, xAt, yAt } from './chart';
import { percent, plural, shortDate } from './format';

export interface AccuracyPanelProps {
  title: string;
  series: readonly DailyPoint[];
  asked: number;
  correct: number;
}

const GRID = [0, 0.5, 1] as const;

/** One small multiple: an algorithm's daily prediction accuracy over the window
 *  on the shared 0–100 % frame. One series, so no legend; the caption names it.
 *  Pen blue is the truth colour on the stage, so accuracy is drawn in pen. No
 *  area wash: under runs of one or two days it reads as a bar.
 *  Hover or arrow keys move a day cursor; the readout lists that day's numbers. */
export function AccuracyPanel({ title, series, asked, correct }: AccuracyPanelProps) {
  const [cursor, setCursor] = useState<number | null>(null);
  const hintId = useId();
  const n = series.length;
  const segments = runs(series);
  const points = segments.flat();
  const latest = points[points.length - 1];
  const overall = percent(correct, asked);
  const first = series[0];
  const last = series[n - 1];
  const bottom = yAt(0);

  function toViewBoxX(e: PointerEvent<SVGSVGElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return rect.width === 0 ? 0 : ((e.clientX - rect.left) / rect.width) * PANEL.width;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const from = cursor ?? lastDataIndex(series);
    let next: number | null;
    if (e.key === 'ArrowRight') next = stepToData(series, from, 1);
    else if (e.key === 'ArrowLeft') next = stepToData(series, from, -1);
    else if (e.key === 'Home') next = stepToData(series, -1, 1);
    else if (e.key === 'End') next = lastDataIndex(series);
    else if (e.key === 'Escape') next = null;
    else return;
    e.preventDefault();
    setCursor(next !== null && next >= 0 ? next : null);
  }

  const day = cursor !== null ? series[cursor] : undefined;
  const cursorX = cursor !== null ? xAt(cursor, n) : 0;
  const cursorPct = (cursorX / PANEL.width) * 100;

  return (
    <figure data-testid="accuracy-panel" className="flex flex-col gap-2 rounded-sm border border-rule bg-surface p-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base font-medium text-ink">{title}</span>
        <span className="text-sm text-ink-2">
          {overall === null ? 'No answers' : `${overall}% right over ${plural(asked, 'answer')}`}
        </span>
      </figcaption>
      <div
        className="relative rounded-xs"
        tabIndex={0}
        role="group"
        aria-label={`${title}, daily accuracy`}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onFocus={() => setCursor((c) => c ?? (lastDataIndex(series) >= 0 ? lastDataIndex(series) : null))}
        onBlur={() => setCursor(null)}
      >
        <p id={hintId} className="sr-only">
          {panelSummary(title, series)} Use the left and right arrow keys to read each day with answers.
        </p>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${PANEL.width} ${PANEL.height}`}
          className="block h-auto w-full touch-pan-y select-none"
          onPointerMove={(e) => setCursor(nearestDay(toViewBoxX(e), n))}
          onPointerDown={(e) => setCursor(nearestDay(toViewBoxX(e), n))}
          onPointerLeave={() => setCursor(null)}
        >
          {GRID.map((g) => (
            <g key={g}>
              <line
                x1={PANEL.left}
                x2={PANEL.width - PANEL.right}
                y1={yAt(g)}
                y2={yAt(g)}
                className="stroke-rule"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text x={PANEL.left - 6} y={yAt(g)} dy="0.35em" textAnchor="end" className="fill-ink-2 text-[11px] tabular-nums">
                {Math.round(g * 100)}%
              </text>
            </g>
          ))}
          {first ? (
            <text x={PANEL.left} y={PANEL.height - 6} className="fill-ink-2 text-[11px]">
              {shortDate(first.date)}
            </text>
          ) : null}
          {last ? (
            <text x={PANEL.width - PANEL.right} y={PANEL.height - 6} textAnchor="end" className="fill-ink-2 text-[11px]">
              {shortDate(last.date)}
            </text>
          ) : null}
          {cursor !== null ? (
            <line
              x1={cursorX}
              x2={cursorX}
              y1={PANEL.top}
              y2={bottom}
              className="stroke-ink-2"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {/* Dots first, lines on top: at phone width day slots are ~9 px apart and the dots' surface ring
              would otherwise hide the segment between two adjacent days. */}
          {points.map((p) => (
            <circle
              key={p.i}
              data-testid="accuracy-point"
              cx={p.x}
              cy={p.y}
              r={p.i === cursor ? 5 : 4}
              className="fill-pen stroke-surface"
              strokeWidth="2"
            />
          ))}
          {segments.map((run) => (
            <path
              key={`l${run[0]?.i}`}
              d={linePath(run)}
              className="fill-none stroke-pen"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {latest && cursor === null ? (
            // The latest value, labelled to the right of its dot: nothing can sit later than it.
            <text x={latest.x + 8} y={latest.y} dy="0.35em" className="fill-ink text-[12px] font-medium tabular-nums">
              {Math.round(latest.accuracy * 100)}%
            </text>
          ) : null}
        </svg>
        <div
          aria-live="polite"
          className="pointer-events-none absolute top-0 min-w-28 rounded-xs border border-rule bg-surface px-2 py-1 text-left"
          style={{
            left: `${cursorPct}%`,
            // Beside the crosshair, on the side with more room, so the line stays visible.
            transform: cursorPct < 50 ? 'translateX(8px)' : 'translateX(calc(-100% - 8px))',
            visibility: day ? 'visible' : 'hidden',
          }}
        >
          {day ? (
            <>
              <span className="block text-base font-semibold leading-tight text-ink tabular-nums">
                {day.accuracy === null ? 'No trace' : `${Math.round(day.accuracy * 100)}%`}
              </span>
              <span className="block text-xs leading-tight text-ink-2">
                {shortDate(day.date)}
                {day.asked > 0 ? `, ${day.correct} of ${day.asked} right` : ''}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
