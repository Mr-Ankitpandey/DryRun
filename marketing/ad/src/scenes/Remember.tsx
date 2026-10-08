/** Beat 8: mistakes are marked on the timeline, then the review line the app
 *  shows when re-traces are due (produced by the real welcomeLine). */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { welcomeLine } from '@/learn/scheduler';
import { Beat } from '../components/Beat';

const W = 900;
const TICKS = 24;
// Asked questions along the run: true = right, false = a mistake (red ×).
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
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const cursor = interpolate(frame, [4, 40], [0, TICKS - 1], clamp);
  const x = (i: number) => 30 + (i * (W - 60)) / (TICKS - 1);
  const card = spring({ frame: frame - 44, fps, config: { damping: 200 } });
  return (
    <Beat
      headline={<>Your mistakes come back.<br />On new inputs.</>}
      visual={
        <div>
          <svg viewBox={`0 0 ${W} 120`} width="100%" style={{ display: 'block', fontFamily: 'var(--font-mono)' }}>
            <line x1={30} x2={W - 30} y1={78} y2={78} stroke="var(--rule)" strokeWidth={3} />
            <line x1={30} x2={x(cursor)} y1={78} y2={78} stroke="var(--ink)" strokeWidth={4} />
            {Array.from({ length: TICKS }, (_, i) => (
              <line key={i} x1={x(i)} x2={x(i)} y1={70} y2={86} stroke="var(--rule)" strokeWidth={2} />
            ))}
            {ASKS.map(([i, ok]) =>
              cursor >= i ? (
                ok ? (
                  <path key={i} d={`M${x(i) - 8} 38 l6 7 l12 -14`} fill="none" stroke="var(--green)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path key={i} d={`M${x(i) - 9} 30 l18 18 M${x(i) + 9} 30 l-18 18`} stroke="var(--red)" strokeWidth={4} strokeLinecap="round" />
                )
              ) : (
                <path key={i} d={`M${x(i)} 30 l9 9 l-9 9 l-9 -9 z`} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
              ),
            )}
            <circle cx={x(cursor)} cy={78} r={12} fill="var(--surface)" stroke="var(--pen)" strokeWidth={4} />
          </svg>
          <div
            style={{
              marginTop: 48,
              background: 'var(--surface)',
              border: '2px solid var(--rule)',
              borderRadius: 6,
              padding: '28px 32px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              color: 'var(--ink)',
              opacity: card,
              transform: `translateY(${(1 - card) * 24}px)`,
            }}
          >
            {line}
          </div>
        </div>
      }
    />
  );
}
