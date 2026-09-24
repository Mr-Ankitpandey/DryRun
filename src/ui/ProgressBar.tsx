import { cx } from './cx';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name, e.g. "Session progress". */
  label: string;
  /** Show "value / max" in mono next to the bar (default true). */
  showCount?: boolean;
  className?: string;
}

/** A thin rule that fills in pen blue. The count is the non-color cue. The fill
 *  uses a transform so nothing lays out during the transition. */
export function ProgressBar({ value, max, label, showCount = true, className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  return (
    <div className={cx('flex w-full items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(max, Math.max(0, value))}
        className="relative h-1.5 flex-1 overflow-hidden rounded-xs bg-rule"
      >
        <div
          className="absolute inset-0 origin-left bg-pen transition-transform duration-(--dur-m) ease-(--ease-out)"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {showCount ? (
        <span className="shrink-0 font-mono text-sm leading-none text-ink-2" aria-hidden="true">
          {value} / {max}
        </span>
      ) : null}
    </div>
  );
}
