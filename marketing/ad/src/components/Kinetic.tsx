/** Kinetic type: each word rises out of its own mask, staggered, on a spring
 *  with a hint of overshoot (the app's `sheet` feel). Lines break on "\n".
 *  The words carry the motion; colour stays on the whole line. */

import type { CSSProperties } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface KineticProps {
  text: string;
  /** Frame (within the beat) at which the first word starts. */
  at?: number;
  /** Frames between words. */
  stagger?: number;
  style?: CSSProperties;
}

export function Kinetic({ text, at = 0, stagger = 3, style }: KineticProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let i = 0;
  return (
    <span style={{ display: 'block', ...style }}>
      {text.split('\n').map((line, li) => (
        <span key={li} style={{ display: 'block' }}>
          {line.split(' ').map((word, wi) => {
            const k = i++;
            const s = spring({ frame: frame - at - k * stagger, fps, config: { damping: 16, stiffness: 160, mass: 0.7 } });
            return (
              <span key={wi} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.12em', marginBottom: '-0.12em' }}>
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 110}%)` }}>{word}</span>
                {wi < line.split(' ').length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
