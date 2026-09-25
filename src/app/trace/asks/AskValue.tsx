/** A value ask: one number, typed. Enter submits. Phone keyboards in numeric
 *  mode often have no minus key, so a ± key flips the sign ("−1" is a common
 *  answer). The input is parsed by normalizeAnswer, which accepts "−1". */

import { useState } from 'react';
import type { Ask } from '@/trace/asks';
import { normalizeAnswer } from '@/trace/grade';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

export function AskValue({ ask, onAnswer, autoFocus }: { ask: Ask; onAnswer: (n: number) => void; autoFocus: boolean }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = normalizeAnswer(ask, raw);
    if (!r.ok) return setError(r.error);
    if (typeof r.answer === 'number') onAnswer(r.answer);
  };
  const flip = () => {
    const s = raw.trim();
    setRaw(s.startsWith('-') || s.startsWith('−') ? s.slice(1) : `-${s}`);
    setError(null);
  };
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="w-40">
        <TextField
          label="Your answer"
          mono
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          autoFocus={autoFocus}
          value={raw}
          onChange={(e) => {
            setRaw(e.currentTarget.value);
            setError(null);
          }}
          {...(error ? { error } : {})}
          data-testid="value-input"
        />
      </div>
      <Button type="button" onClick={flip} aria-label="Flip the sign" className="font-mono" data-testid="value-sign">
        ±
      </Button>
      <Button type="submit" variant="primary" data-testid="value-submit">
        Check answer
      </Button>
    </form>
  );
}
