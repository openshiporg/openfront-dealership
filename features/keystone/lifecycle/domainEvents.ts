import { createHash } from 'node:crypto'

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)])
    )
  }
  return value
}

export function stableJson(value: unknown) {
  return JSON.stringify(normalize(value))
}

export function domainEventRequestHash(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export type DomainEventInput = {
  eventKey: string
  rooftopId: string
  aggregateType: string
  aggregateId: string
  action: string
  topic: string
  actorId?: string | null
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  metadata?: unknown
  payload?: unknown
  occurredAt?: Date
}

function validateEvent(input: DomainEventInput) {
  for (const [label, value] of Object.entries({
    eventKey: input.eventKey,
    rooftopId: input.rooftopId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    action: input.action,
    topic: input.topic,
  })) {
    if (!String(value || '').trim()) throw new Error(`Domain event ${label} is required`)
  }
  if (input.eventKey.length > 240) throw new Error('Domain event key is too long')
}

export async function recordDomainEventInTransaction(transactionContext: any, input: DomainEventInput) {
  validateEvent(input)
  const prisma = transactionContext.prisma
  const request = {
    rooftopId: input.rooftopId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    action: input.action,
    topic: input.topic,
    beforeSnapshot: input.beforeSnapshot ?? null,
    afterSnapshot: input.afterSnapshot ?? null,
    metadata: input.metadata ?? {},
    payload: input.payload ?? input.afterSnapshot ?? {},
  }
  const requestHash = domainEventRequestHash(request)
  await prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`domain-event:${input.eventKey}`}, 0))`
  const existing = await prisma.domainAuditEvent.findUnique({
    where: { eventKey: input.eventKey },
    select: { id: true, requestHash: true },
  })
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error('Domain event idempotency key was reused with different evidence')
    }
    return { id: existing.id, reused: true }
  }

  const occurredAt = input.occurredAt ?? new Date()
  const audit = await prisma.domainAuditEvent.create({
    data: {
      rooftopId: input.rooftopId,
      eventKey: input.eventKey,
      requestHash,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      action: input.action,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      metadata: input.metadata ?? {},
      actorId: input.actorId ?? null,
      occurredAt,
    },
    select: { id: true },
  })
  await prisma.domainOutboxEvent.create({
    data: {
      rooftopId: input.rooftopId,
      deliveryKey: input.eventKey,
      topic: input.topic,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload ?? input.afterSnapshot ?? {},
      status: 'pending',
      attemptCount: 0,
      availableAt: occurredAt,
    },
  })
  return { id: audit.id, reused: false }
}

export async function recordDomainEvent(context: any, input: DomainEventInput) {
  return context.transaction(
    (transactionContext: any) => recordDomainEventInTransaction(transactionContext, input),
    { timeout: 30_000 }
  )
}
