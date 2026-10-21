'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, Circle, RefreshCw, Search, Square, Triangle, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { SERVICE_APPOINTMENT_TRANSITIONS } from '@/features/keystone/lifecycle/serviceAppointmentTransitions'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import {
  addServiceOrderLineItem,
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
import { serviceTaskFields, serviceTaskRequest, type ServiceChoice, type ServiceTask, type ServiceTaskOperation } from '../lib/serviceTasks'
import type { FixedOpsWorkspace } from '../lib/types'

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

const badgeClasses: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  'checked-in': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  estimate: 'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
  'waiting-parts': 'bg-orange-100 text-orange-700 border-orange-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  invoiced: 'bg-purple-100 text-purple-700 border-purple-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleString('en-US', {
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

function isToday(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function toAppointments(workspace: FixedOpsWorkspace | null | undefined): ServiceAppointment[] {
  return (workspace?.appointments || []).map(appointment => ({
    ...appointment,
    serviceOrder: appointment.serviceOrder
      ? { id: appointment.serviceOrder.id, status: appointment.serviceOrder.status, grandTotal: (appointment.serviceOrder.grandTotalCents ?? 0) / 100 }
      : null,
  }))
}

function toOrders(workspace: FixedOpsWorkspace | null | undefined): ServiceOrder[] {
  return (workspace?.orders || []).map(order => ({
    ...order,
    laborTotal: (order.laborTotalCents ?? 0) / 100,
    partsTotal: (order.partsTotalCents ?? 0) / 100,
    tax: (order.taxCents ?? 0) / 100,
    grandTotal: (order.grandTotalCents ?? 0) / 100,
  }))
}

function toParts(workspace: FixedOpsWorkspace | null | undefined): Part[] {
  return (workspace?.parts || []).map(part => ({ ...part, price: (part.priceCents ?? 0) / 100 }))
}

function toRooftops(workspace: FixedOpsWorkspace | null | undefined): ServiceChoice[] {
  return (workspace?.serviceRooftops || []).map(item => ({ value: item.id, label: item.name }))
}

function EmptyStateDefault({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} icons={[Triangle, Square, Circle]} />
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

function StatusBadge({ value, labels }: { value: string | null; labels: Record<string, string> }) {
  const status = value || 'unknown'
  return (
    <Badge variant="outline" className={badgeClasses[status] || 'bg-slate-100 text-slate-700 border-slate-200'}>
      {labels[status] || status}
    </Badge>
  )
}

export function ServiceAdvisorPageClient({
  initialWorkspace,
  initialError,
}: {
  initialWorkspace: FixedOpsWorkspace | null
  initialError: string | null
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
    const queued = appointmentFilter === 'today' ? appointments.filter(appointment => isToday(appointment.appointmentDate))
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
    return orders.filter(order => !term || `${order.id} ${order.invoiceNumber || ''} ${order.appointment?.customerVehicleDescription || ''} ${order.concern || ''}`.toLowerCase().includes(term))
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

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Service</h1>
        <p className="text-muted-foreground">Coordinate service appointments and repair work.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={configurePartRecord} disabled={updatingId === 'part' || !serviceRooftops.length}>
          Configure Part
        </Button>
        <Button variant="outline" onClick={loadServiceData} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  )

  if (error) {
    return (
      <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Service is unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={loadServiceData}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Service" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
        {notice && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {notice}
          </p>
        )}
        {!serviceRooftops.length && (
          <p role="status" className="text-sm text-muted-foreground">
            No active service locations
          </p>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search service records"
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search customer, vehicle, concern, RO, or invoice"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger aria-label="Sort service records" className="w-full lg:w-[190px]">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5" />
                Appointments
              </CardTitle>
              <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1" role="group" aria-label="Filter appointments">
                {['open', 'today', 'waiting-parts', 'all'].map(filter => (
                  <Button
                    key={filter}
                    variant="ghost"
                    className={`rounded-full ${appointmentFilter === filter ? 'bg-background shadow-sm' : ''}`}
                    aria-pressed={appointmentFilter === filter}
                    size="sm"
                    onClick={() => setAppointmentFilter(filter)}
                  >
                    {filter === 'waiting-parts' ? 'Waiting Parts' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAppointments.length === 0 ? (
                searchTerm || appointmentFilter !== 'open' ? (
                  <EmptyStateSearch onResetFilters={resetFilters} />
                ) : (
                  <EmptyStateDefault title="No service appointments" description="Service appointments will appear here." />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Time</th>
                        <th className="text-left py-3 px-4 font-medium">Vehicle / Concern</th>
                        <th className="text-left py-3 px-4 font-medium">Technician</th>
                        <th className="text-center py-3 px-4 font-medium">Status</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map(appointment => (
                        <tr key={appointment.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium">{formatDateTime(appointment.appointmentDate)}</div>
                            <div className="text-xs text-muted-foreground capitalize">{appointment.serviceType || 'Service request'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium">{appointment.customerVehicleDescription || 'Vehicle not set'}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{appointment.description || 'No concern recorded.'}</p>
                            {appointment.lead && (
                              <Link href={`${basePath}/platform/crm/${appointment.lead.id}`} className="text-xs text-primary hover:underline">
                                {[appointment.lead.firstName, appointment.lead.lastName].filter(Boolean).join(' ') || appointment.lead.email || 'Customer'}
                                {appointment.lead.phone ? ` · ${appointment.lead.phone}` : ''}
                              </Link>
                            )}
                            {appointment.serviceOrder && (
                              <p className="font-mono text-xs text-muted-foreground">
                                RO #{appointment.serviceOrder.id.slice(0, 8)} · {formatCurrency(appointment.serviceOrder.grandTotal)}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {appointment.assignedTech?.name || <span className="text-muted-foreground">Unassigned</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge value={appointment.status} labels={appointmentStatusLabels} />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {!appointment.serviceOrder && (
                                <Button size="sm" variant="outline" onClick={() => createRepairOrder(appointment)} disabled={updatingId === appointment.id}>
                                  Open RO
                                </Button>
                              )}
                              {appointmentStatuses
                                .filter(status => (SERVICE_APPOINTMENT_TRANSITIONS[appointment.status || ''] || []).includes(status))
                                .slice(0, 3)
                                .map(status => (
                                  <Button
                                    key={status}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateAppointmentStatus(appointment.id, status)}
                                    disabled={updatingId === appointment.id}
                                  >
                                    {appointmentStatusLabels[status]}
                                  </Button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                Parts inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {parts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wrench className="h-4 w-4" />
                  No parts configured.
                </div>
              ) : (
                <div className="space-y-3">
                  {parts.map(part => (
                    <div key={part.id} className="rounded-lg border p-3 hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{part.description || part.partNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            #{part.partNumber} · {part.supplier || 'No supplier'}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            (part.minimumQuantity ?? 0) > 0 && (part.quantity ?? 0) <= (part.minimumQuantity ?? 0)
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-muted'
                          }
                        >
                          {part.quantity ?? 0} left
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Reorder at {part.minimumQuantity ?? 0} · Retail {formatCurrency(part.price)}
                      </p>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => receivePart(part)}>
                        Receive stock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Open Repair Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {visibleOrders.length === 0 ? (
              searchTerm ? (
                <EmptyStateSearch onResetFilters={resetFilters} />
              ) : (
                <EmptyStateDefault title="No repair orders" description="Repair orders you open will appear here." />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Repair Order</th>
                      <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 font-medium">Appointment</th>
                      <th className="text-right py-3 px-4 font-medium">Total</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.slice(0, 25).map(order => {
                      const nextStatus = order.status ? nextOrderStatus[order.status] : undefined
                      return (
                        <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-3 px-4">
                            {order.appointment?.customerVehicleDescription || <span className="text-muted-foreground">Vehicle not set</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div>{formatDateTime(order.appointment?.appointmentDate || null)}</div>
                            <div className="text-xs text-muted-foreground capitalize">{order.appointment?.serviceType || 'service'}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(order.grandTotal)}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge value={order.status} labels={orderStatusLabels} />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {order.status && ['estimate', 'approved', 'in-progress'].includes(order.status) && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => recordRepairEvidence(order)} disabled={updatingId === order.id}>
                                    CCC & Authorization
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => addLaborLine(order)} disabled={updatingId === order.id}>
                                    Add labor line
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => manageLabor(order)} disabled={updatingId === order.id}>
                                    Labor
                                  </Button>
                                </>
                              )}
                              {order.status === 'invoiced' ? (
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`${basePath}/platform/accounting`}>Payments</Link>
                                </Button>
                              ) : (
                                nextStatus && (
                                  <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(order.id, nextStatus)} disabled={updatingId === order.id}>
                                    {orderStatusLabels[nextStatus]}
                                  </Button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </PageContainer>
  )
}
