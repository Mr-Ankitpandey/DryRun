/** Shared id scheme so Tabs and TabPanel wire aria-controls/labelledby. */
export function tabId(base: string, id: string): string {
  return `${base}-tab-${id}`;
}

export function tabPanelId(base: string, id: string): string {
  return `${base}-panel-${id}`;
}
