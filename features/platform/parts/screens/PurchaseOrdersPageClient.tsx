'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'

import { getPurchaseOrders } from '../actions'
import { PurchaseOrderFormDialog } from '../components/PurchaseOrderFormDialog'
import { PO_STATUS_LABEL, PO_STATUS_TONE, formatCents, formatDateTime, poLines, poTotalCents, stockState, type Part, type PartsRooftop, type PurchaseOrder } from '../lib/types'

type StatusFilter = 'open' | 'draft' | 'ordered' | 'partially-received' | 'received' | 'cancelled' | 'all'
const OPEN_STATUSES = ['draft', 'ordered', 'partially-received']

export function PurchaseOrdersPageClient({
  initialOrders,
  initialParts,
  initialRooftops,
  initialError,
  timeZone,
}: {
  initialOrders: PurchaseOrder[]
  initialParts: Part[]
  initialRooftops: PartsRooftop[]
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [parts, setParts] = useState(initialParts)
  const [rooftops, setRooftops] = useState(initialRooftops)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState<{ partIds: string[] } | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await getPurchaseOrders()
    if (response.success) {
      setOrders(response.data.partsPurchaseOrders || [])
      setParts(response.data.partsInventories || [])
      setRooftops(response.data.rooftops || [])
      setError(null)
    } else {
      setError(response.error)
    }
    setLoading(false)
  }

  const counts = useMemo(() => {
    const by = (status: string) => orders.filter(order => order.status === status).length
    return {
      open: orders.filter(order => OPEN_STATUSES.includes(order.status)).length,
      draft: by('draft'),
      ordered: by('ordered'),
      partial: by('partially-received'),
      received: by('received'),
      cancelled: by('cancelled'),
      all: orders.length,
    }
  }, [orders])
  const openValue = useMemo(() => orders.filter(order => ['ordered', 'partially-received'].includes(order.status)).reduce((sum, order) => sum + poLines(order).reduce((lineSum, line) => lineSum + Math.max(0, line.quantity - line.receivedQuantity) * line.unitCostCents, 0), 0), [orders])
  const reorderParts = useMemo(() => parts.filter(part => stockState(part) !== 'ok' && Number(part.onOrderQuantity || 0) === 0), [parts])
  const reorderRooftop = reorderParts[0]?.rooftop?.id
  const reorderIds = reorderParts.filter(part => part.rooftop?.id === reorderRooftop).map(part => part.id)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders
      .filter(order => (filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(order.status) : order.status === filter))
      .filter(order => !term || [order.reference, order.supplier, ...poLines(order).map(line => line.partNumber)].some(value => value.toLowerCase().includes(term)))
  }, [orders, filter, search])

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: 'Parts', href: `${basePath}/platform/parts` },
    { type: 'page' as const, label: 'Purchase orders' },
  ]

  const header = (
    <DeskHeader
      title="Purchase orders"
      tone={error ? 'bad' : counts.partial ? 'warn' : counts.ordered ? 'info' : 'idle'}
      status={error ? 'Unavailable' : `${counts.open} open`}
      meta={`${counts.draft} draft · ${counts.ordered} ordered · ${counts.partial} partially received`}
      actions={
        <Track>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/parts`}><ArrowLeft />Parts</Link>
          </Pill>
          <Pill onClick={load} disabled={loading} className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill className="h-11 sm:h-8" onClick={() => setCreating({ partIds: reorderIds })} disabled={!reorderIds.length} title={reorderIds.length ? undefined : 'No low-stock parts without an order'}>
            Reorder low stock
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{reorderIds.length}</span>
          </Pill>
          <Pill variant="primary" className="h-11 sm:h-8" onClick={() => setCreating({ partIds: [] })} disabled={!parts.length} title={parts.length ? undefined : 'Create a part first'}>
            <Plus />
            New PO
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Purchase orders" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        <ReadoutStrip>
          <Readout label="Open" value={counts.open} />
          <Readout label="Ordered" value={counts.ordered} tone={counts.ordered ? 'info' : undefined} />
          <Readout label="Partially received" value={counts.partial} tone={counts.partial ? 'warn' : undefined} />
          <Readout label="Outstanding at cost" value={formatCents(openValue)} />
        </ReadoutStrip>

        <Segmented<StatusFilter>
          label="Filter purchase orders"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'draft', label: 'Draft', count: counts.draft },
            { value: 'ordered', label: 'Ordered', count: counts.ordered },
            { value: 'partially-received', label: 'Partial', count: counts.partial },
            { value: 'received', label: 'Received', count: counts.received },
            { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9 sm:h-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference, supplier or part number" aria-label="Search purchase orders" />
          </div>
          {loading && <span className="text-xs text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Purchase orders unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={load}>Retry</Pill></Track>
          </Notice>
        ) : visible.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{orders.length && (filter !== 'all' || search.trim()) ? 'No matching purchase orders' : 'No purchase orders'}</p>
            {orders.length > 0 && (filter !== 'all' || search.trim()) && (
              <Track><Pill size="sm" onClick={() => { setFilter('all'); setSearch('') }}>Reset filters</Pill></Track>
            )}
          </Panel>
        ) : (
          <Panel className="divide-y">
            {visible.map(order => {
              const lines = poLines(order)
              const ordered = lines.reduce((sum, line) => sum + line.quantity, 0)
              const received = lines.reduce((sum, line) => sum + line.receivedQuantity, 0)
              return (
                <Link key={order.id} href={`${basePath}/platform/parts/purchase-orders/${order.id}`} className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/40">
                  <TitleLine as="p" tone={PO_STATUS_TONE[order.status] || 'idle'} status={PO_STATUS_LABEL[order.status]} className="text-sm font-medium">
                    <span className="font-mono">{order.reference}</span>
                    <span className="ml-2 font-normal">{order.supplier}</span>
                  </TitleLine>
                  <p className="text-right font-mono text-sm tabular-nums">{formatCents(poTotalCents(order))}</p>
                  <p className="col-span-2 break-words pl-4 text-xs text-muted-foreground">
                    {PO_STATUS_LABEL[order.status] || order.status}
                    {` · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}
                    {order.status !== 'draft' && order.status !== 'cancelled' ? ` · ${received}/${ordered} received` : ''}
                    {order.orderedAt ? ` · Ordered ${formatDateTime(order.orderedAt, timeZone)}` : ` · Created ${formatDateTime(order.createdAt, timeZone)}`}
                    {rooftops.length > 1 && order.rooftop?.name ? ` · ${order.rooftop.name}` : ''}
                  </p>
                </Link>
              )
            })}
          </Panel>
        )}

        <PurchaseOrderFormDialog
          open={Boolean(creating)}
          order={null}
          parts={parts}
          rooftops={rooftops}
          initialPartIds={creating?.partIds}
          onOpenChange={open => { if (!open) setCreating(null) }}
          onSaved={id => {
            setCreating(null)
            router.push(`${basePath}/platform/parts/purchase-orders/${id}`)
          }}
        />
      </div>
    </PageContainer>
  )
}
