import type { DeskTone } from '@/features/platform/components/desk'

export type PartsRooftop = { id: string; name: string | null }

export type Part = {
  id: string
  partNumber: string
  description: string
  binLocation: string | null
  quantity: number | null
  committedQuantity: number | null
  onOrderQuantity: number | null
  minimumQuantity: number | null
  costCents: number | null
  priceCents: number | null
  supplier: string | null
  supplierPartNumber: string | null
  updatedAt: string
  rooftop: PartsRooftop | null
}

export type PartsMovement = {
  id: string
  movementType: string
  quantityDelta: number
  onHandAfter: number | null
  committedAfter: number | null
  onOrderAfter: number | null
  reference: string
  reason: string
  occurredAt: string
  evidence: Record<string, unknown> | null
  serviceOrder: { id: string; status: string | null; invoiceNumber: string | null } | null
}

export type OpenRepairOrder = {
  id: string
  status: string | null
  invoiceNumber: string | null
  concern: string | null
  rooftop: { id: string } | null
  appointment: { customerVehicleDescription: string | null; lead: { firstName: string | null; lastName: string | null } | null } | null
}

export type PurchaseOrderLine = {
  partId: string
  partNumber: string
  description: string
  quantity: number
  unitCostCents: number
  receivedQuantity: number
  onOrderQuantity: number
}

export type PurchaseOrder = {
  id: string
  reference: string
  supplier: string
  status: string
  lines: PurchaseOrderLine[] | null
  orderedAt: string | null
  receivedAt: string | null
  createdAt: string
  updatedAt: string
  rooftop: PartsRooftop | null
}

export type StockState = 'out' | 'low' | 'ok'

export function available(part: Pick<Part, 'quantity' | 'committedQuantity'>) {
  return Math.max(0, Number(part.quantity || 0) - Number(part.committedQuantity || 0))
}

/** Out: nothing available. Low: available at or below the reorder point (when one is set). */
export function stockState(part: Part): StockState {
  const free = available(part)
  if (free <= 0) return 'out'
  const reorder = Number(part.minimumQuantity || 0)
  if (reorder > 0 && free <= reorder) return 'low'
  return 'ok'
}

export const STOCK_TONE: Record<StockState, DeskTone> = { out: 'bad', low: 'warn', ok: 'ok' }
export const STOCK_LABEL: Record<StockState, string> = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' }

export const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  'partially-received': 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
}

export const PO_STATUS_TONE: Record<string, DeskTone> = {
  draft: 'idle',
  ordered: 'info',
  'partially-received': 'warn',
  received: 'ok',
  cancelled: 'idle',
}

/** Mirrors PO_ACTION_FROM in features/keystone/mutations/partsOperations.ts. */
export const PO_ACTION_FROM = {
  update: ['draft'],
  order: ['draft'],
  receive: ['ordered', 'partially-received'],
  close: ['partially-received'],
  cancel: ['draft', 'ordered'],
} as const

export function poLines(order: Pick<PurchaseOrder, 'lines'>): PurchaseOrderLine[] {
  return (Array.isArray(order.lines) ? order.lines : []).map(line => ({
    partId: String(line?.partId || ''),
    partNumber: String(line?.partNumber || ''),
    description: String(line?.description || ''),
    quantity: Number(line?.quantity || 0),
    unitCostCents: Number(line?.unitCostCents || 0),
    receivedQuantity: Number(line?.receivedQuantity || 0),
    onOrderQuantity: Number(line?.onOrderQuantity || 0),
  }))
}

export function poTotalCents(order: Pick<PurchaseOrder, 'lines'>) {
  return poLines(order).reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0)
}

export const MOVEMENT_LABEL: Record<string, string> = {
  receipt: 'Receipt',
  issue: 'Issue to RO',
  return: 'Return from RO',
  adjustment: 'Adjustment',
  count: 'Cycle count',
  commit: 'Commit to RO',
  release: 'Release from RO',
  'po-order': 'On order',
  'po-cancel': 'Order cancelled',
}

export function formatCents(cents: number | null | undefined) {
  if (cents == null) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100)
}

export function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function repairOrderLabel(order: OpenRepairOrder) {
  const name = [order.appointment?.lead?.firstName, order.appointment?.lead?.lastName].filter(Boolean).join(' ')
  return [order.invoiceNumber || `RO-${order.id.slice(-8).toUpperCase()}`, name || null, order.appointment?.customerVehicleDescription || null, order.status]
    .filter(Boolean)
    .join(' · ')
}

/** Movement types the stock ledger accepts (recordPartsMovement). */
export const MOVEMENT_TYPES = ['receipt', 'issue', 'return', 'commit', 'release', 'adjustment', 'count', 'po-order', 'po-cancel'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]
export const RO_MOVEMENT_TYPES: ReadonlySet<string> = new Set(['issue', 'return', 'commit', 'release'])

/**
 * Client preview of the server's stock math (computePartsMovement in
 * features/keystone/mutations/partsOperations.ts). Returns an error message instead of throwing.
 */
export function previewMovement(part: Pick<Part, 'quantity' | 'committedQuantity' | 'onOrderQuantity'>, type: string, quantity: number, quantityDelta?: number) {
  let onHand = Number(part.quantity || 0)
  let committed = Number(part.committedQuantity || 0)
  let onOrder = Number(part.onOrderQuantity || 0)
  if (type === 'receipt') { onHand += quantity; onOrder = Math.max(0, onOrder - quantity) }
  else if (type === 'issue') { onHand -= quantity; committed = Math.max(0, committed - quantity) }
  else if (type === 'return') onHand += quantity
  else if (type === 'adjustment') onHand += Number(quantityDelta || 0)
  else if (type === 'count') onHand = quantity
  else if (type === 'commit') committed += quantity
  else if (type === 'release') committed -= quantity
  else if (type === 'po-order') onOrder += quantity
  else if (type === 'po-cancel') onOrder -= quantity
  let error: string | null = null
  if (onHand < 0) error = 'Not enough stock on hand'
  else if (committed < 0) error = 'Cannot release more than is committed'
  else if (onOrder < 0) error = 'Cannot cancel more than is on order'
  else if (committed > onHand) error = 'Committed quantity would exceed stock on hand'
  return { onHand, committed, onOrder, error }
}
