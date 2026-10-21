import { resolveCustomerInTransaction } from './customerIdentity'
import { runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import {
  finiteNumber,
  formatCurrency,
  optionalText,
  requiredText,
  resolveAvailableVehicle,
  validEmail,
  validPhone,
} from './submissionUtils'

const CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor'])
const OWNERSHIP = new Set(['own', 'financing', 'lease'])

function preliminaryTradeRange(year: number, mileage: number, condition: string) {
  const age = new Date().getFullYear() - year
  let base = 30000 - age * 4500
  base -= (mileage - age * 12000) * 0.1
  base *= ({ excellent: 1.1, good: 1, fair: 0.85, poor: 0.7 } as Record<string, number>)[condition]
  base = Math.max(base, 2000)
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1) }
}

export async function submitTradeIn(_root: unknown, { data }: { data: any }, context: any) {
  const firstName = requiredText(data.firstName, 'First name', 100)
  const lastName = requiredText(data.lastName, 'Last name', 100)
  const email = validEmail(data.email)
  const phone = validPhone(data.phone)
  const year = finiteNumber(data.year, 'Vehicle year', {
    min: 1980,
    max: new Date().getFullYear() + 1,
    integer: true,
  })
  const mileage = finiteNumber(data.mileage, 'Mileage', { min: 0, max: 2_000_000, integer: true })
  const make = requiredText(data.make, 'Make', 100)
  const model = requiredText(data.model, 'Model', 100)
  const trim = optionalText(data.trim, 100, 'Trim')
  const vin = optionalText(data.vin, 17, 'VIN').toUpperCase()
  const condition = requiredText(data.condition, 'Condition', 30)
  const ownership = requiredText(data.ownership, 'Ownership', 30)
  const payoffAmount = finiteNumber(data.payoffAmount || 0, 'Payoff amount', { min: 0, max: 10_000_000 })
  if (!CONDITIONS.has(condition) || !OWNERSHIP.has(ownership)) {
    throw new SubmissionError('Condition or ownership is invalid.')
  }
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    throw new SubmissionError('VIN must be a valid 17-character identifier when provided.')
  }

  const estimate = preliminaryTradeRange(year, mileage, condition)
  const summary = `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`

  return runPublicSubmission({
    context,
    workflow: 'trade-in',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      firstName,
      lastName,
      email,
      phone,
      year,
      mileage,
      make,
      model,
      trim,
      vin,
      condition,
      ownership,
      payoffAmount,
      interestedVehicleId: optionalText(data.interestedVehicleId, 100, 'Interested vehicle'),
    },
    aggregateType: 'TradeIn',
    topic: 'public-trade-in.submitted',
    aggregateId: result => String(result.tradeInId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.interestedVehicleId, rooftopId)
      const interested = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})`
        : 'No replacement vehicle selected'
      const rooftop = { connect: { id: rooftopId } }
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const tradeIn = await transactionContext.sudo().query.TradeIn.createOne({
        data: {
          rooftop,
          vin,
          year: String(year),
          make,
          model,
          trim,
          mileage,
          condition,
          exteriorCondition: 'Storefront appraisal request; detailed exterior inspection pending.',
          interiorCondition: `Ownership: ${ownership}${payoffAmount > 0 ? `; customer-reported payoff: ${formatCurrency(payoffAmount)}` : ''}`,
          lead: {
            create: {
              rooftop,
              customer: { connect: { id: customer.id } },
              firstName,
              lastName,
              email,
              phone,
              source: 'website',
              status: 'new',
              timeframe: 'immediately',
              tradeInVehicle: summary,
              notes: [
                `Trade-in appraisal request for ${summary}.`,
                `Automated preliminary range: ${formatCurrency(estimate.min)}–${formatCurrency(estimate.max)}; not a provider-backed valuation or dealership offer.`,
                `Ownership: ${ownership}${payoffAmount > 0 ? `; customer-reported payoff: ${formatCurrency(payoffAmount)}` : ''}.`,
                `Interested inventory: ${interested}.`,
              ].join('\n'),
              ...(vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}),
            },
          },
        },
        query: 'id lead { id }',
      })
      return {
        tradeInId: tradeIn.id,
        leadId: tradeIn.lead.id,
        estimatedMin: estimate.min,
        estimatedMax: estimate.max,
        estimateMode: 'automated-preliminary',
        providerRequestSent: false,
        vehicle,
      }
    },
  })
}
