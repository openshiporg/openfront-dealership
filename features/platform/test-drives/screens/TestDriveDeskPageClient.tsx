'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { type TestDrive, completeTestDrive, getTestDrives, verifyTestDriveLicense } from '../actions'

type QueueFilter = 'today' | 'upcoming' | 'open' | 'completed' | 'all'

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
}

function leadName(testDrive: TestDrive) {
  if (!testDrive.lead) return 'Walk-in guest'
  return [testDrive.lead.firstName, testDrive.lead.lastName].filter(Boolean).join(' ') || 'Unnamed lead'
}

function vehicleName(testDrive: TestDrive) {
  if (!testDrive.vehicle) return 'Vehicle not selected'
  return [testDrive.vehicle.year, testDrive.vehicle.make, testDrive.vehicle.model].filter(Boolean).join(' ')
}

function isToday(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}

function isUpcoming(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).getTime() >= Date.now()
}

function formatTime(value: string | null | undefined) {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDay(value: string | null | undefined) {
  if (!value) return 'Unscheduled'
  if (isToday(value)) return 'Today'
  return new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function driveState(testDrive: TestDrive): { tone: DeskTone; label: string } {
  if (testDrive.completed) return { tone: 'ok', label: 'Completed' }
  if (!isUpcoming(testDrive.scheduledTime)) return { tone: 'bad', label: 'Past due' }
  if (!testDrive.driverLicenseVerified) return { tone: 'warn', label: 'Upcoming' }
  return { tone: 'info', label: 'Upcoming' }
}

const interestLabels: Record<string, string> = {
  'not-interested': 'Not interested',
  maybe: 'Maybe',
  'very-interested': 'Very interested',
}

function feedbackDraftsFor(testDrives: TestDrive[]) {
  return Object.fromEntries(testDrives.map(testDrive => [testDrive.id, testDrive.feedback || '']))
}

function interestDraftsFor(testDrives: TestDrive[]) {
  return Object.fromEntries(testDrives.map(testDrive => [testDrive.id, testDrive.interestedLevel || 'maybe']))
}

export function TestDriveDeskPageClient({
  initialTestDrives,
  initialError,
}: {
  initialTestDrives: TestDrive[]
  initialError: string | null
}) {
  const [testDrives, setTestDrives] = useState<TestDrive[]>(initialTestDrives)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('scheduled')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('open')
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(() => feedbackDraftsFor(initialTestDrives))
  const [interestDrafts, setInterestDrafts] = useState<Record<string, string>>(() => interestDraftsFor(initialTestDrives))

  const loadTestDrives = async () => {
    setLoading(true)
    setError(null)

    const response = await getTestDrives()

    if (response.success && response.data) {
      const loaded = response.data.testDrives || []
      setTestDrives(loaded)
      setFeedbackDrafts(feedbackDraftsFor(loaded))
      setInterestDrafts(interestDraftsFor(loaded))
    } else {
      setError(response.error || 'Unable to load test drives.')
    }

    setLoading(false)
  }

  const filteredTestDrives = useMemo(() => {
    const queued =
      filter === 'today'
        ? testDrives.filter(testDrive => isToday(testDrive.scheduledTime))
        : filter === 'upcoming'
          ? testDrives.filter(testDrive => !testDrive.completed && isUpcoming(testDrive.scheduledTime))
          : filter === 'completed'
            ? testDrives.filter(testDrive => testDrive.completed)
            : filter === 'open'
              ? testDrives.filter(testDrive => !testDrive.completed)
              : testDrives
    const term = search.trim().toLowerCase()
    const visible = !term
      ? queued
      : queued.filter(item =>
          `${leadName(item)} ${vehicleName(item)} ${item.vehicle?.stockNumber || ''} ${item.vehicle?.vin || ''}`.toLowerCase().includes(term)
        )
    return [...visible].sort((a, b) =>
      sortOrder === 'recent'
        ? new Date(b.scheduledTime || 0).getTime() - new Date(a.scheduledTime || 0).getTime()
        : new Date(a.scheduledTime || '9999-12-31').getTime() - new Date(b.scheduledTime || '9999-12-31').getTime()
    )
  }, [testDrives, filter, search, sortOrder])

  const verifyLicense = async (testDrive: TestDrive) => {
    setUpdatingId(testDrive.id)
    const response = await verifyTestDriveLicense(testDrive.id)

    if (!response.success) alert(`Unable to verify license: ${response.error}`)
    await loadTestDrives()
    setUpdatingId(null)
  }

  const completeDrive = async (testDrive: TestDrive) => {
    setUpdatingId(testDrive.id)
    const updateDrive = await completeTestDrive({
      id: testDrive.id,
      interestedLevel: interestDrafts[testDrive.id] || 'maybe',
      feedback: feedbackDrafts[testDrive.id] || '',
    })

    if (!updateDrive.success) {
      alert(`Unable to complete test drive: ${updateDrive.error}`)
      setUpdatingId(null)
      return
    }

    await loadTestDrives()
    setUpdatingId(null)
  }

  const isFiltered = Boolean(search.trim()) || filter !== 'all'
  const resetFilters = () => {
    setSearch('')
    setFilter('all')
  }

  const counts = {
    open: testDrives.filter(testDrive => !testDrive.completed).length,
    today: testDrives.filter(testDrive => isToday(testDrive.scheduledTime)).length,
    upcoming: testDrives.filter(testDrive => !testDrive.completed && isUpcoming(testDrive.scheduledTime)).length,
    completed: testDrives.filter(testDrive => testDrive.completed).length,
    all: testDrives.length,
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Test Drives' },
  ]

  const header = (
    <DeskHeader
      title="Test drives"
      tone={error ? 'bad' : counts.today > 0 ? 'info' : 'idle'}
      status={error ? 'Unavailable' : `${counts.today} today`}
      meta={`${counts.today} today · ${counts.upcoming} upcoming · ${counts.open} open`}
      actions={
        <Track>
          <Pill onClick={loadTestDrives} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Test Drives" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-10 md:px-6">
        <Segmented<QueueFilter>
          label="Filter test drives"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'today', label: 'Today', count: counts.today },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Customer, stock or VIN"
              aria-label="Search test drives"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Sort test drives">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Soonest first</SelectItem>
              <SelectItem value="recent">Latest first</SelectItem>
            </SelectContent>
          </Select>
          {loading && (
            <span className="text-xs text-muted-foreground" role="status">
              Refreshing…
            </span>
          )}
        </div>

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Test drives unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadTestDrives}>Retry</Pill>
            </Track>
          </Notice>
        ) : filteredTestDrives.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {testDrives.length > 0 && isFiltered ? 'No matching test drives' : 'No test drives'}
            </p>
            {testDrives.length > 0 && isFiltered && (
              <Track>
                <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
              </Track>
            )}
          </Panel>
        ) : (
          <Panel className="divide-y">
            {filteredTestDrives.map(testDrive => {
              const state = driveState(testDrive)
              const busy = updatingId === testDrive.id
              return (
                <div key={testDrive.id} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,18rem)_auto] md:items-start">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium tabular-nums text-foreground">{formatTime(testDrive.scheduledTime)}</p>
                    <p className="text-[11px] text-muted-foreground" title={formatDateTime(testDrive.scheduledTime)}>{formatDay(testDrive.scheduledTime)}</p>
                  </div>

                  <div className="min-w-0">
                    <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium">
                      {testDrive.lead ? (
                        <Link href={`${basePath}/platform/crm/${testDrive.lead.id}`} className="hover:underline">
                          {leadName(testDrive)}
                        </Link>
                      ) : (
                        leadName(testDrive)
                      )}
                    </TitleLine>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {testDrive.vehicle ? (
                        <Link href={`/inventory/${testDrive.vehicle.id}`} className="text-foreground hover:underline">
                          {vehicleName(testDrive)}
                        </Link>
                      ) : (
                        vehicleName(testDrive)
                      )}
                      {' · '}
                      <Code>#{testDrive.vehicle?.stockNumber || '-'}</Code>
                      {' · '}
                      <span className="tabular-nums">{formatCurrency(testDrive.vehicle?.price)}</span>
                    </p>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {state.label}
                      {' · '}
                      <span className={testDrive.driverLicenseVerified ? undefined : 'text-amber-700 dark:text-amber-300'}>
                        {testDrive.driverLicenseVerified ? 'License verified' : 'License needs check'}
                      </span>
                      {' · '}
                      {testDrive.lead?.phone || testDrive.lead?.email || 'No contact'}
                      {testDrive.salesperson?.name ? ` · ${testDrive.salesperson.name}` : ''}
                    </p>
                  </div>

                  <div className="col-span-2 min-w-0 md:col-span-1">
                    {testDrive.completed ? (
                      <div className="text-xs">
                        <p className="font-medium text-foreground">{interestLabels[testDrive.interestedLevel || ''] || testDrive.interestedLevel || '-'}</p>
                        {testDrive.feedback && <p className="mt-0.5 whitespace-pre-line break-words text-muted-foreground">{testDrive.feedback}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select
                          value={interestDrafts[testDrive.id] || 'maybe'}
                          onValueChange={value => setInterestDrafts(prev => ({ ...prev, [testDrive.id]: value }))}
                          disabled={Boolean(testDrive.completed)}
                        >
                          <SelectTrigger className="h-8" aria-label={`Interest level for ${leadName(testDrive)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not-interested">Not interested</SelectItem>
                            <SelectItem value="maybe">Maybe</SelectItem>
                            <SelectItem value="very-interested">Very interested</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={feedbackDrafts[testDrive.id] || ''}
                          onChange={event => setFeedbackDrafts(prev => ({ ...prev, [testDrive.id]: event.target.value }))}
                          placeholder="Feedback"
                          aria-label={`Feedback for ${leadName(testDrive)}`}
                          disabled={Boolean(testDrive.completed)}
                          className="min-h-14 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {!testDrive.completed && (
                    <div className="col-span-2 flex justify-end md:col-span-1">
                      <Track>
                        {!testDrive.driverLicenseVerified && (
                          <Pill size="sm" onClick={() => verifyLicense(testDrive)} disabled={busy}>
                            Verify license
                          </Pill>
                        )}
                        <Pill
                          size="sm"
                          variant="primary"
                          onClick={() => completeDrive(testDrive)}
                          disabled={busy || !testDrive.driverLicenseVerified}
                        >
                          Complete
                        </Pill>
                      </Track>
                    </div>
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
