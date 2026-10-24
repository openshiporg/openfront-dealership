'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, RefreshCw } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { completeLeadTask, getTaskQueue, type CrmPerson, type CrmViewer, type TaskQueueFilters, type TaskQueueItem } from '../actions'
import { PRIORITY_TONE, formatDateTime, leadStatus, personName, zonedDayBounds } from '../lib/leadOptions'

type QueueData = { tasks: TaskQueueItem[]; counts: Record<TaskQueueFilters['bucket'], number> }

const BUCKETS: ReadonlyArray<{ value: TaskQueueFilters['bucket']; label: string; tone?: DeskTone }> = [
  { value: 'overdue', label: 'Overdue', tone: 'bad' },
  { value: 'today', label: 'Due today', tone: 'warn' },
  { value: 'upcoming', label: 'Upcoming', tone: 'info' },
  { value: 'no-date', label: 'No date' },
  { value: 'completed', label: 'Completed 7d', tone: 'ok' },
]

export function TaskQueuePageClient({
  viewer,
  staff,
  initialFilters,
  initialData,
  initialError,
  timeZone,
}: {
  viewer: CrmViewer | null
  staff: CrmPerson[]
  initialFilters: TaskQueueFilters
  initialData: QueueData | null
  initialError: string | null
  timeZone: string
}) {
  const [filters, setFilters] = useState<TaskQueueFilters>(initialFilters)
  const [data, setData] = useState<QueueData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: DeskTone; text: string } | null>(null)
  const firstLoad = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(async (next: TaskQueueFilters) => {
    if (!viewer) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const { start, end } = zonedDayBounds(timeZone)
    const response = await getTaskQueue({ ...next, todayStart: start, todayEnd: end }, viewer.id)
    if (id !== requestId.current) return
    if (response.success) setData(response.data)
    else setError(response.error || 'Unable to load tasks')
    setLoading(false)
  }, [viewer, timeZone])

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    load(filters)
  }, [filters, load])

  const complete = async (task: TaskQueueItem) => {
    setBusyId(task.id)
    setNotice(null)
    const response = await completeLeadTask(task.lead?.id || null, task.id)
    if (!response.success) setNotice({ tone: 'bad', text: `Unable to complete task: ${response.error}` })
    await load(filters)
    setBusyId(null)
  }

  const canViewAll = viewer?.canViewAllLeads === true
  const canComplete = viewer?.canManageTasks === true
  const counts = data?.counts
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'CRM', href: `${basePath}/platform/crm` },
    { type: 'page' as const, label: 'Tasks' },
  ]

  const header = (
    <DeskHeader
      title={filters.scope === 'mine' ? 'My tasks' : 'Team tasks'}
      tone={error ? 'bad' : (counts?.overdue ?? 0) > 0 ? 'bad' : (counts?.today ?? 0) > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : (counts?.overdue ?? 0) > 0 ? `${counts?.overdue} overdue` : 'Nothing overdue'}
      meta={counts ? `${counts.overdue} overdue · ${counts.today} due today · ${counts.upcoming} upcoming` : undefined}
      actions={
        <Track>
          <Pill onClick={() => load(filters)} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /></Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Tasks" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        <ReadoutStrip>
          <Readout label="Overdue" value={counts?.overdue ?? '-'} tone={(counts?.overdue ?? 0) > 0 ? 'bad' : 'idle'} />
          <Readout label="Due today" value={counts?.today ?? '-'} tone={(counts?.today ?? 0) > 0 ? 'warn' : 'idle'} />
          <Readout label="Upcoming" value={counts?.upcoming ?? '-'} />
          <Readout label="Completed 7d" value={counts?.completed ?? '-'} tone={(counts?.completed ?? 0) > 0 ? 'ok' : 'idle'} />
        </ReadoutStrip>

        <div className="space-y-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              label="Task owner"
              value={filters.scope}
              onChange={scope => setFilters(prev => ({ ...prev, scope, assigneeId: 'all' }))}
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'all', label: 'All staff', disabled: !canViewAll },
              ]}
              size="sm"
            />
            {!canViewAll && <p className="text-xs text-muted-foreground">All staff requires view-all-leads permission</p>}
            {filters.scope === 'all' && (
              <Select value={filters.assigneeId} onValueChange={assigneeId => setFilters(prev => ({ ...prev, assigneeId }))}>
                <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[200px]" aria-label="Filter by assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Segmented
            label="Due"
            value={filters.bucket}
            onChange={bucket => setFilters(prev => ({ ...prev, bucket }))}
            options={BUCKETS.map(bucket => ({ ...bucket, count: counts?.[bucket.value] }))}
            size="sm"
          />
        </div>

        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

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
            <p className="font-medium">Unable to load tasks</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={() => load(filters)}>Retry</Pill></Track>
          </Notice>
        ) : !data || data.tasks.length === 0 ? (
          <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks</Panel>
        ) : (
          <Panel className={`divide-y ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            {data.tasks.map(task => {
              const overdue = !task.completed && Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now())
              const tone: DeskTone = task.completed ? 'ok' : overdue ? 'bad' : PRIORITY_TONE[task.priority || ''] ?? 'idle'
              const status = task.completed ? 'Completed' : overdue ? 'Overdue' : task.priority || 'Open'
              return (
                <div key={task.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={tone} status={status} className={`text-sm font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}>
                      {task.title || 'Untitled task'}
                    </TitleLine>
                    <p className={`pl-4 text-xs ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {[
                        task.completed ? `Completed ${formatDateTime(task.completedDate, timeZone)}` : task.dueDate ? `${overdue ? 'Overdue' : 'Due'} ${formatDateTime(task.dueDate, timeZone)}` : 'No due date',
                        task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : null,
                        filters.scope === 'all' ? task.assignedTo?.name || 'Unassigned' : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {task.lead && (
                      <p className="pl-4 text-xs">
                        <Link href={`${basePath}/platform/crm/${task.lead.id}`} className="font-medium underline underline-offset-2">
                          {personName(task.lead.firstName, task.lead.lastName, 'Lead')}
                        </Link>
                        <span className="text-muted-foreground"> · {leadStatus(task.lead.status).label}{task.lead.phone ? ` · ${formatPhone(task.lead.phone)}` : ''}</span>
                      </p>
                    )}
                    {task.description && <p className="mt-0.5 break-words pl-4 text-xs text-muted-foreground">{task.description}</p>}
                  </div>
                  {!task.completed && (
                    <Track className="shrink-0 self-end sm:self-start">
                      <Pill
                        size="sm"
                        className="h-11 sm:h-7"
                        onClick={() => complete(task)}
                        disabled={!canComplete || busyId !== null}
                        title={canComplete ? undefined : 'Requires task permission'}
                        aria-label={`Complete ${task.title || 'task'}`}
                      >
                        <Check />{busyId === task.id ? 'Saving…' : 'Complete'}
                      </Pill>
                    </Track>
                  )}
                </div>
              )
            })}
          </Panel>
        )}
      </div>
    </PageContainer>
  )
}
