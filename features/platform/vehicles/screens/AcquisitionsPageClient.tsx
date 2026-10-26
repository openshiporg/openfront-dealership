'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, DeskTable, Facts, Figure, Notice, Pill, Segmented, Status, Td, Th, TitleLine, Tr, Track, type DeskTone } from '@/features/platform/components/desk'
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
  // Rows waiting on a desk step (not just "open vehicle"), oldest update first.
  const waiting = rows
    .filter(row => ACTIVE.includes(row.status) && nextAction(row) && nextAction(row)!.kind !== 'open')
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
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
      meta={activeCount !== undefined ? `${activeCount} active · ${waiting.length} waiting on a step · ${counts?.frontline || 0} frontline` : undefined}
      actions={
        <Track>
          <Pill variant="plain" onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /><span className="max-sm:sr-only">Refresh</span></Pill>
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
          ? <Pill size={inSheet ? 'md' : 'sm'} variant={inSheet ? 'primary' : undefined} className="max-md:h-10" asChild><Link href={`${VEHICLES_HREF}/${row.vehicle.id}`}>{action.label}</Link></Pill>
          : <Pill size={inSheet ? 'md' : 'sm'} variant={inSheet ? 'primary' : undefined} className="max-md:h-10" disabled={Boolean(busy)} onClick={() => runNext(row)}>{action.label}</Pill>)}
        {row.vehicle && action?.kind !== 'open' && <Pill size={inSheet ? 'md' : 'sm'} variant={inSheet ? undefined : 'plain'} className="max-md:h-10" asChild><Link href={`${VEHICLES_HREF}/${row.vehicle.id}`}>Vehicle</Link></Pill>}
        {!inSheet && <Pill size="sm" variant="plain" className="max-md:h-10" onClick={() => setSelectedId(row.id)}>Details</Pill>}
        {inSheet && !terminal && <Pill variant="danger" disabled={Boolean(busy)} onClick={() => openDialog('cancel', row, { reason: '' })}>Cancel</Pill>}
      </Track>
    )
  }

  return (
    <PageContainer title="Acquisitions" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        {!error && !(loading && rows.length === 0) && (
          <DeskSection title="Needs you" count={waiting.length} id="acquisitions-needs-you">
            {waiting.length === 0 ? (
              <p className="py-3 text-[13px] text-muted-foreground">No acquisitions waiting on a step.</p>
            ) : (
              <DeskTable aria-label="Acquisitions waiting on you">
                <thead>
                  <tr>
                    <Th>Vehicle</Th>
                    <Th priority={2}>Status</Th>
                    <Th priority={2}>Waiting since</Th>
                    <Th align="right"><span className="sr-only">Next step</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map(row => (
                    <Tr key={row.id}>
                      <Td className="min-w-0">
                        <p className="break-words font-medium text-foreground">{row.year} {row.make} {row.model}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Code>{row.reference}</Code>
                          <span className="md:hidden"><Status tone={acquisitionStatusTones[row.status]}>{acquisitionStatusLabels[row.status] || row.status}</Status></span>
                        </div>
                      </Td>
                      <Td priority={2}><Status tone={acquisitionStatusTones[row.status]}>{acquisitionStatusLabels[row.status] || row.status}</Status></Td>
                      <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatDate(row.updatedAt, timeZone)}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        <Pill size="sm" className="max-md:h-10" disabled={Boolean(busy)} onClick={() => runNext(row)}>{nextAction(row)?.label}</Pill>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DeskTable>
            )}
          </DeskSection>
        )}

        <DeskSection title={filter === 'active' ? 'Pipeline' : filter === 'all' ? 'All acquisitions' : acquisitionStatusLabels[filter]} count={loading || error ? undefined : rows.length}>
          <div className="mb-3 flex min-w-0 flex-col gap-3">
            <Segmented label="Filter by status" value={filter} onChange={setFilter} options={filterOptions} className="self-stretch" />
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Reference, VIN, make, model" value={search} onChange={event => setSearch(event.target.value)} className="rounded-[4px] pl-9 max-md:h-10" aria-label="Search acquisitions" />
            </div>
          </div>
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
            <DeskTable aria-label="Acquisitions">
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th priority={3}>Source</Th>
                  <Th priority={2}>Status</Th>
                  <Th align="right" priority={2}>Appraisal</Th>
                  <Th align="right">Purchase</Th>
                  <Th priority={3}>Updated</Th>
                  <Th align="right" priority={2}><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <Tr key={row.id}>
                    <Td className="min-w-0">
                      <p className="break-words font-medium text-foreground">{row.year} {row.make} {row.model}</p>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <Code className="text-foreground">{row.reference}</Code>
                        <Code><span title={row.vin}>…{row.vin.slice(-8)}</span></Code>
                        {row.vehicle?.stockNumber && <span>Stock <Code>{row.vehicle.stockNumber}</Code></span>}
                        {rooftops.length > 1 && row.rooftop?.name && <span>{row.rooftop.name}</span>}
                      </p>
                      <div className="mt-1 md:hidden"><Status tone={acquisitionStatusTones[row.status]}>{acquisitionStatusLabels[row.status] || row.status}</Status></div>
                      <div className="mt-2 md:hidden">{renderActions(row)}</div>
                    </Td>
                    <Td priority={3} className="whitespace-nowrap text-muted-foreground">{acquisitionSourceLabels[row.acquisitionSource] || row.acquisitionSource}</Td>
                    <Td priority={2}><Status tone={acquisitionStatusTones[row.status]}>{acquisitionStatusLabels[row.status] || row.status}</Status></Td>
                    <Td align="right" priority={2} className="whitespace-nowrap text-muted-foreground">{money(row.appraisalCents)}</Td>
                    <Td align="right" className="align-top md:align-middle"><span className="sr-only">Purchase </span><Figure size="sm">{money(row.purchaseCents)}</Figure></Td>
                    <Td priority={3} className="whitespace-nowrap text-muted-foreground">{formatDate(row.updatedAt, timeZone)}</Td>
                    <Td align="right" priority={2} className="whitespace-nowrap"><div className="flex justify-end">{renderActions(row)}</div></Td>
                  </Tr>
                ))}
              </tbody>
            </DeskTable>
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
                  <SheetDescription className="text-[13px]"><Code>{selected.reference}</Code> · {acquisitionStatusLabels[selected.status] || selected.status}</SheetDescription>
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
                          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/40" />
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
