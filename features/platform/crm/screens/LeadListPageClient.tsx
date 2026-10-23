'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
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
  type DeskTone,
} from '@/features/platform/components/desk'
import { type CrmLeadSummary, getCrmLeads } from '../actions'
import { dayKey, formatPhone } from '@/features/platform/lib/format'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  source: string
  status: string
  temperature: string | null
  createdAt: string
  firstResponseDueAt: string | null
  firstResponseAt: string | null
  lastContact: string | null
  assignedTo: { id: string; name: string } | null
  interestedVehicle: { id: string; year: number; make: string; model: string } | null
}

function toLead(lead: CrmLeadSummary): Lead {
  const { assignedSalesperson, ...rest } = lead
  return { ...rest, assignedTo: assignedSalesperson }
}

const statusStages: ReadonlyArray<{ value: string; label: string; tone: DeskTone }> = [
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'contacted', label: 'Contacted', tone: 'accent' },
  { value: 'test-drive-scheduled', label: 'Test drive', tone: 'info' },
  { value: 'negotiating', label: 'Negotiating', tone: 'warn' },
  { value: 'closed-won', label: 'Closed won', tone: 'ok' },
  { value: 'closed-lost', label: 'Closed lost', tone: 'bad' },
]

const temperatureLabels: Record<string, string> = {
  immediately: 'Hot',
  'this-week': 'This week',
  'this-month': 'This month',
  'just-looking': 'Just looking',
}

const sourceLabels: Record<string, string> = {
  website: 'Website',
  phone: 'Phone',
  'walk-in': 'Walk-in',
  referral: 'Referral',
  ad: 'Advertisement',
  social: 'Social',
  'third-party': '3rd party',
}

const isOverdue = (lead: Lead) =>
  !lead.firstResponseAt && Boolean(lead.firstResponseDueAt) && new Date(lead.firstResponseDueAt as string).getTime() < Date.now()

