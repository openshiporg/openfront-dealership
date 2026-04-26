'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Phone, 
  Mail, 
  Calendar,
  LayoutGrid,
  List,
  ChevronRight
} from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  source: string
  status: string
  temperature: string | null
  notes: string | null
  createdAt: string
  assignedTo: { id: string; name: string } | null
  interestedVehicle: { id: string; year: number; make: string; model: string } | null
  deals: { id: string }[]
  interactions: { id: string; type: string; createdAt: string }[]
}

const statusStages = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'qualified', label: 'Qualified', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'test-drive-scheduled', label: 'Test Drive', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700 border-red-200' },
]

const temperatureColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cold: 'bg-blue-500',
}

const sourceLabels: Record<string, string> = {
  website: 'Website',
  phone: 'Phone',
  'walk-in': 'Walk-In',
  referral: 'Referral',
  'third-party': '3rd Party',
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadLeads()
  }, [sourceFilter])

  const loadLeads = async () => {
    const query = `
      query GetLeads($where: LeadWhereInput) {
        leads(where: $where, orderBy: { createdAt: desc }) {
          id firstName lastName email phone source status temperature notes createdAt
          assignedTo { id name }
          interestedVehicle { id year make model }
          deals { id }
          interactions { id type createdAt }
        }
      }
    `

    const where: any = {}
    if (sourceFilter !== 'all') {
      where.source = { equals: sourceFilter }
    }

    const response = await keystoneClient<{ leads: Lead[] }>(query, { where })
    if (response.success && response.data) {
      setLeads(response.data.leads || [])
    }
    setLoading(false)
  }

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const str = `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.phone}`.toLowerCase()
    return str.includes(search)
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

  const activeLeads = filteredLeads.filter(l => !['converted', 'lost'].includes(l.status)).length
  const hotLeads = filteredLeads.filter(l => l.temperature === 'hot' && !['converted', 'lost'].includes(l.status)).length
  const convertedCount = filteredLeads.filter(l => l.status === 'converted').length

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <Link href={`/dashboard/Lead/${lead.id}`}>
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
          {lead.assignedTo && (
            <p className="text-xs text-muted-foreground mt-1">
              → {lead.assignedTo.name}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground">Track and manage sales leads</p>
        </div>
        <Link href="/dashboard/Lead/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </Link>
      </div>

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
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
        </div>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="rounded-r-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
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
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusStages.filter(s => !['converted', 'lost'].includes(s.value)).map(stage => (
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
                          <Link href={`/dashboard/Lead/${lead.id}`}>
                            <Button variant="ghost" size="sm">
                              View <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
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
  )
}
