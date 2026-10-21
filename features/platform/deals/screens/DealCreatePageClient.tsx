'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Calculator, Car, DollarSign, User, Save, AlertTriangle } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  createDealPencil,
  getDealSetupOptions,
  getRooftopSalespeople,
  type DealSetupLead,
  type DealSetupVehicle,
} from '../actions'

type Vehicle = DealSetupVehicle
type Lead = DealSetupLead

interface User {
  id: string
  name: string
}

export function DealCreatePageClient({
  initialVehicles,
  initialLeads,
  initialError,
}: {
  initialVehicles: Vehicle[]
  initialLeads: Lead[]
  initialError: string | null
}) {
  const router = useRouter()
  const idempotencyKeyRef = useRef(`deal-pencil:${crypto.randomUUID()}`)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [salesReps, setSalesReps] = useState<User[]>([])

  const [formData, setFormData] = useState({
    vehicleId: '',
    leadId: '',
    salespersonId: '',
    vehiclePrice: 0,
    tradeInValue: 0,
    downPayment: 0,
  })

  const [calculated, setCalculated] = useState({
    subtotal: 0,
    totalPrice: 0,
    remainingBalance: 0,
  })

  useEffect(() => {
    calculateDeal()
  }, [formData])

  useEffect(() => {
    let current = true
    setSalesReps([])
    setFormData(previous => ({ ...previous, salespersonId: '' }))
    const rooftopId = vehicles.find(vehicle => vehicle.id === formData.vehicleId)?.rooftop.id
    if (rooftopId) {
      getRooftopSalespeople(rooftopId).then(response => {
        if (!current) return
        if (response.success && response.data) setSalesReps(response.data.users)
        else setError(response.error || 'Unable to load sales reps.')
      })
    }
    return () => { current = false }
  }, [formData.vehicleId, vehicles])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const response = await getDealSetupOptions()
    if (response.success) {
      setVehicles(response.data.vehicles)
      setLeads(response.data.leads)
    } else {
      setError(response.error || 'Unable to load deal options.')
    }
    setLoading(false)
  }

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    setFormData(prev => ({
      ...prev,
      vehicleId,
      vehiclePrice: vehicle?.price || 0,
    }))
  }

  const calculateDeal = () => {
    const { vehiclePrice, tradeInValue, downPayment } = formData
    const subtotal = Math.max(0, vehiclePrice - tradeInValue)
    const totalPrice = subtotal
    const remainingBalance = Math.max(0, totalPrice - downPayment)
    setCalculated({ subtotal, totalPrice, remainingBalance })
  }

  const handleSave = async () => {
    setSaveError(null)
    if (!formData.vehicleId) {
      setSaveError('Select a vehicle.')
      return
    }

    setSaving(true)

    const selectedVehicle = vehicles.find(vehicle => vehicle.id === formData.vehicleId)
    if (!selectedVehicle?.rooftop?.id) {
      setSaving(false)
      setSaveError('The selected vehicle has no rooftop.')
      return
    }

    const data: Parameters<typeof createDealPencil>[0] = {
      rooftopId: selectedVehicle.rooftop.id,
      vehicleId: formData.vehicleId,
      idempotencyKey: idempotencyKeyRef.current,
      vehiclePriceCents: Math.round(formData.vehiclePrice * 100),
      tradeInValueCents: Math.round(formData.tradeInValue * 100),
      downPaymentCents: Math.round(formData.downPayment * 100),
    }

    if (formData.leadId) data.leadId = formData.leadId
    if (formData.salespersonId) data.salespersonId = formData.salespersonId

    const response = await createDealPencil(data)

    setSaving(false)

    if (response.success && response.data?.createDealPencil?.id) {
      const dealId = response.data.createDealPencil.id
      router.push(`${basePath}/platform/deals/${dealId}`)
    } else {
      setSaveError(`Failed to create deal: ${response.error || 'Unknown error'}`)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  }

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId)
  const selectedLead = leads.find(l => l.id === formData.leadId)

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Deals', href: `${basePath}/platform/deals` },
    { type: 'page' as const, label: 'New Deal' },
  ]

  const header = (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">New Deal</h1>
      <p className="text-muted-foreground">Select a vehicle and customer to start a worksheet.</p>
    </div>
  )

  return (
    <PageContainer title="New Deal" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">

      {loading ? (
        <Card>
          <CardContent className="flex min-h-[280px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="font-medium">Unable to prepare a deal</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      ) : vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No available vehicles</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={`${basePath}/platform/vehicles`}>Open inventory</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Deal Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Vehicle</Label>
                <Select value={formData.vehicleId} onValueChange={handleVehicleChange}>
                  <SelectTrigger aria-label="Select vehicle">
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} - Stock #{v.stockNumber} - {formatCurrency(v.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedVehicle && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-medium">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                  <p className="text-sm text-muted-foreground">Stock #{selectedVehicle.stockNumber}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>MSRP: {formatCurrency(selectedVehicle.price)}</span>
                    <span className="text-muted-foreground">Cost: {formatCurrency(selectedVehicle.purchasePrice || 0)}</span>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="deal-negotiated-price">Negotiated Price</Label>
                <Input
                  id="deal-negotiated-price"
                  type="number"
                  value={formData.vehiclePrice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehiclePrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="Enter sale price"
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer & Sales Rep */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer & Sales Rep
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Customer (Lead)</Label>
                  <Select value={formData.leadId} onValueChange={(v) => setFormData(prev => ({ ...prev, leadId: v }))}>
                    <SelectTrigger aria-label="Customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.firstName} {l.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sales Representative</Label>
                  <Select value={formData.salespersonId} onValueChange={(v) => setFormData(prev => ({ ...prev, salespersonId: v }))}>
                    <SelectTrigger aria-label="Sales representative">
                      <SelectValue placeholder="Select sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesReps.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedLead && (
                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <p className="font-medium">{selectedLead.firstName} {selectedLead.lastName}</p>
                  <p className="text-muted-foreground">{selectedLead.email}</p>
                  <p className="text-muted-foreground">{selectedLead.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Initial credits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Initial Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="deal-trade-in-value">Trade-In Value</Label>
                <Input
                  id="deal-trade-in-value"
                  type="number"
                  min="0"
                  value={formData.tradeInValue || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tradeInValue: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="deal-down-payment">Down Payment</Label>
                <Input
                  id="deal-down-payment"
                  type="number"
                  min="0"
                  value={formData.downPayment || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, downPayment: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
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
                  <span>{formatCurrency(formData.vehiclePrice)}</span>
                </div>
                {formData.tradeInValue > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Trade-In Credit</span>
                    <span>-{formatCurrency(formData.tradeInValue)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calculated.subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Working balance</span>
                  <span>{formatCurrency(calculated.totalPrice)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Down Payment</span>
                  <span className="text-green-600">-{formatCurrency(formData.downPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining balance</span>
                  <span>{formatCurrency(calculated.remainingBalance)}</span>
                </div>
              </div>

              {selectedVehicle && (
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <p className="text-xs text-green-700">Front gross</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(formData.vehiclePrice - (selectedVehicle.purchasePrice || 0))}
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-4">
                {saveError && (
                  <p role="alert" className="text-sm text-destructive">
                    {saveError}
                  </p>
                )}
                <Button onClick={handleSave} className="w-full" disabled={saving || !formData.vehicleId}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Creating…' : 'Create worksheet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
    </PageContainer>
  )
}
