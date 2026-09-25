/** Visual QA for /styleguide (WP-B). Screenshots go to ./.scratch/wp-b/shots/.
 *  Set DRYRUN_URL to point at a running dev server; otherwise the config's
 *  baseURL (the preview build) is used. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ORIGIN = process.env.DRYRUN_URL ?? '';
const SHOTS = './.scratch/wp-b/shots';

async function openStyleguide(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${ORIGIN}/styleguide`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1, name: 'Graph paper' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

for (const width of [390, 1280] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`styleguide at ${width}px, ${scheme}: no console errors, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
      const errors = await openStyleguide(page);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, 'no horizontal page scroll').toBeLessThanOrEqual(width);

      // Sections present.
      for (const name of ['Tokens', 'Type', 'Vocabulary', 'Motion', 'Components']) {
        await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
      }
      // Both themes side by side: the token sheets carry data-theme scopes.
      await expect(page.locator('[data-theme="light"]').first()).toBeVisible();
      await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();

      // Every tap target in the components section is at least 44 px tall,
      // except the small variants and the in-toast controls shown on purpose.
      const short = await page.evaluate(() => {
        const root = document.getElementById('components');
        if (!root) return ['no components section'];
        const out: string[] = [];
        for (const el of root.querySelectorAll<HTMLElement>('button, select, input')) {
          const r = el.getBoundingClientRect();
          if (r.height === 0 || r.height >= 44) continue;
          const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
          out.push(`${el.tagName.toLowerCase()}[${name.slice(0, 24)}] ${Math.round(r.height)}px`);
        }
        return out;
      });
      const allowed = /^button\[(Small|Next|0\.5×|1×|1\.5×|2×|Dismiss|Undo)\]/;
      expect(short.filter((s) => !allowed.test(s))).toEqual([]);

      await page.screenshot({ path: `${SHOTS}/styleguide-${width}-${scheme}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

test('reduced motion: transitions resolve to duration 0 and the toggle persists', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const errors = await openStyleguide(page);
  const motionSection = page.locator('#motion');
  await expect(motionSection.getByText('Reduced motion: on (system)')).toBeVisible();
  await expect(motionSection.getByText('{"duration":0}')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/styleguide-1280-light-reduced.png`, fullPage: true });

  // The stored setting alone also reduces motion.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(motionSection.getByText('Reduced motion: off')).toBeVisible();
  await page.getByRole('switch', { name: 'Reduce motion' }).first().click();
  await expect(motionSection.getByText('Reduced motion: on (setting)')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  // Saves are debounced by the StoreProvider, so wait for the write.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dryrun.v1') ?? '{}').settings?.motion))
    .toBe('reduced');
  expect(errors).toEqual([]);
});

test('theme switch persists and re-scopes the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  const errors = await openStyleguide(page);
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toBe('#111820');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('dialog traps focus and closes on Escape; segmented moves with arrow keys', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openStyleguide(page);
  const opener = page.getByRole('button', { name: 'Open dialog' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Reset data' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  const level = page.getByRole('radiogroup', { name: 'Level' }).first();
  await level.getByRole('radio', { name: 'Guided' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(level.getByRole('radio', { name: 'Full' })).toBeFocused();
  await expect(level.getByRole('radio', { name: 'Full' })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});
