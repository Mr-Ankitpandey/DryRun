/** The trace screen's keyboard map (DESIGN §6.8) as a pure function, so one
 *  window-level hook can serve every control without fighting text fields,
 *  buttons, segmented controls or dialogs.
 *
 *    Space        play / pause, or Continue after a verdict
 *    ← / →        step back / forward
 *    1–9          answer: nth option, nth pick target, nth order item
 *    Enter        Continue after a verdict; submit a complete order
 *    Backspace    undo the last item of an order
 *    ?            shortcuts
 *    Esc          close what is open */

export type AskKindOrNone = 'pick' | 'choice' | 'value' | 'order' | null;

/** What had focus when the key was pressed. */
export type KeyTarget = 'text' | 'button' | 'radiogroup' | 'slider' | 'other';

export interface KeyContext {
  /** The kind of the ask that is open, or null. */
  ask: AskKindOrNone;
  /** A verdict or start prompt is showing with a Continue / Play action. */
  canContinue: boolean;
  /** A dialog or sheet owns the keyboard. */
  modal: boolean;
  target: KeyTarget;
}

export type KeyCommand =
  | { type: 'toggle' }
  | { type: 'continue' }
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'answer'; n: number }
  | { type: 'submit' }
  | { type: 'undo' }
  | { type: 'help' }
  | { type: 'close' };

export interface KeyMods {
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
}

export function mapKey(key: string, mods: KeyMods, ctx: KeyContext): KeyCommand | null {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  if (ctx.modal) return null; // dialogs and sheets handle their own keys (Esc included)
  if (ctx.target === 'text') return null; // fields handle Enter themselves; typing is typing
  if (key === 'Escape') return { type: 'close' };
  if (key === '?') return { type: 'help' };
  // Focused buttons activate on Space/Enter natively; do not do it twice.
  const onButton = ctx.target === 'button';
  if (key === ' ' || key === 'Spacebar') {
    if (onButton) return null;
    if (ctx.canContinue) return { type: 'continue' };
    if (ctx.ask !== null) return null;
    return { type: 'toggle' };
  }
  if (key === 'Enter') {
    if (onButton) return null;
    if (ctx.canContinue) return { type: 'continue' };
    if (ctx.ask === 'order') return { type: 'submit' };
    return null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    // Segmented controls and the timeline slider move with arrows themselves.
    if (ctx.target === 'radiogroup' || ctx.target === 'slider') return null;
    return { type: key === 'ArrowLeft' ? 'prev' : 'next' };
  }
  if (/^[1-9]$/.test(key)) {
    if (ctx.ask === 'pick' || ctx.ask === 'choice' || ctx.ask === 'order') return { type: 'answer', n: Number(key) };
    return null;
  }
  if (key === 'Backspace' && ctx.ask === 'order') return { type: 'undo' };
  return null;
}

/** Classifies the focused element of a key event. */
export function keyTarget(el: Element | null): KeyTarget {
  if (!el) return 'other';
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable) return 'text';
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    return type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit' ? 'button' : 'text';
  }
  const role = el.getAttribute('role');
  if (role === 'slider') return 'slider';
  if (role === 'radio' || el.closest('[role="radiogroup"]')) return 'radiogroup';
  if (tag === 'button' || tag === 'a' || role === 'button' || role === 'link') return 'button';
  return 'other';
}
