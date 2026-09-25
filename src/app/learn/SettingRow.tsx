import type { ReactNode } from 'react';

export interface SettingRowProps {
  /** id of the visible label, so a control group can reference it. */
  labelId: string;
  label: ReactNode;
  hint?: ReactNode;
  /** The control (Segmented, Button). */
  children: ReactNode;
}

/** A setting: label and one-line hint on the left, the control on the right
 *  (stacked on phones). Rows are separated by the section's rules, not boxes. */
export function SettingRow({ labelId, label, hint, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p id={labelId} className="text-base font-medium text-ink">
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-sm text-ink-2">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
