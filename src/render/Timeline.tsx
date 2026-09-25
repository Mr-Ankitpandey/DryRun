/** The timeline strip (DESIGN §6.4): one tick per step, filled in ink up to the
 *  cursor ("ticks already passed fill in"), a phase band underneath (runs
 *  alternate tone and are separated by a gap, so phases read without colour),
 *  a mark above every ask (pending: pen diamond; right: green tick; wrong: red
 *  ×; later: an outline diamond) and the steps beyond a pending question
 *  greyed out, since play cannot pass it.
 *
 *  Drag anywhere on the strip to scrub (pointer capture; `scrub` actions make
 *  every transition instant); click to jump. Keyboard: it is a slider (Left /
 *  Right step, Home / End, Page Up / Page Down ±10). Nothing here animates:
 *  scrubbing is index changes. */

import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { TICK_PATH } from './marks';
import { TIMELINE_PAD, kAtX, phaseRuns, timelineX } from './timeline-geometry';

export interface TimelineProps {
  length: number;
  k: number;
  gate: number | null;
  /** `phase` of every step, by step index. */
  phases: readonly (string | undefined)[];
  /** Step indices of the asks at this level. */
  asks: readonly number[];
  right: readonly number[];
  wrong: readonly number[];
  onScrub: (k: number) => void;
  onScrubEnd: () => void;
  onSeek: (k: number) => void;
  onStep: (dir: -1 | 1) => void;
  /** Spoken value, e.g. "step 7 of 23: mid = 4". */
  valueText: string;
  /** Strip height in px (32 on phones). */
  height?: number;
}

export function Timeline({ length, k, gate, phases, asks, right, wrong, onScrub, onScrubEnd, onSeek, onStep, valueText, height = 36 }: TimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const kAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return kAtX(e.clientX - rect.left, length, rect.width);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    onScrub(kAt(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onScrub(kAt(e));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onScrubEnd();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => onStep(-1),
      ArrowDown: () => onStep(-1),
      ArrowRight: () => onStep(1),
      ArrowUp: () => onStep(1),
      Home: () => onSeek(0),
      End: () => onSeek(length),
      PageUp: () => onSeek(k + 10),
      PageDown: () => onSeek(k - 10),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  };

  const cursorX = timelineX(k, length, width);
  const gateX = gate !== null ? timelineX(gate, length, width) : null;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Timeline"
      aria-valuemin={0}
      aria-valuemax={length}
      aria-valuenow={k}
      aria-valuetext={valueText}
      data-testid="timeline"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      className="relative min-w-0 flex-1 cursor-pointer rounded-sm select-none"
      style={{ height: Math.max(height, 32), touchAction: 'pan-y' }}
    >
      {width > 0 && (
        <svg width={width} height={Math.max(height, 32)} aria-hidden="true" className="block overflow-visible">
          <Ticks length={length} width={width} height={Math.max(height, 32)} phases={phases} asks={asks} right={right} wrong={wrong} gate={gate} />
          <rect x={TIMELINE_PAD} y={Math.max(height, 32) / 2 - 1} width={Math.max(0, cursorX - TIMELINE_PAD)} height={2} fill="var(--ink)" />
          {gateX !== null && gate !== null && gate < length && (
            <rect x={gateX} y={4} width={Math.max(0, timelineX(length, length, width) - gateX)} height={Math.max(height, 32) - 8} fill="var(--surface)" opacity={0.6} />
          )}
          <g transform={`translate(${cursorX} 0)`} data-testid="timeline-cursor">
            <line y1={3} y2={Math.max(height, 32) - 3} stroke="var(--pen)" strokeWidth={2} />
            <circle cy={Math.max(height, 32) / 2} r={5} fill="var(--surface)" stroke="var(--pen)" strokeWidth={2} />
          </g>
        </svg>
      )}
    </div>
  );
}

/** Everything that does not change with k: memoised so scrubbing only moves
 *  the cursor and the fill. */
const Ticks = memo(function Ticks({
  length,
  width,
  height,
  phases,
  asks,
  right,
  wrong,
  gate,
}: {
  length: number;
  width: number;
  height: number;
  phases: readonly (string | undefined)[];
  asks: readonly number[];
  right: readonly number[];
  wrong: readonly number[];
  gate: number | null;
}) {
  const mid = height / 2;
  const x = (k: number) => timelineX(k, length, width);
  const dense = length > 0 && (width - 2 * TIMELINE_PAD) / length < 4;
  const runs = phaseRuns(phases);
  const rightSet = new Set(right);
  const wrongSet = new Set(wrong);
  return (
    <g>
      <line x1={TIMELINE_PAD} x2={width - TIMELINE_PAD} y1={mid} y2={mid} stroke="var(--rule)" strokeWidth={2} />
      {!dense &&
        Array.from({ length }, (_, i) => <line key={i} x1={x(i + 1)} x2={x(i + 1)} y1={mid - 4} y2={mid + 4} stroke="var(--rule)" strokeWidth={1} />)}
      {runs.map((r) => (
        <rect key={`${r.from}`} x={x(r.from) + 1} y={height - 5} width={Math.max(0, x(r.to) - x(r.from) - 2)} height={3} fill={r.index % 2 === 0 ? 'var(--ink-2)' : 'var(--rule)'}>
          <title>{r.phase}</title>
        </rect>
      ))}
      {asks.map((a) => {
        const ax = x(a);
        const y = 7;
        if (wrongSet.has(a))
          return (
            <path key={a} data-mark="wrong" d={`M${ax - 3.5} ${y - 3.5} L${ax + 3.5} ${y + 3.5} M${ax + 3.5} ${y - 3.5} L${ax - 3.5} ${y + 3.5}`} stroke="var(--red)" strokeWidth={2} strokeLinecap="round" />
          );
        if (rightSet.has(a)) return <path key={a} data-mark="right" d={TICK_PATH} transform={`translate(${ax - 5} ${y - 4})`} fill="none" stroke="var(--green)" strokeWidth={1.75} />;
        const pending = a === gate;
        return <path key={a} data-mark={pending ? 'pending' : 'ask'} d={`M${ax} ${y - 4} L${ax + 4} ${y} L${ax} ${y + 4} L${ax - 4} ${y} Z`} fill={pending ? 'var(--pen)' : 'var(--surface)'} stroke={pending ? 'var(--pen)' : 'var(--ink-2)'} strokeWidth={1.25} />;
      })}
    </g>
  );
});
