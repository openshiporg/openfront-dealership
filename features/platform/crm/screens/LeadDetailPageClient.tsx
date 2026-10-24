'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, CalendarPlus, Check, Mail, Pencil, Phone, RefreshCw, Route } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Notice,
  Panel,
  Pill,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import {
  type CrmPerson,
  type CrmVehicleOption,
  type CrmViewer,
  type LeadDetail,
  advanceLeadCadence,
  completeLeadTask,
  createLeadTask,
  enrollLeadCadence,
  getCustomerDuplicateCount,
  getLead,
  getLeadVehicleOptions,
  manageSalesVisit,
  recordLeadInteraction,
  routeLead,
  transferLeadOwnership,
  transitionLead,
  updateCustomerCommunicationPreferences,
  updateLeadDetails,
} from '../actions'
import {
  CLOSED_LEAD_STATUSES,
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  PRIORITY_TONE,
  VISIT_ACTIONS,
  VISIT_OUTCOMES,
  VISIT_STATUSES,
  budgetLabel,
  formatDateTime,
  fromZonedInputValue,
  leadStatus,
  sourceLabel,
  timeframeLabel,
} from '../lib/leadOptions'
import { LeadFormDialog, type LeadFormValues } from '../components/LeadFormDialog'
import { TransferLeadDialog } from '../components/TransferLeadDialog'
import { SalesVisitDialog, type VisitDialogAction } from '../components/SalesVisitDialog'
import { FormField } from '../components/FormField'

type Lead = LeadDetail
type Visit = Lead['salesVisits'][number]

const lostReasonOptions = [
  { value: 'purchased-elsewhere', label: 'Purchased elsewhere' },
  { value: 'price', label: 'Price' },
  { value: 'financing', label: 'Financing' },
  { value: 'vehicle-unavailable', label: 'Vehicle unavailable' },
  { value: 'no-response', label: 'No response' },
  { value: 'timing', label: 'Timing' },
  { value: 'other', label: 'Other' },
]

const dealTone: Record<string, DeskTone> = { pencil: 'idle', submitted: 'warn', approved: 'info', financed: 'info', delivered: 'ok', cancelled: 'bad' }

const VISIT_ACTION_LABEL: Record<string, string> = { arrive: 'Check in', 'manager-turn': 'Manager turn', complete: 'Complete', cancel: 'Cancel', 'no-show': 'No-show' }

const ROUTE_LABEL: Record<string, string> = { 'manual-transfer': 'Transfer', 'manual-intake': 'Assigned at intake', 'intake-creator': 'Intake staff' }

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
}

function leadName(lead: Lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unnamed lead'
}

