import { Suspense, lazy } from 'react';
import { Route, Switch } from 'wouter';

/** Route shell. Screens are added by their packages (docs/PLAN.md §8);
 *  this file is lead-owned. Every screen is lazy so the landing stays small. */
const Spike = lazy(() => import('./Spike'));
const Styleguide = lazy(() => import('./Styleguide'));

function Fallback() {
  return <main className="min-h-dvh bg-bg text-ink px-4 py-10 text-ink-2">Loading…</main>;
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Switch>
        <Route path="/">
          <main className="min-h-dvh bg-bg text-ink px-4 py-10">
            <h1 className="font-display text-3xl">DryRun</h1>
            <p className="mt-2 max-w-prose text-ink-2">Stop watching algorithms. Start tracing them.</p>
            <p className="mt-6 font-mono text-sm">engine spike in progress</p>
          </main>
        </Route>
        <Route path="/spike" component={Spike} />
        <Route path="/spike/:id" component={Spike} />
        <Route path="/styleguide" component={Styleguide} />
        <Route>
          <main className="min-h-dvh bg-bg text-ink px-4 py-10">
            <h1 className="font-display text-3xl">Nothing here</h1>
            <p className="mt-2 text-ink-2">This page does not exist. Go back to the start.</p>
          </main>
        </Route>
      </Switch>
    </Suspense>
  );
}
