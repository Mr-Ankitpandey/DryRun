/** The app's real stage (src/render) drawn for one video frame. Same views as
 *  SceneView, imported directly instead of lazily (a frame cannot wait for a
 *  chunk). Motion runs in instant mode and the subtree remounts every frame,
 *  so each element is drawn exactly at the scene's position for that frame:
 *  the animation comes from the per-frame scene (lib/tween), not from springs.
 *  The stage is zoomed to the beat's bounds and framed like the app's stage. */

import type { ReactNode } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { ArrayView } from '@/render/ArrayView';
import { HoverProvider } from '@/render/HoverProvider';
import { Links } from '@/render/Links';
import { MotionModeProvider } from '@/render/MotionMode';
import { gridOverhang } from '@/render/SceneView';
import { Stage } from '@/render/Stage';
import { GraphView, GridView, RecursionTree, TreeView } from '@/render/structure-views';
import type { Bounds } from '../lib/bounds';

export interface AdStageProps {
  scene: Scene;
  layout: Layout;
  bounds: Bounds;
  overlay?: ReactNode;
  /** Blind mode: the frame is dashed while the stage is frozen. */
  frozen?: boolean;
  /** Camera: zoom k× towards a point (scene units). */
  zoom?: { cx: number; cy: number; k: number };
}

/** Pixel box the stage may fill, by composition shape. */
function useBox(): { width: number; height: number } {
  const { width, height } = useVideoConfig();
  return width > height ? { width: 980, height: 740 } : { width: 936, height: 980 };
}

export function AdStage({ scene, layout, bounds, overlay, frozen = false, zoom }: AdStageProps) {
  const frame = useCurrentFrame();
  const box = useBox();
  const ext = gridOverhang(layout);
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const s = Math.min(box.width / bw, box.height / bh);
  return (
    <div style={{ width: bw * s, height: bh * s, position: 'relative', overflow: 'hidden', margin: '0 auto', border: frozen ? '3px dashed var(--ink-2)' : '2px solid var(--rule)', borderRadius: 8, background: 'var(--bg)' }}>
      <div
        style={{
          position: 'absolute',
          left: -(bounds.minX + ext) * s,
          top: -bounds.minY * s,
          width: (scene.width + ext) * s,
          ...(zoom ? { transform: `scale(${zoom.k})`, transformOrigin: `${(zoom.cx + ext) * s}px ${zoom.cy * s}px` } : {}),
        }}
      >
        <MotionModeProvider reduced>
          <HoverProvider>
            <div key={frame}>
              <Stage scene={scene} label="" maxScale={40} extendLeft={ext}>
                <ArrayView scene={scene} layout={layout} />
                {layout.recursion && <RecursionTree scene={scene} />}
                {(layout.tree || layout.implicitTree || layout.forest) && <TreeView scene={scene} />}
                {layout.graph && <GraphView scene={scene} />}
                {layout.grid && <GridView scene={scene} layout={layout} />}
                <Links scene={scene} />
                {overlay}
              </Stage>
            </div>
          </HoverProvider>
        </MotionModeProvider>
      </div>
    </div>
  );
}
