import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useLocation } from 'wouter';
import { findEntry } from '@/algorithms/registry';
import { practiceUrl } from '@/learn/review-input';
import { newSeed } from '@/lib/rng';
import type { Level } from '@/lib/storage';
import { traceUrl } from '@/lib/url';
import type { MistakeKind } from '@/trace/asks';
import { textLink } from './styles';

export interface PracticeLinkProps {
  algorithm: string;
  kind: MistakeKind;
  level: Level;
  className?: string;
}

/** "Practise this on a new input": on click, loads the module (not before),
 *  builds a fresh seeded input from the kind's target and opens it. The href is
 *  the plain trace page, used as is for a modifier-click or if loading fails. */
export function PracticeLink({ algorithm, kind, level, className }: PracticeLinkProps) {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const plain = traceUrl(algorithm, { mode: 'trace', level });

  async function open(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    let url: string | null;
    try {
      const module = await findEntry(algorithm)?.load();
      url = module ? practiceUrl(module, algorithm, kind, newSeed(), level) : null;
    } catch {
      url = null;
    }
    setBusy(false);
    navigate(url ?? plain);
  }

  return (
    <a href={plain} onClick={(e) => void open(e)} aria-busy={busy || undefined} data-testid="practice-link" className={`${textLink} ${className ?? ''}`}>
      Practise this on a new input
    </a>
  );
}
