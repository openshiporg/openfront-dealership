'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, RefreshCw, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  Notice,
  Panel,
  Pill,
  Readout,
  TitleLine,
  Track,
} from '@/features/platform/components/desk'
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

const fieldLabel = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

/** One numbered step of the form; the dot on the title line shows whether it is filled. */
function Step({ index, title, done, optional, children }: { index: number; title: string; done: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <section className="min-w-0" aria-labelledby={`deal-step-${index}`}>
      <div className="flex min-w-0 items-baseline gap-3 border-b pb-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{String(index).padStart(2, '0')}</span>
        <TitleLine as="h2" tone={done ? 'ok' : 'idle'} status={done ? 'Complete' : 'Open'} className="text-sm font-semibold text-foreground">
          <span id={`deal-step-${index}`}>{title}</span>
        </TitleLine>
        {optional && <span className="ml-auto text-xs text-muted-foreground">Optional</span>}
      </div>
      <div className="space-y-4 pt-4">{children}</div>
    </section>
  )
}

function SummaryRow({ label, value, emphasis, credit }: { label: string; value: string; emphasis?: boolean; credit?: boolean }) {
  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-4 px-4 ${emphasis ? 'border-t-2 border-foreground/80 py-3 text-base font-semibold' : 'py-2 text-sm'}`}>
      <dt className={emphasis ? 'text-foreground' : 'text-muted-foreground'}>{label}</dt>
      <dd className={`shrink-0 text-right font-mono tabular-nums ${credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>{value}</dd>
    </div>
  )
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
    <DeskHeader
      eyebrow="Deals"
      title="New deal"
      meta={selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}${selectedLead ? ` · ${selectedLead.firstName} ${selectedLead.lastName}` : ''}` : 'Pencil worksheet'}
      actions={
        <Track>
          <Pill asChild variant="plain">
            <Link href={`${basePath}/platform/deals`}>Cancel</Link>
          </Pill>
        </Track>
      }
    />
  )

  const frontGross = selectedVehicle ? formData.vehiclePrice - (selectedVehicle.purchasePrice || 0) : null

  return (
    <PageContainer title="New Deal" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-10 md:px-6">
        {loading ? (
          <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading deal options</p>
        ) : error ? (
          <Notice tone="bad">
            <p className="font-medium">Unable to prepare a deal</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadData}>
                <RefreshCw />
                Retry
              </Pill>
            </Track>
          </Notice>
        ) : vehicles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
            <p>No available vehicles</p>
            <Track>
              <Pill asChild>
                <Link href={`${basePath}/platform/vehicles`}>
                  Open inventory
                  <ArrowRight />
                </Link>
              </Pill>
            </Track>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-8">
              <Step index={1} title="Customer" done={Boolean(formData.leadId)} optional>
                <label className="grid min-w-0 gap-1.5">
                  <span className={fieldLabel}>Customer (lead)</span>
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
                </label>
                {selectedLead && (
                  <Panel className="px-4 py-3 text-sm">
                    <p className="font-medium">{selectedLead.firstName} {selectedLead.lastName}</p>
                    <p className="break-all text-muted-foreground">{selectedLead.email}</p>
                    <p className="tabular-nums text-muted-foreground">{selectedLead.phone}</p>
                  </Panel>
                )}
              </Step>

              <Step index={2} title="Vehicle" done={Boolean(formData.vehicleId)}>
                <label className="grid min-w-0 gap-1.5">
                  <span className={fieldLabel}>Vehicle</span>
                  <Select value={formData.vehicleId} onValueChange={handleVehicleChange}>
                    <SelectTrigger aria-label="Select vehicle">
                      <SelectValue placeholder="Choose a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.year} {v.make} {v.model} · #{v.stockNumber} · {formatCurrency(v.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {selectedVehicle && (
                  <Panel className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                      <Code>#{selectedVehicle.stockNumber}</Code>
                    </div>
                    <dl className="flex gap-4 font-mono text-xs tabular-nums">
                      <div className="text-right"><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">MSRP</dt><dd>{formatCurrency(selectedVehicle.price)}</dd></div>
                      <div className="text-right"><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Cost</dt><dd>{formatCurrency(selectedVehicle.purchasePrice || 0)}</dd></div>
                    </dl>
                  </Panel>
                )}

                <label className="grid min-w-0 gap-1.5">
                  <span className={fieldLabel}>Sales rep</span>
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
                </label>
              </Step>

              <Step index={3} title="Numbers" done={formData.vehiclePrice > 0}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label htmlFor="deal-negotiated-price" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Negotiated price</span>
                    <Input
                      id="deal-negotiated-price"
                      type="number"
                      className="text-right tabular-nums"
                      value={formData.vehiclePrice || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehiclePrice: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </label>
                  <label htmlFor="deal-trade-in-value" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Trade-in value</span>
                    <Input
                      id="deal-trade-in-value"
                      type="number"
                      min="0"
                      className="text-right tabular-nums"
                      value={formData.tradeInValue || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, tradeInValue: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </label>
                  <label htmlFor="deal-down-payment" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Down payment</span>
                    <Input
                      id="deal-down-payment"
                      type="number"
                      min="0"
                      className="text-right tabular-nums"
                      value={formData.downPayment || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, downPayment: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </label>
                </div>
              </Step>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <section aria-labelledby="deal-summary" className="min-w-0 space-y-3">
                <h2 id="deal-summary" className="border-b pb-2 text-sm font-semibold text-foreground">Summary</h2>
                <Panel className="overflow-hidden">
                  <dl className="divide-y divide-border/60">
                    <SummaryRow label="Vehicle price" value={formatCurrency(formData.vehiclePrice)} />
                    {formData.tradeInValue > 0 && <SummaryRow label="Trade-in credit" value={`-${formatCurrency(formData.tradeInValue)}`} credit />}
                    <SummaryRow label="Subtotal" value={formatCurrency(calculated.subtotal)} />
                    <SummaryRow emphasis label="Working balance" value={formatCurrency(calculated.totalPrice)} />
                    <SummaryRow label="Down payment" value={`-${formatCurrency(formData.downPayment)}`} credit />
                    <SummaryRow label="Remaining balance" value={formatCurrency(calculated.remainingBalance)} />
                  </dl>
                </Panel>
                {frontGross !== null && (
                  <Panel>
                    <Readout label="Front gross" value={formatCurrency(frontGross)} tone={frontGross > 0 ? 'ok' : frontGross < 0 ? 'bad' : 'idle'} />
                  </Panel>
                )}
                {saveError && <Notice tone="bad">{saveError}</Notice>}
                <Track block>
                  <Pill variant="primary" onClick={handleSave} disabled={saving || !formData.vehicleId}>
                    <Save />
                    {saving ? 'Creating…' : 'Create worksheet'}
                  </Pill>
                </Track>
              </section>
            </aside>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
