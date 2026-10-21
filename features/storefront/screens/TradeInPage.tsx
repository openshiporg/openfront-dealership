'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontTradeIn } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { vehicleTitle } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { customerRequestReference } from '../lib/customerRequests'
import { transitionTradeInStep } from '../lib/tradeInForm'
import { VehiclePhotoPlaceholder } from '../components/VehiclePhotoPlaceholder'
import { currencySymbol } from '../lib/format'

const MAKES = [
  'Acura', 'Audi', 'BMW', 'Chevrolet', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Lexus', 'Mazda',
  'Mercedes-Benz', 'Nissan', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen',
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - i)

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', desc: 'Like new, no issues' },
  { value: 'good', label: 'Good', desc: 'Normal wear, well maintained' },
  { value: 'fair', label: 'Fair', desc: 'Some cosmetic or mechanical issues' },
  { value: 'poor', label: 'Poor', desc: 'Significant issues or damage' },
]

const STEPS = ['Vehicle info', 'Condition', 'Contact']

const EMPTY = {
  year: '',
  make: '',
  model: '',
  trim: '',
  mileage: '',
  vin: '',
  condition: 'good',
  ownership: 'own',
  payoffAmount: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  website: '',
}

export function TradeInPage() {
  const business = useStorefrontBusiness()
  const searchParams = useSearchParams()
  const interestedVehicleId = searchParams?.get('vehicleId') || ''
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(EMPTY)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [submitted, setSubmitted] = useState(false)
  const [submissionReference, setSubmissionReference] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [interestedVehicle, setInterestedVehicle] = useState<Vehicle | null>(null)

  useEffect(() => {
    if (!interestedVehicleId) {
      setInterestedVehicle(null)
      return
    }

    void fetchGraphQL<{ publicInventoryVehicle: Vehicle | null }>(GET_VEHICLE_BY_ID, { id: interestedVehicleId })
      .then((data) => setInterestedVehicle(data.publicInventoryVehicle ?? null))
      .catch(() => setInterestedVehicle(null))
  }, [interestedVehicleId])

  const submitTradeIn = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitStorefrontTradeIn({
        ...formData,
        year: parseInt(formData.year),
        mileage: parseInt(formData.mileage) || 0,
        payoffAmount: parseFloat(formData.payoffAmount) || 0,
        interestedVehicleId,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setSubmissionReference(customerRequestReference('trade-in', result.data.tradeInId))
      setIdempotencyKey(crypto.randomUUID())
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'There was an error submitting your trade-in request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const advanceStep = (currentStep: 1 | 2) => {
    const transition = transitionTradeInStep(currentStep, formData)
    setStepError(transition.error)
    setStep(transition.step)
  }

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 1 || step === 2) {
      advanceStep(step)
      return
    }
    void submitTradeIn()
  }

  const goBack = (previousStep: 1 | 2) => {
    setStepError(null)
    setSubmitError(null)
    setStep(previousStep)
  }

  const reset = () => {
    setSubmitted(false)
    setStep(1)
    setFormData(EMPTY)
    setSubmissionReference(null)
    setStepError(null)
    setSubmitError(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  if (submitted) {
    return (
      <>
        <PageHeader eyebrow="Trade-in" title="Request received" />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg">
          <div className="sf-card p-[var(--sf-space-xl)] text-center">
            <p className="text-[var(--sf-text-md)] mb-3" style={{ color: 'var(--sf-ink-2)' }}>
              {business.fullName} received your trade-in request for your {formData.year} {formData.make} {formData.model}
              {interestedVehicle ? ` toward the ${vehicleTitle(interestedVehicle)}.` : '.'}
            </p>
            {submissionReference && (
              <p className="sf-eyebrow mb-6" role="status">Reference {submissionReference}</p>
            )}

            <div className="text-left mb-6">
              <p className="sf-eyebrow mb-3">What happens next</p>
              <ol className="space-y-2 text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
                <li className="flex gap-3">
                  <span className="font-semibold" style={{ color: 'var(--sf-accent)' }}>1.</span>
                  <span>Our team will review your request.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold" style={{ color: 'var(--sf-accent)' }}>2.</span>
                  <span>We may contact you to arrange an in-person inspection.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold" style={{ color: 'var(--sf-accent)' }}>3.</span>
                  <span>Any offer, if made, will be shared separately after inspection and dealership review.</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button href="/inventory" className="flex-1">
                Browse inventory
              </Button>
              <Button variant="ghost" onClick={reset} className="flex-1">
                Start another trade-in request
              </Button>
            </div>
          </div>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Trade-in"
        title="Request a trade-in review"
      />

      <Container className="py-[var(--sf-space-2xl)] max-w-2xl">
        {interestedVehicle && (
          <div className="sf-card mb-[var(--sf-space-lg)] flex items-center gap-4 overflow-hidden p-3">
            <div className="relative h-24 w-32 shrink-0 overflow-hidden bg-[var(--sf-paper-2)]">
              {vehicleImageUrl(primaryVehicleImage(interestedVehicle.images)) ? (
                <Image
                  src={vehicleImageUrl(primaryVehicleImage(interestedVehicle.images))!}
                  alt={vehicleTitle(interestedVehicle)}
                  fill
                  className="object-cover"
                  sizes="128px"
                  unoptimized
                />
              ) : (
                <VehiclePhotoPlaceholder />
              )}
            </div>
            <div className="min-w-0">
              <p className="sf-eyebrow mb-1">Trading toward</p>
              <p className="font-semibold">{vehicleTitle(interestedVehicle)}</p>
              <p className="mt-1 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">Stock {interestedVehicle.stockNumber}</p>
            </div>
          </div>
        )}

        <ol className="flex justify-between mb-[var(--sf-space-xl)]">
          {STEPS.map((label, i) => {
            const n = i + 1
            const active = step >= n
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className="w-9 h-9 flex items-center justify-center font-semibold text-sm rounded-full"
                  style={{
                    background: active ? 'var(--sf-accent)' : 'var(--sf-paper-2)',
                    color: active ? 'var(--sf-accent-ink)' : 'var(--sf-ink-3)',
                  }}
                >
                  {n}
                </span>
                <span
                  className="text-[var(--sf-text-sm)] hidden sm:inline"
                  style={{ color: active ? 'var(--sf-ink)' : 'var(--sf-ink-3)', fontWeight: active ? 600 : 400 }}
                >
                  {label}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="sf-card p-[var(--sf-space-lg)]">
          <form onSubmit={handleFormSubmit}>
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-4">Vehicle information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Year">
                    <select required value={formData.year} onChange={(e) => setFormData((p) => ({ ...p, year: e.target.value }))} className="sf-input">
                      <option value="">Select year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Make">
                    <select required value={formData.make} onChange={(e) => setFormData((p) => ({ ...p, make: e.target.value }))} className="sf-input">
                      <option value="">Select make</option>
                      {MAKES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Model">
                    <input type="text" required value={formData.model} onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))} className="sf-input" placeholder="Accord" />
                  </Field>
                  <Field label="Trim">
                    <input type="text" value={formData.trim} onChange={(e) => setFormData((p) => ({ ...p, trim: e.target.value }))} className="sf-input" placeholder="Sport" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Mileage">
                    <input type="number" required min="0" max="2000000" step="1" value={formData.mileage} onChange={(e) => setFormData((p) => ({ ...p, mileage: e.target.value }))} className="sf-input" placeholder="45000" />
                  </Field>
                  <Field label="VIN (optional)">
                    <input type="text" value={formData.vin} onChange={(e) => setFormData((p) => ({ ...p, vin: e.target.value }))} className="sf-input" placeholder="17 characters" maxLength={17} />
                  </Field>
                </div>
                {stepError && <p role="alert" className="text-sm" style={{ color: 'oklch(0.45 0.15 25)' }}>{stepError}</p>}
                <button type="submit" className="sf-btn sf-btn-primary w-full">
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-4">Vehicle condition</h2>
                <div>
                  <p className="sf-eyebrow mb-3">Overall condition</p>
                  <div className="space-y-2">
                    {CONDITIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-start gap-3 p-3 border cursor-pointer transition-colors hover:bg-[var(--sf-paper-2)]"
                        style={{ borderColor: 'var(--sf-rule)' }}
                      >
                        <input
                          type="radio"
                          name="condition"
                          value={opt.value}
                          checked={formData.condition === opt.value}
                          onChange={(e) => setFormData((p) => ({ ...p, condition: e.target.value }))}
                          required
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">{opt.label}</span>
                          <span className="block text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-3)' }}>{opt.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="sf-eyebrow mb-3">Ownership status</p>
                  <div className="space-y-2">
                    {[
                      { value: 'own', label: 'I own it outright' },
                      { value: 'financing', label: 'I&apos;m still financing' },
                      { value: 'lease', label: 'It&apos;s a lease' },
                    ].map((o) => (
                      <label
                        key={o.value}
                        className="flex items-center gap-3 p-3 border cursor-pointer transition-colors hover:bg-[var(--sf-paper-2)]"
                        style={{ borderColor: 'var(--sf-rule)' }}
                      >
                        <input
                          type="radio"
                          name="ownership"
                          value={o.value}
                          checked={formData.ownership === o.value}
                          onChange={(e) => setFormData((p) => ({ ...p, ownership: e.target.value }))}
                          required
                        />
                        <span dangerouslySetInnerHTML={{ __html: o.label }} />
                      </label>
                    ))}
                  </div>
                </div>
                {formData.ownership === 'financing' && (
                  <Field label="Estimated payoff amount">
                    <input type="number" min="0" step="1" value={formData.payoffAmount} onChange={(e) => setFormData((p) => ({ ...p, payoffAmount: e.target.value }))} className="sf-input" placeholder={currencySymbol(business.currencyCode)} />
                  </Field>
                )}
                {stepError && <p role="alert" className="text-sm" style={{ color: 'oklch(0.45 0.15 25)' }}>{stepError}</p>}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => goBack(1)} className="sf-btn sf-btn-ghost flex-1">
                    Back
                  </button>
                  <button type="submit" className="sf-btn sf-btn-primary flex-1">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-4">Contact information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First name">
                    <input type="text" required value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} className="sf-input" />
                  </Field>
                  <Field label="Last name">
                    <input type="text" required value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} className="sf-input" />
                  </Field>
                </div>
                <Field label="Email">
                  <input type="email" required value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Phone">
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="sf-input" />
                </Field>
                {submitError && <p role="alert" className="text-sm" style={{ color: 'oklch(0.45 0.15 25)' }}>{submitError}</p>}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => goBack(2)} className="sf-btn sf-btn-ghost flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={isSubmitting} className="sf-btn sf-btn-primary flex-1">
                    {isSubmitting ? 'Sending…' : 'Send trade-in request'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        <p className="mt-[var(--sf-space-md)] text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-3)' }}>
          Prefer to browse first?{' '}
          <Link href="/inventory" className="underline underline-offset-2 hover:text-[var(--sf-accent)]">
            View inventory
          </Link>
        </p>
      </Container>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="sf-eyebrow block mb-2">{label}</span>
      {children}
    </label>
  )
}
