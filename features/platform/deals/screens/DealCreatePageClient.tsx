'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, RefreshCw, Save } from 'lucide-react'
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
  type DealTradeInOption,
} from '../actions'
import { formatUsd, formatUsdCredit } from '../lib/formatMoney'
import { MoneyInput } from '../components/MoneyInput'
import { applyDealDefaults, calculateDealPrice, lineAmountCents, type DealDefaults } from '@/features/keystone/lifecycle/dealPricing'

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

const NO_DEFAULTS: DealDefaults = { salesTaxRateBps: 0, docFeeCents: 0 }

/** Preview of the pencil the server creates: the same defaults and pricing rules, in dollars. */
function previewDeal(form: { vehiclePrice: number; tradeInValue: number; downPayment: number }, defaults: DealDefaults) {
  try {
    const amounts = { vehiclePriceCents: Math.round(form.vehiclePrice * 100), tradeInValueCents: Math.round(form.tradeInValue * 100), downPaymentCents: Math.round(form.downPayment * 100) }
    const { fees, taxLines } = applyDealDefaults({ ...amounts, rebates: [] }, defaults)
    const price = calculateDealPrice({ ...amounts, fees, taxLines })
    return { fees, taxLines, subtotal: price.subtotalCents / 100, totalPrice: price.totalPriceCents / 100, remainingBalance: Math.max(0, price.balanceCents) / 100 }
  } catch {
    return null
  }
}

const NO_TRADE_IN = 'none'

function tradeInLabel(tradeIn: DealTradeInOption) {
  return [tradeIn.year, tradeIn.make, tradeIn.model, tradeIn.trim].filter(Boolean).join(' ') || 'Trade-in'
}

/** The pencil a CRM link opens: its lead, the lead's interested vehicle when available, and a picked trade-in. */
function prefilledForm(vehicles: Vehicle[], leads: Lead[], tradeIns: DealTradeInOption[], leadId: string, tradeInId: string) {
  const lead = leads.find(item => item.id === leadId)
  const vehicle = lead?.interestedVehicle ? vehicles.find(item => item.id === lead.interestedVehicle?.id) : undefined
  const tradeIn = tradeIns.find(item => item.id === tradeInId && item.offerAmountCents != null && (!item.lead || item.lead.id === lead?.id))
  return {
    vehicleId: vehicle?.id || '',
    leadId: lead?.id || '',
    salespersonId: '',
    tradeInId: tradeIn?.id || '',
    vehiclePrice: vehicle?.price || 0,
    tradeInValue: tradeIn ? (tradeIn.offerAmountCents || 0) / 100 : 0,
    downPayment: 0,
  }
}

