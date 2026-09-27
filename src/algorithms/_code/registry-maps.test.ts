/** Every registered module's listings (not only the eight in cases.ts) have line
 *  maps that fit their pseudocode: one entry per pseudocode line, every entry
 *  pointing at real listing lines, and no algorithm line left unmapped. */

import { describe, expect, it } from 'vitest';
import { registry } from '@/algorithms/registry';
import { checkListing } from './validate';

describe('registered listings', () => {
  for (const entry of registry) {
    it(`${entry.id}: every listing's line map is valid`, async () => {
      const mod = await entry.load();
      for (const [variant, byLang] of Object.entries(mod.code ?? {})) {
        const pseudo = mod.pseudocode[variant];
        expect(pseudo, `${entry.id}: listing for unknown variant ${variant}`).toBeDefined();
        for (const [lang, listing] of Object.entries(byLang)) {
          const { problems } = checkListing(pseudo ?? [], listing);
          expect(problems, `${entry.id}/${variant}/${lang}`).toEqual([]);
        }
      }
    });
  }
});
