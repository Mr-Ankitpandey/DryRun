/** One window-level key handler for the trace (keys.ts has the map and the
 *  rules for not fighting fields, buttons and dialogs). Elements that own their
 *  keys (the edit-input sheet) opt out with a `data-own-keys` ancestor. */

import { useEffect, useRef } from 'react';
import type { KeyCommand, KeyContext } from './keys';
import { keyTarget, mapKey } from './keys';

export function useTraceKeys(ctx: Omit<KeyContext, 'target'>, run: (cmd: KeyCommand) => void, enabled = true): void {
  const latest = useRef({ ctx, run });
  useEffect(() => {
    latest.current = { ctx, run };
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('[data-own-keys]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && !latest.current.ctx.modal) return;
      const cmd = mapKey(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey }, { ...latest.current.ctx, target: keyTarget(el) });
      if (!cmd) return;
      e.preventDefault();
      latest.current.run(cmd);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
