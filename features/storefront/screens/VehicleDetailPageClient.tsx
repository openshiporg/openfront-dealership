'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontInquiry, submitStorefrontTestDrive } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { LeadCaptureModal, LeadIntent, type LeadSubmissionFeedback } from '../components/LeadCaptureModal'
import { PhotoAttribution } from '../components/PhotoAttribution'
import { VehiclePhotoPlaceholder } from '../components/VehiclePhotoPlaceholder'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { formatMileage, formatPrice, vehicleTitle } from '../lib/format'
import { vehicleImageUrl } from '../lib/images'
import { customerRequestReference } from '../lib/customerRequests'
import { classifyVehicleDetailResponse, parseVehicleFeatures } from '../lib/data/vehicle-detail-response'

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
  const activeLeadOpenerRef = useRef<React.RefObject<HTMLButtonElement | null> | null>(null)

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
    return (
      <Container className="py-[var(--sf-space-3xl)]">
        <div className="sf-card aspect-[16/9] sf-skeleton" aria-busy="true" aria-label="Loading vehicle" />
      </Container>
    )
  }

  if (loadState.id === id && loadState.status === 'error') {
    return (
      <Container className="py-[var(--sf-space-3xl)] text-center">
        <div role="alert" aria-live="assertive">
          <h1 className="sf-display text-[length:var(--sf-text-xl)]">Vehicle details unavailable</h1>
          <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>
            We couldn&apos;t load this vehicle. Please try again.
          </p>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={retryVehicleLoad} className="sf-btn sf-btn-primary">
            Retry
          </button>
          <Button href="/inventory" variant="ghost">Back to inventory</Button>
        </div>
      </Container>
    )
  }

  if (loadState.id === id && loadState.status === 'not-found') {
    return (
      <Container className="py-[var(--sf-space-3xl)] text-center">
        <h1 className="sf-display text-[length:var(--sf-text-xl)]">Vehicle not found</h1>
        <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>
          This vehicle is no longer available.
        </p>
        <div className="mt-4">
          <Button href="/inventory">Back to inventory</Button>
        </div>
      </Container>
    )
  }

  if (!vehicle) {
    return (
      <Container className="py-[var(--sf-space-3xl)]">
        <div className="sf-card aspect-[16/9] sf-skeleton" aria-busy="true" aria-label="Loading vehicle" />
      </Container>
    )
  }

  const images = vehicle.images ?? []
  const currentImage = images[activeImageIndex]
  const currentImageUrl = vehicleImageUrl(currentImage)
  const features = parseVehicleFeatures(vehicle.features)
  const title = vehicleTitle(vehicle)
  const hasPublicPrice = typeof vehicle.price === 'number' && Number.isFinite(vehicle.price) && vehicle.price >= 0
  const displayPrice = hasPublicPrice ? formatPrice(vehicle.price, business.currencyCode) : 'Price unavailable'
  const financingHref = `/financing?vehicleId=${encodeURIComponent(vehicle.id)}${hasPublicPrice ? `&price=${encodeURIComponent(String(vehicle.price))}` : ''}`

  return (
    <>
      <div className="border-b" style={{ borderColor: 'var(--sf-rule)' }}>
        <Container className="py-3 text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-3)' }}>
          <Link href="/inventory" className="hover:text-[var(--sf-accent)]">
            Inventory
          </Link>
          <span className="mx-2">/</span>
          <span>{title}</span>
        </Container>
      </div>

      <Container className="py-[var(--sf-space-lg)]">
        <div className="grid lg:grid-cols-[1.4fr_0.85fr] gap-[var(--sf-space-lg)] items-start">
          <div className="min-w-0">
            <div className="sf-card overflow-hidden">
              <div className="relative aspect-[16/10] bg-[var(--sf-paper-2)]">
                {currentImageUrl ? (
                  <Image
                    src={currentImageUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 65vw"
                    priority
                    unoptimized
                  />
                ) : (
                  <VehiclePhotoPlaceholder />
                )}
              </div>
            </div>
            <PhotoAttribution src={currentImageUrl} className="mt-2" />

            {images.length > 1 && (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-3">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative aspect-square overflow-hidden border ${
                      index === activeImageIndex ? 'ring-2' : ''
                    }`}
                    style={{
                      borderColor: 'var(--sf-rule)',
                      outlineColor: 'var(--sf-accent)',
                    }}
                    aria-label={`View image ${index + 1}`}
                  >
                    {vehicleImageUrl(image) && (
                      <Image src={vehicleImageUrl(image)!} alt="" fill className="object-cover" sizes="80px" unoptimized />
                    )}
                  </button>
                ))}
              </div>
            )}

            <section className="mt-[var(--sf-space-xl)]">
              <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-4">Description</h2>
              {vehicle.description ? (
                <p className="text-[var(--sf-text-md)] leading-relaxed whitespace-pre-line" style={{ color: 'var(--sf-ink-2)' }}>
                  {vehicle.description}
                </p>
              ) : (
                <p className="text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-3)' }}>
                  No description on file for this vehicle.
                </p>
              )}

              {Array.isArray(features) && features.length > 0 && (
                <div className="mt-[var(--sf-space-lg)]">
                  <h3 className="font-semibold mb-3">Equipment</h3>
                  <ul className="grid sm:grid-cols-2 gap-2 text-[var(--sf-text-sm)]">
                    {features.map((feature: unknown, index: number) => {
                      const name =
                        typeof feature === 'string' ? feature : (feature as { name?: string })?.name ?? 'Feature'
                      return (
                        <li key={index} className="flex gap-2" style={{ color: 'var(--sf-ink-2)' }}>
                          <span style={{ color: 'var(--sf-accent)' }}>·</span>
                          {name}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 space-y-[var(--sf-space-md)]">
            <div className="sf-card p-[var(--sf-space-lg)]">
              <p className="sf-eyebrow mb-2 capitalize">
                {vehicle.condition} · {vehicle.status}
              </p>
              <h1 className="sf-display text-[length:var(--sf-text-2xl)]">{title}</h1>
              <p className="mt-4 sf-display text-[length:var(--sf-text-2xl)]" style={{ color: 'var(--sf-accent)' }}>
                {displayPrice}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-3 text-[var(--sf-text-sm)]">
                <div>
                  <dt className="sf-eyebrow mb-1">Mileage</dt>
                  <dd className="font-medium">{formatMileage(vehicle.mileage)}</dd>
                </div>
                <div>
                  <dt className="sf-eyebrow mb-1">Color</dt>
                  <dd className="font-medium">{vehicle.color}</dd>
                </div>
                <div>
                  <dt className="sf-eyebrow mb-1">Stock</dt>
                  <dd className="font-medium">{vehicle.stockNumber}</dd>
                </div>
                <div>
                  <dt className="sf-eyebrow mb-1">VIN</dt>
                  <dd className="font-medium text-[var(--sf-text-xs)] break-all">{vehicle.vin}</dd>
                </div>
              </dl>
            </div>

            <div className="sf-card p-[var(--sf-space-md)] space-y-2">
              <button ref={testDriveOpenerRef} type="button" onClick={() => openLead('test-drive', testDriveOpenerRef)} className="sf-btn sf-btn-primary w-full">
                Schedule test drive
              </button>
              <button ref={quoteOpenerRef} type="button" onClick={() => openLead('get-quote', quoteOpenerRef)} className="sf-btn sf-btn-secondary w-full">
                Get price quote
              </button>
              <button ref={contactOpenerRef} type="button" onClick={() => openLead('contact', contactOpenerRef)} className="sf-btn sf-btn-ghost w-full">
                Ask a question
              </button>
              <Button href={financingHref} variant="ghost" className="w-full">
                Apply for financing
              </Button>
              <Button href={`/trade-in?vehicleId=${vehicle.id}`} variant="ghost" className="w-full">
                Value your trade
              </Button>
            </div>
          </aside>
        </div>
      </Container>

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
