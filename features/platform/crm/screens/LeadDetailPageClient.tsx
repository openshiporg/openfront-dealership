'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CalendarPlus, Check, Mail, Phone, RefreshCw, Route } from 'lucide-react'
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
import {
  type LeadDetail,
  advanceLeadCadence,
  completeLeadTask,
  createLeadTask,
  enrollLeadCadence,
  getCustomerDuplicateCount,
  getLead,
  manageSalesVisit,
  recordLeadInteraction,
  routeLead,
  transitionLead,
  updateCustomerCommunicationPreferences,
} from '../actions'

type Lead = LeadDetail

const lostReasonOptions = [
  { value: 'purchased-elsewhere', label: 'Purchased elsewhere' },
  { value: 'price', label: 'Price' },
  { value: 'financing', label: 'Financing' },
  { value: 'vehicle-unavailable', label: 'Vehicle unavailable' },
  { value: 'no-response', label: 'No response' },
  { value: 'timing', label: 'Timing' },
  { value: 'other', label: 'Other' },
]

const leadStatuses: ReadonlyArray<{ value: string; label: string; tone: DeskTone }> = [
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'contacted', label: 'Contacted', tone: 'accent' },
  { value: 'test-drive-scheduled', label: 'Test drive', tone: 'info' },
  { value: 'negotiating', label: 'Negotiating', tone: 'warn' },
  { value: 'closed-won', label: 'Closed won', tone: 'ok' },
  { value: 'closed-lost', label: 'Closed lost', tone: 'bad' },
]

const visitTone: Record<string, DeskTone> = {
  scheduled: 'info',
  arrived: 'warn',
  'manager-turn': 'warn',
  completed: 'ok',
  cancelled: 'bad',
  'no-show': 'bad',
}

