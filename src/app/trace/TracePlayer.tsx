/** TracePlayer: the one component that runs a trace (ask → commit → reveal →
 *  ghost/rule → next ask) for any algorithm module. Used by the trace screen
 *  (variant 'full'), the landing hero and review sessions (variant 'compact').
 *
 *  CONTRACT (lead-owned, frozen for wave 2): the props below. WP-E owns the
 *  implementation and may add files under src/app/trace/**, but must not change
 *  or remove these props. Callers (WP-F landing, WP-H review) build against them. */

import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import type { GradeResult } from '@/trace/grade';
import type { Session } from '@/trace/session';

export interface TracePlayerProps {
  /** An already-loaded module (callers resolve it via the registry or a static import). */
  module: AlgorithmModule<unknown>;
  /** A decoded, validated input for that module. */
  input: unknown;
  /** Seed recorded with the session (URL seed or review seed). */
  seed: string;
  /** 'trace' gates play at asks; 'watch' plays through with no asks. */
  mode: 'trace' | 'watch';
  level: Level;
  /** 'full': stage, code, panels, timeline, transport. 'compact': stage + ask only. */
  variant: 'full' | 'compact';
  /** Stop after this many graded answers (landing hero uses 2). */
  maxAsks?: number;
  /** Open with the timeline already at the first ask instead of step 0. */
  startAtFirstAsk?: boolean;
  /** Commit the finished session to the store (history, mistakes, review queue). */
  persist?: boolean;
  /** After every graded answer. */
  onAnswer?: (result: GradeResult, session: Session) => void;
  /** Once, when the session ends: all asks answered, maxAsks reached, or watch end. */
  onFinish?: (session: Session) => void;
}

/** Placeholder until WP-E lands the implementation. */
export function TracePlayer({ module, variant }: TracePlayerProps) {
  return (
    <div className="rounded-sm border border-rule bg-surface p-4 text-ink-2" data-testid="trace-player" data-variant={variant}>
      {module.meta.title}: the trace player is being built.
    </div>
  );
}
