'use client'

import { useState } from 'react'
import Link from 'next/link'
import { submitStorefrontInquiry } from '../actions/submissions'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { customerRequestReference } from '../lib/customerRequests'

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

  if (submitted) {
    return (
      <>
        <PageHeader title="Message received" description={`${business.fullName} will respond using your preferred contact method.`} />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg text-center">
          {submissionReference && <p className="sf-eyebrow mb-6" role="status">Reference {submissionReference}</p>}
          <Button href="/">Back home</Button>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to our team"
        description="Questions about a vehicle, financing, or service? Send a message and we'll follow up."
      />

      <Container className="py-[var(--sf-space-2xl)]">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-[var(--sf-space-xl)]">
          <form onSubmit={handleSubmit} className="sf-card p-[var(--sf-space-lg)] space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="contact-first-name" className="sf-eyebrow block mb-2">First name</label>
                <input
                  id="contact-first-name"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                  className="sf-input"
                />
              </div>
              <div>
                <label htmlFor="contact-last-name" className="sf-eyebrow block mb-2">Last name</label>
                <input
                  id="contact-last-name"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                  className="sf-input"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-email" className="sf-eyebrow block mb-2">Email</label>
              <input
                id="contact-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="sf-input"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="sf-eyebrow block mb-2">Phone</label>
              <input
                id="contact-phone"
                type="tel"
                required={formData.preferredContact !== 'email'}
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                className="sf-input"
              />
            </div>
            <div>
              <label htmlFor="contact-preferred" className="sf-eyebrow block mb-2">Preferred contact</label>
              <select
                id="contact-preferred"
                value={formData.preferredContact}
                onChange={(e) => setFormData((p) => ({ ...p, preferredContact: e.target.value }))}
                className="sf-input"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div>
              <label htmlFor="contact-message" className="sf-eyebrow block mb-2">Message</label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                className="sf-input resize-y"
                placeholder="How can we help?"
              />
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
            {submissionError && (
              <p role="alert" className="text-[var(--sf-text-sm)]" style={{ color: 'oklch(0.45 0.15 25)' }}>
                {submissionError}
              </p>
            )}
            <button type="submit" disabled={isSubmitting} className="sf-btn sf-btn-primary w-full">
              {isSubmitting ? 'Sending…' : 'Send message'}
            </button>
          </form>

          <aside className="space-y-[var(--sf-space-md)]">
            <div className="sf-card p-[var(--sf-space-lg)] text-[var(--sf-text-sm)]">
              <p className="sf-eyebrow mb-3">Reach us</p>
              {(business.addressLine1 || business.addressLine2) && (
                <address className="not-italic">
                  {business.addressLine1 && <p className="font-medium">{business.addressLine1}</p>}
                  {business.addressLine2 && <p style={{ color: 'var(--sf-ink-2)' }}>{business.addressLine2}</p>}
                </address>
              )}
              {(business.addressLine1 || business.addressLine2) && (
                <p className="mt-3">
                  <a href={business.directionsHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2 hover:text-[var(--sf-accent)]">
                    Get directions
                  </a>
                </p>
              )}
              {(business.addressLine1 || business.addressLine2) && <hr className="sf-rule my-4" />}
              {business.phoneHref && business.phoneDisplay && (
                <p>
                  <a href={business.phoneHref} className="hover:text-[var(--sf-accent)]">
                    {business.phoneDisplay}
                  </a>
                </p>
              )}
              {business.salesEmail && (
                <p className={business.phoneDisplay ? 'mt-2' : ''}>
                  <a href={`mailto:${business.salesEmail}`} className="break-all hover:text-[var(--sf-accent)]">
                    {business.salesEmail}
                  </a>
                </p>
              )}
              {!business.addressLine1 && !business.addressLine2 && !business.phoneDisplay && !business.salesEmail ? (
                <p style={{ color: 'var(--sf-ink-2)' }}>Contact details have not been published.</p>
              ) : null}
            </div>

            <div className="sf-card p-[var(--sf-space-lg)] text-[var(--sf-text-sm)]">
              <p className="sf-eyebrow mb-3">Departments</p>
              {business.salesEmail || business.serviceEmail ? (
                <ul className="space-y-3" style={{ color: 'var(--sf-ink-2)' }}>
                  {business.salesEmail && (
                    <li>
                      Sales ·{' '}
                      <a href={`mailto:${business.salesEmail}`} className="break-all hover:text-[var(--sf-accent)]">
                        {business.salesEmail}
                      </a>
                    </li>
                  )}
                  {business.serviceEmail && (
                    <li>
                      Service ·{' '}
                      <a href={`mailto:${business.serviceEmail}`} className="break-all hover:text-[var(--sf-accent)]">
                        {business.serviceEmail}
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p style={{ color: 'var(--sf-ink-2)' }}>Department emails have not been published.</p>
              )}
            </div>

            <p className="text-[var(--sf-text-xs)]" style={{ color: 'var(--sf-ink-3)' }}>
              Prefer to browse first?{' '}
              <Link href="/inventory" className="underline underline-offset-2 hover:text-[var(--sf-accent)]">
                View inventory
              </Link>
            </p>
          </aside>
        </div>
      </Container>
    </>
  )
}
