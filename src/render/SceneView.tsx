/** One SVG with every view a scene can contain, in stacking order, plus an
 *  optional overlay drawn on top in the same coordinates (the trace layer's
 *  pick targets, ghost and correct ring). */

import type { ReactNode } from 'react';
import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { ArrayView } from './ArrayView';
import { GraphView } from './GraphView';
import { GRID_LABEL_FONT, GridView } from './GridView';
import { monoWidth } from './labels';
import { Links } from './Links';
import { RecursionTree } from './RecursionTree';
import { Stage } from './Stage';
import { TreeView } from './TreeView';

export interface SceneViewProps {
  scene: Scene;
  layout: Layout;
  label: string;
  overlay?: ReactNode;
  interactive?: boolean;
  minWidth?: number;
  maxScale?: number;
  maxHeight?: string | undefined;
}

/** How far DP row labels overhang the left edge of the layout (scene units). */
export function gridOverhang(layout: Layout): number {
  const g = layout.grid;
  if (!g) return 0;
  const longest = Math.max(0, ...g.rowLabels.map((l) => monoWidth(l, GRID_LABEL_FONT)));
  return Math.ceil(Math.max(0, longest - (g.x0 - 8) + 6));
}

export function SceneView({ scene, layout, label, overlay, interactive = false, minWidth, maxScale, maxHeight }: SceneViewProps) {
  return (
    <Stage scene={scene} label={label} interactive={interactive} extendLeft={gridOverhang(layout)} maxHeight={maxHeight} {...(minWidth !== undefined ? { minWidth } : {})} {...(maxScale !== undefined ? { maxScale } : {})}>
      <ArrayView scene={scene} layout={layout} />
      <RecursionTree scene={scene} />
      <TreeView scene={scene} />
      <GraphView scene={scene} />
      <GridView scene={scene} layout={layout} />
      <Links scene={scene} />
      {overlay}
    </Stage>
  );
}
