import { useEffect, useRef, useState } from 'react';
import { localCalendar } from '@/learn/progress';
import { sessionSummaryText } from '@/learn/summary';
import { Button } from '@/ui/Button';
import { APP_VERSION, FEEDBACK_URL } from '../config';
import { useStore } from '@/ui/store';
import { SettingRow } from './SettingRow';
import { sectionTitle, textLink } from './styles';

export interface SummarySectionProps {
  notify: (message: string) => void;
}

/** "Copy my session summary" for the feedback form, the optional feedback link
 *  and the app version. When the clipboard is blocked, the text is shown
 *  selected so it can be copied by hand. */
export function SummarySection({ notify }: SummarySectionProps) {
  const { store } = useStore();
  const [fallback, setFallback] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (fallback !== null) areaRef.current?.select();
  }, [fallback]);

  async function copy() {
    const text = sessionSummaryText(store, Date.now(), { appVersion: APP_VERSION, calendar: localCalendar });
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setFallback(null);
      notify('Summary copied');
    } catch {
      setFallback(text);
    }
  }

  return (
    <section aria-labelledby="feedback-h" className="mt-10">
      <h2 id="feedback-h" className={sectionTitle}>
        Feedback
      </h2>
      <div className="mt-2 divide-y divide-rule border-y border-rule bg-surface">
        <SettingRow
          labelId="summary-l"
          label="Copy my session summary"
          hint="Totals, accuracy per algorithm and top mistake kinds, as plain text to paste into feedback. No inputs or seeds."
        >
          <Button onClick={() => void copy()}>
            Copy summary
          </Button>
        </SettingRow>
        {fallback !== null ? (
          <div className="p-4">
            <label htmlFor="summary-text" className="block text-sm text-ink">
              Copying is blocked in this browser. The summary is selected below; copy it with your keyboard or the share menu.
            </label>
            <textarea
              id="summary-text"
              ref={areaRef}
              readOnly
              value={fallback}
              rows={10}
              className="mt-2 w-full max-w-2xl rounded-sm border border-rule bg-surface p-3 font-mono text-sm text-ink"
            />
          </div>
        ) : null}
        {FEEDBACK_URL ? (
          <SettingRow labelId="feedback-l" label="Send feedback" hint="Opens a short form in a new tab.">
            <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className={`${textLink} inline-flex min-h-11 items-center`}>
              Open the feedback form
            </a>
          </SettingRow>
        ) : null}
        <SettingRow labelId="version-l" label="App version">
          <span className="font-mono text-sm text-ink">
            {APP_VERSION}
          </span>
        </SettingRow>
      </div>
    </section>
  );
}
