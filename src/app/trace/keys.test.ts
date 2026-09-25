import { describe, expect, it } from 'vitest';
import type { KeyContext } from './keys';
import { mapKey } from './keys';

const ctx = (patch: Partial<KeyContext> = {}): KeyContext => ({ ask: null, canContinue: false, modal: false, target: 'other', ...patch });

describe('keyboard map', () => {
  it('Space plays and pauses, or continues after a verdict', () => {
    expect(mapKey(' ', {}, ctx())).toEqual({ type: 'toggle' });
    expect(mapKey(' ', {}, ctx({ canContinue: true }))).toEqual({ type: 'continue' });
    expect(mapKey(' ', {}, ctx({ ask: 'pick' }))).toBeNull();
  });
  it('arrows step, except where a control owns them', () => {
    expect(mapKey('ArrowLeft', {}, ctx())).toEqual({ type: 'prev' });
    expect(mapKey('ArrowRight', {}, ctx({ ask: 'choice' }))).toEqual({ type: 'next' });
    expect(mapKey('ArrowRight', {}, ctx({ target: 'radiogroup' }))).toBeNull();
    expect(mapKey('ArrowRight', {}, ctx({ target: 'slider' }))).toBeNull();
  });
  it('digits answer pick, choice and order asks only', () => {
    expect(mapKey('3', {}, ctx({ ask: 'pick' }))).toEqual({ type: 'answer', n: 3 });
    expect(mapKey('1', {}, ctx({ ask: 'choice' }))).toEqual({ type: 'answer', n: 1 });
    expect(mapKey('2', {}, ctx({ ask: 'order' }))).toEqual({ type: 'answer', n: 2 });
    expect(mapKey('2', {}, ctx({ ask: 'value' }))).toBeNull();
    expect(mapKey('2', {}, ctx())).toBeNull();
    expect(mapKey('0', {}, ctx({ ask: 'pick' }))).toBeNull();
  });
  it('Enter continues or submits an order; Backspace undoes one', () => {
    expect(mapKey('Enter', {}, ctx({ canContinue: true }))).toEqual({ type: 'continue' });
    expect(mapKey('Enter', {}, ctx({ ask: 'order' }))).toEqual({ type: 'submit' });
    expect(mapKey('Enter', {}, ctx({ ask: 'pick' }))).toBeNull();
    expect(mapKey('Backspace', {}, ctx({ ask: 'order' }))).toEqual({ type: 'undo' });
    expect(mapKey('Backspace', {}, ctx({ ask: 'choice' }))).toBeNull();
  });
  it('never fights text fields, focused buttons, dialogs or shortcuts with modifiers', () => {
    expect(mapKey(' ', {}, ctx({ target: 'text' }))).toBeNull();
    expect(mapKey('1', {}, ctx({ target: 'text', ask: 'pick' }))).toBeNull();
    expect(mapKey(' ', {}, ctx({ target: 'button', canContinue: true }))).toBeNull();
    expect(mapKey('Enter', {}, ctx({ target: 'button', canContinue: true }))).toBeNull();
    expect(mapKey('?', {}, ctx({ modal: true }))).toBeNull();
    expect(mapKey('ArrowLeft', { meta: true }, ctx())).toBeNull();
    expect(mapKey('1', { ctrl: true }, ctx({ ask: 'pick' }))).toBeNull();
  });
  it('? opens the shortcuts, Esc closes', () => {
    expect(mapKey('?', {}, ctx())).toEqual({ type: 'help' });
    expect(mapKey('Escape', {}, ctx())).toEqual({ type: 'close' });
  });
});
