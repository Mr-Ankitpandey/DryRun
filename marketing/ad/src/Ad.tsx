/** The 45-second ad. Beats play in order; each one starts WIPE frames before
 *  the previous one ends and wipes in over it, so the cut is a single motion
 *  rather than a blink. Music (marketing/ad/public/music.mp3) fades in and out. */

import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { WIPE } from './components/Beat';
import { MUSIC_FILE } from './config';
import { Blind } from './scenes/Blind';
import { Challenge } from './scenes/Challenge';
import { Closing } from './scenes/Closing';
import { Code } from './scenes/Code';
import { Free } from './scenes/Free';
import { HeapMove } from './scenes/HeapMove';
import { Hook } from './scenes/Hook';
import { Library } from './scenes/Library';
import { NotEqual } from './scenes/NotEqual';
import { Predict } from './scenes/Predict';
import { Remember } from './scenes/Remember';

export interface AdProps {
  music: boolean;
  /** Where to load the music from. Renders use the bundle's public dir; the
   *  browser preview passes the dev server's path to the same file. */
  musicSrc?: string;
}

/** Beat lengths in frames (30 fps). Sum = 1350 = 45 s. */
export const BEATS: { C: () => React.JSX.Element; frames: number }[] = [
  { C: Hook, frames: 120 },
  { C: Challenge, frames: 180 },
  { C: NotEqual, frames: 90 },
  { C: Predict, frames: 120 },
  { C: HeapMove, frames: 120 },
  { C: Blind, frames: 120 },
  { C: Code, frames: 95 },
  { C: Remember, frames: 120 },
  { C: Library, frames: 95 },
  { C: Free, frames: 80 },
  { C: Closing, frames: 210 },
];

/** Where each beat's sequence starts and how long it lasts: every beat but the
 *  first begins WIPE frames early (its wipe covers the previous beat), and
 *  every beat but the last stays WIPE frames longer (it is covered, not cut). */
const TIMED = BEATS.map(({ C, frames }, i) => {
  const start = BEATS.slice(0, i).reduce((sum, b) => sum + b.frames, 0);
  const from = i === 0 ? 0 : start - WIPE;
  const length = (i === 0 ? frames : frames + WIPE) + (i < BEATS.length - 1 ? WIPE : 0);
  return { C, from, length };
});

export function Ad({ music, musicSrc }: AdProps) {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: 'var(--bg)' }}>
      {TIMED.map(({ C, from, length }, i) => (
        <Sequence key={i} from={from} durationInFrames={length}>
          <C />
        </Sequence>
      ))}
      {music && (
        <Audio
          src={musicSrc ?? staticFile(MUSIC_FILE)}
          volume={(f) => interpolate(f, [0, fps, durationInFrames - 2 * fps, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  );
}
