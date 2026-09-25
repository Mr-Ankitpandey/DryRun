/** WP-E acceptance for the trace screen /t/:id.
 *
 *  How answers are known: the player exposes the expected answer as
 *  `data-answer-hint` on the open question ONLY when the URL carries
 *  `?debug=1` (see src/app/trace/AskPanel.tsx). Without it nothing leaks.
 *  The tests answer the first question of every trace wrong on purpose (a
 *  different candidate / option / value / order) and every other one right,
 *  then check the summary, the stored session and the console.
 *
 *  Between questions the tests step with → (instant, exact) rather than wait
 *  for play; the keyboard-only test uses Space / Enter and real play.
 *  Screenshots: ./.scratch/wp-e/shots/. Perf (DESIGN §3a): quick sort at
 *  390 px, CPU ×6, rAF frame times across 10 consecutive played steps. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SHOTS = '.scratch/wp-e/shots';
const BASE = process.env['TRACE_URL'];
if (BASE) test.use({ baseURL: BASE });

test.describe.configure({ timeout: 180_000 });

// Viewports are set explicitly; run once, under the desktop project.
test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes are set explicitly');
});

const MODULES = ['binary-search', 'quick-sort', 'dijkstra', 'bst', 'insertion-sort', 'merge-sort', 'bfs', 'knapsack'];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const openOrDone = '[data-testid="ask"], [data-testid="summary"]';

/** Steps forward (→) until a question opens or the summary shows. */
async function stepToNext(page: Page): Promise<void> {
  for (let i = 0; i < 700; i++) {
    if (await page.locator(openOrDone).count()) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error('no question or summary after 700 steps');
}

/** Answers the open question: right, or deliberately wrong. Returns its kind. */
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
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${SHOTS}/${name}-${width}-${scheme}.png` });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
}

for (const id of MODULES) {
  test(`${id}: guided trace end to end, ghost on a wrong answer, summary, persisted`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/t/${id}?debug=1`);
    await expect(page.getByTestId('trace-player')).toBeVisible();
    await expect(page.getByTestId('invariant')).toBeVisible();
    // Opening a link never auto-plays.
    await expect(page.getByTestId('step')).toHaveText(/^0\//);
    await page.waitForTimeout(300);
    await expect(page.getByTestId('step')).toHaveText(/^0\//);
    await page.getByTestId('start-play').click();

    let answered = 0;
    let wrongs = 0;
    for (;;) {
      await stepToNext(page);
      if (await page.getByTestId('summary').count()) break;
      const wrong = answered === 0;
      const kind = await answer(page, wrong);
      answered++;
      if (wrong) {
        wrongs++;
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'false');
        await expect(page.getByTestId('rule')).not.toBeEmpty();
        if (kind === 'pick') {
          await expect(page.getByTestId('ghost')).toBeVisible();
          await expect(page.getByTestId('truth-ring')).toBeVisible();
        }
        await expect(page.locator('[data-testid="timeline"] [data-mark="wrong"]')).toHaveCount(1);
        await shoot(page, `${id}-wrong`);
      } else {
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
        if (kind === 'pick') await expect(page.getByTestId('correct-ring')).toBeVisible();
      }
    }
    expect(answered).toBeGreaterThan(0);
    await expect(page.getByTestId('score')).toHaveText(new RegExp(`^${answered - wrongs} of ${answered} right`));
    await expect(page.getByTestId('summary-mistakes')).toBeVisible();
    await expect(page.getByTestId('trace-again')).toBeVisible();
    await shoot(page, `${id}-summary`);

    // The session is committed through the store (debounced save).
    await page.waitForTimeout(600);
    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('dryrun.v1') ?? '{}') as { sessions?: { algorithm: string; asked: number; correct: number }[]; mistakes?: unknown[] });
    const rec = stored.sessions?.find((s) => s.algorithm === id);
    expect(rec, 'session stored').toBeTruthy();
    expect(rec?.asked).toBe(answered);
    expect(rec?.correct).toBe(answered - wrongs);
    expect(stored.mistakes?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('binary search, keyboard only: Space to start, number keys and Enter to answer, Enter to continue', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/binary-search?debug=1');
  await expect(page.getByTestId('start')).toBeVisible();
  await page.keyboard.press('Space');
  let answered = 0;
  for (;;) {
    await page.waitForSelector(`${openOrDone}, [data-testid="continue"]:not([disabled])`, { timeout: 30_000 });
    if (await page.getByTestId('summary').count()) break;
    if (await page.getByTestId('ask').count()) {
      const ask = page.getByTestId('ask');
      const kind = await ask.getAttribute('data-kind');
      const hint = (await ask.getAttribute('data-answer-hint')) ?? '';
      if (kind === 'pick') {
        const key = await page.locator(`[data-cand="${hint}"]`).getAttribute('data-hint');
        expect(key, 'the right cell has a number key').not.toBeNull();
        await page.keyboard.press(String(key));
      } else if (kind === 'value') {
        await expect(page.getByTestId('value-input')).toBeFocused();
        await page.keyboard.type(hint.replace('-', '−'));
        await page.keyboard.press('Enter');
      } else throw new Error(`unexpected ${kind} in guided binary search`);
      answered++;
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
      continue;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
  await expect(page.getByTestId('score')).toHaveText(new RegExp(`^${answered} of ${answered} right`));
  // ? opens the shortcuts, Esc closes them.
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('scrubbing is exact and cannot pass a pending question', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/quick-sort?debug=1');
  const timeline = page.getByTestId('timeline');
  const box = await timeline.boundingBox();
  if (!box) throw new Error('no timeline');
  // Drag to the far right: the cursor stops at the first question.
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const gate = Number(await timeline.getAttribute('aria-valuenow'));
  expect(gate).toBeGreaterThan(0);
  await expect(page.getByTestId('ask')).toBeVisible();
  // Back to 0 with Home, forward one step with →: the same state as before.
  await page.waitForTimeout(1200);
  // What is visible: every keyed primitive that is not transparent, with its transform.
  const visible = () =>
    page.locator('svg[data-testid="stage"] [data-view="array"] [data-id]').evaluateAll((els) =>
      els
        .filter((e) => getComputedStyle(e).opacity !== '0')
        .map((e) => `${e.getAttribute('data-id')} ${(e as HTMLElement).style.transform} ${e.innerHTML.length}`)
        .join('\n'),
    );
  const before = await visible();
  await timeline.focus();
  await page.keyboard.press('Home');
  await expect(timeline).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('End');
  await expect(timeline).toHaveAttribute('aria-valuenow', String(gate));
  await page.waitForTimeout(1200);
  expect(await visible()).toBe(before);
});

test('reduced motion: every change is instant and the ghost still shows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/binary-search?debug=1');
  await page.getByTestId('start-play').click();
  await expect(page.getByTestId('ask')).toBeVisible();
  await answer(page, true);
  await expect(page.getByTestId('ghost')).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${SHOTS}/reduced-binary-search-${width}.png` });
  }
});

test('watch mode plays through without questions and ends with a summary', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/binary-search?mode=watch');
  await expect(page.getByTestId('ask')).toHaveCount(0);
  await page.getByTestId('speed').click(); // 1.5×
  await page.getByTestId('speed').click(); // 2×
  await page.getByTestId('play').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('trace-this')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('unknown algorithm and unreadable input', async ({ page }) => {
  await page.goto('/t/no-such-thing');
  await expect(page.getByRole('heading', { name: /No algorithm called/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See all algorithms' })).toBeVisible();
  await page.goto('/t/binary-search?i=9,3,1&x=2');
  await expect(page.getByTestId('input-notice')).toContainText('could not be read');
  await expect(page.getByTestId('trace-player')).toBeVisible();
});

test('edit input: a validation error is shown, a valid input and a preset update the URL', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/binary-search');
  await page.getByTestId('edit-input-button').click();
  const values = page.locator('[data-field="i"]');
  await values.fill('9, 3, 1');
  await page.getByTestId('apply-input').click();
  await expect(page.getByTestId('input-error')).toContainText('sorted');
  await values.fill('1,4,6,8');
  await page.locator('[data-field="x"]').fill('6');
  await page.getByTestId('apply-input').click();
  await expect(page).toHaveURL(/i=1,4,6,8/);
  await expect(page.getByTestId('trace-player')).toBeVisible();
  await page.getByTestId('edit-input-button').click();
  await page.locator('[data-preset="absent"]').click();
  await expect(page).toHaveURL(/x=20/);
});

test('performance: quick sort at 390 px under CPU ×6, p95 frame time across 10 played steps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/quick-sort?mode=watch');
  await expect(page.getByTestId('stage')).toBeVisible();
  await page.waitForTimeout(800); // fonts, motion features chunk
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    let last = performance.now();
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
  await page.getByTestId('play').click();
  await expect(page.getByTestId('step')).toHaveText(/^10\//, { timeout: 60_000 });
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames.slice(1);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const sorted = [...frames].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const p95 = q(0.95);
  const p99 = q(0.99);
  const max = sorted[sorted.length - 1] ?? 0;
  const line = `frames=${frames.length} median=${q(0.5).toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`;
  test.info().annotations.push({ type: 'perf', description: line });
  console.log(`[perf] quick-sort 390px cpu×6: ${line}`);
  expect(frames.length).toBeGreaterThan(100);
  expect(p95).toBeLessThanOrEqual(20);
});
