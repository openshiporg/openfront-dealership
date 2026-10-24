'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { transitionInventoryAcquisition } from '../actions'
import { getAcquisitions, receiveAcquisitionIntoStock, startInventoryAcquisition, type AcquisitionRow } from '../actions/acquisitions'
import { InventoryFormDialog, type FieldErrors, type InventoryFormField } from '../components/InventoryFormDialog'
import {
  ACQUISITION_NEXT,
  ACQUISITION_SOURCES,
  ACQUISITION_STATUSES,
  CONDITIONS,
  VIN_PATTERN,
  acquisitionActionLabels,
  acquisitionSourceLabels,
  acquisitionStatusLabels,
  acquisitionStatusTones,
  conditionLabels,
  formatDate,
  formatDateTime,
  formatMoneyCents,
  personName,
} from '../lib/inventoryLabels'

type Filter = 'active' | 'all' | typeof ACQUISITION_STATUSES[number]
type DialogKind = 'start' | 'purchase' | 'stock' | 'cancel'
type DialogState = { kind: DialogKind; acquisition: AcquisitionRow | null; idempotencyKey: string }

const VEHICLES_HREF = `${basePath}/platform/vehicles`
const ACTIVE = ['appraised', 'approved', 'purchased', 'arrived', 'reconditioning']

/** The single step this acquisition is waiting on, gated the way transitionInventoryAcquisition gates it. */
function nextAction(row: AcquisitionRow): { kind: 'transition' | 'purchase' | 'stock' | 'open'; label: string; toStatus?: string } | null {
  if (row.status === 'appraised') return { kind: 'transition', label: acquisitionActionLabels.approved, toStatus: 'approved' }
  if (row.status === 'approved') return { kind: 'purchase', label: acquisitionActionLabels.purchased }
  if (row.status === 'purchased') return { kind: 'transition', label: acquisitionActionLabels.arrived, toStatus: 'arrived' }
  if (row.status === 'arrived' && !row.stock) return { kind: 'stock', label: 'Stock unit' }
  if (row.status === 'arrived') return { kind: 'transition', label: acquisitionActionLabels.reconditioning, toStatus: 'reconditioning' }
  if (row.status === 'reconditioning' && !row.stock) return { kind: 'stock', label: 'Stock unit' }
  if (row.vehicle) return { kind: 'open', label: 'Open vehicle' }
  return null
}

