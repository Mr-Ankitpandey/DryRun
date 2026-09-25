import { describe, expect, it } from 'vitest';
import { frameLabel } from './labels';

describe('frameLabel', () => {
  it('drops the duplicated argument list the scene appends', () => {
    expect(frameLabel('quicksort(0, 6)(0,6)', 400, 11)).toBe('quicksort(0, 6)');
  });
  it('keeps a plain label with its arguments', () => {
    expect(frameLabel('fib(3)', 400, 11)).toBe('fib(3)');
  });
  it('shortens to fit narrow pills', () => {
    expect(frameLabel('quicksort(3, 4)(3,4)', 60, 11)).toBe('(3, 4)');
    expect(frameLabel('quicksort(3, 3)(3,3)', 34, 11)).toBe('3,3');
  });
  it('adds the returned value only when it fits', () => {
    expect(frameLabel('fib(3)(3)', 400, 11, ' → 2')).toBe('fib(3) → 2');
    expect(frameLabel('fib(3)(3)', 50, 11, ' → 2')).toBe('3 → 2');
  });
});
