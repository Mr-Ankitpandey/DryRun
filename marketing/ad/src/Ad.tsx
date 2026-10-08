/** The 30-second ad: ten 3-second beats in order, plus the music track when
 *  one has been placed in marketing/ad/public/music.mp3 (faded in and out). */

import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { BEAT } from './components/Beat';
import { Blind } from './scenes/Blind';
import { Card } from './scenes/Card';
import { Code } from './scenes/Code';
import { End } from './scenes/End';
import { HeapMove } from './scenes/HeapMove';
import { Hook } from './scenes/Hook';
import { Library } from './scenes/Library';
import { Predict } from './scenes/Predict';
import { Remember } from './scenes/Remember';

export interface AdProps {
  music: boolean;
  /** Where to load the music from. Renders use the bundle's public dir; the
   *  browser preview passes the dev server's path to the same file. */
  musicSrc?: string;
}

const SCENES: { at: number; beats: number; C: () => React.JSX.Element }[] = [
  { at: 0, beats: 2, C: Hook },
  { at: 2, beats: 1, C: Card },
  { at: 3, beats: 1, C: Predict },
  { at: 4, beats: 1, C: HeapMove },
  { at: 5, beats: 1, C: Blind },
  { at: 6, beats: 1, C: Code },
  { at: 7, beats: 1, C: Remember },
  { at: 8, beats: 1, C: Library },
  { at: 9, beats: 1, C: End },
];

export function Ad({ music, musicSrc }: AdProps) {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: 'var(--bg)' }}>
      {SCENES.map(({ at, beats, C }) => (
        <Sequence key={at} from={at * BEAT} durationInFrames={beats * BEAT}>
          <C />
        </Sequence>
      ))}
      {music && (
        <Audio
          src={musicSrc ?? staticFile('music.mp3')}
          volume={(f) => interpolate(f, [0, fps, durationInFrames - 2 * fps, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  );
}