export function DealCreatePageClient({
  initialVehicles,
  initialLeads,
  initialTradeIns,
  initialDealDefaults,
  initialError,
  prefillLeadId = '',
  prefillTradeInId = '',
}: {
  initialVehicles: Vehicle[]
  initialLeads: Lead[]
  initialTradeIns: DealTradeInOption[]
  initialDealDefaults: DealDefaults
  initialError: string | null
  prefillLeadId?: string
  prefillTradeInId?: string
}) {
  const router = useRouter()
  const idempotencyKeyRef = useRef(`deal-pencil:${crypto.randomUUID()}`)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [tradeIns, setTradeIns] = useState<DealTradeInOption[]>(initialTradeIns)
  const [dealDefaults, setDealDefaults] = useState<DealDefaults>(initialDealDefaults || NO_DEFAULTS)
  const [salesReps, setSalesReps] = useState<User[]>([])
  const [salesRepsLoading, setSalesRepsLoading] = useState(false)

  const [formData, setFormData] = useState(() => prefilledForm(initialVehicles, initialLeads, initialTradeIns, prefillLeadId, prefillTradeInId))

  const calculated = previewDeal(formData, dealDefaults)

  useEffect(() => {
    let current = true
    setSalesReps([])
    setFormData(previous => ({ ...previous, salespersonId: '' }))
    const rooftopId = vehicles.find(vehicle => vehicle.id === formData.vehicleId)?.rooftop.id
    setSalesRepsLoading(Boolean(rooftopId))
    if (rooftopId) {
      getRooftopSalespeople(rooftopId).then(response => {
        if (!current) return
        setSalesRepsLoading(false)
        if (response.success && response.data) setSalesReps(response.data.users)
        else setError(response.error || 'Unable to load sales reps.')
        // The lead's assigned salesperson is the only one the server accepts.
        if (response.success && response.data) {
          setFormData(previous => {
            const assigned = leads.find(lead => lead.id === previous.leadId)?.assignedSalesperson?.id
            return assigned && response.data.users.some(user => user.id === assigned) ? { ...previous, salespersonId: assigned } : previous
          })
        }
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
      setTradeIns(response.data.tradeIns)
      setDealDefaults(response.data.dealDefaults)
    } else {
      setError(response.error || 'Unable to load deal options.')
    }
    setLoading(false)
  }

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    setFormData(prev => {
      const tradeIn = tradeIns.find(item => item.id === prev.tradeInId)
      const keepTradeIn = !tradeIn || tradeIn.rooftop?.id === vehicle?.rooftop.id
      return { ...prev, vehicleId, vehiclePrice: vehicle?.price || 0, ...(keepTradeIn ? {} : { tradeInId: '', tradeInValue: 0 }) }
    })
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
    const lead = leads.find(item => item.id === formData.leadId)
    if (lead?.rooftop?.id && lead.rooftop.id !== selectedVehicle.rooftop.id) {
      setSaving(false)
      setSaveError('The customer and vehicle are at different rooftops.')
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
    if (formData.tradeInId) data.tradeInId = formData.tradeInId

    const response = await createDealPencil(data)

    setSaving(false)

    if (response.success && response.data?.createDealPencil?.id) {
      const dealId = response.data.createDealPencil.id
      router.push(`${basePath}/platform/deals/${dealId}`)
    } else {
      setSaveError(`Failed to create deal: ${response.error || 'Unknown error'}`)
    }
  }

  const formatCurrency = (value: number) => formatUsd(value)
  const formatPrice = (value: number) => formatUsd(value, { whole: true })

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId)
  const selectedLead = leads.find(l => l.id === formData.leadId)
  const tradeInOptions = tradeIns.filter(tradeIn =>
    (!selectedVehicle || tradeIn.rooftop?.id === selectedVehicle.rooftop.id) &&
    (!tradeIn.lead || tradeIn.lead.id === formData.leadId)
  )
  const selectedTradeIn = tradeIns.find(tradeIn => tradeIn.id === formData.tradeInId)

  const chooseLead = (leadId: string) => setFormData(previous => {
    const assigned = leads.find(lead => lead.id === leadId)?.assignedSalesperson?.id
    const tradeIn = tradeIns.find(item => item.id === previous.tradeInId)
    const keepTradeIn = !tradeIn?.lead || tradeIn.lead.id === leadId
    return {
      ...previous,
      leadId,
      salespersonId: assigned && salesReps.some(user => user.id === assigned) ? assigned : previous.salespersonId,
      ...(keepTradeIn ? {} : { tradeInId: '', tradeInValue: 0 }),
    }
  })

  const chooseTradeIn = (value: string) => {
    const tradeIn = tradeIns.find(item => item.id === value)
    setFormData(previous => tradeIn
      ? { ...previous, tradeInId: tradeIn.id, tradeInValue: (tradeIn.offerAmountCents || 0) / 100 }
      : { ...previous, tradeInId: '', tradeInValue: 0 })
  }

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

  const salesRepPlaceholder = !formData.vehicleId
    ? 'Choose a vehicle first'
    : salesRepsLoading
      ? 'Loading sales reps'
      : salesReps.length === 0
        ? 'No sales reps at this rooftop'
        : 'Select sales rep'

  const frontGross = selectedVehicle ? formData.vehiclePrice - (selectedVehicle.purchasePrice || 0) : null

  return (
    <PageContainer title="New Deal" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-24 md:px-6">
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
                  <Select value={formData.leadId} onValueChange={chooseLead}>
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
                          {v.year} {v.make} {v.model} · #{v.stockNumber} · {formatPrice(v.price)}
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
                      <div className="text-right"><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">MSRP</dt><dd>{formatPrice(selectedVehicle.price)}</dd></div>
                      <div className="text-right"><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Cost</dt><dd>{formatPrice(selectedVehicle.purchasePrice || 0)}</dd></div>
                    </dl>
                  </Panel>
                )}

                <label className="grid min-w-0 gap-1.5">
                  <span className={fieldLabel}>Sales rep</span>
                  <Select value={formData.salespersonId} onValueChange={(v) => setFormData(prev => ({ ...prev, salespersonId: v }))} disabled={!formData.vehicleId || salesRepsLoading || salesReps.length === 0}>
                    <SelectTrigger aria-label="Sales representative">
                      <SelectValue placeholder={salesRepPlaceholder} />
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

              <Step index={3} title="Trade-in" done={Boolean(formData.tradeInId)} optional>
                <label className="grid min-w-0 gap-1.5">
                  <span className={fieldLabel}>Trade-in record</span>
                  <Select value={formData.tradeInId || NO_TRADE_IN} onValueChange={(value) => chooseTradeIn(value === NO_TRADE_IN ? '' : value)}>
                    <SelectTrigger aria-label="Trade-in record">
                      <SelectValue placeholder="No trade-in record" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TRADE_IN}>No trade-in record</SelectItem>
                      {tradeInOptions.map(tradeIn => (
                        <SelectItem key={tradeIn.id} value={tradeIn.id} disabled={tradeIn.offerAmountCents == null}>
                          {tradeInLabel(tradeIn)}{tradeIn.offerAmountCents != null ? ` · ${formatPrice(tradeIn.offerAmountCents / 100)}` : ' · not appraised'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {selectedTradeIn && (
                  <Panel className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{tradeInLabel(selectedTradeIn)}</p>
                      <Code>{selectedTradeIn.vin || 'VIN not entered'}</Code>
                    </div>
                    <Link href={`${basePath}/platform/trade-ins/${selectedTradeIn.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Open trade-in</Link>
                  </Panel>
                )}
              </Step>

              <Step index={4} title="Numbers" done={formData.vehiclePrice > 0}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label htmlFor="deal-negotiated-price" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Negotiated price</span>
                    <MoneyInput
                      id="deal-negotiated-price"
                      cents={Math.round(formData.vehiclePrice * 100)}
                      onCentsChange={(cents) => setFormData(prev => ({ ...prev, vehiclePrice: cents / 100 }))}
                      placeholder="0"
                    />
                  </label>
                  <label htmlFor="deal-trade-in-value" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Trade-in value</span>
                    <MoneyInput
                      id="deal-trade-in-value"
                      cents={Math.round(formData.tradeInValue * 100)}
                      onCentsChange={(cents) => setFormData(prev => ({ ...prev, tradeInValue: cents / 100 }))}
                      placeholder="0"
                      disabled={Boolean(formData.tradeInId)}
                      aria-describedby={formData.tradeInId ? 'deal-trade-in-value-source' : undefined}
                    />
                    {formData.tradeInId && <span id="deal-trade-in-value-source" className="text-xs text-muted-foreground">Appraisal offer</span>}
                  </label>
                  <label htmlFor="deal-down-payment" className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Down payment</span>
                    <MoneyInput
                      id="deal-down-payment"
                      cents={Math.round(formData.downPayment * 100)}
                      onCentsChange={(cents) => setFormData(prev => ({ ...prev, downPayment: cents / 100 }))}
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
                    {calculated?.fees.map(line => <SummaryRow key={line.code} label={line.name} value={formatCurrency(lineAmountCents(line) / 100)} />)}
                    <SummaryRow label="Subtotal" value={calculated ? formatCurrency(calculated.subtotal) : '-'} />
                    {calculated?.taxLines.map(line => <SummaryRow key={line.code} label={line.name} value={formatCurrency(lineAmountCents(line) / 100)} />)}
                    {formData.tradeInValue > 0 && <SummaryRow label="Trade-in credit" value={formatUsdCredit(formData.tradeInValue)} credit />}
                    <SummaryRow emphasis label="Working balance" value={calculated ? formatCurrency(calculated.totalPrice) : '-'} />
                    <SummaryRow label="Down payment" value={formatUsdCredit(formData.downPayment)} credit={formData.downPayment > 0} />
                    <SummaryRow label="Remaining balance" value={calculated ? formatCurrency(calculated.remainingBalance) : '-'} />
                  </dl>
                </Panel>
                {frontGross !== null && (
                  <Panel>
                    <Readout label="Front gross" value={formatCurrency(frontGross)} tone={frontGross > 0 ? 'ok' : frontGross < 0 ? 'bad' : 'idle'} />
                  </Panel>
                )}
                {saveError && <Notice tone="bad">{saveError}</Notice>}
                <Track block>
                  <Pill variant="primary" onClick={handleSave} disabled={saving || !formData.vehicleId} aria-describedby={!formData.vehicleId ? 'deal-create-requirement' : undefined}>
                    <Save />
                    {saving ? 'Creating…' : 'Create worksheet'}
                  </Pill>
                </Track>
                {!formData.vehicleId && <p id="deal-create-requirement" className="text-center text-xs text-muted-foreground">Choose a vehicle first</p>}
              </section>
            </aside>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
