/** The SVG canvas: viewBox in abstract scene units (desktop and mobile share one
 *  layout), a faint graph-paper grid and the pattern definitions every view
 *  uses (hatch for regions, cross-hatch for eliminated, dots for visited). */

import type { ReactNode } from 'react';
import type { Scene } from '@/engine/scene';
import { PATTERN } from './marks';

/** `minWidth` (CSS px) keeps cells legible on phones: the parent scrolls
 *  horizontally instead of shrinking the whole scene (ARCHITECTURE §4). */
export function Stage({ scene, label, minWidth = 600, children }: { scene: Scene; label: string; minWidth?: number; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      width="100%"
      role="img"
      aria-label={label}
      data-testid="stage"
      style={{ display: 'block', minWidth, fontFamily: 'var(--font-mono)', overflow: 'visible' }}
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
      <rect width={scene.width} height={scene.height} fill={`url(#${PATTERN.grid})`} />
      {children}
    </svg>
  );
}
