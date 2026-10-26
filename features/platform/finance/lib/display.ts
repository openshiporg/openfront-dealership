import type { DeskTone } from '@/features/platform/components/desk'

export const PRODUCT_CATEGORIES = ['service-contract', 'gap', 'maintenance', 'appearance', 'tire-wheel', 'other'] as const

export const categoryLabels: Record<string, string> = {
  'service-contract': 'Service contract',
  gap: 'GAP',
  maintenance: 'Maintenance',
  appearance: 'Appearance',
  'tire-wheel': 'Tire and wheel',
  other: 'Other',
}

export function formatCents(cents: number | null | undefined, empty = '-') {
  if (cents == null) return empty
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function formatDay(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatApr(bps: number | null | undefined) {
  return bps == null ? '-' : `${(bps / 100).toFixed(2)}%`
}

/** Tone for free-form workflow states. */
export function stateTone(value: string | null | undefined): DeskTone {
  const state = (value || '').toLowerCase()
  if (['approved', 'accepted', 'completed', 'complete', 'signed', 'funded', 'quoted', 'submitted-to-lender', 'succeeded', 'active'].includes(state)) return 'ok'
  if (['declined', 'rejected', 'failed', 'expired', 'cancelled', 'canceled', 'void', 'denied'].includes(state)) return 'bad'
  if (['conditional', 'requested', 'pending', 'presented', 'queued', 'submitted', 'under-review', 'creating'].includes(state)) return 'warn'
  return 'idle'
}

export function personName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'No customer') {
  if (!person) return fallback
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || fallback
}

export function vehicleName(vehicle: { year?: number | null; make?: string | null; model?: string | null } | null | undefined, fallback = 'No vehicle') {
  if (!vehicle) return fallback
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || fallback
}

export function newIdempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}

/** Whole days since a timestamp; null when unknown. */
export function daysSince(value: string | null | undefined, now = Date.now()) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.floor((now - time) / 86_400_000))
}

export function formatAge(days: number | null) {
  if (days == null) return '-'
  return days === 0 ? 'Today' : `${days}d`
}
