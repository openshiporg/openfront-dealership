'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, ClipboardCheck, RefreshCw, Search, Square, Triangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { readFinanceEvidence, type FinanceEvidence } from '@/features/platform/deals/lib/financeEvidence'
import { FinanceEvidenceHistory } from '@/features/platform/deals/components/FinanceEvidenceHistory'
import { buildDeliveryChecklistEntry, DELIVERY_CHECKLIST_ITEMS } from '../lib/checklistEvidence'
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

type Delivery = Omit<DeliveryRecord, 'financeEvidence'> & { financeEvidence: FinanceEvidence | null }
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

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function readDeliveries(workspace: DeliveryWorkspace | null): Delivery[] {
  return (workspace?.deliveries || []).map(delivery => ({ ...delivery, financeEvidence: readFinanceEvidence(delivery.financeEvidence) }))
}

const caseBadge: Record<string, string> = {
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  arrived: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  delivered: 'border-green-200 bg-green-50 text-green-700',
}

function customerName(delivery: Delivery) {
  return [delivery.lead?.firstName, delivery.lead?.lastName].filter(Boolean).join(' ') || 'Customer not linked'
}

function vehicleName(delivery: Delivery) {
  return delivery.vehicle ? `${delivery.vehicle.year} ${delivery.vehicle.make} ${delivery.vehicle.model}` : 'Vehicle unavailable'
}

function formatDate(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Not scheduled'
}

function Summary({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No deliveries"
      description="Scheduled deliveries will appear here."
      icons={[Triangle, Square, Circle]}
    />
  )
}

function EmptyStateSearch({ onResetFilters }: { onResetFilters: () => void }) {
  return (
    <EmptyState
      title="No results found"
      description="Try adjusting your search or filters."
      icons={[Search]}
      action={{ label: 'Reset filters', onClick: onResetFilters }}
    />
  )
}

