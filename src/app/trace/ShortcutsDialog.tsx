/** The keyboard map (DESIGN §6.8), opened with ? . */

import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Kbd } from '@/ui/Kbd';

const ROWS: { keys: string[]; what: string }[] = [
  { keys: ['Space'], what: 'Play or pause; continue after an answer' },
  { keys: ['←', '→'], what: 'Step back or forward' },
  { keys: ['1', '…', '9'], what: 'Pick the numbered element, node or option' },
  { keys: ['Enter'], what: 'Check a typed value or an order; continue' },
  { keys: ['Backspace'], what: 'Take back the last item of an order' },
  { keys: ['Home', 'End'], what: 'Jump to the start or as far as you can go (timeline focused)' },
  { keys: ['?'], what: 'This list' },
  { keys: ['Esc'], what: 'Close' },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard" size="lg" actions={<Button onClick={onClose}>Close</Button>}>
      <table className="w-full border-collapse text-base">
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.what} className="border-t border-grid first:border-t-0">
              <td className="py-2 pr-4 align-top whitespace-nowrap">
                <span className="inline-flex gap-1">
                  {r.keys.map((k) => (k === '…' ? <span key={k} className="text-ink-2">to</span> : <Kbd key={k}>{k}</Kbd>))}
                </span>
              </td>
              <td className="py-2 text-ink">{r.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
