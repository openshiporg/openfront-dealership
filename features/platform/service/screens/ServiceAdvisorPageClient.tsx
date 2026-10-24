'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import {
  Code,
  DeskHeader,
  DeskSection,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  TitleLine,
  Track,
} from '@/features/platform/components/desk'
import { dayKey, formatPhone } from '@/features/platform/lib/format'
import { cn } from '@/lib/utils'
import { bookServiceAppointment, getFixedOpsWorkspace, openServiceOrder, transitionServiceAppointment } from '../actions'
import { createAttemptKeys } from '../lib/attemptKeys'
import { formatCents, formatDateTime } from '../lib/serviceFormat'
import {
  APPOINTMENT_ACTION_LABELS,
  APPOINTMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  STATUS_TONES,
  appointmentTransitions,
  customerName,
  roReference,
} from '../lib/serviceStatus'
import { EMPTY_BOOKING, bookingFields, repairOrderTotalsCheck, splitLocalDateTime } from '../lib/serviceTasks'
import type { FixedOpsAppointment, FixedOpsOrder, FixedOpsPart, FixedOpsWorkspace } from '../lib/types'

const appointmentFilters = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'waiting-parts', label: 'Waiting parts' },
  { value: 'all', label: 'All' },
]

const orderFilters = ['all', ...ORDER_STATUSES] as const

function isToday(value: string | null, timeZone: string) {
  if (!value) return false
  return dayKey(value, timeZone) === dayKey(Date.now(), timeZone)
}

function Empty({ label, onReset }: { label: string; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
      <p>{label}</p>
      {onReset && (
        <Track>
          <Pill size="sm" className="max-sm:h-11" onClick={onReset}>Reset filters</Pill>
        </Track>
      )}
    </div>
  )
}

