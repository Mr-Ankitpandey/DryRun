/** Height of the phone's bottom sheet, so the page can reserve the same space
 *  under its content (the sheet is fixed; nothing may hide behind it). It
 *  measures the sheet element around the content it is given a ref to. */

import { useCallback, useState } from 'react';

export function useDockHeight(enabled: boolean): [measure: (el: HTMLElement | null) => void, height: number] {
  const [height, setHeight] = useState(0);
  const measureEl = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return;
      const sheet = el.closest('section') ?? el;
      const measure = () => setHeight(Math.ceil(sheet.getBoundingClientRect().height));
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(sheet);
      return () => ro.disconnect();
    },
    [enabled],
  );
  return [measureEl, height];
}
