/** The step's one-sentence note, announced politely to screen readers. */

export function Narration({ note, phase }: { note: string; phase?: string | undefined }) {
  return (
    <p data-testid="narration" aria-live="polite" aria-atomic="true" style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.5, minHeight: '3em' }}>
      {phase && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', marginRight: 8, textTransform: 'uppercase' }}>{phase}</span>}
      {note}
    </p>
  );
}
