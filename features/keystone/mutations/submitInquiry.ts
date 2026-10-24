import { resolveCustomerInTransaction } from './customerIdentity'
import { runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import { optionalText, requiredText, resolveAvailableVehicle, validEmail, validPhone } from './submissionUtils'

const INTENTS: Record<string, string> = {
  'general-contact': 'General contact request',
  'vehicle-question': 'Vehicle question',
  'get-quote': 'Price quote request',
  // Reserve this vehicle: a hold request for staff. It does not change the vehicle's status;
  // only a deal moves inventory to pending, so an anonymous request cannot pull a car offline.
  'reserve-vehicle': 'Vehicle reservation request',
}
const CONTACTS = new Set(['email', 'phone', 'text'])

export async function submitInquiry(_root: unknown, { data }: { data: any }, context: any) {
  const firstName = requiredText(data.firstName, 'First name', 100)
  const lastName = requiredText(data.lastName, 'Last name', 100)
  const email = validEmail(data.email)
  const phone = validPhone(data.phone, false)
  const message = optionalText(data.message, 4000, 'Message')
  const intent = requiredText(data.intent, 'Inquiry type', 50)
  const preferredContact = optionalText(data.preferredContact || 'email', 20, 'Preferred contact')
  const intentLabel = INTENTS[intent]
  if (!intentLabel || !CONTACTS.has(preferredContact)) {
    throw new SubmissionError('Inquiry type or preferred contact method is invalid.')
  }
  if ((preferredContact !== 'email' || intent !== 'general-contact') && !phone) {
    throw new SubmissionError('A phone number is required for this request.')
  }
  if ((intent === 'general-contact' || intent === 'vehicle-question') && !message) {
    throw new SubmissionError('A message is required for this request.')
  }
  if (intent !== 'general-contact' && !data.vehicleId) {
    throw new SubmissionError('A selected vehicle is required for this request.')
  }

  return runPublicSubmission({
    context,
    workflow: 'inquiry',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      firstName,
      lastName,
      email,
      phone,
      message,
      intent,
      preferredContact,
      vehicleId: optionalText(data.vehicleId, 100, 'Vehicle'),
    },
    aggregateType: 'Lead',
    topic: 'public-inquiry.submitted',
    aggregateId: result => String(result.leadId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId)
      const rooftop = { connect: { id: rooftopId } }
      const vehicleSummary = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})`
        : 'No inventory vehicle selected'
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const lead = await transactionContext.sudo().query.Lead.createOne({
        data: {
          rooftop,
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          email,
          phone,
          source: 'website',
          status: 'new',
          ...(intent === 'get-quote' || intent === 'reserve-vehicle' ? { timeframe: 'immediately' } : {}),
          notes: [
            `${intentLabel} submitted from storefront.`,
            `Preferred contact: ${preferredContact}.`,
            `Selected inventory: ${vehicleSummary}.`,
            message ? `Customer message: ${message}` : 'Customer did not include an additional message.',
          ].join('\n'),
          ...(vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}),
        },
        query: 'id',
      })
      return {
        leadId: lead.id,
        intent,
        intentLabel,
        preferredContact,
        selectedVehicle: vehicle,
      }
    },
  })
}
