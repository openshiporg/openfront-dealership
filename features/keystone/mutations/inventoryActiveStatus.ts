const INACTIVE_INVENTORY_MESSAGES: Record<string, string> = {
  sold: 'This vehicle is sold; listing and photo changes are closed',
  pending: 'This vehicle is pending sale; listing and photo changes are closed',
}

/** Merchandising runs only on lot inventory: `available`, or `service` while in prep or repair. */
export function assertActiveInventory(status: unknown) {
  const value = String(status || '')
  if (['available', 'service'].includes(value)) return
  throw new Error(INACTIVE_INVENTORY_MESSAGES[value] || `Only available or in-service inventory can be changed (vehicle is ${value || 'unknown'})`)
}
