/** SVG pattern ids, scoped per Stage with useId: a page can hold several
 *  stages (the landing has four) and DOM ids must stay unique. Views read the
 *  ids of the stage they are drawn in through this context. */

import { createContext, useContext } from 'react';
import { PATTERN } from './marks';

export type PatternIds = { [K in keyof typeof PATTERN]: string };

/** Unscoped fallback (a view rendered outside a Stage). */
export const PatternContext = createContext<PatternIds>({ ...PATTERN });

export function usePatterns(): PatternIds {
  return useContext(PatternContext);
}

export function scopedPatterns(scope: string): PatternIds {
  const s = scope.replace(/[^a-zA-Z0-9_-]/g, '');
  return { grid: `${PATTERN.grid}-${s}`, hatch: `${PATTERN.hatch}-${s}`, cross: `${PATTERN.cross}-${s}`, dots: `${PATTERN.dots}-${s}` };
}
