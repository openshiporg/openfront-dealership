'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { submitStorefrontService } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { formatServicePackagePrice } from '../lib/servicePackagePrice'
import { readServiceMenu, type ServiceMenuState } from '../lib/serviceMenuState'
import { customerRequestReference } from '../lib/customerRequests'
import { DEFAULT_SERVICE_SLOTS, dayAvailability, localDateString } from '../lib/bookingSlots'

const GET_SERVICE_PACKAGES = `
  query GetServicePackages {
    servicePackages(orderBy: { priceCents: asc }) {
      id
      name
      description
      price
      estimatedDuration
    }
  }
`

const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'brake_service', label: 'Brake Service' },
  { value: 'battery_service', label: 'Battery Service' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'tire_service', label: 'Tire Service' },
  { value: 'state_inspection', label: 'State Inspection' },
  { value: 'scheduled_maintenance', label: 'Scheduled Maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
]

const EMPTY = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  appointmentDate: '',
  appointmentTime: '',
  serviceType: '',
  vehicleYear: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleVin: '',
  description: '',
  website: '',
}

export function ServicePage() {
  const business = useStorefrontBusiness()
  const [formData, setFormData] = useState(EMPTY)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [requestReference, setRequestReference] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [serviceMenu, setServiceMenu] = useState<ServiceMenuState>({ kind: 'loading' })
  const [serviceMenuRequest, setServiceMenuRequest] = useState(0)

  useEffect(() => {
    let active = true
    void readServiceMenu(() => fetchGraphQL<unknown>(GET_SERVICE_PACKAGES))
      .then((result) => {
        if (active) setServiceMenu(result)
      })

    return () => {
      active = false
    }
  }, [serviceMenuRequest])

  const retryServiceMenu = () => {
    setServiceMenu({ kind: 'loading' })
    setServiceMenuRequest(request => request + 1)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'appointmentDate' ? { appointmentTime: '' } : {}),
    }))
  }

  const bookPackage = (name: string) => {
    setSelectedPackage(name)
    setFormData((prev) => ({ ...prev, serviceType: prev.serviceType || 'scheduled_maintenance' }))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setSubmitError(null)
    try {
      const result = await submitStorefrontService({
        ...formData,
        description: selectedPackage
          ? [`Service package: ${selectedPackage}`, formData.description].filter(Boolean).join('\n\n')
          : formData.description,
        vehicleYear: parseInt(formData.vehicleYear),
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setRequestReference(customerRequestReference('service', result.data.serviceAppointmentId))
      setSubmitStatus('success')
      setIdempotencyKey(crypto.randomUUID())
      setFormData(EMPTY)
      setSelectedPackage(null)
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : null)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const minDate = localDateString(new Date(), business.timezone)
  const availability = dayAvailability(business, formData.appointmentDate, DEFAULT_SERVICE_SLOTS)

  if (submitStatus === 'success') {
    return (
      <>
        <PageHeader eyebrow="Service" title="Request received" />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg text-center">
          <p className="text-[var(--sf-text-md)] mb-3" style={{ color: 'var(--sf-ink-2)' }}>
            The service team will contact you to confirm your appointment.
          </p>
          {requestReference && <p className="sf-eyebrow mb-6" role="status">Reference {requestReference}</p>}
          <Button href="/">Back to home</Button>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Service department"
      />

      <Container className="py-[var(--sf-space-2xl)]">
        <p className="sf-eyebrow mb-3">Service</p>
        <h2 className="sf-display text-[length:var(--sf-text-2xl)] mb-[var(--sf-space-lg)]">Service menu</h2>

        {serviceMenu.kind === 'loading' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--sf-space-md)]" aria-label="Loading service menu">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="sf-card h-40 sf-skeleton" aria-hidden />
            ))}
          </div>
        ) : serviceMenu.kind === 'ready' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--sf-space-md)]">
            {serviceMenu.packages.map((pkg) => (
              <article key={pkg.id} className="sf-card p-[var(--sf-space-lg)] flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-[var(--sf-text-md)]">{pkg.name}</h3>
                  <span className="sf-display text-[length:var(--sf-text-lg)] shrink-0" style={{ color: 'var(--sf-accent)' }}>
                    {formatServicePackagePrice(pkg.price, business.currencyCode) ?? 'Price unavailable'}
                  </span>
                </div>
                {pkg.description && (
                  <p className="text-[var(--sf-text-sm)] leading-relaxed" style={{ color: 'var(--sf-ink-2)' }}>
                    {pkg.description}
                  </p>
                )}
                {Number(pkg.estimatedDuration) > 0 && (
                  <p className="text-[var(--sf-text-xs)] mt-auto" style={{ color: 'var(--sf-ink-3)' }}>
                    Est. {Math.floor(Number(pkg.estimatedDuration) / 60) > 0 ? `${Math.floor(Number(pkg.estimatedDuration) / 60)}h ` : ''}{Number(pkg.estimatedDuration) % 60 > 0 ? `${Number(pkg.estimatedDuration) % 60}m` : ''}
                  </p>
                )}
                <button type="button" onClick={() => bookPackage(pkg.name)} className="sf-btn sf-btn-ghost text-sm mt-auto self-start" aria-pressed={selectedPackage === pkg.name}>
                  {selectedPackage === pkg.name ? 'Selected' : 'Book this service'}
                </button>
              </article>
            ))}
          </div>
        ) : serviceMenu.kind === 'empty' ? (
          <p className="text-[var(--sf-text-sm)]" role="status" style={{ color: 'var(--sf-ink-3)' }}>
            No service packages are currently listed.
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 text-[var(--sf-text-sm)]" role="status" style={{ color: 'var(--sf-ink-3)' }}>
            <p>
              Service menu unavailable.
              {business.serviceEmail ? (
                <> For current availability, email <a href={`mailto:${business.serviceEmail}`} className="underline hover:text-[var(--sf-accent)]">{business.serviceEmail}</a>.</>
              ) : null}
            </p>
            <Button variant="secondary" onClick={retryServiceMenu}>Retry service menu</Button>
          </div>
        )}
      </Container>

      <Container className="py-[var(--sf-space-2xl)] max-w-2xl">
        <div ref={formRef} className="sf-card p-[var(--sf-space-lg)] scroll-mt-28">
          <h2 className="sf-display text-[length:var(--sf-text-2xl)] mb-6">Request a service appointment</h2>
          {selectedPackage && (
            <p role="status" className="mb-6 flex flex-wrap items-center gap-3 text-[var(--sf-text-sm)]">
              <span>Package: <strong>{selectedPackage}</strong></span>
              <button type="button" onClick={() => setSelectedPackage(null)} className="underline underline-offset-2">Remove</button>
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-[var(--sf-space-lg)]">
            <section className="space-y-4">
              <h3 className="sf-eyebrow">Contact information</h3>
              <Field label="Full name" htmlFor="customerName">
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={handleChange}
                  className="sf-input"
                  autoComplete="name"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email" htmlFor="customerEmail">
                  <input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    required
                    value={formData.customerEmail}
                    onChange={handleChange}
                    className="sf-input"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Phone" htmlFor="customerPhone">
                  <input
                    id="customerPhone"
                    name="customerPhone"
                    type="tel"
                    required
                    value={formData.customerPhone}
                    onChange={handleChange}
                    className="sf-input"
                    autoComplete="tel"
                  />
                </Field>
              </div>
            </section>

            <hr className="sf-rule" />

            <section className="space-y-4">
              <h3 className="sf-eyebrow">Appointment details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Preferred date" htmlFor="appointmentDate">
                  <input
                    id="appointmentDate"
                    name="appointmentDate"
                    type="date"
                    required
                    min={minDate}
                    value={formData.appointmentDate}
                    onChange={handleChange}
                    className="sf-input"
                  />
                  {availability.status === 'closed' && (
                    <p role="alert" className="mt-2 text-[var(--sf-text-xs)]">We&apos;re closed on this day. Choose another date.</p>
                  )}
                </Field>
                <Field label="Preferred time" htmlFor="appointmentTime">
                  <select
                    id="appointmentTime"
                    name="appointmentTime"
                    required
                    value={formData.appointmentTime}
                    onChange={handleChange}
                    className="sf-input"
                  >
                    <option value="">Select a time</option>
                    {availability.status === 'open' && availability.slots.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Requested service type" htmlFor="serviceType">
                <select
                  id="serviceType"
                  name="serviceType"
                  required
                  value={formData.serviceType}
                  onChange={handleChange}
                  className="sf-input"
                >
                  <option value="">Select service type</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </section>

            <hr className="sf-rule" />

            <section className="space-y-4">
              <h3 className="sf-eyebrow">Vehicle information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Year" htmlFor="vehicleYear">
                  <input
                    id="vehicleYear"
                    name="vehicleYear"
                    type="number"
                    required
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={formData.vehicleYear}
                    onChange={handleChange}
                    className="sf-input"
                    placeholder="2020"
                  />
                </Field>
                <Field label="Make" htmlFor="vehicleMake">
                  <input
                    id="vehicleMake"
                    name="vehicleMake"
                    type="text"
                    required
                    value={formData.vehicleMake}
                    onChange={handleChange}
                    className="sf-input"
                    placeholder="Toyota"
                  />
                </Field>
                <Field label="Model" htmlFor="vehicleModel">
                  <input
                    id="vehicleModel"
                    name="vehicleModel"
                    type="text"
                    required
                    value={formData.vehicleModel}
                    onChange={handleChange}
                    className="sf-input"
                    placeholder="Camry"
                  />
                </Field>
                <Field label="VIN (optional)" htmlFor="vehicleVin">
                  <input
                    id="vehicleVin"
                    name="vehicleVin"
                    type="text"
                    maxLength={17}
                    value={formData.vehicleVin}
                    onChange={handleChange}
                    className="sf-input"
                    placeholder="1HGBH41JXMN109186"
                  />
                </Field>
              </div>
            </section>

            <Field label="Describe your service needs" htmlFor="description">
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="sf-input resize-y"
                placeholder="Please describe what service you need or any issues you're experiencing…"
              />
            </Field>

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
                {submitError || 'There was an error submitting your service request.'} Please try again
                {business.serviceEmail ? (
                  <> or email <a href={`mailto:${business.serviceEmail}`} className="underline">{business.serviceEmail}</a></>
                ) : null}.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={isSubmitting || availability.status === 'closed'} className="sf-btn sf-btn-primary flex-1">
                {isSubmitting ? 'Sending…' : 'Send service request'}
              </button>
              <Button href="/" variant="ghost" className="flex-1 sm:flex-none">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Container>
    </>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="sf-eyebrow block mb-2">{label}</label>
      {children}
    </div>
  )
}
