'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { submitStorefrontInquiry } from '../actions/submissions'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { customerRequestReference } from '../lib/customerRequests'
import { Field, Notice, PILL_TARGET, RequestReceived, Sticker } from '../components/forms/RequestForm'

const PREFERRED_CONTACT = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text' },
]

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
      <dt className="sf-muted shrink-0">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

export function ContactPage() {
  const business = useStorefrontBusiness()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredContact: 'email',
    message: '',
    website: '',
  })
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [submitted, setSubmitted] = useState(false)
  const [submissionReference, setSubmissionReference] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmissionError(null)
    try {
      const result = await submitStorefrontInquiry({
        ...formData,
        intent: 'general-contact',
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setSubmissionReference(customerRequestReference('inquiry', result.data.leadId))
      setSubmitted(true)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'There was an error submitting your message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const preferredLabel = PREFERRED_CONTACT.find((option) => option.value === formData.preferredContact)?.label

  if (submitted) {
    return (
      <RequestReceived
        eyebrow="Message"
        reference={submissionReference}
        summary={
          <Sticker
            title="Message"
            meta={business.shortName || business.fullName}
            rows={[
              { label: 'Name', value: [formData.firstName, formData.lastName].filter(Boolean).join(' ') },
              { label: 'Reply by', value: preferredLabel, strong: true },
              { label: 'Email', value: formData.email },
              ...(formData.phone ? [{ label: 'Phone', value: formData.phone }] : []),
            ]}
          />
        }
        actions={
          <>
            <Link href="/" className={`sf-pill sf-pill-primary ${PILL_TARGET}`}>Back home</Link>
            <Link href="/inventory" className={`sf-pill ${PILL_TARGET}`}>Inventory</Link>
            <Link href="/service" className={`sf-pill ${PILL_TARGET}`}>Service</Link>
          </>
        }
      />
    )
  }

  const hasAddress = Boolean(business.addressLine1 || business.addressLine2)
  const hours = [
    { label: 'Mon–Fri', value: business.hoursMonFri },
    { label: 'Saturday', value: business.hoursSaturday },
    { label: 'Sunday', value: business.hoursSunday },
  ].filter((row) => row.value)
  const departments = [
    business.salesEmail ? { label: 'Sales', email: business.salesEmail } : null,
    business.serviceEmail ? { label: 'Service', email: business.serviceEmail } : null,
  ].filter((row): row is { label: string; email: string } => Boolean(row))

  return (
    <>
      <PageHeader eyebrow="Contact" title={business.fullName} />

      <Container className="sf-section">
        <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:gap-[var(--sf-space-2xl)]">
          <aside className="order-2 min-w-0 space-y-[var(--sf-space-lg)] lg:order-1">
            <section>
              <p className="sf-eyebrow mb-3">Visit</p>
              {hasAddress ? (
                <>
                  <address className="not-italic">
                    {business.addressLine1 && <p className="sf-heading text-[length:var(--sf-text-xl)]">{business.addressLine1}</p>}
                    {business.addressLine2 && <p className="sf-muted mt-1">{business.addressLine2}</p>}
                  </address>
                  {business.directionsHref && (
                    <div className="sf-track mt-4">
                      <a href={business.directionsHref} target="_blank" rel="noopener noreferrer" className={`sf-pill sf-pill-raised ${PILL_TARGET}`}>
                        Directions
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </a>
                      {business.phoneHref && business.phoneDisplay && (
                        <a href={business.phoneHref} className={`sf-pill ${PILL_TARGET}`}>Call</a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="sf-muted text-[var(--sf-text-sm)]">Address not listed</p>
              )}
            </section>

            <section>
              <p className="sf-eyebrow mb-3">Departments</p>
              {business.phoneDisplay || departments.length ? (
                <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                  {business.phoneHref && business.phoneDisplay && (
                    <InfoRow label="Phone">
                      <a href={business.phoneHref} className="sf-link sf-figure">{business.phoneDisplay}</a>
                    </InfoRow>
                  )}
                  {departments.map((row) => (
                    <InfoRow key={row.label} label={row.label}>
                      <a href={`mailto:${row.email}`} className="sf-link break-all">{row.email}</a>
                    </InfoRow>
                  ))}
                </dl>
              ) : (
                <p className="sf-muted text-[var(--sf-text-sm)]">Contact details not listed</p>
              )}
            </section>

            <section>
              <p className="sf-eyebrow mb-3">Hours</p>
              {hours.length ? (
                <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                  {hours.map((row) => (
                    <InfoRow key={row.label} label={row.label}>
                      <span className="sf-figure">{row.value}</span>
                    </InfoRow>
                  ))}
                </dl>
              ) : (
                <p className="sf-muted text-[var(--sf-text-sm)]">Hours not listed</p>
              )}
            </section>
          </aside>

          <form onSubmit={handleSubmit} className="order-1 min-w-0 lg:order-2 lg:border-l lg:pl-[var(--sf-space-xl)]" style={{ borderColor: 'var(--sf-rule)' }}>
            <h2 className="sf-heading mb-5 text-[length:var(--sf-text-xl)]">Message</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="contact-first-name">
                <input
                  id="contact-first-name"
                  type="text"
                  required
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Last name" htmlFor="contact-last-name">
                <input
                  id="contact-last-name"
                  type="text"
                  required
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <input
                  id="contact-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Phone" htmlFor="contact-phone" optional={formData.preferredContact === 'email'}>
                <input
                  id="contact-phone"
                  type="tel"
                  autoComplete="tel"
                  required={formData.preferredContact !== 'email'}
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <div className="sm:col-span-2">
                <p id="contact-preferred" className="sf-label">Preferred contact</p>
                <div role="group" aria-labelledby="contact-preferred" className="sf-track">
                  {PREFERRED_CONTACT.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`sf-pill ${PILL_TARGET} px-5`}
                      aria-pressed={formData.preferredContact === option.value}
                      onClick={() => setFormData((p) => ({ ...p, preferredContact: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Message" htmlFor="contact-message" className="sm:col-span-2">
                <textarea
                  id="contact-message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  className="sf-input"
                />
              </Field>
            </div>
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
            <div className="mt-6 space-y-4">
              {submissionError && <Notice tone="bad">{submissionError}</Notice>}
              <button type="submit" disabled={isSubmitting} className="sf-btn sf-btn-primary w-full sm:w-auto sm:min-w-56">
                {isSubmitting ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>
      </Container>
    </>
  )
}
