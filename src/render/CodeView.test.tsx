/** CodeView renders the chosen language and highlights the mapped lines
 *  (server render; the switch itself is exercised in e2e/code.spec.ts). */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import type { AlgorithmModule } from '@/algorithms/types';
import type { CodeLanguage, Storage } from '@/lib/storage';
import { defaultStore } from '@/lib/storage';
import { StoreProvider } from '@/ui/store';
import { CodeView } from './CodeView';

const mod = binarySearch as unknown as AlgorithmModule<unknown>;

function storageWith(language: CodeLanguage): Storage {
  const store = defaultStore();
  store.settings.language = language;
  return {
    load: () => ({ store, recovered: false }),
    save: () => undefined,
    clear: () => undefined,
    exportJson: () => '',
    importJson: () => null,
  };
}

function render(language: CodeLanguage, current: number, module: AlgorithmModule<unknown> = mod, variant = 'classic'): string {
  const lines = module.pseudocode[variant] ?? [];
  return renderToStaticMarkup(
    <StoreProvider storage={storageWith(language)}>
      <CodeView lines={lines} current={current} module={module} variant={variant} />
    </StoreProvider>,
  );
}

const litLines = (html: string): number[] => [...html.matchAll(/data-line="(\d+)" aria-current="step"/g)].map((m) => Number(m[1]));

describe('CodeView', () => {
  it('keeps the plain pseudocode view when no module is given', () => {
    const html = renderToStaticMarkup(<CodeView lines={['a', 'b', 'c']} current={2} />);
    expect(html).toContain('data-lang="pseudo"');
    expect(litLines(html)).toEqual([2]);
    expect(html).not.toContain('radiogroup');
  });

  it('offers only the languages the module has, labelled "Code language"', () => {
    const html = render('pseudo', 3);
    expect(html).toContain('aria-label="Code language"');
    for (const l of ['pseudo', 'js', 'python', 'cpp', 'java']) expect(html).toContain(`data-value="${l}"`);
    const { code: _drop, ...bare } = mod;
    void _drop;
    expect(render('js', 3, bare as AlgorithmModule<unknown>)).not.toContain('radiogroup');
  });

  it('highlights map[current − 1] of the chosen listing', () => {
    for (const lang of ['js', 'python', 'cpp', 'java'] as const) {
      for (let p = 1; p <= 7; p++) {
        const html = render(lang, p);
        expect(html).toContain(`data-lang="${lang}"`);
        expect(litLines(html)).toEqual(mod.code?.classic?.[lang]?.map[p - 1]);
      }
    }
  });

  it('falls back to pseudocode when the module lacks the stored language', () => {
    const noJava = { ...mod, code: { classic: { js: mod.code?.classic?.js } } } as unknown as AlgorithmModule<unknown>;
    const html = render('java', 4, noJava);
    expect(html).toContain('data-lang="pseudo"');
    expect(litLines(html)).toEqual([4]);
  });

  it('highlights nothing before the first step', () => {
    expect(litLines(render('js', 0))).toEqual([]);
  });
});
