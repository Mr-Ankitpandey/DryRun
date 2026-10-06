/** WP-K acceptance for the Blind level (`?level=blind`).
 *
 *  Between two questions the stage is frozen on the last confirmed state and
 *  the steps up to the question run hidden. The tests check, per algorithm:
 *  nothing on the stage moves while a question is open (element transforms
 *  before and after trying to play, step and scrub), the hidden-steps
 *  sentence, the timeline stopping at the frozen point, the reveal playing
 *  through the answered step before the verdict, the ghost on a wrong pick,
 *  the summary and the stored level. Answers come from `data-answer-hint`
 *  (only with ?debug=1). Screenshots: ./.scratch/wp-k/shots/. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SHOTS = '.scratch/wp-k/shots';

test.describe.configure({ timeout: 240_000 });

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

/** Every keyed primitive on the stage with its transform and opacity. */
function stageSnapshot(page: Page): Promise<string> {
  return page.locator('svg[data-testid="stage"] [data-id]').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-id')} ${(e as HTMLElement).style.transform} ${getComputedStyle(e).opacity} ${e.textContent ?? ''}`).join('\n'),
  );
}

/** The snapshot once springs from the last reveal have come to rest. */
async function settledSnapshot(page: Page): Promise<string> {
  let prev = await stageSnapshot(page);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(200);
    const next = await stageSnapshot(page);
    if (next === prev) return next;
    prev = next;
  }
  throw new Error('the stage never came to rest');
}

const stepK = async (page: Page): Promise<number> => Number(((await page.getByTestId('step').textContent()) ?? '0/').split('/')[0]);

/** Waits for the next question (pressing Play where the start panel asks for
 *  it, Continue after a verdict) or the summary. */
async function toNextAsk(page: Page): Promise<boolean> {
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('summary').count()) return false;
    if (await page.getByTestId('ask').count()) return true;
    const start = page.getByTestId('start-play');
    if ((await start.count()) && (await start.isEnabled())) await start.click();
    const cont = page.getByTestId('continue');
    if ((await cont.count()) && (await cont.isEnabled())) await cont.click();
    await page.waitForTimeout(100);
  }
  throw new Error('no question or summary');
}

async function answerOpen(page: Page, wrong: boolean): Promise<string> {
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
  return kind;
}

