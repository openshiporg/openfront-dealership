'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
  Meter,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { readDeskFinanceEvidence, type DeskFinanceEvidence } from '@/features/platform/finance/lib/financeEvidence'
import { FinanceEvidenceHistory } from '@/features/platform/deals/components/FinanceEvidenceHistory'
import { buildDeliveryChecklistEntry, DELIVERY_CHECKLIST_ITEMS, DELIVERY_FUNDING_ITEM } from '../lib/checklistEvidence'
import { fromZonedInput, zonedInputValue } from '../lib/zonedTime'
import {
  type DeliveryCase,
  type DeliveryRecord,
  type DeliveryWorkspace,
  type WeOwe,
  completeDealDelivery,
  getDeliveryWorkspace,
  manageDeliveryCase,
  manageWeOweItem,
} from '../actions'

type Delivery = Omit<DeliveryRecord, 'financeEvidence'> & { financeEvidence: DeskFinanceEvidence | null }
type DeliveryTaskKind = 'schedule' | 'checklist' | 'acknowledge' | 'we-owe' | 'close-we-owe' | 'complete'
type DeliveryTask = {
  idempotencyKey: string
  deliveryCaseUpdatedAt: string | null
  kind: DeliveryTaskKind
  delivery: Delivery
  item?: WeOwe
  action?: 'fulfill' | 'waive'
  fields: Record<string, string>
}
type CommandResult = { success: boolean; error?: string }

function readDeliveries(workspace: DeliveryWorkspace | null): Delivery[] {
  return (workspace?.deliveries || []).map(delivery => ({ ...delivery, financeEvidence: readDeskFinanceEvidence(delivery.financeEvidence) }))
}

const caseTone: Record<string, DeskTone> = {
  scheduled: 'info',
  arrived: 'info',
  ready: 'ok',
  delivered: 'ok',
}

const fieldLabel = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

function deliveryTone(delivery: Delivery, deliveryCase: DeliveryCase | undefined): DeskTone {
  if (delivery.status === 'delivered') return 'ok'
  if (!deliveryCase) return delivery.status === 'financed' ? 'warn' : 'idle'
  return caseTone[deliveryCase.status] ?? 'idle'
}

function deliveryStatusLabel(delivery: Delivery, deliveryCase: DeliveryCase | undefined) {
  const status = deliveryCase?.status || delivery.status
  return !deliveryCase && delivery.status === 'financed' ? 'Not scheduled' : status.charAt(0).toUpperCase() + status.slice(1)
}

function customerName(delivery: Delivery) {
  return [delivery.lead?.firstName, delivery.lead?.lastName].filter(Boolean).join(' ') || 'Customer not linked'
}

function vehicleName(delivery: Delivery) {
  return delivery.vehicle ? `${delivery.vehicle.year} ${delivery.vehicle.make} ${delivery.vehicle.model}` : 'Vehicle unavailable'
}

// Dealership time zone, so the server render and the browser agree.
function formatDate(value: string | null | undefined, timeZone: string) {
  return value
    ? new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Not scheduled'
}

/** Staff-recorded checklist items that are complete or waived. */
function recordedChecklist(deliveryCase: DeliveryCase | undefined) {
  return DELIVERY_CHECKLIST_ITEMS.filter(({ code }) => deliveryCase?.checklist?.some(item => item.code === code && ['complete', 'waived'].includes(item.status)))
}

/** Funding comes from the funding case; a delivered case keeps the funding entry it was delivered with. */
function fundingItem(delivery: Delivery, deliveryCase: DeliveryCase | undefined) {
  const finance = delivery.financeEvidence
  const cash = finance?.structureType === 'cash'
  const label = cash ? 'Payment' : DELIVERY_FUNDING_ITEM.label
  const recorded = deliveryCase?.checklist?.find(item => item.code === DELIVERY_FUNDING_ITEM.code)
  if (finance?.fundingCurrent) return { label, done: true, text: `${cash ? 'received' : 'funded'}${finance.fundingReference ? ` · ${finance.fundingReference}` : ''}` }
  if (delivery.status === 'delivered' && recorded) return { label, done: true, text: `complete${recorded.evidenceReference ? ` · ${recorded.evidenceReference}` : ''}` }
  return { label, done: false, text: finance?.fundingStatus === 'funded' ? 'recorded for an earlier worksheet' : cash ? 'waiting on payment' : 'waiting on funding' }
}

