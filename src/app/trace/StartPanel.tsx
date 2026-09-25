/** What the ask area says before the first question, or when the learner has
 *  stepped back from a pending one: where the next question is, and one button
 *  to play to it. Opening a trace never auto-plays. */

import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/Kbd';
import { PlayIcon } from '@/render/icons';

export function StartPanel({ k, gate, playing, onPlay }: { k: number; gate: number; playing: boolean; onPlay: () => void }) {
  const atStart = k === 0;
  return (
    <div data-testid="start" className="flex flex-col gap-3">
      <p className="m-0 text-base text-ink">
        {atStart ? 'The trace stops before every move worth predicting. Press play, then answer each question before the move happens.' : `The next question is at step ${gate}.`}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="primary" icon={<PlayIcon />} onClick={onPlay} disabled={playing} data-testid="start-play">
          {atStart ? 'Play' : 'Play to the question'}
        </Button>
        <span className="hidden text-sm text-ink-2 sm:inline">
          or <Kbd>Space</Kbd>
        </span>
      </div>
    </div>
  );
}
