'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Search,
  Filter,
  Users,
  Phone,
  Mail,
  LayoutGrid,
  List,
  ChevronRight,
  AlertTriangle,
  Triangle,
  Square,
  Circle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { type CrmLeadSummary, getCrmLeads } from '../actions'

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

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No leads"
      description="Leads you capture will appear here."
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

const statusStages = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'test-drive-scheduled', label: 'Test Drive', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'closed-won', label: 'Closed Won', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'closed-lost', label: 'Closed Lost', color: 'bg-red-100 text-red-700 border-red-200' },
]

const temperatureColors: Record<string, string> = {
  immediately: 'bg-red-500',
  'this-week': 'bg-orange-500',
  'this-month': 'bg-blue-500',
  'just-looking': 'bg-slate-400',
}

const sourceLabels: Record<string, string> = {
  website: 'Website',
  phone: 'Phone',
  'walk-in': 'Walk-In',
  referral: 'Referral',
  ad: 'Advertisement',
  social: 'Social Media',
  'third-party': '3rd Party',
}

export function LeadListPageClient({
  initialLeads,
  initialError,
}: {
  initialLeads: CrmLeadSummary[]
  initialError: string | null
}) {
  const [leads, setLeads] = useState<Lead[]>(() => initialLeads.map(toLead))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
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

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const activeLeads = filteredLeads.filter(l => !['closed-won', 'closed-lost'].includes(l.status)).length
  const hotLeads = filteredLeads.filter(l => l.temperature === 'immediately' && !['closed-won', 'closed-lost'].includes(l.status)).length
  const convertedCount = filteredLeads.filter(l => l.status === 'closed-won').length
  const overdueCount = filteredLeads.filter(l => !l.firstResponseAt && l.firstResponseDueAt && new Date(l.firstResponseDueAt).getTime() < Date.now()).length

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <Link href={`${basePath}/platform/crm/${lead.id}`}>
      <Card className="mb-2 hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-sm">{lead.firstName} {lead.lastName}</p>
              {lead.interestedVehicle && (
                <p className="text-xs text-muted-foreground">
                  {lead.interestedVehicle.year} {lead.interestedVehicle.make} {lead.interestedVehicle.model}
                </p>
              )}
            </div>
            {lead.temperature && (
              <div className={`h-2 w-2 rounded-full ${temperatureColors[lead.temperature]}`} title={lead.temperature} />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs py-0">
              {sourceLabels[lead.source] || lead.source}
            </Badge>
            <span>{formatDate(lead.createdAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{lead.assignedTo ? `→ ${lead.assignedTo.name}` : 'Unassigned'}</span>
            {!lead.firstResponseAt && lead.firstResponseDueAt && new Date(lead.firstResponseDueAt).getTime() < Date.now() && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Response overdue</Badge>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'CRM' },
  ]

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">CRM</h1>
        <p className="text-muted-foreground">Manage leads, contacts, follow-up, and sales opportunities.</p>
      </div>
      <Button variant="outline" onClick={loadLeads} disabled={loading}>
        <RefreshCw className="h-4 w-4 mr-2" /> Refresh
      </Button>
    </div>
  )

  return (
    <PageContainer title="CRM" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Leads</p>
                <p className="text-xl font-bold">{activeLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <span className="text-lg">🔥</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
                <p className="text-xl font-bold">{hotLeads}</p>
                <p className="text-xs text-muted-foreground">{overdueCount} response overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-xl font-bold">{convertedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <span className="text-lg">%</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-xl font-bold">
                  {filteredLeads.length > 0 ? Math.round((convertedCount / filteredLeads.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search leads"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by source">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="walk-in">Walk-In</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="third-party">3rd Party</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sort leads">
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
        <div className="flex w-fit items-center rounded-md border">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="rounded-r-none"
            aria-label="Board view"
            aria-pressed={viewMode === 'kanban'}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="font-medium">Unable to load leads</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadLeads}>Retry</Button>
          </CardContent>
        </Card>
      ) : filteredLeads.length === 0 ? (
        isFiltered ? <EmptyStateSearch onResetFilters={resetFilters} /> : <EmptyStateDefault />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusStages.filter(s => !['closed-won', 'closed-lost'].includes(s.value)).map(stage => (
            <div key={stage.value} className="flex-shrink-0 w-72">
              <div className={`rounded-t-lg px-3 py-2 border ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{stage.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {getLeadsByStatus(stage.value).length}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-b-lg p-2 min-h-[400px]">
                {getLeadsByStatus(stage.value).map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
                {getLeadsByStatus(stage.value).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">No leads</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Contact</th>
                    <th className="text-left py-3 px-4 font-medium">Vehicle Interest</th>
                    <th className="text-left py-3 px-4 font-medium">Source</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Assigned To</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const stage = statusStages.find(s => s.value === lead.status) || statusStages[0]
                    return (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {lead.temperature && (
                              <div className={`h-2 w-2 rounded-full ${temperatureColors[lead.temperature]}`} />
                            )}
                            <span className="font-medium">{lead.firstName} {lead.lastName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {lead.interestedVehicle ? (
                            <span className="text-sm">
                              {lead.interestedVehicle.year} {lead.interestedVehicle.make} {lead.interestedVehicle.model}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{sourceLabels[lead.source] || lead.source}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={stage.color}>{stage.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          {lead.assignedTo?.name || <span className="text-muted-foreground">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`${basePath}/platform/crm/${lead.id}`}>
                              View <ChevronRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </PageContainer>
  )
}
