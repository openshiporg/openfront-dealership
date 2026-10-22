'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Container } from './Container'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

export function HomeContactPanel() {
  const business = useStorefrontBusiness()
  const hours = [
    { label: 'Mon–Fri', value: business.hoursMonFri },
    { label: 'Saturday', value: business.hoursSaturday },
    { label: 'Sunday', value: business.hoursSunday },
  ].filter((row) => row.value)
  const hasLocation = business.addressLine1 || business.addressLine2

  return (
    <section className="sf-section" style={{ background: 'var(--sf-paper-2)' }}>
      <Container className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="sf-eyebrow">Visit</p>
          <h2 className="sf-display mt-3 text-[length:var(--sf-text-2xl)]">
            {hasLocation ? business.addressLine1 || business.addressLine2 : business.fullName}
          </h2>
          {business.addressLine1 && business.addressLine2 && (
            <p className="sf-muted mt-2 text-[var(--sf-text-md)]">{business.addressLine2}</p>
          )}
          <div className="sf-track mt-6">
            {business.directionsHref && (
              <a href={business.directionsHref} target="_blank" rel="noreferrer" className="sf-pill sf-pill-raised">
                Directions
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            )}
            <Link href="/contact" className="sf-pill">Message us</Link>
          </div>
        </div>

        <div className="min-w-0">
          <p className="sf-eyebrow mb-3">Hours</p>
          {hours.length > 0 ? (
            <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
              {hours.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 border-b py-2.5 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
                  <dt className="sf-muted">{row.label}</dt>
                  <dd className="sf-figure text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="sf-muted text-[var(--sf-text-sm)]">Hours not listed</p>
          )}
        </div>

        <div className="min-w-0">
          <p className="sf-eyebrow mb-3">Sales</p>
          <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
            {business.phoneHref && business.phoneDisplay && (
              <div className="flex items-baseline justify-between gap-4 border-b py-2.5 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
                <dt className="sf-muted">Phone</dt>
                <dd><a href={business.phoneHref} className="sf-figure sf-link">{business.phoneDisplay}</a></dd>
              </div>
            )}
            {business.salesEmail && (
              <div className="flex items-baseline justify-between gap-4 border-b py-2.5 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
                <dt className="sf-muted">Email</dt>
                <dd className="min-w-0 text-right"><a href={`mailto:${business.salesEmail}`} className="sf-link break-all">{business.salesEmail}</a></dd>
              </div>
            )}
            {business.serviceEmail && (
              <div className="flex items-baseline justify-between gap-4 border-b py-2.5 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
                <dt className="sf-muted">Service</dt>
                <dd className="min-w-0 text-right"><a href={`mailto:${business.serviceEmail}`} className="sf-link break-all">{business.serviceEmail}</a></dd>
              </div>
            )}
          </dl>
        </div>
      </Container>
    </section>
  )
}
