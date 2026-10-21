import { createHash } from 'node:crypto'

export function normalizeCustomerEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeCustomerPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export function customerIdentityKey(rooftopId: string, email: string, phone: string) {
  const strongest = email ? `email:${email}` : phone ? `phone:${phone}` : ''
  if (!rooftopId || !strongest) throw new Error('Customer identity requires a rooftop and normalized contact point')
  return createHash('sha256').update(`${rooftopId}:${strongest}`).digest('hex')
}

async function lockCustomerIdentityScope(tx: any, rooftopId: string) {
  // Dealership intake/merge volume is modest; one rooftop lock makes alias lookup,
  // duplicate resolution, and identity creation serializable without rewriting old keys.
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`customer-identity-rooftop:${rooftopId}`}, 0))`
}

export async function resolveMergedCustomer(tx: any, customerId: string, rooftopId: string) {
  const visited = new Set<string>()
  let currentId = customerId
  for (let depth = 0; depth < 32; depth += 1) {
    if (visited.has(currentId)) throw new Error('Customer merge history contains a cycle; operator review is required')
    visited.add(currentId)
    const customer = await tx.prisma.customer.findUnique({
      where: { id: currentId },
      select: { id: true, rooftopId: true, status: true, mergedIntoId: true },
    })
    if (!customer || customer.rooftopId !== rooftopId) throw new Error('Customer identity is no longer available')
    if (customer.status === 'active' && !customer.mergedIntoId) return customer
    if (customer.status !== 'merged' || !customer.mergedIntoId) throw new Error('Customer merge history is incomplete; operator review is required')
    currentId = customer.mergedIntoId
  }
  throw new Error('Customer merge history exceeds the supported depth; operator review is required')
}

export async function resolveCustomerInTransaction(
  tx: any,
  input: {
    rooftopId: string
    firstName: string
    lastName: string
    email: string
    phone: string
  },
) {
  const normalizedEmail = normalizeCustomerEmail(input.email)
  const normalizedPhone = normalizeCustomerPhone(input.phone)
  if (!normalizedEmail && normalizedPhone.length < 7) throw new Error('A valid customer email or phone is required')
  const identityKey = customerIdentityKey(input.rooftopId, normalizedEmail, normalizedPhone)
  await lockCustomerIdentityScope(tx, input.rooftopId)

  const identities = [
    ...(normalizedEmail ? [{ normalizedEmail }] : []),
    ...(normalizedPhone.length >= 7 ? [{ normalizedPhone }] : []),
  ]
  const matches = await tx.prisma.customer.findMany({
    where: {
      rooftopId: input.rooftopId,
      status: { in: ['active', 'merged'] },
      OR: [...identities, { identityKey }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 51,
    select: { id: true },
  })
  if (matches.length > 50) throw new Error('Customer identity has too many historical matches; operator review is required')
  if (matches.length) {
    const roots = new Map<string, any>()
    for (const match of matches) {
      const root = await resolveMergedCustomer(tx, String(match.id), input.rooftopId)
      roots.set(root.id, root)
    }
    if (roots.size !== 1) throw new Error('Customer contact details match multiple active records; operator review is required')
    const root = roots.values().next().value
    const current = await tx.prisma.customer.findUnique({
      where: { id: root.id },
      select: {
        id: true, firstName: true, lastName: true, primaryEmail: true, primaryPhone: true,
        normalizedEmail: true, normalizedPhone: true,
      },
    })
    if (!current) throw new Error('Customer identity is no longer available')
    const customer = await tx.prisma.customer.update({
      where: { id: current.id },
      data: {
        firstName: current.firstName || input.firstName,
        lastName: current.lastName || input.lastName,
        primaryEmail: current.primaryEmail || input.email,
        primaryPhone: current.primaryPhone || input.phone,
        normalizedEmail: current.normalizedEmail || normalizedEmail,
        normalizedPhone: current.normalizedPhone || normalizedPhone,
      },
    })
    return { customer, reused: true, duplicateCandidateCount: Math.max(0, matches.length - 1) }
  }

  const customer = await tx.prisma.customer.create({
    data: {
      rooftopId: input.rooftopId,
      firstName: input.firstName,
      lastName: input.lastName,
      primaryEmail: input.email,
      primaryPhone: input.phone,
      normalizedEmail,
      normalizedPhone,
      identityKey,
      status: 'active',
    },
  })
  return { customer, reused: false, duplicateCandidateCount: 0 }
}
