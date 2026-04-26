'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft, 
  Car, 
  DollarSign, 
  User, 
  Calendar, 
  Edit, 
  CheckCircle, 
  XCircle,
  Clock,
  FileText
} from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

interface Deal {
  id: string
  vehiclePrice: number
  tradeInValue: number
  downPayment: number
  financingAmount: number
  monthlyPayment: number
  loanTerm: number
  apr: number
  taxAmount: number
  status: string
  saleDate: string | null
  createdAt: string
  updatedAt: string
  totalPrice: number
  profit: number | null
  salesperson: { id: string; name: string; email: string } | null
  lead: { id: string; firstName: string; lastName: string; email: string; phone: string } | null
  vehicle: { 
    id: string
    year: number
    make: string
    model: string
    trim: string
    stockNumber: string
    vin: string
    color: string
    price: number
    purchasePrice: number
  } | null
  approvals: {
    id: string
    decision: string
    approvalDate: string
    notes: string
    approver: { name: string } | null
  }[]
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pencil: { color: 'bg-slate-100 text-slate-700', icon: FileText, label: 'Pencil (Draft)' },
  submitted: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Pending Approval' },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  financed: { color: 'bg-purple-100 text-purple-700', icon: DollarSign, label: 'Financed' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', icon: Car, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelled' },
}

export function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadDeal()
  }, [id])

  const loadDeal = async () => {
    const query = `
      query GetDeal($id: ID!) {
        deal(where: { id: $id }) {
          id
          vehiclePrice
          tradeInValue
          downPayment
          financingAmount
          monthlyPayment
          loanTerm
          apr
          taxAmount
          status
          saleDate
          createdAt
          updatedAt
          totalPrice
          profit
          salesperson { id name email }
          lead { id firstName lastName email phone }
          vehicle { 
            id year make model trim stockNumber vin color price purchasePrice
          }
          approvals {
            id decision approvalDate notes
            approver { name }
          }
        }
      }
    `

    const response = await keystoneClient<{ deal: Deal }>(query, { id })
    if (response.success && response.data?.deal) {
      setDeal(response.data.deal)
    }
    setLoading(false)
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    const mutation = `
      mutation UpdateDeal($id: ID!, $data: DealUpdateInput!) {
        updateDeal(where: { id: $id }, data: $data) { id status }
      }
    `

    const data: any = { status: newStatus }
    if (newStatus === 'delivered') {
      data.saleDate = new Date().toISOString()
    }

    const response = await keystoneClient(mutation, { id, data })
    if (response.success) {
      loadDeal()
    } else {
      alert('Failed to update deal: ' + response.error)
    }
    setUpdating(false)
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold">Deal not found</h1>
        <Link href="/dashboard/deals">
          <Button variant="outline" className="mt-4">Back to Deals</Button>
        </Link>
      </div>
    )
  }

  const status = statusConfig[deal.status] || statusConfig.pencil

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'Deal'}
              </h1>
              <Badge className={status.color}>
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Deal created {formatDate(deal.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {deal.status === 'pencil' && (
            <Button variant="outline" onClick={() => updateStatus('submitted')} disabled={updating}>
              Submit for Approval
            </Button>
          )}
          {deal.status === 'submitted' && (
            <>
              <Button variant="outline" onClick={() => updateStatus('approved')} disabled={updating}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => updateStatus('cancelled')} disabled={updating}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {deal.status === 'approved' && (
            <Button onClick={() => updateStatus('financed')} disabled={updating}>
              Mark as Financed
            </Button>
          )}
          {deal.status === 'financed' && (
            <Button onClick={() => updateStatus('delivered')} disabled={updating}>
              <Car className="h-4 w-4 mr-2" />
              Mark as Delivered
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deal.vehicle ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}</p>
                    {deal.vehicle.trim && <p className="text-sm text-muted-foreground">{deal.vehicle.trim}</p>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Number</p>
                    <p className="font-medium">{deal.vehicle.stockNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">VIN</p>
                    <p className="font-mono text-sm">{deal.vehicle.vin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Color</p>
                    <p className="font-medium">{deal.vehicle.color || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MSRP</p>
                    <p className="font-medium">{formatCurrency(deal.vehicle.price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-medium">{formatCurrency(deal.vehicle.purchasePrice)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No vehicle attached</p>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deal.lead ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{deal.lead.firstName} {deal.lead.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{deal.lead.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{deal.lead.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sales Rep</p>
                    <p className="font-medium">{deal.salesperson?.name || 'Unassigned'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No customer attached</p>
              )}
            </CardContent>
          </Card>

          {/* Approvals Timeline */}
          {deal.approvals && deal.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deal.approvals.map((approval) => (
                    <div key={approval.id} className="flex gap-4 items-start">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        approval.decision === 'approved' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {approval.decision === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{approval.decision}</p>
                        <p className="text-sm text-muted-foreground">
                          by {approval.approver?.name || 'Unknown'} on {formatDate(approval.approvalDate)}
                        </p>
                        {approval.notes && <p className="text-sm mt-1">{approval.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Deal Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deal Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Price</span>
                  <span className="font-medium">{formatCurrency(deal.vehiclePrice)}</span>
                </div>
                {deal.tradeInValue > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Trade-In Credit</span>
                    <span>-{formatCurrency(deal.tradeInValue)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(deal.vehiclePrice - (deal.tradeInValue || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales Tax</span>
                  <span>{formatCurrency(deal.taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Price</span>
                  <span>{formatCurrency(deal.totalPrice || deal.vehiclePrice)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Down Payment</span>
                  <span className="text-green-600">-{formatCurrency(deal.downPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Financed</span>
                  <span>{formatCurrency(deal.financingAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{deal.apr}% APR for {deal.loanTerm} months</span>
                </div>
              </div>

              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(deal.monthlyPayment)}</p>
              </div>

              {deal.profit != null && (
                <div className={`rounded-lg p-3 text-center border ${deal.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs ${deal.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Gross Profit</p>
                  <p className={`text-lg font-bold ${deal.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(deal.profit)}
                  </p>
                </div>
              )}

              {deal.saleDate && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Sale Completed</p>
                  <p className="font-medium">{formatDate(deal.saleDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
