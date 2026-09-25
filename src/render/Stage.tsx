/** The SVG canvas: viewBox in abstract scene units (desktop and mobile share
 *  one layout), a faint graph-paper grid and the pattern definitions every view
 *  uses (hatch for regions, cross-hatch for eliminated, dots for visited).
 *
 *  Sizing: the SVG fills its container's width, but never draws larger than
 *  `maxScale` × the scene's own units (a 9-cell array should not balloon on a
 *  wide screen) nor smaller than `minWidth` CSS px (the parent scrolls
 *  horizontally instead of shrinking cells below a legible size). */

import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Scene } from '@/engine/scene';
import { PatternContext, scopedPatterns } from './patterns';

export interface StageProps {
  scene: Scene;
  label: string;
  /** Minimum rendered width in CSS px; 0 lets the scene shrink freely. */
  minWidth?: number;
  /** Largest scale of scene units to CSS px. */
  maxScale?: number;
  /** When the stage holds interactive targets it is a group, not an image. */
  interactive?: boolean;
  /** Extra scene units drawn left of x = 0 (labels that overhang the layout). */
  extendLeft?: number;
  /** CSS max-height; a taller scene then scales down, anchored top left. */
  maxHeight?: string | undefined;
  children: ReactNode;
}

export function Stage({ scene, label, minWidth = 0, maxScale = 1.25, interactive = false, extendLeft = 0, maxHeight, children }: StageProps) {
  const scope = useId();
  const PATTERN = useMemo(() => scopedPatterns(scope), [scope]);
  return (
    <svg
      viewBox={`${-extendLeft} 0 ${scene.width + extendLeft} ${scene.height}`}
      width="100%"
      preserveAspectRatio="xMinYMin meet"
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      data-testid="stage"
      style={{ display: 'block', minWidth, maxHeight, maxWidth: (scene.width + extendLeft) * maxScale, fontFamily: 'var(--font-mono)', overflow: 'visible' }}
    >
      <defs>
        <pattern id={PATTERN.grid} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
        <pattern id={PATTERN.hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="var(--hatch)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--rule)" strokeWidth="1.2" />
        </pattern>
        <pattern id={PATTERN.cross} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--rule)" strokeWidth="1" />
          <line x1="0" y1="0" x2="8" y2="0" stroke="var(--rule)" strokeWidth="1" />
        </pattern>
        <pattern id={PATTERN.dots} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" fill="var(--ink-2)" />
        </pattern>
      </defs>
      <rect x={-extendLeft} width={scene.width + extendLeft} height={scene.height} fill={`url(#${PATTERN.grid})`} />
      <PatternContext.Provider value={PATTERN}>{children}</PatternContext.Provider>
    </svg>
  );
}
