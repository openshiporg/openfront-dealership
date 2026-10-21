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

export async function AccountPage() {
  const [customer, history] = await Promise.all([getCustomer(), getRequestHistory()])

  if (!customer) {
    return (
      <div role="alert" className="sf-card p-[var(--sf-space-lg)] text-center">
        <h1 className="sf-display text-[length:var(--sf-text-xl)]">Account unavailable</h1>
        <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>We couldn&apos;t load your account. Please try again.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/account" prefetch={false} className="sf-btn sf-btn-primary">Retry</Link>
          <Link href="/inventory" className="sf-btn sf-btn-ghost">Back to inventory</Link>
        </div>
      </div>
    )
  }

  return (
    <section>
      <header className="mb-8 border-b pb-6" style={{ borderColor: 'var(--sf-rule)' }}>
        <h1 className="sf-display text-[length:var(--sf-text-2xl)]">Account</h1>
        {customer.name && <p className="mt-2" style={{ color: 'var(--sf-ink-2)' }}>{customer.name}</p>}
      </header>

      <h2 className="sf-display text-[length:var(--sf-text-xl)] mb-5">Request history</h2>
      {history === null ? (
        <p role="alert">Request history couldn&apos;t be loaded.</p>
      ) : history.length === 0 ? (
        <p style={{ color: 'var(--sf-ink-2)' }}>No requests yet.</p>
      ) : (
        <ul className="space-y-4">
          {history.map((item) => {
            const reference = requestReference(item)
            return (
              <li key={`${item.kind}-${item.id}`} className="sf-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{item.kind}</h3>
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                    {customerRequestStatusLabel(item.kind, item.status)}
                  </span>
                </div>
                <p className="mt-2">
                  {['test-drive', 'service'].includes(KIND_KEYS[item.kind.trim().toLowerCase()] ?? '') ? 'Requested time' : 'Submitted'} ·{' '}
                  <time dateTime={item.scheduledAt}>
                    {formatRequestTime(item)}
                  </time>
                </p>
                {reference && <p className="text-sm mt-2">Reference {reference}</p>}
              </li>
            )
          })}
        </ul>
      )}

      <nav className="flex flex-wrap gap-4 mt-8" aria-label="New request">
        <Link className="sf-btn min-h-11 min-w-11" href="/test-drive">Request test drive</Link>
        <Link className="sf-btn min-h-11 min-w-11" href="/service">Request service</Link>
      </nav>
    </section>
  )
}