export function DeliveryDeskPageClient({
  initialWorkspace,
  initialError,
}: {
  initialWorkspace: DeliveryWorkspace | null
  initialError: string | null
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
          ? { appointmentAt: localDateTimeValue(new Date(Date.now() + 86_400_000)) }
          : kind === 'we-owe'
            ? { description: '', promisedAt: localDateTimeValue(new Date(Date.now() + 7 * 86_400_000)) }
            : kind === 'checklist'
              ? { code: DELIVERY_CHECKLIST_ITEMS[0].code, reference: '' }
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
          throw new Error('Funding is not current. Refresh and review Finance before completing.')
        }
        response = await completeDealDelivery({
          dealId: delivery.id,
          expectedUpdatedAt: delivery.updatedAt,
          expectedFundingUpdatedAt: fundingUpdatedAt,
          expectedDeliveryCaseUpdatedAt: task.deliveryCaseUpdatedAt,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (kind === 'schedule') {
        const appointmentAt = new Date(field('appointmentAt'))
        if (!field('appointmentAt') || Number.isNaN(appointmentAt.getTime())) throw new Error('Choose a valid delivery appointment time.')
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
        const promisedAt = new Date(field('promisedAt'))
        if (!description || Number.isNaN(promisedAt.getTime()) || !delivery.salesperson?.id) {
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
          ? 'Dealership local time.'
          : task
            ? vehicleName(task.delivery)
            : ''

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Delivery' },
  ]

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Delivery</h1>
        <p className="text-muted-foreground">Schedule deliveries and complete handoff checklists.</p>
      </div>
      <Button className="self-start" variant="outline" onClick={load} disabled={loading}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  )

  return (
    <PageContainer title="Delivery" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
        {notice && (
          <p role="status" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary title="Scheduled" value={String(scheduled.length)} detail="Delivery appointments" icon={CalendarClock} />
          <Summary title="Ready" value={String(ready.length)} detail="Ready for handoff" icon={ClipboardCheck} />
          <Summary title="Open we-owes" value={String(openPromises.length)} detail="Promised to customers" icon={AlertTriangle} />
          <Summary title="Delivered" value={String(completed.length)} detail="Completed handoffs" icon={CheckCircle2} />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search customer, stock, vehicle, or VIN"
              aria-label="Search deliveries"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter deliveries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="we-owe">Open we-owes</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort deliveries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appointment">Appointment first</SelectItem>
                <SelectItem value="updated">Recently updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading && (
            <span className="text-sm text-muted-foreground" role="status">
              Refreshing…
            </span>
          )}
        </div>

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Deliveries are unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={load}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          deliveries.length > 0 && isFiltered ? (
            <EmptyStateSearch onResetFilters={resetFilters} />
          ) : (
            <EmptyStateDefault />
          )
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map(delivery => {
              const deliveryCase = caseFor(delivery.id)
              const completedChecks = DELIVERY_CHECKLIST_ITEMS.filter(({ code }) =>
                deliveryCase?.checklist?.some(item => item.code === code && ['complete', 'waived'].includes(item.status))
              ).length
              const openWeOwe = deliveryCase?.weOweItems.filter(item => item.status === 'open') || []
              const finance = delivery.financeEvidence
              return (
                <Card key={delivery.id} className="min-w-0">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-lg">{vehicleName(delivery)}</CardTitle>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Stock {delivery.vehicle?.stockNumber || '—'} · VIN {delivery.vehicle?.vin || '—'}
                        </p>
                      </div>
                      <Badge variant="outline" className={caseBadge[deliveryCase?.status || delivery.status] || ''}>
                        {deliveryCase?.status || delivery.status}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Customer</p>
                        {delivery.lead ? (
                          <Link className="font-medium hover:underline" href={`${basePath}/platform/crm/${delivery.lead.id}`}>
                            {customerName(delivery)}
                          </Link>
                        ) : (
                          <p className="font-medium">{customerName(delivery)}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Appointment</p>
                        <p className="font-medium">{formatDate(deliveryCase?.appointmentAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Checklist</p>
                        <p className="font-medium">
                          {completedChecks}/{DELIVERY_CHECKLIST_ITEMS.length} complete
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Customer acknowledgment</p>
                        <p className="font-medium">{deliveryCase?.customerAcknowledgment ? 'Recorded' : 'Missing'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Checklist items</p>
                        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                          {DELIVERY_CHECKLIST_ITEMS.map(({ code, label }) => {
                            const item = deliveryCase?.checklist?.find(value => value.code === code)
                            return (
                              <li key={code} className="text-xs">
                                {label}: {item?.status || 'missing'}
                                {item?.evidenceReference ? ' · reference recorded' : ''}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {delivery.status === 'financed' && (
                      <div className="flex flex-wrap gap-2">
                        {!deliveryCase && (
                          <Button size="sm" variant="outline" onClick={() => manageCase(delivery, 'schedule')} disabled={activeId === delivery.id}>
                            Schedule
                          </Button>
                        )}
                        {deliveryCase?.status === 'scheduled' && (
                          <Button size="sm" variant="outline" onClick={() => manageCase(delivery, 'arrive')} disabled={activeId === delivery.id}>
                            Record arrival
                          </Button>
                        )}
                        {deliveryCase && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => manageCase(delivery, 'record-checklist')} disabled={activeId === delivery.id}>
                              Record checklist item
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => manageCase(delivery, 'acknowledge')} disabled={activeId === delivery.id}>
                              Record acknowledgment
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => addWeOwe(delivery)} disabled={activeId === delivery.id}>
                              Add we-owe
                            </Button>
                          </>
                        )}
                        {deliveryCase?.status === 'ready' && (
                          <Button size="sm" onClick={() => complete(delivery)} disabled={activeId === delivery.id || !finance?.fundingCurrent}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete delivery
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-sm">
                      Worksheet {finance?.worksheetVersion} · funding {finance?.fundingStatus || 'missing'}
                      {finance?.fundingCurrent ? ' · current' : delivery.status === 'delivered' ? '' : ' · needs review'}
                    </p>
                    {finance?.issue && (
                      <p role="status" className="text-sm text-amber-700">
                        {finance.issue}{' '}
                        <Link className="underline" href={`${basePath}/platform/finance`}>
                          Review funding
                        </Link>
                      </p>
                    )}
                    <p className="text-sm">
                      Contract, menu, and compliance: {finance?.prerequisites?.current ? 'Reviewed' : 'Needs review'}
                      {finance?.prerequisites?.issue ? `. ${finance.prerequisites.issue}` : ''}
                    </p>
                    <FinanceEvidenceHistory dealId={delivery.id} aggregateType="DeliveryCase" label="Delivery history" />
                    <FinanceEvidenceHistory dealId={delivery.id} aggregateType="Deal" label="Deal history" />
                    {deliveryCase?.deliverySnapshot != null && (
                      <details className="text-sm">
                        <summary>Delivery record</summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                          {JSON.stringify(deliveryCase.deliverySnapshot, null, 2)}
                        </pre>
                      </details>
                    )}
                    {delivery.status === 'delivered' && (
                      <p className="text-sm text-muted-foreground">Delivered {formatDate(delivery.saleDate)}.</p>
                    )}
                    {(deliveryCase?.weOweItems.length || 0) > 0 && (
                      <div className="rounded-lg border p-3">
                        <p className="text-sm font-medium">We-owe items</p>
                        <div className="mt-2 space-y-3">
                          {deliveryCase?.weOweItems.map(item => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 border-t pt-2 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-sm">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.status} · promised {formatDate(item.promisedAt)} · {item.owner?.name || 'Unassigned'}
                                </p>
                              </div>
                              {item.status === 'open' && (
                                <div className="flex shrink-0 gap-2">
                                  <Button size="sm" variant="outline" onClick={() => closeWeOwe(delivery, item, 'fulfill')} disabled={activeId === delivery.id}>
                                    Fulfill
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => closeWeOwe(delivery, item, 'waive')} disabled={activeId === delivery.id}>
                                    Waive
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {openWeOwe.length > 0 && (
                      <p className="text-xs text-amber-700">
                        {openWeOwe.length} open we-owe{openWeOwe.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

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
                  <span className="font-medium">Appointment</span>
                  <Input
                    id="delivery-appointment"
                    type="datetime-local"
                    required
                    min={localDateTimeValue(new Date(Date.now() - 300_000))}
                    value={task.fields.appointmentAt || ''}
                    onChange={event => updateTaskField('appointmentAt', event.target.value)}
                  />
                </label>
              )}
              {task?.kind === 'checklist' && (
                <>
                  <div className="grid gap-1.5 text-sm">
                    <span className="font-medium" id="delivery-checklist-code-label">
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
                    <span className="font-medium">Reference</span>
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
                  <span className="font-medium">Customer acknowledgment reference</span>
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
                    <span className="font-medium">Description</span>
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
                    <span className="font-medium">Promised by</span>
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
                    <span className="font-medium">{task.action === 'waive' ? 'Waiver' : 'Fulfillment'} reference</span>
                    <Input
                      id="we-owe-fulfillment"
                      required
                      value={task.fields.fulfillmentEvidence || ''}
                      onChange={event => updateTaskField('fulfillmentEvidence', event.target.value)}
                    />
                  </label>
                  <label htmlFor="we-owe-ack" className="grid gap-1.5 text-sm">
                    <span className="font-medium">Customer acknowledgment reference</span>
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
                <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={task.fields.confirmed === 'yes'}
                    onChange={event => updateTaskField('confirmed', event.target.checked ? 'yes' : '')}
                  />
                  <span>The vehicle is ready for delivery.</span>
                </label>
              )}
              {taskError && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {taskError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(activeId)}
                  onClick={() => {
                    setTask(null)
                    setTaskError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={Boolean(activeId)}>
                  {activeId ? 'Saving…' : task?.kind === 'complete' ? 'Complete delivery' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  )
}
