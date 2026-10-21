'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontTestDrive } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { vehicleTitle } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { customerRequestReference } from '../lib/customerRequests'
import { DEFAULT_TEST_DRIVE_SLOTS, dayAvailability, localDateString } from '../lib/bookingSlots'
import { VehiclePhotoPlaceholder } from '../components/VehiclePhotoPlaceholder'

export function TestDrivePage() {
  const business = useStorefrontBusiness()
  const searchParams = useSearchParams()
  const vehicleId = searchParams?.get('vehicleId')

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    preferredDate: '',
    preferredTime: '',
    vehicleId: vehicleId || '',
    message: '',
    website: '',
  })
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [requestReference, setRequestReference] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

  useEffect(() => {
    if (!vehicleId) {
      setSelectedVehicle(null)
      return
    }

    setFormData((prev) => ({ ...prev, vehicleId }))
    void fetchGraphQL<{ publicInventoryVehicle: Vehicle | null }>(GET_VEHICLE_BY_ID, { id: vehicleId })
      .then((data) => setSelectedVehicle(data.publicInventoryVehicle ?? null))
      .catch(() => setSelectedVehicle(null))
  }, [vehicleId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value, ...(name === 'preferredDate' ? { preferredTime: '' } : {}) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setSubmitError(null)
    try {
      const result = await submitStorefrontTestDrive({
        ...formData,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setRequestReference(customerRequestReference('test-drive', result.data.testDriveId))
      setSubmitStatus('success')
      setIdempotencyKey(crypto.randomUUID())
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        preferredDate: '',
        preferredTime: '',
        vehicleId: '',
        message: '',
        website: '',
      })
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : null)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const minDate = localDateString(new Date(), business.timezone)
  const availability = dayAvailability(business, formData.preferredDate, DEFAULT_TEST_DRIVE_SLOTS)

  if (submitStatus === 'success') {
    const selectedVehicleTitle = selectedVehicle ? vehicleTitle(selectedVehicle) : null

    return (
      <>
        <PageHeader
          title="Request received"
          description={`We'll contact you to confirm your test drive${selectedVehicleTitle ? ` of the ${selectedVehicleTitle}` : ''}.`}
        />
        <Container className="py-[var(--sf-space-2xl)]">
          {requestReference && <p className="sf-eyebrow mb-6" role="status">Reference {requestReference}</p>}
          <Button href={selectedVehicle ? `/inventory/${selectedVehicle.id}` : '/inventory'}>
            {selectedVehicle ? 'Return to vehicle' : 'Browse inventory'}
          </Button>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Test drive"
        title="Request test drive"
      />

      <Container className="py-[var(--sf-space-2xl)] max-w-2xl">
        {selectedVehicle && (
          <div className="sf-card mb-[var(--sf-space-md)] flex items-center gap-4 overflow-hidden p-3">
            <div className="relative h-24 w-32 shrink-0 overflow-hidden bg-[var(--sf-paper-2)]">
              {vehicleImageUrl(primaryVehicleImage(selectedVehicle.images)) ? (
                <Image
                  src={vehicleImageUrl(primaryVehicleImage(selectedVehicle.images))!}
                  alt={vehicleTitle(selectedVehicle)}
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
              <p className="sf-eyebrow mb-1">Selected vehicle</p>
              <p className="font-semibold">{vehicleTitle(selectedVehicle)}</p>
              <p className="mt-1 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">
                Stock {selectedVehicle.stockNumber}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="sf-card p-[var(--sf-space-lg)] space-y-5">
          <div>
            <label htmlFor="customerName" className="sf-eyebrow block mb-2">
              Full name
            </label>
            <input
              id="customerName"
              name="customerName"
              type="text"
              required
              value={formData.customerName}
              onChange={handleChange}
              className="sf-input"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="customerEmail" className="sf-eyebrow block mb-2">
                Email
              </label>
              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                value={formData.customerEmail}
                onChange={handleChange}
                className="sf-input"
              />
            </div>
            <div>
              <label htmlFor="customerPhone" className="sf-eyebrow block mb-2">
                Phone
              </label>
              <input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                required
                value={formData.customerPhone}
                onChange={handleChange}
                className="sf-input"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="preferredDate" className="sf-eyebrow block mb-2">
                Preferred date
              </label>
              <input
                id="preferredDate"
                name="preferredDate"
                type="date"
                required
                min={minDate}
                value={formData.preferredDate}
                onChange={handleChange}
                className="sf-input"
              />
              {availability.status === 'closed' && (
                <p role="alert" className="mt-2 text-[var(--sf-text-xs)]">We&apos;re closed on this day. Choose another date.</p>
              )}
            </div>
            <div>
              <label htmlFor="preferredTime" className="sf-eyebrow block mb-2">
                Preferred time
              </label>
              <select
                id="preferredTime"
                name="preferredTime"
                required
                value={formData.preferredTime}
                onChange={handleChange}
                className="sf-input"
              >
                <option value="">Select</option>
                {availability.status === 'open' && availability.slots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {vehicleId && <input type="hidden" name="vehicleId" value={formData.vehicleId} />}

          <div>
            <label htmlFor="message" className="sf-eyebrow block mb-2">
              Notes
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              value={formData.message}
              onChange={handleChange}
              className="sf-input resize-y"
              placeholder="Vehicle of interest or special requests"
            />
          </div>

          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {submitStatus === 'error' && (
            <p className="text-[var(--sf-text-sm)]" role="alert" style={{ color: 'oklch(0.45 0.15 25)' }}>
              {submitError || 'We couldn’t send your request.'}{' '}
              {business.phoneHref && business.phoneDisplay ? (
                <>
                  Call <a href={business.phoneHref} className="underline">{business.phoneDisplay}</a> to schedule directly.
                </>
              ) : business.salesEmail ? (
                <>Please try again or email <a href={`mailto:${business.salesEmail}`} className="underline">{business.salesEmail}</a>.</>
              ) : (
                <>Please try again later.</>
              )}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={isSubmitting || availability.status === 'closed'} className="sf-btn sf-btn-primary flex-1">
              {isSubmitting ? 'Sending…' : 'Request test drive'}
            </button>
            <Button href="/inventory" variant="ghost" className="flex-1 sm:flex-none">
              Cancel
            </Button>
          </div>
        </form>
      </Container>
    </>
  )
}
