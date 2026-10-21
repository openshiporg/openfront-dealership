export type FinancingAmountResult =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'valid'; value: number }

export type FinancingEstimate = {
  vehiclePrice: number
  downPayment: number
  tradeInValue: number
  loanAmount: number
  monthlyPayment: number
  totalInterest: number
  totalPayment: number
}

export type FinancingCalculation =
  | { status: 'missing-price' | 'invalid-price' | 'invalid-input' | 'zero-price' }
  | { status: 'no-loan' | 'ready'; estimate: FinancingEstimate }

const LOAN_TERMS = new Set([36, 48, 60, 72, 84])
const DECIMAL_AMOUNT = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

export function parseFinancingAmount(value: unknown): FinancingAmountResult {
  if (value == null) return { status: 'empty' }
  if (typeof value === 'string' && !value.trim()) return { status: 'empty' }

  let amount: number
  if (typeof value === 'number') {
    amount = value
  } else if (typeof value === 'string' && DECIMAL_AMOUNT.test(value.trim())) {
    amount = Number(value.trim())
  } else {
    return { status: 'invalid' }
  }

  const cents = Math.round(amount * 100)
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(amount - cents / 100) > 1e-8
  ) return { status: 'invalid' }
  return { status: 'valid', value: amount }
}

export function calculateFinancingEstimate(input: {
  vehiclePrice: string
  downPayment: string
  tradeInValue: string
  interestRate: number
  loanTerm: number
}): FinancingCalculation {
  const price = parseFinancingAmount(input.vehiclePrice)
  if (price.status === 'empty') return { status: 'missing-price' }
  if (price.status === 'invalid') return { status: 'invalid-price' }
  if (price.value === 0) return { status: 'zero-price' }

  const downPayment = parseFinancingAmount(input.downPayment || '0')
  const tradeInValue = parseFinancingAmount(input.tradeInValue || '0')
  const rate = Number(input.interestRate)
  const term = Number(input.loanTerm)
  if (
    downPayment.status !== 'valid' ||
    tradeInValue.status !== 'valid' ||
    !Number.isFinite(rate) || rate < 0 || rate > 30 ||
    !Number.isInteger(term) || !LOAN_TERMS.has(term)
  ) {
    return { status: 'invalid-input' }
  }

  const loanAmount = Math.max(0, price.value - downPayment.value - tradeInValue.value)
  if (!Number.isFinite(loanAmount)) return { status: 'invalid-input' }
  if (loanAmount === 0) {
    return {
      status: 'no-loan',
      estimate: {
        vehiclePrice: price.value,
        downPayment: downPayment.value,
        tradeInValue: tradeInValue.value,
        loanAmount: 0,
        monthlyPayment: 0,
        totalInterest: 0,
        totalPayment: 0,
      },
    }
  }

  const monthlyRate = rate / 100 / 12
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / term
    : (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, term))) /
      (Math.pow(1 + monthlyRate, term) - 1)
  const totalPayment = monthlyPayment * term
  const totalInterest = Math.max(0, totalPayment - loanAmount)
  if (![monthlyPayment, totalPayment, totalInterest].every(Number.isFinite)) return { status: 'invalid-input' }

  return {
    status: 'ready',
    estimate: {
      vehiclePrice: price.value,
      downPayment: downPayment.value,
      tradeInValue: tradeInValue.value,
      loanAmount,
      monthlyPayment,
      totalInterest,
      totalPayment,
    },
  }
}

export function buildAmortizationSchedule(estimate: FinancingEstimate, annualRate: number, term: number) {
  const schedule: any[] = []
  const monthlyRate = annualRate / 100 / 12
  let balance = estimate.loanAmount

  for (let month = 1; month <= term; month++) {
    const interest = balance * monthlyRate
    const principal = estimate.monthlyPayment - interest
    balance -= principal
    if (month <= 12 || month > term - 12) {
      schedule.push({ month, payment: estimate.monthlyPayment, principal, interest, balance: Math.max(0, balance) })
    } else if (month === 13) {
      schedule.push({ separator: true })
    }
  }

  return schedule
}
