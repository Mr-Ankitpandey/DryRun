/** A choice ask: one key-cap button per option, numbered for the keyboard.
 *  Press to commit: the button scales to 0.96 while pressed and releases on
 *  the sheet spring; the answer is graded on click. */

import * as m from 'motion/react-m';
import { Kbd } from '@/ui/Kbd';
import { useTransition } from '@/render/MotionMode';

export function AskChoice({ options, onAnswer }: { options: readonly string[]; onAnswer: (o: string) => void }) {
  const press = useTransition('sheet');
  return (
    <div role="group" aria-label="Options" className="flex flex-col gap-2">
      {options.map((o, i) => (
        <m.button
          key={o}
          type="button"
          data-option={o}
          whileTap={{ scale: 0.96 }}
          transition={press}
          onClick={() => onAnswer(o)}
          className="flex min-h-11 w-full items-center gap-3 rounded-sm border border-rule bg-surface px-3 py-2 text-left text-base text-ink transition-colors duration-(--dur-xs) hover:border-ink"
        >
          {i < 9 && <Kbd className="shrink-0">{i + 1}</Kbd>}
          <span className="font-mono text-[0.9375rem]">{o}</span>
        </m.button>
      ))}
    </div>
  );
}
