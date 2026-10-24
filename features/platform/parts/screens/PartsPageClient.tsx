'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Pencil, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'

import { getPartsCatalog } from '../actions'
import { PartFormDialog } from '../components/PartFormDialog'
import { STOCK_LABEL, STOCK_TONE, available, formatCents, stockState, type Part, type PartsRooftop } from '../lib/types'

type StockFilter = 'all' | 'low' | 'out' | 'on-order'

function matchesFilter(part: Part, filter: StockFilter) {
  if (filter === 'low') return stockState(part) === 'low'
  if (filter === 'out') return stockState(part) === 'out'
  if (filter === 'on-order') return Number(part.onOrderQuantity || 0) > 0
  return true
}

function Figure({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' | 'bad' }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

export function PartsPageClient({
  initialParts,
  initialRooftops,
  initialError,
}: {
  initialParts: Part[]
  initialRooftops: PartsRooftop[]
  initialError: string | null
}) {
  const [parts, setParts] = useState(initialParts)
  const [rooftops, setRooftops] = useState(initialRooftops)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<StockFilter>('all')
  const [search, setSearch] = useState('')
  const [rooftopId, setRooftopId] = useState('all')
  const [editing, setEditing] = useState<{ part: Part | null } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await getPartsCatalog()
    if (response.success) {
      setParts(response.data.partsInventories || [])
      setRooftops(response.data.rooftops || [])
      setError(null)
    } else {
      setError(response.error)
    }
    setLoading(false)
  }

  const scoped = useMemo(() => (rooftopId === 'all' ? parts : parts.filter(part => part.rooftop?.id === rooftopId)), [parts, rooftopId])
  const counts = useMemo(() => ({
    all: scoped.length,
    low: scoped.filter(part => stockState(part) === 'low').length,
    out: scoped.filter(part => stockState(part) === 'out').length,
    onOrder: scoped.filter(part => Number(part.onOrderQuantity || 0) > 0).length,
  }), [scoped])
  const totals = useMemo(() => ({
    value: scoped.reduce((sum, part) => sum + Number(part.quantity || 0) * Number(part.costCents || 0), 0),
    committed: scoped.reduce((sum, part) => sum + Number(part.committedQuantity || 0), 0),
    onOrder: scoped.reduce((sum, part) => sum + Number(part.onOrderQuantity || 0), 0),
  }), [scoped])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return scoped.filter(part => matchesFilter(part, filter)).filter(part =>
      !term || [part.partNumber, part.description, part.binLocation, part.supplier, part.supplierPartNumber].some(value => String(value || '').toLowerCase().includes(term)),
    )
  }, [scoped, filter, search])

  const dialogRooftops = useMemo(() => (rooftopId !== 'all' ? rooftops.filter(rooftop => rooftop.id === rooftopId) : rooftops), [rooftops, rooftopId])
  const isFiltered = filter !== 'all' || Boolean(search.trim())
  const multiRooftop = rooftops.length > 1

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Parts' },
  ]

  const header = (
    <DeskHeader
      title="Parts"
      tone={error ? 'bad' : counts.out ? 'bad' : counts.low ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${counts.out} out of stock, ${counts.low} low`}
      meta={`${counts.all} parts · ${counts.low} low · ${counts.out} out · ${counts.onOrder} on order`}
      actions={
        <Track>
          <Pill onClick={load} disabled={loading} className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/parts/purchase-orders`}>
              <ClipboardList />
              Purchase orders
            </Link>
          </Pill>
          <Pill variant="primary" className="h-11 sm:h-8" onClick={() => setEditing({ part: null })} disabled={!rooftops.length} title={rooftops.length ? undefined : 'No rooftop available'}>
            <Plus />
            New part
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Parts" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}

        <ReadoutStrip>
          <Readout label="Parts" value={counts.all} />
          <Readout label="Low stock" value={counts.low} tone={counts.low ? 'warn' : undefined} />
          <Readout label="Out of stock" value={counts.out} tone={counts.out ? 'bad' : undefined} />
          <Readout label="Committed" value={totals.committed} sub="units" />
          <Readout label="On order" value={totals.onOrder} sub="units" />
          <Readout label="Stock at cost" value={formatCents(totals.value)} />
        </ReadoutStrip>

        <Segmented<StockFilter>
          label="Filter parts"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'low', label: 'Low stock', count: counts.low, tone: 'warn' },
            { value: 'out', label: 'Out of stock', count: counts.out, tone: 'bad' },
            { value: 'on-order', label: 'On order', count: counts.onOrder, tone: 'info' },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9 sm:h-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Part number, description, bin or supplier" aria-label="Search parts" />
          </div>
          {multiRooftop && (
            <Select value={rooftopId} onValueChange={setRooftopId}>
              <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[200px]" aria-label="Rooftop">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rooftops</SelectItem>
                {rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name || rooftop.id}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {loading && <span className="text-xs text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Parts unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={load}>Retry</Pill></Track>
          </Notice>
        ) : visible.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{scoped.length && isFiltered ? 'No matching parts' : 'No parts'}</p>
            <Track>
              {scoped.length > 0 && isFiltered ? (
                <Pill size="sm" onClick={() => { setFilter('all'); setSearch('') }}>Reset filters</Pill>
              ) : (
                <Pill size="sm" variant="primary" onClick={() => setEditing({ part: null })} disabled={!rooftops.length}>
                  <Plus />
                  New part
                </Pill>
              )}
            </Track>
          </Panel>
        ) : (
          <Panel className="divide-y">
            {visible.map(part => {
              const state = stockState(part)
              const reorder = Number(part.minimumQuantity || 0)
              return (
                <div key={part.id} className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_auto] md:items-center">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={STOCK_TONE[state]} status={STOCK_LABEL[state]} className="text-sm font-medium">
                      <Link href={`${basePath}/platform/parts/${part.id}`} className="font-mono hover:underline">{part.partNumber}</Link>
                      <span className="ml-2 font-normal text-foreground">{part.description}</span>
                    </TitleLine>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {STOCK_LABEL[state]}
                      {part.binLocation ? <> · Bin <Code>{part.binLocation}</Code></> : ' · No bin'}
                      {part.supplier ? ` · ${part.supplier}` : ''}
                      {` · ${formatCents(part.priceCents)}`}
                      {multiRooftop && part.rooftop?.name ? ` · ${part.rooftop.name}` : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 pl-4 md:pl-0">
                    <Figure label="On hand" value={part.quantity ?? 0} />
                    <Figure label="Commit" value={part.committedQuantity ?? 0} />
                    <Figure label="Avail" value={available(part)} tone={state === 'out' ? 'bad' : state === 'low' ? 'warn' : undefined} />
                    <Figure label="Order" value={part.onOrderQuantity ?? 0} />
                    <Figure label="Reorder" value={reorder || '-'} />
                  </div>
                  <div className="flex justify-end">
                    <Track>
                      <Pill size="sm" className="h-11 sm:h-7" onClick={() => setEditing({ part })} aria-label={`Edit ${part.partNumber}`}>
                        <Pencil />
                        Edit
                      </Pill>
                      <Pill size="sm" className="h-11 sm:h-7" asChild>
                        <Link href={`${basePath}/platform/parts/${part.id}`}>Ledger</Link>
                      </Pill>
                    </Track>
                  </div>
                </div>
              )
            })}
          </Panel>
        )}

        <PartFormDialog
          open={Boolean(editing)}
          part={editing?.part || null}
          rooftops={dialogRooftops}
          onOpenChange={open => { if (!open) setEditing(null) }}
          onSaved={async () => {
            setNotice(editing?.part ? 'Part saved' : 'Part created')
            setEditing(null)
            await load()
          }}
        />
      </div>
    </PageContainer>
  )
}
