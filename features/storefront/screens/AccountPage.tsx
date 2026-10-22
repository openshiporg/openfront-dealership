import Link from 'next/link'

import { openfrontClient } from '../lib/config'
import { getAuthHeaders } from '../lib/data/cookies'
import { getCustomer } from '../actions/account'
import { customerRequestReference, customerRequestStatusLabel, type CustomerRequestKind } from '../lib/customerRequests'

type CustomerRequest = { id: string; kind: string; scheduledAt: string; status: string; timezone?: string | null }

const KIND_KEYS: Record<string, CustomerRequestKind> = {
  'test drive': 'test-drive',
  'test-drive': 'test-drive',
  service: 'service',
  'trade-in': 'trade-in',
  'trade in': 'trade-in',
  financing: 'financing',
  inquiry: 'inquiry',
  contact: 'inquiry',
}

async function getRequestHistory() {
  try {
    const data = await openfrontClient.request<{ customerRequestHistory: CustomerRequest[] }>(
      `query CustomerHistory { customerRequestHistory { id kind scheduledAt status timezone } }`,
      {},
      await getAuthHeaders()
    )
    return data.customerRequestHistory ?? []
  } catch {
    return null
  }
}

function formatRequestTime(item: CustomerRequest) {
  const date = new Date(item.scheduledAt)
  try {
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone || undefined, timeZoneName: 'short' })
  } catch {
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' })
  }
}

function requestReference(item: CustomerRequest) {
  const kind = KIND_KEYS[item.kind.trim().toLowerCase()]
  return kind ? customerRequestReference(kind, item.id) : null
}

type Tone = 'ok' | 'warn' | 'bad' | 'accent' | 'idle'

const OK_STATUSES = new Set(['completed', 'appraised', 'approved', 'funded', 'won', 'closed-won', 'sold', 'delivered'])
const BAD_STATUSES = new Set(['cancelled', 'canceled', 'declined', 'rejected', 'lost', 'closed-lost', 'no-show', 'expired'])
const ACTIVE_STATUSES = new Set(['checked-in', 'in-progress', 'waiting-parts', 'contacted', 'qualified', 'in-review', 'reviewing', 'submitted-to-lender', 'conditional'])

function statusTone(status: string): Tone {
  const key = status.trim().toLowerCase().replaceAll(' ', '-').replaceAll('_', '-')
  if (!key) return 'idle'
  if (OK_STATUSES.has(key)) return 'ok'
  if (BAD_STATUSES.has(key)) return 'bad'
  if (ACTIVE_STATUSES.has(key)) return 'accent'
  return 'warn'
}

function isScheduledKind(item: CustomerRequest) {
  return ['test-drive', 'service'].includes(KIND_KEYS[item.kind.trim().toLowerCase()] ?? '')
}

const NEW_REQUESTS = [
  { href: '/test-drive', label: 'Test drive' },
  { href: '/service', label: 'Service' },
  { href: '/trade-in', label: 'Trade-in' },
  { href: '/financing', label: 'Financing' },
]

export async function AccountPage() {
  const [customer, history] = await Promise.all([getCustomer(), getRequestHistory()])

  if (!customer) {
    return (
      <div role="alert" className="mx-auto max-w-md py-[var(--sf-space-lg)]">
        <h1 className="sf-title-line">
          <span className="sf-dot" data-tone="bad" aria-hidden="true" />
          <span className="sf-heading text-[length:var(--sf-text-2xl)]">Account unavailable</span>
        </h1>
        <p className="sf-muted mt-3">We couldn&apos;t load your account. Please try again.</p>
        <div className="sf-track mt-6">
          <Link href="/account" prefetch={false} className="sf-pill sf-pill-primary min-h-11 px-5">Retry</Link>
          <Link href="/inventory" className="sf-pill min-h-11 px-5">Back to inventory</Link>
        </div>
      </div>
    )
  }

  const counts = history
    ? Object.entries(history.reduce<Record<string, number>>((acc, item) => {
        acc[item.kind] = (acc[item.kind] ?? 0) + 1
        return acc
      }, {}))
    : []

  return (
    <section>
      <header className="border-b pb-[var(--sf-space-md)]" style={{ borderColor: 'var(--sf-rule)' }}>
        <p className="sf-eyebrow">Account</p>
        <h1 className="sf-display mt-3 text-[length:var(--sf-text-display)]">{customer.name || 'Account'}</h1>
        {customer.email && <p className="sf-muted mt-2 break-all">{customer.email}</p>}
      </header>

      {counts.length > 0 && (
        <dl className="sf-spec">
          <div>
            <dt>Requests</dt>
            <dd className="sf-figure text-[var(--sf-text-xl)]">{history?.length ?? 0}</dd>
          </div>
          {counts.map(([kind, count]) => (
            <div key={kind}>
              <dt>{kind}</dt>
              <dd className="sf-figure text-[var(--sf-text-xl)]">{count}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-[var(--sf-space-xl)] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="sf-heading text-[length:var(--sf-text-xl)]">Request history</h2>
        <nav className="sf-track flex-wrap rounded-[var(--sf-radius-md)] sm:flex-nowrap sm:rounded-full" aria-label="New request">
          {NEW_REQUESTS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sf-pill min-h-11 ${index === 0 ? 'sf-pill-raised' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-5">
        {history === null ? (
          <div className="sf-notice" data-tone="bad" role="alert">Request history couldn&apos;t be loaded.</div>
        ) : history.length === 0 ? (
          <div className="sf-well p-6">
            <p className="sf-muted text-[var(--sf-text-sm)]">No requests yet.</p>
          </div>
        ) : (
          <ul className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
            {history.map((item) => {
              const reference = requestReference(item)
              const status = customerRequestStatusLabel(item.kind, item.status)
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="grid gap-x-6 gap-y-1 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline"
                  style={{ borderColor: 'var(--sf-rule)' }}
                >
                  <div className="min-w-0">
                    <h3 className="sf-title-line">
                      <span className="sf-dot" data-tone={statusTone(item.status)} aria-hidden="true" />
                      <span className="sf-heading text-[var(--sf-text-lg)]">{item.kind}</span>
                      <span className="sf-muted text-[var(--sf-text-sm)]">{status}</span>
                    </h3>
                    <p className="sf-muted mt-1 pl-4 text-[var(--sf-text-sm)]">
                      {isScheduledKind(item) ? 'Requested time' : 'Submitted'}{' '}
                      <time dateTime={item.scheduledAt} className="sf-figure text-[var(--sf-ink)]">
                        {formatRequestTime(item)}
                      </time>
                    </p>
                  </div>
                  {reference && (
                    <p className="sf-figure sf-muted pl-4 text-[var(--sf-text-sm)] sm:pl-0 sm:text-right">{reference}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
