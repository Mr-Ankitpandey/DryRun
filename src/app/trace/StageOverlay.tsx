/** What the trace layer draws on the stage, in scene coordinates: the pick
 *  targets while a pick ask is open, and after an answer the ghost of a wrong
 *  guess next to the truth drawn in pen, or the green ring of a right one. */

import type { Id } from '@/engine/events';
import type { Scene } from '@/engine/scene';
import { CorrectRing } from '@/render/CorrectRing';
import { Ghost } from '@/render/Ghost';
import type { Outline } from '@/render/outline';
import { hitOutlineOf, outlineOf } from '@/render/outline';
import type { PickTarget } from '@/render/PickLayer';
import { PickLayer } from '@/render/PickLayer';
import { targetLabel } from './logic';
import type { Mark, OpenAsk, Verdict } from './useTraceController';

function resolve(mark: Mark | null, scene: Scene): Outline | null {
  if (!mark) return null;
  if ('fixed' in mark) return mark.fixed;
  return outlineOf(scene, mark.follow, 5);
}

export function StageOverlay({ scene, open, verdict, showVerdict, onPick }: { scene: Scene; open: OpenAsk | null; verdict: Verdict | null; showVerdict: boolean; onPick: (id: Id) => void }) {
  const targets: PickTarget[] = [];
  if (open && open.ask.kind === 'pick') {
    for (const id of open.order) {
      const outline = outlineOf(scene, id, 3);
      const hit = hitOutlineOf(scene, id);
      if (!outline || !hit) continue;
      targets.push({ id, outline, hit, hint: open.hints.get(id) ?? null, label: targetLabel(scene, id) });
    }
  }
  const ghost = showVerdict && verdict ? resolve(verdict.ghost, scene) : null;
  const truth = showVerdict && verdict ? resolve(verdict.truth, scene) : null;
  const key = verdict ? `${verdict.askIndex}` : 'none';
  return (
    <g data-view="trace-overlay">
      {truth && <CorrectRing key={`t${key}`} outline={truth} tone={verdict?.result.correct ? 'correct' : 'truth'} />}
      {ghost && <Ghost key={`g${key}`} outline={ghost} />}
      {targets.length > 0 && <PickLayer key={open?.askIndex} targets={targets} onPick={onPick} />}
    </g>
  );
}