function vehicleName(vehicle: { year: number | null; make: string | null; model: string | null } | null) {
  if (!vehicle) return 'No vehicle'
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

function consentLabel(suppressed: boolean | null | undefined, consent: boolean | null | undefined) {
  return suppressed ? 'Suppressed' : consent ? 'Consented' : 'Not consented'
}

const label = (value: string | null | undefined) => (value ? value.replaceAll('-', ' ') : '-')

function leadFormValues(lead: Lead): LeadFormValues {
  return {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    email: lead.email || '',
    phone: lead.phone || '',
    source: lead.source || 'walk-in',
    budgetRange: lead.budgetRange || '',
    timeframe: lead.timeframe || '',
    tradeInVehicle: lead.tradeInVehicle || '',
    notes: lead.notes || '',
    interestedVehicleId: lead.interestedVehicle?.id || '',
    rooftopId: lead.rooftop.id,
    assignedToId: '',
  }
}

export function LeadDetailPageClient({
  id,
  initialLead,
  initialDuplicateCount,
  viewer,
  staff,
  initialError,
  timeZone,
}: {
  id: string
  initialLead: Lead | null
  initialDuplicateCount: number
  viewer: CrmViewer | null
  staff: CrmPerson[]
  initialError: string | null
  timeZone: string
}) {
  const interactionKeyRef = useRef(`lead-interaction:${crypto.randomUUID()}`)
  const [lead, setLead] = useState<Lead | null>(initialLead)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<{ tone: DeskTone; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(initialDuplicateCount)
  const [interaction, setInteraction] = useState({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [task, setTask] = useState({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal', assignedToId: '' })
  const [taskError, setTaskError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [contactChannel, setContactChannel] = useState(initialLead?.customer?.preferredChannel || 'none')
  const [cadence, setCadence] = useState({
    cadenceKey: initialLead?.cadenceKey || 'internet-lead-first-response',
    campaignKey: initialLead?.campaignKey || 'website-organic',
  })
  const [lostReasonDialogOpen, setLostReasonDialogOpen] = useState(false)
  const [lostReasonValues, setLostReasonValues] = useState({ lostReasonCode: '', lostReasonDetails: '' })
  const [lostReasonError, setLostReasonError] = useState<string | null>(null)
  const lostReasonIdempotencyKeyRef = useRef<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const editKeyRef = useRef<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const transferKeyRef = useRef<string | null>(null)
  const [visitDialog, setVisitDialog] = useState<{ action: VisitDialogAction; visit?: Visit } | null>(null)
  const visitKeyRef = useRef<string | null>(null)
  const [vehicles, setVehicles] = useState<CrmVehicleOption[]>([])

  const canManage = viewer?.canManageLeads === true
  const canTasks = viewer?.canManageTasks === true
  const manageReason = canManage ? undefined : 'Requires lead management permission'

  const loadLead = async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    const response = await getLead(id)
    if (response.success && response.data?.lead) {
      const loaded = response.data.lead
      setLead(loaded)
      setContactChannel(loaded.customer?.preferredChannel || 'none')
      setCadence({ cadenceKey: loaded.cadenceKey || 'internet-lead-first-response', campaignKey: loaded.campaignKey || 'website-organic' })
      setDuplicateCount(loaded.customer?.id ? await getCustomerDuplicateCount(loaded.customer.id) : 0)
    } else {
      setLead(null)
      setError(response.success ? 'This lead was not found.' : response.error)
    }
    setLoading(false)
  }

  const ensureVehicles = async () => {
    if (vehicles.length === 0) setVehicles(await getLeadVehicleOptions())
  }

  const runCommand = async (work: () => Promise<{ success: boolean; error?: string }>, failure: string, success?: string) => {
    setSaving(true)
    setNotice(null)
    const response = await work()
    if (!response.success) setNotice({ tone: 'bad', text: `${failure}: ${response.error}` })
    else if (success) setNotice({ tone: 'ok', text: success })
    await loadLead(true)
    setSaving(false)
    return response.success
  }

  const updateLeadStatus = async (status: string) => {
    if (status === 'closed-lost') {
      setLostReasonValues({ lostReasonCode: '', lostReasonDetails: '' })
      setLostReasonError(null)
      lostReasonIdempotencyKeyRef.current = `lead-transition:${id}:${status}:${crypto.randomUUID()}`
      setLostReasonDialogOpen(true)
      return
    }
    await runCommand(() => transitionLead({ id, toStatus: status, idempotencyKey: `lead-transition:${id}:${status}:${crypto.randomUUID()}` }), 'Unable to update status')
  }

  const submitLostLeadTransition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!lostReasonValues.lostReasonCode) { setLostReasonError('Choose a lost reason'); return }
    if (!lostReasonIdempotencyKeyRef.current) return
    setSaving(true)
    setLostReasonError(null)
    const response = await transitionLead({
      id,
      toStatus: 'closed-lost',
      lostReasonCode: lostReasonValues.lostReasonCode,
      lostReasonDetails: lostReasonValues.lostReasonDetails.trim(),
      idempotencyKey: lostReasonIdempotencyKeyRef.current,
    })
    if (!response.success) {
      setLostReasonError(response.error)
      setSaving(false)
      return
    }
    lostReasonIdempotencyKeyRef.current = null
    setLostReasonDialogOpen(false)
    await loadLead(true)
    setSaving(false)
  }

  const handleLostReasonDialogOpenChange = (open: boolean) => {
    setLostReasonDialogOpen(open)
    if (!open) {
      lostReasonIdempotencyKeyRef.current = null
      setLostReasonError(null)
      setLostReasonValues({ lostReasonCode: '', lostReasonDetails: '' })
    }
  }

  const logInteraction = async () => {
    if (!interaction.notes.trim()) { setInteractionError('Notes are required'); return }
    const followUp = interaction.followUpDate ? fromZonedInputValue(interaction.followUpDate, timeZone) : null
    if (interaction.followUpDate && !followUp) { setInteractionError('Follow-up date is invalid'); return }
    setInteractionError(null)
    const ok = await runCommand(() => recordLeadInteraction({
      leadId: id,
      idempotencyKey: interactionKeyRef.current,
      interactionType: interaction.interactionType,
      outcome: interaction.outcome,
      notes: interaction.notes,
      date: new Date().toISOString(),
      ...(followUp ? { followUpDate: followUp } : {}),
    }), 'Unable to log activity')
    if (ok) {
      setInteraction({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
      interactionKeyRef.current = `lead-interaction:${crypto.randomUUID()}`
    }
  }

  const applyRoutingRule = async () => {
    if (!lead) return
    await runCommand(() => routeLead({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: `crm-route:${lead.id}:${lead.updatedAt}` }), 'Unable to route lead', 'Lead routed')
  }

  const createTask = async () => {
    if (!task.title.trim()) { setTaskError('Title is required'); return }
    const due = task.dueDate ? fromZonedInputValue(task.dueDate, timeZone) : null
    if (task.dueDate && !due) { setTaskError('Due date is invalid'); return }
    setTaskError(null)
    const ok = await runCommand(() => createLeadTask({
      leadId: id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      communicationChannel: task.communicationChannel,
      idempotencyKey: `crm-task:${id}:${crypto.randomUUID()}`,
      ...(due ? { dueDate: due } : {}),
      ...(task.assignedToId ? { assignedToId: task.assignedToId } : {}),
    }), 'Unable to create task')
    if (ok) setTask({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal', assignedToId: '' })
  }

  const saveContactPreference = async (suppressSelected = false) => {
    if (!lead?.customer) return
    const selected = contactChannel
    if (suppressSelected && selected === 'none') { setNotice({ tone: 'bad', text: 'Select a channel to suppress' }); return }
    const customer = lead.customer
    await runCommand(() => updateCustomerCommunicationPreferences(lead.id, {
      customerId: customer.id,
      expectedUpdatedAt: customer.updatedAt,
      emailConsent: selected === 'email' ? true : customer.emailConsent === true,
      smsConsent: selected === 'sms' ? true : customer.smsConsent === true,
      phoneConsent: selected === 'phone' ? true : customer.phoneConsent === true,
      emailSuppressed: suppressSelected && selected === 'email' ? true : customer.emailSuppressed === true,
      smsSuppressed: suppressSelected && selected === 'sms' ? true : customer.smsSuppressed === true,
      phoneSuppressed: suppressSelected && selected === 'phone' ? true : customer.phoneSuppressed === true,
      preferredChannel: suppressSelected ? 'none' : selected,
      source: 'operator-recorded',
      reason: suppressSelected ? `Customer requested ${selected} suppression` : `Customer confirmed ${selected} preference`,
      idempotencyKey: `crm-preference:${customer.id}:${crypto.randomUUID()}`,
    }), 'Unable to update preferences')
  }

  const enrollCadence = async () => {
    if (!lead) return
    await runCommand(() => enrollLeadCadence({
      leadId: lead.id,
      expectedUpdatedAt: lead.updatedAt,
      cadenceKey: cadence.cadenceKey,
      campaignKey: cadence.campaignKey,
      idempotencyKey: `crm-cadence:${lead.id}:${crypto.randomUUID()}`,
    }), 'Unable to enroll cadence')
  }

  const advanceCadence = async () => {
    if (!lead) return
    await runCommand(() => advanceLeadCadence({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: `crm-cadence-advance:${lead.id}:${crypto.randomUUID()}` }), 'Unable to advance cadence')
  }

  const completeTask = async (taskId: string) => {
    await runCommand(() => completeLeadTask(id, taskId), 'Unable to complete task')
  }

  const openEdit = async () => {
    editKeyRef.current = `lead-details:${id}:${crypto.randomUUID()}`
    setEditOpen(true)
    await ensureVehicles()
  }

  const submitEdit = async (values: LeadFormValues) => {
    if (!lead) return 'Lead is not loaded'
    const { rooftopId: _rooftopId, assignedToId: _assignedToId, ...details } = values
    const response = await updateLeadDetails({ ...details, leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: editKeyRef.current || `lead-details:${id}:${crypto.randomUUID()}` })
    if (!response.success) return response.error
    editKeyRef.current = null
    setEditOpen(false)
    setNotice({ tone: 'ok', text: 'Lead details saved' })
    await loadLead(true)
    return null
  }

  const openTransfer = () => {
    transferKeyRef.current = `lead-transfer:${id}:${crypto.randomUUID()}`
    setTransferOpen(true)
  }

  const submitTransfer = async (values: { assignedToId: string; reason: string }) => {
    if (!lead) return 'Lead is not loaded'
    const response = await transferLeadOwnership({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: transferKeyRef.current || `lead-transfer:${id}:${crypto.randomUUID()}`, ...values })
    if (!response.success) return response.error
    transferKeyRef.current = null
    setTransferOpen(false)
    setNotice({ tone: 'ok', text: 'Lead transferred' })
    await loadLead(true)
    return null
  }

  const openVisit = async (action: VisitDialogAction, visit?: Visit) => {
    visitKeyRef.current = `crm-visit:${visit?.id || id}:${action}:${crypto.randomUUID()}`
    setVisitDialog({ action, visit })
    if (action === 'schedule') await ensureVehicles()
  }

  const submitVisit = async (values: { kind: string; scheduledAtIso: string | null; vehicleId: string; managerId: string; outcome: string; notes: string }) => {
    if (!lead || !visitDialog) return 'Lead is not loaded'
    const { action, visit } = visitDialog
    const idempotencyKey = visitKeyRef.current || `crm-visit:${crypto.randomUUID()}`
    const response = await manageSalesVisit(lead.id, action === 'schedule'
      ? {
          action,
          leadId: lead.id,
          kind: values.kind,
          ...(values.vehicleId ? { vehicleId: values.vehicleId } : {}),
          ...(values.kind === 'appointment' && values.scheduledAtIso ? { scheduledAt: values.scheduledAtIso } : {}),
          notes: values.notes.trim(),
          idempotencyKey,
        }
      : {
          action,
          visitId: visit?.id,
          expectedUpdatedAt: visit?.updatedAt,
          ...(action === 'manager-turn' ? { managerId: values.managerId } : {}),
          ...(action === 'complete' ? { outcome: values.outcome } : {}),
          notes: values.notes.trim(),
          idempotencyKey,
        })
    if (!response.success) return response.error
    visitKeyRef.current = null
    setVisitDialog(null)
    await loadLead(true)
    return null
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'CRM', href: `${basePath}/platform/crm` },
    { type: 'page' as const, label: lead ? leadName(lead) : 'Lead' },
  ]

  if (loading) {
    return (
      <PageContainer title="CRM" breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6" role="status" aria-label="Loading lead">
          <div className="h-7 w-56 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </PageContainer>
    )
  }

  if (!lead) {
    return (
      <PageContainer title="CRM" breadcrumbs={breadcrumbs} header={<DeskHeader title="Lead unavailable" tone="bad" status="Unavailable" />}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'This lead was not found.'}</Notice>
          <Track>
            <Pill onClick={() => loadLead()}>Retry</Pill>
            <Pill asChild><Link href={`${basePath}/platform/crm`}>Back to CRM</Link></Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const currentStatus = leadStatus(lead.status)
  const openTasks = lead.tasks.filter(item => !item.completed)
  const completedTasks = lead.tasks.filter(item => item.completed)
  const responseOverdue = Boolean(lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now())
  const isClosed = CLOSED_LEAD_STATUSES.includes(lead.status || '')
  const allowedStatuses = LEAD_TRANSITIONS[lead.status || 'new'] || []
  const activeVisits = lead.salesVisits.filter(visit => VISIT_ACTIONS[visit.status || ''])
  const pastVisits = lead.salesVisits.filter(visit => !VISIT_ACTIONS[visit.status || ''])
  const selectSm = 'h-11 sm:h-9'

  const header = (
    <DeskHeader
      title={leadName(lead)}
      tone={currentStatus.tone}
      status={currentStatus.label}
      meta={<span>{currentStatus.label} · {sourceLabel(lead.source)} · Created {formatDateTime(lead.createdAt, timeZone)} · Last contact {formatDateTime(lead.lastContact, timeZone)}</span>}
      actions={
        <Track>
          {lead.phone && <Pill asChild><a href={`tel:${lead.phone}`}><Phone />Call</a></Pill>}
          {lead.email && <Pill asChild><a href={`mailto:${lead.email}`}><Mail />Email</a></Pill>}
          <Pill onClick={openEdit} disabled={!canManage || saving} title={manageReason}><Pencil />Edit</Pill>
          <Pill asChild variant="primary">
            <Link href={`${basePath}/platform/deals/create?leadId=${lead.id}${lead.interestedVehicle ? `&vehicleId=${lead.interestedVehicle.id}` : ''}`}>Start deal</Link>
          </Pill>
          <Pill onClick={() => loadLead()} aria-label="Refresh"><RefreshCw /></Pill>
        </Track>
      }
    />
  )

  const visitRow = (visit: Visit) => {
    const status = VISIT_STATUSES[visit.status || ''] || { label: label(visit.status), tone: 'idle' as DeskTone }
    const actions = VISIT_ACTIONS[visit.status || ''] || []
    const outcome = VISIT_OUTCOMES.find(item => item.value === visit.outcome)?.label || visit.outcome
    return (
      <div key={visit.id} className="space-y-2 px-3 py-2.5">
        <div className="min-w-0">
          <TitleLine as="p" tone={status.tone} status={status.label} className="text-sm font-medium">
            {visit.kind === 'showroom' ? 'Showroom visit' : 'Sales appointment'} · {status.label}
          </TitleLine>
          <p className="pl-4 text-xs text-muted-foreground">
            {[
              visit.scheduledAt && `Scheduled ${formatDateTime(visit.scheduledAt, timeZone)}`,
              visit.arrivedAt && `Arrived ${formatDateTime(visit.arrivedAt, timeZone)}`,
              visit.managerTurnAt && `T.O. ${formatDateTime(visit.managerTurnAt, timeZone)}${visit.manager?.name ? ` to ${visit.manager.name}` : ''}`,
              visit.completedAt && `Completed ${formatDateTime(visit.completedAt, timeZone)}`,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className="pl-4 text-xs text-muted-foreground">
            {[visit.vehicle ? vehicleName(visit.vehicle) : null, visit.assignedSalesperson?.name, outcome && `Outcome: ${outcome}`].filter(Boolean).join(' · ')}
          </p>
          {visit.notes && <p className="mt-0.5 whitespace-pre-line break-words pl-4 text-xs">{visit.notes}</p>}
        </div>
        {actions.length > 0 && (
          <Track className="ml-4">
            {actions.map(action => (
              <Pill key={action} size="sm" className="h-11 sm:h-7" onClick={() => openVisit(action, visit)} disabled={!canManage || saving} title={manageReason}>
                {VISIT_ACTION_LABEL[action]}
              </Pill>
            ))}
          </Track>
        )}
      </div>
    )
  }

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-24 md:px-6">
        {responseOverdue && <Notice tone="warn" className="mb-4">First response overdue · due {formatDateTime(lead.firstResponseDueAt, timeZone)}</Notice>}
        {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
        {!canManage && <p className="mb-4 text-xs text-muted-foreground">Read only · requires lead management permission</p>}

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            <DeskSection title="Activity" count={lead.interactions.length}>
              {canManage && (
                <Panel className="space-y-2 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={interaction.interactionType} onValueChange={value => setInteraction(prev => ({ ...prev, interactionType: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Interaction type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">Text</SelectItem>
                        <SelectItem value="visit">Visit</SelectItem>
                        <SelectItem value="test-drive">Test drive</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={interaction.outcome} onValueChange={value => setInteraction(prev => ({ ...prev, outcome: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Interaction outcome"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                        <SelectItem value="no-answer">No answer</SelectItem>
                        <SelectItem value="voicemail">Voicemail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    aria-label="Interaction notes"
                    aria-invalid={Boolean(interactionError)}
                    value={interaction.notes}
                    onChange={event => { setInteraction(prev => ({ ...prev, notes: event.target.value })); setInteractionError(null) }}
                    placeholder="Notes"
                    className="min-h-20"
                  />
                  {interactionError && <p className="text-xs text-red-600 dark:text-red-400">{interactionError}</p>}
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      Follow up
                      <Input aria-label="Follow-up date" type="datetime-local" value={interaction.followUpDate} onChange={event => setInteraction(prev => ({ ...prev, followUpDate: event.target.value }))} className="h-11 min-w-0 flex-1 sm:h-9 sm:w-56" />
                    </label>
                    <Track className="self-end">
                      <Pill variant="primary" className="h-11 sm:h-8" onClick={logInteraction} disabled={saving}>Log activity</Pill>
                    </Track>
                  </div>
                </Panel>
              )}

              {lead.interactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity</p>
              ) : (
                <ol className="mt-4 space-y-0">
                  {lead.interactions.map(item => (
                    <li key={item.id} className="relative border-l pb-4 pl-5 last:pb-0">
                      <span className="absolute -left-[4px] top-1.5 size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-medium capitalize">
                          {label(item.interactionType)}
                          <span className="font-normal text-muted-foreground"> · {label(item.outcome)}</span>
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatDateTime(item.date, timeZone)}</p>
                      </div>
                      {item.performedBy?.name && <p className="text-xs text-muted-foreground">{item.performedBy.name}</p>}
                      {item.notes && <p className="mt-1 whitespace-pre-line break-words text-sm">{item.notes}</p>}
                      {item.followUpDate && <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Follow up {formatDateTime(item.followUpDate, timeZone)}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection
              title="Tasks"
              count={openTasks.length}
              actions={completedTasks.length > 0 ? (
                <Track>
                  <Pill size="sm" active={showCompleted} onClick={() => setShowCompleted(value => !value)}>{completedTasks.length} completed</Pill>
                </Track>
              ) : undefined}
            >
              {openTasks.length > 0 && (
                <Panel className="mb-3 divide-y">
                  {openTasks.map(item => {
                    const overdue = Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now())
                    return (
                      <div key={item.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={overdue ? 'bad' : PRIORITY_TONE[item.priority || ''] ?? 'idle'} status={overdue ? 'Overdue' : item.priority || undefined} className="text-sm font-medium">
                            {item.title}
                          </TitleLine>
                          <p className={`pl-4 text-xs ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {item.dueDate ? `${overdue ? 'Overdue' : 'Due'} ${formatDateTime(item.dueDate, timeZone)}` : 'No due date'} · <span className="capitalize">{item.priority}</span>
                            {item.assignedTo?.name ? ` · ${item.assignedTo.name}` : ''}
                          </p>
                          {item.description && <p className="mt-0.5 break-words pl-4 text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                        <Track className="shrink-0">
                          <Pill size="sm" className="h-11 sm:h-7" onClick={() => completeTask(item.id)} disabled={!canTasks || saving} title={canTasks ? undefined : 'Requires task permission'} aria-label={`Complete ${item.title || 'task'}`}>
                            <Check />Done
                          </Pill>
                        </Track>
                      </div>
                    )
                  })}
                </Panel>
              )}
              {openTasks.length === 0 && <p className="pb-3 text-sm text-muted-foreground">No open tasks</p>}
              {showCompleted && completedTasks.length > 0 && (
                <Panel className="mb-3 divide-y">
                  {completedTasks.map(item => (
                    <div key={item.id} className="px-4 py-2.5">
                      <TitleLine as="p" tone="ok" status="Completed" className="text-sm text-muted-foreground line-through">{item.title}</TitleLine>
                      <p className="pl-4 text-xs text-muted-foreground">Completed {formatDateTime(item.completedDate, timeZone)}{item.assignedTo?.name ? ` · ${item.assignedTo.name}` : ''}</p>
                    </div>
                  ))}
                </Panel>
              )}

              {canTasks && (
                <Panel className="space-y-2 p-3">
                  <Input aria-label="Task title" aria-invalid={Boolean(taskError)} className="h-11 sm:h-9" value={task.title} onChange={event => { setTask(prev => ({ ...prev, title: event.target.value })); setTaskError(null) }} placeholder="Task title" maxLength={200} />
                  <Textarea aria-label="Task details" value={task.description} onChange={event => setTask(prev => ({ ...prev, description: event.target.value }))} placeholder="Details" className="min-h-16" maxLength={4000} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input aria-label="Task due date" type="datetime-local" value={task.dueDate} onChange={event => setTask(prev => ({ ...prev, dueDate: event.target.value }))} className="h-11 min-w-0 sm:h-9" />
                    <Select value={task.assignedToId || '__owner__'} onValueChange={value => setTask(prev => ({ ...prev, assignedToId: value === '__owner__' ? '' : value }))}>
                      <SelectTrigger className={selectSm} aria-label="Task assignee"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__owner__">Lead owner</SelectItem>
                        {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={task.priority} onValueChange={value => setTask(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Task priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={task.communicationChannel} onValueChange={value => setTask(prev => ({ ...prev, communicationChannel: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Task channel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {taskError && <p className="text-xs text-red-600 dark:text-red-400">{taskError}</p>}
                  <div className="flex justify-end">
                    <Track><Pill className="h-11 sm:h-8" onClick={createTask} disabled={saving}>Create task</Pill></Track>
                  </div>
                </Panel>
              )}
            </DeskSection>

            <DeskSection
              title="Visits and appointments"
              count={lead.salesVisits.length}
              actions={
                <Track>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => openVisit('schedule')} disabled={!canManage || saving || isClosed} title={isClosed ? 'Lead is closed' : manageReason}>
                    <CalendarPlus />Schedule
                  </Pill>
                </Track>
              }
            >
              {lead.salesVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits</p>
              ) : (
                <div className="space-y-3">
                  {activeVisits.length > 0 && <Panel className="divide-y">{activeVisits.map(visitRow)}</Panel>}
                  {pastVisits.length > 0 && <Panel className="divide-y">{pastVisits.map(visitRow)}</Panel>}
                </div>
              )}
            </DeskSection>

            <DeskSection title="Notes">
              <p className="whitespace-pre-line break-words text-sm">{lead.notes || <span className="text-muted-foreground">No notes</span>}</p>
            </DeskSection>
          </div>

          <div className="min-w-0 space-y-8">
            <DeskSection title="Status">
              <div className="space-y-3">
                <Select value={lead.status || 'new'} onValueChange={updateLeadStatus} disabled={saving || !canManage || allowedStatuses.length === 0}>
                  <SelectTrigger aria-label="Lead status" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.filter(status => status.value === lead.status || allowedStatuses.includes(status.value)).map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isClosed && <p className="text-xs text-muted-foreground">Closed leads cannot change status</p>}
                {lead.status === 'closed-lost' && (lead.lostReasonCode || lead.lostReason) && (
                  <Facts items={[
                    !!lead.lostReasonCode && { label: 'Lost reason', value: <span className="capitalize">{label(lead.lostReasonCode)}</span> },
                    !!lead.lostReason && { label: 'Details', value: lead.lostReason },
                  ]} />
                )}
              </div>
            </DeskSection>

            <DeskSection
              title="Owner"
              actions={
                <Track>
                  {!lead.assignedSalesperson && (
                    <Pill size="sm" className="h-11 sm:h-7" onClick={applyRoutingRule} disabled={!canManage || saving} title={manageReason}><Route />Route</Pill>
                  )}
                  <Pill size="sm" className="h-11 sm:h-7" onClick={openTransfer} disabled={!canManage || saving} title={manageReason}><ArrowRightLeft />Transfer</Pill>
                </Track>
              }
            >
              <Facts items={[
                { label: 'Salesperson', value: lead.assignedSalesperson?.name || 'Unassigned' },
                { label: 'Assigned', value: formatDateTime(lead.assignedAt, timeZone), mono: true },
                { label: 'First response', value: lead.firstResponseAt ? `Responded ${formatDateTime(lead.firstResponseAt, timeZone)}` : lead.firstResponseDueAt ? `Due ${formatDateTime(lead.firstResponseDueAt, timeZone)}` : 'No SLA' },
              ]} />
              <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Assignment history</p>
              {lead.assignmentEvents.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">No assignments</p>
              ) : (
                <ol className="mt-2 space-y-0">
                  {lead.assignmentEvents.map(event => (
                    <li key={event.id} className="relative border-l pb-3 pl-4 last:pb-0">
                      <span className="absolute -left-[4px] top-1.5 size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                      <p className="text-sm">{event.fromUser?.name ? `${event.fromUser.name} to ` : ''}{event.toUser?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {[formatDateTime(event.assignedAt, timeZone), ROUTE_LABEL[event.routeKey || ''] || (event.routeKey ? 'Routing rule' : null), event.actor?.name ? `by ${event.actor.name}` : null].filter(Boolean).join(' · ')}
                      </p>
                      {event.reason && <p className="break-words text-xs text-muted-foreground">{event.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection title="Contact">
              <Facts items={[
                { label: 'Email', value: lead.email || '-' },
                { label: 'Phone', value: formatPhone(lead.phone) || '-', mono: true },
                { label: 'Source', value: sourceLabel(lead.source) },
                { label: 'Timeframe', value: timeframeLabel(lead.timeframe) },
                { label: 'Customer', value: lead.customer ? (
                  <Link className="underline underline-offset-2" href={`${basePath}/platform/customers/${lead.customer.id}`}>
                    {[lead.customer.firstName, lead.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                  </Link>
                ) : 'Not linked' },
                duplicateCount > 0 && { label: 'Duplicates', value: (
                  <Link className="text-amber-700 underline underline-offset-2 dark:text-amber-300" href={`${basePath}/platform/customers/${lead.customer?.id}#duplicates`}>
                    {duplicateCount} possible
                  </Link>
                ) },
                lead.customer?.household && { label: 'Household', value: lead.customer.household.displayName || '-' },
              ]} />
            </DeskSection>

            <DeskSection title="Vehicle of interest">
              {lead.interestedVehicle ? (
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{vehicleName(lead.interestedVehicle)}</p>
                    <p className="text-xs text-muted-foreground">
                      <Code>#{lead.interestedVehicle.stockNumber}</Code> · <span className="tabular-nums">{formatCurrency(lead.interestedVehicle.price)}</span>
                    </p>
                  </div>
                  <Track className="shrink-0">
                    <Pill size="sm" asChild><Link href={`/inventory/${lead.interestedVehicle.id}`}>Listing</Link></Pill>
                  </Track>
                </div>
              ) : <p className="text-sm text-muted-foreground">No vehicle</p>}
            </DeskSection>

            <DeskSection title="Trade and finance">
              <Facts items={[
                { label: 'Trade-in', value: lead.tradeInVehicle || '-' },
                { label: 'Budget', value: budgetLabel(lead.budgetRange) },
              ]} />
              {lead.deals.length > 0 ? (
                <Panel className="mt-3 divide-y">
                  {lead.deals.map(deal => (
                    <Link key={deal.id} href={`${basePath}/platform/deals/${deal.id}`} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={dealTone[deal.status || ''] ?? 'idle'} status={deal.status || undefined} className="text-sm font-medium">{vehicleName(deal.vehicle)}</TitleLine>
                        <p className="pl-4 text-xs capitalize text-muted-foreground">{deal.status}</p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="text-sm font-medium">{formatCurrency(deal.vehiclePrice)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(deal.monthlyPayment)}/mo</p>
                      </div>
                    </Link>
                  ))}
                </Panel>
              ) : <p className="mt-2 text-sm text-muted-foreground">No deals</p>}
            </DeskSection>

            <DeskSection title="Test drives" count={lead.testDrives.length}>
              {lead.testDrives.length > 0 ? (
                <Panel className="divide-y">
                  {lead.testDrives.map(testDrive => {
                    const state = testDrive.completed ? 'Completed' : testDrive.noShow ? 'No-show' : 'Scheduled'
                    return (
                      <div key={testDrive.id} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5">
                        <TitleLine as="p" tone={testDrive.completed ? 'ok' : testDrive.noShow ? 'bad' : 'info'} status={state} className="text-sm">{vehicleName(testDrive.vehicle)}</TitleLine>
                        <span className="shrink-0 text-right text-xs text-muted-foreground"><span className="font-mono tabular-nums">{formatDateTime(testDrive.scheduledTime, timeZone)}</span> · {state}</span>
                      </div>
                    )
                  })}
                </Panel>
              ) : <p className="text-sm text-muted-foreground">No test drives</p>}
            </DeskSection>

            <DeskSection title="Consent">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Email', value: consentLabel(lead.customer?.emailSuppressed, lead.customer?.emailConsent) },
                  { label: 'SMS', value: consentLabel(lead.customer?.smsSuppressed, lead.customer?.smsConsent) },
                  { label: 'Phone', value: consentLabel(lead.customer?.phoneSuppressed, lead.customer?.phoneConsent) },
                ]} />
                <Select value={contactChannel} onValueChange={setContactChannel} disabled={!lead.customer || saving || !canManage}>
                  <SelectTrigger aria-label="Preferred channel" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preferred channel</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => saveContactPreference(false)} disabled={!lead.customer || saving || !canManage} title={manageReason}>Save preference</Pill>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => saveContactPreference(true)} disabled={!lead.customer || contactChannel === 'none' || saving || !canManage} title={manageReason}>Suppress</Pill>
                </Track>
              </div>
            </DeskSection>

            <DeskSection title="Cadence">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Status', value: <span className="capitalize">{lead.cadenceStatus || 'none'}</span> },
                  !!lead.cadenceStep && { label: 'Step', value: lead.cadenceStep },
                  !!lead.cadenceDueAt && { label: 'Due', value: formatDateTime(lead.cadenceDueAt, timeZone), mono: true },
                ]} />
                <FormField id="cadence-campaign" label="Campaign">
                  <Input id="cadence-campaign" className="h-11 sm:h-9" value={cadence.campaignKey} onChange={event => setCadence(prev => ({ ...prev, campaignKey: event.target.value }))} disabled={!canManage} />
                </FormField>
                <Select value={cadence.cadenceKey} onValueChange={value => setCadence(prev => ({ ...prev, cadenceKey: value }))} disabled={!canManage}>
                  <SelectTrigger aria-label="Follow-up cadence" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internet-lead-first-response">Internet first response</SelectItem>
                    <SelectItem value="showroom-follow-up">Showroom follow-up</SelectItem>
                    <SelectItem value="unsold-follow-up">Unsold follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={enrollCadence} disabled={saving || isClosed || !canManage} title={isClosed ? 'Lead is closed' : manageReason}>Enroll</Pill>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={advanceCadence} disabled={saving || lead.cadenceStatus !== 'active' || !canManage} title={lead.cadenceStatus !== 'active' ? 'No active cadence' : manageReason}>Advance</Pill>
                </Track>
              </div>
            </DeskSection>
          </div>
        </div>

        <OperatorActionDialog
          open={lostReasonDialogOpen}
          title="Close lead as lost"
          fields={[
            { name: 'lostReasonCode', label: 'Lost reason', type: 'select', placeholder: 'Select a reason', options: lostReasonOptions },
            { name: 'lostReasonDetails', label: 'Additional details', type: 'textarea', required: false, maxLength: 2000, placeholder: 'Optional' },
          ]}
          values={lostReasonValues}
          error={lostReasonError}
          busy={saving}
          submitLabel="Close as lost"
          onValuesChange={values => setLostReasonValues({ lostReasonCode: values.lostReasonCode || '', lostReasonDetails: values.lostReasonDetails || '' })}
          onSubmit={submitLostLeadTransition}
          onOpenChange={handleLostReasonDialogOpenChange}
        />
        <LeadFormDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          initialValues={leadFormValues(lead)}
          rooftops={[]}
          vehicles={[
            ...(lead.interestedVehicle && !vehicles.some(vehicle => vehicle.id === lead.interestedVehicle?.id)
              ? [{ ...lead.interestedVehicle, rooftop: { id: lead.rooftop.id } }]
              : []),
            ...vehicles.filter(vehicle => !vehicle.rooftop || vehicle.rooftop.id === lead.rooftop.id),
          ]}
          onSubmit={submitEdit}
        />
        <TransferLeadDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          staff={staff}
          currentOwnerId={lead.assignedSalesperson?.id || null}
          onSubmit={submitTransfer}
        />
        {visitDialog && (
          <SalesVisitDialog
            action={visitDialog.action}
            open={Boolean(visitDialog)}
            onOpenChange={open => { if (!open) setVisitDialog(null) }}
            timeZone={timeZone}
            staff={staff}
            vehicles={vehicles.filter(vehicle => !vehicle.rooftop || vehicle.rooftop.id === lead.rooftop.id)}
            defaultVehicleId={lead.interestedVehicle?.id || null}
            viewerId={viewer?.id || null}
            onSubmit={submitVisit}
          />
        )}
      </div>
    </PageContainer>
  )
}
