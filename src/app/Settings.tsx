/** Settings `/settings` (docs/DESIGN.md §5): appearance, default level, the
 *  code shown next to traces, backup and restore, erase, the session summary for
 *  feedback, and the app version. Every change goes through the store
 *  (useStore / useTheme). */

import type { ReactNode } from 'react';
import { useStore } from '@/ui/store';
import { useTheme } from '@/ui/theme';
import type { CodeLanguage, Level, MotionPref, Theme } from '@/lib/storage';
import { AppShell } from '@/ui/AppShell';
import { Segmented } from '@/ui/Segmented';
import { Toast } from '@/ui/Toast';
import { TopBar } from '@/ui/TopBar';
import { SiteNav } from './SiteNav';
import { DataSection } from './learn/DataSection';
import { RecoveredNotice } from './learn/RecoveredNotice';
import { SettingRow } from './learn/SettingRow';
import { SummarySection } from './learn/SummarySection';
import { screenTitle, sectionTitle } from './learn/styles';
import { useToast } from './learn/use-toast';

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const MOTION: ReadonlyArray<{ value: MotionPref; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'reduced', label: 'Reduced' },
];

const LEVELS: ReadonlyArray<{ value: Level; label: string }> = [
  { value: 'guided', label: 'Guided' },
  { value: 'full', label: 'Full' },
  { value: 'blind', label: 'Blind' },
];

/** Full names where there is room; phones get short ones so five keys fit in
 *  one row. The hidden half is display:none, so each key has one accessible name. */
const short = (long: string, abbr: string) => (
  <>
    <span className="sm:hidden">{abbr}</span>
    <span className="hidden sm:inline">{long}</span>
  </>
);

const LANGUAGES: ReadonlyArray<{ value: CodeLanguage; label: ReactNode }> = [
  { value: 'pseudo', label: short('Pseudocode', 'Pseudo') },
  { value: 'js', label: short('JavaScript', 'JS') },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
];

export default function Settings() {
  const { store, update } = useStore();
  const { theme, setTheme, motion, setMotion } = useTheme();
  const toast = useToast();

  return (
    <AppShell topBar={<TopBar title="Settings" end={<SiteNav />} />}>
      <RecoveredNotice />
      <div className="max-w-3xl">
        <h1 className={screenTitle}>Settings</h1>

        <section aria-labelledby="appearance-h" className="mt-8">
          <h2 id="appearance-h" className={sectionTitle}>
            Appearance
          </h2>
          <div className="mt-2 divide-y divide-rule border-y border-rule bg-surface">
            <SettingRow labelId="theme-l" label="Theme" hint="System follows your phone or computer.">
              <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
            </SettingRow>
            <SettingRow labelId="motion-l" label="Motion" hint="Reduced makes every move instant. Nothing is hidden.">
              <Segmented label="Motion" options={MOTION} value={motion} onChange={setMotion} />
            </SettingRow>
          </div>
        </section>

        <section aria-labelledby="tracing-h" className="mt-10">
          <h2 id="tracing-h" className={sectionTitle}>
            Tracing
          </h2>
          <div className="mt-2 divide-y divide-rule border-y border-rule bg-surface">
            <SettingRow
              labelId="level-l"
              label="Default level"
              hint={
                <>
                  Guided asks at the key moments. Full asks at every step that has a question. Blind asks what Full
                  asks, but the stage freezes between questions; run the hidden steps in your head. Used for new
                  traces and re-traces.
                </>
              }
            >
              <Segmented
                label="Default level"
                options={LEVELS}
                value={store.settings.level}
                onChange={(level) => update((s) => ({ ...s, settings: { ...s.settings, level } }))}
              />
            </SettingRow>
            <SettingRow
              labelId="language-l"
              label="Code shown next to traces"
              hint="Questions follow the pseudocode either way. Choose a language to see the same steps in it beside the trace."
            >
              <Segmented
                label="Code shown next to traces"
                options={LANGUAGES}
                value={store.settings.language}
                onChange={(language) => update((s) => ({ ...s, settings: { ...s.settings, language } }))}
              />
            </SettingRow>
          </div>
        </section>

        <DataSection notify={toast.show} />
        <SummarySection notify={toast.show} />
      </div>
      <Toast open={toast.message !== null} message={toast.message ?? ''} onDismiss={toast.dismiss} />
    </AppShell>
  );
}
