import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { getCustomerServiceHistory } from '../actions/customerRecords'
import { AccountEmpty, AccountError, AccountHeader, AccountSection } from '../components/account/AccountStates'
import { customerRequestReference, customerRequestStatusLabel } from '../lib/customerRequests'
import { customerRequestPath, formatCents, formatDateTime, serviceOrderStatusLabel, statusLabel, statusTone } from '../lib/accountRecords'

export async function AccountServicePage() {
  const visits = await getCustomerServiceHistory()
  const now = Date.now()
  const upcoming = visits?.filter((visit) => ['scheduled', 'checked-in', 'in-progress', 'waiting-parts'].includes(visit.status) && (visit.status !== 'scheduled' || new Date(visit.appointmentDate).getTime() >= now)) ?? []
  const past = visits?.filter((visit) => !upcoming.includes(visit)) ?? []

  const list = (items: NonNullable<typeof visits>) => (
    <ul className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
      {items.map((visit) => {
        const order = visit.serviceOrder
        return (
          <li key={visit.id} className="border-b" style={{ borderColor: 'var(--sf-rule)' }}>
            <Link
              href={customerRequestPath('service', visit.id)}
              className="grid min-h-11 gap-x-6 gap-y-1 px-1 py-4 transition-colors hover:bg-[var(--sf-paper-2)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <h3 className="sf-title-line flex-wrap">
                  <span className="sf-dot" data-tone={statusTone(visit.status)} aria-hidden="true" />
                  <span className="sf-heading text-[length:var(--sf-text-lg)]">
                    {visit.servicePackage?.name || (visit.serviceType ? statusLabel(visit.serviceType) : 'Service')}
                  </span>
                  <span className="sf-muted text-[length:var(--sf-text-sm)]">{customerRequestStatusLabel('service', visit.status)}</span>
                </h3>
                {visit.vehicleDescription && <p className="mt-1 pl-4 text-[length:var(--sf-text-sm)]">{visit.vehicleDescription}</p>}
                <p className="sf-muted mt-1 pl-4 text-[length:var(--sf-text-sm)]">
                  <time dateTime={visit.appointmentDate} className="sf-figure text-[var(--sf-ink)]">{formatDateTime(visit.appointmentDate, visit.timezone)}</time>
                  {order && (
                    <> · {order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : 'Repair order'} {serviceOrderStatusLabel(order.status)}
                      {order.grandTotalCents != null && <> · <span className="sf-figure text-[var(--sf-ink)]">{formatCents(order.grandTotalCents)}</span></>}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 pl-4 sm:justify-end sm:pl-0">
                <span className="sf-figure sf-muted text-[length:var(--sf-text-sm)]">{customerRequestReference('service', visit.id)}</span>
                <ChevronRight className="sf-faint size-4 shrink-0" aria-hidden="true" />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section className="pb-24">
      <AccountHeader eyebrow="Account" title="Service" />
      {visits === null ? (
        <div className="mt-[var(--sf-space-lg)]">
          <AccountError title="Service history couldn't be loaded." retryHref="/account/service" />
        </div>
      ) : (
        <>
          <AccountSection
            title="Upcoming"
            action={<Link href="/service" className="sf-pill sf-pill-raised min-h-11 self-start px-5">Book service</Link>}
          >
            {upcoming.length === 0 ? <AccountEmpty>No upcoming appointments.</AccountEmpty> : list(upcoming)}
          </AccountSection>
          <AccountSection title="History">
            {past.length === 0 ? <AccountEmpty>No past visits.</AccountEmpty> : list(past)}
          </AccountSection>
        </>
      )}
    </section>
  )
}
