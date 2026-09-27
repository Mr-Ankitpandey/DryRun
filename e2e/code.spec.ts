/** WP-J acceptance for the code panel's language switch.
 *
 *  For binary search, Dijkstra and knapsack (array, graph, DP): switch the code
 *  language, step with → in watch mode, and check that the highlighted listing
 *  lines are exactly `map[p − 1]` for the pseudocode line p the panel reports
 *  (`data-current`); the choice persists after a reload (settings.language);
 *  long lines scroll inside the panel, never the page; axe finds nothing in the
 *  panel; no console errors. Screenshots 390 / 1280 × light / dark go to
 *  ./.scratch/wp-j/shots/. Run with a base URL: CODE_URL=http://127.0.0.1:5182 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CodeListing, RealLanguage } from '../src/algorithms/types';
import { code as binarySearchCode } from '../src/algorithms/binary-search/code';
import { code as dijkstraCode } from '../src/algorithms/dijkstra/code';
import { code as knapsackCode } from '../src/algorithms/knapsack/code';

const SHOTS = '.scratch/wp-j/shots';
const BASE = process.env['CODE_URL'];
if (BASE) test.use({ baseURL: BASE });

test.describe.configure({ timeout: 120_000 });

// Viewports are set explicitly; run once, under the desktop project.
test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'sizes are set explicitly');
});

type Lang = RealLanguage | 'pseudo';
const LANGS: Lang[] = ['js', 'python', 'cpp', 'java', 'pseudo'];
const LABEL: Record<Lang, string> = { pseudo: 'Pseudocode', js: 'JS', python: 'Python', cpp: 'C++', java: 'Java' };

const CASES: { id: string; variant: string; code: Record<string, Partial<Record<RealLanguage, CodeListing>>> }[] = [
  { id: 'binary-search', variant: 'classic', code: binarySearchCode },
  { id: 'dijkstra', variant: 'lazy', code: dijkstraCode },
  { id: 'knapsack', variant: 'bottomup', code: knapsackCode },
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const panel = (page: Page) => page.getByTestId('code');
const switcher = (page: Page) => page.getByRole('radiogroup', { name: 'Code language' });

async function openCode(page: Page, url: string, mobile: boolean): Promise<void> {
  await page.goto(url);
  await expect(page.getByTestId('trace-player')).toBeVisible();
  if (mobile) await page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: 'Code' }).click();
  await expect(switcher(page)).toBeVisible();
}

async function choose(page: Page, lang: Lang): Promise<void> {
  await switcher(page).getByRole('radio', { name: LABEL[lang], exact: true }).click();
  await expect(panel(page)).toHaveAttribute('data-lang', lang);
  // Arrow keys on a focused radio would change the language, not the step.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Highlighted listing lines must equal map[current − 1] (pseudocode: [current]). */
async function checkHighlight(page: Page, listings: Partial<Record<RealLanguage, CodeListing>>, lang: Lang): Promise<number> {
  const current = Number(await panel(page).getAttribute('data-current'));
  const lit = await panel(page)
    .locator('li[aria-current="step"]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-line'))));
  const want = current <= 0 ? [] : lang === 'pseudo' ? [current] : (listings[lang]?.map[current - 1] ?? []);
  expect(lit, `${lang} at pseudocode line ${current}`).toEqual(want);
  if (lit.length > 0) {
    // The first highlighted line is inside the panel's visible box.
    const inView = await panel(page).evaluate((ol, n) => {
      const box = ol.parentElement as HTMLElement;
      const li = ol.querySelector(`[data-line="${n}"]`) as HTMLElement;
      const b = box.getBoundingClientRect();
      const r = li.getBoundingClientRect();
      // The tint spans the whole row, as wide as the longest line.
      const fullWidth = Math.abs(r.width - ol.getBoundingClientRect().width) < 1 && ol.getBoundingClientRect().width >= box.clientWidth - 1;
      return r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && fullWidth;
    }, lit[0]);
    expect(inView, `line ${lit[0]} is in the panel and its tint spans the row`).toBe(true);
  }
  return current;
}

for (const c of CASES) {
  test(`${c.id}: every language highlights the mapped lines while stepping`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openCode(page, `/t/${c.id}?mode=watch&debug=1`, false);
    const listings = c.code[c.variant] ?? {};
    const seen = new Set<string>();
    for (const lang of LANGS) {
      await choose(page, lang);
      for (let s = 0; s < 6; s++) {
        await page.keyboard.press('ArrowRight');
        const p = await checkHighlight(page, listings, lang);
        seen.add(`${lang}:${p}`);
      }
      // Scrubbing back is exact too.
      await page.keyboard.press('ArrowLeft');
      await checkHighlight(page, listings, lang);
    }
    expect(seen.size).toBeGreaterThan(LANGS.length);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('the language choice persists after a reload and applies to other algorithms', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openCode(page, '/t/binary-search?mode=watch&debug=1', false);
  await choose(page, 'python');
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await expect(switcher(page).getByRole('radio', { name: 'Python' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel(page)).toHaveAttribute('data-lang', 'python');
  const stored = await page.evaluate(() => (JSON.parse(localStorage.getItem('dryrun.v1') ?? '{}') as { settings?: { language?: string } }).settings?.language);
  expect(stored).toBe('python');
  await openCode(page, '/t/knapsack?mode=watch&debug=1', false);
  await expect(panel(page)).toHaveAttribute('data-lang', 'python');
  await expect(panel(page).locator('li').first()).toContainText('def knapsack');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('phones: long lines scroll inside the panel, not the page; keyboard reaches the switch', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCode(page, '/t/dijkstra?mode=watch&debug=1', true);
  await choose(page, 'java');
  const sizes = await panel(page).evaluate((ol) => {
    const box = ol.parentElement as HTMLElement;
    return { scrollW: box.scrollWidth, clientW: box.clientWidth, pageW: document.documentElement.scrollWidth, viewW: window.innerWidth };
  });
  expect(sizes.scrollW).toBeGreaterThan(sizes.clientW);
  expect(sizes.pageW).toBeLessThanOrEqual(sizes.viewW);
  const y = await page.evaluate(() => window.scrollY);
  for (let s = 0; s < 4; s++) await page.keyboard.press('ArrowRight');
  await checkHighlight(page, dijkstraCode.lazy ?? {}, 'java');
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  // Arrow keys move between languages once the switch has focus.
  await switcher(page).getByRole('radio', { name: 'Java' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(panel(page)).toHaveAttribute('data-lang', 'cpp');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('screenshots and axe: 390 / 1280, light / dark, reduced motion', async ({ page }) => {
  const errors = watchConsole(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const width of [390, 1280]) {
      const mobile = width < 640;
      await page.setViewportSize({ width, height: mobile ? 844 : 800 });
      for (const [id, lang] of [
        ['binary-search', 'cpp'],
        ['dijkstra', 'java'],
        ['knapsack', 'python'],
      ] as const) {
        await openCode(page, `/t/${id}?mode=watch&debug=1`, mobile);
        await choose(page, lang);
        for (let s = 0; s < 5; s++) await page.keyboard.press('ArrowRight');
        const region = panel(page).locator('xpath=../..');
        await region.scrollIntoViewIfNeeded();
        await region.screenshot({ path: `${SHOTS}/code-${id}-${lang}-${width}-${scheme}.png` });
        if (id === 'dijkstra') await page.screenshot({ path: `${SHOTS}/page-${id}-${width}-${scheme}.png`, fullPage: false });
        const axe = await new AxeBuilder({ page }).include('[data-testid="code"]').include('[aria-label="Code language"]').analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      }
    }
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
