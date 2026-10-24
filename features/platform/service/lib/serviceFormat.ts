export function formatCents(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format((cents || 0) / 100)
}

export function formatDateTime(value: string | null | undefined, timeZone: string, empty = 'Unscheduled') {
  if (!value) return empty
  return new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

/** "1.5" -> 1.5; null when it is not a positive quantity the line commands accept. */
export function parseQuantity(text: string) {
  const cleaned = text.trim()
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value > 0 && value <= 10_000 ? value : null
}

/** Non-negative whole number, or null. Blank is null. */
export function parseWhole(text: string, max = 2_147_483_647) {
  const cleaned = text.trim().replace(/,/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isSafeInteger(value) && value <= max ? value : null
}

export function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '')
}
