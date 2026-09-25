/** Step back / play-pause / step forward / speed. Icons are drawn SVG marks
 *  (no text glyphs). Speed cycles 0.5× → 1× → 1.5× → 2× on one key-cap button,
 *  because four speeds do not earn a permanent segmented control on a phone. */

import type { Speed } from '@/engine/timeline';
import { IconButton } from '@/ui/IconButton';
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from './icons';

export const SPEEDS: readonly Speed[] = [0.5, 1, 1.5, 2];

export function nextSpeed(s: Speed): Speed {
  const i = SPEEDS.indexOf(s);
  return SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
}

export interface TransportProps {
  playing: boolean;
  canPrev: boolean;
  canNext: boolean;
  canPlay: boolean;
  speed: Speed;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  onSpeed: (s: Speed) => void;
  /** Hide the speed control (narrow strips). */
  showSpeed?: boolean;
}

export function Transport({ playing, canPrev, canNext, canPlay, speed, onPrev, onToggle, onNext, onSpeed, showSpeed = true }: TransportProps) {
  return (
    <div role="group" aria-label="Playback" className="flex shrink-0 items-center gap-1">
      <IconButton label="Step back" variant="bare" onClick={onPrev} disabled={!canPrev} data-testid="prev">
        <StepBackIcon />
      </IconButton>
      <IconButton label={playing ? 'Pause' : 'Play'} variant="quiet" onClick={onToggle} disabled={!playing && !canPlay} data-testid="play">
        {playing ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
      <IconButton label="Step forward" variant="bare" onClick={onNext} disabled={!canNext} data-testid="next">
        <StepForwardIcon />
      </IconButton>
      {showSpeed && (
        <button
          type="button"
          data-testid="speed"
          aria-label={`Speed ${speed}×. Change speed`}
          title="Change speed"
          onClick={() => onSpeed(nextSpeed(speed))}
          className="inline-flex h-11 min-w-12 shrink-0 items-center justify-center rounded-sm border border-transparent px-2 font-mono text-sm text-ink-2 transition-colors duration-(--dur-xs) hover:border-rule hover:text-ink"
        >
          {speed}×
        </button>
      )}
    </div>
  );
}
