'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontFinancing } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { currencySymbol, formatPrice, storefrontCurrency, vehicleTitle } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { VehiclePhotoPlaceholder } from '../components/VehiclePhotoPlaceholder'
import { customerRequestReference } from '../lib/customerRequests'
import { FINANCING_ANNUAL_INCOME_INPUT, isFinancingSubmitDisabled } from '../lib/financingForm'
import { buildAmortizationSchedule, calculateFinancingEstimate, parseFinancingAmount } from '../lib/data/financing-calculator'
import { classifyVehicleDetailResponse } from '../lib/data/vehicle-detail-response'

type SelectedVehicleLookup =
  | { status: 'none' }
  | { status: 'loading' | 'error' | 'not-found'; vehicleId: string }
  | { status: 'available'; vehicleId: string; vehicle: Vehicle }

const LOAN_TERMS = [36, 48, 60, 72, 84]
const DEFAULT_INTEREST_RATE = 7.5
const DEFAULT_DOWN_PAYMENT_PERCENT = 10

function FinancingContent() {
  const business = useStorefrontBusiness()
  const currency = storefrontCurrency(business.currencyCode)
  const symbol = currencySymbol(currency)
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  const wholeMoney = (value: number) => formatPrice(value, currency)
  const searchParams = useSearchParams()
  const vehiclePrice = searchParams?.get('price') ?? null
  const vehicleId = searchParams?.get('vehicleId') || ''
  const queryPrice = parseFinancingAmount(vehiclePrice)
  const initialVehiclePrice = !vehicleId && queryPrice.status === 'valid' ? String(queryPrice.value) : ''
  const initialDownPayment = queryPrice.status === 'valid' && queryPrice.value > 0
    ? ((queryPrice.value * DEFAULT_DOWN_PAYMENT_PERCENT) / 100).toFixed(2)
    : ''

  const [formData, setFormData] = useState({
    vehiclePrice: initialVehiclePrice,
    downPayment: initialVehiclePrice ? initialDownPayment : '',
    downPaymentPercent: DEFAULT_DOWN_PAYMENT_PERCENT,
    interestRate: DEFAULT_INTEREST_RATE,
    loanTerm: 60,
    tradeInValue: '',
  })

  const [applicationForm, setApplicationForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    employmentStatus: '',
    annualIncome: '',
    creditTier: '',
    consent: false,
    website: '',
  })
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [isApplying, setIsApplying] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [applicationReference, setApplicationReference] = useState<string | null>(null)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [vehicleLookup, setVehicleLookup] = useState<SelectedVehicleLookup>(
    vehicleId ? { status: 'loading', vehicleId } : { status: 'none' },
  )
  const [vehicleLookupRetry, setVehicleLookupRetry] = useState(0)
  const [showAmortization, setShowAmortization] = useState(false)

  const currentVehicleLookup = vehicleId && vehicleLookup.status !== 'none' && vehicleLookup.vehicleId === vehicleId
    ? vehicleLookup
    : vehicleId ? { status: 'loading' as const, vehicleId } : { status: 'none' as const }
  const selectedVehicle = currentVehicleLookup.status === 'available' ? currentVehicleLookup.vehicle : null
  const selectedPrice = selectedVehicle ? parseFinancingAmount(selectedVehicle.price) : null
  const selectedPriceLabel = selectedPrice?.status === 'valid' && selectedPrice.value > 0
    ? formatPrice(selectedPrice.value, currency)
    : 'Price unavailable'
  const calculationInput = currentVehicleLookup.status === 'loading' ? { ...formData, vehiclePrice: '' } : formData
  const calculation = calculateFinancingEstimate(calculationInput)
  const calculatedResults = 'estimate' in calculation ? calculation.estimate : null
  const amortizationSchedule = calculation.status === 'ready' && calculatedResults
    ? buildAmortizationSchedule(calculatedResults, formData.interestRate, formData.loanTerm)
    : []
  const invalidPriceFromLink = !vehicleId && vehiclePrice !== null && queryPrice.status === 'invalid' && !formData.vehiclePrice

  useEffect(() => {
    if (!vehicleId) {
      setVehicleLookup({ status: 'none' })
      return
    }

    let isCurrentRequest = true
    setVehicleLookup({ status: 'loading', vehicleId })
    void fetchGraphQL<unknown>(GET_VEHICLE_BY_ID, { id: vehicleId })
      .then((response) => {
        if (!isCurrentRequest) return
        const result = classifyVehicleDetailResponse<Vehicle>(response, vehicleId)
        if (result.status === 'available') {
          setVehicleLookup({ status: 'available', vehicleId, vehicle: result.vehicle })
          const currentPrice = parseFinancingAmount(result.vehicle.price)
          if (currentPrice.status === 'valid' && currentPrice.value > 0) {
            setFormData((prev) => prev.vehiclePrice ? prev : {
              ...prev,
              vehiclePrice: String(currentPrice.value),
              downPayment: ((currentPrice.value * prev.downPaymentPercent) / 100).toFixed(2),
            })
          }
        } else if (result.status === 'not-found') {
          setVehicleLookup({ status: 'not-found', vehicleId })
        } else {
          setVehicleLookup({ status: 'error', vehicleId })
        }
      })
      .catch(() => {
        if (isCurrentRequest) setVehicleLookup({ status: 'error', vehicleId })
      })
    return () => {
      isCurrentRequest = false
    }
  }, [vehicleId, vehicleLookupRetry])

  useEffect(() => {
    if (!vehicleId) return
    setFormData((prev) => prev.vehiclePrice || prev.downPayment
      ? { ...prev, vehiclePrice: '', downPayment: '' }
      : prev)
  }, [vehicleId])

  useEffect(() => {
    if (vehicleId) return
    const linkedPrice = parseFinancingAmount(vehiclePrice)
    const nextPrice = linkedPrice.status === 'valid' ? String(linkedPrice.value) : ''
    setFormData((prev) => {
      if (prev.vehiclePrice === nextPrice) return prev
      return {
        ...prev,
        vehiclePrice: nextPrice,
        ...(linkedPrice.status === 'valid' && linkedPrice.value > 0
          ? { downPayment: ((linkedPrice.value * prev.downPaymentPercent) / 100).toFixed(2) }
          : {}),
      }
    })
  }, [vehicleId, vehiclePrice])

  const retryVehicleLookup = () => {
    setVehicleLookup({ status: 'loading', vehicleId })
    setVehicleLookupRetry((current) => current + 1)
  }

  const handleDownPaymentChange = (value: string) => {
    const downPayment = value ? parseFinancingAmount(value) : { status: 'valid' as const, value: 0 }
    const price = parseFinancingAmount(formData.vehiclePrice)
    const percent = price.status === 'valid' && price.value > 0 && downPayment.status === 'valid'
      ? (downPayment.value / price.value) * 100
      : 0
    setFormData((prev) => ({ ...prev, downPayment: value, downPaymentPercent: percent }))
  }

  const handleApplicationSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsApplying(true)
    setApplicationStatus('idle')
    setApplicationError(null)

    try {
      const result = await submitStorefrontFinancing({
        ...applicationForm,
        annualIncome: parseFloat(applicationForm.annualIncome) || 0,
        requestedAmount: calculation.status === 'ready' || calculation.status === 'no-loan'
          ? calculatedResults?.loanAmount ?? null
          : calculation.status === 'zero-price' ? 0 : null,
        monthlyPayment: calculation.status === 'ready' ? calculatedResults?.monthlyPayment ?? null : null,
        downPayment: parseFloat(formData.downPayment || '0') || 0,
        tradeInValue: parseFloat(formData.tradeInValue || '0') || 0,
        apr: formData.interestRate,
        loanTerm: formData.loanTerm,
        vehicleId: selectedVehicle?.id,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })

      if (!result.success) throw new Error(result.error)

      setApplicationReference(
        result.data.applicationReference || customerRequestReference('financing', result.data.applicationId)
      )
      setApplicationStatus('success')
      setIdempotencyKey(crypto.randomUUID())
      setApplicationForm({
        fullName: '',
        email: '',
        phone: '',
        employmentStatus: '',
        annualIncome: '',
        creditTier: '',
        consent: false,
        website: '',
      })
    } catch (error) {
      setApplicationError(error instanceof Error && error.message ? error.message : null)
      setApplicationStatus('error')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Financing"
        title="Estimate your monthly payment"
        description="Adjust the loan terms to see how price, down payment, and term affect your monthly cost and total interest."
      />

      <Container className="py-[var(--sf-space-2xl)]">
        {vehicleId && currentVehicleLookup.status === 'loading' && (
          <p role="status" className="mb-[var(--sf-space-md)]">Loading vehicle…</p>
        )}
        {vehicleId && currentVehicleLookup.status === 'not-found' && (
          <p role="status" className="sf-card p-4 mb-[var(--sf-space-md)]">
            This vehicle is no longer available. <Link href="/inventory" className="underline underline-offset-2">Browse inventory</Link>
          </p>
        )}
        {vehicleId && currentVehicleLookup.status === 'error' && (
          <div role="alert" className="sf-card p-4 mb-[var(--sf-space-md)]">
            <p>This vehicle couldn&apos;t be loaded.</p>
            <button type="button" onClick={retryVehicleLookup} className="sf-btn sf-btn-ghost mt-3">Retry</button>
          </div>
        )}
        {selectedVehicle && (
          <div className="sf-card mb-[var(--sf-space-lg)] grid overflow-hidden sm:grid-cols-[13rem_1fr]">
            <div className="relative min-h-44 bg-[var(--sf-paper-2)]">
              {vehicleImageUrl(primaryVehicleImage(selectedVehicle.images)) ? (
                <Image
                  src={vehicleImageUrl(primaryVehicleImage(selectedVehicle.images))!}
                  alt={vehicleTitle(selectedVehicle)}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 208px"
                  priority
                  unoptimized
                />
              ) : (
                <VehiclePhotoPlaceholder />
              )}
            </div>
            <div className="p-[var(--sf-space-md)]">
              <p className="sf-eyebrow mb-2">Financing this vehicle</p>
              <h2 className="sf-display text-[length:var(--sf-text-xl)]">{vehicleTitle(selectedVehicle)}</h2>
              <p className="mt-2 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                Stock {selectedVehicle.stockNumber} · {selectedPriceLabel}
              </p>
              <Link href={`/inventory/${selectedVehicle.id}`} className="mt-4 inline-block text-sm font-semibold text-[var(--sf-accent)]">
                Review vehicle details →
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[var(--sf-space-xl)]">
          <div className="space-y-[var(--sf-space-lg)]">
            <div className="sf-card p-[var(--sf-space-lg)]">
              <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-5">Loan details</h2>

              <div className="mb-4">
                <label htmlFor="financing-vehicle-price" className="sf-eyebrow block mb-2">Vehicle price</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5" style={{ color: 'var(--sf-ink-3)' }}>{symbol}</span>
                  <input
                    id="financing-vehicle-price"
                    type="number"
                    value={formData.vehiclePrice}
                    onChange={(e) => {
                      const value = e.target.value
                      const amount = parseFinancingAmount(value)
                      setFormData((prev) => ({
                        ...prev,
                        vehiclePrice: value,
                        ...(amount.status === 'valid' && amount.value > 0
                          ? { downPayment: ((amount.value * prev.downPaymentPercent) / 100).toFixed(2) }
                          : {}),
                      }))
                    }}
                    className="sf-input pl-7"
                    placeholder="35000"
                    step="0.01"
                    min="0"
                  />
                </div>
                {invalidPriceFromLink && (
                  <p role="alert" className="text-[var(--sf-text-xs)] mt-2">
                    Enter a vehicle price.
                  </p>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <label htmlFor="financing-down-payment" className="sf-eyebrow">Down payment</label>
                  <span className="text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
                    {formData.downPaymentPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-2.5" style={{ color: 'var(--sf-ink-3)' }}>{symbol}</span>
                  <input
                    id="financing-down-payment"
                    type="number"
                    value={formData.downPayment}
                    onChange={(e) => handleDownPaymentChange(e.target.value)}
                    className="sf-input pl-7"
                    placeholder="3500"
                    step="100"
                    min="0"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={formData.downPaymentPercent}
                  onChange={(e) => {
                    const percent = parseFloat(e.target.value)
                    setFormData((prev) => {
                      const price = parseFinancingAmount(prev.vehiclePrice)
                      return {
                        ...prev,
                        downPaymentPercent: percent,
                        ...(price.status === 'valid' && price.value > 0
                          ? { downPayment: ((price.value * percent) / 100).toFixed(2) }
                          : {}),
                      }
                    })
                  }}
                  className="w-full"
                  aria-label="Down payment percentage"
                />
                <div className="flex justify-between text-[var(--sf-text-xs)] mt-1" style={{ color: 'var(--sf-ink-3)' }}>
                  <span>0%</span>
                  <span>50%</span>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="financing-apr" className="sf-eyebrow block mb-2">Interest rate (APR)</label>
                <div className="relative">
                  <input
                    id="financing-apr"
                    type="number"
                    value={formData.interestRate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                    className="sf-input pr-8"
                    placeholder="7.5"
                    step="0.1"
                    min="0"
                    max="30"
                  />
                  <span className="absolute right-3 top-2.5" style={{ color: 'var(--sf-ink-3)' }}>%</span>
                </div>
              </div>

              <div className="mb-4">
                <p id="financing-loan-term" className="sf-eyebrow block mb-2">Loan term</p>
                <div role="group" aria-labelledby="financing-loan-term" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {LOAN_TERMS.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, loanTerm: term }))}
                      className={`sf-btn text-sm flex-col py-3 ${
                        formData.loanTerm === term ? 'sf-btn-primary' : 'sf-btn-ghost'
                      }`}
                      aria-pressed={formData.loanTerm === term}
                    >
                      <span className="font-semibold">{term}</span>
                      <span className="text-[10px] opacity-75">mos</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="financing-trade-in" className="sf-eyebrow block mb-2">Your estimated trade-in amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5" style={{ color: 'var(--sf-ink-3)' }}>{symbol}</span>
                  <input
                    id="financing-trade-in"
                    type="number"
                    value={formData.tradeInValue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tradeInValue: e.target.value }))}
                    className="sf-input pl-7"
                    placeholder="5000"
                    step="100"
                    min="0"
                  />
                </div>
                <Link
                  href={selectedVehicle ? `/trade-in?vehicleId=${selectedVehicle.id}` : '/trade-in'}
                  className="text-[var(--sf-text-sm)] mt-1 inline-block hover:text-[var(--sf-accent)] transition-colors"
                  style={{ color: 'var(--sf-accent)' }}
                >
                  Request a trade-in review →
                </Link>
              </div>
            </div>

            {calculation.status === 'ready' && calculatedResults && calculatedResults.loanAmount > 0 && (
              <div className="sf-card p-[var(--sf-space-lg)]">
                <button
                  onClick={() => setShowAmortization(!showAmortization)}
                  className="w-full flex justify-between items-center text-left"
                >
                  <h2 className="sf-display text-[length:var(--sf-text-xl)]">Amortization schedule</h2>
                  <svg
                    className={`w-5 h-5 transition-transform ${showAmortization ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAmortization && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-[var(--sf-text-sm)]">
                      <thead>
                        <tr style={{ color: 'var(--sf-ink-3)' }}>
                          <th className="p-2 text-left sf-eyebrow">Month</th>
                          <th className="p-2 text-right sf-eyebrow">Payment</th>
                          <th className="p-2 text-right sf-eyebrow">Principal</th>
                          <th className="p-2 text-right sf-eyebrow">Interest</th>
                          <th className="p-2 text-right sf-eyebrow">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amortizationSchedule.map((row, idx) => {
                          if (row.separator) {
                            return (
                              <tr key={idx}>
                                <td colSpan={5} className="p-2 text-center" style={{ color: 'var(--sf-ink-3)' }}>
                                  …
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={idx} className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                              <td className="p-2">{row.month}</td>
                              <td className="p-2 text-right">{money(row.payment)}</td>
                              <td className="p-2 text-right">{money(row.principal)}</td>
                              <td className="p-2 text-right">{money(row.interest)}</td>
                              <td className="p-2 text-right">{money(row.balance)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-[var(--sf-space-lg)]">
            <div className="sf-card p-[var(--sf-space-lg)]">
              <p className="sf-eyebrow mb-2">Estimated monthly payment</p>
              {calculation.status === 'ready' && calculatedResults ? (
                <>
                  <div className="sf-display text-[length:var(--sf-text-display)]" style={{ color: 'var(--sf-accent)' }}>
                    {money(calculatedResults.monthlyPayment)}
                  </div>
                  <p className="text-[var(--sf-text-sm)] mt-2" style={{ color: 'var(--sf-ink-3)' }}>
                    per month for {formData.loanTerm} months
                  </p>
                </>
              ) : calculation.status === 'no-loan' ? (
                <p role="status" className="text-[var(--sf-text-sm)]">Your down payment and trade-in cover the full price.</p>
              ) : calculation.status === 'zero-price' ? (
                <p role="status" className="text-[var(--sf-text-sm)]">Enter a vehicle price to see a payment.</p>
              ) : calculation.status === 'invalid-price' || calculation.status === 'invalid-input' ? (
                <p role="alert" className="text-[var(--sf-text-sm)]">Check the amounts entered.</p>
              ) : (
                <p role="status" className="text-[var(--sf-text-sm)]">Enter a vehicle price to see a payment.</p>
              )}
            </div>

            {calculation.status === 'ready' && calculatedResults && (
              <div className="sf-card p-[var(--sf-space-lg)]">
                <h3 className="font-semibold mb-4">Payment breakdown</h3>
                <div className="space-y-3 text-[var(--sf-text-sm)]">
                  <Row label="Vehicle price" value={wholeMoney(calculatedResults.vehiclePrice)} />
                  <Row
                    label="Down payment"
                    value={`−${wholeMoney(calculatedResults.downPayment)}`}
                    accent="good"
                  />
                  {calculatedResults.tradeInValue > 0 && (
                    <Row
                      label="Trade-in value"
                      value={`−${wholeMoney(calculatedResults.tradeInValue)}`}
                      accent="good"
                    />
                  )}
                  <Row label="Loan amount" value={wholeMoney(calculatedResults.loanAmount)} />
                  <Row
                    label="Total interest"
                    value={`+${money(calculatedResults.totalInterest)}`}
                    accent="bad"
                  />
                  <hr className="sf-rule" />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total payment</span>
                    <span className="font-bold text-[var(--sf-text-lg)]">
                      {money(calculatedResults.totalPayment)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-[var(--sf-space-lg)]" style={{ background: 'var(--sf-paper-3)', color: 'var(--sf-accent-ink)' }}>
              <h3 className="sf-display text-[length:var(--sf-text-xl)] mb-4">Send a financing request</h3>

              {applicationStatus === 'success' ? (
                <div className="border p-4 text-[var(--sf-text-sm)]" style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)' }}>
                  <p className="font-semibold" role="status">Request received by {business.fullName}.</p>
                  {applicationReference && <p className="mt-1 font-semibold">Reference {applicationReference}</p>}
                  <p className="mt-1 opacity-85">
                    A finance manager will review your numbers{selectedVehicle ? ` for the ${vehicleTitle(selectedVehicle)}` : ''} and contact you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleApplicationSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={applicationForm.fullName}
                    onChange={(e) => setApplicationForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    className="sf-input"
                    placeholder="Full name"
                      aria-label="Full name"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="email"
                      required
                      value={applicationForm.email}
                      onChange={(e) => setApplicationForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="sf-input"
                      placeholder="Email"
                      aria-label="Email"
                    />
                    <input
                      type="tel"
                      required
                      value={applicationForm.phone}
                      onChange={(e) => setApplicationForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="sf-input"
                      placeholder="Phone"
                      aria-label="Phone"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      required
                      value={applicationForm.employmentStatus}
                      onChange={(e) => setApplicationForm((prev) => ({ ...prev, employmentStatus: e.target.value }))}
                      className="sf-input"
                      aria-label="Employment status"
                    >
                      <option value="">Employment status</option>
                      <option value="employed">Employed</option>
                      <option value="self-employed">Self-employed</option>
                      <option value="retired">Retired</option>
                      <option value="student">Student</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="number"
                      required
                      value={applicationForm.annualIncome}
                      onChange={(e) => setApplicationForm((prev) => ({ ...prev, annualIncome: e.target.value }))}
                      className="sf-input"
                      placeholder="Annual income"
                      aria-label="Annual income"
                      min={FINANCING_ANNUAL_INCOME_INPUT.min}
                      step={FINANCING_ANNUAL_INCOME_INPUT.step}
                    />
                  </div>
                  <select
                    required
                    value={applicationForm.creditTier}
                    onChange={(e) => setApplicationForm((prev) => ({ ...prev, creditTier: e.target.value }))}
                    className="sf-input"
                    aria-label="Credit range"
                  >
                    <option value="">Self-reported credit range</option>
                    <option value="excellent-720-plus">Excellent (720+)</option>
                    <option value="good-680-719">Good (680–719)</option>
                    <option value="fair-620-679">Fair (620–679)</option>
                    <option value="rebuilding-under-620">Rebuilding (&lt;620)</option>
                    <option value="unknown">Not sure</option>
                  </select>
                  <label className="flex items-start gap-2 text-[var(--sf-text-xs)] opacity-85">
                    <input
                      type="checkbox"
                      required
                      checked={applicationForm.consent}
                      onChange={(e) => setApplicationForm((prev) => ({ ...prev, consent: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      I agree to be contacted about financing options.
                    </span>
                  </label>
                  <input
                    type="text"
                    name="website"
                    value={applicationForm.website}
                    onChange={(e) => setApplicationForm((prev) => ({ ...prev, website: e.target.value }))}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />
                  {applicationStatus === 'error' && (
                    <p className="text-[var(--sf-text-sm)] opacity-90" role="alert">
                      {applicationError || 'We could not submit your request. Please try again or contact the dealership.'}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isFinancingSubmitDisabled(isApplying)}
                    className="sf-btn sf-btn-secondary w-full"
                  >
                    {isApplying ? 'Sending…' : 'Send financing request'}
                  </button>
                </form>
              )}
            </div>

            <p className="text-[var(--sf-text-xs)] leading-relaxed" style={{ color: 'var(--sf-ink-3)' }}>
              Payments shown are estimates. Actual rates and terms may differ.
            </p>
          </div>
        </div>
      </Container>
    </>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'good' | 'bad' }) {
  const color =
    accent === 'good' ? 'oklch(0.5 0.12 145)' : accent === 'bad' ? 'oklch(0.45 0.15 25)' : 'var(--sf-ink)'
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--sf-ink-2)' }}>{label}</span>
      <span className="font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function FinancingFallback() {
  return (
    <>
      <PageHeader eyebrow="Financing" title="Estimate your monthly payment" />
      <Container className="py-[var(--sf-space-2xl)]">
        <div className="sf-skeleton h-96 rounded-[var(--sf-radius-md)]" />
      </Container>
    </>
  )
}

export function FinancingPage() {
  return (
    <Suspense fallback={<FinancingFallback />}>
      <FinancingContent />
    </Suspense>
  )
}
