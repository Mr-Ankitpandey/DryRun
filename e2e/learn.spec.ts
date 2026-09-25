/** Visual + behaviour QA for the learning screens (WP-H): /review, /mistakes,
 *  /progress, /settings. The store is seeded into localStorage `dryrun.v1`
 *  once per tab (sessionStorage flag), so reloads keep what the page saved.
 *  Screenshots go to ./.scratch/wp-h/shots/. Set DRYRUN_URL to point at a
 *  running dev server; otherwise the config's baseURL is used. */

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MistakeRecord, ReviewItem, SessionRecord, Store } from '../src/lib/storage';

const ORIGIN = process.env.DRYRUN_URL ?? '';
const SHOTS = './.scratch/wp-h/shots';
const DAY = 24 * 60 * 60 * 1000;

const INPUTS: Record<string, string> = {
  'binary-search': 'i=3,7,9,12,15,21,30,42,51&x=42&v=classic',
  dijkstra: 'g=0-1:4,0-2:1,2-1:2,1-3:1,2-3:5&n=4&s=0',
  bst: 'i=50,30,70,20,40,60,80&op=delete&x=30',
};

/** 30 days of realistic use: three algorithms on different days, mistakes of
 *  several kinds, Dijkstra due for review, the others scheduled later. */
function seededStore(now: number): Store {
  const sessions: SessionRecord[] = [];
  const mistakes: MistakeRecord[] = [];
  const plan: [string, number, number, number][] = [
    // algorithm, days ago, asked, correct
    ['binary-search', 28, 6, 3],
    ['binary-search', 27, 6, 4],
    ['binary-search', 20, 6, 5],
    ['binary-search', 12, 6, 5],
    ['binary-search', 11, 6, 6],
    ['binary-search', 2, 6, 6],
    ['dijkstra', 25, 8, 4],
    ['dijkstra', 18, 8, 5],
    ['dijkstra', 17, 8, 6],
    ['dijkstra', 9, 8, 7],
    ['dijkstra', 3, 8, 6],
    ['bst', 14, 7, 4],
    ['bst', 6, 7, 6],
    ['bst', 5, 7, 7],
  ];
  const kinds: Record<string, MistakeRecord['kind'][]> = {
    'binary-search': ['boundary', 'boundary', 'comparison'],
    dijkstra: ['stale', 'order', 'stale', 'unclassified'],
    bst: ['subtree', 'base-case', 'subtree'],
  };
  const rules: Record<string, string> = {
    boundary: 'With lo <= hi the loop still runs when lo equals hi.',
    comparison: 'a[mid] < x means the target is to the right, so lo moves.',
    stale: 'An entry whose distance is larger than dist[v] is stale: skip it.',
    order: 'The priority queue pops the smallest distance, ties by smaller node id.',
    unclassified: 'Relax only when the new distance is strictly smaller.',
    subtree: 'Smaller keys go left, larger keys go right.',
    'base-case': 'The search stops at an empty child: the key is not there.',
  };
  plan.forEach(([algorithm, ago, asked, correct], n) => {
    const finishedAt = now - ago * DAY - 2 * 60 * 60 * 1000;
    const seed = `sd${n}`;
    const id = `s-${n}`;
    sessions.push({ id, algorithm, variant: 'classic', seed, input: INPUTS[algorithm] ?? '', level: 'guided', asked, correct, startedAt: finishedAt - 4 * 60 * 1000, finishedAt });
    const pool = kinds[algorithm] ?? ['unclassified'];
    for (let m = 0; m < asked - correct; m++) {
      const kind = pool[(n + m) % pool.length] ?? 'unclassified';
      mistakes.push({ id: `${id}:${m}`, algorithm, kind, rule: rules[kind] ?? '', seed, input: INPUTS[algorithm] ?? '', askIndex: 3 + m, at: finishedAt - 60 * 1000 });
    }
  });
  const review: Record<string, ReviewItem> = {
    dijkstra: { algorithm: 'dijkstra', box: 1, due: now - DAY, reviews: 2, lastScore: 0.75 },
    bst: { algorithm: 'bst', box: 1, due: now + 3 * DAY, reviews: 2, lastScore: 1 },
    'binary-search': { algorithm: 'binary-search', box: 2, due: now + 7 * DAY, reviews: 3, lastScore: 1 },
  };
  return {
    version: 1,
    settings: { theme: 'system', motion: 'system', level: 'guided' },
    meta: { firstSeen: now - 28 * DAY, lastSeen: now - 2 * DAY },
    sessions,
    mistakes,
    review,
  };
}

function emptyStore(): Store {
  return { version: 1, settings: { theme: 'system', motion: 'system', level: 'guided' }, meta: { firstSeen: null, lastSeen: null }, sessions: [], mistakes: [], review: {} };
}

/** Seeds localStorage before the app boots, once per tab; collects console errors. */
async function boot(page: Page, store: Store | null): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('wp-h-seeded')) return;
    sessionStorage.setItem('wp-h-seeded', '1');
    if (json === null) localStorage.removeItem('dryrun.v1');
    else localStorage.setItem('dryrun.v1', json);
  }, store === null ? null : JSON.stringify(store));
  return errors;
}

