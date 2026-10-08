/** WP-I accessibility acceptance.
 *
 *  1. axe (WCAG 2.2 A/AA tags) on every route, light and dark, 390 and 1280 px:
 *     /, /algorithms, /review, /mistakes, /progress and /settings with a seeded
 *     store (so the chart and the lists render), the landing hero and a 404
 *     with an empty store, and /t/<id> for every algorithm at step 0, with a
 *     question open and with a verdict (a deliberately wrong answer, so the
 *     ghost is on screen). Zero serious or critical violations. Every scan's
 *     counts by impact are appended to ./.scratch/wp-i/axe.jsonl.
 *  2. Keyboard only: a full binary-search trace and the landing hero.
 *  3. Focus is visible on every tab stop (2 px outline, or the stage's own
 *     solid pen ring on pick targets).
 *  4. The narration's live region stays silent while the timeline is dragged
 *     or steps fly past, and speaks the settled step.
 *  5. Phones: every tap target is ≥ 44 px (stage targets ≥ 32 px, apart).
 *
 *  Answers come from `data-answer-hint`, only present with ?debug=1.
 *  Run against a server: A11Y_URL=http://localhost:5180 (or a config baseURL). */

import { appendFileSync, mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { Store } from '../src/lib/storage';

const BASE = process.env['A11Y_URL'];
if (BASE) test.use({ baseURL: BASE });
const OUT = '.scratch/wp-i';

test.describe.configure({ timeout: 240_000 });

// Viewports and themes are set explicitly; run once, under the desktop project.
test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes are set explicitly');
});

const ALGORITHMS = ['binary-search', 'quick-sort', 'dijkstra', 'bst', 'insertion-sort', 'merge-sort', 'bfs', 'knapsack', 'dfs', 'lcs', 'heap', 'topo-sort', 'union-find'];

interface View {
  width: 390 | 1280;
  scheme: 'light' | 'dark';
}
const VIEWS: View[] = [
  { width: 390, scheme: 'light' },
  { width: 390, scheme: 'dark' },
  { width: 1280, scheme: 'light' },
  { width: 1280, scheme: 'dark' },
];
const tag = (v: View) => `${v.width}-${v.scheme}`;

const DAY = 24 * 60 * 60 * 1000;

/** A month of use: sessions and mistakes on three algorithms, one review due. */
function seededStore(now: number): Store {
  const input: Record<string, string> = {
    'binary-search': 'i=3,7,9,12,15,21,30,42,51&x=42&v=classic',
    dijkstra: 'g=0-1:4,0-2:1,2-1:2,1-3:1,2-3:5&n=4&s=0',
    bst: 'i=50,30,70,20,40,60,80&op=delete&x=30',
  };
  const plan: [string, number, number, number][] = [
    ['binary-search', 26, 6, 3],
    ['binary-search', 14, 6, 5],
    ['binary-search', 2, 6, 6],
    ['dijkstra', 20, 8, 4],
    ['dijkstra', 9, 8, 6],
    ['bst', 12, 7, 4],
    ['bst', 4, 7, 6],
  ];
  const kinds = ['boundary', 'comparison', 'stale', 'order', 'subtree'] as const;
  const sessions: Store['sessions'] = [];
  const mistakes: Store['mistakes'] = [];
  plan.forEach(([algorithm, ago, asked, correct], n) => {
    const finishedAt = now - ago * DAY;
    const seed = `a11y${n}`;
    sessions.push({ id: `s${n}`, algorithm, variant: 'classic', seed, input: input[algorithm] ?? '', level: 'guided', asked, correct, startedAt: finishedAt - 240_000, finishedAt });
    for (let m = 0; m < asked - correct; m++) {
      mistakes.push({ id: `s${n}:${m}`, algorithm, kind: kinds[(n + m) % kinds.length] ?? 'boundary', rule: 'The rule this answer broke.', seed, input: input[algorithm] ?? '', askIndex: 3 + m, at: finishedAt - 60_000 });
    }
  });
  return {
    version: 1,
    settings: { theme: 'system', motion: 'system', level: 'guided', language: 'pseudo' },
    meta: { firstSeen: now - 26 * DAY, lastSeen: now - 2 * DAY },
    sessions,
    mistakes,
    review: {
      dijkstra: { algorithm: 'dijkstra', box: 1, due: now - DAY, reviews: 2, lastScore: 0.75 },
      bst: { algorithm: 'bst', box: 1, due: now + 3 * DAY, reviews: 1, lastScore: 0.85 },
    },
  };
}

