import { permissions } from '../access'

export async function dealLenderOffers(_root: unknown, { dealId }: { dealId: string }, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session }) || !permissions.canAccessDeals({ session: context.session })) throw new Error('Deal and financing permissions are required')
  const deal = await context.query.Deal.findOne({ where: { id: String(dealId || '') }, query: 'id rooftop { id } lead { id } selectedLenderDecision { id }' })
  if (!deal?.rooftop?.id || !deal.lead?.id) throw new Error('Deal not found or not accessible')
  const decisions = await context.query.LenderDecision.findMany({
    where: { application: { lead: { id: { equals: deal.lead.id } } }, decision: { in: ['approved', 'conditional'] } },
    orderBy: [{ aprBasisPoints: 'asc' }, { monthlyPaymentCents: 'asc' }, { decidedAt: 'desc' }],
    take: 25,
    query: 'id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt',
  })
  return decisions.map((decision: any) => ({ ...decision, selected: decision.id === deal.selectedLenderDecision?.id }))
}
