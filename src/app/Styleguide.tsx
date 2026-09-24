/** Style tile (owned by WP-B). Tokens, type, vocabulary, motion, components, both
 *  themes. This is the page the owner judges in the browser; everything on it is
 *  built from src/ui and the tokens, nothing is drawn ad hoc except the
 *  vocabulary samples, which preview what src/render will draw. */

import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppShell,
  Button,
  Callout,
  Dialog,
  EmptyState,
  IconButton,
  Kbd,
  NumberField,
  ProgressBar,
  Segmented,
  Select,
  Sheet,
  Switch,
  TabPanel,
  Tabs,
  TextField,
  ThemeProvider,
  ThemeScope,
  Toast,
  TopBar,
  cx,
  durations,
  springs,
  useMotionPref,
  useTheme,
  useTransition,
} from '@/ui';
import type { MotionKind } from '@/ui';
import type { Theme } from '@/lib/storage';

/* ---------- page scaffolding ---------- */

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['type', 'Type'],
  ['vocabulary', 'Vocabulary'],
  ['motion', 'Motion'],
  ['components', 'Components'],
] as const;

/** Display sizes from the 1.25 scale that Tailwind's default scale lacks. */
const display = {
  49: 'text-[49px]',
  39: 'text-[39px]',
  31: 'text-[31px]',
  25: 'text-[25px]',
} as const;

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 border-t border-rule pt-6 pb-10">
      <h2 id={`${id}-h`} className={cx('font-display text-ink', display[25])}>
        {title}
      </h2>
      {lede ? <p className="mt-1 max-w-prose text-base text-ink-2">{lede}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Sub({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-base font-medium text-ink">{title}</h3>
      {note ? <p className="mt-0.5 text-sm text-ink-2">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

function StateLabel({ children }: { children: ReactNode }) {
  return <span className="block text-xs text-ink-2">{children}</span>;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('min-w-0 rounded-sm border border-rule bg-surface p-4', className)}>{children}</div>;
}

/* ---------- icons (currentColor, 20 px) ---------- */

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M6 4l10 6-10 6z" />
    </svg>
  );
}
function StepIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M4 4l9 6-9 6z" />
      <rect x="14" y="4" width="2" height="12" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 stroke-current" fill="none" strokeWidth="1.75" strokeLinecap="round">
      <path d="M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4" />
      <circle cx="10" cy="15" r=".6" className="fill-current" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 stroke-current" fill="none" strokeWidth="1.75" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/* ---------- 1. tokens ---------- */

const TOKENS: ReadonlyArray<[name: string, use: string]> = [
  ['bg', 'page'],
  ['grid', 'graph-paper lines'],
  ['surface', 'panels, ask sheet'],
  ['ink', 'text, settled fills, pointers'],
  ['ink-2', 'secondary text, unvisited outlines'],
  ['rule', 'dividers, ticks'],
  ['pen', 'accent: write, move, primary, active line'],
  ['amber', 'compare'],
  ['teal', 'frontier'],
  ['red', 'ghost, error'],
  ['green', 'correct'],
  ['hatch', 'invariant region base'],
];

function Swatch({ name, use }: { name: string; use: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hex, setHex] = useState('');
  useEffect(() => {
    if (ref.current) setHex(getComputedStyle(ref.current).getPropertyValue(`--${name}`).trim());
  }, [name]);
  return (
    <li className="flex items-center gap-3">
      <span
        ref={ref}
        aria-hidden="true"
        className="size-11 shrink-0 rounded-sm border border-rule"
        style={{ background: `var(--${name})` }}
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-mono text-sm text-ink">
          --{name} <span className="text-ink-2">{hex}</span>
        </span>
        <span className="text-xs text-ink-2">{use}</span>
      </span>
    </li>
  );
}

function TokenSheet({ theme, label }: { theme: 'light' | 'dark'; label: string }) {
  return (
    <ThemeScope theme={theme} className="paper rounded-sm border border-rule p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {TOKENS.map(([n, u]) => (
          <Swatch key={n} name={n} use={u} />
        ))}
      </ul>
      <div className="mt-4 rounded-sm border border-rule bg-surface p-3 text-sm text-ink">
        A surface on the paper. Panels are separated by the grid, not by shadows.
      </div>
    </ThemeScope>
  );
}

/* ---------- 2. type ---------- */

