/** Visual vocabulary for marks (docs/DESIGN.md §2): every semantic state has a
 *  colour token AND a non-colour cue. Colours are CSS variables only. */

import type { MarkKind } from '@/engine/events';

export interface MarkStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  /** Dashed ring (frontier). */
  dash: string | undefined;
  /** Dotted fill pattern overlay (visited). */
  dots: boolean;
  /** Small tick in the corner (settled / done). */
  tick: boolean;
  textFill: string;
}

const base: MarkStyle = { fill: 'var(--surface)', fillOpacity: 1, stroke: 'var(--ink)', strokeWidth: 1, dash: undefined, dots: false, tick: false, textFill: 'var(--ink)' };

export function markStyle(mark: MarkKind | null): MarkStyle {
  switch (mark) {
    case 'active':
      return { ...base, fill: 'var(--pen)', fillOpacity: 0.14, stroke: 'var(--pen)', strokeWidth: 2 };
    case 'pivot':
    case 'key':
      return { ...base, fill: 'var(--amber)', fillOpacity: 0.18, stroke: 'var(--amber)', strokeWidth: 2 };
    case 'visited':
      return { ...base, fill: 'var(--ink-2)', fillOpacity: 0.25, stroke: 'var(--ink-2)', dots: true };
    case 'frontier':
      return { ...base, stroke: 'var(--teal)', strokeWidth: 2, dash: '5 3' };
    case 'settled':
    case 'done':
      return { ...base, fill: 'var(--ink)', stroke: 'var(--ink)', strokeWidth: 1.5, tick: true, textFill: 'var(--surface)' };
    case 'stale':
      return { ...base, fill: 'var(--grid)', stroke: 'var(--ink-2)', textFill: 'var(--ink-2)' };
    case null:
      return base;
  }
}

/** Corner tick path (✓) for settled/done cues, drawn in a 10×8 box at (0,0). */
export const TICK_PATH = 'M0 4 L3.5 7.5 L10 0.5';

/** Pattern ids defined once in <Stage>. */
export const PATTERN = { grid: 'dr-grid', hatch: 'dr-hatch', cross: 'dr-cross', dots: 'dr-dots' } as const;

export const LINKED_STROKE = 'var(--pen)';
