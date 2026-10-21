import { requestingAccountId } from './customerAccount'
import { resolveCustomerInTransaction } from './customerIdentity'
import { runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import {
  finiteNumber,
  optionalText,
  parseScheduledTime,
  requiredText,
  splitCustomerName,
  validEmail,
  validPhone,
} from './submissionUtils'

const SERVICES: Record<string, { serviceType: string; label: string; duration: number }> = {
  oil_change: { serviceType: 'maintenance', label: 'Oil Change', duration: 45 },
  brake_service: { serviceType: 'repair', label: 'Brake Service', duration: 120 },
  battery_service: { serviceType: 'maintenance', label: 'Battery Service', duration: 60 },
  diagnostics: { serviceType: 'diagnostic', label: 'Diagnostics', duration: 90 },
  tire_service: { serviceType: 'maintenance', label: 'Tire Service', duration: 90 },
  state_inspection: { serviceType: 'inspection', label: 'State Inspection', duration: 60 },
  scheduled_maintenance: { serviceType: 'maintenance', label: 'Scheduled Maintenance', duration: 120 },
  repair: { serviceType: 'repair', label: 'Repair', duration: 120 },
  other: { serviceType: 'diagnostic', label: 'Other / Initial Diagnosis', duration: 90 },
}

export async function submitServiceBooking(_root: unknown, { data }: { data: any }, context: any) {
  const customerName = requiredText(data.customerName, 'Customer name', 200)
  const email = validEmail(data.customerEmail)
  const phone = validPhone(data.customerPhone)
  const year = finiteNumber(data.vehicleYear, 'Vehicle year', {
    min: 1900,
    max: new Date().getFullYear() + 1,
    integer: true,
  })
  const make = requiredText(data.vehicleMake, 'Vehicle make', 100)
  const model = requiredText(data.vehicleModel, 'Vehicle model', 100)
  const vin = optionalText(data.vehicleVin, 17, 'VIN').toUpperCase()
  const serviceKey = requiredText(data.serviceType, 'Service type', 100)
  const service = SERVICES[serviceKey]
  if (!service) throw new SubmissionError('A supported service is required.')
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    throw new SubmissionError('VIN must be a valid 17-character identifier when provided.')
  }
  const requestedDate = requiredText(data.appointmentDate, 'Appointment date', 10)
  const requestedTime = requiredText(data.appointmentTime, 'Appointment time', 20)
  const concern = optionalText(data.description, 4000, 'Service concern') || `${service.label} requested from storefront.`
  const vehicleDescription = `${year} ${make} ${model}${vin ? ` · VIN ${vin}` : ''}`
  const { firstName, lastName } = splitCustomerName(customerName, 'Service', 'Customer')

  return runPublicSubmission({
    context,
    workflow: 'service',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      customerName,
      email,
      phone,
      year,
      make,
      model,
      vin,
      serviceKey,
      requestedDate,
      requestedTime,
      concern,
    },
    aggregateType: 'ServiceAppointment',
    topic: 'public-service-appointment.submitted',
    aggregateId: result => String(result.serviceAppointmentId),
    handler: async (transactionContext, { rooftopId }) => {
      const location = await transactionContext.prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { timezone: true } })
      const scheduled = parseScheduledTime(requestedDate, requestedTime, 'Appointment', location?.timezone || 'UTC')
      const slotStart = new Date(scheduled.iso)
      slotStart.setUTCMinutes(0, 0, 0)
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const capacitySlot = slotStart.toISOString()
      await transactionContext.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service-capacity:${rooftopId}:${capacitySlot}`}, 0))`
      const scheduledCount = await transactionContext.prisma.serviceAppointment.count({
        where: {
          rooftopId,
          appointmentDate: { gte: slotStart, lt: slotEnd },
          status: { not: 'cancelled' },
        },
      })
      if (scheduledCount >= 4) {
        throw new SubmissionError('That service capacity slot is full. Choose another time.')
      }
      const rooftop = { connect: { id: rooftopId } }
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const appointment = await transactionContext.sudo().query.ServiceAppointment.createOne({
        data: {
          rooftop,
          ...(requestingAccountId(context) ? { requestedBy: { connect: { id: requestingAccountId(context)! } } } : {}),
          appointmentDate: scheduled.iso,
          serviceType: service.serviceType,
          status: 'scheduled',
          vehicleVin: vin || '',
          transportationNeed: 'drop-off',
          capacitySlot,
          customerVehicleDescription: vehicleDescription,
          description: concern,
          estimatedDuration: service.duration,
          advisorNotes: [
            `Requested service: ${service.label}`,
            `Requested slot: ${scheduled.date} at ${scheduled.time}`,
            vin ? `Customer vehicle VIN: ${vin}` : 'Customer vehicle VIN not provided',
          ].join('\n'),
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
              notes: [
                `Service appointment request for ${service.label}.`,
                `Customer vehicle: ${vehicleDescription}.`,
                `Requested slot: ${scheduled.date} at ${scheduled.time}.`,
                `Customer concern: ${concern}`,
              ].join('\n'),
            },
          },
        },
        query: 'id appointmentDate serviceType status lead { id }',
      })
      return {
        serviceAppointmentId: appointment.id,
        leadId: appointment.lead.id,
        appointmentDate: new Date(appointment.appointmentDate),
        serviceType: appointment.serviceType,
        status: appointment.status,
        requestedServiceLabel: service.label,
      }
    },
  })
}
