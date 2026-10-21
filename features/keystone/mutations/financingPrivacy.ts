import { formatCurrency } from './submissionUtils'

type FinancingLeadContentInput = {
  vehicleSummary: string
  requestedAmount: number | null
  monthlyPayment: number | null
  downPayment: number
  tradeInValue: number
  apr: number
  loanTerm: number
}

/**
 * CRM-safe financing copy. Income, employment, and self-reported credit data are
 * deliberately excluded because Lead.notes and Task.description are general CRM
 * fields, not a restricted credit-application store.
 */
export function buildFinancingLeadContent(input: FinancingLeadContentInput) {
  const requestedAmount = input.requestedAmount == null
    ? 'Requested amount: Not provided (no calculator amount was recorded).'
    : `Requested amount: ${formatCurrency(input.requestedAmount)}`
  const paymentEstimate = input.monthlyPayment == null
    ? 'Payment estimate: Not provided.'
    : `Estimated payment: ${formatCurrency(input.monthlyPayment)} / month for ${input.loanTerm || 'unknown'} months at ${input.apr || 'unknown'}% APR`
  const notes = [
    'Finance options inquiry submitted from storefront.',
    `Selected vehicle: ${input.vehicleSummary}`,
    requestedAmount,
    paymentEstimate,
    `Planned down payment: ${formatCurrency(input.downPayment)}`,
    `Trade-in credit: ${formatCurrency(input.tradeInValue)}`,
    'Customer consented to contact about financing options. Eligibility details must be handled only through an approved restricted lender workflow; this CRM note is not a credit application or decision.',
  ].join('\n')

  const taskDescription = [
    `Review finance options inquiry. Selected vehicle: ${input.vehicleSummary}.`,
    input.requestedAmount == null
      ? 'Requested amount was not provided.'
      : `Requested amount: ${formatCurrency(input.requestedAmount)}.`,
    'Use an approved restricted lender workflow for any eligibility or credit data.',
  ].join(' ')

  return { notes, taskDescription }
}