function TypeRow({ size, children }: { size: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-baseline gap-3 border-b border-rule py-3 last:border-b-0">
      <span className="font-mono text-xs text-ink-2">{size}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ---------- 3. vocabulary ---------- */

type Vocab =
  | 'compare'
  | 'write'
  | 'read'
  | 'visited'
  | 'frontier'
  | 'settled'
  | 'pointer'
  | 'invariant'
  | 'eliminated'
  | 'stale'
  | 'ghost'
  | 'correct'
  | 'line';

const VOCAB: ReadonlyArray<[Vocab, string, string, string]> = [
  ['compare', 'compare', '--amber', 'bracket connector between the two items and a ? badge'],
  ['write', 'write / move', '--pen', 'solid fill; the element travels with a short trailing stroke'],
  ['read', 'read', '--ink-2', 'thin dotted outline pulse'],
  ['visited', 'visited', '--ink-2 at 25 %', 'dotted fill pattern'],
  ['frontier', 'frontier', '--teal', 'dashed ring'],
  ['settled', 'settled / final', '--ink', 'solid fill and a small tick in the corner'],
  ['pointer', 'pointer', '--pen', 'triangle caret below the cell, name in mono'],
  ['invariant', 'invariant region', '--hatch', '45° hatch and a bracket label above'],
  ['eliminated', 'eliminated', '--grid', 'cross-hatch, values at 50 %'],
  ['stale', 'stale', '--ink-2', 'strikethrough on the panel row and a "stale" tag'],
  ['ghost', 'error / ghost', '--red', 'dashed outline at 40 %, × badge'],
  ['correct', 'correct', '--green', '1.5 px ring that draws around the element, ✓'],
  ['line', 'current line', '--pen at 12 %', 'left bar in the gutter'],
];

const cell = 'fill-surface stroke-ink';
const val = 'fill-ink font-mono text-[10px]';

function VocabSample({ kind }: { kind: Vocab }) {
  const uid = useId().replace(/:/g, '');
  const dots = `dots-${uid}`;
  const hatch = `hatch-${uid}`;
  const cross = `cross-${uid}`;
  return (
    <svg viewBox="0 0 88 48" className="h-12 w-22 shrink-0" aria-hidden="true">
      <defs>
        <pattern id={dots} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" className="fill-ink-2" />
        </pattern>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="fill-hatch" />
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-rule" strokeWidth="1" />
        </pattern>
        <pattern id={cross} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-grid" strokeWidth="1" />
          <line x1="0" y1="0" x2="6" y2="0" className="stroke-grid" strokeWidth="1" />
        </pattern>
      </defs>
      {kind === 'compare' ? (
        <>
          <rect x="8" y="16" width="24" height="24" className={cell} />
          <rect x="56" y="16" width="24" height="24" className={cell} />
          <text x="20" y="32" textAnchor="middle" className={val}>15</text>
          <text x="68" y="32" textAnchor="middle" className={val}>42</text>
          <path d="M20 12v-4h48v4" fill="none" className="stroke-amber" strokeWidth="1.5" />
          <circle cx="44" cy="8" r="6" className="fill-amber" />
          <text x="44" y="11" textAnchor="middle" className="fill-bg font-mono text-[9px]">?</text>
        </>
      ) : null}
      {kind === 'write' ? (
        <>
          <rect x="10" y="12" width="24" height="24" className="fill-none stroke-rule" strokeDasharray="2 2" />
          <path d="M22 24h22" className="stroke-pen" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
          <rect x="52" y="12" width="24" height="24" className="fill-pen" />
          <text x="64" y="28" textAnchor="middle" className="fill-bg font-mono text-[10px]">7</text>
        </>
      ) : null}
      {kind === 'read' ? (
        <>
          <rect x="32" y="12" width="24" height="24" className="fill-surface stroke-ink-2" strokeWidth="1.5" strokeDasharray="1 3" strokeLinecap="round" />
          <text x="44" y="28" textAnchor="middle" className={val}>9</text>
        </>
      ) : null}
      {kind === 'visited' ? (
        <>
          <circle cx="44" cy="24" r="13" fill={`url(#${dots})`} className="stroke-ink-2" />
          <text x="44" y="28" textAnchor="middle" className={val}>B</text>
        </>
      ) : null}
      {kind === 'frontier' ? (
        <>
          <circle cx="44" cy="24" r="13" className="fill-surface stroke-teal" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="44" y="28" textAnchor="middle" className={val}>C</text>
        </>
      ) : null}
      {kind === 'settled' ? (
        <>
          <circle cx="44" cy="24" r="13" className="fill-ink" />
          <text x="44" y="28" textAnchor="middle" className="fill-bg font-mono text-[10px]">3</text>
          <circle cx="55" cy="35" r="5" className="fill-surface stroke-ink" />
          <path d="M52.5 35l2 2 3.5-4" fill="none" className="stroke-ink" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {kind === 'pointer' ? (
        <>
          <rect x="32" y="6" width="24" height="24" className={cell} />
          <text x="44" y="22" textAnchor="middle" className={val}>12</text>
          <path d="M44 32l-4 6h8z" className="fill-pen" />
          <text x="44" y="46" textAnchor="middle" className="fill-pen font-mono text-[9px]">lo</text>
        </>
      ) : null}
      {kind === 'invariant' ? (
        <>
          <rect x="6" y="18" width="50" height="24" fill={`url(#${hatch})`} />
          <path d="M6 14v-3h50v3" fill="none" className="stroke-ink" strokeWidth="1" />
          <text x="31" y="8" textAnchor="middle" className="fill-ink-2 font-mono text-[8px]">sorted</text>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={8 + i * 16} y="20" width="14" height="20" className="fill-none stroke-ink" />
          ))}
          <rect x="60" y="20" width="14" height="20" className="fill-surface stroke-ink-2" />
        </>
      ) : null}
      {kind === 'eliminated' ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={10 + i * 18} y="12" width="16" height="24" className={cell} />
          ))}
          <rect x="10" y="12" width="34" height="24" fill={`url(#${cross})`} />
          {['3', '7'].map((v, i) => (
            <text key={v} x={18 + i * 18} y="28" textAnchor="middle" className={val} opacity="0.5">{v}</text>
          ))}
          {['9', '12'].map((v, i) => (
            <text key={v} x={54 + i * 18} y="28" textAnchor="middle" className={val}>{v}</text>
          ))}
        </>
      ) : null}
      {kind === 'stale' ? (
        <>
          <rect x="4" y="14" width="80" height="20" className="fill-surface stroke-rule" />
          <text x="10" y="27" className="fill-ink-2 font-mono text-[9px]">u=3 d=7</text>
          <line x1="8" y1="24" x2="52" y2="24" className="stroke-ink-2" strokeWidth="1.25" />
          <rect x="56" y="18" width="24" height="12" className="fill-none stroke-ink-2" />
          <text x="68" y="27" textAnchor="middle" className="fill-ink-2 font-mono text-[7px]">stale</text>
        </>
      ) : null}
      {kind === 'ghost' ? (
        <>
          <rect x="32" y="12" width="24" height="24" className="fill-none stroke-red" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
          <text x="44" y="28" textAnchor="middle" className="fill-red font-mono text-[10px]" opacity="0.6">5</text>
          <circle cx="58" cy="14" r="5.5" className="fill-red" />
          <path d="M55.5 11.5l5 5M60.5 11.5l-5 5" className="stroke-bg" strokeWidth="1.25" strokeLinecap="round" />
        </>
      ) : null}
      {kind === 'correct' ? (
        <>
          <rect x="32" y="12" width="24" height="24" className={cell} />
          <text x="44" y="28" textAnchor="middle" className={val}>5</text>
          <rect x="29" y="9" width="30" height="30" className="fill-none stroke-green" strokeWidth="1.5" />
          <circle cx="58" cy="10" r="5.5" className="fill-green" />
          <path d="M55.5 10l2 2 3.5-4" fill="none" className="stroke-bg" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {kind === 'line' ? (
        <>
          <rect x="4" y="16" width="80" height="16" className="fill-pen/12" />
          <rect x="4" y="16" width="2" height="16" className="fill-pen" />
          <path d="M9 20l4 4-4 4z" className="fill-pen" />
          <text x="18" y="28" className="fill-ink-2 font-mono text-[8px]">3</text>
          <text x="26" y="28" className="fill-ink font-mono text-[8px]">mid = lo + (hi-lo)/2</text>
        </>
      ) : null}
    </svg>
  );
}

