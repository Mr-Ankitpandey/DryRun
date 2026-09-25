/** Transport and trace icons: drawn marks on a 20-unit grid in currentColor,
 *  1.75 stroke with round joins (the same hand as the close icon in src/ui).
 *  Solid where a shape must read at a glance (play). */

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function PlayIcon() {
  return (
    <Icon>
      <path d="M6.5 4.5 L15.5 10 L6.5 15.5 Z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon() {
  return (
    <Icon>
      <path d="M7 4.5 V15.5 M13 4.5 V15.5" strokeWidth={2.5} />
    </Icon>
  );
}

export function StepBackIcon() {
  return (
    <Icon>
      <path d="M5.5 4.5 V15.5" />
      <path d="M15 5 L8.5 10 L15 15 Z" fill="currentColor" />
    </Icon>
  );
}

export function StepForwardIcon() {
  return (
    <Icon>
      <path d="M14.5 4.5 V15.5" />
      <path d="M5 5 L11.5 10 L5 15 Z" fill="currentColor" />
    </Icon>
  );
}

export function KeyboardIcon() {
  return (
    <Icon>
      <rect x="2.5" y="5.5" width="15" height="9" rx="1.5" />
      <path d="M5.5 8.5 H6 M8.5 8.5 H9 M11.5 8.5 H12 M14.5 8.5 H15 M6.5 11.5 H13.5" />
    </Icon>
  );
}

export function UndoIcon() {
  return (
    <Icon>
      <path d="M7.5 5.5 L4 9 L7.5 12.5" />
      <path d="M4.5 9 H12 A4 4 0 0 1 12 17 H9" />
    </Icon>
  );
}

export function CrossMark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 4 L12 12 M12 4 L4 12" />
    </svg>
  );
}
