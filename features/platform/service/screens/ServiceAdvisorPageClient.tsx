'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { SERVICE_APPOINTMENT_TRANSITIONS } from '@/features/keystone/lifecycle/serviceAppointmentTransitions'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
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
import { dayKey, formatPhone, recordReference } from '@/features/platform/lib/format'
import { cn } from '@/lib/utils'
import {
  addServiceOrderLineItem,
  bookServiceAppointment,
  configurePart,
  getFixedOpsWorkspace,
  getRooftopStaff,
  manageLaborOperation,
  openServiceOrder,
  recordPartsMovement,
  recordServiceOrderEvidence,
  transitionServiceAppointment,
  transitionServiceOrder,
} from '../actions'
import {
  EMPTY_BOOKING,
  bookingFields,
  serviceTaskFields,
  serviceTaskRequest,
  repairOrderTotalsCheck,
  splitLocalDateTime,
  type ServiceChoice,
  type ServiceTask,
  type ServiceTaskOperation,
} from '../lib/serviceTasks'
import type { FixedOpsLineItem, FixedOpsWorkspace } from '../lib/types'


const serviceTaskActions: Record<ServiceTaskOperation, (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>> = {
  recordServiceOrderEvidence,
  addServiceOrderLineItem,
  manageLaborOperation,
  configurePart,
  recordPartsMovement,
}

type ServiceAppointment = {
  id: string
  rooftop: { id: string }
  appointmentDate: string | null
  serviceType: string | null
  status: string | null
  customerVehicleDescription: string | null
  description: string | null
  estimatedDuration: number | null
  mileageIn: number | null
  advisorNotes: string | null
  assignedTech: { id: string; name: string | null } | null
  serviceOrder: { id: string; status: string | null; grandTotal: number | null } | null
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null
}

type ServiceOrder = {
  id: string
  rooftop: { id: string; name: string } | null
  payType: string
  authorizationEvidence: { reference?: string }
  status: string | null
  concern: string
  cause: string
  correction: string
  authorizationStatus: string
  invoiceNumber: string | null
  laborOperations: { id: string; operationCode: string; description: string; status: string; technician: { id: string; name: string } | null }[]
  lineItems: FixedOpsLineItem[]
  lineLaborTotal: number
  linePartsTotal: number
  totalsMatchLines: boolean
  laborTotal: number | null
  partsTotal: number | null
  tax: number | null
  grandTotal: number | null
  completedAt: string | null
  updatedAt: string
  appointment: {
    id: string
    appointmentDate: string | null
    serviceType: string | null
    customerVehicleDescription: string | null
    assignedTech: { name: string | null } | null
  } | null
}

type Part = {
  id: string
  partNumber: string | null
  description: string | null
  quantity: number | null
  minimumQuantity: number | null
  price: number | null
  supplier: string | null
}

const appointmentStatuses = [
  'scheduled',
  'checked-in',
  'in-progress',
  'waiting-parts',
  'completed',
  'cancelled',
]

const nextOrderStatus: Record<string, string | undefined> = {
  estimate: 'approved',
  approved: 'in-progress',
  'in-progress': 'completed',
  completed: 'invoiced',
  invoiced: 'paid',
  paid: undefined,
}

const appointmentStatusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  'checked-in': 'Checked In',
  'in-progress': 'In Progress',
  'waiting-parts': 'Waiting Parts',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const orderStatusLabels: Record<string, string> = {
  estimate: 'Estimate',
  approved: 'Approved',
  'in-progress': 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
  paid: 'Settled',
}


function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleString('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function isToday(value: string | null, timeZone: string) {
  if (!value) return false
  return dayKey(value, timeZone) === dayKey(Date.now(), timeZone)
}

function toAppointments(workspace: FixedOpsWorkspace | null | undefined): ServiceAppointment[] {
  return (workspace?.appointments || []).map(appointment => ({
    ...appointment,
    serviceOrder: appointment.serviceOrder
      ? { id: appointment.serviceOrder.id, status: appointment.serviceOrder.status, grandTotal: (appointment.serviceOrder.grandTotalCents ?? 0) / 100 }
      : null,
  }))
}

const lineItemTypeLabels: Record<string, string> = {
  labor: 'Labor',
  part: 'Part',
  sublet: 'Sublet',
}

function toOrders(workspace: FixedOpsWorkspace | null | undefined): ServiceOrder[] {
  return (workspace?.orders || []).map(order => {
    const lineItems = order.lineItems || []
    const check = repairOrderTotalsCheck({ ...order, lineItems })
    return {
      ...order,
      lineItems,
      lineLaborTotal: check.lineLaborCents / 100,
      linePartsTotal: check.linePartsCents / 100,
      totalsMatchLines: check.matches,
      laborTotal: (order.laborTotalCents ?? 0) / 100,
      partsTotal: (order.partsTotalCents ?? 0) / 100,
      tax: (order.taxCents ?? 0) / 100,
      grandTotal: (order.grandTotalCents ?? 0) / 100,
    }
  })
}

function toParts(workspace: FixedOpsWorkspace | null | undefined): Part[] {
  return (workspace?.parts || []).map(part => ({ ...part, price: (part.priceCents ?? 0) / 100 }))
}

function toRooftops(workspace: FixedOpsWorkspace | null | undefined): ServiceChoice[] {
  return (workspace?.serviceRooftops || []).map(item => ({ value: item.id, label: item.name }))
}

const statusTones: Record<string, DeskTone> = {
  scheduled: 'info',
  'checked-in': 'info',
  estimate: 'idle',
  approved: 'info',
  'in-progress': 'warn',
  'waiting-parts': 'warn',
  completed: 'ok',
  invoiced: 'info',
  paid: 'ok',
  cancelled: 'bad',
}

const laborTones: Record<string, DeskTone> = {
  open: 'idle',
  dispatched: 'info',
  'in-progress': 'warn',
  paused: 'warn',
  completed: 'ok',
  cancelled: 'bad',
}

const appointmentFilters = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'waiting-parts', label: 'Waiting parts' },
  { value: 'all', label: 'All' },
]

