/** 28.5–32.5 s, paper. Answers land on the timeline (ticks and red crosses
 *  pop in as the cursor passes), then the review line the app shows when
 *  re-traces are due (produced by the real welcomeLine). */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { welcomeLine } from '@/learn/scheduler';
import { Beat } from '../components/Beat';

const W = 900;
const TICKS = 24;
const ASKS: [number, boolean][] = [
  [2, true],
  [5, true],
  [8, false],
  [11, true],
  [14, true],
  [17, false],
  [20, true],
];
const due = [
  { algorithm: 'dijkstra', box: 1 as const, due: 0, reviews: 2, lastScore: 0.6 },
  { algorithm: 'quick-sort', box: 0 as const, due: 0, reviews: 1, lastScore: 0.5 },
  { algorithm: 'bst', box: 2 as const, due: 0, reviews: 3, lastScore: 0.7 },
];
const line = welcomeLine(due, 4) ?? '';

export function Remember() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cursor = interpolate(frame, [10, 56], [0, TICKS - 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = (i: number) => 30 + (i * (W - 60)) / (TICKS - 1);
  const card = spring({ frame: frame - 62, fps, config: { damping: 18, stiffness: 140 } });
  return (
    <Beat
      headline={'Your mistakes\ncome back.'}
      sub="On inputs you have not seen, until you get them right."
      visual={
        <div>
          <svg viewBox={`0 0 ${W} 130`} width="100%" style={{ display: 'block' }}>
            <line x1={30} x2={W - 30} y1={88} y2={88} stroke="var(--rule)" strokeWidth={4} />
            <line x1={30} x2={x(cursor)} y1={88} y2={88} stroke="var(--ink)" strokeWidth={5} />
            {Array.from({ length: TICKS }, (_, i) => (
              <line key={i} x1={x(i)} x2={x(i)} y1={80} y2={96} stroke="var(--rule)" strokeWidth={2} />
            ))}
            {ASKS.map(([i, ok]) => {
              const s = spring({ frame: frame - 10 - (i / (TICKS - 1)) * 46, fps, config: { damping: 12, stiffness: 220 } });
              const reached = cursor >= i;
              return (
                <g key={i} transform={`translate(${x(i)} 44) scale(${reached ? 0.4 + 0.6 * s : 1})`}>
                  {!reached ? (
                    <path d="M0 -10 l10 10 l-10 10 l-10 -10 z" fill="none" stroke="var(--ink-2)" strokeWidth={2.5} />
                  ) : ok ? (
                    <path d="M-11 0 l7 8 l15 -16" fill="none" stroke="var(--green)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M-10 -10 l20 20 M10 -10 l-20 20" stroke="var(--red)" strokeWidth={5} strokeLinecap="round" />
                  )}
                </g>
              );
            })}
            <circle cx={x(cursor)} cy={88} r={14} fill="var(--surface)" stroke="var(--pen)" strokeWidth={5} />
          </svg>
          <div
            style={{
              marginTop: 44,
              background: 'var(--surface)',
              border: '2px solid var(--rule)',
              borderLeft: '10px solid var(--pen)',
              borderRadius: 10,
              padding: '28px 32px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              color: 'var(--ink)',
              opacity: Math.min(1, card * 1.5),
              transform: `translateY(${(1 - card) * 40}px)`,
            }}
          >
            {line}
          </div>
        </div>
      }
    />
  );
}
