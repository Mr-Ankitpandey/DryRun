/** Code panel. The current line is marked with a pen caret in the gutter, a pen
 *  bar on the left edge and a 12 % pen tint (DESIGN §2 "current line"). The
 *  highlight snaps; it is never animated.
 *
 *  Given `module` (and `variant`), a "Code language" switch shows the module's
 *  real listings next to the pseudocode. The choice is `settings.language`, so
 *  it persists and applies on every trace; a language the module lacks falls
 *  back to pseudocode without changing the setting. In a listing, pseudocode
 *  line p highlights `map[p − 1]`; an empty entry keeps the last highlight.
 *  The panel scrolls itself (never the page) to keep the highlight in view, and
 *  long lines scroll sideways inside it on phones. A layout can cap the panel's
 *  height with the CSS variable --code-max-h (default min(30rem, 70dvh)), e.g.
 *  to the free slot between the sticky stage and the bottom sheet on phones. */

import { useEffect, useRef, useState } from 'react';
import type { AlgorithmModule, CodeListing, RealLanguage } from '@/algorithms/types';
import type { CodeLanguage } from '@/lib/storage';
import { Segmented } from '@/ui/Segmented';
import { useStore } from '@/ui/store';

export interface CodeViewProps {
  /** Pseudocode lines of the current variant. */
  lines: readonly string[];
  /** 1-based pseudocode line of the shown step; 0 before the first step. */
  current: number;
  module?: AlgorithmModule<unknown>;
  variant?: string;
}

const REAL: readonly RealLanguage[] = ['js', 'python', 'cpp', 'java'];
const LABEL: Record<CodeLanguage, string> = { pseudo: 'Pseudocode', js: 'JS', python: 'Python', cpp: 'C++', java: 'Java' };
const NAME: Record<CodeLanguage, string> = { pseudo: 'Pseudocode', js: 'JavaScript code', python: 'Python code', cpp: 'C++ code', java: 'Java code' };

export function CodeView({ lines, current, module, variant }: CodeViewProps) {
  if (!module) return <CodePanel lang="pseudo" lines={lines} highlight={current > 0 ? [current] : []} current={current} />;
  return <LanguageCode lines={lines} current={current} module={module} variant={variant ?? Object.keys(module.pseudocode)[0] ?? ''} />;
}

function LanguageCode({ lines, current, module, variant }: { lines: readonly string[]; current: number; module: AlgorithmModule<unknown>; variant: string }) {
  const { store, update } = useStore();
  const listings: Partial<Record<RealLanguage, CodeListing>> = module.code?.[variant] ?? {};
  const available: CodeLanguage[] = ['pseudo', ...REAL.filter((l) => listings[l] !== undefined)];
  const chosen = store.settings.language;
  const lang: CodeLanguage = available.includes(chosen) ? chosen : 'pseudo';
  const listing = lang === 'pseudo' ? undefined : listings[lang];

  const direct = current <= 0 ? [] : listing ? (listing.map[current - 1] ?? []) : [current];
  // An empty map entry keeps the last highlight of the same listing.
  const key = `${module.meta.id}:${variant}:${lang}`;
  const [held, setHeld] = useState<{ key: string; lines: readonly number[] }>({ key: '', lines: [] });
  if (direct.length > 0 && (held.key !== key || held.lines.join() !== direct.join())) setHeld({ key, lines: direct });
  const highlight = direct.length > 0 || current <= 0 ? direct : held.key === key ? held.lines : [];

  const setLang = (value: CodeLanguage) => update((s) => (s.settings.language === value ? s : { ...s, settings: { ...s.settings, language: value } }));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {available.length > 1 && (
        <div className="max-w-full overflow-x-auto">
          <Segmented label="Code language" size="sm" value={lang} onChange={setLang} options={available.map((l) => ({ value: l, label: LABEL[l] }))} />
        </div>
      )}
      <CodePanel lang={lang} lines={listing ? listing.lines : lines} highlight={highlight} current={current} />
    </div>
  );
}

