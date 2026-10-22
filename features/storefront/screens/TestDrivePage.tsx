'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontTestDrive } from '../actions/submissions'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { customerRequestReference } from '../lib/customerRequests'
import { DEFAULT_TEST_DRIVE_SLOTS, dayAvailability, localDateString } from '../lib/bookingSlots'
import {
  Field,
  FormSection,
  MobileSummary,
  Notice,
  PILL_TARGET,
  RadioPills,
  RequestLayout,
  RequestReceived,
  Sticker,
  StickerVehicle,
  formatRequestDate,
} from '../components/forms/RequestForm'

type TestDriveSummary = { name: string; email: string; phone: string; date: string; time: string }

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
  const [submittedSummary, setSubmittedSummary] = useState<TestDriveSummary | null>(null)

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
      setSubmittedSummary({
        name: formData.customerName,
        email: formData.customerEmail,
        phone: formData.customerPhone,
        date: formData.preferredDate,
        time: formData.preferredTime,
      })
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
    return (
      <RequestReceived
        eyebrow="Test drive"
        reference={requestReference}
        summary={
          <Sticker
            title="Test drive"
            meta={business.shortName || business.fullName}
            rows={[
              { label: 'Date', value: submittedSummary ? formatRequestDate(submittedSummary.date) : null },
              { label: 'Time', value: submittedSummary?.time },
              { label: 'Name', value: submittedSummary?.name },
              { label: 'Email', value: submittedSummary?.email },
              { label: 'Phone', value: submittedSummary?.phone },
            ]}
          >
            {selectedVehicle && <StickerVehicle vehicle={selectedVehicle} label="Vehicle" />}
          </Sticker>
        }
        actions={
          <>
            <Link
              href={selectedVehicle ? `/inventory/${selectedVehicle.id}` : '/inventory'}
              className={`sf-pill sf-pill-primary ${PILL_TARGET}`}
            >
              {selectedVehicle ? 'Return to vehicle' : 'Browse inventory'}
            </Link>
            <Link href="/financing" className={`sf-pill ${PILL_TARGET}`}>Financing</Link>
            <Link href="/trade-in" className={`sf-pill ${PILL_TARGET}`}>Trade-in</Link>
          </>
        }
      />
    )
  }

  const summary = (
    <Sticker
      title="Test drive"
      meta={business.shortName || business.fullName}
      rows={[
        { label: 'Date', value: formData.preferredDate ? formatRequestDate(formData.preferredDate) : null },
        { label: 'Time', value: formData.preferredTime, strong: true },
        { label: 'Name', value: formData.customerName },
      ]}
    >
      {selectedVehicle ? (
        <StickerVehicle vehicle={selectedVehicle} label="Vehicle" />
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-dashed px-4 py-3" style={{ borderColor: 'var(--sf-rule)' }}>
          <span className="sf-eyebrow">Vehicle</span>
          <Link href="/inventory" className="sf-link text-[var(--sf-text-sm)]">Choose from inventory</Link>
        </div>
      )}
    </Sticker>
  )

  return (
    <>
      <PageHeader eyebrow="Test drive" title="Book a test drive" />

      <RequestLayout summary={summary}>
        <form onSubmit={handleSubmit} className="space-y-[var(--sf-space-xl)]">
          <FormSection step="01" title="Date and time" first>
            <div className="space-y-5">
              <Field label="Date" htmlFor="preferredDate" className="sm:max-w-xs">
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
              </Field>

              {availability.status === 'closed' ? (
                <div className="sf-well p-4">
                  <p role="alert" className="sf-title-line text-[var(--sf-text-sm)]">
                    <span className="sf-dot" data-tone="bad" aria-hidden="true" />
                    <span>Closed on this day. Choose another date.</span>
                  </p>
                </div>
              ) : (
                <RadioPills
                  legend="Time"
                  name="preferredTime"
                  required
                  variant="grid"
                  className="grid-cols-3 sm:grid-cols-4 xl:grid-cols-5"
                  value={formData.preferredTime}
                  onChange={handleChange}
                  options={availability.slots.map((slot) => ({
                    value: slot,
                    label: <span className="sf-figure">{slot}</span>,
                  }))}
                />
              )}
            </div>
          </FormSection>

          {vehicleId && <input type="hidden" name="vehicleId" value={formData.vehicleId} />}

          <FormSection step="02" title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="customerName" className="sm:col-span-2">
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  required
                  autoComplete="name"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Email" htmlFor="customerEmail">
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.customerEmail}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Phone" htmlFor="customerPhone">
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Notes" htmlFor="message" optional className="sm:col-span-2">
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  value={formData.message}
                  onChange={handleChange}
                  className="sf-input"
                  placeholder="Vehicle of interest"
                />
              </Field>
            </div>
          </FormSection>

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

          <div className="space-y-4">
            <MobileSummary>{summary}</MobileSummary>

            {submitStatus === 'error' && (
              <Notice tone="bad">
                {submitError || 'We couldn’t send your request.'}{' '}
                {business.phoneHref && business.phoneDisplay ? (
                  <>
                    Call <a href={business.phoneHref} className="sf-link sf-figure">{business.phoneDisplay}</a> to schedule directly.
                  </>
                ) : business.salesEmail ? (
                  <>Please try again or email <a href={`mailto:${business.salesEmail}`} className="sf-link break-all">{business.salesEmail}</a>.</>
                ) : (
                  <>Please try again later.</>
                )}
              </Notice>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isSubmitting || availability.status === 'closed'}
                className="sf-btn sf-btn-primary w-full sm:w-auto sm:min-w-56"
              >
                {isSubmitting ? 'Sending…' : 'Request test drive'}
              </button>
              <Link href="/inventory" className="sf-btn sf-btn-ghost w-full sm:w-auto">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </RequestLayout>
    </>
  )
}
