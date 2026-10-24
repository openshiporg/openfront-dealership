import type { DeskTone } from '@/features/platform/components/desk'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function money(cents: number | null | undefined, currency = 'usd') {
  const value = (Number(cents) || 0) / 100
  if (!currency || currency.toLowerCase() === 'usd') return usd.format(value)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value)
  } catch {
    return usd.format(value)
  }
}

export function dateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function shortDate(value: string | null | undefined, timeZone: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}

export const nonce = (prefix: string) => `${prefix}:${crypto.randomUUID()}`

export const BATCH_STATUSES = ['staged', 'posting', 'failed', 'posted', 'reconciled', 'locked'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]

export const BATCH_STATUS_LABEL: Record<string, string> = {
  staged: 'Staged',
  posting: 'Posting',
  failed: 'Failed',
  posted: 'Posted',
  reconciled: 'Reconciled',
  locked: 'Locked',
}

export function batchTone(status: string): DeskTone {
  if (status === 'failed') return 'bad'
  if (status === 'posting' || status === 'staged') return 'warn'
  if (status === 'posted') return 'info'
  if (status === 'reconciled' || status === 'locked') return 'ok'
  return 'idle'
}

export const SOURCE_TYPES = ['deal', 'service', 'parts', 'payment'] as const
export type AccountingSourceType = (typeof SOURCE_TYPES)[number]

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  deal: 'Deal',
  service: 'Service order',
  parts: 'Parts PO',
  payment: 'Payment',
}

/** Amount codes each source produces when staged (features/keystone/mutations/accountingOperations.ts, sourcePairs). */
export const SOURCE_CODES: Record<AccountingSourceType, string[]> = {
  deal: ['vehicle-sale', 'sales-tax', 'fees', 'finance-products', 'rebates', 'trade-in'],
  service: ['labor', 'parts', 'sales-tax'],
  parts: ['inventory-receipt'],
  payment: ['payment-capture', 'payment-refund'],
}

export const ACCOUNTING_PROVIDER = 'operator-recorded'

export const PAYMENT_STATUSES = ['creating', 'pending', 'authorized', 'captured', 'failed', 'canceled', 'partially-refunded', 'refunded'] as const

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  creating: 'Creating',
  pending: 'Pending',
  authorized: 'Authorized',
  captured: 'Captured',
  failed: 'Failed',
  canceled: 'Canceled',
  'partially-refunded': 'Partially refunded',
  refunded: 'Refunded',
}

export function paymentTone(status: string): DeskTone {
  if (status === 'failed') return 'bad'
  if (['creating', 'pending', 'authorized', 'partially-refunded'].includes(status)) return 'warn'
  if (status === 'captured') return 'ok'
  if (status === 'refunded') return 'info'
  return 'idle'
}

export function refundTone(status: string): DeskTone {
  if (status === 'failed') return 'bad'
  if (status === 'creating' || status === 'pending') return 'warn'
  if (status === 'succeeded') return 'ok'
  return 'idle'
}

/** Midnight of a YYYY-MM-DD calendar day in `timeZone`, as an ISO instant. */
export function zonedDayStart(day: string, timeZone: string) {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return null
  const guess = Date.UTC(year, month - 1, date)
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant))
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - instant
  }
  let instant = guess - offsetAt(guess)
  instant = guess - offsetAt(instant)
  return new Date(instant).toISOString()
}

export function addDays(day: string, days: number) {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + days))
  return next.toISOString().slice(0, 10)
}