/** The time readout at the head of each delivery row. */
function TimeReadout({ value, timeZone }: { value: string | null | undefined; timeZone: string }) {
  if (!value) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <p>Not</p>
        <p>scheduled</p>
      </div>
    )
  }
  const date = new Date(value)
  return (
    <time dateTime={value} className="block font-mono tabular-nums">
      <span className="block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{date.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })}</span>
      <span className="block text-lg font-semibold tracking-tight text-foreground">{date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}</span>
    </time>
  )
}

export function DeliveryDeskPageClient({
  initialWorkspace,
  initialError,
  timeZone,
}: {
  initialWorkspace: DeliveryWorkspace | null
  initialError: string | null
  timeZone: string
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => readDeliveries(initialWorkspace))
  const [cases, setCases] = useState<DeliveryCase[]>(initialWorkspace?.cases || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [sort, setSort] = useState('appointment')
  const [task, setTask] = useState<DeliveryTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const response = await getDeliveryWorkspace()
    if (response.success && response.data) {
      setDeliveries(readDeliveries(response.data.deliveryWorkspace))
      setCases(response.data.deliveryWorkspace.cases || [])
    } else {
      setError(response.error || 'Unable to load deliveries.')
    }
    setLoading(false)
  }

  const caseFor = (dealId: string) => cases.find(item => item.deal?.id === dealId)

  const openTask = (kind: DeliveryTaskKind, delivery: Delivery, item?: WeOwe, action?: 'fulfill' | 'waive') => {
    setTaskError(null)
    setNotice(null)
    setTask({
      kind,
      delivery,
      item,
      action,
      idempotencyKey: `delivery-task:${crypto.randomUUID()}`,
      deliveryCaseUpdatedAt: caseFor(delivery.id)?.updatedAt ?? null,
      fields:
        kind === 'schedule'
          ? { appointmentAt: zonedInputValue(new Date(Date.now() + 86_400_000), timeZone) }
          : kind === 'we-owe'
            ? { description: '', promisedAt: zonedInputValue(new Date(Date.now() + 7 * 86_400_000), timeZone) }
            : kind === 'checklist'
              ? { code: (DELIVERY_CHECKLIST_ITEMS.find(item => !recordedChecklist(caseFor(delivery.id)).includes(item)) ?? DELIVERY_CHECKLIST_ITEMS[0]).code, reference: '' }
              : kind === 'acknowledge'
                ? { acknowledgment: '' }
                : kind === 'close-we-owe'
                  ? { fulfillmentEvidence: '', customerAcknowledgment: '' }
                  : { confirmed: '' },
    })
  }

  const manageCase = async (delivery: Delivery, action: 'schedule' | 'arrive' | 'record-checklist' | 'acknowledge') => {
    if (action === 'schedule') return openTask('schedule', delivery)
    if (action === 'record-checklist') return openTask('checklist', delivery)
    if (action === 'acknowledge') return openTask('acknowledge', delivery)
    setActiveId(delivery.id)
    const response = await manageDeliveryCase({
      dealId: delivery.id,
      action,
      idempotencyKey: `delivery-case:${delivery.id}:${action}:${crypto.randomUUID()}`,
    })
    setNotice(response.success ? 'Arrival recorded.' : `Unable to update delivery: ${response.error}`)
    await load()
    setActiveId(null)
  }

  const addWeOwe = (delivery: Delivery) => openTask('we-owe', delivery)
  const closeWeOwe = (delivery: Delivery, item: WeOwe, action: 'fulfill' | 'waive') => openTask('close-we-owe', delivery, item, action)
  const complete = (delivery: Delivery) => openTask('complete', delivery)

  const updateTaskField = (name: string, value: string) =>
    setTask(current => (current ? { ...current, fields: { ...current.fields, [name]: value } } : current))

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    const field = (name: string) => task.fields[name]?.trim() || ''
    let response: CommandResult | undefined
    const { delivery, kind, item } = task
    setTaskError(null)
    setActiveId(delivery.id)
    try {
      if (kind === 'complete') {
        if (field('confirmed') !== 'yes') throw new Error('Confirm the vehicle is ready for delivery.')
        const fundingUpdatedAt = delivery.financeEvidence?.fundingUpdatedAt
        if (!delivery.financeEvidence?.fundingCurrent || !fundingUpdatedAt || !task.deliveryCaseUpdatedAt) {
          throw new Error(delivery.financeEvidence?.structureType === 'cash' ? 'Record payment on the finance desk first.' : 'Record funding on the finance desk first.')
        }
        response = await completeDealDelivery({
          dealId: delivery.id,
          expectedUpdatedAt: delivery.updatedAt,
          expectedFundingUpdatedAt: fundingUpdatedAt,
          expectedDeliveryCaseUpdatedAt: task.deliveryCaseUpdatedAt,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'schedule') {
        const appointmentAt = fromZonedInput(field('appointmentAt'), timeZone)
        if (!appointmentAt) throw new Error('Choose a valid delivery appointment time.')
        response = await manageDeliveryCase({
          dealId: delivery.id,
          action: 'schedule',
          appointmentAt: appointmentAt.toISOString(),
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'checklist') {
        const reference = field('reference')
        if (!reference) throw new Error('A reference is required.')
        const checklist = [buildDeliveryChecklistEntry(field('code'), reference)]
        response = await manageDeliveryCase({
          dealId: delivery.id,
          action: 'record-checklist',
          checklist,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'acknowledge') {
        const customerAcknowledgment = field('acknowledgment')
        if (!customerAcknowledgment) throw new Error('Customer acknowledgment reference is required.')
        response = await manageDeliveryCase({
          dealId: delivery.id,
          action: 'acknowledge',
          customerAcknowledgment,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'we-owe') {
        const description = field('description')
        const promisedAt = fromZonedInput(field('promisedAt'), timeZone)
        if (!description || !promisedAt || !delivery.salesperson?.id) {
          throw new Error('Description, promised date, and an assigned salesperson are required.')
        }
        response = await manageWeOweItem({
          dealId: delivery.id,
          action: 'create',
          description,
          promisedAt: promisedAt.toISOString(),
          ownerId: delivery.salesperson.id,
          estimatedCostCents: 0,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'close-we-owe' && item) {
        const fulfillmentEvidence = field('fulfillmentEvidence')
        const customerAcknowledgment = field('customerAcknowledgment')
        if (!fulfillmentEvidence || !customerAcknowledgment) {
          throw new Error(`${task.action === 'waive' ? 'Waiver' : 'Fulfillment'} and customer acknowledgment references are required.`)
        }
        response = await manageWeOweItem({
          dealId: delivery.id,
          itemId: item.id,
          action: task.action || 'fulfill',
          fulfillmentEvidence,
          customerAcknowledgment,
          idempotencyKey: task.idempotencyKey,
        })
      }
      if (!response?.success) {
        setTaskError(response?.error || 'Unable to save. Your entries are kept; try again.')
        return
      }
      setTask(null)
      setNotice(kind === 'complete' ? 'Delivery completed.' : 'Delivery updated.')
      await load()
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Unable to update delivery.')
    } finally {
      setActiveId(null)
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const caseByDeal = (dealId: string) => cases.find(item => item.deal?.id === dealId)
    const rows = deliveries.filter(delivery => {
      const deliveryCase = caseByDeal(delivery.id)
      if (filter === 'active' && delivery.status === 'delivered') return false
      if (filter === 'ready' && deliveryCase?.status !== 'ready') return false
      if (filter === 'we-owe' && !deliveryCase?.weOweItems.some(item => item.status === 'open')) return false
      if (filter === 'delivered' && delivery.status !== 'delivered') return false
      return (
        !term ||
        `${vehicleName(delivery)} ${delivery.vehicle?.stockNumber || ''} ${delivery.vehicle?.vin || ''} ${customerName(delivery)}`.toLowerCase().includes(term)
      )
    })
    return rows.sort((a, b) =>
      sort === 'updated'
        ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        : new Date(caseByDeal(a.id)?.appointmentAt || '9999-12-31').getTime() -
          new Date(caseByDeal(b.id)?.appointmentAt || '9999-12-31').getTime()
    )
  }, [deliveries, cases, filter, search, sort])

  const openPromises = cases.flatMap(item => item.weOweItems || []).filter(item => item.status === 'open')
  const ready = deliveries.filter(delivery => caseFor(delivery.id)?.status === 'ready')
  const scheduled = cases.filter(item => item.status === 'scheduled')
  const completed = deliveries.filter(delivery => delivery.status === 'delivered')

  const isFiltered = Boolean(search.trim()) || filter !== 'all'
  const resetFilters = () => {
    setSearch('')
    setFilter('all')
  }

  const taskTitle =
    task?.kind === 'schedule'
      ? 'Schedule delivery'
      : task?.kind === 'checklist'
        ? 'Record checklist item'
        : task?.kind === 'acknowledge'
          ? 'Record customer acknowledgment'
          : task?.kind === 'we-owe'
            ? 'Add we-owe'
            : task?.kind === 'close-we-owe'
              ? `${task.action === 'waive' ? 'Waive' : 'Fulfill'} we-owe`
              : 'Complete delivery'

  const taskDescription =
    task?.kind === 'close-we-owe'
      ? task.item?.description || 'We-owe item'
      : task?.kind === 'we-owe'
        ? `Assigned to ${task.delivery.salesperson?.name || 'no salesperson'}`
        : task?.kind === 'schedule'
          ? `Dealership time (${timeZone.replace(/_/g, ' ')}).`
          : task
            ? vehicleName(task.delivery)
            : ''

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Delivery' },
  ]

  const header = (
    <DeskHeader
      title="Delivery"
      tone={error ? 'bad' : ready.length > 0 ? 'ok' : openPromises.length > 0 ? 'warn' : 'idle'}
      status={error ? 'Unavailable' : `${ready.length} ready`}
      meta={error ? 'Unavailable' : `${scheduled.length} scheduled · ${ready.length} ready · ${openPromises.length} open we-owes`}
      actions={
        <Track>
          <Pill onClick={load} disabled={loading} aria-label="Refresh deliveries">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  const filterOptions = [
    { value: 'active', label: 'Active', count: deliveries.filter(delivery => delivery.status !== 'delivered').length },
    { value: 'ready', label: 'Ready', tone: 'ok' as const, count: ready.length },
    { value: 'we-owe', label: 'Open we-owes', tone: 'warn' as const, count: deliveries.filter(delivery => caseFor(delivery.id)?.weOweItems.some(item => item.status === 'open')).length },
    { value: 'delivered', label: 'Delivered', count: completed.length },
    { value: 'all', label: 'All', count: deliveries.length },
  ]

  return (
    <PageContainer title="Delivery" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && <Notice tone={notice.startsWith('Unable') ? 'bad' : 'ok'} role="status">{notice}</Notice>}

        <ReadoutStrip>
          <Readout label="Scheduled" value={scheduled.length} tone={scheduled.length > 0 ? 'info' : 'idle'} />
          <Readout label="Ready" value={ready.length} tone={ready.length > 0 ? 'ok' : 'idle'} />
          <Readout label="Open we-owes" value={openPromises.length} tone={openPromises.length > 0 ? 'warn' : 'idle'} />
          <Readout label="Delivered" value={completed.length} />
        </ReadoutStrip>

        <DeskSection
          title="Deliveries"
          count={visible.length}
          actions={loading ? <span className="text-xs text-muted-foreground" role="status">Refreshing…</span> : undefined}
        >
          <div className="space-y-3">
            <Segmented label="Filter deliveries" value={filter} onChange={setFilter} options={filterOptions} size="sm" className="w-full sm:w-auto" />
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Customer, stock, vehicle or VIN"
                  aria-label="Search deliveries"
                />
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sort deliveries">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointment">Appointment first</SelectItem>
                  <SelectItem value="updated">Recently updated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <Notice tone="bad">
                <p className="font-medium">Deliveries are unavailable</p>
                <p className="mt-0.5 text-muted-foreground">{error}</p>
                <Track className="mt-2">
                  <Pill size="sm" onClick={load}>Retry</Pill>
                </Track>
              </Notice>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <p>{deliveries.length > 0 && isFiltered ? 'No matching deliveries' : 'No deliveries'}</p>
                {deliveries.length > 0 && isFiltered && (
                  <Track>
                    <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
                  </Track>
                )}
              </div>
            ) : (
              <Panel className="divide-y">
                {visible.map(delivery => {
                  const deliveryCase = caseFor(delivery.id)
                  const recorded = recordedChecklist(deliveryCase)
                  const funding = fundingItem(delivery, deliveryCase)
                  const totalChecks = DELIVERY_CHECKLIST_ITEMS.length + 1
                  const completedChecks = recorded.length + (funding.done ? 1 : 0)
                  const openWeOwe = deliveryCase?.weOweItems.filter(item => item.status === 'open') || []
                  const finance = delivery.financeEvidence
                  const busy = activeId === delivery.id
                  const allChecked = completedChecks === totalChecks
                  const missingItem = DELIVERY_CHECKLIST_ITEMS.find(item => !recorded.includes(item))
                  // One step at a time, in the order the server accepts them.
                  const next = !deliveryCase ? 'schedule'
                    : deliveryCase.status === 'ready' ? 'complete'
                      : deliveryCase.status === 'scheduled' ? 'arrive'
                        : missingItem ? 'checklist'
                          : funding.done ? 'acknowledge' : null
                  const acknowledgeBlocked = missingItem ? `Record ${missingItem.label.toLowerCase()} first` : !funding.done ? (finance?.structureType === 'cash' ? 'Record payment on the finance desk first' : 'Record funding on the finance desk first') : null
                  return (
                    <article key={delivery.id} className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-5">
                      <TimeReadout value={deliveryCase?.appointmentAt} timeZone={timeZone} />

                      <div className="min-w-0 space-y-4">
                        <div className="min-w-0">
                          <TitleLine as="h3" tone={deliveryTone(delivery, deliveryCase)} status={deliveryStatusLabel(delivery, deliveryCase)} className="text-base font-semibold text-foreground">
                            {vehicleName(delivery)}
                          </TitleLine>
                          <p className="pl-4 text-sm text-muted-foreground">
                            <span className="text-foreground">{deliveryStatusLabel(delivery, deliveryCase)}</span>
                            {' · '}
                            {delivery.lead ? (
                              <Link className="hover:text-foreground hover:underline" href={`${basePath}/platform/crm/${delivery.lead.id}`}>
                                {customerName(delivery)}
                              </Link>
                            ) : (
                              customerName(delivery)
                            )}
                            {delivery.salesperson?.name ? ` · ${delivery.salesperson.name}` : ''}
                          </p>
                          <p className="flex min-w-0 flex-wrap gap-x-3 pl-4">
                            <Code>Stock {delivery.vehicle?.stockNumber || '—'}</Code>
                            <Code className="break-all">VIN {delivery.vehicle?.vin || '—'}</Code>
                          </p>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={fieldLabel}>Checklist</span>
                            <Meter value={completedChecks / totalChecks} segments={totalChecks} tone={allChecked ? 'ok' : 'warn'} label={`${vehicleName(delivery)} checklist progress`} />
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {completedChecks}/{totalChecks} complete
                            </span>
                          </div>
                          <ul className="grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                            {DELIVERY_CHECKLIST_ITEMS.map(({ code, label }) => {
                              const item = deliveryCase?.checklist?.find(value => value.code === code)
                              const done = recorded.some(value => value.code === code)
                              return (
                                <li key={code} className="min-w-0 text-xs">
                                  <TitleLine as="span" tone={done ? 'ok' : 'idle'} className="text-foreground">
                                    {label}
                                    <span className="text-muted-foreground"> · {item?.status || 'missing'}{item?.evidenceReference ? ' · reference recorded' : ''}</span>
                                  </TitleLine>
                                </li>
                              )
                            })}
                            <li className="min-w-0 text-xs">
                              <TitleLine as="span" tone={funding.done ? 'ok' : 'idle'} className="text-foreground">
                                {funding.label}
                                <span className="break-all text-muted-foreground"> · {funding.text}</span>
                              </TitleLine>
                            </li>
                            <li className="min-w-0 text-xs">
                              <TitleLine as="span" tone={deliveryCase?.customerAcknowledgment ? 'ok' : 'idle'} className="text-foreground">
                                Customer acknowledgment
                                <span className="text-muted-foreground"> · {deliveryCase?.customerAcknowledgment ? 'Recorded' : 'Missing'}</span>
                              </TitleLine>
                            </li>
                          </ul>
                        </div>

                        <div className="min-w-0 space-y-1.5 text-sm">
                          {delivery.status !== 'delivered' && !finance?.prerequisites?.current && (
                            <TitleLine as="p" tone="idle" className="text-foreground">
                              {finance?.structureType === 'cash' ? 'Documents and checks' : 'Contract, menu, and compliance'}
                              <span className="text-muted-foreground"> · {finance?.structureType === 'cash' ? 'confirmed when payment is recorded' : 'not yet reviewed'} · </span>
                              <Link className="text-muted-foreground underline hover:text-foreground" href={`${basePath}/platform/finance`}>
                                Open finance
                              </Link>
                            </TitleLine>
                          )}
                          {delivery.status === 'delivered' && (
                            <p className="text-sm text-muted-foreground">Delivered {formatDate(delivery.saleDate, timeZone)}.</p>
                          )}
                        </div>

                        {delivery.status === 'financed' && (
                          <div className="min-w-0 space-y-1.5">
                            <Track aria-label={`${vehicleName(delivery)} actions`}>
                              {!deliveryCase && (
                                <Pill size="sm" variant="primary" onClick={() => manageCase(delivery, 'schedule')} disabled={busy}>
                                  Schedule
                                </Pill>
                              )}
                              {deliveryCase?.status === 'ready' && (
                                <Pill size="sm" variant="primary" onClick={() => complete(delivery)} disabled={busy || !funding.done}>
                                  <Check />
                                  Complete delivery
                                </Pill>
                              )}
                              {deliveryCase?.status === 'scheduled' && (
                                <Pill size="sm" variant={next === 'arrive' ? 'primary' : 'raised'} onClick={() => manageCase(delivery, 'arrive')} disabled={busy}>
                                  Record arrival
                                </Pill>
                              )}
                              {deliveryCase && missingItem && (
                                <Pill size="sm" variant={next === 'checklist' ? 'primary' : 'raised'} onClick={() => manageCase(delivery, 'record-checklist')} disabled={busy}>
                                  Record {missingItem.label.toLowerCase()}
                                </Pill>
                              )}
                              {deliveryCase && deliveryCase.status !== 'ready' && (
                                <Pill size="sm" variant={next === 'acknowledge' ? 'primary' : 'raised'} onClick={() => manageCase(delivery, 'acknowledge')} disabled={busy || Boolean(acknowledgeBlocked)} aria-describedby={acknowledgeBlocked ? `delivery-ack-${delivery.id}` : undefined}>
                                  Record acknowledgment
                                </Pill>
                              )}
                              {deliveryCase && !missingItem && (
                                <Pill size="sm" onClick={() => manageCase(delivery, 'record-checklist')} disabled={busy}>
                                  Update checklist item
                                </Pill>
                              )}
                              {deliveryCase && (
                                <Pill size="sm" onClick={() => addWeOwe(delivery)} disabled={busy}>
                                  <Plus />
                                  Add we-owe
                                </Pill>
                              )}
                            </Track>
                            {deliveryCase && deliveryCase.status !== 'ready' && acknowledgeBlocked && (
                              <p id={`delivery-ack-${delivery.id}`} className="pl-4 text-xs text-muted-foreground">
                                Acknowledgment: {acknowledgeBlocked}
                                {!funding.done && !missingItem && (
                                  <>
                                    {' · '}
                                    <Link className="underline hover:text-foreground" href={`${basePath}/platform/finance`}>Open finance</Link>
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {(deliveryCase?.weOweItems.length || 0) > 0 && (
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 border-b pb-1.5">
                              <span className={fieldLabel}>We-owe items</span>
                              {openWeOwe.length > 0 && (
                                <span className="font-mono text-xs tabular-nums text-amber-700 dark:text-amber-300">
                                  {openWeOwe.length} open we-owe{openWeOwe.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                            <ul className="divide-y">
                              {deliveryCase?.weOweItems.map(item => (
                                <li key={item.id} className="flex min-w-0 flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <TitleLine as="p" tone={item.status === 'open' ? 'warn' : item.status === 'waived' ? 'idle' : 'ok'} status={item.status} className="text-sm text-foreground">
                                      {item.description}
                                    </TitleLine>
                                    <p className="pl-4 text-xs text-muted-foreground">
                                      {item.status} · promised {formatDate(item.promisedAt, timeZone)} · {item.owner?.name || 'Unassigned'}
                                    </p>
                                  </div>
                                  {item.status === 'open' && (
                                    <Track className="shrink-0 self-start sm:self-auto">
                                      <Pill size="sm" onClick={() => closeWeOwe(delivery, item, 'fulfill')} disabled={busy}>
                                        Fulfill
                                      </Pill>
                                      <Pill size="sm" variant="plain" onClick={() => closeWeOwe(delivery, item, 'waive')} disabled={busy}>
                                        Waive
                                      </Pill>
                                    </Track>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="min-w-0 divide-y border-t">
                          <FinanceEvidenceHistory dealId={delivery.id} aggregateType="DeliveryCase" label="Delivery history" timeZone={timeZone} />
                          <FinanceEvidenceHistory dealId={delivery.id} aggregateType="Deal" label="Deal history" timeZone={timeZone} />
                          {deliveryCase?.deliverySnapshot != null && (
                            <details className="group min-w-0 text-sm">
                              <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                                Delivery record
                              </summary>
                              <pre className="mb-2 ml-5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
                                {JSON.stringify(deliveryCase.deliverySnapshot, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </Panel>
            )}
          </div>
        </DeskSection>

        <Dialog
          open={Boolean(task)}
          onOpenChange={open => {
            if (!open && !activeId) {
              setTask(null)
              setTaskError(null)
            }
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{taskTitle}</DialogTitle>
              <DialogDescription>{taskDescription}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitTask} className="space-y-4">
              {task?.kind === 'schedule' && (
                <label htmlFor="delivery-appointment" className="grid gap-1.5 text-sm">
                  <span className={fieldLabel}>Appointment</span>
                  <Input
                    id="delivery-appointment"
                    type="datetime-local"
                    required
                    min={zonedInputValue(new Date(Date.now() - 300_000), timeZone)}
                    value={task.fields.appointmentAt || ''}
                    onChange={event => updateTaskField('appointmentAt', event.target.value)}
                  />
                </label>
              )}
              {task?.kind === 'checklist' && (
                <>
                  <div className="grid gap-1.5 text-sm">
                    <span className={fieldLabel} id="delivery-checklist-code-label">
                      Checklist item
                    </span>
                    <Select value={task.fields.code || ''} onValueChange={value => updateTaskField('code', value)}>
                      <SelectTrigger id="delivery-checklist-code" aria-labelledby="delivery-checklist-code-label">
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_CHECKLIST_ITEMS.map(item => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label htmlFor="delivery-reference" className="grid gap-1.5 text-sm">
                    <span className={fieldLabel}>Reference</span>
                    <Input
                      id="delivery-reference"
                      required
                      maxLength={200}
                      value={task.fields.reference || ''}
                      onChange={event => updateTaskField('reference', event.target.value)}
                      placeholder="Document or record number"
                    />
                  </label>
                </>
              )}
              {task?.kind === 'acknowledge' && (
                <label htmlFor="delivery-acknowledgment" className="grid gap-1.5 text-sm">
                  <span className={fieldLabel}>Customer acknowledgment reference</span>
                  <Input
                    id="delivery-acknowledgment"
                    required
                    value={task.fields.acknowledgment || ''}
                    onChange={event => updateTaskField('acknowledgment', event.target.value)}
                  />
                </label>
              )}
              {task?.kind === 'we-owe' && (
                <>
                  <label htmlFor="we-owe-description" className="grid gap-1.5 text-sm">
                    <span className={fieldLabel}>Description</span>
                    <Textarea
                      id="we-owe-description"
                      required
                      maxLength={1000}
                      rows={3}
                      value={task.fields.description || ''}
                      onChange={event => updateTaskField('description', event.target.value)}
                    />
                  </label>
                  <label htmlFor="we-owe-promised-at" className="grid gap-1.5 text-sm">
                    <span className={fieldLabel}>Promised by (dealership time)</span>
                    <Input
                      id="we-owe-promised-at"
                      type="datetime-local"
                      required
                      value={task.fields.promisedAt || ''}
                      onChange={event => updateTaskField('promisedAt', event.target.value)}
                    />
                  </label>
                </>
              )}
              {task?.kind === 'close-we-owe' && (
                <>
                  <label htmlFor="we-owe-fulfillment" className="grid gap-1.5 text-sm">
                    <span className={fieldLabel}>{task.action === 'waive' ? 'Waiver' : 'Fulfillment'} reference</span>
                    <Input
                      id="we-owe-fulfillment"
                      required
                      value={task.fields.fulfillmentEvidence || ''}
                      onChange={event => updateTaskField('fulfillmentEvidence', event.target.value)}
                    />
                  </label>
                  <label htmlFor="we-owe-ack" className="grid gap-1.5 text-sm">
                    <span className={fieldLabel}>Customer acknowledgment reference</span>
                    <Input
                      id="we-owe-ack"
                      required
                      value={task.fields.customerAcknowledgment || ''}
                      onChange={event => updateTaskField('customerAcknowledgment', event.target.value)}
                    />
                  </label>
                </>
              )}
              {task?.kind === 'complete' && (
                <label className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={task.fields.confirmed === 'yes'}
                    onChange={event => updateTaskField('confirmed', event.target.checked ? 'yes' : '')}
                  />
                  <span>The vehicle is ready for delivery.</span>
                </label>
              )}
              {taskError && <Notice tone="bad">{taskError}</Notice>}
              <DialogFooter className="sm:justify-end">
                <Track>
                  <Pill
                    variant="plain"
                    disabled={Boolean(activeId)}
                    onClick={() => {
                      setTask(null)
                      setTaskError(null)
                    }}
                  >
                    Cancel
                  </Pill>
                  <Pill type="submit" variant="primary" disabled={Boolean(activeId)}>
                    {activeId ? 'Saving…' : task?.kind === 'complete' ? 'Complete delivery' : 'Save'}
                  </Pill>
                </Track>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  )
}
