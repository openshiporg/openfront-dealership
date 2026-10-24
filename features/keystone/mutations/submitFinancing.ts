import { resolveCustomerInTransaction } from './customerIdentity'
import { buildFinancingLeadContent } from './financingPrivacy'
import { dollarsToCents, financingReference } from './financingUtils'
import { publicSubmissionIdempotencyKey, runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import {
  finiteNumber,
  requiredText,
  resolveAvailableVehicle,
  splitCustomerName,
  validEmail,
  validPhone,
} from './submissionUtils'

const LOAN_TERMS = new Set([36, 48, 60, 72, 84])

function budgetRange(amount: number) {
  if (amount < 20000) return 'under-20k'
  if (amount < 30000) return '20-30k'
  if (amount < 40000) return '30-40k'
  if (amount < 50000) return '40-50k'
  if (amount < 75000) return '50-75k'
  if (amount < 100000) return '75-100k'
  return 'over-100k'
}

export async function submitFinancing(_root: unknown, { data }: { data: any }, context: any) {
  const fullName = requiredText(data.fullName, 'Full name', 200)
  const email = validEmail(data.email)
  const phone = validPhone(data.phone)
  const employmentStatus = requiredText(data.employmentStatus, 'Employment status', 100)
  const creditTier = requiredText(data.creditTier, 'Credit range', 100)
  const annualIncome = finiteNumber(data.annualIncome, 'Annual income', { min: 1, max: 100_000_000 })
  const requestedAmount = data.requestedAmount == null
    ? null
    : finiteNumber(data.requestedAmount, 'Requested amount', { min: 0, max: 10_000_000 })
  const monthlyPayment = data.monthlyPayment == null
    ? null
    : finiteNumber(data.monthlyPayment, 'Monthly payment', { min: 0, max: 1_000_000 })
  const downPayment = finiteNumber(data.downPayment || 0, 'Down payment', { min: 0, max: 10_000_000 })
  const tradeInValue = finiteNumber(data.tradeInValue || 0, 'Trade-in value', { min: 0, max: 10_000_000 })
  const apr = finiteNumber(data.apr || 0, 'APR', { min: 0, max: 40 })
  const loanTerm = finiteNumber(data.loanTerm || 0, 'Loan term', { min: 0, max: 120, integer: true })
  if (loanTerm && !LOAN_TERMS.has(loanTerm)) throw new SubmissionError('Loan term is unsupported.')
  if (data.consent !== true) {
    throw new SubmissionError('Contact consent is required.')
  }
  if (data.privacyAcknowledged !== true) {
    throw new SubmissionError('Privacy acknowledgement is required.')
  }
  const privacyAcknowledged = true

  const idempotencyKey = publicSubmissionIdempotencyKey(data.idempotencyKey)
  const { firstName, lastName } = splitCustomerName(fullName, 'Finance', 'Applicant')

  return runPublicSubmission({
    context,
    workflow: 'financing',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      fullName,
      email,
      phone,
      employmentStatus,
      creditTier,
      annualIncome,
      requestedAmount,
      monthlyPayment,
      downPayment,
      tradeInValue,
      apr,
      loanTerm,
      vehicleId: data.vehicleId || null,
      consent: true,
      privacyAcknowledged,
    },
    aggregateType: 'FinancingApplication',
    topic: 'financing-application.submitted',
    aggregateId: result => String(result.applicationId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId)
      const sudo = transactionContext.sudo()
      const existing = await sudo.query.FinancingApplication.findMany({
        where: { idempotencyKey: { equals: idempotencyKey } },
        take: 1,
        query: `
          id reference rooftop { id }
          lead { id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate } }
          vehicle { id vin stockNumber year make model price status }
        `,
      })
      if (existing.length) {
        const application = existing[0]
        if (application.rooftop?.id !== rooftopId) throw new SubmissionError('The idempotency key conflicts with another location.', 409, 'IDEMPOTENCY_CONFLICT')
        const task = application.lead?.tasks?.[0]
        return {
          applicationId: application.id,
          applicationReference: application.reference,
          leadId: application.lead?.id || null,
          taskId: task?.id || null,
          followUpDueAt: task?.dueDate ? new Date(task.dueDate) : null,
          vehicle: application.vehicle || null,
          applicationStatus: 'submitted',
          providerMode: 'operator-recorded',
          providerRequestSent: false,
        }
      }

      const due = new Date()
      due.setDate(due.getDate() + 1)
      const now = new Date()
      const reference = financingReference()
      const requestedAmountCents = requestedAmount == null ? null : dollarsToCents(requestedAmount, 'Requested amount')
      const plannedMonthlyPaymentCents = monthlyPayment == null ? null : dollarsToCents(monthlyPayment, 'Monthly payment')
      const plannedDownPaymentCents = dollarsToCents(downPayment, 'Down payment')
      const tradeInValueCents = dollarsToCents(tradeInValue, 'Trade-in value')
      const annualIncomeCents = dollarsToCents(annualIncome, 'Annual income', true)
      const aprBasisPoints = Math.round(apr * 100)
      const rooftop = { connect: { id: rooftopId } }
      const vehicleSummary = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})`
        : 'No vehicle selected'
      const { notes, taskDescription } = buildFinancingLeadContent({
        vehicleSummary,
        requestedAmount,
        monthlyPayment,
        downPayment,
        tradeInValue,
        apr,
        loanTerm,
      })
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const lead = await sudo.query.Lead.createOne({
        data: {
          rooftop,
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          email,
          phone,
          source: 'website',
          status: 'new',
          timeframe: 'immediately',
          ...(requestedAmount != null && requestedAmount > 0 ? { budgetRange: budgetRange(requestedAmount) } : {}),
          notes,
          ...(vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}),
          tasks: {
            create: [{
              rooftop,
              title: `F&I follow-up: ${fullName}`,
              description: taskDescription,
              priority: 'high',
              completed: false,
              dueDate: due.toISOString(),
            }],
          },
        },
        query: 'id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate }',
      })
      const immutableSnapshot = {
        version: 2,
        reference,
        applicant: {
          fullName,
          email,
          phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier,
        },
        requestedTerms: {
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null,
        },
        vehicle: vehicle ? {
          id: vehicle.id,
          vin: vehicle.vin,
          stockNumber: vehicle.stockNumber,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
        } : null,
        consentAt: now.toISOString(),
        privacyAcknowledgedAt: privacyAcknowledged ? now.toISOString() : null,
        providerMode: 'operator-recorded',
        providerRequestSent: false,
      }
      const application = await sudo.query.FinancingApplication.createOne({
        data: {
          rooftop,
          reference,
          idempotencyKey,
          status: 'submitted',
          lead: { connect: { id: lead.id } },
          ...(vehicle ? { vehicle: { connect: { id: vehicle.id } } } : {}),
          applicantName: fullName,
          applicantEmail: email,
          applicantPhone: phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier,
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null,
          consentAt: now.toISOString(),
          submittedAt: now.toISOString(),
          lockedAt: now.toISOString(),
          immutableSnapshot,
        },
        query: 'id reference',
      })
      const task = lead.tasks[0]
      return {
        applicationId: application.id,
        applicationReference: application.reference,
        leadId: lead.id,
        taskId: task.id,
        followUpDueAt: task.dueDate ? new Date(task.dueDate) : null,
        vehicle,
        applicationStatus: 'submitted',
        providerMode: 'operator-recorded',
        providerRequestSent: false,
      }
    },
  })
}
