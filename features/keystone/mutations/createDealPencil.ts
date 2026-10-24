import { permissions } from '../access'
import { applyDealDefaults, sumMoneyLines } from '../lifecycle/dealPricing'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'

function cents(value: unknown, label: string) {
  const number = Number(value ?? 0)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be non-negative integer cents`)
  return number
}

export async function createDealPencil(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) {
    throw new Error('Deal management permission is required')
  }
  const rooftopId = String(data.rooftopId || '')
  const vehicleId = String(data.vehicleId || '')
  const leadId = data.leadId ? String(data.leadId) : null
  const salespersonId = data.salespersonId ? String(data.salespersonId) : null
  const tradeInId = data.tradeInId ? String(data.tradeInId) : null
  const idempotencyKey = String(data.idempotencyKey || '').trim()
  if (!rooftopId || !vehicleId || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new Error('Rooftop, vehicle, and a valid idempotency key are required')
  }
  await assertSessionRooftopPermission(context, rooftopId, 'canManageDeals')
  const [rooftop, vehicle, lead, tradeIn, profile] = await Promise.all([
    context.query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id status' }),
    context.query.Vehicle.findOne({ where: { id: vehicleId }, query: 'id status rooftop { id } vin stockNumber year make model trim' }),
    leadId ? context.query.Lead.findOne({ where: { id: leadId }, query: 'id rooftop { id } assignedSalesperson { id }' }) : null,
    tradeInId ? context.query.TradeIn.findOne({ where: { id: tradeInId }, query: 'id rooftop { id } lead { id } deal { id }' }) : null,
    context.sudo().query.DealershipProfile.findOne({ where: { id: 1 }, query: 'salesTaxRateBps docFeeCents' }),
  ])
  if (!rooftop || rooftop.status !== 'active') throw new Error('Rooftop not found or not accessible')
  if (!vehicle || vehicle.rooftop?.id !== rooftopId || vehicle.status !== 'available') throw new Error('Deal vehicle is not available at this rooftop')
  if (leadId && (!lead || lead.rooftop?.id !== rooftopId)) throw new Error('Deal lead must belong to the same rooftop')
  if (tradeInId && (!tradeIn || tradeIn.rooftop?.id !== rooftopId || tradeIn.deal)) throw new Error('Trade-in is unavailable or belongs to another rooftop')
  if (lead && tradeIn?.lead?.id && tradeIn.lead.id !== lead.id) throw new Error('Deal and trade-in must belong to the same lead')
  if (salespersonId) {
    await assertUserRooftopAccess(context, salespersonId, rooftopId)
    if (lead?.assignedSalesperson?.id && lead.assignedSalesperson.id !== salespersonId) {
      throw new Error('Deal salesperson must match the lead assignment')
    }
  }

  const vehiclePriceCents = cents(data.vehiclePriceCents, 'Vehicle price')
  const tradeInValueCents = cents(data.tradeInValueCents, 'Trade-in value')
  // The dealership's configured doc fee and sales tax seed the pencil; staff edit them on the worksheet.
  const { fees, taxLines } = applyDealDefaults({ vehiclePriceCents, tradeInValueCents, rebates: [], fees: [], taxLines: [] }, profile)
  const terms = {
    vehiclePriceCents,
    tradeInValueCents,
    downPaymentCents: cents(data.downPaymentCents, 'Down payment'),
    financingAmountCents: 0,
    monthlyPaymentCents: 0,
    taxAmountCents: sumMoneyLines(taxLines),
    loanTerm: null,
    apr: null,
    fees,
    rebates: [],
    products: [],
    taxLines,
    structureType: 'cash',
    worksheetVersion: 0,
  }
  const eventKey = `deal-pencil:${idempotencyKey}`
  const evidence = {
    rooftopId,
    vehicleId,
    leadId,
    salespersonId,
    tradeInId,
    terms,
    vehicle: { id: vehicle.id, vin: vehicle.vin, stockNumber: vehicle.stockNumber, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
  }

  const dealId = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId, aggregateType: 'Deal', aggregateId: replay.aggregateId,
        action: 'pencil-created', topic: 'deal.pencil-created', actorId: context.session.itemId,
        afterSnapshot: evidence, payload: { dealId: replay.aggregateId, rooftopId, status: 'pencil' },
      })
      return replay.aggregateId
    }
    const deal = await tx.prisma.deal.create({
      data: {
        rooftopId,
        vehicleId,
        leadId,
        salespersonId,
        tradeInVehicleId: tradeInId,
        status: 'pencil',
        ...terms,
      },
      select: { id: true },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'Deal', aggregateId: deal.id,
      action: 'pencil-created', topic: 'deal.pencil-created', actorId: context.session.itemId,
      afterSnapshot: evidence, payload: { dealId: deal.id, rooftopId, status: 'pencil' },
    })
    return deal.id
  }, { timeout: 30_000 })

  return context.db.Deal.findOne({ where: { id: dealId } })
}
