/** 404 (WP-F): says what happened, in the product's own terms, and offers the
 *  two places worth going. */

import { useLocation } from 'wouter';
import { AppShell } from '@/ui/AppShell';
import { TopBar } from '@/ui/TopBar';
import { LinkButton } from './landing/LinkButton';
import { SiteNav } from './SiteNav';

export default function NotFound() {
  const [location] = useLocation();
  return (
    <AppShell topBar={<TopBar end={<SiteNav />} />}>
      <div className="max-w-2xl py-6 sm:py-12">
        <h1 className="font-display text-3xl sm:text-4xl">No page at this address</h1>
        <p className="mt-4 text-base text-ink">
          Nothing lives at <code className="rounded-xs bg-hatch px-1 break-all">{location}</code>. The range is empty, so this search returns −1.
        </p>
        <p className="mt-2 text-base text-ink-2">The link may be mistyped or out of date. A trace link starts with /t/ and the algorithm name.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/algorithms" variant="primary">
            See all algorithms
          </LinkButton>
          <LinkButton href="/">Go to the start page</LinkButton>
        </div>
      </div>
    </AppShell>
  );
}