async function open(page: Page, path: string) {
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

async function stored(page: Page): Promise<Store> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dryrun.v1') ?? 'null') as Store);
}

test.describe('review', () => {
  test('lists the due item and starts it in the trace player', async ({ page }) => {
    const errors = await boot(page, seededStore(Date.now()));
    await open(page, '/review');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Welcome back — 1 re-trace due, ~5 minutes\.$/);
    const items = page.getByTestId('due-item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('Dijkstra (lazy deletion)');
    await expect(items.first()).toContainText('Last time 75% right, due yesterday');
    await page.getByRole('button', { name: 'Re-trace Dijkstra (lazy deletion)' }).click();
    await expect(page.getByText('Re-trace 1 of 1')).toBeVisible();
    await expect(page.getByTestId('trace-player')).toBeVisible();
    // Skipping leaves it due and ends the review honestly.
    await page.getByRole('button', { name: 'Skip this one' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review done' })).toBeVisible();
    await expect(page.getByText('You skipped every re-trace, so they stay due.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('nothing due says when the next one is; no history invites a first trace', async ({ page }) => {
    const now = Date.now();
    const store = seededStore(now);
    store.review = { bst: { algorithm: 'bst', box: 1, due: now + 3 * DAY, reviews: 2, lastScore: 1 } };
    const errors = await boot(page, store);
    await open(page, '/review');
    await expect(page.getByRole('heading', { name: 'Nothing due right now' })).toBeVisible();
    await expect(page.getByText('Your next re-trace is BST insert, search, delete, due in 3 days.')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('dryrun.v1', JSON.stringify({ version: 1, sessions: [], mistakes: [], review: {} })));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Nothing to re-trace yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Choose an algorithm to trace' })).toHaveAttribute('href', '/algorithms');
    expect(errors).toEqual([]);
  });
});

test.describe('mistakes', () => {
  test('groups by kind with rule, count, last seen and re-trace links', async ({ page }) => {
    const store = seededStore(Date.now());
    const errors = await boot(page, store);
    await open(page, '/mistakes');
    const kinds = new Set(store.mistakes.map((m) => m.kind));
    const groups = page.getByTestId('mistake-kind');
    await expect(groups).toHaveCount(kinds.size);
    await expect(page.getByText(`${store.mistakes.length} mistakes in ${kinds.size} kinds`)).toBeVisible();
    // Most frequent kind first and open; its traces link back with the same seed and input.
    const first = groups.first();
    await expect(first.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toContainText('Last seen');
    const links = first.getByRole('link', { name: 'Re-trace this input' });
    expect(await links.count()).toBeGreaterThan(0);
    const href = await links.first().getAttribute('href');
    expect(href).toMatch(/^\/t\/[a-z-]+\?.*seed=sd\d+.*mode=trace/);
    // The second kind expands on click.
    const second = groups.nth(1);
    await expect(second.getByTestId('mistake-trace').first()).toBeHidden();
    await second.getByRole('button').click();
    await expect(second.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(second.getByTestId('mistake-trace').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('empty bank explains what will appear', async ({ page }) => {
    const errors = await boot(page, emptyStore());
    await open(page, '/mistakes');
    await expect(page.getByRole('heading', { name: 'No mistakes recorded yet' })).toBeVisible();
    await expect(page.getByTestId('mistake-kind')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('progress', () => {
  test('one small multiple per algorithm, a table twin and mistakes by kind', async ({ page }) => {
    const store = seededStore(Date.now());
    const errors = await boot(page, store);
    await open(page, '/progress');
    await expect(page.getByTestId('accuracy-panel')).toHaveCount(3);
    // One dot per day with answers: gaps stay gaps.
    await expect(page.getByTestId('accuracy-point')).toHaveCount(store.sessions.length);
    await expect(page.getByTestId('accuracy-panel').first()).toContainText('Binary search');
    await page.getByText('Show the numbers as a table').click();
    await expect(page.locator('table tbody tr')).toHaveCount(store.sessions.length);
    await expect(page.getByTestId('mistake-bar')).toHaveCount(new Set(store.mistakes.map((m) => m.kind)).size);
    // Hover snaps a crosshair to a day and reads it out.
    const svg = page.getByTestId('accuracy-panel').nth(1).locator('svg');
    const box = await svg.boundingBox();
    if (!box) throw new Error('no chart box');
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await expect(page.getByTestId('accuracy-panel').nth(1).locator('[aria-live]')).toContainText(/(Aug|Sep|Oct) \d+/);
    await page.getByTestId('accuracy-panel').nth(1).screenshot({ path: `${SHOTS}/progress-hover.png` });
    await page.mouse.move(0, 0);
    // Keyboard reads a day.
    await page.getByRole('group', { name: 'Binary search, daily accuracy' }).focus();
    await expect(page.getByTestId('accuracy-panel').first().locator('[aria-live]')).toContainText('100%');
    expect(errors).toEqual([]);
  });

  test('fewer than 3 sessions shows the empty state, not a chart', async ({ page }) => {
    const store = seededStore(Date.now());
    store.sessions = store.sessions.slice(-2);
    const errors = await boot(page, store);
    await open(page, '/progress');
    await expect(page.getByRole('heading', { name: 'Not enough traces for a trend yet' })).toBeVisible();
    await expect(page.getByText('you have 2.')).toBeVisible();
    await expect(page.getByTestId('accuracy-panel')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('settings', () => {
  test('theme persists across reload; level is stored', async ({ page }) => {
    const errors = await boot(page, seededStore(Date.now()));
    await open(page, '/settings');
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('radiogroup', { name: 'Default level' }).getByRole('radio', { name: 'Full' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dryrun.v1') ?? '{}').settings?.level === 'full');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Default level' }).getByRole('radio', { name: 'Full' })).toHaveAttribute('aria-checked', 'true');
    expect(errors).toEqual([]);
  });

  test('export downloads valid JSON, reset empties, import round-trips', async ({ page }, info) => {
    const seeded = seededStore(Date.now());
    const errors = await boot(page, seeded);
    await open(page, '/settings');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^dryrun-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = info.outputPath('backup.json');
    await download.saveAs(file);
    const exported = JSON.parse(readFileSync(file, 'utf8')) as Store;
    expect(exported.version).toBe(1);
    expect(exported.sessions).toHaveLength(seeded.sessions.length);
    expect(exported.mistakes).toHaveLength(seeded.mistakes.length);
    await expect(page.getByText('Backup downloaded')).toBeVisible();

    await page.getByRole('button', { name: 'Erase all data' }).click();
    const erase = page.getByRole('dialog', { name: 'Erase all DryRun data?' });
    await expect(erase).toContainText(`${seeded.sessions.length} sessions and ${seeded.mistakes.length} mistakes`);
    await erase.getByRole('button', { name: 'Erase everything' }).click();
    await expect(page.getByText('All data erased')).toBeVisible();
    let now = await stored(page);
    expect(now.sessions).toEqual([]);
    expect(now.mistakes).toEqual([]);
    expect(now.review).toEqual({});

    // A wrong file is rejected with a fix.
    await page.getByTestId('import-file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(page.getByRole('alert').filter({ hasText: 'not a DryRun backup' })).toBeVisible();

    await page.getByTestId('import-file').setInputFiles(file);
    const restore = page.getByRole('dialog', { name: 'Restore this backup?' });
    await expect(restore).toContainText(`The backup has ${seeded.sessions.length} sessions`);
    await expect(restore).toHaveCSS('opacity', '1');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/settings-restore-dialog.png` });
    await restore.getByRole('button', { name: 'Replace my data' }).click();
    await expect(page.getByText('Backup restored')).toBeVisible();
    now = await stored(page);
    expect(now.sessions).toEqual(seeded.sessions);
    expect(now.mistakes).toEqual(seeded.mistakes);
    expect(now.review).toEqual(seeded.review);
    expect(errors).toEqual([]);
  });

  test('copy my session summary puts the digest on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = await boot(page, seededStore(Date.now()));
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Copy summary' }).click();
    await expect(page.getByText('Summary copied')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('DryRun session summary');
    expect(text).toContain('- dijkstra: 5 sessions');
    // No feedback link while FEEDBACK_URL is empty; the version is shown.
    await expect(page.getByRole('link', { name: 'Open the feedback form' })).toHaveCount(0);
    await expect(page.getByText('App version')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unreadable stored data shows a one-time notice', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('wp-h-seeded')) return;
      sessionStorage.setItem('wp-h-seeded', '1');
      localStorage.setItem('dryrun.v1', '{not json');
    });
    await open(page, '/settings');
    const notice = page.getByRole('alert').filter({ hasText: 'could not be read' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Got it' }).click();
    await expect(notice).toBeHidden();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('alert').filter({ hasText: 'could not be read' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

const SCREENS = ['/review', '/mistakes', '/progress', '/settings'] as const;

for (const width of [390, 1280] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`screens at ${width}px, ${scheme}: no console errors, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
      const errors = await boot(page, seededStore(Date.now()));
      for (const path of SCREENS) {
        await open(page, path);
        const main = await page.evaluate(() => {
          const el = document.getElementById('main');
          return el ? el.scrollWidth - el.clientWidth : -1;
        });
        expect(main, `${path}: main content does not scroll sideways`).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `${SHOTS}/${path.slice(1)}-${width}-${scheme}.png`, fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('reduced motion: screens render complete with the stored setting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const store = seededStore(Date.now());
  store.settings.motion = 'reduced';
  const errors = await boot(page, store);
  for (const path of SCREENS) {
    await open(page, path);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await page.screenshot({ path: `${SHOTS}/${path.slice(1)}-390-light-reduced.png`, fullPage: true });
  }
  // The accordion caret snaps: its transition resolves to (near) zero.
  await open(page, '/mistakes');
  const dur = await page.getByTestId('mistake-kind').first().locator('svg').last().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(dur)).toBeLessThanOrEqual(0.001);
  expect(errors).toEqual([]);
});
