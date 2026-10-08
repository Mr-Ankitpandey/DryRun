/** One SVG with every view a scene can contain, in stacking order, plus an
 *  optional overlay drawn on top in the same coordinates (the trace layer's
 *  pick targets, ghost and correct ring).
 *
 *  Arrays and connectors are always here. The recursion tree, tree (a BST,
 *  or an array's implicit tree), graph and DP grid views are one lazily loaded chunk (./structure-views), fetched only
 *  when the layout has one of them, so the landing's array-only hero stays
 *  small. They mount settled (no fade-in for what is on screen when they
 *  arrive), like everything present at a stage's first render. */

import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { ArrayView } from './ArrayView';
import { GRID_LABEL_FONT, gridLabelWidth } from './labels';
import { Links } from './Links';
import { Settled } from './MotionMode';
import { Stage } from './Stage';

const views = () => import('./structure-views');
const RecursionTree = lazy(() => views().then((m) => ({ default: m.RecursionTree })));
const TreeView = lazy(() => views().then((m) => ({ default: m.TreeView })));
const GraphView = lazy(() => views().then((m) => ({ default: m.GraphView })));
const GridView = lazy(() => views().then((m) => ({ default: m.GridView })));

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
  const longest = Math.max(0, ...g.rowLabels.map((l) => gridLabelWidth(l, GRID_LABEL_FONT)));
  return Math.ceil(Math.max(0, longest - (g.x0 - 8) + 6));
}

export function SceneView({ scene, layout, label, overlay, interactive = false, minWidth, maxScale, maxHeight }: SceneViewProps) {
  return (
    <Stage scene={scene} label={label} interactive={interactive} extendLeft={gridOverhang(layout)} maxHeight={maxHeight} {...(minWidth !== undefined ? { minWidth } : {})} {...(maxScale !== undefined ? { maxScale } : {})}>
      <ArrayView scene={scene} layout={layout} />
      {(layout.recursion || layout.tree || layout.implicitTree || layout.forest || layout.graph || layout.grid) && (
        <Suspense fallback={null}>
          <Settled>
            {layout.recursion && <RecursionTree scene={scene} />}
            {(layout.tree || layout.implicitTree || layout.forest) && <TreeView scene={scene} />}
            {layout.graph && <GraphView scene={scene} />}
            {layout.grid && <GridView scene={scene} layout={layout} />}
          </Settled>
        </Suspense>
      )}
      <Links scene={scene} />
      {overlay}
    </Stage>
  );
}
