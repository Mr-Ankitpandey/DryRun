import { describe, expect, it } from 'vitest';
import { atGate, createTimeline, timelineReducer as r } from './timeline';

describe('timeline', () => {
  it('steps forward and back within bounds', () => {
    let t = createTimeline(3);
    t = r(t, { type: 'prev' });
    expect(t.k).toBe(0);
    t = r(t, { type: 'next' });
    t = r(t, { type: 'next' });
    t = r(t, { type: 'next' });
    t = r(t, { type: 'next' });
    expect(t.k).toBe(3);
    expect(t.playing).toBe(false);
  });

  it('play cannot pass the gate; answering (moving the gate) releases it', () => {
    let t = createTimeline(10, 2);
    t = r(t, { type: 'play' });
    expect(t.playing).toBe(true);
    t = r(t, { type: 'next' });
    expect(t.k).toBe(1);
    expect(t.playing).toBe(true);
    t = r(t, { type: 'next' });
    expect(t.k).toBe(2);
    expect(t.playing).toBe(false);
    expect(atGate(t)).toBe(true);
    t = r(t, { type: 'next' });
    expect(t.k).toBe(2);
    t = r(t, { type: 'play' });
    expect(t.playing).toBe(false);
    t = r(t, { type: 'gate', gate: 5 });
    t = r(t, { type: 'next' });
    expect(t.k).toBe(3);
  });

  it('seek and scrub clamp to the gate and flag scrubbing', () => {
    let t = createTimeline(10, 4);
    t = r(t, { type: 'scrub', k: 9 });
    expect(t.k).toBe(4);
    expect(t.scrubbing).toBe(true);
    t = r(t, { type: 'scrubEnd' });
    expect(t.scrubbing).toBe(false);
    t = r(t, { type: 'seek', k: -3 });
    expect(t.k).toBe(0);
    t = r(t, { type: 'gate', gate: null });
    t = r(t, { type: 'seek', k: 99 });
    expect(t.k).toBe(10);
  });

  it('setting a gate behind the cursor pulls the cursor back', () => {
    let t = createTimeline(10);
    t = r(t, { type: 'seek', k: 7 });
    t = r(t, { type: 'gate', gate: 3 });
    expect(t.k).toBe(3);
    expect(() => r(t, { type: 'gate', gate: 11 })).toThrow();
  });
});
