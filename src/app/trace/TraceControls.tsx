/** The transport row: step back / play / step forward / speed, the timeline
 *  strip, the step counter and the shortcuts key. On phones the speed control
 *  and the shortcuts key are dropped (no hardware keyboard, little room).
 *  Blind: the gate is the frozen point, so the strip greys out everything
 *  past it (the hidden steps included); during the reveal nothing moves by hand. */

import type { TraceController } from './useTraceController';
import { IconButton } from '@/ui/IconButton';
import { KeyboardIcon } from '@/render/icons';
import { Timeline } from '@/render/Timeline';
import { Transport } from '@/render/Transport';

export function TraceControls({ c, compact, onHelp }: { c: TraceController; compact: boolean; onHelp: () => void }) {
  const { tl, session } = c;
  const run = c.viewRun;
  const atGate = tl.gate !== null && tl.k >= tl.gate;
  const busy = c.revealing;
  const note = c.hiddenNote ?? (tl.k > 0 ? (run.steps[tl.k - 1]?.note ?? '') : 'Start');
  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2" data-testid="controls">
      <Transport
        playing={tl.playing}
        canPrev={tl.k > 0 && !busy}
        canNext={tl.k < tl.length && !atGate && !busy}
        canPlay={tl.k < tl.length && !atGate && !busy}
        speed={tl.speed}
        onPrev={() => c.nav({ type: 'prev' })}
        onToggle={() => c.nav({ type: 'toggle' })}
        onNext={() => c.nav({ type: 'next' })}
        onSpeed={c.setSpeed}
        showSpeed={!compact}
      />
      <Timeline
        length={tl.length}
        k={tl.k}
        gate={tl.gate}
        phases={c.phases}
        asks={session.askIndices}
        right={c.right}
        wrong={c.wrong}
        onScrub={(k) => c.nav({ type: 'scrub', k })}
        onScrubEnd={() => c.nav({ type: 'scrubEnd' })}
        onSeek={(k) => c.nav({ type: 'seek', k })}
        onStep={(d) => c.nav({ type: d < 0 ? 'prev' : 'next' })}
        valueText={`Step ${tl.k} of ${tl.length}. ${note}`}
        height={compact ? 32 : 40}
      />
      <span className="shrink-0 font-mono text-sm text-ink-2 tabular-nums" data-testid="step" aria-hidden="true">
        {tl.k}/{tl.length}
      </span>
      {!compact && (
        <IconButton label="Keyboard shortcuts (?)" variant="bare" onClick={onHelp} data-testid="help">
          <KeyboardIcon />
        </IconButton>
      )}
    </div>
  );
}
