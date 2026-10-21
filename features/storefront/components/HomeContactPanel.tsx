'use client'

import { Button } from './Button'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

export function HomeContactPanel() {
  const business = useStorefrontBusiness()
  const hasLocation = business.addressLine1 || business.addressLine2

  return (
    <div className="sf-card p-[var(--sf-space-lg)]">
      <p className="sf-eyebrow mb-3">Talk with our team</p>
      <p className="sf-display text-[length:var(--sf-text-xl)]">
        {hasLocation ? business.addressLine1 || business.addressLine2 : 'Questions about a vehicle?'}
      </p>
      {business.addressLine1 && business.addressLine2 && (
        <p className="mt-2 text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
          {business.addressLine2}
        </p>
      )}
      <hr className="sf-rule my-[var(--sf-space-md)]" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--sf-text-sm)]">
        {business.phoneHref && business.phoneDisplay && (
          <div>
            <dt className="sf-eyebrow mb-1">Sales</dt>
            <dd>
              <a href={business.phoneHref} className="hover:text-[var(--sf-accent)]">
                {business.phoneDisplay}
              </a>
            </dd>
          </div>
        )}
        {business.salesEmail && (
          <div>
            <dt className="sf-eyebrow mb-1">Email</dt>
            <dd>
              <a href={`mailto:${business.salesEmail}`} className="break-all hover:text-[var(--sf-accent)]">
                {business.salesEmail}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-[var(--sf-space-md)]">
        <Button href="/contact" variant="ghost" className="w-full sm:w-auto">
          Send a message
        </Button>
      </div>
    </div>
  )
}