async function shoot(page: Page, name: string): Promise<void> {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/${name}-${width}-${scheme}.png` });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
}

for (const id of ['binary-search', 'quick-sort', 'dijkstra']) {
  test(`${id}: blind trace — frozen stage, hidden steps, reveal, verdict, summary`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/t/${id}?level=blind&debug=1`);
    await expect(page.getByTestId('trace-player')).toBeVisible();
    // The level control offers Blind, selected; the first-time note explains it once.
    await expect(page.getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: 'Blind' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('blind-intro')).toContainText('The stage freezes between questions: run the hidden steps in your head.');
    await page.getByTestId('blind-intro-dismiss').click();
    await expect(page.getByTestId('blind-intro')).toHaveCount(0);

    let answered = 0;
    let wrongs = 0;
    let hiddenSeen = 0;
    let wrongPick = false;
    let shotFrozen = false;
    const timeline = page.getByTestId('timeline');
    while (await toNextAsk(page)) {
      const ask = page.getByTestId('ask');
      const askK = Number(await ask.getAttribute('data-ask-index'));
      const frozenK = await stepK(page);
      const hidden = askK - frozenK;
      expect(hidden, 'the question opens at or before its step').toBeGreaterThanOrEqual(0);
      expect(Number(await timeline.getAttribute('aria-valuenow'))).toBe(frozenK);
      const before = await settledSnapshot(page);

      if (hidden > 0) {
        hiddenSeen++;
        const sentence = `${hidden} ${hidden === 1 ? 'step runs' : 'steps run'} hidden. Keep the state in your head.`;
        // The narration line says it at every frozen point, including k = 0.
        await expect(page.getByTestId('narration')).toContainText(sentence);
        await expect(timeline).toHaveAttribute('aria-valuetext', new RegExp(sentence.replace('.', '\\.')));

        // Try to get into the hidden range: step, play, End on the timeline, drag to the far right.
        await page.keyboard.press('ArrowRight');
        await timeline.focus();
        await page.keyboard.press('End');
        await expect(timeline).toHaveAttribute('aria-valuenow', String(frozenK));
        await page.keyboard.press('PageUp');
        await expect(timeline).toHaveAttribute('aria-valuenow', String(frozenK));
        const box = await timeline.boundingBox();
        if (!box) throw new Error('no timeline');
        await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await expect(timeline).toHaveAttribute('aria-valuenow', String(frozenK));
        await expect(page.getByTestId('ask')).toBeVisible();
        await page.waitForTimeout(600);
        expect(await stageSnapshot(page), 'the stage does not change while steps run hidden').toBe(before);
        if (!shotFrozen) {
          shotFrozen = true;
          await shoot(page, `${id}-frozen`);
        }
      }

      const kind = (await page.getByTestId('ask').getAttribute('data-kind')) ?? '';
      const wrong = answered === 0 || (kind === 'pick' && !wrongPick);
      await answerOpen(page, wrong);
      answered++;
      if (hidden > 0) {
        // The reveal plays the hidden steps (and the answered one) before the verdict.
        await expect(page.getByTestId('blind-reveal')).toBeVisible();
        await expect(page.getByTestId('verdict')).toHaveCount(0);
      }
      await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 30_000 });
      expect(await stepK(page), 'the verdict shows right after the answered step').toBe(askK + 1);
      if (wrong) {
        wrongs++;
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'false');
        await expect(page.getByTestId('rule')).not.toBeEmpty();
        if (kind === 'pick') {
          wrongPick = true;
          await expect(page.getByTestId('ghost')).toBeVisible();
          await expect(page.getByTestId('truth-ring')).toBeVisible();
          if (wrongs <= 2) await shoot(page, `${id}-wrong`);
        }
      } else {
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
        if (kind === 'pick') await expect(page.getByTestId('correct-ring')).toBeVisible();
      }
      // The revealed steps are confirmed now: the timeline may go back over them.
      if (hidden > 0) {
        await timeline.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(timeline).toHaveAttribute('aria-valuenow', String(askK));
        await page.keyboard.press('End');
        await expect(timeline).toHaveAttribute('aria-valuenow', /\d+/);
        expect(Number(await timeline.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(askK + 1);
        await page.keyboard.press('Home');
        await page.keyboard.press('End');
      }
    }
    expect(answered).toBeGreaterThan(1);
    expect(hiddenSeen, 'some questions had hidden steps').toBeGreaterThan(0);
    await expect(page.getByTestId('score')).toHaveText(new RegExp(`^(Blind: )?${answered - wrongs} of ${answered} right`));
    await shoot(page, `${id}-summary`);

    await page.waitForTimeout(600);
    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('dryrun.v1') ?? '{}') as { sessions?: { algorithm: string; level: string; asked: number; correct: number }[]; mistakes?: unknown[] });
    const rec = stored.sessions?.find((s) => s.algorithm === id);
    expect(rec?.level).toBe('blind');
    expect(rec?.asked).toBe(answered);
    expect(rec?.correct).toBe(answered - wrongs);
    expect(stored.mistakes?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('blind, keyboard only: number keys answer, Enter skips the reveal, Enter continues', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/quick-sort?level=blind&debug=1');
  await expect(page.getByTestId('trace-player')).toBeVisible();
  let answered = 0;
  let skipped = 0;
  for (;;) {
    await page.waitForSelector('[data-testid="ask"], [data-testid="summary"], [data-testid="continue"]:not([disabled]), [data-testid="start-play"]:not([disabled])', { timeout: 30_000 });
    if (await page.getByTestId('summary').count()) break;
    if (await page.getByTestId('ask').count()) {
      const ask = page.getByTestId('ask');
      const kind = await ask.getAttribute('data-kind');
      const askK = Number(await ask.getAttribute('data-ask-index'));
      const hidden = askK - (await stepK(page));
      const hint = (await ask.getAttribute('data-answer-hint')) ?? '';
      if (kind === 'pick') {
        const key = await page.locator(`[data-cand="${hint}"]`).getAttribute('data-hint');
        expect(key, 'the right element has a number key').not.toBeNull();
        await page.keyboard.press(String(key));
      } else if (kind === 'choice') {
        const n = await page.locator('[data-option]').evaluateAll((els, h) => els.findIndex((e) => e.getAttribute('data-option') === h) + 1, hint);
        await page.keyboard.press(String(n));
      } else throw new Error(`unexpected ${kind} in guided quick sort`);
      answered++;
      if (hidden > 1) {
        await expect(page.getByTestId('reveal-skip')).toBeFocused();
        await page.keyboard.press('Enter');
        skipped++;
      }
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
      expect(await stepK(page)).toBe(askK + 1);
      continue;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
  expect(skipped).toBeGreaterThan(0);
  await expect(page.getByTestId('score')).toHaveText(new RegExp(`^(Blind: )?${answered} of ${answered} right`));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('blind, reduced motion: the reveal is instant and the ghost still shows', async ({ page }) => {
  const errors = watchConsole(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/t/binary-search?level=blind&debug=1');
  await expect(page.getByTestId('ask')).toBeVisible();
  const askK = Number(await page.getByTestId('ask').getAttribute('data-ask-index'));
  expect(askK).toBeGreaterThan(await stepK(page));
  await answerOpen(page, true);
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.getByTestId('blind-reveal')).toHaveCount(0);
  expect(await stepK(page)).toBe(askK + 1);
  await expect(page.getByTestId('ghost')).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${SHOTS}/reduced-blind-binary-search-${width}.png` });
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('blind on a phone: the sheet narrates the hidden steps; watch mode ignores blind', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/binary-search?level=blind&debug=1');
  await expect(page.getByTestId('ask')).toBeVisible();
  await answerOpen(page, false);
  await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('ask')).toBeVisible();
  const askK = Number(await page.getByTestId('ask').getAttribute('data-ask-index'));
  const hidden = askK - (await stepK(page));
  if (hidden > 0) await expect(page.getByTestId('narration')).toContainText('hidden. Keep the state in your head.');
  await page.goto('/t/binary-search?level=blind&mode=watch');
  await expect(page.getByTestId('ask')).toHaveCount(0);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('step')).not.toHaveText(/^0\//);
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const id of ['bst', 'insertion-sort', 'merge-sort', 'bfs', 'knapsack']) {
  test(`${id}: blind trace runs to the summary, every verdict right after its step`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/t/${id}?level=blind&debug=1`);
    await expect(page.getByTestId('trace-player')).toBeVisible();
    let answered = 0;
    let hiddenSeen = 0;
    while (await toNextAsk(page)) {
      const askK = Number(await page.getByTestId('ask').getAttribute('data-ask-index'));
      const frozenK = await stepK(page);
      const hidden = askK - frozenK;
      expect(hidden).toBeGreaterThanOrEqual(0);
      if (hidden > 0) {
        hiddenSeen++;
        if (frozenK > 0) await expect(page.getByTestId('narration')).toContainText('hidden. Keep the state in your head.');
      }
      await answerOpen(page, answered === 0);
      answered++;
      const skip = page.getByTestId('reveal-skip');
      if (hidden > 2 && (await skip.count())) await skip.click();
      await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 30_000 });
      expect(await stepK(page)).toBe(askK + 1);
    }
    expect(answered).toBeGreaterThan(0);
    test.info().annotations.push({ type: 'blind', description: `${id}: ${answered} asks, ${hiddenSeen} with hidden steps` });
    await expect(page.getByTestId('score')).toHaveText(new RegExp(`^(Blind: )?${answered - 1} of ${answered} right`));
    await page.waitForTimeout(600);
    const level = await page.evaluate((alg) => (JSON.parse(window.localStorage.getItem('dryrun.v1') ?? '{}') as { sessions?: { algorithm: string; level: string }[] }).sessions?.find((s) => s.algorithm === alg)?.level, id);
    expect(level).toBe('blind');
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('performance: the quick sort reveal at 390 px under CPU ×6 keeps p95 frame time ≤ 20 ms', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/quick-sort?level=blind&debug=1');
  await expect(page.getByTestId('ask')).toBeVisible();
  const askK = Number(await page.getByTestId('ask').getAttribute('data-ask-index'));
  expect(askK - (await stepK(page))).toBeGreaterThanOrEqual(8);
  await page.mouse.move(10, 10); // wake the motion features
  await page.waitForTimeout(800);
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
  await answerOpen(page, false);
  await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 60_000 });
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames.slice(1);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const sorted = [...frames].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const line = `frames=${frames.length} median=${q(0.5).toFixed(1)}ms p95=${q(0.95).toFixed(1)}ms p99=${q(0.99).toFixed(1)}ms max=${(sorted[sorted.length - 1] ?? 0).toFixed(1)}ms`;
  test.info().annotations.push({ type: 'perf', description: line });
  console.log(`[perf] blind reveal quick-sort 390px cpu×6: ${line}`);
  expect(frames.length).toBeGreaterThan(60);
  expect(q(0.95)).toBeLessThanOrEqual(20);
});
