/** Pick targets for a `pick` ask, drawn over the stage. Only candidates are
 *  interactive; everything else stays inert. Each candidate shows a quiet
 *  dashed pen outline (it "breathes" twice when the ask opens, then rests) and,
 *  for the first nine in reading order, its number key. Press to commit: the
 *  target scales to 0.96 while pressed and releases on the sheet spring; the
 *  pick is committed on release. Targets are keyboard reachable (Tab, then
 *  Enter or Space) and draw their own focus ring. */

import * as m from 'motion/react-m';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Id } from '@/engine/events';
import type { Outline } from './outline';
import { outlinePath } from './outline';
import { useInstant, useTransition } from './MotionMode';

export interface PickTarget {
  id: Id;
  /** Where the affordance and focus ring are drawn. */
  outline: Outline;
  /** Where a tap counts (larger than the outline). */
  hit: Outline;
  /** Number key 1–9, when it has one. */
  hint: number | null;
  /** Accessible name, e.g. "index 3, value 12". */
  label: string;
}

export function PickLayer({ targets, onPick, disabled = false }: { targets: PickTarget[]; onPick: (id: Id) => void; disabled?: boolean }) {
  const [focused, setFocused] = useState<Id | null>(null);
  const [hovered, setHovered] = useState<Id | null>(null);
  const press = useTransition('sheet');
  const pulse = useTransition('pulse');
  const inst = useInstant();
  return (
    <g data-testid="pick-layer">
      {targets.map((t) => {
        const active = focused === t.id || hovered === t.id;
        const d = outlinePath(t.outline);
        const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) onPick(t.id);
          }
        };
        return (
          <g key={t.id} transform={`translate(${t.hit.cx} ${t.hit.cy})`}>
            <m.g
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={t.label}
              aria-keyshortcuts={t.hint !== null ? String(t.hint) : undefined}
              data-cand={t.id}
              data-hint={t.hint ?? undefined}
              style={{ cursor: disabled ? 'default' : 'pointer', outline: 'none' }}
              {...(disabled || inst ? {} : { whileTap: { scale: 0.96 } })}
              transition={press}
              onClick={() => {
                if (!disabled) onPick(t.id);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(t.id)}
              onBlur={() => setFocused((f) => (f === t.id ? null : f))}
              onPointerEnter={() => setHovered(t.id)}
              onPointerLeave={() => setHovered((h) => (h === t.id ? null : h))}
            >
              <path d={outlinePath(t.hit, 6)} fill="transparent" stroke="none" />
              <g transform={`translate(${t.outline.cx - t.hit.cx} ${t.outline.cy - t.hit.cy})`}>
                {active ? (
                  <path d={d} fill="none" stroke="var(--pen)" strokeWidth={2} />
                ) : (
                  <m.path
                    d={d}
                    fill="none"
                    stroke="var(--pen)"
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    initial={inst ? false : { opacity: 0.35 }}
                    animate={inst ? { opacity: 0.6 } : { opacity: [0.35, 0.9, 0.35, 0.9, 0.6] }}
                    transition={pulse}
                  />
                )}
                {t.hint !== null && <KeyHint outline={t.outline} n={t.hint} />}
              </g>
            </m.g>
          </g>
        );
      })}
    </g>
  );
}

function KeyHint({ outline, n }: { outline: Outline; n: number }) {
  const x = outline.shape === 'circle' ? -outline.r * 0.72 : -outline.w / 2;
  const y = outline.shape === 'circle' ? -outline.r * 0.72 : -outline.h / 2;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect x={-7} y={-8} width={14} height={16} rx={2} fill="var(--surface)" stroke="var(--rule)" strokeWidth={1} />
      <text y={4} textAnchor="middle" fontSize={10} fill="var(--ink)">
        {n}
      </text>
    </g>
  );
}
