const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/**
 * USD for the deal desks. Values that round to zero render as "$0.00" (or "$0"),
 * never "-$0.00", so credits with no amount do not read as negative.
 */
export function formatUsd(value: number | null | undefined, options: { whole?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) return '-'
  const formatter = options.whole ? dollars : cents
  const rounded = options.whole ? Math.round(value) : Math.round(value * 100) / 100
  return formatter.format(rounded === 0 ? 0 : rounded)
}

/** A credit (trade-in, rebate, down payment) shown as a deduction; zero stays unsigned. */
export function formatUsdCredit(value: number | null | undefined, options: { whole?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) return '-'
  return formatUsd(-Math.abs(value), options)
}