async function openView(browser: Browser, baseURL: string | undefined, v: View, store: Store | null): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const phone = v.width < 500;
  const ctx = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    viewport: { width: v.width, height: phone ? 844 : 800 },
    colorScheme: v.scheme,
    isMobile: phone,
    hasTouch: phone,
    deviceScaleFactor: phone ? 2 : 1,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript((json) => {
    if (sessionStorage.getItem('wp-i-seeded')) return;
    sessionStorage.setItem('wp-i-seeded', '1');
    if (json === null) localStorage.removeItem('dryrun.v1');
    else localStorage.setItem('dryrun.v1', json);
  }, store === null ? null : JSON.stringify(store));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { ctx, page, errors };
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

/** Runs axe, records counts by impact, returns the serious / critical findings. */
async function scan(page: Page, label: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const counts = { minor: 0, moderate: 0, serious: 0, critical: 0 };
  for (const v of r.violations) if (v.impact) counts[v.impact] += v.nodes.length;
  mkdirSync(OUT, { recursive: true });
  appendFileSync(`${OUT}/axe.jsonl`, JSON.stringify({ label, ...counts, ids: r.violations.map((v) => `${v.id}:${v.impact}:${v.nodes.length}`) }) + '\n');
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

const openOrDone = '[data-testid="ask"], [data-testid="summary"]';

async function stepToAsk(page: Page): Promise<boolean> {
  for (let i = 0; i < 700; i++) {
    if (await page.locator(openOrDone).count()) return (await page.getByTestId('ask').count()) > 0;
    await page.keyboard.press('ArrowRight');
  }
  return false;
}

/** Answers the open question deliberately wrong (the ghost shows on a pick). */
async function answerWrong(page: Page): Promise<void> {
  const ask = page.getByTestId('ask');
  const kind = (await ask.getAttribute('data-kind')) ?? '';
  const hint = (await ask.getAttribute('data-answer-hint')) ?? '';
  if (kind === 'pick') {
    const ids = await page.locator('[data-cand]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cand') ?? ''));
    await page.locator(`[data-cand="${ids.find((x) => x !== hint) ?? hint}"]`).click();
  } else if (kind === 'choice') {
    const options = await page.locator('[data-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-option') ?? ''));
    await page.locator(`[data-option="${options.find((o) => o !== hint) ?? hint}"]`).click();
  } else if (kind === 'value') {
    const n = Number(hint) + 1;
    await page.getByTestId('value-input').fill(n < 0 ? `−${-n}` : String(n));
    await page.getByTestId('value-input').press('Enter');
  } else if (kind === 'order') {
    for (const id of hint.split(',').reverse()) await page.locator(`[data-item="${id}"]`).click();
    await page.getByTestId('order-submit').click();
  } else throw new Error(`unknown ask kind ${kind}`);
  await expect(page.getByTestId('verdict')).toBeVisible();
}

test.describe('axe', () => {
  for (const v of VIEWS) {
    test(`routes ${tag(v)}`, async ({ browser, baseURL }) => {
      const found: string[] = [];
      {
        const { ctx, page, errors } = await openView(browser, baseURL, v, null);
        await go(page, '/?debug=1');
        await expect(page.locator('[data-testid=hero-trace] [data-testid=trace-player]')).toBeVisible();
        found.push(...(await scan(page, `/ (hero) ${tag(v)}`)));
        await go(page, '/no-such-page');
        found.push(...(await scan(page, `404 ${tag(v)}`)));
        expect(errors).toEqual([]);
        await ctx.close();
      }
      {
        const { ctx, page, errors } = await openView(browser, baseURL, v, seededStore(Date.now()));
        for (const path of ['/', '/algorithms', '/review', '/mistakes', '/progress', '/settings']) {
          await go(page, path);
          await expect(page.locator('main')).toBeVisible();
          found.push(...(await scan(page, `${path} ${tag(v)}`)));
        }
        expect(errors).toEqual([]);
        await ctx.close();
      }
      expect(found).toEqual([]);
    });

    for (const id of ALGORITHMS) {
      test(`/t/${id} ${tag(v)}: step 0, question, verdict`, async ({ browser, baseURL }) => {
        const found: string[] = [];
        const { ctx, page, errors } = await openView(browser, baseURL, v, null);
        await go(page, `/t/${id}?debug=1`);
        await expect(page.getByTestId('trace-player')).toBeVisible();
        found.push(...(await scan(page, `/t/${id} step0 ${tag(v)}`)));
        await page.getByTestId('start-play').click();
        if (await stepToAsk(page)) {
          found.push(...(await scan(page, `/t/${id} ask ${tag(v)}`)));
          await answerWrong(page);
          found.push(...(await scan(page, `/t/${id} verdict ${tag(v)}`)));
        } else found.push(`/t/${id}: no question reached`);
        expect(errors).toEqual([]);
        await ctx.close();
        expect(found).toEqual([]);
      });
    }
  }
});

