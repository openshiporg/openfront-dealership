/** How an operator-recorded deal payment was taken. Stored in `PaymentTransaction.paymentMethod`. */
export const DEAL_PAYMENT_METHODS = ['cash', 'cashiers-check', 'personal-check', 'debit-card', 'credit-card', 'wire', 'ach'] as const
export type DealPaymentMethod = (typeof DEAL_PAYMENT_METHODS)[number]

export const DEAL_PAYMENT_METHOD_LABELS: Record<DealPaymentMethod, string> = {
  cash: 'Cash',
  'cashiers-check': 'Cashier\'s check',
  'personal-check': 'Personal check',
  'debit-card': 'Debit card',
  'credit-card': 'Credit card',
  wire: 'Wire transfer',
  ach: 'ACH transfer',
}

/** IRS Form 8300: more than $10,000 in cash received in one transaction or related transactions. */
export const FORM_8300_THRESHOLD_CENTS = 1_000_000

export function isDealPaymentMethod(value: unknown): value is DealPaymentMethod {
  return typeof value === 'string' && (DEAL_PAYMENT_METHODS as readonly string[]).includes(value)
}

export function dealPaymentMethod(value: unknown) {
  const method = String(value ?? '').trim()
  if (!isDealPaymentMethod(method)) throw new Error('Choose how the payment was made')
  return method
}
