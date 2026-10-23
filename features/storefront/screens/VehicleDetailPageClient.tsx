'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import { Vehicle } from '@/features/storefront/lib/types'
import { getComparisonCount } from '@/features/storefront/lib/comparison'
import { submitStorefrontInquiry, submitStorefrontTestDrive } from '../actions/submissions'
import { Container } from '../components/Container'
import { LeadCaptureModal, LeadIntent, type LeadSubmissionFeedback } from '../components/LeadCaptureModal'
import { VehicleGallery } from '../components/vdp/VehicleGallery'
import { VehicleNotFound } from '../components/vdp/VehicleNotFound'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { formatMileage, formatPrice, vehicleTitle } from '../lib/format'
import { customerRequestReference } from '../lib/customerRequests'
import { classifyVehicleDetailResponse, parseVehicleFeatures } from '../lib/data/vehicle-detail-response'
import { vehicleConditionLabel, vehicleStatus } from '../lib/vehicleStatus'

export type VehicleDetailPageState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'error' }
  | { id: string; status: 'not-found' }
  | { id: string; status: 'available'; vehicle: Vehicle }

const emptyFeedback: LeadSubmissionFeedback = { status: 'idle' }

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  preferredDate: '',
  preferredTime: '',
  website: '',
}

export function VehicleDetailPageClient({ id, initialState }: { id: string; initialState: VehicleDetailPageState }) {
  const business = useStorefrontBusiness()
  const [loadState, setLoadState] = useState<VehicleDetailPageState>(initialState)
  const [retryToken, setRetryToken] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [intent, setIntent] = useState<LeadIntent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<LeadSubmissionFeedback>(emptyFeedback)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [formData, setFormData] = useState(emptyForm)
  const testDriveOpenerRef = useRef<HTMLButtonElement>(null)
  const quoteOpenerRef = useRef<HTMLButtonElement>(null)
  const contactOpenerRef = useRef<HTMLButtonElement>(null)
  const barTestDriveOpenerRef = useRef<HTMLButtonElement>(null)
  const barContactOpenerRef = useRef<HTMLButtonElement>(null)
  const activeLeadOpenerRef = useRef<React.RefObject<HTMLButtonElement | null> | null>(null)
  const [compareCount, setCompareCount] = useState(0)

  // The phone action bar floats above the shared compare bar when that bar is showing.
  useEffect(() => {
    const sync = () => setCompareCount(getComparisonCount())
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [])

  useEffect(() => {
    if (retryToken === 0) return
    let isCurrentRequest = true
    setLoadState({ id, status: 'loading' })
    void fetchGraphQL<unknown>(GET_VEHICLE_BY_ID, { id })
      .then((response) => {
        if (!isCurrentRequest) return
        const result = classifyVehicleDetailResponse<Vehicle>(response, id)
        if (result.status === 'available') setLoadState({ id, status: 'available', vehicle: result.vehicle })
        else if (result.status === 'not-found') setLoadState({ id, status: 'not-found' })
        else setLoadState({ id, status: 'error' })
      })
      .catch(() => {
        if (isCurrentRequest) setLoadState({ id, status: 'error' })
      })
    return () => {
      isCurrentRequest = false
    }
  }, [id, retryToken])

  const vehicle = loadState.id === id && loadState.status === 'available' ? loadState.vehicle : null
  const loading = loadState.id !== id || loadState.status === 'loading'

  const retryVehicleLoad = () => {
    setLoadState({ id, status: 'loading' })
    setRetryToken((current) => current + 1)
  }

  const openLead = (type: LeadIntent, openerRef: React.RefObject<HTMLButtonElement | null>) => {
    activeLeadOpenerRef.current = openerRef
    setIntent(type)
    setFeedback(emptyFeedback)
    setIdempotencyKey(crypto.randomUUID())
    setFormData(emptyForm)
  }

  const closeLead = () => {
    if (isSubmitting) return
    const openerRef = activeLeadOpenerRef.current
    setIntent(null)
    setFeedback(emptyFeedback)
    setFormData(emptyForm)
    window.setTimeout(() => openerRef?.current?.focus(), 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle || !intent || isSubmitting) return
    setIsSubmitting(true)
    setFeedback(emptyFeedback)
    try {
      if (intent === 'test-drive') {
        const result = await submitStorefrontTestDrive({
          customerName: `${formData.firstName} ${formData.lastName}`,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          preferredDate: formData.preferredDate,
          preferredTime: formData.preferredTime,
          vehicleId: vehicle.id,
          message: formData.message,
          website: formData.website,
          rooftopSlug: business.rooftopSlug,
          idempotencyKey,
        })
        if (!result.success) throw new Error(result.error)
        setFeedback({
          status: 'success',
          message: `${business.fullName} received your test-drive request.`,
          reference: customerRequestReference('test-drive', result.data.testDriveId),
        })
      } else {
        const result = await submitStorefrontInquiry({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          preferredContact: 'email',
          intent: intent === 'get-quote' ? 'get-quote' : 'vehicle-question',
          message: formData.message,
          vehicleId: vehicle.id,
          website: formData.website,
          rooftopSlug: business.rooftopSlug,
          idempotencyKey,
        })
        if (!result.success) throw new Error(result.error)
        setFeedback({
          status: 'success',
          message: intent === 'get-quote'
            ? `${business.fullName} received your price-quote request.`
            : `${business.fullName} received your question.`,
          reference: customerRequestReference('inquiry', result.data.leadId),
        })
      }
      setFormData(emptyForm)
    } catch (error) {
      setFeedback({
        status: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <VehicleDetailSkeleton />
  }

  if (loadState.id === id && loadState.status === 'error') {
    return (
      <Container className="py-[var(--sf-space-2xl)]">
        <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
          <div role="alert" aria-live="assertive">
            <h1 className="sf-title-line sf-heading text-[var(--sf-text-xl)]">
              <span className="sf-dot" data-tone="bad" aria-hidden="true" />
              Vehicle details unavailable
            </h1>
            <p className="sf-muted mt-2 pl-4">We couldn&apos;t load this vehicle.</p>
          </div>
          <div className="sf-track">
            <button type="button" onClick={retryVehicleLoad} className="sf-pill sf-pill-raised min-h-11 sm:min-h-9">
              Retry
            </button>
            <Link href="/inventory" className="sf-pill min-h-11 sm:min-h-9">Back to inventory</Link>
          </div>
        </div>
      </Container>
    )
  }

  if (loadState.id === id && loadState.status === 'not-found') {
    return <VehicleNotFound />
  }

  if (!vehicle) {
    return <VehicleDetailSkeleton />
  }

  const images = vehicle.images ?? []
  const features = parseVehicleFeatures(vehicle.features)
  const title = vehicleTitle(vehicle)
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const status = vehicleStatus(vehicle.status)
  const conditionLabel = vehicleConditionLabel(vehicle.condition)
  const hasPublicPrice = typeof vehicle.price === 'number' && Number.isFinite(vehicle.price) && vehicle.price >= 0
  const displayPrice = hasPublicPrice ? formatPrice(vehicle.price, business.currencyCode) : 'Price unavailable'
  const financingHref = `/financing?vehicleId=${encodeURIComponent(vehicle.id)}${hasPublicPrice ? `&price=${encodeURIComponent(String(vehicle.price))}` : ''}`
  const tradeInHref = `/trade-in?vehicleId=${vehicle.id}`

  return (
    <>
      <nav aria-label="Breadcrumb" className="border-b" style={{ borderColor: 'var(--sf-rule)' }}>
        <Container className="flex min-h-11 items-center gap-1.5 text-[var(--sf-text-sm)]">
          <Link href="/inventory" className="sf-muted inline-flex min-h-11 shrink-0 items-center gap-1 hover:text-[var(--sf-accent)]">
            <ChevronLeft className="size-4 sm:hidden" aria-hidden="true" />
            Inventory
          </Link>
          <ChevronRight className="sf-faint hidden size-3.5 shrink-0 sm:block" aria-hidden="true" />
          <span className="sf-faint hidden min-w-0 truncate sm:block" aria-current="page">{title}</span>
        </Container>
      </nav>

      <Container className="pb-[var(--sf-space-xl)] pt-4 md:pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <VehicleGallery
              images={images}
              activeIndex={activeImageIndex}
              onSelect={setActiveImageIndex}
              title={title}
              conditionLabel={conditionLabel}
            />
          </div>

          <aside className="min-w-0 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <h1 className="sf-title-line">
              <span className="sf-dot" data-tone={status.tone} aria-hidden="true" />
              <span className="sf-display text-[length:var(--sf-text-2xl)]">{name}</span>
            </h1>
            <p className="sf-muted mt-1 pl-4 text-[var(--sf-text-md)]">
              <span className="sr-only">{status.label}. </span>
              {vehicle.trim}
            </p>

            <div className="sf-sticker mt-6">
              <div className="sf-sticker-head">
                <span>Price</span>
                <span>{status.label}</span>
              </div>
              <div className="px-4 pb-4 pt-5" style={{ borderBottom: '1.5px solid var(--sf-ink)' }}>
                <p className="sf-price text-[2.375rem] md:text-[2.75rem]">{displayPrice}</p>
              </div>
              <dl>
                <div className="sf-sticker-row">
                  <dt>Stock #</dt>
                  <dd>{vehicle.stockNumber}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>VIN</dt>
                  <dd className="text-[var(--sf-text-xs)]">{vehicle.vin}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Mileage</dt>
                  <dd>{formatMileage(vehicle.mileage)}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Condition</dt>
                  <dd>{conditionLabel}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Color</dt>
                  <dd>{vehicle.color || 'Not listed'}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-5 space-y-2">
              <div className="sf-track sf-track-block">
                <button
                  ref={testDriveOpenerRef}
                  type="button"
                  onClick={() => openLead('test-drive', testDriveOpenerRef)}
                  className="sf-pill sf-pill-primary min-h-11 flex-auto px-3"
                >
                  Schedule test drive
                </button>
                <button
                  ref={quoteOpenerRef}
                  type="button"
                  onClick={() => openLead('get-quote', quoteOpenerRef)}
                  className="sf-pill sf-pill-raised min-h-11 flex-auto px-3"
                >
                  Get price quote
                </button>
              </div>
              <div className="sf-track sf-track-block hidden lg:flex">
                <button
                  ref={contactOpenerRef}
                  type="button"
                  onClick={() => openLead('contact', contactOpenerRef)}
                  className="sf-pill flex-auto px-3"
                >
                  Ask a question
                </button>
                <Link href={financingHref} className="sf-pill flex-auto px-3">Financing</Link>
                <Link href={tradeInHref} className="sf-pill flex-auto px-3">Trade-in</Link>
              </div>
            </div>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <section className="border-t pt-8" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="vdp-description">
              <h2 id="vdp-description" className="sf-heading text-[var(--sf-text-xl)]">Description</h2>
              {vehicle.description ? (
                <p className="sf-muted mt-4 max-w-[68ch] whitespace-pre-line text-[var(--sf-text-md)] leading-relaxed">
                  {vehicle.description}
                </p>
              ) : (
                <p className="sf-faint mt-4 text-[var(--sf-text-sm)]">No description listed.</p>
              )}
            </section>

            {Array.isArray(features) && features.length > 0 && (
              <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="vdp-features">
                <h2 id="vdp-features" className="sf-title-line sf-heading text-[var(--sf-text-xl)]">
                  Features
                  <span className="sf-chip sf-figure">{features.length}</span>
                </h2>
                <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                  {features.map((feature: unknown, index: number) => {
                    const name =
                      typeof feature === 'string' ? feature : (feature as { name?: string })?.name ?? 'Feature'
                    return (
                      <li
                        key={index}
                        className="flex items-start gap-3 border-b py-3 text-[var(--sf-text-sm)]"
                        style={{ borderColor: 'var(--sf-rule)' }}
                      >
                        <Check className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
                        <span className="min-w-0">{name}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className={compareCount > 0 ? 'h-40 lg:hidden' : 'h-20 lg:hidden'} aria-hidden="true" />
      </Container>

      <div
        className={`fixed inset-x-3 z-40 lg:hidden ${compareCount > 0 ? 'bottom-[7.25rem] md:bottom-[5.25rem]' : 'bottom-12'}`}
        role="region"
        aria-label="Vehicle actions"
      >
        <div
          className="mx-auto max-w-md rounded-[var(--sf-radius-lg)] p-1.5"
          style={{ background: 'var(--sf-paper)', boxShadow: 'var(--sf-shadow-float)' }}
        >
          <div className="sf-track sf-track-block">
            <button
              ref={barContactOpenerRef}
              type="button"
              onClick={() => openLead('contact', barContactOpenerRef)}
              className="sf-pill min-h-11 flex-auto px-2"
            >
              Ask
            </button>
            <button
              ref={barTestDriveOpenerRef}
              type="button"
              onClick={() => openLead('test-drive', barTestDriveOpenerRef)}
              className="sf-pill sf-pill-primary min-h-11 flex-auto px-2"
            >
              Test drive
            </button>
            <Link href={financingHref} className="sf-pill min-h-11 flex-auto px-2">Finance</Link>
            <Link href={tradeInHref} className="sf-pill min-h-11 flex-auto px-2">Trade-in</Link>
          </div>
        </div>
      </div>

      {intent && (
        <LeadCaptureModal
          vehicle={vehicle}
          intent={intent}
          onClose={closeLead}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          feedback={feedback}
          formData={formData}
          setFormData={setFormData}
          returnFocusTo={activeLeadOpenerRef.current?.current || null}
        />
      )}
    </>
  )
}

function VehicleDetailSkeleton() {
  return (
    <Container className="pb-[var(--sf-space-xl)] pt-[3.75rem] md:pt-[5.25rem]">
      <div
        className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16"
        aria-busy="true"
        aria-label="Loading vehicle"
      >
        <div className="min-w-0">
          <div className="sf-skeleton aspect-[4/3] rounded-[var(--sf-radius-md)] sm:aspect-[16/10] sm:rounded-[var(--sf-radius-lg)]" />
          <div className="mt-3 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sf-skeleton aspect-[4/3] w-20 shrink-0 sm:w-24" />
            ))}
          </div>
        </div>
        <div className="min-w-0" aria-hidden="true">
          <div className="sf-skeleton h-9 w-4/5" />
          <div className="sf-skeleton mt-3 h-5 w-1/3" />
          <div className="sf-skeleton mt-6 h-80 w-full" />
          <div className="sf-skeleton mt-5 h-12 w-full rounded-full" />
        </div>
      </div>
    </Container>
  )
}
