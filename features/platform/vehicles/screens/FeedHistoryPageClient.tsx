'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronRight, FileOutput, RefreshCw, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { getInventoryWorkspace, recordInventoryFeedRun, type InventoryVehicle } from '../actions'
import { getFeedHistory, recordMarketplaceExport, type FeedRun } from '../actions/feed'
import { selectPublicFeedRunCandidates } from '../lib/publicFeedCandidates'
import {
  normalizePublicFeedRunResult,
  publicFeedRunResultMessage,
  resolvePublicFeedRunAttempt,
  UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE,
  type PublicFeedRunAttempt,
} from '../lib/publicFeedRunOutcome'
import { feedChannelLabels, feedStatusLabels, feedStatusTones, formatDateTime } from '../lib/inventoryLabels'

type StatusFilter = 'all' | 'succeeded' | 'partial' | 'failed'
type ExportRow = { included: boolean; error: string }

const VEHICLES_HREF = `${basePath}/platform/vehicles`
const runStatusTones: Record<string, DeskTone> = { succeeded: 'ok', partial: 'warn', failed: 'bad' }
const runStatusLabels: Record<string, string> = { succeeded: 'Succeeded', partial: 'Partial', failed: 'Failed' }

export function FeedHistoryPageClient({
  initialRuns,
  initialCounts,
  initialVehicles,
  initialError,
  timeZone,
}: {
  initialRuns: FeedRun[]
  initialCounts: Record<string, number> | null
  initialVehicles: InventoryVehicle[]
  initialError: string | null
  timeZone: string
}) {
  const [runs, setRuns] = useState(initialRuns)
  const [counts, setCounts] = useState(initialCounts)
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [channel, setChannel] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: DeskTone } | null>(null)
  const [pendingFeedRun, setPendingFeedRun] = useState<PublicFeedRunAttempt | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportRows, setExportRows] = useState<Record<string, ExportRow>>({})
  const [exportKey, setExportKey] = useState('')
  const [exportReference, setExportReference] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const firstRun = useRef(true)

  const load = async (nextStatus = status, nextChannel = channel) => {
    setLoading(true)
    const [history, workspace] = await Promise.all([getFeedHistory(nextStatus, nextChannel), getInventoryWorkspace('all')])
    if (history.success) {
      setRuns(history.runs)
      setCounts(history.counts)
      setError(null)
    } else {
      setError(history.error)
    }
    if (workspace.success) setVehicles(workspace.vehicles)
    setLoading(false)
  }

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    void load(status, channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, channel])

  const candidates = selectPublicFeedRunCandidates(vehicles)
  const liveCount = vehicles.filter(vehicle => vehicle.publicListing.live).length
  const exportable = vehicles.filter(vehicle => ['available', 'service'].includes(vehicle.status))
  const lastRun = runs[0]

  const publish = async () => {
    const attempt = resolvePublicFeedRunAttempt(pendingFeedRun, candidates.map(vehicle => vehicle.inventoryStockId), () => `public-feed:${crypto.randomUUID()}`)
    if (!attempt) {
      setMessage({ text: 'No vehicles are ready to publish.', tone: 'idle' })
      return
    }
    setPendingFeedRun(attempt)
    setBusy('publish')
    setMessage(null)
    try {
      const response = await recordInventoryFeedRun({ channelKey: 'public-inventory-feed', stockIds: attempt.stockIds, errors: [], idempotencyKey: attempt.idempotencyKey })
      if (!response.success && response.rejected) {
        setPendingFeedRun(null)
        setMessage({ text: response.error, tone: 'bad' })
        return
      }
      const result = response.success ? normalizePublicFeedRunResult(response.data.recordInventoryFeedRun, attempt.stockIds.length) : null
      if (!result) {
        setMessage({ text: UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, tone: 'warn' })
        return
      }
      setPendingFeedRun(null)
      setMessage({ text: publicFeedRunResultMessage(result), tone: result.failedCount ? 'warn' : 'ok' })
    } catch {
      setMessage({ text: UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, tone: 'warn' })
    } finally {
      await load()
      setBusy(null)
    }
  }

  const openExport = () => {
    setExportRows(Object.fromEntries(exportable.map(vehicle => [vehicle.inventoryStockId, { included: vehicle.publicListing.live, error: '' }])))
    setExportKey(`marketplace-export:${crypto.randomUUID()}`)
    setExportReference('')
    setExportError(null)
    setMessage(null)
    setExportOpen(true)
  }

  const submitExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const included = exportable.filter(vehicle => exportRows[vehicle.inventoryStockId]?.included)
    if (!included.length) {
      setExportError('Select at least one unit')
      return
    }
    const errors = included.flatMap(vehicle => {
      const text = exportRows[vehicle.inventoryStockId]?.error.trim()
      return text ? [{ stockId: vehicle.inventoryStockId, errorCode: 'marketplace-rejected', message: text.slice(0, 1000), rowReference: exportReference.trim().slice(0, 200) || undefined }] : []
    })
    setBusy('export')
    setExportError(null)
    try {
      const response = await recordMarketplaceExport({ stockIds: included.map(vehicle => vehicle.inventoryStockId), errors, idempotencyKey: exportKey })
      if (!response.success) {
        setExportError(response.error)
        return
      }
      const run = response.data.recordInventoryFeedRun
      setExportOpen(false)
      setMessage({ text: `Export recorded: ${run.attemptedCount} units, ${run.failedCount} refused.`, tone: run.failedCount ? 'warn' : 'ok' })
      await load()
    } catch {
      setExportError('Unable to confirm the export was recorded. Retry to finish.')
    } finally {
      setBusy(null)
    }
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Inventory', href: VEHICLES_HREF },
    { type: 'page' as const, label: 'Feed' },
  ]
  const header = (
    <DeskHeader
      eyebrow={<Link href={VEHICLES_HREF} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground sm:min-h-0"><ArrowLeft className="size-3" /> Inventory</Link>}
      title="Feed"
      tone={error ? 'bad' : lastRun ? runStatusTones[lastRun.status] : 'idle'}
      status={error ? 'Unavailable' : lastRun ? `Last run ${runStatusLabels[lastRun.status]}` : 'No runs'}
      meta={`${liveCount} live · ${candidates.length} ready to publish`}
      actions={
        <Track>
          <Pill onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /><span className="max-sm:sr-only">Refresh</span></Pill>
          <Pill onClick={openExport} disabled={Boolean(busy) || !exportable.length} title={exportable.length ? undefined : 'No active units'}><FileOutput /> Record export</Pill>
          <Pill variant="primary" onClick={publish} disabled={Boolean(busy) || (!candidates.length && !pendingFeedRun)} title={candidates.length || pendingFeedRun ? undefined : 'No vehicles ready'}>
            <Upload /> {pendingFeedRun ? 'Retry publishing' : 'Publish feed'}
          </Pill>
        </Track>
      }
    />
  )

  const statusOptions = [
    { value: 'all' as StatusFilter, label: 'All', count: counts?.all },
    { value: 'succeeded' as StatusFilter, label: 'Succeeded', count: counts?.succeeded, tone: 'ok' as DeskTone },
    { value: 'partial' as StatusFilter, label: 'Partial', count: counts?.partial, tone: 'warn' as DeskTone },
    { value: 'failed' as StatusFilter, label: 'Failed', count: counts?.failed, tone: 'bad' as DeskTone },
  ]

  return (
    <PageContainer title="Feed" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {!candidates.length && !pendingFeedRun && <Notice tone="idle">Publish feed: no units are frontline with recon done and an approved listing.</Notice>}

        <ReadoutStrip>
          <Readout label="Live" value={liveCount} tone={liveCount ? 'ok' : 'idle'} />
          <Readout label="Ready to publish" value={candidates.length} />
          <Readout label="Runs" value={counts?.all ?? '-'} />
          <Readout label="Failed runs" value={counts ? (counts.failed || 0) + (counts.partial || 0) : '-'} tone={counts && (counts.failed || counts.partial) ? 'warn' : 'idle'} />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Segmented label="Filter by result" value={status} onChange={setStatus} options={statusOptions} className="self-start" />
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-full rounded-full max-sm:h-11 sm:w-[220px]" aria-label="Channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {Object.entries(feedChannelLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <DeskSection title="Runs" count={loading || error ? undefined : runs.length}>
          {loading && runs.length === 0 ? (
            <div className="flex justify-center py-12" role="status"><RefreshCw className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /><span className="sr-only">Loading feed runs</span></div>
          ) : error ? (
            <Notice tone="bad">
              <p className="font-medium">Unable to load feed runs</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
              <Track className="mt-2"><Pill size="sm" onClick={() => void load()}>Retry</Pill></Track>
            </Notice>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">{status !== 'all' || channel !== 'all' ? 'No matches' : 'No feed runs'}</p>
              {(status !== 'all' || channel !== 'all') && <Track><Pill size="sm" onClick={() => { setStatus('all'); setChannel('all') }}>Reset filters</Pill></Track>}
            </div>
          ) : (
            <Panel className="divide-y">
              {runs.map(run => {
                const open = expanded === run.id
                return (
                  <div key={run.id} className="min-w-0 px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <TitleLine tone={runStatusTones[run.status]} status={runStatusLabels[run.status]} className="text-sm font-medium">
                          {feedChannelLabels[run.channelKey] || run.channelKey}
                          <span className="font-normal text-muted-foreground"> · {runStatusLabels[run.status] || run.status}</span>
                        </TitleLine>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
                          <span>{formatDateTime(run.completedAt, timeZone)}</span>
                          {run.recordedBy?.name && <span>· {run.recordedBy.name}</span>}
                        </p>
                      </div>
                      <p className="pl-4 font-mono text-xs tabular-nums text-muted-foreground md:pl-0">
                        {run.attemptedCount} sent · {run.succeededCount} ok · <span className={run.failedCount ? 'text-red-600 dark:text-red-400' : undefined}>{run.failedCount} failed</span>
                      </p>
                    </div>
                    {run.errors.length > 0 && (
                      <div className="mt-2 pl-4">
                        <Track>
                          <Pill size="sm" variant={open ? undefined : 'plain'} aria-expanded={open} onClick={() => setExpanded(open ? null : run.id)}>
                            {open ? <ChevronDown /> : <ChevronRight />} {run.errors.length} {run.errors.length === 1 ? 'error' : 'errors'}
                          </Pill>
                        </Track>
                        {open && (
                          <ul className="mt-2 divide-y rounded-lg border">
                            {run.errors.map(item => (
                              <li key={item.id} className="min-w-0 px-3 py-2 text-sm">
                                <p className="flex flex-wrap items-baseline gap-x-2">
                                  <Code className="text-foreground">{item.errorCode}</Code>
                                  {item.stock?.vehicle ? (
                                    <Link href={`${VEHICLES_HREF}/${item.stock.vehicle.id}`} className="hover:underline">
                                      {item.stock.stockNumber} · {item.stock.vehicle.year} {item.stock.vehicle.make} {item.stock.vehicle.model}
                                    </Link>
                                  ) : <span className="text-muted-foreground">Whole run</span>}
                                  {item.rowReference && <Code>{item.rowReference}</Code>}
                                </p>
                                <p className="break-words text-xs text-muted-foreground">{item.message}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Panel>
          )}
        </DeskSection>

        <DeskSection title="Feed status by unit" count={exportable.length}>
          {exportable.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No active units</p> : (
            <Panel className="divide-y">
              {exportable.map(vehicle => (
                <div key={vehicle.inventoryStockId} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <TitleLine as="span" tone={feedStatusTones[vehicle.feedStatus]} status={feedStatusLabels[vehicle.feedStatus]}>
                    <Link href={`${VEHICLES_HREF}/${vehicle.id}`} className="hover:underline">{vehicle.stockNumber} · {vehicle.year} {vehicle.make} {vehicle.model}</Link>
                  </TitleLine>
                  <span className="pl-4 text-xs text-muted-foreground">
                    {feedStatusLabels[vehicle.feedStatus] || vehicle.feedStatus} · {vehicle.publicListing.live ? <span className="text-emerald-700 dark:text-emerald-400">Live</span> : `Not live: ${vehicle.publicListing.reason || 'Not available'}`}
                  </span>
                </div>
              ))}
            </Panel>
          )}
        </DeskSection>

        <Dialog open={exportOpen} onOpenChange={open => { if (!open && busy !== 'export') setExportOpen(false) }}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Record marketplace export</DialogTitle>
              <DialogDescription>Units sent and any the marketplace refused</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitExport} className="space-y-4">
              <label htmlFor="export-reference" className="grid gap-1.5 text-sm">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Export file or batch reference</span>
                <Input id="export-reference" maxLength={200} value={exportReference} onChange={event => setExportReference(event.target.value)} className="max-sm:h-11" />
              </label>
              <ul className="divide-y rounded-lg border">
                {exportable.map(vehicle => {
                  const row = exportRows[vehicle.inventoryStockId] || { included: false, error: '' }
                  const update = (patch: Partial<ExportRow>) => setExportRows(current => ({ ...current, [vehicle.inventoryStockId]: { ...row, ...patch } }))
                  return (
                    <li key={vehicle.inventoryStockId} className="grid gap-2 px-3 py-2">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4" checked={row.included} disabled={busy === 'export'} onChange={event => update({ included: event.target.checked })} />
                        <span className="min-w-0 break-words">{vehicle.stockNumber} · {vehicle.year} {vehicle.make} {vehicle.model}</span>
                      </label>
                      {row.included && (
                        <Input aria-label={`Refusal reason for ${vehicle.stockNumber}`} placeholder="Refused? Enter the marketplace error" maxLength={1000} value={row.error} disabled={busy === 'export'} onChange={event => update({ error: event.target.value })} className="max-sm:h-11" />
                      )}
                    </li>
                  )
                })}
              </ul>
              {exportError && <Notice tone="bad">{exportError}</Notice>}
              <DialogFooter className="sm:justify-end">
                <Track>
                  <Pill variant="plain" className="max-sm:h-11" disabled={busy === 'export'} onClick={() => setExportOpen(false)}>Cancel</Pill>
                  <Pill type="submit" variant="primary" className="max-sm:h-11" disabled={busy === 'export'}>{busy === 'export' ? 'Saving…' : 'Record export'}</Pill>
                </Track>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  )
}
