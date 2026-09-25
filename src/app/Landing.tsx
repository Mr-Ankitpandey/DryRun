/** Landing `/` (WP-F, docs/DESIGN.md §5, §6.1, §6.7). The top of the page is
 *  a live binary-search trace paused at its first question; the headline sits
 *  to its left (above it on a phone). Below: the loop in three rows, each with
 *  a real still from the same module, then the algorithm list. A returning
 *  learner with re-traces due sees the welcome block instead of the hero. */

import { useMemo, useRef, useState } from 'react';
import { registry } from '@/algorithms/registry';
import { correctCount } from '@/trace/session';
import type { Session } from '@/trace/session';
import { AppShell } from '@/ui/AppShell';
import { useMotionPref } from '@/ui/motion';
import { useStore } from '@/ui/store';
import { TopBar } from '@/ui/TopBar';
import { APP_VERSION, FEEDBACK_URL } from './config';
import { HERO_MAX_ASKS, HERO_SEED, finishLine, heroInput, heroModule, keepTracingHref, welcomeFor } from './landing/hero';
import type { HeroResult } from './landing/hero';
import { LinkButton } from './landing/LinkButton';
import { LoopRows } from './landing/LoopRows';
import { useWriteIn } from './landing/useWriteIn';
import { AlgorithmTable } from './library/AlgorithmTable';
import { libraryRows } from './library/rows';
import { SiteNav } from './SiteNav';
import { TracePlayer } from './trace/TracePlayer';

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export default function Landing() {
  const { store } = useStore();
  // The review queue is checked once, on load (DESIGN §6.7).
  const [now] = useState(() => Date.now());
  const [welcome] = useState(() => welcomeFor(store.review, now, registry));
  const rows = useMemo(() => libraryRows(registry, [], {}, now), [now]);

  return (
    <AppShell topBar={<TopBar end={<SiteNav current="/" />} />} bottom={<SiteFooter />}>
      {welcome ? <WelcomeBack line={welcome.line} titles={welcome.titles} /> : <Hero />}

      <section aria-labelledby="loop-title" className="mt-16 sm:mt-24">
        <h2 id="loop-title" className="font-display text-2xl sm:text-3xl">
          How a trace goes
        </h2>
        <LoopRows />
      </section>

      <section aria-labelledby="algos-title" className="mt-16 max-w-4xl sm:mt-24">
        <h2 id="algos-title" className="font-display text-2xl sm:text-3xl">
          What you can trace
        </h2>
        <p className="mt-2 text-base text-ink-2">Each one opens paused at step 0 with its own questions. More algorithms are on the way.</p>
        <AlgorithmTable className="mt-5" rows={rows} mode="brief" caption="Algorithms you can trace" />
        <div className="mt-5">
          <LinkButton href="/algorithms">Open the library with your scores</LinkButton>
        </div>
      </section>
    </AppShell>
  );
}

function Hero() {
  const input = useMemo(() => heroInput(), []);
  const [result, setResult] = useState<HeroResult | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const { reduced } = useMotionPref();
  useWriteIn(traceRef, reduced);

  const onFinish = (session: Session) => {
    setResult({
      asked: session.answers.length,
      correct: correctCount(session),
      remaining: Math.max(0, session.askIndices.length - session.answers.length),
    });
  };

  return (
    <section
      aria-labelledby="hero-title"
      className="grid gap-x-10 gap-y-6 pt-2 [grid-template-areas:'intro'_'trace'_'cta'] lg:grid-cols-[5fr_7fr] lg:grid-rows-[auto_1fr] lg:pt-10 lg:[grid-template-areas:'intro_trace'_'cta_trace']"
    >
      <div className="[grid-area:intro]">
        <h1 id="hero-title" className="font-display max-w-[14ch] text-4xl lg:text-5xl">
          Stop watching algorithms. Start tracing them.
        </h1>
        <p className="mt-4 max-w-[44ch] text-lg text-ink">
          You predict the next step, the real move plays, and a wrong guess stays on the grid beside it with the rule you broke.
        </p>
      </div>

      <div ref={traceRef} className="min-w-0 [grid-area:trace]" data-testid="hero-trace">
        <TracePlayer
          module={heroModule}
          input={input}
          seed={HERO_SEED}
          mode="trace"
          level="guided"
          variant="compact"
          maxAsks={HERO_MAX_ASKS}
          startAtFirstAsk
          persist={false}
          onFinish={onFinish}
        />
      </div>

      <div className="[grid-area:cta] lg:self-start" aria-live="polite">
        {result ? (
          <p className="mb-4 max-w-[44ch] text-base text-ink" data-testid="hero-result">
            {finishLine(result)}
          </p>
        ) : null}
        <LinkButton href={keepTracingHref(input)} variant="primary" data-testid="hero-cta">
          {result ? 'Keep tracing' : 'Trace binary search'}
        </LinkButton>
        {result ? null : <p className="mt-3 text-sm text-ink-2">No sign-up. Progress stays in this browser.</p>}
      </div>
    </section>
  );
}

function WelcomeBack({ line, titles }: { line: string; titles: string[] }) {
  return (
    <section aria-labelledby="welcome-title" className="max-w-3xl pt-2 lg:pt-10" data-testid="welcome">
      <h1 id="welcome-title" className="font-display text-4xl lg:text-5xl">
        <NoBreakHyphens text={line} />
      </h1>
      <p className="mt-4 text-lg text-ink">
        Due now: {listFormat.format(titles)}. Each one comes back on an input you have not traced before.
      </p>
      <div className="mt-6">
        <LinkButton href="/review" variant="primary" data-testid="welcome-cta">
          Start the re-traces
        </LinkButton>
      </div>
    </section>
  );
}

/** Keeps hyphenated words ("re-traces") on one line in the big display type. */
function NoBreakHyphens({ text }: { text: string }) {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule bg-surface">
      <div className="flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm text-ink-2">
        <span>DryRun {APP_VERSION}</span>
        <span>Your answers are stored in this browser only.</span>
        {FEEDBACK_URL ? (
          <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
            Send feedback
          </a>
        ) : null}
      </div>
    </footer>
  );
}
