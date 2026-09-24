/** One SVG with every view a scene can contain, in stacking order. */

import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { ArrayView } from './ArrayView';
import { GraphView } from './GraphView';
import { GridView } from './GridView';
import { Links } from './Links';
import { RecursionTree } from './RecursionTree';
import { Stage } from './Stage';
import { TreeView } from './TreeView';

export function SceneView({ scene, layout, label }: { scene: Scene; layout: Layout; label: string }) {
  return (
    <Stage scene={scene} label={label}>
      <ArrayView scene={scene} layout={layout} />
      <RecursionTree scene={scene} />
      <TreeView scene={scene} />
      <GraphView scene={scene} />
      <GridView scene={scene} layout={layout} />
      <Links scene={scene} />
    </Stage>
  );
}
