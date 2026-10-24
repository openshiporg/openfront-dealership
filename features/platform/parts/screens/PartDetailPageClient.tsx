'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { recordReference } from '@/features/platform/lib/format'

import { getPartDetail } from '../actions'
import { MovementDialog } from '../components/MovementDialog'
import { PartFormDialog } from '../components/PartFormDialog'
import {
  MOVEMENT_LABEL,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  STOCK_LABEL,
  STOCK_TONE,
  available,
  formatCents,
  formatDateTime,
  poLines,
  stockState,
  type MovementType,
  type OpenRepairOrder,
  type Part,
  type PartsMovement,
  type PurchaseOrder,
} from '../lib/types'

type LedgerFilter = 'all' | 'stock' | 'ro' | 'orders'

const LEDGER_GROUP: Record<string, LedgerFilter> = {
  receipt: 'stock',
  adjustment: 'stock',
  count: 'stock',
  issue: 'ro',
  return: 'ro',
  commit: 'ro',
  release: 'ro',
  'po-order': 'orders',
  'po-cancel': 'orders',
}

const MOVEMENT_TONE: Record<string, DeskTone> = {
  receipt: 'ok',
  return: 'ok',
  issue: 'info',
  commit: 'info',
  release: 'idle',
  adjustment: 'warn',
  count: 'warn',
  'po-order': 'info',
  'po-cancel': 'idle',
}

const ACTIONS: Array<{ type: MovementType; label: string; primary?: boolean }> = [
  { type: 'receipt', label: 'Receive', primary: true },
  { type: 'commit', label: 'Commit to RO' },
  { type: 'issue', label: 'Issue to RO' },
  { type: 'return', label: 'Return from RO' },
  { type: 'release', label: 'Release' },
  { type: 'adjustment', label: 'Adjust' },
  { type: 'count', label: 'Count' },
  { type: 'po-order', label: 'Mark on order' },
  { type: 'po-cancel', label: 'Cancel on order' },
]

/** Why a movement cannot be recorded right now, or null. Mirrors the server's stock checks. */
function blockedReason(type: MovementType, part: Part, openRos: number): string | null {
  const needsRo = ['issue', 'return', 'commit', 'release'].includes(type)
  if (needsRo && openRos === 0) return 'no open repair orders'
  if (type === 'issue' && Number(part.quantity || 0) <= 0) return 'nothing on hand'
  if (type === 'commit' && available(part) <= 0) return 'nothing available'
  if (type === 'release' && Number(part.committedQuantity || 0) <= 0) return 'nothing committed'
  if (type === 'po-cancel' && Number(part.onOrderQuantity || 0) <= 0) return 'nothing on order'
  return null
}

function movementQuantity(movement: PartsMovement) {
  const fromEvidence = Number((movement.evidence as { quantity?: unknown } | null)?.quantity)
  if (['receipt', 'return', 'adjustment', 'count', 'issue'].includes(movement.movementType)) {
    const delta = movement.quantityDelta
    return delta > 0 ? `+${delta}` : String(delta)
  }
  const size = Number.isFinite(fromEvidence) && fromEvidence > 0 ? fromEvidence : null
  if (size === null) return '-'
  return movement.movementType === 'release' || movement.movementType === 'po-cancel' ? `-${size}` : `+${size}`
}

