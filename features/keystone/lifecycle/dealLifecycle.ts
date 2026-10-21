import { calculateDealPrice, checkedCents } from './dealPricing'

export const DEAL_STATUSES = [
  'pencil',
  'submitted',
  'approved',
  'financed',
  'delivered',
  'cancelled',
] as const

export type DealStatus = typeof DEAL_STATUSES[number]
export type DealTransitionPermissions = {
  canManageDeals?: boolean
  canApproveDeals?: boolean
  canManageFinancing?: boolean
}

const DEAL_TRANSITIONS: Record<DealStatus, readonly DealStatus[]> = {
  pencil: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['financed', 'cancelled'],
  financed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export const DEAL_EVIDENCE_FIELDS = [
  'lead',
  'vehicle',
  'salesperson',
  'vehiclePrice',
  'tradeInValue',
  'tradeInVehicle',
  'tradeInDetails',
  'downPayment',
  'financingAmount',
  'monthlyPayment',
  'loanTerm',
  'apr',
  'taxAmount',
  'fees',
  'rebates',
  'products',
  'taxLines',
  'structureType',
  'residualValueCents',
  'moneyFactorBasisPoints',
  'worksheetVersion',
  'grossCents',
  'selectedLenderDecision',
  'presentedSnapshot',
  'presentedAt',
  'acceptedSnapshot',
  'acceptedAt',
  'saleDate',
  'evidenceSnapshot',
  'lockedAt',
] as const

export function isDealStatus(value: unknown): value is DealStatus {
  return typeof value === 'string' && DEAL_STATUSES.includes(value as DealStatus)
}

export function isDealEvidenceLocked(status: unknown) {
  return status !== 'pencil'
}

export function assertDealTransition(
  current: unknown,
  next: unknown,
  permissions: DealTransitionPermissions
): asserts next is DealStatus {
  if (!isDealStatus(current) || !isDealStatus(next)) {
    throw new Error('Invalid deal status transition')
  }
  if (!DEAL_TRANSITIONS[current].includes(next)) {
    throw new Error(`Deal cannot transition from ${current} to ${next}`)
  }

  if (current === 'submitted' && !permissions.canApproveDeals) {
    throw new Error('Deal approval permission is required')
  }
  if ((current === 'approved' || current === 'financed') && !permissions.canManageFinancing) {
    throw new Error('Financing permission is required')
  }
  if (current === 'pencil' && !permissions.canManageDeals) {
    throw new Error('Deal management permission is required')
  }
}

export function moneyToCents(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) throw new Error('Invalid money value')
  return Math.round(amount * 100)
}

export function buildDealEvidenceSnapshot(deal: Record<string, any>) {
  const fees = Array.isArray(deal.fees)
    ? deal.fees.map((fee: Record<string, unknown>) => ({
        name: String(fee.name || ''),
        description: String(fee.description || ''),
        code: String(fee.code || ''),
        amountCents: Number.isInteger(fee.amountCents) ? Number(fee.amountCents) : moneyToCents(fee.amount),
      }))
    : []

  const cents = (name: string) => checkedCents(deal[`${name}Cents`] ?? moneyToCents(deal[name]), name)
  const amounts = {
    vehiclePriceCents: cents('vehiclePrice'), tradeInValueCents: cents('tradeInValue'),
    downPaymentCents: cents('downPayment'), financingAmountCents: cents('financingAmount'),
    monthlyPaymentCents: cents('monthlyPayment'), taxAmountCents: cents('taxAmount'),
  }
  const pricing = calculateDealPrice({ ...deal, ...amounts, fees })

  return {
    version: 3,
    pricing,
    worksheetVersion: Number(deal.worksheetVersion || 0),
    structureType: deal.structureType || 'cash',
    leadId: deal.lead?.id || null,
    vehicle: deal.vehicle
      ? {
          id: deal.vehicle.id,
          vin: deal.vehicle.vin || null,
          stockNumber: deal.vehicle.stockNumber || null,
          year: deal.vehicle.year || null,
          make: deal.vehicle.make || null,
          model: deal.vehicle.model || null,
          trim: deal.vehicle.trim || null,
        }
      : null,
    salespersonId: deal.salesperson?.id || null,
    tradeInVehicleId: deal.tradeInVehicle?.id || null,
    ...amounts,
    taxAmountCents: pricing.taxAmountCents,
    loanTerm: Number(deal.loanTerm || 0),
    aprBasisPoints: Math.round(Number(deal.apr || 0) * 100),
    fees,
    rebates: Array.isArray(deal.rebates) ? deal.rebates : [],
    products: Array.isArray(deal.products) ? deal.products : [],
    taxLines: Array.isArray(deal.taxLines) ? deal.taxLines : [],
    residualValueCents: deal.residualValueCents ?? null,
    moneyFactorBasisPoints: deal.moneyFactorBasisPoints ?? null,
    grossCents: deal.grossCents ?? null,
    selectedLenderDecisionId: deal.selectedLenderDecision?.id || null,
  }
}