function CodePanel({ lang, lines, highlight, current }: { lang: CodeLanguage; lines: readonly string[]; highlight: readonly number[]; current: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = highlight[0] ?? 0;
  const last = highlight[highlight.length - 1] ?? 0;

  // Keep the highlighted lines inside the panel by scrolling the panel only.
  useEffect(() => {
    const box = scroller.current;
    if (!box || first === 0) return;
    const top = box.querySelector<HTMLElement>(`[data-line="${first}"]`);
    const bottom = box.querySelector<HTMLElement>(`[data-line="${last}"]`) ?? top;
    if (!top || !bottom) return;
    const b = box.getBoundingClientRect();
    const t = top.getBoundingClientRect();
    const u = bottom.getBoundingClientRect();
    const pad = t.height;
    if (t.top < b.top) box.scrollTop -= b.top - t.top + pad;
    else if (u.bottom > b.bottom) box.scrollTop += Math.min(u.bottom - b.bottom + pad, t.top - b.top);
  }, [first, last, lang]);

  const on = new Set(highlight);
  return (
    <div ref={scroller} tabIndex={0} role="region" aria-label={NAME[lang]} className="max-h-[var(--code-max-h,min(30rem,70dvh))] overflow-auto rounded-sm border border-rule bg-surface">
      <ol data-testid="code" data-lang={lang} data-current={current} aria-label={NAME[lang]} className="m-0 w-max min-w-full list-none p-0 py-1 font-mono text-[13px] leading-relaxed">
        {lines.map((text, i) => {
          const n = i + 1;
          const lit = on.has(n);
          return (
            <li
              key={n}
              data-line={n}
              aria-current={lit ? 'step' : undefined}
              className="grid max-w-none grid-cols-[0.75rem_2ch_1fr] items-center gap-2 border-l-[3px] pr-3 pl-1.5 whitespace-pre"
              style={{ borderLeftColor: lit ? 'var(--pen)' : 'transparent', background: lit ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent' }}
            >
              <span aria-hidden="true" className="flex items-center text-pen">
                {lit && n === first && (
                  <svg viewBox="0 0 8 10" className="h-2.5 w-2">
                    <path d="M0 0 L8 5 L0 10 Z" fill="currentColor" />
                  </svg>
                )}
              </span>
              <span aria-hidden="true" className="text-right text-ink-2 select-none">
                {n}
              </span>
              <span className="text-ink">
                <Highlighted text={text} lang={lang} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Light syntax cue: keywords in semibold ink, comments in ink-2. No new colours
// (amber and teal already mean "compare" and "frontier" on the stage).

const KEYWORDS: Record<CodeLanguage, ReadonlySet<string>> = {
  pseudo: new Set(['if', 'else', 'while', 'for', 'return', 'and', 'or', 'not', 'in', 'continue']),
  js: new Set(['function', 'const', 'let', 'return', 'if', 'else', 'while', 'for', 'of', 'new', 'class', 'constructor', 'this', 'null', 'continue', 'break', 'true', 'false']),
  python: new Set(['def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'and', 'or', 'not', 'is', 'None', 'class', 'continue', 'break', 'True', 'False', 'lambda']),
  cpp: new Set(['int', 'void', 'bool', 'auto', 'const', 'return', 'if', 'else', 'while', 'for', 'struct', 'new', 'delete', 'nullptr', 'continue', 'break', 'true', 'false']),
  java: new Set(['static', 'int', 'void', 'boolean', 'return', 'if', 'else', 'while', 'for', 'new', 'class', 'record', 'null', 'this', 'continue', 'break', 'true', 'false']),
};

function Highlighted({ text, lang }: { text: string; lang: CodeLanguage }) {
  const comment = lang === 'python' ? /#.*$/ : /\/\/.*$/;
  const m = comment.exec(text);
  const code = m ? text.slice(0, m.index) : text;
  const parts: { text: string; kw: boolean }[] = [];
  const words = KEYWORDS[lang];
  let at = 0;
  for (const w of code.matchAll(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|[A-Za-z_]\w*/g)) {
    const kw = w[1] === undefined && words.has(w[0]);
    if (!kw) continue;
    if (w.index > at) parts.push({ text: code.slice(at, w.index), kw: false });
    parts.push({ text: w[0], kw: true });
    at = w.index + w[0].length;
  }
  if (at < code.length) parts.push({ text: code.slice(at), kw: false });
  return (
    <>
      {parts.map((p, k) => (p.kw ? <span key={k} className="font-semibold">{p.text}</span> : <span key={k}>{p.text}</span>))}
      {m && <span className="text-ink-2">{m[0]}</span>}
    </>
  );
}
