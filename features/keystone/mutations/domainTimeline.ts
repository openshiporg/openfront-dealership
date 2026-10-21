const AGGREGATE_TYPES = new Set([
  'Vehicle',
  'Lead',
  'Task',
  'TestDrive',
  'TradeIn',
  'Deal',
  'FinanceFundingCase',
  'DeliveryCase',
  'FinancingApplication',
  'LenderSubmission',
  'LenderDecision',
  'ServiceAppointment',
  'ServiceOrder',
  'InventoryAcquisition',
  'Customer',
  'LeadRoutingRule',
])

export async function domainTimeline(
  _root: unknown,
  { aggregateType, aggregateId, limit = 50 }: { aggregateType: string; aggregateId: string; limit?: number },
  context: any
) {
  if (!context.session?.itemId) throw new Error('Authentication required')
  if (!AGGREGATE_TYPES.has(aggregateType)) throw new Error('Unsupported timeline aggregate type')
  const take = Math.max(1, Math.min(100, Number(limit) || 50))
  const events = await context.query.DomainAuditEvent.findMany({
    where: {
      aggregateType: { equals: aggregateType },
      aggregateId: { equals: String(aggregateId || '') },
    },
    orderBy: { occurredAt: 'desc' },
    take,
    query: 'id eventKey aggregateType aggregateId action beforeSnapshot afterSnapshot metadata occurredAt actor { id name }',
  })
  return events.map((event: any) => ({
    ...event,
    occurredAt: event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt),
  }))
}
