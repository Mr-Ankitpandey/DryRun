/** Pseudocode with the current line marked: ▶ in the gutter and a pen tint
 *  (12 %). The highlight snaps; it is never animated. */

export function CodeView({ lines, current }: { lines: readonly string[]; current: number }) {
  return (
    <ol data-testid="code" aria-label="pseudocode" style={{ listStyle: 'none', margin: 0, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--rule)', borderRadius: 4, background: 'var(--surface)', overflowX: 'auto' }}>
      {lines.map((text, i) => {
        const n = i + 1;
        const on = n === current;
        return (
          <li key={n} data-line={n} aria-current={on ? 'step' : undefined} style={{ display: 'grid', gridTemplateColumns: '1.25rem 2ch 1fr', gap: 8, padding: '0 8px', background: on ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent', borderLeft: `3px solid ${on ? 'var(--pen)' : 'transparent'}`, whiteSpace: 'pre' }}>
            <span aria-hidden="true" style={{ color: 'var(--pen)' }}>
              {on ? '▶' : ''}
            </span>
            <span style={{ color: 'var(--ink-2)', textAlign: 'right' }}>{n}</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ol>
  );
}
