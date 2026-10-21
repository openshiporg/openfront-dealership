import { permissions } from '../access'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'

function cents(value: unknown, label: string) {
  const number = Number(value ?? 0)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be non-negative integer cents`)
  return number
}

export async function openServiceOrder(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error('Service management permission is required')
  }
  const appointmentId = String(data.appointmentId || '')
  const idempotencyKey = String(data.idempotencyKey || '').trim()
  if (!appointmentId || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new Error('Appointment and a valid idempotency key are required')
  }
  const appointment = await context.query.ServiceAppointment.findOne({
    where: { id: appointmentId },
    query: 'id rooftop { id } status serviceOrder { id } lead { id } customerVehicleDescription',
  })
  if (!appointment?.rooftop?.id) throw new Error('Service appointment not found or not accessible')
  await assertSessionRooftopPermission(context, appointment.rooftop.id, 'canManageService')
  if (appointment.serviceOrder?.id) throw new Error('Appointment already has a service order')
  if (['completed', 'cancelled'].includes(appointment.status)) throw new Error('Closed appointments cannot open repair orders')

  const rooftopId = appointment.rooftop.id
  const eventKey = `service-order-open:${idempotencyKey}`
  const evidence = {
    rooftopId,
    appointmentId,
    leadId: appointment.lead?.id ?? null,
    customerVehicleDescription: appointment.customerVehicleDescription,
    diagnosis: String(data.diagnosis || '').trim().slice(0, 4000),
    laborTotalCents: cents(data.laborTotalCents, 'Labor total'),
    partsTotalCents: cents(data.partsTotalCents, 'Parts total'),
    taxCents: cents(data.taxCents, 'Tax'),
    grandTotalCents: cents(data.grandTotalCents, 'Grand total'),
  }
  const orderId = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId, aggregateType: 'ServiceOrder', aggregateId: replay.aggregateId,
        action: 'opened', topic: 'service-order.opened', actorId: context.session.itemId,
        afterSnapshot: evidence, payload: { serviceOrderId: replay.aggregateId, rooftopId, status: 'estimate' },
      })
      return replay.aggregateId
    }
    const current = await tx.prisma.serviceAppointment.findUnique({ where: { id: appointmentId }, select: { serviceOrder: { select: { id: true } } } })
    if (current?.serviceOrder) throw new Error('Appointment already has a service order')
    const order = await tx.prisma.serviceOrder.create({
      data: {
        rooftopId,
        status: 'estimate',
        diagnosis: evidence.diagnosis,
        laborTotalCents: evidence.laborTotalCents,
        partsTotalCents: evidence.partsTotalCents,
        taxCents: evidence.taxCents,
        grandTotalCents: evidence.grandTotalCents,
      },
      select: { id: true },
    })
    const attached = await tx.prisma.serviceAppointment.updateMany({
      where: { id: appointmentId, rooftopId, serviceOrderId: null },
      data: { serviceOrderId: order.id },
    })
    if (attached.count !== 1) throw new Error('Appointment changed concurrently; reload and retry')
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'ServiceOrder', aggregateId: order.id,
      action: 'opened', topic: 'service-order.opened', actorId: context.session.itemId,
      afterSnapshot: evidence, payload: { serviceOrderId: order.id, rooftopId, status: 'estimate' },
    })
    return order.id
  }, { timeout: 30_000 })

  return context.db.ServiceOrder.findOne({ where: { id: orderId } })
}
