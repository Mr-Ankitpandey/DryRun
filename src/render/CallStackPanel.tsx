/** The call stack from `frameOrder`: the active (top) frame first. Rows carry
 *  the frame id as `ref`, so hovering one links its recursion-tree node. */

import type { Scene } from '@/engine/scene';
import { CALLSTACK_PANEL, primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function CallStackPanel({ scene }: { scene: Scene }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === CALLSTACK_PANEL)
    .sort((a, b) => b.order - a.order);
  return <PanelList title="call stack" rows={rows} ends={['top', 'bottom']} empty="no open frames" testId="panel-callstack" />;
}