/* ---------- 4. motion ---------- */

const SPRING_KINDS: ReadonlyArray<{ value: MotionKind; label: string }> = [
  { value: 'move', label: 'move' },
  { value: 'settle', label: 'settle' },
  { value: 'sheet', label: 'sheet' },
];
const TWEEN_KINDS: ReadonlyArray<{ value: MotionKind; label: string }> = [
  { value: 'xs', label: 'xs' },
  { value: 's', label: 's' },
  { value: 'm', label: 'm' },
  { value: 'l', label: 'l' },
  { value: 'xl', label: 'xl' },
];

function describe(kind: MotionKind): string {
  if (kind in springs) {
    const s = springs[kind as keyof typeof springs];
    return `spring ${s.stiffness} / ${s.damping} / ${s.mass}`;
  }
  return `tween ${durations[kind as keyof typeof durations]} ms, ease out`;
}

function MotionPlayground() {
  const [kind, setKind] = useState<MotionKind>('move');
  const [far, setFar] = useState(false);
  const [ring, setRing] = useState(false);
  const [ghost, setGhost] = useState(false);
  const t = useTransition(kind);
  const ringT = useTransition('m');
  const ghostT = useTransition('m');
  const pref = useMotionPref();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel className="paper">
        <div className="relative h-24 overflow-hidden">
          {/* travel path */}
          <div aria-hidden="true" className="absolute top-1/2 right-4 left-4 h-px bg-rule" />
          <motion.div
            animate={{ x: far ? 220 : 0 }}
            transition={t}
            className="absolute top-1/2 left-4 flex size-11 -translate-y-1/2 items-center justify-center border border-ink bg-surface font-mono text-base text-ink"
          >
            42
          </motion.div>
          <motion.svg
            aria-hidden="true"
            animate={{ x: far ? 220 : 0 }}
            transition={t}
            viewBox="0 0 44 16"
            className="absolute top-[calc(50%+1.5rem)] left-4 h-4 w-11"
          >
            <path d="M22 0l-5 8h10z" className="fill-pen" />
            <text x="22" y="15" textAnchor="middle" className="fill-pen font-mono text-[8px]">mid</text>
          </motion.svg>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Segmented label="Spring" options={SPRING_KINDS} value={kind} onChange={setKind} />
          <Segmented label="Duration" options={TWEEN_KINDS} value={kind} onChange={setKind} />
          <Button variant="primary" onClick={() => setFar((v) => !v)}>
            Play
          </Button>
        </div>
        <p className="mt-3 font-mono text-xs break-all text-ink-2">
          {kind}: {describe(kind)} → {JSON.stringify(t)}
        </p>
      </Panel>
      <Panel>
        <p className="text-sm font-medium text-ink">Signature moments</p>
        <div className="mt-3 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setRing((v) => !v)}
            className="flex flex-col items-center gap-1 rounded-sm"
            aria-label="Play the correct ring"
          >
            <svg viewBox="0 0 48 48" className="size-12">
              <rect x="10" y="10" width="28" height="28" className="fill-surface stroke-ink" />
              <text x="24" y="28" textAnchor="middle" className="fill-ink font-mono text-[11px]">5</text>
              <motion.rect
                x="6"
                y="6"
                width="36"
                height="36"
                className="fill-none stroke-green"
                strokeWidth="1.5"
                initial={false}
                animate={{ pathLength: ring ? 1 : 0, opacity: ring ? 1 : 0 }}
                transition={ringT}
              />
            </svg>
            <span className="text-xs text-ink-2">correct ring</span>
          </button>
          <button
            type="button"
            onClick={() => setGhost((v) => !v)}
            className="flex flex-col items-center gap-1 rounded-sm"
            aria-label="Play the ghost sketch"
          >
            <svg viewBox="0 0 48 48" className="size-12">
              <motion.rect
                x="10"
                y="10"
                width="28"
                height="28"
                className="fill-none stroke-red"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                initial={false}
                animate={{ pathLength: ghost ? 1 : 0, opacity: ghost ? 0.5 : 0 }}
                transition={ghostT}
              />
              <motion.text
                x="24"
                y="28"
                textAnchor="middle"
                className="fill-red font-mono text-[11px]"
                initial={false}
                animate={{ opacity: ghost ? 0.6 : 0 }}
                transition={ghostT}
              >
                9
              </motion.text>
            </svg>
            <span className="text-xs text-ink-2">ghost sketch-in</span>
          </button>
        </div>
        <p className="mt-4 text-sm text-ink-2">
          Reduced motion: {pref.reduced ? 'on' : 'off'}
          {pref.source !== 'none' ? ` (${pref.source})` : ''}. Springs and tweens become {'{duration: 0}'}; the
          tick and the ghost still appear.
        </p>
      </Panel>
    </div>
  );
}

