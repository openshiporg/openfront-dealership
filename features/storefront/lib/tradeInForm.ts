export const TRADE_IN_ESTIMATE_DISCLAIMER =
  'Preliminary range, not a provider-backed valuation or dealership offer. Any offer, if made, will be shared separately after inspection and dealership review.'

export type TradeInDraft = {
  year: string
  make: string
  model: string
  mileage: string
  vin: string
  condition: string
  ownership: string
  payoffAmount: string
}

const CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor'])
const OWNERSHIP = new Set(['own', 'financing', 'lease'])

export type TradeInStepTransition = {
  step: 1 | 2 | 3
  error: string | null
}

export function validateTradeInStep(
  step: 1 | 2,
  draft: TradeInDraft,
  currentYear = new Date().getFullYear()
) {
  if (step === 1) {
    const year = Number(draft.year)
    if (!Number.isInteger(year) || year < 1980 || year > currentYear + 1) {
      return 'Choose a valid vehicle year before continuing.'
    }
    if (!draft.make.trim()) return 'Choose a vehicle make before continuing.'
    if (!draft.model.trim()) return 'Enter the vehicle model before continuing.'

    const mileage = Number(draft.mileage)
    if (!Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000) {
      return 'Enter a valid non-negative mileage before continuing.'
    }

    const vin = draft.vin.trim().toUpperCase()
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return 'VIN must be a valid 17-character identifier when provided.'
    }
    return null
  }

  if (!CONDITIONS.has(draft.condition)) return 'Choose the vehicle condition before continuing.'
  if (!OWNERSHIP.has(draft.ownership)) return 'Choose the ownership status before continuing.'
  if (draft.ownership === 'financing' && draft.payoffAmount.trim()) {
    const payoff = Number(draft.payoffAmount)
    if (!Number.isFinite(payoff) || payoff < 0 || payoff > 10_000_000) {
      return 'Enter a valid non-negative payoff amount before continuing.'
    }
  }
  return null
}

export function transitionTradeInStep(
  step: 1 | 2,
  draft: TradeInDraft,
  currentYear = new Date().getFullYear()
): TradeInStepTransition {
  const error = validateTradeInStep(step, draft, currentYear)
  return error
    ? { step, error }
    : { step: step + 1 as 2 | 3, error: null }
}
