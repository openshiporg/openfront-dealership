import { requiredText, validEmail } from './submissionUtils'

// Adapted from the canonical User/account boundary: customer registration never
// accepts role, membership, staff flags, or an existing CRM identity to claim.
export async function registerCustomerAccount(_root: unknown, { name, email, password }: { name: string; email: string; password: string }, context: any) {
  if (context.session?.itemId) throw new Error('Sign out before creating an account')
  const cleanName = requiredText(name, 'Name', 200)
  const cleanEmail = validEmail(email).toLowerCase()
  // Raw User creation remains staff-only; the User password field validates and hashes the password.
  const user = await context.sudo().query.User.createOne({
    data: { name: cleanName, email: cleanEmail, password, onboardingStatus: 'dismissed' }, query: 'id',
  })
  return { id: user.id }
}

export function requestingAccountId(context: any): string | null {
  return context.session?.listKey === 'User' && typeof context.session.itemId === 'string' ? context.session.itemId : null
}

// Never use submitted email/phone or a guessed customerId to retrieve history.
// Only records bound to the authenticated account at submission are eligible:
// test drives and service appointments carry requestedBy, and inquiries, trade-ins
// and financing applications are bound through their submission event's actor.
export async function customerRequestHistory(_root: unknown, _args: unknown, context: any) {
  const accountId = requestingAccountId(context)
  if (!accountId) throw new Error('Sign in required')
  const prisma = context.prisma
  const [drives, services, submissions] = await Promise.all([
    prisma.testDrive.findMany({ where: { requestedById: accountId }, take: 50,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, rooftopId: true, scheduledTime: true, completed: true } }),
    prisma.serviceAppointment.findMany({ where: { requestedById: accountId }, take: 50,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, rooftopId: true, appointmentDate: true, serviceType: true, status: true } }),
    prisma.domainAuditEvent.findMany({
      where: { actorId: accountId, action: 'submitted', aggregateType: { in: ['Lead', 'TradeIn', 'FinancingApplication'] }, eventKey: { startsWith: 'public-submission:' } },
      take: 150, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { aggregateType: true, aggregateId: true },
    }),
  ])
  const idsFor = (type: string) => submissions.filter((event: any) => event.aggregateType === type).map((event: any) => event.aggregateId)
  const [inquiries, tradeIns, applications] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: idsFor('Lead') } }, take: 50, select: { id: true, rooftopId: true, createdAt: true, status: true } }),
    prisma.tradeIn.findMany({ where: { id: { in: idsFor('TradeIn') } }, take: 50, select: { id: true, rooftopId: true, createdAt: true, offerAmountCents: true } }),
    prisma.financingApplication.findMany({ where: { id: { in: idsFor('FinancingApplication') } }, take: 50, select: { id: true, rooftopId: true, createdAt: true, status: true } }),
  ])
  const rooftopIds = [...new Set([...drives, ...services, ...inquiries, ...tradeIns, ...applications].map((item: any) => item.rooftopId).filter(Boolean))]
  const rooftops = rooftopIds.length
    ? await prisma.rooftop.findMany({ where: { id: { in: rooftopIds } }, select: { id: true, timezone: true } })
    : []
  const timezoneById = new Map(rooftops.map((rooftop: any) => [rooftop.id, rooftop.timezone || null]))
  const timezone = (item: any) => timezoneById.get(item.rooftopId) ?? null
  return [
    ...drives.map((item: any) => ({ id: item.id, kind: 'Test drive', scheduledAt: item.scheduledTime, status: item.completed ? 'completed' : 'requested', timezone: timezone(item) })),
    ...services.map((item: any) => ({ id: item.id, kind: 'Service', scheduledAt: item.appointmentDate, status: item.status, timezone: timezone(item) })),
    ...inquiries.map((item: any) => ({ id: item.id, kind: 'Inquiry', scheduledAt: item.createdAt, status: item.status || 'new', timezone: timezone(item) })),
    ...tradeIns.map((item: any) => ({ id: item.id, kind: 'Trade-in', scheduledAt: item.createdAt, status: item.offerAmountCents == null ? 'submitted' : 'appraised', timezone: timezone(item) })),
    ...applications.map((item: any) => ({ id: item.id, kind: 'Financing', scheduledAt: item.createdAt, status: item.status, timezone: timezone(item) })),
  ].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).slice(0, 50)
}
