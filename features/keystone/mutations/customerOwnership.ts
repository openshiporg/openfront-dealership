import { requestingAccountId } from './customerAccount'
import { normalizeCustomerEmail } from './customerIdentity'

// Customer-facing ownership boundary for storefront accounts.
//
// A record belongs to the signed-in account only through evidence the server wrote itself:
//   1. requestedBy on TestDrive / ServiceAppointment (set from the session at submission);
//   2. the public submission audit event's actorId (Lead, TradeIn, FinancingApplication);
//   3. a CRM Customer linked to the account by confirmCustomerEmailVerification, which
//      requires a signed token sent to the account's own email. Through that link only
//      leads whose own email is the verified address are claimed, so a phone-number match
//      that folded someone else's request into the same Customer is never exposed.
// Children follow their parent: deals and their delivery cases, we-owe items and payments
// follow the lead; repair orders and their payments follow the appointment.
// Submitted names, emails, phones or guessed IDs are never used to widen this set.

const LIMIT = 500

export function requireCustomerAccount(context: any) {
  const accountId = requestingAccountId(context)
  if (!accountId) throw new Error('Sign in required')
  return accountId
}

export type CustomerOwnership = {
  accountId: string
  leadIds: string[]
  boundLeadIds: Set<string>
  claimedLeadIds: Set<string>
  tradeInIds: string[]
  applicationIds: string[]
}

export async function customerOwnership(prisma: any, accountId: string): Promise<CustomerOwnership> {
  const [submissions, drives, services, customers] = await Promise.all([
    prisma.domainAuditEvent.findMany({
      where: { actorId: accountId, action: 'submitted', aggregateType: { in: ['Lead', 'TradeIn', 'FinancingApplication'] }, eventKey: { startsWith: 'public-submission:' } },
      take: LIMIT, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { aggregateType: true, aggregateId: true },
    }),
    prisma.testDrive.findMany({ where: { requestedById: accountId }, take: LIMIT, select: { leadId: true } }),
    prisma.serviceAppointment.findMany({ where: { OR: [{ requestedById: accountId }, { customerId: accountId }] }, take: LIMIT, select: { leadId: true } }),
    prisma.customer.findMany({ where: { accountId, status: 'active' }, take: LIMIT, select: { id: true, normalizedEmail: true } }),
  ])
  const idsFor = (type: string) => submissions.filter((event: any) => event.aggregateType === type).map((event: any) => String(event.aggregateId))
  const boundTradeInIds = idsFor('TradeIn')
  const boundApplicationIds = idsFor('FinancingApplication')
  const [boundTradeIns, boundApplications, customerLeads] = await Promise.all([
    boundTradeInIds.length ? prisma.tradeIn.findMany({ where: { id: { in: boundTradeInIds } }, select: { leadId: true } }) : [],
    boundApplicationIds.length ? prisma.financingApplication.findMany({ where: { id: { in: boundApplicationIds } }, select: { leadId: true } }) : [],
    customers.length ? prisma.lead.findMany({ where: { customerId: { in: customers.map((customer: any) => customer.id) } }, take: LIMIT, select: { id: true, email: true, customerId: true } }) : [],
  ])
  const verifiedEmailByCustomer = new Map(customers.map((customer: any) => [customer.id, String(customer.normalizedEmail || '')]))
  const claimedLeadIds = new Set<string>(customerLeads
    .filter((lead: any) => {
      const verified = verifiedEmailByCustomer.get(lead.customerId)
      return Boolean(verified) && normalizeCustomerEmail(lead.email) === verified
    })
    .map((lead: any) => String(lead.id)))
  const boundLeadIds = new Set<string>([
    ...idsFor('Lead'),
    ...[...drives, ...services, ...boundTradeIns, ...boundApplications].map((item: any) => item.leadId).filter(Boolean).map(String),
  ])
  const leadIds = [...new Set([...boundLeadIds, ...claimedLeadIds])]
  const [leadTradeIns, leadApplications] = await Promise.all([
    leadIds.length ? prisma.tradeIn.findMany({ where: { leadId: { in: leadIds } }, take: LIMIT, select: { id: true } }) : [],
    leadIds.length ? prisma.financingApplication.findMany({ where: { leadId: { in: leadIds } }, take: LIMIT, select: { id: true } }) : [],
  ])
  return {
    accountId,
    leadIds,
    boundLeadIds,
    claimedLeadIds,
    tradeInIds: [...new Set([...boundTradeInIds, ...leadTradeIns.map((item: any) => String(item.id))])],
    applicationIds: [...new Set([...boundApplicationIds, ...leadApplications.map((item: any) => String(item.id))])],
  }
}

export function ownedTestDriveWhere(ownership: CustomerOwnership) {
  return { OR: [{ requestedById: ownership.accountId }, ...(ownership.leadIds.length ? [{ leadId: { in: ownership.leadIds } }] : [])] }
}

export function ownedServiceAppointmentWhere(ownership: CustomerOwnership) {
  return {
    OR: [
      { requestedById: ownership.accountId },
      { customerId: ownership.accountId },
      ...(ownership.leadIds.length ? [{ leadId: { in: ownership.leadIds } }] : []),
    ],
  }
}

// Deals the customer can see: anything past the internal pencil worksheet.
export function ownedDealWhere(ownership: CustomerOwnership) {
  return { leadId: { in: ownership.leadIds }, status: { in: ['submitted', 'approved', 'financed', 'delivered', 'cancelled'] } }
}

export async function ownedDealIds(prisma: any, ownership: CustomerOwnership): Promise<string[]> {
  if (!ownership.leadIds.length) return []
  const deals = await prisma.deal.findMany({ where: ownedDealWhere(ownership), take: LIMIT, select: { id: true } })
  return deals.map((deal: any) => String(deal.id))
}

export async function ownedServiceOrderIds(prisma: any, ownership: CustomerOwnership): Promise<string[]> {
  const appointments = await prisma.serviceAppointment.findMany({ where: ownedServiceAppointmentWhere(ownership), take: LIMIT, select: { serviceOrder: { select: { id: true } } } })
  return appointments.map((appointment: any) => appointment.serviceOrder?.id).filter(Boolean).map(String)
}
