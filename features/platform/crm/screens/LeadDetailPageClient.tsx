'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calendar, Car, CheckCircle2, ClipboardList, Mail, MessageSquare, Phone, Plus, RefreshCw, Route, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
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

const leadStatuses = [
  { value: 'new', label: 'New', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted', label: 'Contacted', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'test-drive-scheduled', label: 'Test Drive', className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'negotiating', label: 'Negotiating', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'closed-won', label: 'Closed Won', className: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'closed-lost', label: 'Closed Lost', className: 'bg-red-100 text-red-700 border-red-200' },
]

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

function vehicleName(vehicle: Lead['interestedVehicle']) {
  if (!vehicle) return 'No vehicle selected'
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

function statusConfig(status: string | null | undefined) {
  return leadStatuses.find(item => item.value === status) || leadStatuses[0]
}

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
        <div className="flex min-h-[400px] items-center justify-center p-6" role="status" aria-label="Loading lead">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageContainer>
    )
  }

  if (!lead) {
    return (
      <PageContainer title="CRM" breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <h1 className="text-xl font-semibold">Lead unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error || 'This lead was not found.'}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" onClick={loadLead}>
                  Retry
                </Button>
                <Button asChild variant="outline">
                  <Link href={`${basePath}/platform/crm`}>Back to CRM</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  const currentStatus = statusConfig(lead.status)
  const openTasks = lead.tasks.filter(task => !task.completed)
  const completedTasks = lead.tasks.filter(task => task.completed)

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{leadName(lead)}</h1>
          <Badge variant="outline" className={currentStatus.className}>
            {currentStatus.label}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Created {formatDate(lead.createdAt)} · Last contact {formatDate(lead.lastContact)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={loadLead}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  )

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" />Customer Profile</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Email</p><p className="font-medium flex items-center gap-2"><Mail className="h-4 w-4" />{lead.email || '-'}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium flex items-center gap-2"><Phone className="h-4 w-4" />{lead.phone || '-'}</p></div>
              <div><p className="text-muted-foreground">Source</p><p className="font-medium capitalize">{lead.source || '-'}</p></div>
              <div><p className="text-muted-foreground">Timeframe</p><p className="font-medium capitalize">{lead.timeframe?.replaceAll('-', ' ') || '-'}</p></div>
              <div><p className="text-muted-foreground">Budget</p><p className="font-medium">{lead.budgetRange || '-'}</p></div>
              <div><p className="text-muted-foreground">Assigned Salesperson</p><p className="font-medium">{lead.assignedSalesperson?.name || 'Unassigned'}</p></div>
              <div><p className="text-muted-foreground">First response due</p><p className="font-medium">{lead.firstResponseAt ? `Responded ${formatDate(lead.firstResponseAt)}` : lead.firstResponseDueAt ? formatDate(lead.firstResponseDueAt) : 'Not assigned'}</p></div>
              <div><p className="text-muted-foreground">Customer record</p><p className="font-medium">{lead.customer ? 'Linked' : 'Not linked'}{duplicateCount > 0 ? ` · ${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'}` : ''}</p></div>
              <div className="md:col-span-2"><p className="text-muted-foreground">Notes</p><p className="whitespace-pre-line">{lead.notes || 'No notes.'}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Car className="h-5 w-5" />Vehicle Interest</CardTitle></CardHeader>
            <CardContent>
              {lead.interestedVehicle ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{vehicleName(lead.interestedVehicle)}</p>
                    <p className="text-sm text-muted-foreground">Stock #{lead.interestedVehicle.stockNumber} · {formatCurrency(lead.interestedVehicle.price)}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/inventory/${lead.interestedVehicle.id}`}>View listing</Link>
                  </Button>
                </div>
              ) : <p className="text-muted-foreground">No vehicle selected.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Interaction Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {lead.interactions.length === 0 ? <p className="text-muted-foreground">No interactions yet.</p> : lead.interactions.map(item => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium capitalize">{item.interactionType}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">Outcome: {item.outcome || '-'}</p>
                  {item.notes && <p className="mt-2 text-sm whitespace-pre-line">{item.notes}</p>}
                  {item.followUpDate && <p className="mt-2 text-xs text-blue-700">Follow up: {formatDate(item.followUpDate)}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!lead.assignedSalesperson && (
                <Button variant="outline" className="w-full" onClick={applyRoutingRule} disabled={saving}>
                  <Route className="mr-2 h-4 w-4" />Apply routing rule
                </Button>
              )}
              {lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now() && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />First response is overdue.
                </div>
              )}
              <Select value={lead.status || 'new'} onValueChange={updateLeadStatus} disabled={saving}>
                <SelectTrigger aria-label="Lead status"><SelectValue /></SelectTrigger>
                <SelectContent>{leadStatuses.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Consent &amp; suppression</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={contactChannel} onValueChange={setContactChannel} disabled={!lead.customer || saving}>
                <SelectTrigger aria-label="Preferred channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preferred channel</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Email {lead.customer?.emailSuppressed ? 'suppressed' : lead.customer?.emailConsent ? 'consented' : 'not consented'} · SMS {lead.customer?.smsSuppressed ? 'suppressed' : lead.customer?.smsConsent ? 'consented' : 'not consented'} · Phone {lead.customer?.phoneSuppressed ? 'suppressed' : lead.customer?.phoneConsent ? 'consented' : 'not consented'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => saveContactPreference(false)} disabled={!lead.customer || saving}>Save preference</Button>
                <Button variant="outline" onClick={() => saveContactPreference(true)} disabled={!lead.customer || contactChannel === 'none' || saving}>Suppress channel</Button>
              </div>
              {lead.customer?.household && <p className="text-xs text-muted-foreground">Household: {lead.customer.household.displayName}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Campaign &amp; cadence</CardTitle></CardHeader>
            <CardContent className="space-y-3">
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
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={enrollCadence} disabled={saving || ['closed-won', 'closed-lost'].includes(lead.status || '')}>Enroll</Button>
                <Button variant="outline" onClick={advanceCadence} disabled={saving || lead.cadenceStatus !== 'active'}>Advance</Button>
              </div>
              <p className="text-xs text-muted-foreground">{lead.cadenceStatus || 'none'}{lead.cadenceStep ? ` · ${lead.cadenceStep}` : ''}{lead.cadenceDueAt ? ` · due ${formatDate(lead.cadenceDueAt)}` : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Appointment &amp; showroom</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={() => manageVisit('schedule')} disabled={saving}>Schedule one hour out</Button>
              {lead.salesVisits.slice(0, 3).map(visit => (
                <div key={visit.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <p className="font-medium capitalize">{visit.kind} · {visit.status}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(visit.scheduledAt)}{visit.manager?.name ? ` · Manager ${visit.manager.name}` : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {visit.status === 'scheduled' && <Button size="sm" variant="outline" onClick={() => manageVisit('arrive', visit)}>Arrive</Button>}
                    {visit.status === 'arrived' && <Button size="sm" variant="outline" onClick={() => manageVisit('manager-turn', visit)}>Manager turn</Button>}
                    {['arrived', 'manager-turn'].includes(visit.status || '') && <Button size="sm" variant="outline" onClick={() => manageVisit('complete', visit)}>Complete</Button>}
                  </div>
                </div>
              ))}
              {lead.salesVisits.length === 0 && <p className="text-sm text-muted-foreground">No sales visits recorded.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Log Interaction</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={interaction.interactionType} onValueChange={(value) => setInteraction(prev => ({ ...prev, interactionType: value }))}>
                  <SelectTrigger aria-label="Interaction type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">Text</SelectItem>
                    <SelectItem value="visit">Visit</SelectItem>
                    <SelectItem value="test-drive">Test Drive</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={interaction.outcome} onValueChange={(value) => setInteraction(prev => ({ ...prev, outcome: value }))}>
                  <SelectTrigger aria-label="Interaction outcome"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="no-answer">No Answer</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                aria-label="Interaction notes"
                value={interaction.notes}
                onChange={(event) => setInteraction(prev => ({ ...prev, notes: event.target.value }))}
                placeholder="What happened?"
              />
              <Input
                aria-label="Follow-up date"
                type="datetime-local"
                value={interaction.followUpDate}
                onChange={(event) => setInteraction(prev => ({ ...prev, followUpDate: event.target.value }))}
              />
              <Button className="w-full" onClick={logInteraction} disabled={saving}>Log Activity</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Follow-Up Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
                  placeholder="Task details"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Task due date"
                    type="datetime-local"
                    value={task.dueDate}
                    onChange={(event) => setTask(prev => ({ ...prev, dueDate: event.target.value }))}
                  />
                  <Select value={task.priority} onValueChange={(value) => setTask(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger aria-label="Task priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={task.communicationChannel} onValueChange={(value) => setTask(prev => ({ ...prev, communicationChannel: value }))}>
                  <SelectTrigger aria-label="Task channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal task</SelectItem>
                    <SelectItem value="email">Email follow-up</SelectItem>
                    <SelectItem value="sms">SMS follow-up</SelectItem>
                    <SelectItem value="phone">Phone follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" variant="outline" onClick={createTask} disabled={saving}>Create Task</Button>
              </div>
              <div className="space-y-2">
                {openTasks.map(item => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">Due {formatDate(item.dueDate)} · {item.priority}</p></div>
                      <Button size="sm" variant="ghost" onClick={() => completeTask(item.id)} disabled={saving} aria-label={`Complete ${item.title || 'task'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {openTasks.length === 0 && <p className="text-sm text-muted-foreground">No open tasks.</p>}
                {completedTasks.length > 0 && <p className="text-xs text-muted-foreground">{completedTasks.length} completed task(s)</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Test Drives & Deals</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lead.testDrives.map(testDrive => <p key={testDrive.id}>{formatDate(testDrive.scheduledTime)} · {testDrive.completed ? 'Completed' : 'Pending'}</p>)}
              {lead.deals.map(deal => <Link key={deal.id} href={`${basePath}/platform/deals/${deal.id}`} className="block text-primary hover:underline">{deal.status} · {formatCurrency(deal.vehiclePrice)} · {formatCurrency(deal.monthlyPayment)}/mo</Link>)}
              {lead.testDrives.length === 0 && lead.deals.length === 0 && <p className="text-muted-foreground">No test drives or deals yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
      <OperatorActionDialog
        open={lostReasonDialogOpen}
        title="Close lead as lost"
        description="Choose a reason and add any details."
        fields={[
          { name: 'lostReasonCode', label: 'Lost reason', type: 'select', placeholder: 'Select a reason', options: lostReasonOptions },
          { name: 'lostReasonDetails', label: 'Additional details', type: 'textarea', required: false, maxLength: 2000, placeholder: 'Optional context' },
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