const orderFilters = ['all', 'estimate', 'approved', 'in-progress', 'completed', 'invoiced', 'paid']

/** Display reference only; a sequential RO number needs a schema field. */
function roReference(id: string) {
  return recordReference('RO', id) || 'RO'
}

function Empty({ label, onReset }: { label: string; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
      <p>{label}</p>
      {onReset && (
        <Track>
          <Pill size="sm" onClick={onReset}>Reset filters</Pill>
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
  const [appointments, setAppointments] = useState<ServiceAppointment[]>(toAppointments(initialWorkspace))
  const [orders, setOrders] = useState<ServiceOrder[]>(toOrders(initialWorkspace))
  const [parts, setParts] = useState<Part[]>(toParts(initialWorkspace))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [appointmentFilter, setAppointmentFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('appointment')
  const [task, setTask] = useState<ServiceTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [serviceRooftops, setServiceRooftops] = useState<ServiceChoice[]>(toRooftops(initialWorkspace))
  const [staff, setStaff] = useState<ServiceChoice[]>([])
  const [orderFilter, setOrderFilter] = useState('all')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [booking, setBooking] = useState<{ values: Record<string, string>; idempotencyKey: string } | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)

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
      setNotice('Appointment booked')
      await loadServiceData()
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to book appointment')
    } finally {
      setBookingBusy(false)
    }
  }

  const openTask = (next: Omit<ServiceTask, 'idempotencyKey'>) => {
    setTaskError(null)
    setTask({ ...next, idempotencyKey: `service-${next.kind}:${crypto.randomUUID()}` })
  }
  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    setUpdatingId(task.recordId || 'part'); setTaskError(null)
    try {
      const request = serviceTaskRequest(task)
      const response = await serviceTaskActions[request.operation](request.data)
      if (!response.success) throw new Error(response.error)
      setTask(null)
      setNotice('Saved')
      await loadServiceData()
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Unable to save')
    } finally {
      setUpdatingId(null)
    }
  }

  const loadServiceData = async () => {
    setLoading(true)
    setError(null)

    const response = await getFixedOpsWorkspace()

    if (response.success && response.data) {
      const workspace = response.data.fixedOpsWorkspace
      setServiceRooftops(toRooftops(workspace))
      setAppointments(toAppointments(workspace))
      setOrders(toOrders(workspace))
      setParts(toParts(workspace))
    } else {
      setError(response.error || 'Unable to load service.')
    }

    setLoading(false)
  }

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    setUpdatingId(appointmentId)
    const response = await transitionServiceAppointment({
      id: appointmentId,
      toStatus: status,
      idempotencyKey: `service-appointment:${appointmentId}:${status}`,
    })

    if (!response.success) {
      setNotice(`Unable to update appointment: ${response.error}`)
    }

    await loadServiceData()
    setUpdatingId(null)
  }

  const recordRepairEvidence = (order: ServiceOrder) =>
    openTask({
      kind: 'evidence',
      recordId: order.id,
      expectedUpdatedAt: order.updatedAt,
      values: {
        concern: order.concern,
        cause: order.cause,
        correction: order.correction,
        payType: order.payType || 'customer',
        authorizationStatus: order.authorizationStatus || 'pending',
        reference: order.authorizationEvidence?.reference || '',
        invoiceNumber: order.invoiceNumber || '',
      },
    })

  const manageLabor = async (order: ServiceOrder) => {
    const operation = order.laborOperations.find(item => !['completed', 'cancelled'].includes(item.status))
    const actions: Record<string, ServiceTask['action']> = { open: 'dispatch', dispatched: 'start', paused: 'start', 'in-progress': 'complete' }
    const action = operation ? actions[operation.status] : 'create'
    if (!action) { setNotice('No available labor transition'); return }
    setStaff([])
    openTask({ kind: 'labor', recordId: order.id, operationId: operation?.id, action, values: { operationCode: '', description: '', soldHours: '', technicianId: '', actualMinutes: '' } })
    if (action === 'dispatch' && order.rooftop?.id) {
      const response = await getRooftopStaff(order.rooftop.id)
      if (response.success && response.data) {
        setStaff(response.data.users.map(user => ({ value: user.id, label: user.name })))
        if (!response.data.users.length) setTaskError('No eligible staff at this location')
      } else setTaskError(response.error || 'Unable to load staff')
    }
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId)

    const response = await transitionServiceOrder({
      id: orderId,
      toStatus: status,
      idempotencyKey: `service-order-transition:${orderId}:${status}`,
    })

    if (!response.success) {
      setNotice(`Unable to update repair order: ${response.error}`)
    }

    await loadServiceData()
    setUpdatingId(null)
  }

  const createRepairOrder = async (appointment: ServiceAppointment) => {
    setUpdatingId(appointment.id)

    const response = await openServiceOrder({
      appointmentId: appointment.id,
      idempotencyKey: `service-order:${appointment.id}`,
      diagnosis: appointment.description || 'Diagnosis pending.',
      laborTotalCents: 0,
      partsTotalCents: 0,
      taxCents: 0,
      grandTotalCents: 0,
    })

    if (response.success) {
      await updateAppointmentStatus(appointment.id, 'checked-in')
    } else {
      setNotice(`Unable to open repair order: ${response.error}`)
      setUpdatingId(null)
    }
  }

  const addLaborLine = (order: ServiceOrder) =>
    openTask({ kind: 'labor-line', recordId: order.id, expectedUpdatedAt: order.updatedAt, values: { description: '', amount: '' } })
  const configurePartRecord = () =>
    openTask({
      kind: 'part',
      values: {
        rooftopId: serviceRooftops.length === 1 ? serviceRooftops[0].value : '',
        partNumber: '',
        description: '',
        binLocation: '',
        minimumQuantity: '0',
        cost: '',
        price: '',
        supplier: '',
      },
    })
  const receivePart = (part: Part) => openTask({ kind: 'receipt', recordId: part.id, values: { quantity: '', reference: '' } })

  const filteredAppointments = useMemo(() => {
    const queued = appointmentFilter === 'today' ? appointments.filter(appointment => isToday(appointment.appointmentDate, timeZone))
      : appointmentFilter === 'open' ? appointments.filter(appointment => !['completed', 'cancelled'].includes(appointment.status || ''))
        : appointmentFilter === 'waiting-parts' ? appointments.filter(appointment => appointment.status === 'waiting-parts')
          : appointments
    const term = search.trim().toLowerCase()
    return queued.filter(item => !term || `${item.customerVehicleDescription || ''} ${item.description || ''} ${item.lead?.firstName || ''} ${item.lead?.lastName || ''}`.toLowerCase().includes(term)).sort((a, b) => sortOrder === 'recent'
      ? new Date(b.appointmentDate || 0).getTime() - new Date(a.appointmentDate || 0).getTime()
      : new Date(a.appointmentDate || '9999-12-31').getTime() - new Date(b.appointmentDate || '9999-12-31').getTime())
  }, [appointments, appointmentFilter, search, sortOrder])
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter(order => !term || `${order.id} ${roReference(order.id)} ${order.invoiceNumber || ''} ${order.appointment?.customerVehicleDescription || ''} ${order.concern || ''}`.toLowerCase().includes(term))
  }, [orders, search])

  const searchTerm = search.trim()
  const resetFilters = () => {
    setSearch('')
    setAppointmentFilter('open')
  }

  const taskTitle =
    task?.kind === 'evidence'
      ? 'Concern, cause, and authorization'
      : task?.kind === 'labor-line'
        ? 'Labor charge'
        : task?.kind === 'part'
          ? 'Configure part'
          : task?.kind === 'receipt'
            ? 'Receive stock'
            : task?.action === 'dispatch'
              ? 'Assign technician'
              : task?.action === 'complete'
                ? 'Complete labor'
                : task?.action === 'start'
                  ? 'Start labor'
                  : 'Add labor operation'

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Service' },
  ]

  const orderCounts: Record<string, number> = { all: visibleOrders.length }
  for (const order of visibleOrders) orderCounts[order.status || ''] = (orderCounts[order.status || ''] || 0) + 1
  const shownOrders = (orderFilter === 'all' ? visibleOrders : visibleOrders.filter(order => order.status === orderFilter)).slice(0, 25)
  const selectedOrder = shownOrders.find(order => order.id === selectedOrderId) ?? shownOrders[0] ?? null
  const appointmentForOrder = (orderId: string) => appointments.find(appointment => appointment.serviceOrder?.id === orderId)

  const appointmentCounts: Record<string, number> = {
    open: appointments.filter(appointment => !['completed', 'cancelled'].includes(appointment.status || '')).length,
    today: appointments.filter(appointment => isToday(appointment.appointmentDate, timeZone)).length,
    'waiting-parts': appointments.filter(appointment => appointment.status === 'waiting-parts').length,
    all: appointments.length,
  }
  const workingOrders = orders.filter(order => ['estimate', 'approved', 'in-progress', 'completed'].includes(order.status || ''))
  const workingValue = workingOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
  const lowStock = parts.filter(part => (part.minimumQuantity ?? 0) > 0 && (part.quantity ?? 0) <= (part.minimumQuantity ?? 0)).length

  const header = (
    <DeskHeader
      title="Service"
      tone={error ? 'bad' : appointmentCounts['waiting-parts'] > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${appointmentCounts['waiting-parts']} waiting parts`}
      meta={error ? 'Unavailable' : `${appointmentCounts.today} appointments today · ${workingOrders.length} open ROs`}
      actions={
        <Track>
          <Pill onClick={loadServiceData} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill onClick={configurePartRecord} disabled={updatingId === 'part' || !serviceRooftops.length}>
            Configure part
          </Pill>
          <Pill variant="primary" onClick={openBooking} disabled={!serviceRooftops.length}>
            <Plus />
            New appointment
          </Pill>
        </Track>
      }
    />
  )

  if (error) {
    return (
      <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Service is unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
          <Track>
            <Pill onClick={loadServiceData}>Retry</Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const renderOrderDetail = (order: ServiceOrder) => {
    const nextStatus = order.status ? nextOrderStatus[order.status] : undefined
    const appointment = appointmentForOrder(order.id)
    const customer = appointment?.lead
    const working = Boolean(order.status && ['estimate', 'approved', 'in-progress'].includes(order.status))
    const busy = updatingId === order.id
    const status = order.status || 'unknown'
    return (
      <div className="min-w-0 space-y-6">
        <div className="min-w-0 space-y-3">
          <div className="min-w-0">
            <TitleLine as="h2" tone={statusTones[status] || 'idle'} status={orderStatusLabels[status] || status} className="text-lg font-semibold tracking-tight">
              <Code className="text-base text-foreground">{roReference(order.id)}</Code> {order.appointment?.customerVehicleDescription || 'Vehicle not set'}
            </TitleLine>
            <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
              {[
                orderStatusLabels[status] || status,
                customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'Customer' : null,
                order.rooftop?.name,
                order.appointment?.assignedTech?.name || 'Unassigned',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {(working || order.status === 'invoiced' || nextStatus) && (
            <Track>
              {working && (
                <>
                  <Pill size="sm" onClick={() => recordRepairEvidence(order)} disabled={busy}>CCC & authorization</Pill>
                  <Pill size="sm" onClick={() => addLaborLine(order)} disabled={busy}>Add labor line</Pill>
                  <Pill size="sm" onClick={() => manageLabor(order)} disabled={busy}>Labor</Pill>
                </>
              )}
              {order.status === 'invoiced' ? (
                <Pill size="sm" variant="primary" asChild>
                  <Link href={`${basePath}/platform/accounting`}>Payments</Link>
                </Pill>
              ) : (
                nextStatus && (
                  <Pill size="sm" variant="primary" onClick={() => updateOrderStatus(order.id, nextStatus)} disabled={busy}>
                    {orderStatusLabels[nextStatus]}
                  </Pill>
                )
              )}
            </Track>
          )}
        </div>

        <DeskSection title="Repair">
          <Facts
            items={[
              { label: 'Appointment', value: formatDateTime(order.appointment?.appointmentDate || null, timeZone) },
              { label: 'Service', value: <span className="capitalize">{order.appointment?.serviceType || 'service'}</span> },
              customer?.phone ? { label: 'Phone', value: formatPhone(customer.phone), mono: true } : null,
              { label: 'Concern', value: order.concern || '-' },
              { label: 'Cause', value: order.cause || '-' },
              { label: 'Correction', value: order.correction || '-' },
              { label: 'Pay type', value: <span className="capitalize">{order.payType || '-'}</span> },
              {
                label: 'Authorization',
                value: (
                  <TitleLine as="span" tone={order.authorizationStatus === 'authorized' || order.authorizationStatus === 'approved' ? 'ok' : order.authorizationStatus === 'declined' ? 'bad' : 'warn'} className="justify-end capitalize">
                    {order.authorizationStatus || 'pending'}
                  </TitleLine>
                ),
              },
              order.authorizationEvidence?.reference ? { label: 'Authorization ref', value: order.authorizationEvidence.reference, mono: true } : null,
              order.invoiceNumber ? { label: 'Invoice', value: order.invoiceNumber, mono: true } : null,
              order.completedAt ? { label: 'Completed', value: formatDateTime(order.completedAt, timeZone) } : null,
            ]}
          />
        </DeskSection>

        <DeskSection title="Labor operations" count={order.laborOperations.length}>
          {order.laborOperations.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No labor operations</p>
          ) : (
            <ul className="divide-y text-sm">
              {order.laborOperations.map(operation => (
                <li key={operation.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={laborTones[operation.status] || 'idle'} status={operation.status} className="font-medium">
                      <Code className="text-foreground">{operation.operationCode}</Code> {operation.description}
                    </TitleLine>
                    <p className="pl-4 text-xs text-muted-foreground">{operation.technician?.name || 'Unassigned'}</p>
                  </div>
                  <p className="shrink-0 text-xs capitalize text-muted-foreground">{operation.status}</p>
                </li>
              ))}
            </ul>
          )}
        </DeskSection>

        <DeskSection title="Line items" count={order.lineItems.length}>
          {order.lineItems.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No line items</p>
          ) : (
            <ul className="divide-y text-sm">
              {order.lineItems.map(line => (
                <li key={line.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{line.description}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {[lineItemTypeLabels[line.itemType] || line.itemType, line.partNumber || null, `Qty ${line.quantity} × ${formatCurrency(line.unitPriceCents / 100)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[13px] tabular-nums">{formatCurrency(line.priceCents / 100)}</p>
                </li>
              ))}
            </ul>
          )}
        </DeskSection>

        <DeskSection title="Recorded totals">
          {!order.totalsMatchLines && (
            <Notice tone="warn" className="mb-2">
              <div className="min-w-0">
                <p className="font-medium">Totals don&apos;t match line items</p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  Lines: Labor {formatCurrency(order.lineLaborTotal)} · Parts {formatCurrency(order.linePartsTotal)}
                </p>
              </div>
            </Notice>
          )}
          <dl className="divide-y text-sm">
            {[
              ['Labor', order.laborTotal],
              ['Parts', order.partsTotal],
              ['Tax', order.tax],
            ].map(([label, amount]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-[13px] tabular-nums">{formatCurrency(amount as number | null)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-foreground/20 py-2.5">
              <dt className="font-semibold">Total</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(order.grandTotal)}</dd>
            </div>
          </dl>
        </DeskSection>
      </div>
    )
  }

  return (
    <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone={notice.startsWith('Unable') ? 'bad' : notice === 'Saved' || notice === 'Appointment booked' ? 'ok' : 'info'}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track>
                <Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill>
              </Track>
            </div>
          </Notice>
        )}
        {!serviceRooftops.length && <Notice tone="warn">No active service locations</Notice>}

        <ReadoutStrip>
          <Readout label="Today" value={appointmentCounts.today} tone={appointmentCounts.today > 0 ? 'info' : 'idle'} sub="Appointments" />
          <Readout label="Open ROs" value={workingOrders.length} tone={workingOrders.length > 0 ? 'warn' : 'idle'} />
          <Readout label="Open RO value" value={formatCurrency(workingValue)} />
          <Readout label="Waiting parts" value={appointmentCounts['waiting-parts']} tone={appointmentCounts['waiting-parts'] > 0 ? 'warn' : 'ok'} />
          <Readout label="Low stock" value={lowStock} tone={lowStock > 0 ? 'bad' : 'ok'} sub={`${parts.length} parts`} />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search service records"
              className="rounded-full pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search customer, vehicle, concern, RO, or invoice"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger aria-label="Sort service records" className="w-full rounded-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="appointment">Appointment first</SelectItem>
              <SelectItem value="recent">Most recent first</SelectItem>
            </SelectContent>
          </Select>
          {loading && (
            <span className="text-sm text-muted-foreground" role="status">
              Refreshing…
            </span>
          )}
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
                label: value === 'all' ? 'All' : orderStatusLabels[value],
                count: orderCounts[value] || 0,
                tone: value === 'all' ? undefined : statusTones[value],
              }))}
            />
          }
        >
          {shownOrders.length === 0 ? (
            searchTerm || orderFilter !== 'all' ? (
              <Empty label="No matching repair orders" onReset={() => { resetFilters(); setOrderFilter('all') }} />
            ) : (
              <Empty label="No repair orders" />
            )
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <Panel className="divide-y self-start overflow-hidden">
                {shownOrders.map(order => {
                  const appointment = appointmentForOrder(order.id)
                  const customer = appointment?.lead
                  const status = order.status || 'unknown'
                  const selected = selectedOrder?.id === order.id
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full min-w-0 items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        selected && 'bg-muted/60',
                      )}
                    >
                      <div className="min-w-0">
                        <TitleLine as="p" tone={statusTones[status] || 'idle'} status={orderStatusLabels[status] || status} className="text-sm font-medium">
                          <Code className="text-foreground">{roReference(order.id)}</Code>{' '}
                          {customer ? `${[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer'} · ` : ''}
                          {order.appointment?.customerVehicleDescription || 'Vehicle not set'}
                        </TitleLine>
                        <p className="truncate pl-4 text-xs text-muted-foreground">
                          {orderStatusLabels[status] || status} · {formatDateTime(order.appointment?.appointmentDate || null, timeZone)} ·{' '}
                          <span className="capitalize">{order.appointment?.serviceType || 'service'}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">{formatCurrency(order.grandTotal)}</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{order.laborOperations.length} ops</p>
                      </div>
                    </button>
                  )
                })}
              </Panel>
              <div className="min-w-0">{selectedOrder && renderOrderDetail(selectedOrder)}</div>
            </div>
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
              searchTerm || appointmentFilter !== 'open' ? <Empty label="No matching appointments" onReset={resetFilters} /> : <Empty label="No service appointments" />
            ) : (
              <Panel className="divide-y">
                {filteredAppointments.map(appointment => {
                  const status = appointment.status || 'unknown'
                  const customerName = appointment.lead
                    ? [appointment.lead.firstName, appointment.lead.lastName].filter(Boolean).join(' ') || appointment.lead.email || 'Customer'
                    : null
                  const transitions = appointmentStatuses
                    .filter(next => (SERVICE_APPOINTMENT_TRANSITIONS[appointment.status || ''] || []).includes(next))
                    .slice(0, 3)
                  const busy = updatingId === appointment.id
                  return (
                    <div key={appointment.id} className="flex min-w-0 flex-col gap-2.5 px-4 py-3">
                      <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={statusTones[status] || 'idle'} status={appointmentStatusLabels[status] || status} className="text-sm font-medium">
                            {customerName && appointment.lead ? (
                              <Link href={`${basePath}/platform/crm/${appointment.lead.id}`} className="hover:underline">
                                {customerName}
                              </Link>
                            ) : null}
                            {customerName ? ' · ' : ''}
                            {appointment.customerVehicleDescription || 'Vehicle not set'}
                          </TitleLine>
                          <p className="pl-4 text-xs text-muted-foreground">
                            {appointmentStatusLabels[status] || status} · <span className="capitalize">{appointment.serviceType || 'Service request'}</span> ·{' '}
                            {appointment.assignedTech?.name || 'Unassigned'}
                            {appointment.lead?.phone ? ` · ${formatPhone(appointment.lead.phone)}` : ''}
                          </p>
                          <p className="line-clamp-2 pl-4 text-xs text-muted-foreground">{appointment.description || 'No concern recorded.'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="whitespace-nowrap font-mono text-xs tabular-nums">{formatDateTime(appointment.appointmentDate, timeZone)}</p>
                          {appointment.serviceOrder && (
                            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                              {roReference(appointment.serviceOrder.id)} · {formatCurrency(appointment.serviceOrder.grandTotal)}
                            </p>
                          )}
                        </div>
                      </div>
                      {(!appointment.serviceOrder || transitions.length > 0) && (
                        <Track className="self-start">
                          {!appointment.serviceOrder && (
                            <Pill size="sm" variant="primary" onClick={() => createRepairOrder(appointment)} disabled={busy}>
                              Open RO
                            </Pill>
                          )}
                          {transitions.map(next => (
                            <Pill key={next} size="sm" onClick={() => updateAppointmentStatus(appointment.id, next)} disabled={busy}>
                              {appointmentStatusLabels[next]}
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

          <DeskSection title="Parts" count={parts.length}>
            {parts.length === 0 ? (
              <Empty label="No parts configured" />
            ) : (
              <Panel className="divide-y">
                {parts.map(part => {
                  const low = (part.minimumQuantity ?? 0) > 0 && (part.quantity ?? 0) <= (part.minimumQuantity ?? 0)
                  return (
                    <div key={part.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={low ? 'bad' : 'ok'} status={low ? 'Low stock' : 'In stock'} className="text-sm font-medium">
                          {part.description || part.partNumber}
                        </TitleLine>
                        <p className="truncate pl-4 text-xs text-muted-foreground">
                          <Code>#{part.partNumber}</Code> · {part.supplier || 'No supplier'}
                        </p>
                        <Track className="ml-4 mt-2">
                          <Pill size="sm" onClick={() => receivePart(part)}>Receive stock</Pill>
                        </Track>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-sm font-semibold tabular-nums', low && 'text-red-600 dark:text-red-400')}>{part.quantity ?? 0} left</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Reorder at {part.minimumQuantity ?? 0}</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Retail {formatCurrency(part.price)}</p>
                      </div>
                    </div>
                  )
                })}
              </Panel>
            )}
          </DeskSection>
        </div>

        <OperatorActionDialog
          open={Boolean(task)}
          title={taskTitle}
          fields={task ? serviceTaskFields(task, serviceRooftops, staff) : []}
          values={task?.values || {}}
          error={taskError}
          busy={Boolean(updatingId)}
          onValuesChange={values => setTask(current => (current ? { ...current, values } : null))}
          onSubmit={submitTask}
          onOpenChange={open => {
            if (!open) {
              setTask(null)
              setTaskError(null)
            }
          }}
        />
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
