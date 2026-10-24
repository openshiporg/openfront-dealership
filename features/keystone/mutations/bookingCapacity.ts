import { SubmissionError } from './submissionErrors'

export const SERVICE_SLOT_CAPACITY = 4
// A test drive holds its vehicle for this long; two drives of one vehicle may not overlap.
export const TEST_DRIVE_HOLD_MINUTES = 60

// Call inside a transaction. Locks the rooftop's hourly service slot and rejects a full slot.
export async function assertServiceSlotCapacity(tx: any, rooftopId: string, scheduledIso: string, excludeAppointmentId?: string) {
  const slotStart = new Date(scheduledIso)
  slotStart.setUTCMinutes(0, 0, 0)
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)
  const capacitySlot = slotStart.toISOString()
  await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service-capacity:${rooftopId}:${capacitySlot}`}, 0))`
  const scheduledCount = await tx.prisma.serviceAppointment.count({
    where: {
      rooftopId,
      appointmentDate: { gte: slotStart, lt: slotEnd },
      status: { not: 'cancelled' },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  })
  if (scheduledCount >= SERVICE_SLOT_CAPACITY) {
    throw new SubmissionError('That service capacity slot is full. Choose another time.')
  }
  return capacitySlot
}

// Call inside a transaction. Locks the vehicle's schedule and rejects an overlapping open drive.
export async function assertTestDriveVehicleCapacity(tx: any, vehicleId: string, scheduledIso: string, excludeTestDriveId?: string) {
  const start = new Date(scheduledIso)
  const hold = TEST_DRIVE_HOLD_MINUTES * 60 * 1000
  await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`test-drive-capacity:${vehicleId}`}, 0))`
  const overlapping = await tx.prisma.testDrive.count({
    where: {
      vehicleId,
      noShow: false,
      cancelledAt: null,
      scheduledTime: { gt: new Date(start.getTime() - hold), lt: new Date(start.getTime() + hold) },
      ...(excludeTestDriveId ? { id: { not: excludeTestDriveId } } : {}),
    },
  })
  if (overlapping > 0) {
    throw new SubmissionError('This vehicle is already booked at that time. Choose another time.')
  }
}
