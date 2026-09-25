/** The call stack from `frameOrder`: the active (top) frame first. Rows carry
 *  the frame id as `ref`, so hovering one links its recursion-tree node. The
 *  frame label already names its arguments ("quicksort(0, 6)"), so the
 *  `lo=0, hi=6` text is only shown when the label does not. */

import type { Scene } from '@/engine/scene';
import { CALLSTACK_PANEL, primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function CallStackPanel({ scene }: { scene: Scene }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === CALLSTACK_PANEL)
    .sort((a, b) => b.order - a.order)
    .map((r) => (r.label.includes('(') ? { ...r, text: null } : r));
  return <PanelList title="Call stack" rows={rows} ends={['top', 'bottom']} empty="no open calls" testId="panel-callstack" />;
}
