import type { DeskFinanceEvidence } from './financeEvidence'

export type FinanceLead = {
  id: string
  rooftop: { id: string }
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  status: string | null
  createdAt: string | null
  interestedVehicle: { id: string; year: number | null; make: string | null; model: string | null; stockNumber: string | null; priceCents: number | null } | null
  tasks: { id: string; title: string | null; dueDate: string | null; completed: boolean | null; priority: string | null }[]
}

export type FinanceSubmission = {
  id: string
  providerKey: string
  providerMode: string
  externalRequestSent: boolean
  status: string
  externalReference: string | null
  queuedAt: string
}

export type FinanceDecision = {
  id: string
  providerKey: string
  decision: string
  approvedAmountCents: number | null
  aprBasisPoints: number | null
  termMonths: number | null
  monthlyPaymentCents: number | null
  reasonCodes: string[]
  decidedAt: string
}

export type FinanceApplication = {
  id: string
  reference: string | null
  status: string
  applicantName: string | null
  requestedAmountCents: number | null
  submittedAt: string | null
  vehicle: { id: string; year: number | null; make: string | null; model: string | null; stockNumber: string | null; priceCents: number | null } | null
  lead: FinanceLead | null
  submissions: FinanceSubmission[]
  decisions: FinanceDecision[]
}

export type FinanceProduct = { id: string; rooftop: { id: string } | null; code: string; name: string; category: string; providerKey: string; retailPriceCents: number; costCents: number | null }
export type ProductQuote = { id: string; deal: { id: string } | null; product: { id: string; code: string } | null; status: string }
export type ProductCancellation = { id: string; deal: { id: string } | null; productCode: string; status: string }
export type FinanceMenu = { id: string; deal: { id: string } | null; version: number; status: string; optionsSnapshot: Array<{ code: string }> | null }
export type ComplianceCheck = { id: string; deal: { id: string } | null; checkType: string; status: string }
export type ContractPackage = { id: string; deal: { id: string } | null; status: string; documentChecklist: Array<{ code: string; status: string }> | null }
export type FundingCase = { id: string; deal: { id: string } | null; status: string; exceptions: Array<{ status: string }> | null; updatedAt: string; immutableEvidence: unknown }

export type Deal = {
  id: string
  worksheetVersion: number
  financeEvidence: DeskFinanceEvidence | null
  rooftop: { id: string; name: string } | null
  vehiclePrice: number | null
  tradeInValue: number | null
  downPayment: number | null
  financingAmount: number | null
  monthlyPayment: number | null
  loanTerm: number | null
  apr: number | null
  taxAmount: number | null
  status: string | null
  totalPrice: number | null
  profit: number | null
  createdAt: string | null
  updatedAt: string | null
  salesperson: { id: string; name: string | null } | null
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null
  vehicle: { id: string; year: number | null; make: string | null; model: string | null; stockNumber: string | null; vin: string | null; purchasePrice: number | null } | null
  approvals: { id: string; decision: string | null; approvalDate: string | null; notes: string | null; approver: { id?: string; name: string | null } | null }[]
}

export type FinanceWorkspace = {
  deals: Deal[]
  applications: FinanceApplication[]
  products: FinanceProduct[]
  productQuotes: ProductQuote[]
  productCancellations: ProductCancellation[]
  menus: FinanceMenu[]
  complianceChecks: ComplianceCheck[]
  contractPackages: ContractPackage[]
  fundingCases: FundingCase[]
}
