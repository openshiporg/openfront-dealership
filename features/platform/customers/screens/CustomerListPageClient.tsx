'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Notice, Panel, Pill, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { formatDay, personName } from '@/features/platform/crm/lib/leadOptions'
import { getCustomers, type CustomerListFilters, type CustomerRow } from '../actions'

type ListData = { customers: CustomerRow[]; counts: { active: number; merged: number; all: number }; page: number; pageSize: number }

const CHANNEL_LABEL: Record<string, string> = { email: 'Prefers email', sms: 'Prefers SMS', phone: 'Prefers phone' }

export function CustomerListPageClient({
  initialFilters,
  initialData,
  initialError,
  timeZone,
}: {
  initialFilters: CustomerListFilters
  initialData: ListData | null
  initialError: string | null
  timeZone: string
}) {
  const [filters, setFilters] = useState<CustomerListFilters>(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [data, setData] = useState<ListData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const firstLoad = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(async (next: CustomerListFilters) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const response = await getCustomers(next)
    if (id !== requestId.current) return
    if (response.success) setData(response.data)
    else setError(response.error || 'Unable to load customers')
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

  const update = (patch: Partial<CustomerListFilters>) => setFilters(prev => ({ ...prev, ...patch, page: patch.page ?? 0 }))
  const counts = data?.counts
  const total = counts ? counts[filters.status] : 0
  const pageSize = data?.pageSize ?? 50
  const pageStart = total === 0 ? 0 : filters.page * pageSize + 1
  const pageEnd = Math.min(total, (filters.page + 1) * pageSize)
  const isFiltered = Boolean(filters.search) || filters.segment !== 'all'

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Customers' },
  ]

  const header = (
    <DeskHeader
      title="Customers"
      tone={error ? 'bad' : 'ok'}
      status={error ? 'Unavailable' : 'Available'}
      meta={counts ? `${counts.active} active · ${counts.merged} merged` : undefined}
      actions={
        <Track>
          <Pill onClick={() => load(filters)} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /></Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Customers" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <Segmented
            label="Customer status"
            value={filters.status}
            onChange={status => update({ status })}
            size="sm"
            options={[
              { value: 'active', label: 'Active', count: counts?.active, tone: 'ok' },
              { value: 'merged', label: 'Merged', count: counts?.merged, tone: 'idle' },
              { value: 'all', label: 'All', count: counts?.all },
            ]}
          />
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:max-w-sm lg:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, email, phone" value={searchInput} onChange={event => setSearchInput(event.target.value)} className="h-11 pl-9 sm:h-9" aria-label="Search customers" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
              <Select value={filters.segment} onValueChange={value => update({ segment: value as CustomerListFilters['segment'] })}>
                <SelectTrigger className="h-11 w-full sm:h-9 lg:w-[190px]" aria-label="Filter customers"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  <SelectItem value="open-leads">With open leads</SelectItem>
                  <SelectItem value="household">In a household</SelectItem>
                  <SelectItem value="reachable">Preferred channel set</SelectItem>
                  <SelectItem value="suppressed">Any suppression</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sort} onValueChange={value => update({ sort: value as CustomerListFilters['sort'] })}>
                <SelectTrigger className="h-11 w-full sm:h-9 lg:w-[170px]" aria-label="Sort customers"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="name">Last name</SelectItem>
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
            <p className="font-medium">Unable to load customers</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={() => load(filters)}>Retry</Pill></Track>
          </Notice>
        ) : !data || data.customers.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{isFiltered ? 'No matching customers' : 'No customers'}</p>
            {isFiltered && (
              <Track><Pill size="sm" onClick={() => { setSearchInput(''); setFilters({ ...initialFilters, status: filters.status }) }}>Reset filters</Pill></Track>
            )}
          </Panel>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
            <Panel className="divide-y">
              {data.customers.map(customer => {
                const merged = customer.status === 'merged'
                const suppressed = customer.emailSuppressed || customer.smsSuppressed || customer.phoneSuppressed
                return (
                  <Link
                    key={customer.id}
                    href={`${basePath}/platform/customers/${customer.id}`}
                    className="flex min-h-11 min-w-0 flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <TitleLine as="p" tone={merged ? 'idle' : customer.openLeadsCount > 0 ? 'info' : 'ok'} status={merged ? 'Merged' : 'Active'} className="text-sm font-medium">
                        {personName(customer.firstName, customer.lastName)}
                      </TitleLine>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        {[customer.primaryEmail, formatPhone(customer.primaryPhone)].filter(Boolean).join(' · ') || 'No contact'}
                      </p>
                      <p className="break-words pl-4 text-xs text-muted-foreground">
                        {[
                          merged ? `Merged into ${personName(customer.mergedInto?.firstName, customer.mergedInto?.lastName, 'customer')}` : null,
                          customer.household?.displayName ? `Household ${customer.household.displayName}` : null,
                          CHANNEL_LABEL[customer.preferredChannel || ''] || null,
                          suppressed ? 'Suppressed' : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="min-w-0 pl-4 text-xs sm:shrink-0 sm:pl-0 sm:text-right">
                      <p className="font-medium text-foreground">{customer.openLeadsCount} open · {customer.leadsCount} leads</p>
                      <p className="text-muted-foreground">Updated {formatDay(customer.updatedAt, timeZone)}</p>
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
    </PageContainer>
  )
}
