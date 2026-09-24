/** Linked views (docs/ARCHITECTURE.md §5): hovering any primitive publishes its
 *  id; every primitive whose id or `ref` matches renders as linked. */

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Id } from '@/engine/events';

interface HoverContextValue {
  hoverId: Id | null;
  setHoverId: (id: Id | null) => void;
}

const HoverContext = createContext<HoverContextValue>({ hoverId: null, setHoverId: () => undefined });

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoverId, setHoverId] = useState<Id | null>(null);
  const value = useMemo(() => ({ hoverId, setHoverId }), [hoverId]);
  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export function useHover(): HoverContextValue {
  return useContext(HoverContext);
}

/** Whether a primitive with this id (and optional ref) is currently linked. */
export function useLinked(id: Id, ref: Id | null = null): boolean {
  const { hoverId } = useContext(HoverContext);
  return hoverId !== null && (hoverId === id || (ref !== null && hoverId === ref));
}

/** Pointer handlers that publish/clear the hovered id. */
export function useHoverHandlers(id: Id): { onPointerEnter: () => void; onPointerLeave: () => void } {
  const { setHoverId } = useContext(HoverContext);
  return useMemo(
    () => ({
      onPointerEnter: () => setHoverId(id),
      onPointerLeave: () => setHoverId(null),
    }),
    [id, setHoverId],
  );
}
