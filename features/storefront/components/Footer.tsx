'use client'

import Link from 'next/link'
import { Container } from './Container'
import { StoreLogo } from '@/features/platform/store-settings/components/StoreLogo'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

const LINKS = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/financing', label: 'Financing' },
  { href: '/trade-in', label: 'Trade-in' },
  { href: '/test-drive', label: 'Test drive' },
  { href: '/service', label: 'Service' },
  { href: '/contact', label: 'Contact' },
  { href: '/account', label: 'Account' },
]

export function Footer() {
  const year = new Date().getFullYear()
  const business = useStorefrontBusiness()
  const hasHours = business.hoursMonFri || business.hoursSaturday || business.hoursSunday
  const hasVisitDetails = business.addressLine1 || business.addressLine2 || business.phoneDisplay || business.salesEmail

  return (
    <footer style={{ background: 'var(--sf-paper-3)', color: 'oklch(0.88 0.02 85)' }}>
      <Container className="py-[var(--sf-space-2xl)]">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-[var(--sf-space-xl)]">
          <div>
            <p className="sf-display flex items-center gap-3 text-[length:var(--sf-text-2xl)] mb-[var(--sf-space-sm)]">
              <StoreLogo svg={business.logoIcon} color={business.logoColor} />
              {business.fullName}
            </p>
          </div>

          <div>
            <p className="sf-eyebrow mb-[var(--sf-space-sm)]">Hours</p>
            {hasHours ? (
              <ul className="space-y-1 text-[var(--sf-text-sm)] opacity-90">
                {business.hoursMonFri && <li>{business.hoursMonFri}</li>}
                {business.hoursSaturday && <li>{business.hoursSaturday}</li>}
                {business.hoursSunday && <li>{business.hoursSunday}</li>}
              </ul>
            ) : (
              <p className="text-[var(--sf-text-sm)] opacity-75">Contact us for today’s hours.</p>
            )}
          </div>

          {hasVisitDetails && (
            <div>
              <p className="sf-eyebrow mb-[var(--sf-space-sm)]">Contact</p>
              <address className="not-italic text-[var(--sf-text-sm)] opacity-90 space-y-1">
                {business.addressLine1 && <div>{business.addressLine1}</div>}
                {business.addressLine2 && <div>{business.addressLine2}</div>}
                {business.phoneHref && business.phoneDisplay && (
                  <div>
                    <a href={business.phoneHref} className="hover:opacity-100 opacity-90 underline-offset-2 hover:underline">
                      {business.phoneDisplay}
                    </a>
                  </div>
                )}
                {business.salesEmail && (
                  <div>
                    <a href={`mailto:${business.salesEmail}`} className="hover:opacity-100 opacity-90 underline-offset-2 hover:underline break-all">
                      {business.salesEmail}
                    </a>
                  </div>
                )}
              </address>
            </div>
          )}
        </div>

        <hr className="sf-rule my-[var(--sf-space-lg)] opacity-20" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[var(--sf-text-xs)] opacity-70">
          <p>© {year} {business.fullName}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:opacity-100 transition-opacity">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  )
}