/** The focused element shows a 2 px outline, or is a stage pick target
 *  (which draws its own solid pen ring when focused). */
async function focusProblem(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    if (el.closest('[data-cand]')) return null;
    const cs = getComputedStyle(el);
    const ok = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    if (ok) return null;
    const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30)}]`;
    return `${name} outline ${cs.outlineStyle} ${cs.outlineWidth}`;
  });
}

async function answerByKeyboard(page: Page): Promise<void> {
  const ask = page.getByTestId('ask');
  const kind = (await ask.getAttribute('data-kind')) ?? '';
  const hint = (await ask.getAttribute('data-answer-hint')) ?? '';
  if (kind === 'pick') {
    const key = await page.locator(`[data-cand="${hint}"]`).getAttribute('data-hint');
    if (key) await page.keyboard.press(key);
    else {
      // No number key: Tab to the target and press Enter.
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate((h) => document.activeElement?.getAttribute('data-cand') === h, hint)) break;
      }
      await page.keyboard.press('Enter');
    }
  } else if (kind === 'choice') {
    const options = await page.locator('[data-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-option') ?? ''));
    await page.keyboard.press(String(options.indexOf(hint) + 1));
  } else if (kind === 'value') {
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'value-input')) break;
      await page.keyboard.press('Tab');
    }
    const n = Number(hint);
    await page.keyboard.type(n < 0 ? `−${-n}` : String(n));
    await page.keyboard.press('Enter');
  } else throw new Error(`no keyboard path for ${kind}`);
  await expect(page.getByTestId('verdict')).toBeVisible();
}

test.describe('keyboard only', () => {
  test('a full binary-search trace', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await go(page, '/t/binary-search?debug=1');
    await expect(page.getByTestId('start')).toBeVisible();
    // Space plays to the first question; a trace never needs the mouse.
    await page.keyboard.press('Space');
    let answered = 0;
    for (let guard = 0; guard < 40; guard++) {
      await expect(page.locator('[data-testid="ask"], [data-testid="verdict"], [data-testid="start"], [data-testid="summary"]').first()).toBeVisible();
      if (await page.getByTestId('summary').count()) break;
      if (await page.getByTestId('ask').count()) {
        await answerByKeyboard(page);
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
        answered++;
        continue;
      }
      // A verdict or a start prompt: Enter continues, Space plays.
      if (await page.getByTestId('verdict').count()) await page.keyboard.press('Enter');
      else await page.keyboard.press('Space');
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    expect(answered).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('score')).toContainText(`${answered} of ${answered}`);
    // Tab reaches the summary's actions, with a visible ring on each stop.
    const problems: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const p = await focusProblem(page);
      if (p) problems.push(p);
    }
    expect(problems).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the landing hero: answer by number keys, then Keep tracing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await go(page, '/?debug=1');
    const hero = page.getByTestId('hero-trace');
    await expect(hero.getByTestId('ask')).toBeVisible({ timeout: 10_000 });
    for (let guard = 0; guard < 6; guard++) {
      if (await page.getByTestId('hero-result').count()) break;
      if (await hero.getByTestId('ask').count()) {
        await answerByKeyboard(page);
        continue;
      }
      if (await hero.getByTestId('verdict').count()) await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId('hero-result')).toBeVisible();
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      expect(await focusProblem(page)).toBeNull();
      reached = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'hero-cta');
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/t\/binary-search\?/);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`focus is visible on every tab stop (${scheme})`, async ({ browser, baseURL }) => {
      const { ctx, page } = await openView(browser, baseURL, { width: 1280, scheme }, seededStore(Date.now()));
      const problems: string[] = [];
      for (const path of ['/', '/algorithms', '/review', '/mistakes', '/progress', '/settings', '/t/quick-sort', '/t/dijkstra?mode=watch', '/nope']) {
        await go(page, path);
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press('Tab');
          const p = await focusProblem(page);
          if (p) problems.push(`${path}: ${p}`);
        }
      }
      await ctx.close();
      expect([...new Set(problems)]).toEqual([]);
    });
  }
});

test.describe('narration live region', () => {
  test('silent while scrubbing and while steps fly past; speaks the settled step', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await go(page, '/t/quick-sort?mode=watch');
    const live = page.getByTestId('narration-live');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByTestId('narration')).not.toHaveAttribute('aria-live', /.*/);
    const before = await live.textContent();

    // Drag the timeline across many steps, slowly: nothing is announced.
    const box = await page.getByTestId('timeline').boundingBox();
    if (!box) throw new Error('no timeline');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 12, y);
    await page.mouse.down();
    const heard = new Set<string>();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(box.x + 12 + (i * (box.width - 24)) / 14, y);
      await page.waitForTimeout(120);
      heard.add((await live.textContent()) ?? '');
    }
    await page.waitForTimeout(500);
    heard.add((await live.textContent()) ?? '');
    expect([...heard]).toEqual([before]);
    await page.mouse.up();
    // Settled: the live region now holds the step on screen.
    const squash = (t: string | null) => (t ?? '').replace(/\s+/g, '');
    const shown = squash(await page.getByTestId('narration').textContent());
    await expect.poll(async () => squash(await live.textContent()), { timeout: 2000 }).toBe(shown);

    // Five quick steps: one announcement, for the last one.
    const settled = await live.textContent();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    expect(await live.textContent()).toBe(settled);
    await page.waitForTimeout(700);
    expect(squash(await live.textContent())).toBe(squash(await page.getByTestId('narration').textContent()));
  });
});

test.describe('tap targets on phones', () => {
  for (const scheme of ['light'] as const) {
    test(`every target ≥ 44 px, stage targets ≥ 32 px (${scheme})`, async ({ browser, baseURL }) => {
      const { ctx, page } = await openView(browser, baseURL, { width: 390, scheme }, seededStore(Date.now()));
      const problems: string[] = [];
      const check = async (label: string) => {
        const found = await page.evaluate(() => {
          const sel = 'a[href], button, input, select, textarea, [role=button], [role=slider], [role=radio], [role=tab], [role=switch], [role=checkbox], summary';
          const out: string[] = [];
          const stageRects: DOMRect[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement | SVGElement>(sel))) {
            if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) continue;
            if (el.closest('[aria-hidden="true"]') || el.hasAttribute('disabled')) continue;
            if (el.matches('.sr-only') || (el.matches('a') && el.textContent === 'Skip to content')) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const name = `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 24)}]`;
            // Inline links inside running text are exempt (WCAG 2.5.8 "inline").
            if (el.matches('a') && el.closest('p') && (el.closest('p')?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 8) continue;
            const inStage = el.closest('[data-testid=stage]') !== null;
            // The stage's hit area is the target's transparent first path.
            const hit = inStage ? ((el.querySelector('path') as SVGGraphicsElement | null)?.getBoundingClientRect() ?? r) : r;
            const min = inStage ? 32 : 44;
            if (Math.min(hit.width, hit.height) < min - 0.5) out.push(`${name} ${Math.round(hit.width)}×${Math.round(hit.height)}`);
            if (inStage) stageRects.push(hit);
          }
          // Stage targets must not overlap each other.
          for (let i = 0; i < stageRects.length; i++)
            for (let j = i + 1; j < stageRects.length; j++) {
              const a = stageRects[i] as DOMRect;
              const b = stageRects[j] as DOMRect;
              const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ix > 1 && iy > 1) out.push(`stage targets ${i} and ${j} overlap`);
            }
          return out;
        });
        problems.push(...found.map((f) => `${label}: ${f}`));
      };
      for (const path of ['/', '/algorithms', '/review', '/mistakes', '/progress', '/settings', '/nope']) {
        await go(page, path);
        await check(path);
      }
      for (const id of ALGORITHMS) {
        await go(page, `/t/${id}?debug=1`);
        await check(`/t/${id} step0`);
        await page.getByTestId('start-play').click();
        if (await stepToAsk(page)) await check(`/t/${id} ask`);
      }
      await ctx.close();
      expect([...new Set(problems)]).toEqual([]);
    });
  }
});