export function ServiceAdvisorPageClient({
  initialWorkspace,
  initialError,
  timeZone,
}: {
  initialWorkspace: FixedOpsWorkspace | null
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<FixedOpsWorkspace | null>(initialWorkspace)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [appointmentFilter, setAppointmentFilter] = useState('open')
  const [orderFilter, setOrderFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('appointment')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [booking, setBooking] = useState<{ values: Record<string, string>; idempotencyKey: string } | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const attemptKeys = useRef(createAttemptKeys('service-appointment')).current

  const appointments: FixedOpsAppointment[] = useMemo(() => workspace?.appointments || [], [workspace])
  const orders: FixedOpsOrder[] = useMemo(() => workspace?.orders || [], [workspace])
  const parts: FixedOpsPart[] = workspace?.parts || []
  const serviceRooftops = workspace?.serviceRooftops || []

  const loadServiceData = async () => {
    setLoading(true)
    const response = await getFixedOpsWorkspace()
    if (response.success && response.data) {
      setWorkspace(response.data.fixedOpsWorkspace)
      setError(null)
    } else {
      setError(response.error || 'Unable to load service.')
    }
    setLoading(false)
  }

  const openBooking = () => {
    setBookingError(null)
    setBooking({ values: { ...EMPTY_BOOKING }, idempotencyKey: `desk-service:${crypto.randomUUID()}` })
  }
  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!booking) return
    setBookingBusy(true)
    setBookingError(null)
    try {
      const values = booking.values
      const { date, time } = splitLocalDateTime(values.appointmentAt || '')
      const response = await bookServiceAppointment({
        customerName: values.customerName.trim(),
        customerEmail: values.customerEmail.trim(),
        customerPhone: values.customerPhone.trim(),
        appointmentDate: date,
        appointmentTime: time,
        serviceType: values.serviceType,
        vehicleYear: Number(values.vehicleYear),
        vehicleMake: values.vehicleMake.trim(),
        vehicleModel: values.vehicleModel.trim(),
        description: values.description.trim() || undefined,
        idempotencyKey: booking.idempotencyKey,
      })
      if (!response.success) throw new Error(response.error)
      setBooking(null)
      setNotice({ tone: 'ok', text: 'Appointment booked' })
      await loadServiceData()
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to book appointment')
    } finally {
      setBookingBusy(false)
    }
  }

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    const scope = `${appointmentId}:${status}`
    setUpdatingId(appointmentId)
    const response = await transitionServiceAppointment({ id: appointmentId, toStatus: status, idempotencyKey: attemptKeys.key(scope) })
    attemptKeys.settle(scope, response)
    setNotice(response.success ? { tone: 'ok', text: APPOINTMENT_STATUS_LABELS[status] || 'Saved' } : { tone: 'bad', text: `Unable to update appointment: ${response.error}` })
    await loadServiceData()
    setUpdatingId(null)
  }

  const createRepairOrder = async (appointment: FixedOpsAppointment) => {
    setUpdatingId(appointment.id)
    const response = await openServiceOrder({
      appointmentId: appointment.id,
      // One RO per appointment, so the appointment id makes the key replay-safe.
      idempotencyKey: `service-order:${appointment.id}`,
      diagnosis: appointment.description || '',
      laborTotalCents: 0,
      partsTotalCents: 0,
      taxCents: 0,
      grandTotalCents: 0,
    })
    if (!response.success) {
      setNotice({ tone: 'bad', text: `Unable to open repair order: ${response.error}` })
      setUpdatingId(null)
      return
    }
    if (appointment.status === 'scheduled') {
      const scope = `${appointment.id}:checked-in`
      const checkIn = await transitionServiceAppointment({ id: appointment.id, toStatus: 'checked-in', idempotencyKey: attemptKeys.key(scope) })
      attemptKeys.settle(scope, checkIn)
    }
    router.push(`${basePath}/platform/service/orders/${response.data.openServiceOrder.id}`)
  }

  const term = search.trim().toLowerCase()
  const filteredAppointments = useMemo(() => {
    const queued = appointmentFilter === 'today' ? appointments.filter(item => isToday(item.appointmentDate, timeZone))
      : appointmentFilter === 'open' ? appointments.filter(item => !['completed', 'cancelled'].includes(item.status || ''))
        : appointmentFilter === 'waiting-parts' ? appointments.filter(item => item.status === 'waiting-parts')
          : appointments
    return queued
      .filter(item => !term || `${item.customerVehicleDescription || ''} ${item.description || ''} ${item.lead?.firstName || ''} ${item.lead?.lastName || ''} ${item.lead?.phone || ''}`.toLowerCase().includes(term))
      .sort((a, b) => sortOrder === 'recent'
        ? new Date(b.appointmentDate || 0).getTime() - new Date(a.appointmentDate || 0).getTime()
        : new Date(a.appointmentDate || '9999-12-31').getTime() - new Date(b.appointmentDate || '9999-12-31').getTime())
  }, [appointments, appointmentFilter, term, sortOrder, timeZone])

  const appointmentByOrder = useMemo(() => new Map(appointments.filter(item => item.serviceOrder).map(item => [item.serviceOrder!.id, item])), [appointments])
  const visibleOrders = useMemo(() => orders.filter(order => {
    const lead = appointmentByOrder.get(order.id)?.lead
    return !term || `${order.id} ${roReference(order.id)} ${order.invoiceNumber || ''} ${order.appointment?.customerVehicleDescription || ''} ${order.concern || ''} ${lead?.firstName || ''} ${lead?.lastName || ''}`.toLowerCase().includes(term)
  }), [orders, term, appointmentByOrder])

  const resetFilters = () => {
    setSearch('')
    setAppointmentFilter('open')
    setOrderFilter('all')
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Service' },
  ]

  const orderCounts: Record<string, number> = { all: visibleOrders.length }
  for (const order of visibleOrders) orderCounts[order.status || ''] = (orderCounts[order.status || ''] || 0) + 1
  const shownOrders = orderFilter === 'all' ? visibleOrders : visibleOrders.filter(order => order.status === orderFilter)

  const appointmentCounts: Record<string, number> = {
    open: appointments.filter(item => !['completed', 'cancelled'].includes(item.status || '')).length,
    today: appointments.filter(item => isToday(item.appointmentDate, timeZone)).length,
    'waiting-parts': appointments.filter(item => item.status === 'waiting-parts').length,
    all: appointments.length,
  }
  const workingOrders = orders.filter(order => ['estimate', 'approved', 'in-progress', 'completed'].includes(order.status || ''))
  const workingValue = workingOrders.reduce((sum, order) => sum + (order.grandTotalCents || 0), 0)
  const lowParts = parts.filter(part => (part.minimumQuantity ?? 0) > 0 && (part.quantity ?? 0) <= (part.minimumQuantity ?? 0))

  const header = (
    <DeskHeader
      title="Service"
      tone={error ? 'bad' : appointmentCounts['waiting-parts'] > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${appointmentCounts['waiting-parts']} waiting parts`}
      meta={error ? 'Unavailable' : `${appointmentCounts.today} appointments today · ${workingOrders.length} open ROs`}
      actions={
        <Track>
          <Pill className="max-sm:h-11" onClick={loadServiceData} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill className="max-sm:h-11" variant="primary" onClick={openBooking} disabled={!serviceRooftops.length} title={serviceRooftops.length ? undefined : 'No active service locations'}>
            <Plus />
            New appointment
          </Pill>
        </Track>
      }
    />
  )

  if (error && !workspace) {
    return (
      <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Service is unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
          <Track>
            <Pill className="max-sm:h-11" onClick={loadServiceData} disabled={loading}>Retry</Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone={notice.tone}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice.text}</p>
              <Track>
                <Pill size="sm" variant="plain" className="max-sm:h-11" onClick={() => setNotice(null)}>Dismiss</Pill>
              </Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
        {!serviceRooftops.length && <Notice tone="warn">No active service locations</Notice>}

        <ReadoutStrip>
          <Readout label="Today" value={appointmentCounts.today} tone={appointmentCounts.today > 0 ? 'info' : 'idle'} sub="Appointments" />
          <Readout label="Open ROs" value={workingOrders.length} tone={workingOrders.length > 0 ? 'warn' : 'idle'} />
          <Readout label="Open RO value" value={formatCents(workingValue)} />
          <Readout label="Waiting parts" value={appointmentCounts['waiting-parts']} tone={appointmentCounts['waiting-parts'] > 0 ? 'warn' : 'ok'} />
          <Readout label="Low stock" value={lowParts.length} tone={lowParts.length > 0 ? 'bad' : 'ok'} sub={`${parts.length} parts`} />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search service records"
              className="h-11 rounded-full pl-9 sm:h-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search customer, vehicle, concern, RO, or invoice"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger aria-label="Sort appointments" className="h-11 w-full rounded-full sm:h-9 sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="appointment">Appointment first</SelectItem>
              <SelectItem value="recent">Most recent first</SelectItem>
            </SelectContent>
          </Select>
          {loading && <span className="text-sm text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        <DeskSection
          title="Repair orders"
          count={visibleOrders.length}
          actions={
            <Segmented
              label="Filter repair orders"
              size="sm"
              value={orderFilter}
              onChange={setOrderFilter}
              options={orderFilters.map(value => ({
                value,
                label: value === 'all' ? 'All' : ORDER_STATUS_LABELS[value],
                count: orderCounts[value] || 0,
                tone: value === 'all' ? undefined : STATUS_TONES[value],
              }))}
            />
          }
        >
          {shownOrders.length === 0 ? (
            term || orderFilter !== 'all' ? <Empty label="No matching repair orders" onReset={resetFilters} /> : <Empty label="No repair orders" />
          ) : (
            <Panel className="divide-y overflow-hidden">
              {shownOrders.map(order => {
                const appointment = appointmentByOrder.get(order.id)
                const name = customerName(appointment?.lead)
                const status = order.status || 'estimate'
                const balanced = repairOrderTotalsCheck({ ...order, lineItems: order.lineItems || [] }).matches
                const openOps = order.laborOperations.filter(operation => !['completed', 'cancelled'].includes(operation.status)).length
                return (
                  <Link
                    key={order.id}
                    href={`${basePath}/platform/service/orders/${order.id}`}
                    className="flex min-h-11 w-full min-w-0 items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <TitleLine as="p" tone={STATUS_TONES[status] || 'idle'} status={ORDER_STATUS_LABELS[status] || status} className="text-sm font-medium">
                        <Code className="text-foreground">{roReference(order.id)}</Code> {name ? `${name} · ` : ''}{order.appointment?.customerVehicleDescription || 'Vehicle not set'}
                      </TitleLine>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        {ORDER_STATUS_LABELS[status] || status} · {formatDateTime(order.appointment?.appointmentDate || null, timeZone)} · <span className="capitalize">{order.authorizationStatus || 'pending'}</span>
                        {openOps ? ` · ${openOps} open ops` : ''}
                        {balanced ? '' : ' · Totals mismatch'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{formatCents(order.grandTotalCents)}</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{order.lineItems.length} lines</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </Link>
                )
              })}
            </Panel>
          )}
        </DeskSection>

        <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DeskSection
            title="Appointments"
            count={filteredAppointments.length}
            actions={
              <Segmented
                label="Filter appointments"
                size="sm"
                value={appointmentFilter}
                onChange={setAppointmentFilter}
                options={appointmentFilters.map(option => ({ ...option, count: appointmentCounts[option.value] }))}
              />
            }
          >
            {filteredAppointments.length === 0 ? (
              term || appointmentFilter !== 'open' ? <Empty label="No matching appointments" onReset={resetFilters} /> : <Empty label="No service appointments" />
            ) : (
              <Panel className="divide-y">
                {filteredAppointments.map(appointment => {
                  const status = appointment.status || 'scheduled'
                  const name = customerName(appointment.lead)
                  const transitions = appointmentTransitions(status)
                  const closed = ['completed', 'cancelled'].includes(status)
                  const busy = updatingId === appointment.id
                  return (
                    <div key={appointment.id} className="flex min-w-0 flex-col gap-2.5 px-4 py-3">
                      <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={STATUS_TONES[status] || 'idle'} status={APPOINTMENT_STATUS_LABELS[status] || status} className="text-sm font-medium">
                            <Link href={`${basePath}/platform/service/appointments/${appointment.id}`} className="hover:underline">
                              {name ? `${name} · ` : ''}{appointment.customerVehicleDescription || 'Vehicle not set'}
                            </Link>
                          </TitleLine>
                          <p className="pl-4 text-xs text-muted-foreground">
                            {APPOINTMENT_STATUS_LABELS[status] || status} · <span className="capitalize">{appointment.servicePackage?.name || appointment.serviceType || 'Service'}</span> · {appointment.assignedTech?.name || 'Unassigned'}
                            {appointment.lead?.phone ? ` · ${formatPhone(appointment.lead.phone)}` : ''}
                          </p>
                          {appointment.description && <p className="line-clamp-2 pl-4 text-xs text-muted-foreground">{appointment.description}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="whitespace-nowrap font-mono text-xs tabular-nums">{formatDateTime(appointment.appointmentDate, timeZone)}</p>
                          {appointment.serviceOrder && (
                            <Link href={`${basePath}/platform/service/orders/${appointment.serviceOrder.id}`} className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground hover:underline">
                              {roReference(appointment.serviceOrder.id)} · {formatCents(appointment.serviceOrder.grandTotalCents)}
                            </Link>
                          )}
                        </div>
                      </div>
                      {((!appointment.serviceOrder && !closed) || transitions.length > 0) && (
                        <Track className="self-start">
                          {!appointment.serviceOrder && !closed && (
                            <Pill size="sm" variant="primary" className="max-sm:h-11" onClick={() => createRepairOrder(appointment)} disabled={busy}>
                              Open RO
                            </Pill>
                          )}
                          {transitions.filter(next => next !== 'cancelled').map(next => (
                            <Pill key={next} size="sm" className="max-sm:h-11" onClick={() => updateAppointmentStatus(appointment.id, next)} disabled={busy}>
                              {APPOINTMENT_ACTION_LABELS[next]}
                            </Pill>
                          ))}
                        </Track>
                      )}
                    </div>
                  )
                })}
              </Panel>
            )}
          </DeskSection>

          <DeskSection
            title="Low stock"
            count={lowParts.length}
            actions={
              <Track>
                <Pill size="sm" className="max-sm:h-11" asChild>
                  <Link href={`${basePath}/platform/parts`}>Parts</Link>
                </Pill>
              </Track>
            }
          >
            {lowParts.length === 0 ? (
              <Empty label={parts.length ? 'No parts below reorder point' : 'No parts configured'} />
            ) : (
              <Panel className="divide-y">
                {lowParts.map(part => (
                  <div key={part.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <TitleLine as="p" tone="bad" status="Low stock" className="text-sm font-medium">
                        {part.description || part.partNumber}
                      </TitleLine>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        <Code>#{part.partNumber}</Code> · {part.supplier || 'No supplier'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn('text-sm font-semibold tabular-nums text-red-600 dark:text-red-400')}>{part.quantity ?? 0} left</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Reorder at {part.minimumQuantity ?? 0}</p>
                    </div>
                  </div>
                ))}
              </Panel>
            )}
          </DeskSection>
        </div>

        <OperatorActionDialog
          open={Boolean(booking)}
          title="New appointment"
          fields={bookingFields()}
          values={booking?.values || {}}
          error={bookingError}
          busy={bookingBusy}
          submitLabel="Book appointment"
          onValuesChange={values => setBooking(current => (current ? { ...current, values } : null))}
          onSubmit={submitBooking}
          onOpenChange={open => {
            if (!open) {
              setBooking(null)
              setBookingError(null)
            }
          }}
        />
      </div>
    </PageContainer>
  )
}
