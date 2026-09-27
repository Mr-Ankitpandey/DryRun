/** Acceptance for the real-language listings (WP-J):
 *  - every module/variant has JS, Python, C++ and Java listings whose line maps
 *    are valid against the pseudocode;
 *  - the JS listings run here (new Function) on presets + 300 random inputs per
 *    variant and match `reference` (sorts: also the trace's element order; BST:
 *    also the trace's tree shape);
 *  - Python, C++ and Java listings run on the same inputs when the toolchain is
 *    on this machine, and are skipped with a note otherwise. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AlgorithmModule, RealLanguage } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { CodeCase, ExtLang, JsExports } from './cases';
import { CASES } from './cases';
import type { Built } from './external';
import { build, detectToolchains, execute, program } from './external';
import { checkListing } from './validate';

const LANGS: RealLanguage[] = ['js', 'python', 'cpp', 'java'];
const EXT: ExtLang[] = ['python', 'cpp', 'java'];
const RANDOM_PER_VARIANT = 300;

/** Pseudocode lines allowed to have no listing counterpart ("module:variant:lang" → lines). */
const ALLOWED_EMPTY: Record<string, number[]> = {};

function inputsFor<I>(c: CodeCase<I>, variant: string): I[] {
  const mod: AlgorithmModule<I> = c.module;
  const out = mod.presets.map((p) => structuredClone(p.input)).filter((i) => mod.variantOf(i) === variant);
  const targets = c.targets(variant);
  const want = out.length + RANDOM_PER_VARIANT;
  for (let tries = 0; out.length < want && tries < 20 * RANDOM_PER_VARIANT; tries++) {
    const input = mod.randomInput(createRng(`wp-j:${c.id}:${variant}:${tries}`), targets[tries % targets.length]);
    if (mod.variantOf(input) === variant) out.push(input);
  }
  return out;
}

function compileJs(lines: readonly string[], exports: string[]): JsExports {
  const body = `"use strict";\n${lines.join('\n')}\nreturn { ${exports.join(', ')} };`;
  return new Function(body)() as JsExports;
}

const toolchains = detectToolchains();
const summary: string[] = [];

describe('code listings', () => {
  it('toolchains on this machine', () => {
    for (const lang of EXT) summary.push(`toolchain ${lang}: ${toolchains[lang].ok ? 'found' : 'MISSING'} (${toolchains[lang].detail})`);
    expect(Object.keys(toolchains)).toEqual(EXT);
  });

  afterAll(() => {
    console.info(`\n[code listings]\n${summary.join('\n')}\n`);
  });

  for (const c of CASES) {
    const variants = c.module.meta.variants.map((v) => v.id);

    describe(c.id, () => {
      /** Compiled programs by "variant:lang", built in parallel once per module. */
      const builds = new Map<string, Built | Error>();
      beforeAll(async () => {
        const jobs: Promise<void>[] = [];
        for (const variant of variants) {
          for (const lang of EXT) {
            const tc = toolchains[lang];
            const l = c.code[variant]?.[lang];
            if (!tc.ok || !l) continue;
            jobs.push(
              build(lang, program(lang, l.lines, c.drivers[lang](variant)), tc).then(
                (b) => void builds.set(`${variant}:${lang}`, b),
                (e: unknown) => void builds.set(`${variant}:${lang}`, e instanceof Error ? e : new Error(String(e))),
              ),
            );
          }
        }
        await Promise.all(jobs);
      }, 180_000);

      it('has a listing in every language for every variant, and no stray variants', () => {
        expect(Object.keys(c.code).sort()).toEqual([...variants].sort());
        for (const v of variants) expect(Object.keys(c.code[v] ?? {}).sort()).toEqual([...LANGS].sort());
      });

      for (const variant of variants) {
        const pseudo = c.module.pseudocode[variant] ?? [];
        const inputs = inputsFor(c, variant);
        const expected = new Map<boolean, number[][]>();
        const want = (identity: boolean): number[][] => {
          let got = expected.get(identity);
          if (!got) {
            got = inputs.map((i) => c.expected(i, identity));
            expected.set(identity, got);
          }
          return got;
        };

        for (const lang of LANGS) {
          it(`${variant} / ${lang}: the line map is valid`, () => {
            const l = c.code[variant]?.[lang];
            expect(l, 'listing missing').toBeDefined();
            if (!l) return;
            const { problems, empty } = checkListing(pseudo, l);
            expect(problems).toEqual([]);
            expect(empty).toEqual(ALLOWED_EMPTY[`${c.id}:${variant}:${lang}`] ?? []);
          });
        }

        it(`${variant} / js: runs and matches the reference on ${inputs.length} inputs`, () => {
          const l = c.code[variant]?.js;
          if (!l) throw new Error('no JS listing');
          const fns = compileJs(l.lines, c.jsExports(variant));
          const exp = want(c.identity);
          inputs.forEach((input, k) => {
            const got = c.js(fns, structuredClone(input), variant);
            if (JSON.stringify(got) !== JSON.stringify(exp[k])) {
              throw new Error(`JS ${c.id}/${variant} differs on ${JSON.stringify(input)}: got ${JSON.stringify(got)}, want ${JSON.stringify(exp[k])}`);
            }
          });
          summary.push(`${c.id}/${variant} js: ${inputs.length}/${inputs.length} match`);
        });

        for (const lang of EXT) {
          const tc = toolchains[lang];
          const identity = c.identity && lang === 'python';

          it(`${variant} / ${lang}: runs and matches the reference`, (ctx) => {
            if (!tc.ok) ctx.skip(`${lang} skipped: ${tc.detail}`);
            const b = builds.get(`${variant}:${lang}`);
            if (!b) throw new Error('not built');
            if (b instanceof Error) throw b;
            const got = execute(b, tc, inputs.map((i) => c.tokens(i)));
            const exp = want(identity);
            expect(got.length).toBe(inputs.length);
            inputs.forEach((input, k) => {
              if (JSON.stringify(got[k]) !== JSON.stringify(exp[k])) {
                throw new Error(`${lang} ${c.id}/${variant} differs on ${JSON.stringify(input)}: got ${JSON.stringify(got[k])}, want ${JSON.stringify(exp[k])}`);
              }
            });
            summary.push(`${c.id}/${variant} ${lang}: ${inputs.length}/${inputs.length} match${identity ? ' (with element identity)' : ''}${b.cached ? ' (cached build)' : ''}`);
          }, 60_000);
        }
      }
    });
  }
});
