/** Round 4 acceptance: guided traces of the binary heap, topological sort and
 *  union-find, end to end. Answers come from `data-answer-hint` (only with
 *  ?debug=1). The first pick question is answered wrong on purpose (the ghost
 *  and the truth ring must show), every other question right; the summary and
 *  score must match and the console must stay clean. Each module also checks
 *  its signature linked view. Screenshots: ./.scratch/r4/shots/. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SHOTS = '.scratch/r4/shots';
const BASE = process.env['TRACE_URL'];
if (BASE) test.use({ baseURL: BASE });

test.describe.configure({ timeout: 180_000 });

// Viewports are set explicitly; run once, under the desktop project.
test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes are set explicitly');
});

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const openOrDone = '[data-testid="ask"], [data-testid="summary"]';

async function stepToNext(page: Page): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (await page.locator(openOrDone).count()) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error('no question or summary after 400 steps');
}

/** Answers the open question, right or deliberately wrong. Returns its kind. */
async function answer(page: Page, wrong: boolean): Promise<string> {
  const ask = page.getByTestId('ask');
  const kind = (await ask.getAttribute('data-kind')) ?? '';
  const hint = (await ask.getAttribute('data-answer-hint')) ?? '';
  if (kind === 'pick') {
    let id = hint;
    if (wrong) {
      const ids = await page.locator('[data-cand]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cand') ?? ''));
      id = ids.find((x) => x !== hint) ?? hint;
    }
    await page.locator(`[data-cand="${id}"]`).click();
  } else if (kind === 'choice') {
    let option = hint;
    if (wrong) {
      const options = await page.locator('[data-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-option') ?? ''));
      option = options.find((o) => o !== hint) ?? hint;
    }
    await page.locator(`[data-option="${option}"]`).click();
  } else if (kind === 'value') {
    const n = Number(hint) + (wrong ? 1 : 0);
    await page.getByTestId('value-input').fill(n < 0 ? `−${-n}` : String(n));
    await page.keyboard.press('Enter');
  } else if (kind === 'order') {
    const ids = hint.split(',');
    for (const id of wrong ? [...ids].reverse() : ids) await page.locator(`[data-item="${id}"]`).click();
    await page.getByTestId('order-submit').click();
  } else throw new Error(`unknown ask kind ${kind}`);
  await expect(page.getByTestId('verdict')).toBeVisible();
  return kind;
}

async function shoot(page: Page, name: string): Promise<void> {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/e2e-${name}-${width}-${scheme}.png` });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
}

/** A full guided trace: the first pick wrong (ghost), everything else right. */
async function guidedTrace(page: Page, name: string, path: string): Promise<void> {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(path);
  await expect(page.getByTestId('trace-player')).toBeVisible();
  await expect(page.getByTestId('step')).toHaveText(/^0\//);
  // A trace whose first step is a question opens on it; otherwise press start.
  await expect(page.locator('[data-testid="start-play"], [data-testid="ask"]').first()).toBeVisible();
  if (await page.getByTestId('start-play').count()) await page.getByTestId('start-play').click();
  let answered = 0;
  let wrongs = 0;
  for (;;) {
    await stepToNext(page);
    if (await page.getByTestId('summary').count()) break;
    const kind = (await page.getByTestId('ask').getAttribute('data-kind')) ?? '';
    const wrong = kind === 'pick' && wrongs === 0;
    await answer(page, wrong);
    answered++;
    if (wrong) {
      wrongs++;
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'false');
      await expect(page.getByTestId('rule')).not.toBeEmpty();
      await expect(page.getByTestId('ghost')).toBeVisible();
      await expect(page.getByTestId('truth-ring')).toBeVisible();
      await shoot(page, `${name}-wrong`);
    } else {
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
    }
  }
  expect(answered).toBeGreaterThan(2);
  expect(wrongs, 'the trace asked at least one pick').toBe(1);
  await expect(page.getByTestId('score')).toHaveText(new RegExp(`^${answered - wrongs} of ${answered} right`));
  await shoot(page, `${name}-summary`);
  expect(errors, errors.join('\n')).toEqual([]);
}

test('heap: guided extract trace, ghost on a wrong pick, summary, clean console', async ({ page }) => {
  await guidedTrace(page, 'heap', '/t/heap?i=1,5,2,6,7,4,3,9&op=extract&x=0&debug=1');
});

test('heap: a swap moves the same element in the array and the tree; hover links both', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/heap?i=2,5,3,8,9,4,7&op=insert&x=1&mode=watch');
  const stage = page.getByTestId('stage');
  await expect(stage).toBeVisible();
  const id = 'e:a:7#1';
  // Step to the first swap (set, parent, decide, swap) and let it land.
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  const bar = stage.locator(`[data-id="${id}"]`);
  const node = stage.locator(`[data-id="h:${id}"]`);
  await expect(bar).toHaveCount(1);
  await expect(node).toHaveCount(1);
  // Hovering the tree node links the bar (and itself).
  await node.hover();
  await expect(bar).toHaveAttribute('data-linked', 'true');
  await expect(node).toHaveAttribute('data-linked', 'true');
  // Hovering the bar links the node.
  await page.mouse.move(5, 5);
  await bar.hover();
  await expect(node).toHaveAttribute('data-linked', 'true');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('topological sort: guided trace, ghost on a wrong pick, summary, clean console', async ({ page }) => {
  await guidedTrace(page, 'topo', '/t/topo-sort?debug=1');
});

test('topological sort: every arc has an arrowhead, visible in light and dark', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/topo-sort?n=5&g=0>1,1>2,2>3,0>3,3>4,0>4&mode=watch');
  const stage = page.getByTestId('stage');
  await expect(stage).toBeVisible();
  await expect(stage.locator('[data-arc="true"]')).toHaveCount(6);
  await expect(stage.locator('[data-head]')).toHaveCount(6);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(200);
    const heads = await stage.locator('[data-head]').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { fill: getComputedStyle(e).fill, w: r.width, h: r.height };
      }),
    );
    for (const h of heads) {
      expect(h.fill).not.toBe('none');
      expect(h.fill).not.toMatch(/rgba\(.*,\s*0\)$/);
      expect(h.w).toBeGreaterThan(3);
      expect(h.h).toBeGreaterThan(3);
    }
    await page.screenshot({ path: `${SHOTS}/e2e-topo-arrows-${scheme}.png` });
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('union-find: guided trace, ghost on a wrong pick, summary, clean console', async ({ page }) => {
  await guidedTrace(page, 'union-find', '/t/union-find?debug=1');
});

test('union-find: path compression moves the node up to sit under its root', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/union-find?mode=watch');
  const stage = page.getByTestId('stage');
  await expect(stage).toBeVisible();
  const centre = async (id: string) => {
    const box = await stage.locator(`[data-id="${id}"]`).first().boundingBox();
    if (!box) throw new Error(`no ${id}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Steps 1–35 build the tree, 36 walks find(7), 37 compresses 7.
  for (let k = 0; k < 36; k++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  const before = await centre('n:7');
  const child = await centre('n:1');
  expect(before.y).toBeGreaterThan(child.y + 100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  const after = await centre('n:7');
  expect(Math.abs(after.y - child.y)).toBeLessThan(2);
  await page.screenshot({ path: `${SHOTS}/e2e-uf-compressed.png` });
  expect(errors, errors.join('\n')).toEqual([]);
});