const dealTone: Record<string, DeskTone> = {
  pencil: 'idle',
  submitted: 'warn',
  approved: 'info',
  financed: 'info',
  delivered: 'ok',
  cancelled: 'bad',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

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

function statusConfig(status: string | null | undefined) {
  return leadStatuses.find(item => item.value === status) || leadStatuses[0]
}

function consentLabel(suppressed: boolean | null | undefined, consent: boolean | null | undefined) {
  return suppressed ? 'Suppressed' : consent ? 'Consented' : 'Not consented'
}

const label = (value: string | null | undefined) => (value ? value.replaceAll('-', ' ') : '-')

export function LeadDetailPageClient({
  id,
  initialLead,
  initialDuplicateCount,
  initialError,
}: {
  id: string
  initialLead: Lead | null
  initialDuplicateCount: number
  initialError: string | null
}) {
  const interactionKeyRef = useRef(`lead-interaction:${crypto.randomUUID()}`)
  const [lead, setLead] = useState<Lead | null>(initialLead)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [saving, setSaving] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(initialDuplicateCount)
  const [interaction, setInteraction] = useState({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
  const [task, setTask] = useState({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal' })
  const [contactChannel, setContactChannel] = useState(initialLead?.customer?.preferredChannel || 'none')
  const [cadence, setCadence] = useState({
    cadenceKey: initialLead?.cadenceKey || 'internet-lead-first-response',
    campaignKey: initialLead?.campaignKey || 'website-organic',
  })
  const [lostReasonDialogOpen, setLostReasonDialogOpen] = useState(false)
  const [lostReasonValues, setLostReasonValues] = useState({ lostReasonCode: '', lostReasonDetails: '' })
  const [lostReasonError, setLostReasonError] = useState<string | null>(null)
  const lostReasonIdempotencyKeyRef = useRef<string | null>(null)

  const loadLead = async () => {
    setLoading(true)
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

  const updateLeadStatus = async (status: string) => {
    if (status === 'closed-lost') {
      setLostReasonValues({ lostReasonCode: '', lostReasonDetails: '' })
      setLostReasonError(null)
      lostReasonIdempotencyKeyRef.current = `lead-transition:${id}:${status}:${crypto.randomUUID()}`
      setLostReasonDialogOpen(true)
      return
    }

    setSaving(true)
    const response = await transitionLead({ id, toStatus: status, idempotencyKey: `lead-transition:${id}:${status}:${crypto.randomUUID()}` })

    if (!response.success) alert(`Unable to update lead: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const submitLostLeadTransition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!lostReasonValues.lostReasonCode || !lostReasonIdempotencyKeyRef.current) return

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
      setLostReasonError(`Unable to update lead: ${response.error}`)
      setSaving(false)
      return
    }

    lostReasonIdempotencyKeyRef.current = null
    setLostReasonDialogOpen(false)
    await loadLead()
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
    if (!interaction.notes.trim()) {
      alert('Add interaction notes before logging activity')
      return
    }

    setSaving(true)
    const response = await recordLeadInteraction({
        leadId: id,
        idempotencyKey: interactionKeyRef.current,
        interactionType: interaction.interactionType,
        outcome: interaction.outcome,
        notes: interaction.notes,
        date: new Date().toISOString(),
        ...(interaction.followUpDate ? { followUpDate: new Date(interaction.followUpDate).toISOString() } : {}),
    })

    if (!response.success) {
      alert(`Unable to log interaction: ${response.error}`)
    } else {
      setInteraction({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
      interactionKeyRef.current = `lead-interaction:${crypto.randomUUID()}`
    }

    await loadLead()
    setSaving(false)
  }

  const applyRoutingRule = async () => {
    if (!lead) return
    setSaving(true)
    const response = await routeLead({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: `crm-route:${lead.id}:${lead.updatedAt}` })
    if (!response.success) alert(`Unable to route lead: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const createTask = async () => {
    if (!task.title.trim()) {
      alert('Task title is required')
      return
    }

    setSaving(true)
    const response = await createLeadTask({
        leadId: id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        communicationChannel: task.communicationChannel,
        idempotencyKey: `crm-task:${id}:${crypto.randomUUID()}`,
        ...(task.dueDate ? { dueDate: new Date(task.dueDate).toISOString() } : {}),
    })

    if (!response.success) {
      alert(`Unable to create task: ${response.error}`)
    } else {
      setTask({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal' })
    }

    await loadLead()
    setSaving(false)
  }

  const saveContactPreference = async (suppressSelected = false) => {
    if (!lead?.customer) return
    const selected = contactChannel
    if (suppressSelected && selected === 'none') { alert('Select a channel to suppress'); return }
    setSaving(true)
    const customer = lead.customer
    const response = await updateCustomerCommunicationPreferences(lead.id, {
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
    })
    if (!response.success) alert(`Unable to update preferences: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const enrollCadence = async () => {
    if (!lead) return
    setSaving(true)
    const response = await enrollLeadCadence({
      leadId: lead.id,
      expectedUpdatedAt: lead.updatedAt,
      cadenceKey: cadence.cadenceKey,
      campaignKey: cadence.campaignKey,
      idempotencyKey: `crm-cadence:${lead.id}:${crypto.randomUUID()}`,
    })
    if (!response.success) alert(`Unable to enroll cadence: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const advanceCadence = async () => {
    if (!lead) return
    setSaving(true)
    const response = await advanceLeadCadence({
      leadId: lead.id,
      expectedUpdatedAt: lead.updatedAt,
      idempotencyKey: `crm-cadence-advance:${lead.id}:${crypto.randomUUID()}`,
    })
    if (!response.success) alert(`Unable to advance cadence: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const manageVisit = async (action: string, visit?: Lead['salesVisits'][number]) => {
    if (!lead) return
    setSaving(true)
    const response = await manageSalesVisit(
      lead.id,
      action === 'schedule'
        ? {
            action,
            leadId: lead.id,
            kind: 'appointment',
            vehicleId: lead.interestedVehicle?.id,
            scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
            notes: 'Scheduled from CRM',
            idempotencyKey: `crm-visit:${lead.id}:${crypto.randomUUID()}`,
          }
        : {
            action,
            visitId: visit?.id,
            expectedUpdatedAt: visit?.updatedAt,
            outcome: action === 'complete' ? 'follow-up-required' : undefined,
            notes: `${action} recorded from CRM`,
            idempotencyKey: `crm-visit:${visit?.id}:${crypto.randomUUID()}`,
          }
    )
    if (!response.success) alert(`Unable to update visit: ${response.error}`)
    await loadLead()
    setSaving(false)
  }

  const completeTask = async (taskId: string) => {
    setSaving(true)
    const response = await completeLeadTask(id, taskId)

    if (!response.success) alert(`Unable to complete task: ${response.error}`)
    await loadLead()
    setSaving(false)
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
        <div className="space-y-3 px-4 pb-6 md:px-6" role="status" aria-label="Loading lead">
          <div className="h-7 w-56 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </PageContainer>
    )
  }

  if (!lead) {
    return (
      <PageContainer
        title="CRM"
        breadcrumbs={breadcrumbs}
        header={<DeskHeader title="Lead unavailable" tone="bad" status="Unavailable" />}
      >
        <div className="space-y-3 px-4 pb-6 md:px-6">
          <Notice tone="bad">{error || 'This lead was not found.'}</Notice>
          <Track>
            <Pill onClick={loadLead}>Retry</Pill>
            <Pill asChild>
              <Link href={`${basePath}/platform/crm`}>Back to CRM</Link>
            </Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const currentStatus = statusConfig(lead.status)
  const openTasks = lead.tasks.filter(task => !task.completed)
  const completedTasks = lead.tasks.filter(task => task.completed)
  const responseOverdue = Boolean(lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now())
  const isClosed = ['closed-won', 'closed-lost'].includes(lead.status || '')

  const header = (
    <DeskHeader
      title={leadName(lead)}
      tone={currentStatus.tone}
      status={currentStatus.label}
      meta={
        <span>
          {currentStatus.label} · Created {formatDate(lead.createdAt)} · Last contact {formatDate(lead.lastContact)}
        </span>
      }
      actions={
        <Track>
          {lead.phone && (
            <Pill asChild>
              <a href={`tel:${lead.phone}`}><Phone />Call</a>
            </Pill>
          )}
          {lead.email && (
            <Pill asChild>
              <a href={`mailto:${lead.email}`}><Mail />Email</a>
            </Pill>
          )}
          <Pill onClick={() => manageVisit('schedule')} disabled={saving}>
            <CalendarPlus />Schedule in 1h
          </Pill>
          <Pill asChild variant="primary">
            <Link href={`${basePath}/platform/deals/create`}>Start deal</Link>
          </Pill>
          <Pill onClick={loadLead} aria-label="Refresh">
            <RefreshCw />
          </Pill>
        </Track>
      }
    />
  )

  const selectSm = 'h-9'

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-10 md:px-6">
        {responseOverdue && <Notice tone="warn" className="mb-6">First response overdue · due {formatDate(lead.firstResponseDueAt)}</Notice>}

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Main column */}
          <div className="min-w-0 space-y-8">
            <DeskSection title="Activity" count={lead.interactions.length}>
              <Panel className="space-y-2 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={interaction.interactionType} onValueChange={(value) => setInteraction(prev => ({ ...prev, interactionType: value }))}>
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
                  <Select value={interaction.outcome} onValueChange={(value) => setInteraction(prev => ({ ...prev, outcome: value }))}>
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
                  value={interaction.notes}
                  onChange={(event) => setInteraction(prev => ({ ...prev, notes: event.target.value }))}
                  placeholder="Notes"
                  className="min-h-20"
                />
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    Follow up
                    <Input
                      aria-label="Follow-up date"
                      type="datetime-local"
                      value={interaction.followUpDate}
                      onChange={(event) => setInteraction(prev => ({ ...prev, followUpDate: event.target.value }))}
                      className="h-9 min-w-0 flex-1 sm:w-56"
                    />
                  </label>
                  <Track className="self-end">
                    <Pill variant="primary" onClick={logInteraction} disabled={saving}>Log activity</Pill>
                  </Track>
                </div>
              </Panel>

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
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                      {item.performedBy?.name && <p className="text-xs text-muted-foreground">{item.performedBy.name}</p>}
                      {item.notes && <p className="mt-1 whitespace-pre-line break-words text-sm">{item.notes}</p>}
                      {item.followUpDate && <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Follow up {formatDate(item.followUpDate)}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection title="Tasks" count={openTasks.length}>
              {openTasks.length > 0 && (
                <Panel className="mb-3 divide-y">
                  {openTasks.map(item => (
                    <div key={item.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={item.priority === 'urgent' || item.priority === 'high' ? 'warn' : 'idle'} status={item.priority || undefined} className="text-sm font-medium">
                          {item.title}
                        </TitleLine>
                        <p className="pl-4 text-xs text-muted-foreground">Due {formatDate(item.dueDate)} · <span className="capitalize">{item.priority}</span></p>
                        {item.description && <p className="mt-0.5 break-words pl-4 text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                      <Track className="shrink-0">
                        <Pill size="sm" onClick={() => completeTask(item.id)} disabled={saving} aria-label={`Complete ${item.title || 'task'}`}>
                          <Check />Done
                        </Pill>
                      </Track>
                    </div>
                  ))}
                </Panel>
              )}
              {openTasks.length === 0 && <p className="pb-3 text-sm text-muted-foreground">No open tasks</p>}
              {completedTasks.length > 0 && <p className="pb-3 text-xs text-muted-foreground">{completedTasks.length} completed</p>}

              <Panel className="space-y-2 p-3">
                <Input
                  aria-label="Task title"
                  value={task.title}
                  onChange={(event) => setTask(prev => ({ ...prev, title: event.target.value }))}
                  placeholder="Task title"
                />
                <Textarea
                  aria-label="Task details"
                  value={task.description}
                  onChange={(event) => setTask(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="Details"
                  className="min-h-16"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    aria-label="Task due date"
                    type="datetime-local"
                    value={task.dueDate}
                    onChange={(event) => setTask(prev => ({ ...prev, dueDate: event.target.value }))}
                    className="h-9 min-w-0"
                  />
                  <Select value={task.priority} onValueChange={(value) => setTask(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger className={selectSm} aria-label="Task priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={task.communicationChannel} onValueChange={(value) => setTask(prev => ({ ...prev, communicationChannel: value }))}>
                    <SelectTrigger className={selectSm} aria-label="Task channel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Track>
                    <Pill onClick={createTask} disabled={saving}>Create task</Pill>
                  </Track>
                </div>
              </Panel>
            </DeskSection>

            <DeskSection title="Notes">
              <p className="whitespace-pre-line break-words text-sm">{lead.notes || <span className="text-muted-foreground">No notes</span>}</p>
            </DeskSection>
          </div>

          {/* Side column */}
          <div className="min-w-0 space-y-8">
            <DeskSection title="Status">
              <div className="space-y-3">
                <Select value={lead.status || 'new'} onValueChange={updateLeadStatus} disabled={saving}>
                  <SelectTrigger aria-label="Lead status"><SelectValue /></SelectTrigger>
                  <SelectContent>{leadStatuses.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
                </Select>
                {lead.status === 'closed-lost' && (lead.lostReasonCode || lead.lostReason) && (
                  <Facts items={[
                    !!lead.lostReasonCode && { label: 'Lost reason', value: <span className="capitalize">{label(lead.lostReasonCode)}</span> },
                    !!lead.lostReason && { label: 'Details', value: lead.lostReason },
                  ]} />
                )}
                {!lead.assignedSalesperson && (
                  <Track>
                    <Pill onClick={applyRoutingRule} disabled={saving}><Route />Apply routing rule</Pill>
                  </Track>
                )}
              </div>
            </DeskSection>

            <DeskSection title="Contact">
              <Facts items={[
                { label: 'Email', value: lead.email || '-' },
                { label: 'Phone', value: lead.phone || '-', mono: true },
                { label: 'Source', value: <span className="capitalize">{label(lead.source)}</span> },
                { label: 'Timeframe', value: <span className="capitalize">{label(lead.timeframe)}</span> },
                { label: 'Salesperson', value: lead.assignedSalesperson?.name || 'Unassigned' },
                { label: 'First response', value: lead.firstResponseAt ? `Responded ${formatDate(lead.firstResponseAt)}` : lead.firstResponseDueAt ? `Due ${formatDate(lead.firstResponseDueAt)}` : 'Not assigned' },
                { label: 'Customer', value: `${lead.customer ? 'Linked' : 'Not linked'}${duplicateCount > 0 ? ` · ${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'}` : ''}` },
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
                    <Pill size="sm" asChild>
                      <Link href={`/inventory/${lead.interestedVehicle.id}`}>Listing</Link>
                    </Pill>
                  </Track>
                </div>
              ) : <p className="text-sm text-muted-foreground">No vehicle</p>}
            </DeskSection>

            <DeskSection title="Trade and finance">
              <Facts items={[
                { label: 'Trade-in', value: lead.tradeInVehicle || '-' },
                { label: 'Budget', value: lead.budgetRange || '-' },
              ]} />
              {lead.deals.length > 0 && (
                <Panel className="mt-3 divide-y">
                  {lead.deals.map(deal => (
                    <Link key={deal.id} href={`${basePath}/platform/deals/${deal.id}`} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={dealTone[deal.status || ''] ?? 'idle'} status={deal.status || undefined} className="text-sm font-medium">
                          {vehicleName(deal.vehicle)}
                        </TitleLine>
                        <p className="pl-4 text-xs capitalize text-muted-foreground">{deal.status}</p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="text-sm font-medium">{formatCurrency(deal.vehiclePrice)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(deal.monthlyPayment)}/mo</p>
                      </div>
                    </Link>
                  ))}
                </Panel>
              )}
              {lead.deals.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No deals</p>}
            </DeskSection>

            <DeskSection title="Test drives" count={lead.testDrives.length}>
              {lead.testDrives.length > 0 ? (
                <Panel className="divide-y">
                  {lead.testDrives.map(testDrive => (
                    <div key={testDrive.id} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5">
                      <TitleLine as="p" tone={testDrive.completed ? 'ok' : 'info'} status={testDrive.completed ? 'Completed' : 'Pending'} className="text-sm">
                        {vehicleName(testDrive.vehicle)}
                      </TitleLine>
                      <span className="shrink-0 text-right text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">{formatDate(testDrive.scheduledTime)}</span> · {testDrive.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </Panel>
              ) : <p className="text-sm text-muted-foreground">No test drives</p>}
            </DeskSection>

            <DeskSection title="Showroom visits" count={lead.salesVisits.length}>
              {lead.salesVisits.length > 0 ? (
                <Panel className="divide-y">
                  {lead.salesVisits.slice(0, 3).map(visit => (
                    <div key={visit.id} className="space-y-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={visitTone[visit.status || ''] ?? 'idle'} status={visit.status || undefined} className="text-sm font-medium capitalize">
                          {label(visit.kind)} · {label(visit.status)}
                        </TitleLine>
                        <p className="pl-4 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">{formatDate(visit.scheduledAt)}</span>
                          {visit.manager?.name ? ` · Manager ${visit.manager.name}` : ''}
                        </p>
                      </div>
                      {(visit.status === 'scheduled' || ['arrived', 'manager-turn'].includes(visit.status || '')) && (
                        <Track className="ml-4">
                          {visit.status === 'scheduled' && <Pill size="sm" onClick={() => manageVisit('arrive', visit)}>Arrive</Pill>}
                          {visit.status === 'arrived' && <Pill size="sm" onClick={() => manageVisit('manager-turn', visit)}>Manager turn</Pill>}
                          {['arrived', 'manager-turn'].includes(visit.status || '') && <Pill size="sm" onClick={() => manageVisit('complete', visit)}>Complete</Pill>}
                        </Track>
                      )}
                    </div>
                  ))}
                </Panel>
              ) : <p className="text-sm text-muted-foreground">No visits</p>}
            </DeskSection>

            <DeskSection title="Consent">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Email', value: consentLabel(lead.customer?.emailSuppressed, lead.customer?.emailConsent) },
                  { label: 'SMS', value: consentLabel(lead.customer?.smsSuppressed, lead.customer?.smsConsent) },
                  { label: 'Phone', value: consentLabel(lead.customer?.phoneSuppressed, lead.customer?.phoneConsent) },
                ]} />
                <Select value={contactChannel} onValueChange={setContactChannel} disabled={!lead.customer || saving}>
                  <SelectTrigger aria-label="Preferred channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preferred channel</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" onClick={() => saveContactPreference(false)} disabled={!lead.customer || saving}>Save preference</Pill>
                  <Pill size="sm" onClick={() => saveContactPreference(true)} disabled={!lead.customer || contactChannel === 'none' || saving}>Suppress</Pill>
                </Track>
              </div>
            </DeskSection>

            <DeskSection title="Cadence">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Status', value: <span className="capitalize">{lead.cadenceStatus || 'none'}</span> },
                  !!lead.cadenceStep && { label: 'Step', value: lead.cadenceStep },
                  !!lead.cadenceDueAt && { label: 'Due', value: formatDate(lead.cadenceDueAt), mono: true },
                ]} />
                <Input
                  aria-label="Campaign"
                  value={cadence.campaignKey}
                  onChange={(event) => setCadence(prev => ({ ...prev, campaignKey: event.target.value }))}
                  placeholder="Campaign"
                />
                <Select value={cadence.cadenceKey} onValueChange={(value) => setCadence(prev => ({ ...prev, cadenceKey: value }))}>
                  <SelectTrigger aria-label="Follow-up cadence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internet-lead-first-response">Internet first response</SelectItem>
                    <SelectItem value="showroom-follow-up">Showroom follow-up</SelectItem>
                    <SelectItem value="unsold-follow-up">Unsold follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" onClick={enrollCadence} disabled={saving || isClosed}>Enroll</Pill>
                  <Pill size="sm" onClick={advanceCadence} disabled={saving || lead.cadenceStatus !== 'active'}>Advance</Pill>
                </Track>
              </div>
            </DeskSection>
          </div>
        </div>

        <OperatorActionDialog
          open={lostReasonDialogOpen}
          title="Close lead as lost"
          description="Choose a reason."
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
      </div>
    </PageContainer>
  )
}
