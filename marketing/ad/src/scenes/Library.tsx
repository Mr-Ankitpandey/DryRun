/** Beat 9: the real algorithm list from the registry, falling into place. */

import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { registry } from '@/algorithms/registry';
import { Beat, useWide } from '../components/Beat';

export function Library() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const n = registry.length;
  return (
    <Beat
      headline={<>{n} algorithms.<br />Free. No sign-up.</>}
      visual={
        <div style={{ columns: wide ? 2 : 2, columnGap: 40 }}>
          {registry.map((e, i) => {
            const s = spring({ frame: frame - 6 - i * 3, fps, config: { damping: 200 } });
            return (
              <div
                key={e.id}
                style={{
                  breakInside: 'avoid',
                  fontFamily: 'var(--font-ui)',
                  fontSize: wide ? 30 : 32,
                  lineHeight: 1.25,
                  color: 'var(--ink)',
                  padding: '12px 0',
                  borderBottom: '2px solid var(--rule)',
                  opacity: s,
                  transform: `translateY(${(1 - s) * -18}px)`,
                }}
              >
                {e.title}
              </div>
            );
          })}
        </div>
      }
    />
  );
}
