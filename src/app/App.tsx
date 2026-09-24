import { Route, Switch } from 'wouter';

/** Route shell. Screens are added by their packages (docs/PLAN.md §8). */
export default function App() {
  return (
    <Switch>
      <Route path="/">
        <main className="min-h-dvh bg-bg text-ink px-4 py-10">
          <h1 className="font-display text-3xl">DryRun</h1>
          <p className="mt-2 max-w-prose text-ink-2">Stop watching algorithms. Start tracing them.</p>
          <p className="mt-6 font-mono text-sm">engine spike in progress</p>
        </main>
      </Route>
      <Route>
        <main className="min-h-dvh bg-bg text-ink px-4 py-10">
          <h1 className="font-display text-3xl">Nothing here</h1>
          <p className="mt-2 text-ink-2">This page does not exist. Go back to the start.</p>
        </main>
      </Route>
    </Switch>
  );
}
