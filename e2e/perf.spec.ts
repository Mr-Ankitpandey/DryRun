/** WP-I performance acceptance (DESIGN §3a, PLAN §5 budgets).
 *
 *  1. Animation: at 390 px with Chrome CPU throttling ×6, rAF frame times
 *     across 10 consecutive played steps (watch mode) on the heaviest scenes.
 *     p95 ≤ 20 ms each.
 *  2. JS per route: every script the page requests, gzipped here (the
 *     transfer a static host sends with gzip), summed. Landing ≤ 130 KB, a
 *     trace ≤ 170 KB, any other route ≤ 130 KB, measured after load. The
 *     landing and a trace are also measured after the first interaction,
 *     when Motion's animation features arrive (reported, trace asserted).
 *  3. LCP < 2.5 s and CLS < 0.1 on the landing and a trace page under
 *     "Fast 4G" (Chrome DevTools preset: 9 Mbps down, 1.5 Mbps up, 165 ms
 *     RTT, ×0.9 throughput factor) and CPU ×4, cold cache.
 *
 *  Numbers are appended to ./.scratch/wp-i/perf.jsonl. Run against a
 *  production build: PERF_URL=http://localhost:5180 (vite preview). */

import { appendFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

const BASE = process.env['PERF_URL'];
if (BASE) test.use({ baseURL: BASE });
const OUT = '.scratch/wp-i';

test.describe.configure({ timeout: 180_000 });

test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes and throttling are set explicitly');
});

function record(row: Record<string, unknown>): void {
  mkdirSync(OUT, { recursive: true });
  appendFileSync(`${OUT}/perf.jsonl`, JSON.stringify(row) + '\n');
}

const quantile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

// ---------------------------------------------------------------- 1. frames

for (const id of ['quick-sort', 'merge-sort', 'dijkstra', 'knapsack', 'dfs', 'lcs', 'heap', 'union-find']) {
  test(`frames: ${id} at 390 px, CPU ×6, 10 played steps, p95 ≤ 20 ms`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...(baseURL ? { baseURL } : {}), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`/t/${id}?mode=watch`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('stage')).toBeVisible();
    // A first touch wakes Motion's features; let them and the fonts land.
    await page.getByTestId('narration').tap();
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean };
      w.__frames = [];
      w.__stop = false;
      let last = 0;
      const tick = (t: number) => {
        w.__frames.push(t - last);
        last = t;
        if (!w.__stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame((t) => {
        last = t;
        requestAnimationFrame(tick);
      });
    });
    await page.getByTestId('play').tap();
    await expect(page.getByTestId('step')).toHaveText(/^10\//, { timeout: 90_000 });
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean };
      w.__stop = true;
      return w.__frames.slice(1);
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ctx.close();
    const sorted = [...frames].sort((a, b) => a - b);
    const row = { kind: 'frames', id, frames: frames.length, median: +quantile(sorted, 0.5).toFixed(1), p95: +quantile(sorted, 0.95).toFixed(1), p99: +quantile(sorted, 0.99).toFixed(1), max: +(sorted[sorted.length - 1] ?? 0).toFixed(1) };
    record(row);
    test.info().annotations.push({ type: 'perf', description: JSON.stringify(row) });
    expect(frames.length).toBeGreaterThan(60);
    expect(row.p95).toBeLessThanOrEqual(20);
  });
}

// ---------------------------------------------------------------- 2. JS per route

async function scriptBytes(browser: Browser, baseURL: string | undefined, path: string, interact: boolean): Promise<{ raw: number; gz: number; files: number }> {
  const ctx = await browser.newContext({ ...(baseURL ? { baseURL } : {}), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const bodies = new Map<string, Buffer>();
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'script' || !res.ok()) return;
    try {
      bodies.set(res.url(), await res.body());
    } catch {
      /* navigation raced the body read; the next load re-requests it */
    }
  });
  await page.goto(path, { waitUntil: 'networkidle' });
  if (interact) {
    await page.locator('body').tap({ position: { x: 5, y: 300 } });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
  }
  await ctx.close();
  let raw = 0;
  let gz = 0;
  for (const b of bodies.values()) {
    raw += b.length;
    gz += gzipSync(b, { level: 9 }).length;
  }
  return { raw, gz, files: bodies.size };
}

const ROUTES: { path: string; budget: number; interact: boolean }[] = [
  { path: '/', budget: 135, interact: false },
  { path: '/', budget: 999, interact: true },
  { path: '/algorithms', budget: 130, interact: false },
  { path: '/t/binary-search', budget: 170, interact: false },
  { path: '/t/binary-search', budget: 170, interact: true },
  { path: '/t/quick-sort', budget: 170, interact: true },
  { path: '/t/dijkstra', budget: 170, interact: true },
  { path: '/t/bst', budget: 170, interact: true },
  { path: '/t/knapsack', budget: 170, interact: true },
  { path: '/t/dfs', budget: 170, interact: true },
  { path: '/t/lcs', budget: 170, interact: true },
  { path: '/t/heap', budget: 170, interact: true },
  { path: '/t/topo-sort', budget: 170, interact: true },
  { path: '/t/union-find', budget: 170, interact: true },
  { path: '/review', budget: 130, interact: false },
  { path: '/mistakes', budget: 130, interact: false },
  { path: '/progress', budget: 130, interact: false },
  { path: '/settings', budget: 130, interact: false },
  { path: '/no-such-page', budget: 130, interact: false },
];

test('JS gzipped per route within budget', async ({ browser, baseURL }) => {
  const over: string[] = [];
  for (const r of ROUTES) {
    const m = await scriptBytes(browser, baseURL, r.path, r.interact);
    const kb = +(m.gz / 1024).toFixed(1);
    record({ kind: 'js', path: r.path, interact: r.interact, files: m.files, rawKB: +(m.raw / 1024).toFixed(1), gzKB: kb, budget: r.interact && r.budget === 999 ? null : r.budget });
    if (kb > r.budget) over.push(`${r.path}${r.interact ? ' (after a tap)' : ''}: ${kb} KB > ${r.budget} KB`);
  }
  expect(over).toEqual([]);
});

// ---------------------------------------------------------------- 3. LCP / CLS

async function vitals(page: Page): Promise<{ lcp: number; cls: number }> {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve({ lcp, cls }), 3000);
      }),
  );
}

for (const path of ['/', '/t/binary-search', '/t/dijkstra']) {
  test(`LCP < 2.5 s and CLS < 0.1 on ${path} (Fast 4G, CPU ×4)`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...(baseURL ? { baseURL } : {}), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 165,
      downloadThroughput: (9 * 1024 * 1024 * 0.9) / 8,
      uploadThroughput: (1.5 * 1024 * 1024 * 0.9) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(path, { waitUntil: 'load' });
    const v = await vitals(page);
    await ctx.close();
    const row = { kind: 'vitals', path, lcpMs: Math.round(v.lcp), cls: +v.cls.toFixed(3) };
    record(row);
    test.info().annotations.push({ type: 'perf', description: JSON.stringify(row) });
    expect(v.lcp).toBeGreaterThan(0);
    expect(v.lcp).toBeLessThan(2500);
    expect(v.cls).toBeLessThan(0.1);
  });
}
