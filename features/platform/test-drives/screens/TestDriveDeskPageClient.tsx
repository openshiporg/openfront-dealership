'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Circle, RefreshCw, Search, Square, Triangle, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
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

function feedbackDraftsFor(testDrives: TestDrive[]) {
  return Object.fromEntries(testDrives.map(testDrive => [testDrive.id, testDrive.feedback || '']))
}

function interestDraftsFor(testDrives: TestDrive[]) {
  return Object.fromEntries(testDrives.map(testDrive => [testDrive.id, testDrive.interestedLevel || 'maybe']))
}

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No test drives"
      description="Test drives you schedule will appear here."
      icons={[Triangle, Square, Circle]}
    />
  )
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

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Test Drives' },
  ]

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Test Drives</h1>
        <p className="text-muted-foreground">Schedule and track test drive appointments.</p>
      </div>
      <Button className="self-start" variant="outline" onClick={loadTestDrives} disabled={loading}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  )

  return (
    <PageContainer title="Test Drives" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-6 px-4 pb-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search customer, stock, or VIN"
                aria-label="Search test drives"
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort test drives">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled first</SelectItem>
                <SelectItem value="recent">Latest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter test drives">
            {([
              { value: 'open', label: 'Open' },
              { value: 'today', label: 'Today' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'completed', label: 'Completed' },
              { value: 'all', label: 'All' },
            ] as const).map(option => (
              <Button
                key={option.value}
                variant={filter === option.value ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {loading && (
          <span className="text-sm text-muted-foreground" role="status">
            Refreshing…
          </span>
        )}

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Test drives are unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={loadTestDrives}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Drive queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTestDrives.length === 0 ? (
                testDrives.length > 0 && isFiltered ? (
                  <EmptyStateSearch onResetFilters={resetFilters} />
                ) : (
                  <EmptyStateDefault />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Time</th>
                        <th className="text-left py-3 px-4 font-medium">Customer</th>
                        <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                        <th className="text-center py-3 px-4 font-medium">License</th>
                        <th className="text-left py-3 px-4 font-medium">Feedback</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTestDrives.map(testDrive => (
                        <tr key={testDrive.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium">{formatDateTime(testDrive.scheduledTime)}</div>
                            <div className="text-xs text-muted-foreground">
                              {testDrive.completed ? 'Completed' : isUpcoming(testDrive.scheduledTime) ? 'Upcoming' : 'Past due'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {testDrive.lead ? (
                              <Link href={`${basePath}/platform/crm/${testDrive.lead.id}`} className="font-medium hover:underline">
                                {leadName(testDrive)}
                              </Link>
                            ) : (
                              <span className="font-medium">{leadName(testDrive)}</span>
                            )}
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <UserRound className="h-3 w-3" />
                              {testDrive.lead?.phone || testDrive.lead?.email || 'No contact'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {testDrive.vehicle ? (
                              <Link href={`/inventory/${testDrive.vehicle.id}`} className="font-medium hover:underline">
                                {vehicleName(testDrive)}
                              </Link>
                            ) : (
                              <span className="font-medium">{vehicleName(testDrive)}</span>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Stock #{testDrive.vehicle?.stockNumber || '-'} · {formatCurrency(testDrive.vehicle?.price)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {testDrive.driverLicenseVerified ? (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                License verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                                Needs check
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 min-w-0 break-words">
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
                                placeholder="Notes, objections, next step"
                                aria-label={`Feedback for ${leadName(testDrive)}`}
                                disabled={Boolean(testDrive.completed)}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {!testDrive.driverLicenseVerified && !testDrive.completed && (
                                <Button size="sm" variant="outline" onClick={() => verifyLicense(testDrive)} disabled={updatingId === testDrive.id}>
                                  Verify license
                                </Button>
                              )}
                              {!testDrive.completed && (
                                <Button
                                  size="sm"
                                  onClick={() => completeDrive(testDrive)}
                                  disabled={updatingId === testDrive.id || !testDrive.driverLicenseVerified}
                                >
                                  Complete
                                </Button>
                              )}
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
        )}
      </div>
    </PageContainer>
  )
}
