/** Beat 7: the real binary-search listings in C++, Java and Python, with the
 *  highlight moving line by line through the real line maps. */

import { useCurrentFrame } from 'remotion';
import { binarySearch } from '@/algorithms/binary-search';
import type { CodeListing, RealLanguage } from '@/algorithms/types';
import { Beat, useWide } from '../components/Beat';

const LANGS: { id: RealLanguage; label: string }[] = [
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
  { id: 'python', label: 'Python' },
];
const listings = binarySearch.code?.classic;
if (!listings) throw new Error('ad: binary-search listings missing');
// Pseudocode lines walked during the beat: the loop, mid, the compare, the move.
const WALK = [2, 3, 4, 5, 2, 3];

export function Code() {
  const frame = useCurrentFrame();
  const wide = useWide();
  const li = Math.min(LANGS.length - 1, Math.floor(frame / 30));
  const lang = LANGS[li];
  const listing: CodeListing | undefined = lang ? listings?.[lang.id] : undefined;
  if (!lang || !listing) throw new Error('ad: listing missing');
  const p = WALK[Math.min(WALK.length - 1, Math.floor(frame / 15))] ?? 2;
  const lit = new Set(listing.map[p - 1] ?? []);
  const size = wide ? 26 : 28;
  return (
    <Beat
      headline={<>Your language.<br />Line by line.</>}
      visual={
        <div style={{ background: 'var(--surface)', border: '2px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--rule)' }}>
            {LANGS.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: '14px 26px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 28,
                  fontWeight: 600,
                  background: l.id === lang.id ? 'var(--ink)' : 'transparent',
                  color: l.id === lang.id ? 'var(--surface)' : 'var(--ink-2)',
                }}
              >
                {l.label}
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 0', fontFamily: 'var(--font-mono)', fontSize: size, lineHeight: 1.55 }}>
            {listing.lines.slice(0, 14).map((text, i) => {
              const on = lit.has(i + 1);
              return (
                <div
                  key={i}
                  style={{
                    whiteSpace: 'pre',
                    padding: '0 24px',
                    background: on ? 'color-mix(in srgb, var(--pen) 14%, transparent)' : 'transparent',
                    boxShadow: on ? 'inset 6px 0 0 var(--pen)' : 'none',
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'clip',
                  }}
                >
                  {text || ' '}
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}
