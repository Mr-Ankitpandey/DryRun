import { Suspense, lazy } from 'react';
import { Route, Switch } from 'wouter';
// Direct imports, not the '@/ui' barrel: the root must not pull every component
// (and Motion) into the landing bundle.
import { StoreProvider } from '@/ui/store';
import { ThemeProvider } from '@/ui/theme';

/** Route table (lead-owned). Each screen file is owned by one package
 *  (docs/PLAN.md §8). Every screen is lazy so the landing stays small. */
const Landing = lazy(() => import('./Landing'));
const Library = lazy(() => import('./Library'));
const Trace = lazy(() => import('./Trace'));
const Review = lazy(() => import('./Review'));
const Mistakes = lazy(() => import('./Mistakes'));
const Progress = lazy(() => import('./Progress'));
const Settings = lazy(() => import('./Settings'));
const NotFound = lazy(() => import('./NotFound'));
const Spike = lazy(() => import('./Spike'));
const Styleguide = lazy(() => import('./Styleguide'));

function Fallback() {
  return <div className="min-h-dvh" aria-busy="true" />;
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <Suspense fallback={<Fallback />}>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/algorithms" component={Library} />
            <Route path="/t/:id" component={Trace} />
            <Route path="/review" component={Review} />
            <Route path="/mistakes" component={Mistakes} />
            <Route path="/progress" component={Progress} />
            <Route path="/settings" component={Settings} />
            <Route path="/spike" component={Spike} />
            <Route path="/spike/:id" component={Spike} />
            <Route path="/styleguide" component={Styleguide} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ThemeProvider>
    </StoreProvider>
  );
}
