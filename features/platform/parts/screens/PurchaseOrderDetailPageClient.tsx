'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Readout, ReadoutStrip, TitleLine, Track } from '@/features/platform/components/desk'

import { getPurchaseOrder, managePurchaseOrder } from '../actions'
import { PurchaseOrderFormDialog } from '../components/PurchaseOrderFormDialog'
import { ReceivePurchaseOrderDialog } from '../components/ReceivePurchaseOrderDialog'
import { PO_ACTION_FROM, PO_STATUS_LABEL, PO_STATUS_TONE, formatCents, formatDateTime, poLines, poTotalCents, type Part, type PurchaseOrder } from '../lib/types'

type ConfirmAction = 'order' | 'close' | 'cancel'

const CONFIRM: Record<ConfirmAction, { title: string; description: string; label: string; done: string }> = {
  order: { title: 'Place order', description: 'Every line goes on order.', label: 'Place order', done: 'Order placed' },
  close: { title: 'Close short', description: 'Outstanding quantities come off order.', label: 'Close short', done: 'Purchase order closed' },
  cancel: { title: 'Cancel purchase order', description: 'On-order quantities from this PO are released.', label: 'Cancel PO', done: 'Purchase order cancelled' },
}

function blockedBy(action: keyof typeof PO_ACTION_FROM, status: string) {
  return (PO_ACTION_FROM[action] as readonly string[]).includes(status) ? null : `${PO_STATUS_LABEL[status] || status} purchase orders cannot be ${action === 'update' ? 'edited' : action === 'order' ? 'ordered' : action === 'receive' ? 'received' : action === 'close' ? 'closed' : 'cancelled'}`
}

