import type { ReactNode } from 'react';
import { tabId, tabPanelId } from './tab-ids';

export interface TabPanelProps {
  idBase: string;
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}

/** The panel for one tab; hidden panels stay mounted so state survives. */
export function TabPanel({ idBase, id, active, children, className }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idBase, id)}
      aria-labelledby={tabId(idBase, id)}
      hidden={!active}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