/* ---------- 5. components ---------- */

const LEVELS = [
  { value: 'guided', label: 'Guided' },
  { value: 'full', label: 'Full' },
] as const;

const VIEWS = [
  { value: 'viz', label: 'Trace' },
  { value: 'code', label: 'Code' },
] as const;

const ALGOS = [
  { value: 'binary-search', label: 'Binary search' },
  { value: 'quick-sort', label: 'Quick sort' },
  { value: 'dijkstra', label: 'Dijkstra' },
] as const;

function Sampler() {
  const [on, setOn] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <Button variant="primary">Trace binary search</Button>
        <Button>Edit input</Button>
        <Button variant="danger">Reset data</Button>
      </Row>
      <Row>
        <Segmented label="Level" options={LEVELS} value="guided" onChange={() => {}} />
        <Kbd>Space</Kbd>
        <Kbd>←</Kbd>
        <Kbd>→</Kbd>
      </Row>
      <TextField label="Target" mono defaultValue="42" hint="Any integer" />
      <Switch label="Reduce motion" checked={on} onChange={setOn} />
      <Callout>
        The target, if present, is inside <code>[lo, hi]</code> = <code>[2, 8]</code>.
      </Callout>
      <ProgressBar label="Session" value={7} max={23} />
    </div>
  );
}

