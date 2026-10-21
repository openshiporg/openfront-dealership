export const INVENTORY_RECON_STATUSES = ['open', 'in-progress', 'completed', 'cancelled'] as const
export type InventoryReconStatus = typeof INVENTORY_RECON_STATUSES[number]

const RECON_TRANSITIONS: Record<InventoryReconStatus, readonly InventoryReconStatus[]> = {
  open: ['in-progress', 'completed', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function normalizeStockNumber(value: unknown) {
  const stockNumber = String(value || '').trim().toUpperCase()
  if (!stockNumber || stockNumber.length > 80) throw new Error('Stock number is required and must be at most 80 characters')
  return stockNumber
}

export function inventoryStockKey(rooftopId: unknown, stockNumber: unknown) {
  const rooftop = String(rooftopId || '').trim()
  if (!rooftop) throw new Error('Rooftop is required')
  return `${rooftop}:${normalizeStockNumber(stockNumber)}`
}

export function assertReconTransition(current: unknown, next: unknown) {
  if (!INVENTORY_RECON_STATUSES.includes(current as InventoryReconStatus) || !INVENTORY_RECON_STATUSES.includes(next as InventoryReconStatus)) {
    throw new Error('Invalid reconditioning status')
  }
  if (!RECON_TRANSITIONS[current as InventoryReconStatus].includes(next as InventoryReconStatus)) {
    throw new Error(`Reconditioning work cannot transition from ${current} to ${next}`)
  }
}

export function assertMerchandisingTransition(current: unknown, next: unknown) {
  if (current !== 'submitted' || !['approved', 'rejected'].includes(String(next))) {
    throw new Error(`Merchandising evidence cannot transition from ${current} to ${next}`)
  }
}

export function assertFeedRunStatus(value: unknown) {
  const status = String(value || '')
  if (!['succeeded', 'partial', 'failed'].includes(status)) throw new Error('Feed run status must be succeeded, partial, or failed')
  return status as 'succeeded' | 'partial' | 'failed'
}

export function nonNegativeCents(value: unknown, label: string) {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`${label} must be non-negative integer cents`)
  return amount
}
