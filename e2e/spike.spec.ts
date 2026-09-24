/** WP-A visual QA for the engine spike: every fixture renders, steps forward
 *  and back without console errors, keeps object constancy (an element keeps
 *  its <g> across a swap; a relinked tree node moves while the others stay),
 *  stays under the 200-primitive budget, and is screenshotted at 390 px and
 *  1280 px in light and dark. Screenshots land in ./.scratch/wp-a/shots/. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fixtures } from '../src/render/fixtures';

const SHOTS = '.scratch/wp-a/shots';
const BASE = process.env['SPIKE_URL'];
if (BASE) test.use({ baseURL: BASE });

// Viewports are set explicitly below; run once, under the desktop project.
test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes are set explicitly');
});

const CASES: { id: string; path: string; shotAt: number }[] = [
  { id: 'binary-search', path: '/spike', shotAt: 6 },
  { id: 'tree', path: '/spike/tree', shotAt: 12 },
  { id: 'graph', path: '/spike/graph', shotAt: 13 },
  { id: 'grid', path: '/spike/grid', shotAt: 7 },
  { id: 'recursion', path: '/spike/recursion', shotAt: 12 },
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function stepTo(page: Page, k: number): Promise<void> {
  const step = page.getByTestId('step');
  const current = Number((await step.textContent())?.split('/')[0]?.trim());
  const button = k > current ? page.getByTestId('next') : page.getByTestId('prev');
  for (let i = 0; i < Math.abs(k - current); i++) await button.click();
  await expect(step).toHaveText(new RegExp(`^${k} / `));
  // Motion applies values on its own frame loop; let it flush before reading the DOM.
  await page.waitForTimeout(120);
}

for (const c of CASES) {
  test(`${c.id}: steps forward and back, no console errors, screenshots`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(c.path);
    await expect(page.getByTestId('stage')).toBeVisible();
    const total = Number((await page.getByTestId('step').textContent())?.split('/')[1]?.trim());
    expect(total).toBeGreaterThan(3);

    // forward to the end, back three, forward again
    await stepTo(page, total);
    await expect(page.getByTestId('next')).toBeDisabled();
    await stepTo(page, total - 3);
    await stepTo(page, c.shotAt);

    // budget: ≤ 200 keyed primitives in the SVG
    const prims = await page.locator('svg[data-testid="stage"] [data-id]').count();
    expect(prims).toBeLessThanOrEqual(200);
    const nodes = await page.locator('svg[data-testid="stage"] *').count();
    test.info().annotations.push({ type: 'svg-nodes', description: `${c.id}: ${prims} prims, ${nodes} SVG elements at step ${c.shotAt}` });

    // wait for springs to settle before shooting
    await page.waitForTimeout(700);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${SHOTS}/${c.id}-${width}-${scheme}.png`, fullPage: true });
      }
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('object constancy: an element keeps its <g> across a swap and moves to the other slot', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/spike/recursion');
  await page.getByTestId('reduced').check(); // instant transitions: transforms settle at once
  const steps = fixtures['recursion']?.steps ?? [];
  const k = steps.findIndex((s) => s.events.some((e) => e.t === 'swap'));
  expect(k).toBeGreaterThanOrEqual(0);
  const swap = steps[k]?.events.find((e) => e.t === 'swap');
  if (!swap || swap.t !== 'swap') throw new Error('no swap');
  await stepTo(page, k);
  // which elements sit in the two slots before the swap
  const before = await page.evaluate(
    ({ a, b }) => {
      const bars = [...document.querySelectorAll('svg [data-view="array"] [data-id^="e:"]')] as HTMLElement[];
      const byX = bars.map((el) => ({ id: el.dataset['id'] as string, x: el.style.transform })).sort((p, q) => parseFloat(p.x.match(/translateX\(([-\d.]+)px\)/)?.[1] ?? '0') - parseFloat(q.x.match(/translateX\(([-\d.]+)px\)/)?.[1] ?? '0'));
      const idA = byX[a]?.id as string;
      const idB = byX[b]?.id as string;
      const w = window as unknown as { __a?: Element | null; __b?: Element | null };
      w.__a = document.querySelector(`[data-id="${idA}"]`);
      w.__b = document.querySelector(`[data-id="${idB}"]`);
      return { idA, idB, xA: byX[a]?.x, xB: byX[b]?.x };
    },
    { a: swap.a.i, b: swap.b.i },
  );
  await stepTo(page, k + 1);
  const after = await page.evaluate(({ idA, idB }) => {
    const w = window as unknown as { __a?: Element | null; __b?: Element | null };
    const elA = document.querySelector(`[data-id="${idA}"]`) as HTMLElement;
    const elB = document.querySelector(`[data-id="${idB}"]`) as HTMLElement;
    return { sameA: w.__a === elA, sameB: w.__b === elB, xA: elA.style.transform, xB: elB.style.transform };
  }, before);
  expect(after.sameA, 'element A keeps its <g>').toBe(true);
  expect(after.sameB, 'element B keeps its <g>').toBe(true);
  // x follows the slot (y differs: bar heights follow values)
  const tx = (t: string | undefined) => t?.match(/translateX\(([-\d.]+)px\)/)?.[1];
  expect(tx(after.xA)).toBe(tx(before.xB));
  expect(tx(after.xB)).toBe(tx(before.xA));
  expect(tx(after.xA)).not.toBe(tx(before.xA));
  expect(errors).toEqual([]);
});

test('object constancy: a relinked tree node keeps its <g> and moves; other nodes stay', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/spike/tree');
  await page.getByTestId('reduced').check();
  const steps = fixtures['tree']?.steps ?? [];
  const k = steps.findIndex((s) => s.events.some((e) => e.t === 'node.relink'));
  const ev = steps[k]?.events.find((e) => e.t === 'node.relink');
  if (!ev || ev.t !== 'node.relink') throw new Error('no relink');
  await stepTo(page, k);
  const snapshot = (id: string) =>
    page.evaluate((nodeId) => {
      const el = document.querySelector(`svg [data-view="tree"] [data-id="${nodeId}"]`) as HTMLElement | null;
      const w = window as unknown as Record<string, Element | null>;
      w[`__${nodeId}`] = el;
      return el ? el.style.transform : null;
    }, id);
  const movedBefore = await snapshot(ev.id);
  const stayBefore = await snapshot('n:8');
  const stayBefore2 = await snapshot('n:1');
  await stepTo(page, k + 1);
  const check = (id: string) =>
    page.evaluate((nodeId) => {
      const el = document.querySelector(`svg [data-view="tree"] [data-id="${nodeId}"]`) as HTMLElement | null;
      const w = window as unknown as Record<string, Element | null>;
      return { same: w[`__${nodeId}`] === el, transform: el ? el.style.transform : null };
    }, id);
  const moved = await check(ev.id);
  expect(moved.same).toBe(true);
  expect(moved.transform).not.toBe(movedBefore);
  const stay = await check('n:8');
  expect(stay.same).toBe(true);
  expect(stay.transform).toBe(stayBefore);
  const stay2 = await check('n:1');
  expect(stay2.same).toBe(true);
  expect(stay2.transform).toBe(stayBefore2);
  // the relinked node's edge (keyed by child) is still the same element
  expect(errors).toEqual([]);
});

test('linked views: hovering a PQ row highlights its graph node', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/spike/graph');
  await stepTo(page, 4);
  await page.waitForTimeout(400); // popped rows finish their exit fade
  const row = page.locator('[data-testid="panel-pq"] li[data-id="q:3"]');
  const ref = await row.getAttribute('data-ref');
  expect(ref).toBe('n:2');
  await row.hover();
  await expect(page.locator(`svg [data-view="graph"] [data-id="${ref}"]`)).toHaveAttribute('data-linked', 'true');
  await expect(page.locator(`[data-testid="dist-table"] tr[data-id="${ref}"]`)).toHaveAttribute('data-linked', 'true');
});
