/** The step's one-sentence note, announced politely to screen readers. The
 *  phase, when the step has one, is a quiet lead-in in the same sentence case. */

export function Narration({ note, phase, className = '' }: { note: string; phase?: string | undefined; className?: string }) {
  return (
    <p data-testid="narration" aria-live="polite" aria-atomic="true" className={`m-0 min-h-[3em] text-base leading-normal text-ink ${className}`}>
      {phase && <span className="mr-2 text-sm text-ink-2">{phase}:</span>}
      {note}
    </p>
  );
}
