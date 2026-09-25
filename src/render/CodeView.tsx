/** Pseudocode with the current line marked: a pen caret in the gutter, a pen
 *  bar on the left edge and a 12 % pen tint. The highlight snaps; it is never
 *  animated. */

export function CodeView({ lines, current }: { lines: readonly string[]; current: number }) {
  return (
    <ol data-testid="code" aria-label="Pseudocode" className="m-0 list-none overflow-x-auto rounded-sm border border-rule bg-surface p-0 py-1 font-mono text-[13px] leading-relaxed">
      {lines.map((text, i) => {
        const n = i + 1;
        const on = n === current;
        return (
          <li
            key={n}
            data-line={n}
            aria-current={on ? 'step' : undefined}
            className="grid max-w-none grid-cols-[0.75rem_2ch_1fr] items-center gap-2 border-l-[3px] pr-2 pl-1.5 whitespace-pre"
            style={{ borderLeftColor: on ? 'var(--pen)' : 'transparent', background: on ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent' }}
          >
            <span aria-hidden="true" className="flex items-center text-pen">
              {on && (
                <svg viewBox="0 0 8 10" className="h-2.5 w-2">
                  <path d="M0 0 L8 5 L0 10 Z" fill="currentColor" />
                </svg>
              )}
            </span>
            <span className="text-right text-ink-2">{n}</span>
            <span className="text-ink">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}