export function LeadListPageClient({
  initialLeads,
  initialError,
  timeZone,
}: {
  initialLeads: CrmLeadSummary[]
  initialError: string | null
  timeZone: string
}) {
  const [leads, setLeads] = useState<Lead[]>(() => initialLeads.map(toLead))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  const loadLeads = async () => {
    setLoading(true)
    setError(null)
    const response = await getCrmLeads()
    if (response.success) {
      setLeads((response.data.crmWorkspace.leads || []).map(toLead))
    } else {
      setError(response.error || 'Unable to load leads.')
    }
    setLoading(false)
  }

  const isFiltered = Boolean(searchQuery.trim()) || sourceFilter !== 'all'
  const resetFilters = () => {
    setSearchQuery('')
    setSourceFilter('all')
  }

  const filteredLeads = leads.filter(lead => {
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const str = `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.phone} ${lead.interestedVehicle?.make || ''} ${lead.interestedVehicle?.model || ''}`.toLowerCase()
    return str.includes(search)
  }).sort((a, b) => {
    if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (sortOrder === 'sla') return new Date(a.firstResponseDueAt || '9999-12-31').getTime() - new Date(b.firstResponseDueAt || '9999-12-31').getTime()
    if (sortOrder === 'last-contact') return new Date(b.lastContact || 0).getTime() - new Date(a.lastContact || 0).getTime()
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const getLeadsByStatus = (status: string) => filteredLeads.filter(l => l.status === status)
  const isClosed = (status: string) => ['closed-won', 'closed-lost'].includes(status)
  const queueLeads = statusFilter === 'all'
    ? filteredLeads
    : statusFilter === 'open'
      ? filteredLeads.filter(l => !isClosed(l.status))
      : getLeadsByStatus(statusFilter)

  const formatDate = (date: string) => {
    const days = Math.round((Date.parse(dayKey(Date.now(), timeZone)) - Date.parse(dayKey(date, timeZone))) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days > 1 && days < 7) return `${days} days ago`
    return new Date(date).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' })
  }

  const formatDue = (date: string) =>
    new Date(date).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const activeLeads = filteredLeads.filter(l => !isClosed(l.status)).length
  const hotLeads = filteredLeads.filter(l => l.temperature === 'immediately' && !isClosed(l.status)).length
  const convertedCount = filteredLeads.filter(l => l.status === 'closed-won').length
  const overdueCount = filteredLeads.filter(isOverdue).length

  const statusOptions = [
    { value: 'open', label: 'Open', count: activeLeads },
    ...statusStages.map(stage => ({ value: stage.value, label: stage.label, count: getLeadsByStatus(stage.value).length, tone: stage.tone })),
    { value: 'all', label: 'All', count: filteredLeads.length },
  ]

  const nextStep = (lead: Lead): { label: string; tone?: 'bad' } => {
    if (isClosed(lead.status)) return { label: statusStages.find(s => s.value === lead.status)?.label ?? lead.status }
    if (isOverdue(lead)) return { label: 'Response overdue', tone: 'bad' }
    if (!lead.firstResponseAt && lead.firstResponseDueAt) return { label: `Respond by ${formatDue(lead.firstResponseDueAt)}` }
    if (!lead.firstResponseAt) return { label: 'First response' }
    return { label: 'Follow up' }
  }

  const LeadRow = ({ lead, compact }: { lead: Lead; compact?: boolean }) => {
    const stage = statusStages.find(s => s.value === lead.status) || statusStages[0]
    const step = nextStep(lead)
    const vehicle = lead.interestedVehicle
      ? `${lead.interestedVehicle.year} ${lead.interestedVehicle.make} ${lead.interestedVehicle.model}`
      : null
    const activity = lead.lastContact ? `Contacted ${formatDate(lead.lastContact)}` : `Created ${formatDate(lead.createdAt)}`
    return (
      <Link
        href={`${basePath}/platform/crm/${lead.id}`}
        className={`flex min-w-0 flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 ${compact ? '' : 'sm:flex-row sm:items-start sm:justify-between sm:gap-6'}`}
      >
        <div className="min-w-0">
          <TitleLine as="p" tone={stage.tone} status={stage.label} className="text-sm font-medium text-foreground">
            {lead.firstName} {lead.lastName}
            {lead.temperature === 'immediately' && !isClosed(lead.status) && (
              <span className="ml-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-red-600 dark:text-red-400">Hot</span>
            )}
          </TitleLine>
          <p className="break-words pl-4 text-xs text-muted-foreground">
            {[sourceLabels[lead.source] || lead.source, vehicle, activity].filter(Boolean).join(' · ')}
          </p>
          {!compact && (
            <p className="truncate pl-4 text-xs text-muted-foreground">
              {[lead.email, formatPhone(lead.phone)].filter(Boolean).join(' · ')}
              {lead.temperature && lead.temperature !== 'immediately' && ` · ${temperatureLabels[lead.temperature] || lead.temperature}`}
            </p>
          )}
        </div>
        <div className={`min-w-0 pl-4 text-xs ${compact ? '' : 'sm:shrink-0 sm:pl-0 sm:text-right'}`}>
          <p className={lead.assignedTo ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {lead.assignedTo?.name || 'Unassigned'}
          </p>
          <p className={step.tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>{step.label}</p>
        </div>
      </Link>
    )
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'CRM' },
  ]

  const header = (
    <DeskHeader
      title="Leads"
      tone={error ? 'bad' : overdueCount > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : overdueCount > 0 ? `${overdueCount} response overdue` : 'No overdue responses'}
      meta={`${activeLeads} open · ${overdueCount} response overdue`}
      actions={
        <Track>
          <Pill onClick={loadLeads} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        <ReadoutStrip>
          <Readout label="Open" value={activeLeads} />
          <Readout label="Hot" value={hotLeads} tone={hotLeads > 0 ? 'bad' : 'idle'} sub={`${overdueCount} response overdue`} />
          <Readout label="Converted" value={convertedCount} tone={convertedCount > 0 ? 'ok' : 'idle'} />
          <Readout
            label="Conversion"
            value={`${filteredLeads.length > 0 ? Math.round((convertedCount / filteredLeads.length) * 100) : 0}%`}
          />
        </ReadoutStrip>

        <div className="space-y-3">
          <Segmented label="Lead status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} size="sm" />
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search leads"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by source">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="third-party">3rd party</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort leads">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="sla">Response due first</SelectItem>
                  <SelectItem value="last-contact">Recent contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Segmented
              label="View"
              value={viewMode}
              onChange={setViewMode}
              size="sm"
              className="sm:ml-auto"
              options={[
                { value: 'list', label: 'List' },
                { value: 'kanban', label: 'Board' },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <Panel className="divide-y" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2 px-4 py-3">
                <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </Panel>
        ) : error ? (
          <Notice tone="bad">
            <p className="font-medium">Unable to load leads</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadLeads}>Retry</Pill>
            </Track>
          </Notice>
        ) : filteredLeads.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{isFiltered ? 'No matching leads' : 'No leads'}</p>
            {isFiltered && (
              <Track>
                <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
              </Track>
            )}
          </Panel>
        ) : viewMode === 'kanban' ? (
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {statusStages
              .filter(s => !isClosed(s.value))
              .filter(s => statusFilter === 'all' || statusFilter === 'open' || statusFilter === s.value)
              .map(stage => {
                const stageLeads = getLeadsByStatus(stage.value)
                return (
                  <DeskSection
                    key={stage.value}
                    title={<TitleLine as="span" tone={stage.tone}>{stage.label}</TitleLine>}
                    count={stageLeads.length}
                  >
                    {stageLeads.length > 0 ? (
                      <Panel className="divide-y">
                        {stageLeads.map(lead => <LeadRow key={lead.id} lead={lead} compact />)}
                      </Panel>
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No leads</p>
                    )}
                  </DeskSection>
                )
              })}
          </div>
        ) : queueLeads.length === 0 ? (
          <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">No leads</Panel>
        ) : (
          <Panel className="divide-y">
            {queueLeads.map(lead => <LeadRow key={lead.id} lead={lead} />)}
          </Panel>
        )}
      </div>
    </PageContainer>
  )
}
