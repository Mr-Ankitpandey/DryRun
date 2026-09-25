import { describe, expect, it } from 'vitest';
import type { DailyPoint } from '@/learn/progress';
import { PANEL, areaPath, barFraction, lastDataIndex, linePath, nearestDay, panelSummary, plotHeight, plotWidth, runs, stepToData, xAt, yAt } from './chart';

const day = (date: string, asked: number, correct: number): DailyPoint => ({ date, asked, correct, accuracy: asked === 0 ? null : correct / asked });

/** 6 days: data on 0, 1, 3 and 5 → runs [0,1], [3], [5]. */
const series: DailyPoint[] = [
  day('2026-09-20', 4, 2),
  day('2026-09-21', 4, 4),
  day('2026-09-22', 0, 0),
  day('2026-09-23', 5, 5),
  day('2026-09-24', 0, 0),
  day('2026-09-25', 10, 7),
];

describe('scales', () => {
  it('maps the first and last day to the plot edges and 0–100 % to the plot height', () => {
    expect(xAt(0, 30)).toBe(PANEL.left);
    expect(xAt(29, 30)).toBe(PANEL.width - PANEL.right);
    expect(xAt(0, 1)).toBe(PANEL.left + plotWidth(PANEL) / 2);
    expect(yAt(1)).toBe(PANEL.top);
    expect(yAt(0)).toBe(PANEL.top + plotHeight(PANEL));
    expect(yAt(0.5)).toBe(PANEL.top + plotHeight(PANEL) / 2);
    expect(yAt(1.4)).toBe(PANEL.top);
    expect(yAt(-1)).toBe(yAt(0));
  });
  it('the shared frame makes every panel use the same y for the same accuracy', () => {
    const a = runs([day('d', 4, 3), day('e', 4, 3)]);
    const b = runs([day('d', 8, 6), day('e', 0, 0), day('f', 40, 30)]);
    expect(a[0]?.[0]?.y).toBe(b[0]?.[0]?.y);
  });
});

describe('runs and paths', () => {
  it('splits at days without data: gaps, not zeros', () => {
    const r = runs(series);
    expect(r.map((run) => run.map((p) => p.i))).toEqual([[0, 1], [3], [5]]);
    expect(r[2]?.[0]?.accuracy).toBeCloseTo(0.7);
    expect(r.flat().every((p) => p.y < yAt(0))).toBe(true);
  });
  it('draws a line and an area only for runs of two or more', () => {
    const [pair, single] = runs(series);
    expect(linePath(pair ?? [])).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
    expect(linePath(single ?? [])).toBe('');
    expect(areaPath(single ?? [])).toBe('');
    const area = areaPath(pair ?? []);
    expect(area.endsWith('Z')).toBe(true);
    expect(area).toContain(` ${yAt(0)} `);
  });
  it('has no runs for an empty series', () => {
    expect(runs([day('a', 0, 0), day('b', 0, 0)])).toEqual([]);
  });
});

describe('hover and keyboard helpers', () => {
  it('snaps an x to the nearest day, clamped', () => {
    expect(nearestDay(PANEL.left, 30)).toBe(0);
    expect(nearestDay(xAt(7, 30) + 1, 30)).toBe(7);
    expect(nearestDay(-50, 30)).toBe(0);
    expect(nearestDay(9999, 30)).toBe(29);
    expect(nearestDay(100, 1)).toBe(0);
  });
  it('steps between days with data', () => {
    expect(stepToData(series, 1, 1)).toBe(3);
    expect(stepToData(series, 3, 1)).toBe(5);
    expect(stepToData(series, 5, 1)).toBe(5);
    expect(stepToData(series, 3, -1)).toBe(1);
    expect(stepToData(series, 0, -1)).toBe(0);
    expect(lastDataIndex(series)).toBe(5);
    expect(lastDataIndex([day('a', 0, 0)])).toBe(-1);
  });
  it('bar fractions are relative to the largest count', () => {
    expect(barFraction(3, 6)).toBe(0.5);
    expect(barFraction(6, 6)).toBe(1);
    expect(barFraction(1, 0)).toBe(0);
  });
});

describe('panelSummary', () => {
  it('describes first and latest values in words', () => {
    expect(panelSummary('Dijkstra', series)).toBe('Dijkstra: answers on 4 days, from 50% on Sep 20 to 70% on Sep 25.');
    expect(panelSummary('BST', [day('2026-09-02', 3, 3)])).toBe('BST: answers on 1 day, Sep 2 at 100%.');
    expect(panelSummary('BST', [day('2026-09-02', 0, 0)])).toBe('BST: no answers in this period.');
  });
});
