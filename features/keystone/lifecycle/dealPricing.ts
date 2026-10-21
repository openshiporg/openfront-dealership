/** Shared, side-effect-free USD cents contract. No UI or provider is a pricing authority. */
export const MAX_CENTS = 2_147_483_647

export type MoneyLine = {
  code: string
  name: string
  amountCents: number
  source?: string
  [key: string]: unknown
}

export type DealPriceInput = {
  vehiclePriceCents?: number | null
  tradeInValueCents?: number | null
  downPaymentCents?: number | null
  financingAmountCents?: number | null
  taxAmountCents?: number | null
  fees?: unknown
  products?: unknown
  rebates?: unknown
  taxLines?: unknown
}

export function checkedCents(value: unknown, label = 'Amount', allowNegative = false): number {
  const amount = Number(value ?? 0)
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > MAX_CENTS || (!allowNegative && amount < 0)) {
    throw new Error(`${label} must be ${allowNegative ? '' : 'non-negative '}integer cents within the supported range`)
  }
  return amount
}

/** Read compatibility only: historical dollar lines stay readable without rewriting evidence. */
export function lineAmountCents(line: any): number {
  return checkedCents(line?.amountCents ?? Math.round(Number(line?.amount ?? 0) * 100), 'Line amount')
}

export function sumMoneyLines(lines: unknown): number {
  if (lines == null) return 0
  if (!Array.isArray(lines)) throw new Error('Money lines must be an array')
  return checkedCents(lines.reduce((sum, line) => sum + lineAmountCents(line), 0), 'Line total')
}

export function normalizeMoneyLines(value: unknown, label: string): MoneyLine[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error(`${label} must be an array with at most 50 lines`)
  const codes = new Set<string>()
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label} line ${index + 1} is invalid`)
    const name = String(item.name || '').trim()
    if (!name || name.length > 160) throw new Error(`${label} name is required and must be at most 160 characters`)
    const code = String(item.code || `legacy-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-')
    if (!code || code.length > 80 || codes.has(code)) throw new Error(`${label} codes must be unique and at most 80 characters`)
    codes.add(code)
    const source = String(item.source || 'operator-recorded')
    if (!['operator-recorded', 'configured-policy'].includes(source)) throw new Error(`${label} source must be operator-recorded or configured-policy`)
    // Retain descriptions and prior source metadata; normalize only the amount/identity contract.
    return { ...item, code, name, amountCents: lineAmountCents(item), source }
  })
}

export function calculateDealPrice(deal: DealPriceInput) {
  const vehiclePriceCents = checkedCents(deal.vehiclePriceCents, 'Vehicle price')
  const feesCents = sumMoneyLines(deal.fees)
  const productsCents = sumMoneyLines(deal.products)
  const rebatesCents = sumMoneyLines(deal.rebates)
  // Modern tax lines are authoritative, never added to their cached aggregate twice.
  // Empty legacy lines fall back to the retained scalar; writers explicitly set it to zero when clearing.
  const taxAmountCents = Array.isArray(deal.taxLines) && deal.taxLines.length
    ? sumMoneyLines(deal.taxLines) : checkedCents(deal.taxAmountCents, 'Tax')
  const tradeInValueCents = checkedCents(deal.tradeInValueCents, 'Trade-in credit')
  const downPaymentCents = checkedCents(deal.downPaymentCents, 'Down payment')
  const subtotalCents = checkedCents(vehiclePriceCents + feesCents + productsCents - rebatesCents, 'Subtotal', true)
  const totalPriceCents = checkedCents(subtotalCents + taxAmountCents - tradeInValueCents, 'Total price', true)
  const balanceCents = checkedCents(totalPriceCents - downPaymentCents, 'Balance', true)
  const cashPayableCents = checkedCents(totalPriceCents - checkedCents(deal.financingAmountCents, 'Financing amount'), 'Cash payable', true)
  return { vehiclePriceCents, feesCents, productsCents, rebatesCents, taxAmountCents, tradeInValueCents, downPaymentCents, subtotalCents, totalPriceCents, balanceCents, cashPayableCents }
}

export function assertValidDealPrice(price: ReturnType<typeof calculateDealPrice>) {
  if (price.subtotalCents < 0 || price.totalPriceCents < 0) throw new Error('Credits cannot exceed the sale total')
  if (price.balanceCents < 0) throw new Error('Down payment cannot exceed the remaining sale total')
}

export function amortizedPaymentCents(principalCents: number, aprPercent: number, termMonths: number) {
  checkedCents(principalCents, 'Principal')
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) throw new Error('Loan term is invalid')
  if (!Number.isFinite(aprPercent) || aprPercent < 0 || aprPercent > 100) throw new Error('APR is invalid')
  if (principalCents === 0) return 0
  if (aprPercent === 0) return Math.round(principalCents / termMonths)
  const rate = aprPercent / 100 / 12
  return checkedCents(Math.round(principalCents * rate / (1 - Math.pow(1 + rate, -termMonths))), 'Monthly payment')
}