export function AcquisitionsPageClient({
  initialAcquisitions,
  initialCounts,
  initialRooftops,
  initialError,
  timeZone,
  currencyCode,
}: {
  initialAcquisitions: AcquisitionRow[]
  initialCounts: Record<string, number> | null
  initialRooftops: Array<{ id: string; name: string }>
  initialError: string | null
  timeZone: string
  currencyCode: string
}) {
  const [rows, setRows] = useState(initialAcquisitions)
  const [counts, setCounts] = useState(initialCounts)
  const [rooftops, setRooftops] = useState(initialRooftops)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: DeskTone } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const firstRun = useRef(true)

  const money = (cents: number | null | undefined) => formatMoneyCents(cents, currencyCode)

  const load = async (nextFilter = filter, nextSearch = search) => {
    setLoading(true)
    const response = await getAcquisitions(nextFilter, nextSearch)
    if (response.success) {
      setRows(response.acquisitions)
      setCounts(response.counts)
      setRooftops(response.rooftops)
      setError(null)
    } else {
      setError(response.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const timer = setTimeout(() => void load(filter, search), search ? 300 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search])

  const selected = rows.find(row => row.id === selectedId) ?? null
  const activeCount = counts ? ACTIVE.reduce((sum, status) => sum + (counts[status] || 0), 0) : undefined
  const allCount = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined
  const filterOptions = [
    { value: 'active' as Filter, label: 'Active', count: activeCount },
    ...ACQUISITION_STATUSES.map(status => ({ value: status as Filter, label: acquisitionStatusLabels[status], count: counts ? counts[status] || 0 : undefined, tone: acquisitionStatusTones[status] })),
    { value: 'all' as Filter, label: 'All', count: allCount },
  ]

  const openDialog = (kind: DialogKind, acquisition: AcquisitionRow | null, initial: Record<string, string>) => {
    setDialog({ kind, acquisition, idempotencyKey: `acquisition-${kind}:${acquisition?.id || 'new'}:${crypto.randomUUID()}` })
    setValues(initial)
    setFieldErrors({})
    setFormError(null)
    setMessage(null)
  }

  const transition = async (row: AcquisitionRow, toStatus: string) => {
    setBusy(row.id)
    setMessage(null)
    try {
      const response = await transitionInventoryAcquisition({ id: row.id, toStatus, expectedUpdatedAt: row.updatedAt, reason: `${acquisitionActionLabels[toStatus] || toStatus} from the acquisitions desk`, idempotencyKey: `acquisition-transition:${row.id}:${crypto.randomUUID()}` })
      setMessage(response.success ? { text: `${row.reference}: ${acquisitionStatusLabels[toStatus] || toStatus}.`, tone: 'ok' } : { text: response.error, tone: 'bad' })
    } catch {
      setMessage({ text: 'Unable to save. Reload to check the current state.', tone: 'bad' })
    } finally {
      await load()
      setBusy(null)
    }
  }

  const runNext = (row: AcquisitionRow) => {
    const action = nextAction(row)
    if (!action) return
    if (action.kind === 'transition' && action.toStatus) return void transition(row, action.toStatus)
    if (action.kind === 'purchase') return openDialog('purchase', row, { purchase: formatCentsForInput(row.appraisalCents), reconEstimate: row.reconEstimateCents == null ? '' : formatCentsForInput(row.reconEstimateCents) })
    if (action.kind === 'stock') return openDialog('stock', row, { stockNumber: '', locationCode: 'INTAKE', condition: 'used', trim: '', exteriorColor: '', interiorColor: '' })
  }

  const submitDialog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dialog) return
    const v = (name: string) => (values[name] || '').trim()
    const errors: FieldErrors = {}
    const cents = (name: string, label: string, required: boolean, positive = false) => {
      if (!v(name)) {
        if (required) errors[name] = `${label} is required`
        return null
      }
      const parsed = parseDollarsToCents(v(name))
      if (parsed == null) errors[name] = 'Enter an amount such as $18,500'
      else if (positive && parsed <= 0) errors[name] = `${label} must be more than zero`
      return parsed
    }
    let work: (() => Promise<{ success: boolean; error?: string }>) | null = null
    let success = 'Saved.'
    const row = dialog.acquisition

    if (dialog.kind === 'start') {
      const rooftopId = v('rooftopId') || rooftops[0]?.id || ''
      if (!rooftopId) errors.rooftopId = 'Choose a rooftop'
      if (!ACQUISITION_SOURCES.includes(v('acquisitionSource') as typeof ACQUISITION_SOURCES[number])) errors.acquisitionSource = 'Choose a source'
      const vin = v('vin').toUpperCase()
      if (!VIN_PATTERN.test(vin)) errors.vin = '17 characters, no I, O or Q'
      const year = Number(v('year'))
      const maxYear = new Date().getFullYear() + 2
      if (!Number.isInteger(year) || year < 1900 || year > maxYear) errors.year = `Between 1900 and ${maxYear}`
      if (!v('make')) errors.make = 'Make is required'
      if (!v('model')) errors.model = 'Model is required'
      const odometer = v('odometer') ? Number(v('odometer').replace(/,/g, '')) : null
      if (odometer != null && (!Number.isSafeInteger(odometer) || odometer < 0)) errors.odometer = 'Whole miles only'
      const appraisalCents = cents('appraisal', 'Appraisal', true)
      const reconEstimateCents = cents('reconEstimate', 'Recon estimate', false)
      if (Object.keys(errors).length === 0) {
        work = () => startInventoryAcquisition({
          rooftopId, acquisitionSource: v('acquisitionSource'), sourceReference: v('sourceReference'), vin, year, make: v('make'), model: v('model'),
          odometer, appraisalCents: appraisalCents!, reconEstimateCents, idempotencyKey: dialog.idempotencyKey,
        })
        success = 'Appraisal recorded.'
      }
    } else if (dialog.kind === 'purchase' && row) {
      const purchaseCents = cents('purchase', 'Purchase amount', true, true)
      const reconEstimateCents = cents('reconEstimate', 'Recon estimate', false)
      if (Object.keys(errors).length === 0) {
        work = () => transitionInventoryAcquisition({ id: row.id, toStatus: 'purchased', purchaseCents, reconEstimateCents, expectedUpdatedAt: row.updatedAt, reason: 'Purchase recorded from the acquisitions desk', idempotencyKey: dialog.idempotencyKey })
        success = `${row.reference}: purchased.`
      }
    } else if (dialog.kind === 'stock' && row) {
      if (!v('stockNumber')) errors.stockNumber = 'Stock number is required'
      else if (v('stockNumber').length > 80) errors.stockNumber = 'At most 80 characters'
      if (!v('locationCode')) errors.locationCode = 'Location is required'
      if (!row.vehicle && !CONDITIONS.includes(v('condition') as typeof CONDITIONS[number])) errors.condition = 'Choose a condition'
      if (Object.keys(errors).length === 0) {
        work = () => receiveAcquisitionIntoStock({
          acquisitionId: row.id, vehicleId: row.vehicle?.id, stockNumber: v('stockNumber').toUpperCase(), locationCode: v('locationCode').toUpperCase(),
          condition: v('condition') || 'used', trim: v('trim'), exteriorColor: v('exteriorColor'), interiorColor: v('interiorColor'), idempotencyKey: dialog.idempotencyKey,
        })
        success = `${row.reference}: stocked as ${v('stockNumber').toUpperCase()}.`
      }
    } else if (dialog.kind === 'cancel' && row) {
      if (!v('reason')) errors.reason = 'Reason is required'
      if (Object.keys(errors).length === 0) {
        work = () => transitionInventoryAcquisition({ id: row.id, toStatus: 'cancelled', expectedUpdatedAt: row.updatedAt, reason: v('reason'), idempotencyKey: dialog.idempotencyKey })
        success = `${row.reference}: cancelled.`
      }
    }

    setFieldErrors(errors)
    if (!work) return
    setBusy('dialog')
    setFormError(null)
    try {
      const response = await work()
      if (!response.success) {
        setFormError(response.error || 'Unable to save.')
        return
      }
      setDialog(null)
      setMessage({ text: success, tone: 'ok' })
      await load()
    } catch {
      setFormError('Unable to save. Your entries are kept so you can retry.')
    } finally {
      setBusy(null)
    }
  }

  const dialogConfig: Record<DialogKind, { title: string; fields: InventoryFormField[]; submitLabel: string }> = {
    start: { title: 'Appraise a unit', submitLabel: 'Record appraisal', fields: [
      ...(rooftops.length > 1 ? [{ name: 'rooftopId', label: 'Rooftop', type: 'select' as const, options: rooftops.map(rooftop => ({ value: rooftop.id, label: rooftop.name })), wide: true }] : []),
      { name: 'acquisitionSource', label: 'Source', type: 'select', options: ACQUISITION_SOURCES.map(value => ({ value, label: acquisitionSourceLabels[value] })) },
      { name: 'sourceReference', label: 'Source reference', maxLength: 200, required: false, placeholder: 'Lot #, seller, trade-in ref' },
      { name: 'vin', label: 'VIN', maxLength: 17, wide: true },
      { name: 'year', label: 'Model year', type: 'number', min: 1900 },
      { name: 'odometer', label: 'Odometer (mi)', type: 'number', min: 0, required: false },
      { name: 'make', label: 'Make', maxLength: 100 },
      { name: 'model', label: 'Model', maxLength: 100 },
      { name: 'appraisal', label: `Appraisal (${currencyCode})`, type: 'money' },
      { name: 'reconEstimate', label: `Recon estimate (${currencyCode})`, type: 'money', required: false },
    ] },
    purchase: { title: 'Record purchase', submitLabel: 'Record purchase', fields: [
      { name: 'purchase', label: `Purchase amount (${currencyCode})`, type: 'money' },
      { name: 'reconEstimate', label: `Recon estimate (${currencyCode})`, type: 'money', required: false },
    ] },
    stock: { title: 'Stock unit', submitLabel: 'Stock unit', fields: [
      { name: 'stockNumber', label: 'Stock number', maxLength: 80 },
      { name: 'locationCode', label: 'Lot location', maxLength: 80 },
      ...(dialog?.acquisition?.vehicle ? [] : [
        { name: 'condition', label: 'Condition', type: 'select' as const, options: CONDITIONS.map(value => ({ value, label: conditionLabels[value] })) },
        { name: 'trim', label: 'Trim', maxLength: 100, required: false },
        { name: 'exteriorColor', label: 'Exterior colour', maxLength: 100, required: false },
        { name: 'interiorColor', label: 'Interior colour', maxLength: 100, required: false },
      ]),
    ] },
    cancel: { title: 'Cancel acquisition', submitLabel: 'Cancel acquisition', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', maxLength: 500 }] },
  }
  const config = dialog ? dialogConfig[dialog.kind] : null

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Inventory', href: VEHICLES_HREF },
    { type: 'page' as const, label: 'Acquisitions' },
  ]
  const header = (
    <DeskHeader
      eyebrow={<Link href={VEHICLES_HREF} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground sm:min-h-0"><ArrowLeft className="size-3" /> Inventory</Link>}
      title="Acquisitions"
      tone={error ? 'bad' : activeCount ? 'info' : 'idle'}
      status={error ? 'Unavailable' : `${activeCount ?? 0} active`}
      meta={activeCount !== undefined ? `${activeCount} active · ${counts?.frontline || 0} frontline` : undefined}
      actions={
        <Track>
          <Pill onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /><span className="max-sm:sr-only">Refresh</span></Pill>
          <Pill variant="primary" disabled={!rooftops.length || Boolean(busy)} title={rooftops.length ? undefined : 'No active rooftop'} onClick={() => openDialog('start', null, { rooftopId: rooftops[0]?.id || '', acquisitionSource: 'trade-in', sourceReference: '', vin: '', year: String(new Date().getFullYear() - 3), odometer: '', make: '', model: '', appraisal: '', reconEstimate: '' })}>
            <Plus /> Appraise
          </Pill>
        </Track>
      }
    />
  )

  const renderActions = (row: AcquisitionRow, inSheet = false) => {
    const action = nextAction(row)
    const terminal = row.status === 'frontline' || row.status === 'cancelled'
    return (
      <Track>
        {action && (action.kind === 'open' && row.vehicle
          ? <Pill size={inSheet ? 'md' : 'sm'} variant="primary" asChild><Link href={`${VEHICLES_HREF}/${row.vehicle.id}`}>{action.label}</Link></Pill>
          : <Pill size={inSheet ? 'md' : 'sm'} variant="primary" disabled={Boolean(busy)} onClick={() => runNext(row)}>{action.label}</Pill>)}
        {row.vehicle && action?.kind !== 'open' && <Pill size={inSheet ? 'md' : 'sm'} asChild><Link href={`${VEHICLES_HREF}/${row.vehicle.id}`}>Vehicle</Link></Pill>}
        {!inSheet && <Pill size="sm" variant="plain" onClick={() => setSelectedId(row.id)}>Details</Pill>}
        {inSheet && !terminal && <Pill variant="danger" disabled={Boolean(busy)} onClick={() => openDialog('cancel', row, { reason: '' })}>Cancel</Pill>}
      </Track>
    )
  }

  return (
    <PageContainer title="Acquisitions" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        <div className="flex min-w-0 flex-col gap-3">
          <Segmented label="Filter by status" value={filter} onChange={setFilter} options={filterOptions} className="self-start" />
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Reference, VIN, make, model" value={search} onChange={event => setSearch(event.target.value)} className="rounded-full pl-9 max-sm:h-11" aria-label="Search acquisitions" />
          </div>
        </div>

        <DeskSection title={filter === 'active' ? 'Pipeline' : filter === 'all' ? 'All acquisitions' : acquisitionStatusLabels[filter]} count={loading || error ? undefined : rows.length}>
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-12" role="status"><RefreshCw className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /><span className="sr-only">Loading acquisitions</span></div>
          ) : error ? (
            <Notice tone="bad">
              <p className="font-medium">Unable to load acquisitions</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
              <Track className="mt-2"><Pill size="sm" onClick={() => void load()}>Retry</Pill></Track>
            </Notice>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">{search || filter !== 'active' ? 'No matches' : 'No acquisitions in progress'}</p>
              {(search || filter !== 'active') && <Track><Pill size="sm" onClick={() => { setSearch(''); setFilter('active') }}>Reset filters</Pill></Track>}
            </div>
          ) : (
            <Panel className="divide-y">
              {rows.map(row => (
                <div key={row.id} className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="min-w-0 flex-1">
                      <TitleLine tone={acquisitionStatusTones[row.status]} status={acquisitionStatusLabels[row.status]} className="text-sm font-medium">
                        {row.year} {row.make} {row.model}
                      </TitleLine>
                      <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                        <Code className="text-foreground">{row.reference}</Code>
                        <Code><span title={row.vin}>…{row.vin.slice(-8)}</span></Code>
                        <span>{acquisitionSourceLabels[row.acquisitionSource] || row.acquisitionSource}</span>
                        {row.vehicle?.stockNumber && <span>· Stock {row.vehicle.stockNumber}</span>}
                        {rooftops.length > 1 && row.rooftop?.name && <span>· {row.rooftop.name}</span>}
                      </p>
                      <p className="mt-0.5 pl-4 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        {acquisitionStatusLabels[row.status] || row.status} · Updated {formatDate(row.updatedAt, timeZone)}
                      </p>
                    </div>
                    <dl className="grid shrink-0 grid-cols-2 gap-4 pl-4 text-xs md:pl-0 md:text-right">
                      <div><dt className="text-muted-foreground">Appraisal</dt><dd className="font-mono tabular-nums">{money(row.appraisalCents)}</dd></div>
                      <div><dt className="text-muted-foreground">Purchase</dt><dd className="font-mono tabular-nums">{money(row.purchaseCents)}</dd></div>
                    </dl>
                  </div>
                  <div className="mt-2 pl-4">{renderActions(row)}</div>
                </div>
              ))}
            </Panel>
          )}
        </DeskSection>

        <Sheet open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null) }}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle>
                    <TitleLine as="span" tone={acquisitionStatusTones[selected.status]} status={acquisitionStatusLabels[selected.status]}>{selected.year} {selected.make} {selected.model}</TitleLine>
                  </SheetTitle>
                  <SheetDescription className="font-mono text-xs">{selected.reference} · {acquisitionStatusLabels[selected.status] || selected.status}</SheetDescription>
                </SheetHeader>
                <div className="space-y-6 px-4 pb-24">
                  {renderActions(selected, true)}
                  <Facts items={[
                    { label: 'VIN', value: selected.vin, mono: true },
                    { label: 'Source', value: acquisitionSourceLabels[selected.acquisitionSource] || selected.acquisitionSource },
                    Boolean(selected.sourceReference) && { label: 'Source ref', value: selected.sourceReference, mono: true },
                    { label: 'Odometer', value: selected.odometer == null ? '-' : `${selected.odometer.toLocaleString('en-US')} mi`, mono: true },
                    { label: 'Appraisal', value: money(selected.appraisalCents), mono: true },
                    { label: 'Purchase', value: money(selected.purchaseCents), mono: true },
                    { label: 'Recon estimate', value: money(selected.reconEstimateCents), mono: true },
                    { label: 'Purchased', value: formatDate(selected.purchasedAt, timeZone) },
                    { label: 'Arrived', value: formatDate(selected.arrivedAt, timeZone) },
                    { label: 'Frontline', value: formatDate(selected.frontlineAt, timeZone) },
                    { label: 'Stock', value: selected.vehicle?.stockNumber || (selected.stock ? 'Stocked' : 'Not stocked'), mono: Boolean(selected.vehicle?.stockNumber) },
                    { label: 'Requested by', value: personName(selected.requestedBy) },
                    rooftops.length > 1 && { label: 'Rooftop', value: selected.rooftop?.name || '-' },
                  ]} />
                  {ACQUISITION_NEXT[selected.status] === 'frontline' && <Notice tone="idle">Frontline needs completed recon and an approved listing on the vehicle page.</Notice>}
                  <DeskSection title="Timeline" count={selected.events.length}>
                    <ol className="space-y-3 border-l pl-4">
                      {selected.events.map(event => (
                        <li key={event.id} className="relative text-sm">
                          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-muted-foreground/40" />
                          <p className="font-medium">{event.fromStatus ? `${acquisitionStatusLabels[event.fromStatus] || event.fromStatus} to ${acquisitionStatusLabels[event.toStatus] || event.toStatus}` : acquisitionStatusLabels[event.toStatus] || event.toStatus}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt, timeZone)} · {personName(event.actor)}</p>
                          <p className="break-words text-xs text-muted-foreground">{event.reason}</p>
                        </li>
                      ))}
                    </ol>
                  </DeskSection>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {dialog && config && (
          <InventoryFormDialog
            open
            title={config.title}
            description={dialog.acquisition ? `${dialog.acquisition.reference} · ${dialog.acquisition.year} ${dialog.acquisition.make} ${dialog.acquisition.model}` : undefined}
            fields={config.fields}
            values={values}
            errors={fieldErrors}
            formError={formError}
            busy={busy === 'dialog'}
            submitLabel={config.submitLabel}
            onValuesChange={setValues}
            onSubmit={submitDialog}
            onOpenChange={open => { if (!open && busy !== 'dialog') setDialog(null) }}
          />
        )}
      </div>
    </PageContainer>
  )
}
