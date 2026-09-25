/** WP-F: landing hero, welcome back, library, 404 and site nav. Screenshots go
 *  to ./.scratch/wp-f/shots/. Set DRYRUN_URL to point at a running server;
 *  otherwise the config's baseURL (the preview build) is used. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ORIGIN = process.env.DRYRUN_URL ?? '';
const SHOTS = './.scratch/wp-f/shots';
const DAY = 24 * 60 * 60 * 1000;

/** A valid v1 store (src/lib/storage.ts defaultStore shape) with optional data. */
function store(over: { review?: Record<string, unknown>; sessions?: unknown[] } = {}) {
  return {
    version: 1,
    settings: { theme: 'system', motion: 'system', level: 'guided' },
    meta: { firstSeen: Date.now() - 5 * DAY, lastSeen: Date.now() - 2 * DAY },
    sessions: over.sessions ?? [],
    mistakes: [],
    review: over.review ?? {},
  };
}

async function seed(page: Page, value: unknown) {
  await page.addInitScript((json) => {
    window.localStorage.setItem('dryrun.v1', json);
  }, JSON.stringify(value));
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test.describe('landing', () => {
  test('hero renders the live trace and exposes an ask within 5 s', async ({ page }) => {
    const errors = watchErrors(page);
    const started = Date.now();
    await page.goto(`${ORIGIN}/`);
    const player = page.locator('[data-testid=hero-trace] [data-testid=trace-player]');
    await expect(player).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Stop watching algorithms. Start tracing them.' })).toBeVisible();
    const placeholder = (await player.textContent())?.includes('being built') ?? false;
    if (!placeholder) {
      // WP-E's player: the first guided ask of the basic preset.
      await expect(player.getByText('Where does mid land?', { exact: false })).toBeVisible({ timeout: Math.max(0, 5000 - (Date.now() - started)) });
    }
    expect(Date.now() - started, 'answerable within 5 s of landing').toBeLessThan(5000);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const cta = page.getByTestId('hero-cta');
    await expect(cta).toHaveText('Trace binary search');
    await expect(cta).toHaveAttribute('href', '/t/binary-search?i=3,7,9,12,15,21,30,42,51&x=42&v=classic&seed=hero');
    await expect(page.getByTestId('welcome')).toHaveCount(0);

    // The loop rows show real stills; the reveal still carries the ghost.
    await expect(page.getByTestId('loop-predict').getByText('lo = 0, hi = 8. Where does mid land?')).toBeVisible();
    await expect(page.getByTestId('loop-reveal').locator('[data-ghost="e:4"]')).toHaveCount(1);
    await expect(page.getByTestId('algo-row-binary-search').getByRole('link')).toHaveAttribute('href', '/t/binary-search');
    expect(errors).toEqual([]);
  });

  test('a due review replaces the hero with the welcome line', async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, store({ review: { 'binary-search': { algorithm: 'binary-search', box: 1, due: Date.now() - DAY, reviews: 1, lastScore: 1 } } }));
    await page.goto(`${ORIGIN}/`);
    const welcome = page.getByTestId('welcome');
    await expect(welcome).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back — 1 re-trace due, ~3 minutes.');
    await expect(welcome).toContainText('Due now: Binary search.');
    await expect(page.getByTestId('welcome-cta')).toHaveAttribute('href', '/review');
    await expect(page.getByTestId('hero-trace')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a review that is not due yet keeps the hero', async ({ page }) => {
    await seed(page, store({ review: { 'binary-search': { algorithm: 'binary-search', box: 1, due: Date.now() + 2 * DAY, reviews: 1, lastScore: 1 } } }));
    await page.goto(`${ORIGIN}/`);
    await expect(page.getByTestId('hero-trace')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
  });
});

test.describe('library', () => {
  test('table shows honest accuracy and review, and the family filter works', async ({ page }) => {
    const errors = watchErrors(page);
    const now = Date.now();
    await seed(
      page,
      store({
        sessions: [
          { id: 's1', algorithm: 'binary-search', variant: 'classic', seed: 'a', input: 'i=1,2&x=1&v=classic', level: 'guided', asked: 4, correct: 3, startedAt: now - DAY, finishedAt: now - DAY },
        ],
        review: {
          'binary-search': { algorithm: 'binary-search', box: 0, due: now + 3 * DAY - 1000, reviews: 1, lastScore: 0.75 },
          dijkstra: { algorithm: 'dijkstra', box: 0, due: now - 1000, reviews: 1, lastScore: 0.5 },
        },
      }),
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ORIGIN}/algorithms`);
    await expect(page.getByRole('heading', { level: 1, name: 'Algorithms' })).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(8);

    const bs = page.getByTestId('algo-row-binary-search');
    await expect(bs).toContainText('75%');
    await expect(bs).toContainText('3 of 4 right');
    await expect(bs).toContainText('In 3 days');
    await expect(page.getByTestId('algo-row-dijkstra')).toContainText('Due now');
    // Never traced: a dash, not 0 %.
    await expect(page.getByTestId('algo-row-bst')).not.toContainText('0%');
    await expect(page.getByTestId('algo-row-bst')).toContainText('no answers yet');

    await page.getByRole('radio', { name: 'Graphs' }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('algo-row-dijkstra')).toBeVisible();
    await expect(page.getByTestId('algo-row-bfs')).toBeVisible();
    // Arrow keys move the selection (roving radio group).
    await page.getByRole('radio', { name: 'Graphs' }).press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Graphs' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(rows).toHaveCount(8);
    await page.getByRole('radio', { name: 'Sorting' }).click();
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId('algo-row-quick-sort')).toBeVisible();

    await page.getByRole('link', { name: 'Quick sort (Lomuto)' }).click();
    await expect(page).toHaveURL(/\/t\/quick-sort$/);
    expect(errors).toEqual([]);
  });

  test('two columns on a phone, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/algorithms`);
    await expect(page.locator('tbody tr')).toHaveCount(8);
    const visibleCols = await page.locator('thead th').evaluateAll((ths) => ths.filter((th) => getComputedStyle(th).display !== 'none').length);
    expect(visibleCols).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe('site nav and 404', () => {
  test('desktop: inline links with the current page marked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ORIGIN}/algorithms`);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Algorithms' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    await nav.getByRole('link', { name: 'Review' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/review$/);
  });

  test('mobile: Menu opens a dialog listing the nav and navigates', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/`);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Go to' });
    await expect(dialog).toBeVisible();
    for (const name of ['Home', 'Algorithms', 'Review', 'Mistakes', 'Progress', 'Settings']) {
      await expect(dialog.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(dialog.getByRole('link', { name: /^Home/ })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: /^Algorithms/ }).click();
    await expect(page).toHaveURL(/\/algorithms$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Algorithms' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unknown address shows the 404 with a way out', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ORIGIN}/no-such-page`);
    await expect(page.getByRole('heading', { level: 1, name: 'No page at this address' })).toBeVisible();
    await expect(page.getByText('/no-such-page')).toBeVisible();
    await page.getByRole('link', { name: 'See all algorithms' }).click();
    await expect(page).toHaveURL(/\/algorithms$/);
    expect(errors).toEqual([]);
  });
});

test.describe('screenshots', () => {
  for (const width of [390, 1280] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`landing, library, 404 at ${width}px ${scheme}`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
        for (const [path, name] of [
          ['/', 'landing'],
          ['/algorithms', 'library'],
          ['/nope', 'notfound'],
        ] as const) {
          await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400); // let the one write-in finish
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name}: no horizontal scroll`).toBeLessThanOrEqual(width);
          await page.screenshot({ path: `${SHOTS}/${name}-${width}-${scheme}.png`, fullPage: true });
        }
        expect(errors).toEqual([]);
      });
    }
  }

  test('reduced motion: landing is complete at once, nothing is mid-animation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${ORIGIN}/`);
    await expect(page.getByTestId('hero-trace')).toBeVisible();
    // base.css snaps every CSS transition to 0.01 ms under reduced motion; anything longer is real motion.
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && Number(a.effect?.getTiming().duration ?? 0) > 1)
        .map((a) => `${a.constructor.name} ${String(a.effect?.getTiming().duration)}`),
    );
    expect(running).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/landing-390-reduced.png`, fullPage: true });
  });
});