function Components() {
  const [level, setLevel] = useState<'guided' | 'full'>('guided');
  const [view, setView] = useState<'viz' | 'code'>('viz');
  const [algo, setAlgo] = useState<(typeof ALGOS)[number]['value']>('binary-search');
  const [n, setN] = useState<number | null>(9);
  const [bad, setBad] = useState<number | null>(120);
  const [sw, setSw] = useState(true);
  const [toast, setToast] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <Sub title="Button" note="Primary is pen blue and there is one per screen. Quiet is the default. Danger is outlined until hovered.">
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[5rem_repeat(4,auto)] sm:items-center sm:justify-start sm:gap-x-4">
          <span className="hidden sm:block" />
          {['default', 'hover', 'focus', 'disabled'].map((st) => (
            <span key={st} className="hidden sm:block">
              <StateLabel>{st}</StateLabel>
            </span>
          ))}
          {(['primary', 'quiet', 'danger'] as const).map((v) => (
            <div key={v} className="flex flex-col gap-2 sm:contents">
              <StateLabel>{v}</StateLabel>
              <div className="flex flex-wrap gap-3 sm:contents">
                <Button variant={v}>{v === 'primary' ? 'Trace binary search' : v === 'quiet' ? 'Edit input' : 'Reset data'}</Button>
                <Button variant={v} data-hover="">
                  Hover
                </Button>
                <Button variant={v} data-focus="">
                  Focus
                </Button>
                <Button variant={v} disabled>
                  Disabled
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Row className="mt-4">
          <Button icon={<PlusIcon />}>With icon</Button>
          <Button size="sm">Small</Button>
          <Button size="sm" variant="primary">
            Next
          </Button>
        </Row>
      </Sub>

      <Sub title="IconButton" note="44 px square, label required (it is the tooltip and the accessible name).">
        <Row>
          <IconButton label="Play">
            <PlayIcon />
          </IconButton>
          <IconButton label="Step forward" variant="primary">
            <StepIcon />
          </IconButton>
          <IconButton label="Shortcuts" variant="bare">
            <HelpIcon />
          </IconButton>
          <IconButton label="Play" pressed>
            <PlayIcon />
          </IconButton>
          <IconButton label="Play" data-hover="">
            <PlayIcon />
          </IconButton>
          <IconButton label="Play" data-focus="">
            <PlayIcon />
          </IconButton>
          <IconButton label="Play" disabled>
            <PlayIcon />
          </IconButton>
        </Row>
      </Sub>

      <Sub title="Segmented" note="Level and trace/code. Arrow keys move the selection; the selected segment is filled ink like a pressed key.">
        <Row>
          <Segmented label="Level" options={LEVELS} value={level} onChange={setLevel} />
          <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
          <Segmented
            label="Speed"
            size="sm"
            options={[
              { value: '0.5', label: '0.5×' },
              { value: '1', label: '1×' },
              { value: '1.5', label: '1.5×' },
              { value: '2', label: '2×', disabled: true },
            ]}
            value="1"
            onChange={() => {}}
          />
        </Row>
      </Sub>

      <Sub title="Tabs" note="Underlined; for the mobile code/variables panel.">
        <div className="max-w-md">
          <Tabs label="Panels" idBase="sg" tabs={[{ id: 'viz', label: 'Trace' }, { id: 'code', label: 'Code' }, { id: 'vars', label: 'Variables' }]} value={view === 'viz' ? 'viz' : 'code'} onChange={(id) => setView(id === 'viz' ? 'viz' : 'code')} />
          <TabPanel idBase="sg" id="viz" active={view === 'viz'} className="py-3 text-sm text-ink-2">
            The stage goes here.
          </TabPanel>
          <TabPanel idBase="sg" id="code" active={view !== 'viz'} className="py-3">
            <pre className="font-mono text-sm leading-6 text-ink">
              <span className="block text-ink-2">1  lo = 0, hi = n-1</span>
              <span className="block text-ink-2">2  while lo &lt;= hi:</span>
              <span className="-mx-2 block border-l-2 border-pen bg-pen/12 px-2">3    mid = lo + (hi-lo)/2</span>
              <span className="block text-ink-2">4    if a[mid] == x: return mid</span>
            </pre>
          </TabPanel>
        </div>
      </Sub>

      <Sub title="Select, TextField, NumberField" note="Values are always mono. Errors carry a cross glyph, not just red.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Algorithm" options={ALGOS} value={algo} onChange={setAlgo} hint="From the library" />
          <Select label="Algorithm" options={ALGOS} value={algo} onChange={setAlgo} error="Pick one to continue" />
          <Select label="Algorithm" options={ALGOS} value={algo} onChange={setAlgo} disabled />
          <TextField label="Input" mono defaultValue="3, 7, 9, 12, 15, 21, 30, 42, 51" hint="Sorted, comma separated, up to 12 values" />
          <TextField label="Input" mono defaultValue="3, 7, 2" error="Must be sorted ascending: 2 comes after 7" />
          <TextField label="Input" mono defaultValue="3, 7, 9" disabled />
          <NumberField label="Size" value={n} onChange={setN} min={2} max={12} suffix="items" hint="2 to 12" />
          <NumberField label="Size" value={bad} onChange={setBad} min={2} max={12} suffix="items" error="At most 12 items" />
          <NumberField label="Size" value={9} onChange={() => {}} disabled />
        </div>
      </Sub>

      <Sub title="Switch" note="The knob position is the cue; the track turns pen blue when on.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Switch label="Reduce motion" hint="Also follows your system setting" checked={sw} onChange={setSw} />
          <Switch label="Show key hints" checked={!sw} onChange={(v) => setSw(!v)} />
          <Switch label="Reduce motion" checked data-hover="" onChange={() => {}} />
          <Switch label="Show key hints" checked={false} disabled onChange={() => {}} />
        </div>
      </Sub>

      <Sub title="Kbd" note="Keys as printed on the keyboard, mono, sentence case.">
        <Row>
          <Kbd>Space</Kbd> <span className="text-sm text-ink-2">play / pause</span>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> <span className="text-sm text-ink-2">step</span>
          <Kbd>1</Kbd>
          <span className="text-sm text-ink-2">to</span>
          <Kbd>9</Kbd> <span className="text-sm text-ink-2">answer</span>
          <Kbd>Enter</Kbd> <span className="text-sm text-ink-2">submit</span>
          <Kbd>?</Kbd> <span className="text-sm text-ink-2">shortcuts</span>
          <Kbd>Esc</Kbd> <span className="text-sm text-ink-2">close</span>
        </Row>
      </Sub>

      <Sub title="ProgressBar" note="Session progress. The count is the non-color cue.">
        <div className="flex max-w-md flex-col gap-3">
          <ProgressBar label="Session progress" value={7} max={23} />
          <ProgressBar label="Session progress" value={0} max={23} />
          <ProgressBar label="Session progress" value={23} max={23} />
        </div>
      </Sub>

      <Sub title="Callout" note="The invariant sentence above the stage. Live variables are code.">
        <div className="flex flex-col gap-3">
          <Callout>
            The target, if present, is inside <code>[lo, hi]</code> = <code>[2, 8]</code>.
          </Callout>
          <Callout label="Rule">
            When <code>a[mid] &lt; x</code>, everything up to and including <code>mid</code> is out, so <code>lo = mid + 1</code>.
          </Callout>
        </div>
      </Sub>

      <Sub title="EmptyState">
        <Panel className="max-w-md">
          <EmptyState title="No mistakes yet" action={<Button variant="primary">Trace binary search</Button>}>
            Mistakes you make while tracing land here with the rule you missed, so you can re-trace the same input later.
          </EmptyState>
        </Panel>
      </Sub>

      <Sub title="Toast" note="Stamped in ink, announced politely, one optional action.">
        <div className="flex flex-col gap-3">
          <Toast placement="inline" open message="Session summary copied" onDismiss={() => {}} />
          <Toast placement="inline" open message="Data reset" action={{ label: 'Undo', onClick: () => {} }} onDismiss={() => {}} />
          <Row>
            <Button onClick={() => setToast(true)}>Show toast</Button>
          </Row>
          <Toast open={toast} message="Session summary copied" onDismiss={() => setToast(false)} />
        </div>
      </Sub>

      <Sub title="Dialog" note="Focus trapped, Esc closes, focus returns to the opener.">
        <Row>
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
        </Row>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Reset all data?"
          actions={
            <>
              <Button onClick={() => setDialog(false)}>Keep it</Button>
              <Button variant="danger" onClick={() => setDialog(false)}>
                Reset data
              </Button>
            </>
          }
        >
          <p className="text-ink-2">This removes every session, mistake and review from this browser. Export first if you want a copy.</p>
        </Dialog>
      </Sub>

      <Sub title="Sheet" note="The ask container: bottom sheet under 641 px, a panel above. Not modal.">
        <div className="flex max-w-xl flex-col gap-3">
          <Sheet open mode="panel" title="Where does lo move next?">
            <p className="text-base text-ink">Where does lo move next?</p>
            <p className="mt-1 text-sm text-ink-2">
              Click a cell or press <Kbd>1</Kbd> to <Kbd>9</Kbd>.
            </p>
          </Sheet>
          <Row>
            <Button onClick={() => setSheet((v) => !v)}>{sheet ? 'Close sheet' : 'Open sheet'}</Button>
          </Row>
          <Sheet open={sheet} title="Ask" showTitle onClose={() => setSheet(false)}>
            <p className="text-base text-ink">Where does lo move next?</p>
            <p className="mt-1 text-sm text-ink-2">
              Click a cell or press <Kbd>1</Kbd> to <Kbd>9</Kbd>.
            </p>
          </Sheet>
        </div>
      </Sub>

      <Sub title="AppShell and TopBar" note="This page is inside them: skip link, sticky 56 px bar with the wordmark, a rule, and a left-aligned content column.">
        <p className="text-sm text-ink-2">See the top of the page.</p>
      </Sub>

      <Sub title="Side by side" note="The same controls in both themes.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeScope theme="light" className="paper rounded-sm border border-rule p-4">
            <Sampler />
          </ThemeScope>
          <ThemeScope theme="dark" className="paper rounded-sm border border-rule p-4">
            <Sampler />
          </ThemeScope>
        </div>
      </Sub>
    </>
  );
}

/* ---------- page ---------- */

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Page() {
  const { theme, setTheme, motion: motionPref, setMotion } = useTheme();
  const pref = useMotionPref();
  return (
    <AppShell
      topBar={
        <TopBar title="Styleguide" end={<Segmented label="Theme" size="sm" options={THEMES} value={theme} onChange={setTheme} />} />
      }
    >
      <header className="pb-8">
        <p className="text-sm text-ink-2">Direction A</p>
        <h1 className={cx('font-display mt-1 text-ink', display[39])}>Graph paper</h1>
        <p className="mt-3 max-w-prose text-base text-ink-2">
          An engineering notebook. The grid is the working surface, ink is deep navy, pen blue is the one accent. The
          learner's wrong guess is a red-pencil sketch; the truth is drawn in pen. Everything else stays quiet.
        </p>
        <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-xs text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-5 max-w-md">
          <Switch
            label="Reduce motion"
            hint={
              pref.source === 'system' || pref.source === 'both'
                ? 'Your system already asks for reduced motion'
                : 'Stored with your settings'
            }
            checked={motionPref === 'reduced'}
            onChange={(v) => setMotion(v ? 'reduced' : 'system')}
          />
        </div>
      </header>

      <Section id="tokens" title="Tokens" lede="Twelve colours per theme, three faces. Names and hex are read from tokens.css at runtime.">
        <div className="grid gap-4 lg:grid-cols-2">
          <TokenSheet theme="light" label="Paper (light)" />
          <TokenSheet theme="dark" label="Blackboard (dark)" />
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          <li className="rounded-sm border border-rule bg-surface p-3">
            <span className="font-display block text-xl text-ink">Bricolage Grotesque</span>
            <span className="text-xs text-ink-2">display: headlines, screen titles, "Welcome back"</span>
          </li>
          <li className="rounded-sm border border-rule bg-surface p-3">
            <span className="block text-xl text-ink">Instrument Sans</span>
            <span className="text-xs text-ink-2">UI: everything else</span>
          </li>
          <li className="rounded-sm border border-rule bg-surface p-3">
            <span className="block font-mono text-xl text-ink">JetBrains Mono</span>
            <span className="text-xs text-ink-2">values, code, keys, step numbers</span>
          </li>
        </ul>
      </Section>

      <Section id="type" title="Type" lede="1.25 ratio on a 16 px base: 12, 14, 16, 20, 25, 31, 39, 49. Line length at most 70 characters. Sentence case.">
        <div className="max-w-3xl">
          <TypeRow size="49">
            <p className={cx('font-display text-ink', display[49])}>Stop watching algorithms. Start tracing them.</p>
          </TypeRow>
          <TypeRow size="39">
            <p className={cx('font-display text-ink', display[39])}>Welcome back: 3 re-traces due, about 4 minutes.</p>
          </TypeRow>
          <TypeRow size="31">
            <p className={cx('font-display text-ink', display[31])}>Binary search</p>
          </TypeRow>
          <TypeRow size="25">
            <p className={cx('font-display text-ink', display[25])}>Where does lo move next?</p>
          </TypeRow>
          <TypeRow size="20">
            <p className="text-xl font-medium text-ink">The target, if present, is inside [lo, hi].</p>
          </TypeRow>
          <TypeRow size="16">
            <p className="text-base text-ink">
              mid is 4: 15 is less than 42, so everything up to mid is out. The next probe lands in the right half, and the
              window shrinks from nine cells to four.
            </p>
          </TypeRow>
          <TypeRow size="14">
            <p className="text-sm text-ink-2">6 asked, 5 right, 1 boundary mistake</p>
          </TypeRow>
          <TypeRow size="12">
            <p className="text-xs text-ink-2">Last seen 2 days ago</p>
          </TypeRow>
          <TypeRow size="mono">
            <p className="font-mono text-base text-ink">
              lo = 0 <span className="text-ink-2">hi = 8</span> mid = 4 <span className="text-ink-2">x = 42</span>
            </p>
            <p className="mt-1 font-mono text-sm text-ink">while lo &lt;= hi: mid = lo + (hi - lo) / 2</p>
          </TypeRow>
        </div>
      </Section>

      <Section id="vocabulary" title="Vocabulary" lede="Every semantic state has a colour and a non-colour cue, in both themes.">
        <ul className="divide-y divide-rule border-y border-rule">
          {VOCAB.map(([kind, name, token, cue]) => (
            <li key={kind} className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 py-2 sm:grid-cols-[auto_auto_10rem_1fr_9rem] sm:gap-x-4">
              <ThemeScope theme="light" className="paper rounded-xs border border-rule">
                <VocabSample kind={kind} />
              </ThemeScope>
              <ThemeScope theme="dark" className="paper rounded-xs border border-rule">
                <VocabSample kind={kind} />
              </ThemeScope>
              <span className="text-sm font-medium text-ink">{name}</span>
              <span className="col-span-3 text-sm text-ink-2 sm:col-span-1">{cue}</span>
              <span className="col-span-3 font-mono text-xs text-ink-2 sm:col-span-1 sm:text-right">{token}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="motion" title="Motion" lede="Pen on paper: quick, near-critically damped, no overshoot on data. Only the sheet and the tick may overshoot a little.">
        <MotionPlayground />
        <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-ink-2">Durations</p>
            <dl className="text-sm">
            {(['xs', 's', 'm', 'l', 'xl'] as const).map((k) => (
              <div key={k} className="flex justify-between gap-4 border-b border-rule py-1">
                <dt className="font-mono text-ink">{k}</dt>
                <dd className="font-mono text-ink-2">{durations[k]} ms</dd>
              </div>
            ))}
            </dl>
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-2">Springs (stiffness / damping)</p>
            <dl className="text-sm">
            {(['move', 'settle', 'sheet'] as const).map((k) => (
              <div key={k} className="flex justify-between gap-4 border-b border-rule py-1">
                <dt className="font-mono text-ink">{k}</dt>
                <dd className="font-mono text-ink-2">
                  {springs[k].stiffness} / {springs[k].damping}
                </dd>
              </div>
            ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section id="components" title="Components" lede="Every control at 44 px, keyboard reachable, with a visible pen-blue focus ring.">
        <Components />
      </Section>
    </AppShell>
  );
}

export default function Styleguide() {
  return (
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  );
}