export function PurchaseOrderDetailPageClient({
  id,
  initialOrder,
  initialParts,
  initialError,
  timeZone,
}: {
  id: string
  initialOrder: PurchaseOrder | null
  initialParts: Part[]
  initialError: string | null
  timeZone: string
}) {
  const [order, setOrder] = useState(initialOrder)
  const [parts, setParts] = useState(initialParts)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; key: string } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await getPurchaseOrder(id)
    if (response.success && response.data.partsPurchaseOrder) {
      setOrder(response.data.partsPurchaseOrder)
      setParts(response.data.partsInventories || [])
      setError(null)
    } else {
      setError(response.success ? 'Purchase order not found' : response.error)
    }
    setLoading(false)
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: 'Parts', href: `${basePath}/platform/parts` },
    { type: 'link' as const, label: 'Purchase orders', href: `${basePath}/platform/parts/purchase-orders` },
    { type: 'page' as const, label: order?.reference || 'Purchase order' },
  ]

  if (!order) {
    return (
      <PageContainer title="Purchase order" breadcrumbs={breadcrumbs} header={<DeskHeader title="Purchase order" tone="bad" status="Unavailable" />}>
        <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Purchase order unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error || 'Purchase order not found'}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={load} disabled={loading}>Retry</Pill>
              <Pill size="sm" asChild><Link href={`${basePath}/platform/parts/purchase-orders`}>Back to purchase orders</Link></Pill>
            </Track>
          </Notice>
        </div>
      </PageContainer>
    )
  }

  const lines = poLines(order)
  const ordered = lines.reduce((sum, line) => sum + line.quantity, 0)
  const received = lines.reduce((sum, line) => sum + line.receivedQuantity, 0)
  const receivedValue = lines.reduce((sum, line) => sum + line.receivedQuantity * line.unitCostCents, 0)
  const partById = new Map(parts.map(part => [part.id, part]))
  const reasons = {
    update: blockedBy('update', order.status),
    order: blockedBy('order', order.status),
    receive: blockedBy('receive', order.status),
    close: blockedBy('close', order.status),
    cancel: blockedBy('cancel', order.status),
  }

  const openConfirm = (action: ConfirmAction) => {
    setConfirmError(null)
    setConfirm({ action, key: `parts-desk:po-${action}:${crypto.randomUUID()}` })
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    setConfirmError(null)
    const response = await managePurchaseOrder({ action: confirm.action, purchaseOrderId: order.id, expectedUpdatedAt: order.updatedAt, idempotencyKey: confirm.key })
    setBusy(false)
    if (!response.success) {
      setConfirmError(response.error)
      if (response.rejected) setConfirm(current => (current ? { ...current, key: `parts-desk:po-${current.action}:${crypto.randomUUID()}` } : null))
      return
    }
    setNotice(CONFIRM[confirm.action].done)
    setConfirm(null)
    await load()
  }

  const primary = !reasons.receive ? 'receive' : !reasons.order ? 'order' : null

  const header = (
    <DeskHeader
      eyebrow={order.rooftop?.name || undefined}
      title={<><span className="font-mono">{order.reference}</span> <span className="font-normal">{order.supplier}</span></>}
      tone={PO_STATUS_TONE[order.status] || 'idle'}
      status={PO_STATUS_LABEL[order.status] || order.status}
      meta={`${PO_STATUS_LABEL[order.status] || order.status} · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${received}/${ordered} received`}
      actions={
        <Track>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/parts/purchase-orders`}><ArrowLeft />Purchase orders</Link>
          </Pill>
          <Pill onClick={load} disabled={loading} className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  const actions: Array<{ key: string; label: string; reason: string | null; onClick: () => void; primary?: boolean; danger?: boolean; icon?: ReactNode }> = [
    { key: 'update', label: 'Edit draft', reason: reasons.update, onClick: () => setEditing(true), icon: <Pencil /> },
    { key: 'order', label: 'Place order', reason: reasons.order, onClick: () => openConfirm('order'), primary: primary === 'order' },
    { key: 'receive', label: 'Receive', reason: reasons.receive, onClick: () => setReceiving(true), primary: primary === 'receive' },
    { key: 'close', label: 'Close short', reason: reasons.close, onClick: () => openConfirm('close') },
    { key: 'cancel', label: 'Cancel PO', reason: reasons.cancel, onClick: () => openConfirm('cancel') },
  ]
  const terminal = order.status === 'received' || order.status === 'cancelled'

  return (
    <PageContainer title={order.reference} header={header} breadcrumbs={breadcrumbs}>
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
          <Readout label="Total" value={formatCents(poTotalCents(order))} />
          <Readout label="Received" value={`${received}/${ordered}`} sub="units" tone={received >= ordered && ordered > 0 ? 'ok' : received > 0 ? 'warn' : undefined} />
          <Readout label="Received at cost" value={formatCents(receivedValue)} />
          <Readout label="Lines" value={lines.length} />
        </ReadoutStrip>

        <DeskSection title="Actions">
          {terminal ? (
            <p className="text-sm text-muted-foreground">{PO_STATUS_LABEL[order.status]}</p>
          ) : (
            <Track className="flex-wrap rounded-2xl">
              {actions.filter(action => !action.reason).map(action => (
                <Pill key={action.key} variant={action.primary ? 'primary' : 'raised'} className="h-11 sm:h-8" onClick={action.onClick}>
                  {action.icon}
                  {action.label}
                </Pill>
              ))}
            </Track>
          )}
        </DeskSection>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <DeskSection title="Lines" count={lines.length}>
            {lines.length === 0 ? (
              <Panel className="px-4 py-10 text-center text-sm text-muted-foreground">No lines</Panel>
            ) : (
              <Panel className="divide-y">
                {lines.map(line => {
                  const part = partById.get(line.partId)
                  const outstanding = Math.max(0, line.quantity - line.receivedQuantity)
                  const tone = line.receivedQuantity >= line.quantity ? 'ok' : line.receivedQuantity > 0 ? 'warn' : order.status === 'draft' || order.status === 'cancelled' ? 'idle' : 'info'
                  return (
                    <div key={line.partId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3">
                      <TitleLine as="p" tone={tone} className="text-sm font-medium">
                        {part ? (
                          <Link href={`${basePath}/platform/parts/${line.partId}`} className="font-mono hover:underline">{line.partNumber}</Link>
                        ) : (
                          <span className="font-mono">{line.partNumber || line.partId}</span>
                        )}
                        <span className="ml-2 font-normal">{line.description}</span>
                      </TitleLine>
                      <p className="text-right font-mono text-sm tabular-nums">{formatCents(line.quantity * line.unitCostCents)}</p>
                      <p className="col-span-2 pl-4 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {line.quantity} × {formatCents(line.unitCostCents)} · Received {line.receivedQuantity}
                        {order.status !== 'draft' && order.status !== 'cancelled' && outstanding > 0 ? ` · Outstanding ${outstanding}` : ''}
                        {part ? ` · On hand ${part.quantity ?? 0}` : ''}
                        {part?.binLocation ? <> · Bin <Code>{part.binLocation}</Code></> : null}
                      </p>
                    </div>
                  )
                })}
              </Panel>
            )}
          </DeskSection>

          <DeskSection title="Details">
            <Facts
              items={[
                { label: 'Status', value: PO_STATUS_LABEL[order.status] || order.status },
                { label: 'Supplier', value: order.supplier },
                { label: 'Created', value: formatDateTime(order.createdAt, timeZone) },
                { label: 'Ordered', value: formatDateTime(order.orderedAt, timeZone) },
                { label: 'Received', value: formatDateTime(order.receivedAt, timeZone) },
                order.rooftop?.name ? { label: 'Rooftop', value: order.rooftop.name } : null,
              ]}
            />
          </DeskSection>
        </div>

        <Dialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null) }}>
          <DialogContent className="sm:max-w-md">
            {confirm && (
              <>
                <DialogHeader>
                  <DialogTitle>{CONFIRM[confirm.action].title} · {order.reference}</DialogTitle>
                  <DialogDescription>{CONFIRM[confirm.action].description}</DialogDescription>
                </DialogHeader>
                {confirmError && <Notice tone="bad">{confirmError}</Notice>}
                <DialogFooter className="sm:justify-end">
                  <Track>
                    <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => setConfirm(null)}>Back</Pill>
                    <Pill variant={confirm.action === 'cancel' ? 'danger' : 'primary'} className="h-11 sm:h-8" disabled={busy} onClick={runConfirm}>
                      {busy ? 'Saving…' : CONFIRM[confirm.action].label}
                    </Pill>
                  </Track>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <PurchaseOrderFormDialog
          open={editing}
          order={order}
          parts={parts}
          rooftops={order.rooftop ? [order.rooftop] : []}
          onOpenChange={setEditing}
          onSaved={async () => {
            setEditing(false)
            setNotice('Draft saved')
            await load()
          }}
        />
        <ReceivePurchaseOrderDialog
          open={receiving}
          order={order}
          onOpenChange={setReceiving}
          onSaved={async status => {
            setReceiving(false)
            setNotice(status === 'received' ? 'Purchase order received' : 'Receipt posted; purchase order partially received')
            await load()
          }}
        />
      </div>
    </PageContainer>
  )
}
