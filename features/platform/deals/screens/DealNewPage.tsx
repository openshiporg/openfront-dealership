'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, Calculator, Car, DollarSign, User, Save, Send } from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

interface Vehicle {
  id: string
  stockNumber: string
  year: number
  make: string
  model: string
  price: number
  purchasePrice: number
}

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface User {
  id: string
  name: string
}

const LOAN_TERMS = [36, 48, 60, 72, 84]
const TAX_RATE = 0.0825

export function NewDealPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [salesReps, setSalesReps] = useState<User[]>([])

  const [formData, setFormData] = useState({
    vehicleId: '',
    leadId: '',
    salespersonId: '',
    vehiclePrice: 0,
    tradeInValue: 0,
    downPayment: 0,
    apr: 7.5,
    loanTerm: 60,
  })

  const [calculated, setCalculated] = useState({
    subtotal: 0,
    taxAmount: 0,
    totalPrice: 0,
    financingAmount: 0,
    monthlyPayment: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    calculateDeal()
  }, [formData])

  const loadData = async () => {
    const [vehiclesRes, leadsRes, usersRes] = await Promise.all([
      keystoneClient<{ vehicles: Vehicle[] }>(`
        query { vehicles(where: { status: { equals: "available" } }) { id stockNumber year make model price purchasePrice } }
      `),
      keystoneClient<{ leads: Lead[] }>(`
        query { leads(where: { status: { not: { equals: "lost" } } }) { id firstName lastName email phone } }
      `),
      keystoneClient<{ users: User[] }>(`
        query { users { id name } }
      `),
    ])

    if (vehiclesRes.success && vehiclesRes.data) setVehicles(vehiclesRes.data.vehicles || [])
    if (leadsRes.success && leadsRes.data) setLeads(leadsRes.data.leads || [])
    if (usersRes.success && usersRes.data) setSalesReps(usersRes.data.users || [])
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
    const { vehiclePrice, tradeInValue, downPayment, apr, loanTerm } = formData
    
    const subtotal = vehiclePrice - tradeInValue
    const taxAmount = subtotal * TAX_RATE
    const totalPrice = subtotal + taxAmount
    const financingAmount = Math.max(0, totalPrice - downPayment)
    
    let monthlyPayment = 0
    if (financingAmount > 0 && apr > 0) {
      const monthlyRate = apr / 100 / 12
      monthlyPayment = financingAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / (Math.pow(1 + monthlyRate, loanTerm) - 1)
    } else if (financingAmount > 0) {
      monthlyPayment = financingAmount / loanTerm
    }

    setCalculated({
      subtotal,
      taxAmount,
      totalPrice,
      financingAmount,
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
    })
  }

  const handleSave = async (status: 'pencil' | 'submitted') => {
    if (!formData.vehicleId) {
      alert('Please select a vehicle')
      return
    }

    setSaving(true)

    const mutation = `
      mutation CreateDeal($data: DealCreateInput!) {
        createDeal(data: $data) {
          id
        }
      }
    `

    const data: any = {
      vehiclePrice: formData.vehiclePrice,
      tradeInValue: formData.tradeInValue,
      downPayment: formData.downPayment,
      apr: formData.apr,
      loanTerm: formData.loanTerm,
      financingAmount: calculated.financingAmount,
      monthlyPayment: calculated.monthlyPayment,
      taxAmount: calculated.taxAmount,
      status,
      vehicle: { connect: { id: formData.vehicleId } },
    }

    if (formData.leadId) {
      data.lead = { connect: { id: formData.leadId } }
    }
    if (formData.salespersonId) {
      data.salesperson = { connect: { id: formData.salespersonId } }
    }

    const response = await keystoneClient(mutation, { data })

    setSaving(false)

    if (response.success && response.data?.createDeal?.id) {
      router.push(`/dashboard/deals/${response.data.createDeal.id}`)
    } else {
      alert('Failed to create deal: ' + (response.error || 'Unknown error'))
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  }

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId)
  const selectedLead = leads.find(l => l.id === formData.leadId)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/deals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Deal</h1>
          <p className="text-muted-foreground">Create a new deal sheet</p>
        </div>
      </div>

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
                  <SelectTrigger>
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
                <Label>Negotiated Price</Label>
                <Input
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer (Lead)</Label>
                  <Select value={formData.leadId} onValueChange={(v) => setFormData(prev => ({ ...prev, leadId: v }))}>
                    <SelectTrigger>
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
                    <SelectTrigger>
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

          {/* Financing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Financing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trade-In Value</Label>
                  <Input
                    type="number"
                    value={formData.tradeInValue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, tradeInValue: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Down Payment</Label>
                  <Input
                    type="number"
                    value={formData.downPayment || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, downPayment: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>APR (%)</Label>
                  <Input
                    type="number"
                    value={formData.apr}
                    onChange={(e) => setFormData(prev => ({ ...prev, apr: parseFloat(e.target.value) || 0 }))}
                    step="0.1"
                    min="0"
                    max="30"
                  />
                </div>
                <div>
                  <Label>Loan Term</Label>
                  <Select value={formData.loanTerm.toString()} onValueChange={(v) => setFormData(prev => ({ ...prev, loanTerm: parseInt(v) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TERMS.map(term => (
                        <SelectItem key={term} value={term.toString()}>
                          {term} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales Tax (8.25%)</span>
                  <span>{formatCurrency(calculated.taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Price</span>
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
                  <span className="text-muted-foreground">Amount Financed</span>
                  <span>{formatCurrency(calculated.financingAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formData.apr}% APR for {formData.loanTerm} months</span>
                </div>
              </div>

              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Estimated Monthly Payment</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(calculated.monthlyPayment)}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>

              {selectedVehicle && (
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <p className="text-xs text-green-700">Estimated Gross Profit</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(formData.vehiclePrice - (selectedVehicle.purchasePrice || 0))}
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-4">
                <Button onClick={() => handleSave('submitted')} className="w-full" disabled={saving || !formData.vehicleId}>
                  <Send className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Submit for Approval'}
                </Button>
                <Button onClick={() => handleSave('pencil')} variant="outline" className="w-full" disabled={saving || !formData.vehicleId}>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