export function PartDetailPageClient({
  id,
  initialPart,
  initialMovements,
  initialRepairOrders,
  initialPurchaseOrders,
  initialError,
  timeZone,
}: {
  id: string
  initialPart: Part | null
  initialMovements: PartsMovement[]
  initialRepairOrders: OpenRepairOrder[]
  initialPurchaseOrders: PurchaseOrder[]
  initialError: string | null
  timeZone: string
}) {
  const [part, setPart] = useState(initialPart)
  const [movements, setMovements] = useState(initialMovements)
  const [repairOrders, setRepairOrders] = useState(initialRepairOrders)
  const [purchaseOrders, setPurchaseOrders] = useState(initialPurchaseOrders)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [movementType, setMovementType] = useState<MovementType | null>(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await getPartDetail(id)
    if (response.success && response.data.partsInventory) {
      setPart(response.data.partsInventory)
      setMovements(response.data.partsMovements || [])
      setRepairOrders(response.data.serviceOrders || [])
      setPurchaseOrders(response.data.purchaseOrders || [])
      setError(null)
    } else {
      setError(response.success ? 'Part not found' : response.error)
    }
    setLoading(false)
  }

  const rooftopRos = useMemo(() => repairOrders.filter(order => order.rooftop?.id === part?.rooftop?.id), [repairOrders, part?.rooftop?.id])
  const openPos = useMemo(() => purchaseOrders.filter(order => poLines(order).some(line => line.partId === id)), [purchaseOrders, id])
  const ledgerCounts = useMemo(() => ({
    all: movements.length,
    stock: movements.filter(movement => LEDGER_GROUP[movement.movementType] === 'stock').length,
    ro: movements.filter(movement => LEDGER_GROUP[movement.movementType] === 'ro').length,
    orders: movements.filter(movement => LEDGER_GROUP[movement.movementType] === 'orders').length,
  }), [movements])
  const visibleMovements = ledgerFilter === 'all' ? movements : movements.filter(movement => LEDGER_GROUP[movement.movementType] === ledgerFilter)

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: 'Parts', href: `${basePath}/platform/parts` },
    { type: 'page' as const, label: part?.partNumber || 'Part' },
  ]

  if (!part) {
    return (
      <PageContainer title="Part" breadcrumbs={breadcrumbs} header={<DeskHeader title="Part" tone="bad" status="Unavailable" />}>
        <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Part unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error || 'Part not found'}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={load} disabled={loading}>Retry</Pill>
              <Pill size="sm" asChild><Link href={`${basePath}/platform/parts`}>Back to parts</Link></Pill>
            </Track>
          </Notice>
        </div>
      </PageContainer>
    )
  }

  const state = stockState(part)
  const blocked = ACTIONS.map(action => ({ ...action, reason: blockedReason(action.type, part, rooftopRos.length) }))
  const margin = part.priceCents && part.costCents != null && part.priceCents > 0 ? Math.round(((part.priceCents - part.costCents) / part.priceCents) * 1000) / 10 : null

  const header = (
    <DeskHeader
      eyebrow={part.rooftop?.name || undefined}
      title={<><span className="font-mono">{part.partNumber}</span> <span className="font-normal">{part.description}</span></>}
      tone={STOCK_TONE[state]}
      status={STOCK_LABEL[state]}
      meta={`${STOCK_LABEL[state]} · ${part.binLocation ? `Bin ${part.binLocation}` : 'No bin'}${part.supplier ? ` · ${part.supplier}` : ''}`}
      actions={
        <Track>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/parts`}><ArrowLeft />Parts</Link>
          </Pill>
          <Pill onClick={load} disabled={loading} className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill onClick={() => setEditing(true)} className="h-11 sm:h-8">
            <Pencil />
            Edit
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title={part.partNumber} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <ReadoutStrip>
          <Readout label="On hand" value={part.quantity ?? 0} />
          <Readout label="Committed" value={part.committedQuantity ?? 0} />
          <Readout label="Available" value={available(part)} tone={STOCK_TONE[state]} />
          <Readout label="On order" value={part.onOrderQuantity ?? 0} />
          <Readout label="Reorder point" value={part.minimumQuantity || '-'} />
        </ReadoutStrip>

        <DeskSection title="Stock movement">
          <Track className="flex-wrap rounded-2xl">
            {blocked.map(action => (
              <Pill
                key={action.type}
                variant={action.primary ? 'primary' : 'raised'}
                className="h-11 sm:h-8"
                disabled={Boolean(action.reason)}
                title={action.reason ? `${action.label}: ${action.reason}` : undefined}
                onClick={() => setMovementType(action.type)}
              >
                {action.label}
              </Pill>
            ))}
          </Track>
          {blocked.some(action => action.reason) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {blocked.filter(action => action.reason).map(action => `${action.label}: ${action.reason}`).join(' · ')}
            </p>
          )}
        </DeskSection>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <DeskSection
            title="Ledger"
            count={movements.length}
            actions={
              <Segmented<LedgerFilter>
                label="Filter ledger"
                value={ledgerFilter}
                onChange={setLedgerFilter}
                size="sm"
                options={[
                  { value: 'all', label: 'All', count: ledgerCounts.all },
                  { value: 'stock', label: 'Stock', count: ledgerCounts.stock },
                  { value: 'ro', label: 'Repair orders', count: ledgerCounts.ro },
                  { value: 'orders', label: 'Orders', count: ledgerCounts.orders },
                ]}
              />
            }
          >
            {visibleMovements.length === 0 ? (
              <Panel className="px-4 py-10 text-center text-sm text-muted-foreground">No movements</Panel>
            ) : (
              <Panel className="divide-y">
                {visibleMovements.map(movement => (
                  <div key={movement.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3">
                    <TitleLine as="p" tone={MOVEMENT_TONE[movement.movementType] || 'idle'} className="text-sm font-medium">
                      {MOVEMENT_LABEL[movement.movementType] || movement.movementType}
                      <span className="ml-2 font-normal text-muted-foreground">{movement.reference}</span>
                    </TitleLine>
                    <p className="text-right font-mono text-sm tabular-nums">{movementQuantity(movement)}</p>
                    <p className="col-span-2 break-words pl-4 text-xs text-muted-foreground">
                      {formatDateTime(movement.occurredAt, timeZone)}
                      {movement.serviceOrder && <> · <Code>{movement.serviceOrder.invoiceNumber || recordReference('RO', movement.serviceOrder.id)}</Code></>}
                      {' · '}{movement.reason}
                    </p>
                    <p className="col-span-2 pl-4 font-mono text-[11px] tabular-nums text-muted-foreground">
                      On hand {movement.onHandAfter ?? '-'} · Committed {movement.committedAfter ?? '-'} · On order {movement.onOrderAfter ?? '-'}
                    </p>
                  </div>
                ))}
              </Panel>
            )}
          </DeskSection>

          <div className="min-w-0 space-y-6">
            <DeskSection title="Details">
              <Facts
                items={[
                  { label: 'Bin', value: part.binLocation || '-', mono: true },
                  { label: 'Cost', value: formatCents(part.costCents), mono: true },
                  { label: 'Retail price', value: formatCents(part.priceCents), mono: true },
                  margin !== null && { label: 'Margin', value: `${margin}%`, mono: true },
                  { label: 'Stock at cost', value: formatCents(Number(part.quantity || 0) * Number(part.costCents || 0)), mono: true },
                  { label: 'Supplier', value: part.supplier || '-' },
                  { label: 'Supplier part number', value: part.supplierPartNumber || '-', mono: true },
                  part.rooftop?.name ? { label: 'Rooftop', value: part.rooftop.name } : null,
                ]}
              />
            </DeskSection>
            <DeskSection title="Open purchase orders" count={openPos.length}>
              {openPos.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <Panel className="divide-y">
                  {openPos.map(order => {
                    const line = poLines(order).find(item => item.partId === id)
                    return (
                      <Link key={order.id} href={`${basePath}/platform/parts/purchase-orders/${order.id}`} className="block min-h-11 px-4 py-2.5 hover:bg-muted/40">
                        <TitleLine as="p" tone={PO_STATUS_TONE[order.status] || 'idle'} status={PO_STATUS_LABEL[order.status]} className="text-sm font-medium">
                          <span className="font-mono">{order.reference}</span>
                          <span className="ml-2 font-normal text-muted-foreground">{PO_STATUS_LABEL[order.status] || order.status}</span>
                        </TitleLine>
                        {line && <p className="pl-4 text-xs text-muted-foreground">{order.supplier} · {line.receivedQuantity}/{line.quantity} received</p>}
                      </Link>
                    )
                  })}
                </Panel>
              )}
            </DeskSection>
          </div>
        </div>

        <MovementDialog
          open={Boolean(movementType)}
          type={movementType}
          part={part}
          repairOrders={rooftopRos}
          onOpenChange={open => { if (!open) setMovementType(null) }}
          onSaved={async () => {
            setNotice(`${MOVEMENT_LABEL[movementType || ''] || 'Movement'} recorded`)
            setMovementType(null)
            await load()
          }}
        />
        <PartFormDialog
          open={editing}
          part={part}
          rooftops={part.rooftop ? [part.rooftop] : []}
          onOpenChange={setEditing}
          onSaved={async () => {
            setNotice('Part saved')
            setEditing(false)
            await load()
          }}
        />
      </div>
    </PageContainer>
  )
}
