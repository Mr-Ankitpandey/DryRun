import { useState } from 'react';
import { Button } from '@/ui/Button';
import { useStore } from '@/ui/store';

/** Shown when stored data could not be read and a fresh store was started.
 *  "Got it" saves the fresh store over the unreadable one, so it shows once. */
export function RecoveredNotice() {
  const { store, replace, recovered } = useStore();
  const [dismissed, setDismissed] = useState(false);
  if (!recovered || dismissed) return null;
  return (
    <div role="alert" className="mb-6 flex max-w-2xl flex-col gap-3 rounded-sm border border-red bg-surface p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-base text-ink">
        Your saved progress could not be read, so DryRun started fresh. If you have a backup file, restore it in
        Settings.
      </p>
      <Button
        size="sm"
        onClick={() => {
          replace(store);
          setDismissed(true);
        }}
      >
        Got it
      </Button>
    </div>
  );
}
