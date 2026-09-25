import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MemoryStorage, createStorage, defaultStore } from '@/lib/storage';
import type { Store } from '@/lib/storage';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { useStore } from '@/ui/store';
import { SettingRow } from './SettingRow';
import { backupFilename, plural } from './format';
import { sectionTitle } from './styles';

export interface DataSectionProps {
  /** Status toast from the page. */
  notify: (message: string) => void;
}

/** A backup is a few hundred KB at most; anything far larger is the wrong file. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Export/import only need the pure JSON half of storage; the page's store is saved by the StoreProvider.
const codec = createStorage(new MemoryStorage());

const counts = (s: Store): string => `${plural(s.sessions.length, 'session')} and ${plural(s.mistakes.length, 'mistake')}`;

/** Backup download, restore from a file (validated, then confirmed) and erase. */
export function DataSection({ notify }: DataSectionProps) {
  const { store, replace } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<Store | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [today] = useState(() => backupFilename(Date.now()));

  function download() {
    const blob = new Blob([codec.exportJson(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(Date.now());
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    notify('Backup downloaded');
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setImportError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError('That file is larger than 5 MB, so it is not a DryRun backup. Choose the dryrun-backup file you downloaded here.');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportError('The file could not be read. Choose it again.');
      return;
    }
    const parsed = codec.importJson(text);
    if (!parsed) {
      setImportError('That file is not a DryRun backup, or it is damaged. Choose a dryrun-backup file downloaded from this page.');
      return;
    }
    setPending(parsed);
  }

  return (
    <section aria-labelledby="data-h" className="mt-10">
      <h2 id="data-h" className={sectionTitle}>
        Your data
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        Everything is stored in this browser only: {counts(store)}. Download a backup before clearing your browser or
        switching phones.
      </p>
      <div className="mt-2 divide-y divide-rule border-y border-rule bg-surface">
        <SettingRow labelId="export-l" label="Download a backup" hint={`Saves ${today} with all your progress.`}>
          <Button onClick={download}>
            Download backup
          </Button>
        </SettingRow>
        <div>
          <SettingRow labelId="import-l" label="Restore from a backup" hint="Replaces what is stored here. You confirm before anything changes.">
            <Button onClick={() => fileRef.current?.click()}>
              Choose backup file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="import-file"
              onChange={(e) => void onFile(e)}
            />
          </SettingRow>
          {importError ? (
            <p role="alert" className="-mt-2 flex items-start gap-1.5 px-4 pb-4 text-sm text-red">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-px size-4 shrink-0 stroke-current" fill="none" strokeWidth="1.75">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
              <span>{importError}</span>
            </p>
          ) : null}
        </div>
        <SettingRow labelId="reset-l" label="Erase all data" hint="Removes every session, mistake and re-trace from this browser.">
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Erase all data
          </Button>
        </SettingRow>
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        actions={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pending) replace(pending);
                setPending(null);
                notify('Backup restored');
              }}
            >
              Replace my data
            </Button>
          </>
        }
      >
        {pending ? (
          <p>
            The backup has {counts(pending)}. It replaces everything stored in this browser now ({counts(store)}),
            including your settings.
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase all DryRun data?"
        actions={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                replace(defaultStore());
                setConfirmReset(false);
                notify('All data erased');
              }}
            >
              Erase everything
            </Button>
          </>
        }
      >
        <p>
          This removes {counts(store)} and your re-trace schedule from this browser, and resets these settings. It cannot be
          undone; download a backup first if you might want it back.
        </p>
      </Dialog>
    </section>
  );
}
