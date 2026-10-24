export type ApplicationSubmission = {
  id: string
  providerKey: string
  status: string
  externalReference: string | null
  errorCode: string | null
  queuedAt: string
  submittedAt: string | null
}

export type ApplicationDecision = {
  id: string
  providerKey: string
  decision: string
  externalReference: string | null
  approvedAmountCents: number | null
  aprBasisPoints: number | null
  termMonths: number | null
  monthlyPaymentCents: number | null
  reasonCodes: string[] | null
  decidedAt: string
  submission: { id: string } | null
  recordedBy: { id: string; name: string | null } | null
}

export type ApplicationDetail = {
  id: string
  reference: string
  status: string
  applicantName: string | null
  applicantEmail: string | null
  applicantPhone: string | null
  employmentStatus: string | null
  annualIncomeCents: number | null
  selfReportedCreditTier: string | null
  requestedAmountCents: number | null
  plannedMonthlyPaymentCents: number | null
  plannedDownPaymentCents: number | null
  tradeInValueCents: number | null
  aprBasisPoints: number | null
  loanTermMonths: number | null
  consentAt: string | null
  submittedAt: string | null
  lockedAt: string | null
  rooftop: { id: string; name: string } | null
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    status: string | null
    tasks: Array<{ id: string; title: string | null; dueDate: string | null; completed: boolean | null; priority: string | null }>
    deals: Array<{ id: string; status: string | null; updatedAt: string | null }>
  } | null
  vehicle: { id: string; year: number | null; make: string | null; model: string | null; trim: string | null; stockNumber: string | null; vin: string | null; priceCents: number | null } | null
  submissions: ApplicationSubmission[]
  decisions: ApplicationDecision[]
}
