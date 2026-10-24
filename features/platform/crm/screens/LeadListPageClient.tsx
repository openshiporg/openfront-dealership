'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ListChecks, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  DeskHeader,
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
import {
  createLead,
  getLeadList,
  getLeadVehicleOptions,
  getRooftopStaff,
  type CrmLeadRow,
  type CrmPerson,
  type CrmRooftop,
  type CrmVehicleOption,
  type CrmViewer,
  type LeadListCounts,
  type LeadListFilters,
} from '../actions'
import { CLOSED_LEAD_STATUSES, LEAD_SOURCES, LEAD_STATUSES, leadStatus, sourceLabel, timeframeLabel } from '../lib/leadOptions'
import { EMPTY_LEAD_FORM, LeadFormDialog, type LeadFormValues } from '../components/LeadFormDialog'

type ListData = { leads: CrmLeadRow[]; counts: LeadListCounts; pageSize: number; page: number }

const isClosed = (status: string | null) => CLOSED_LEAD_STATUSES.includes(status || '')
const isOverdue = (lead: CrmLeadRow) =>
  !isClosed(lead.status) && !lead.firstResponseAt && Boolean(lead.firstResponseDueAt) && new Date(lead.firstResponseDueAt as string).getTime() < Date.now()

export function LeadListPageClient({
  viewer,
  rooftops,
  staff,
  initialFilters,
  initialData,
  initialError,
  timeZone,
}: {
  viewer: CrmViewer | null
  rooftops: CrmRooftop[]
  staff: CrmPerson[]
  initialFilters: LeadListFilters
  initialData: ListData | null
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [filters, setFilters] = useState<LeadListFilters>(initialFilters)
  const [searchInput, setSearchInput] = useState(initialFilters.search)
  const [data, setData] = useState<ListData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [vehicles, setVehicles] = useState<CrmVehicleOption[]>([])
  const createKeyRef = useRef<string | null>(null)
  const firstLoad = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(async (next: LeadListFilters) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const response = await getLeadList(next)
    if (id !== requestId.current) return
    if (response.success) setData(response.data)
    else setError(response.error || 'Unable to load leads')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    load(filters)
  }, [filters, load])

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters(prev => (prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim(), page: 0 }))
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  const update = (patch: Partial<LeadListFilters>) => setFilters(prev => ({ ...prev, ...patch, page: patch.page ?? 0 }))

  const counts = data?.counts
  const statusOptions = [
    { value: 'open', label: 'Open', count: counts?.open },
    ...LEAD_STATUSES.map(stage => ({ value: stage.value, label: stage.label, count: counts?.[stage.value as keyof LeadListCounts], tone: stage.tone })),
    { value: 'overdue', label: 'Overdue', count: counts?.overdue, tone: 'bad' as const },
    { value: 'all', label: 'All', count: counts?.all },
  ]
  const total = counts ? (filters.status in counts ? counts[filters.status as keyof LeadListCounts] : counts.all) : 0
  const pageSize = data?.pageSize ?? 50
  const pageStart = total === 0 ? 0 : filters.page * pageSize + 1
  const pageEnd = Math.min(total, (filters.page + 1) * pageSize)
  const isFiltered = Boolean(filters.search) || filters.source !== 'all' || filters.ownerId !== initialFilters.ownerId

  const resetFilters = () => {
    setSearchInput('')
    setFilters({ ...initialFilters, status: filters.status })
  }

  const openCreate = async () => {
    createKeyRef.current = `lead-create:${crypto.randomUUID()}`
    setCreateOpen(true)
    if (vehicles.length === 0) setVehicles(await getLeadVehicleOptions())
  }

  const submitCreate = async (values: LeadFormValues) => {
    const rooftopId = values.rooftopId || (rooftops.length === 1 ? rooftops[0].id : '')
    if (!rooftopId) return 'Select a rooftop'
    const response = await createLead({ ...values, rooftopId, idempotencyKey: createKeyRef.current || `lead-create:${crypto.randomUUID()}` })
    if (!response.success) return response.error
    createKeyRef.current = null
    setCreateOpen(false)
    router.push(`${basePath}/platform/crm/${response.data.openLead.id}`)
    return null
  }

  const formatAge = (date: string) => {
    const days = Math.round((Date.parse(dayKey(Date.now(), timeZone)) - Date.parse(dayKey(date, timeZone))) / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days > 1 && days < 7) return `${days} days ago`
    return new Date(date).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' })
  }
  const formatDue = (date: string) => new Date(date).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const nextStep = (lead: CrmLeadRow): { label: string; bad?: boolean } => {
    if (isClosed(lead.status)) return { label: leadStatus(lead.status).label }
    if (isOverdue(lead)) return { label: 'Response overdue', bad: true }
    if (!lead.firstResponseAt && lead.firstResponseDueAt) return { label: `Respond by ${formatDue(lead.firstResponseDueAt)}` }
    if (!lead.firstResponseAt) return { label: 'First response' }
    return { label: 'Follow up' }
  }

  const canCreate = viewer?.canManageLeads === true
  const rooftopForCreate = rooftops.length === 1 ? rooftops[0].id : ''

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'CRM' },
  ]

  const header = (
    <DeskHeader
      title="Leads"
      tone={error ? 'bad' : (counts?.overdue ?? 0) > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : (counts?.overdue ?? 0) > 0 ? `${counts?.overdue} response overdue` : 'No overdue responses'}
      meta={counts ? `${counts.open} open · ${counts.overdue} response overdue` : undefined}
      actions={
        <Track>
          <Pill onClick={() => load(filters)} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </Pill>
          <Pill asChild>
            <Link href={`${basePath}/platform/crm/tasks`}><ListChecks />My tasks</Link>
          </Pill>
          <Pill variant="primary" onClick={openCreate} disabled={!canCreate} title={canCreate ? undefined : 'Requires lead management permission'}>
            <Plus />New lead
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {!canCreate && viewer && <p className="text-xs text-muted-foreground">New lead requires lead management permission</p>}
        <ReadoutStrip>
          <Readout label="Open" value={counts?.open ?? '-'} />
          <Readout label="Response overdue" value={counts?.overdue ?? '-'} tone={(counts?.overdue ?? 0) > 0 ? 'bad' : 'idle'} />
          <Readout label="New" value={counts?.new ?? '-'} tone={(counts?.new ?? 0) > 0 ? 'info' : 'idle'} />
          <Readout
            label="Converted"
            value={counts?.converted ?? '-'}
            tone={(counts?.converted ?? 0) > 0 ? 'ok' : 'idle'}
            sub={counts && counts.all > 0 ? `${Math.round((counts.converted / counts.all) * 100)}% conversion` : undefined}
          />
        </ReadoutStrip>

        <div className="space-y-3">
          <Segmented label="Lead status" value={filters.status} onChange={value => update({ status: value })} options={statusOptions} size="sm" />
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:max-w-sm lg:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                className="h-11 pl-9 sm:h-9"
                aria-label="Search leads"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
              <Select value={filters.ownerId} onValueChange={value => update({ ownerId: value })}>
                <SelectTrigger className="h-11 w-full sm:h-9 lg:w-[180px]" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {viewer && <SelectItem value={viewer.id}>Mine</SelectItem>}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.filter(person => person.id !== viewer?.id).map(person => (
                    <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.source} onValueChange={value => update({ source: value })}>
                <SelectTrigger className="h-11 w-full sm:h-9 lg:w-[160px]" aria-label="Filter by source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {LEAD_SOURCES.map(source => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.sort} onValueChange={value => update({ sort: value })}>
                <SelectTrigger className="h-11 w-full sm:h-9 lg:w-[180px]" aria-label="Sort leads"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="sla">Response due first</SelectItem>
                  <SelectItem value="last-contact">Recent contact</SelectItem>
                  <SelectItem value="updated">Recently updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading && !data ? (
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
              <Pill size="sm" onClick={() => load(filters)}>Retry</Pill>
            </Track>
          </Notice>
        ) : !data || data.leads.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{isFiltered ? 'No matching leads' : 'No leads'}</p>
            <Track>
              {isFiltered && <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>}
              {canCreate && <Pill size="sm" variant="primary" onClick={openCreate}><Plus />New lead</Pill>}
            </Track>
          </Panel>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
            <Panel className="divide-y">
              {data.leads.map(lead => {
                const stage = leadStatus(lead.status)
                const step = nextStep(lead)
                const vehicle = lead.interestedVehicle ? [lead.interestedVehicle.year, lead.interestedVehicle.make, lead.interestedVehicle.model].filter(Boolean).join(' ') : null
                const activity = lead.lastContact ? `Contacted ${formatAge(lead.lastContact)}` : `Created ${formatAge(lead.createdAt)}`
                return (
                  <Link
                    key={lead.id}
                    href={`${basePath}/platform/crm/${lead.id}`}
                    className="flex min-h-11 min-w-0 flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <TitleLine as="p" tone={stage.tone} status={stage.label} className="text-sm font-medium text-foreground">
                        {lead.firstName} {lead.lastName}
                        {lead.timeframe === 'immediately' && !isClosed(lead.status) && (
                          <span className="ml-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-red-600 dark:text-red-400">Hot</span>
                        )}
                      </TitleLine>
                      <p className="break-words pl-4 text-xs text-muted-foreground">
                        {[stage.label, sourceLabel(lead.source), vehicle, activity].filter(Boolean).join(' · ')}
                      </p>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        {[lead.email, formatPhone(lead.phone), lead.timeframe && lead.timeframe !== 'immediately' ? timeframeLabel(lead.timeframe) : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="min-w-0 pl-4 text-xs sm:shrink-0 sm:pl-0 sm:text-right">
                      <p className={lead.assignedSalesperson ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                        {lead.assignedSalesperson?.name || 'Unassigned'}
                      </p>
                      <p className={step.bad ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>{step.label}</p>
                    </div>
                  </Link>
                )
              })}
            </Panel>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="font-mono text-xs tabular-nums text-muted-foreground">{pageStart}-{pageEnd} of {total}</p>
              <Track>
                <Pill size="sm" className="h-11 sm:h-7" disabled={filters.page === 0 || loading} onClick={() => update({ page: filters.page - 1 })} aria-label="Previous page"><ChevronLeft /></Pill>
                <Pill size="sm" className="h-11 sm:h-7" disabled={pageEnd >= total || loading} onClick={() => update({ page: filters.page + 1 })} aria-label="Next page"><ChevronRight /></Pill>
              </Track>
            </div>
          </div>
        )}
      </div>

      <LeadFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialValues={{ ...EMPTY_LEAD_FORM, rooftopId: rooftopForCreate }}
        rooftops={rooftops}
        vehicles={vehicles}
        loadStaff={getRooftopStaff}
        onSubmit={submitCreate}
      />
    </PageContainer>
  )
}
