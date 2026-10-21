'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { ROOFTOP_STAFF_QUERY } from '@/features/platform/lib/rooftopStaffQuery'
import type { MoneyLine } from '@/features/keystone/lifecycle/dealPricing'

export type DealDeskDeal = {
  id: string
  vehiclePriceCents: number | null
  totalPriceCents: number | null
  status: string
  saleDate: string | null
  createdAt: string
  salesperson: { id: string; name: string } | null
  lead: { id: string; firstName: string; lastName: string } | null
  vehicle: { id: string; year: number; make: string; model: string; stockNumber: string } | null
}

export type DealLenderOffer = {
  id: string
  providerKey: string
  decision: string
  approvedAmountCents: number | null
  aprBasisPoints: number | null
  termMonths: number | null
  monthlyPaymentCents: number | null
  selected: boolean
}

export type DealWorksheetVersion = { id: string; snapshot: any; occurredAt: string }

export type DealSetupVehicle = {
  id: string
  stockNumber: string
  year: number
  make: string
  model: string
  price: number
  purchasePrice: number
  rooftop: { id: string }
}

export type DealSetupLead = { id: string; firstName: string; lastName: string; email: string; phone: string }

export type DomainTimelineEntry = { id: string; action: string; occurredAt: string; afterSnapshot: unknown; actor: { name: string } | null }

type DealCommandResult = { id: string; status: string; reused: boolean; updatedAt: string }

function revalidateDeal(dealId?: string) {
  revalidatePath('/dashboard/platform/deals')
  if (dealId) revalidatePath(`/dashboard/platform/deals/${dealId}`)
}

export async function getDealDeskWorkspace(status: string) {
  return keystoneClient<{ dealDeskWorkspace: { deals: DealDeskDeal[] } }>(`
    query DealDeskWorkspace($status: String) {
      dealDeskWorkspace(status: $status, limit: 100) {
        deals { id vehiclePriceCents totalPriceCents status saleDate createdAt salesperson { id name } lead { id firstName lastName } vehicle { id year make model stockNumber } }
      }
    }
  `, { status }, { cache: 'no-store' })
}

export async function getDealWorkspace(id: string) {
  return keystoneClient<{ dealWorkspace: { deal: any; worksheetVersions: DealWorksheetVersion[] } }>(`
    query DealWorkspace($id: ID!) {
      dealWorkspace(id: $id) {
        deal { id financeEvidence vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents loanTerm apr taxAmountCents totalPriceCents fees rebates products taxLines residualValueCents moneyFactorBasisPoints status structureType worksheetVersion presentedAt acceptedAt saleDate createdAt updatedAt salesperson { id name } lead { id firstName lastName } vehicle { id year make model trim stockNumber vin priceCents } approvals { id decision approvalDate notes approver { name } } }
        worksheetVersions { id snapshot occurredAt }
      }
    }
  `, { id }, { cache: 'no-store' })
}

export async function getDealLenderOffers(dealId: string) {
  return keystoneClient<{ dealLenderOffers: DealLenderOffer[] }>(`
    query DealLenderOffers($dealId: ID!) {
      dealLenderOffers(dealId: $dealId) { id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents selected }
    }
  `, { dealId }, { cache: 'no-store' })
}

export async function getDealTimeline(aggregateType: 'Deal' | 'FinanceFundingCase' | 'DeliveryCase', aggregateId: string) {
  return keystoneClient<{ domainTimeline: DomainTimelineEntry[] }>(`
    query DealTimeline($aggregateType: String!, $aggregateId: ID!) {
      domainTimeline(aggregateType: $aggregateType, aggregateId: $aggregateId, limit: 20) {
        id action occurredAt afterSnapshot actor { name }
      }
    }
  `, { aggregateType, aggregateId }, { cache: 'no-store' })
}

export async function getDealSetupOptions() {
  const [vehicles, leads] = await Promise.all([
    keystoneClient<{ vehicles: DealSetupVehicle[] }>(`
      query DealSetupVehicles { vehicles(where: { status: { equals: "available" } }) { id stockNumber year make model price purchasePrice rooftop { id } } }
    `, {}, { cache: 'no-store' }),
    keystoneClient<{ leads: DealSetupLead[] }>(`
      query DealSetupLeads { leads(where: { status: { not: { equals: "closed-lost" } } }) { id firstName lastName email phone } }
    `, {}, { cache: 'no-store' }),
  ])
  if (!vehicles.success) return { success: false as const, error: vehicles.error }
  if (!leads.success) return { success: false as const, error: leads.error }
  return { success: true as const, data: { vehicles: vehicles.data.vehicles || [], leads: leads.data.leads || [] } }
}

export async function getRooftopSalespeople(rooftopId: string) {
  return keystoneClient<{ users: Array<{ id: string; name: string }> }>(ROOFTOP_STAFF_QUERY, { rooftopId }, { cache: 'no-store' })
}

export async function createDealPencil(data: {
  rooftopId: string
  vehicleId: string
  leadId?: string
  salespersonId?: string
  vehiclePriceCents: number
  tradeInValueCents: number
  downPaymentCents: number
  idempotencyKey: string
}) {
  const response = await keystoneClient<{ createDealPencil: { id: string } | null }>(`
    mutation CreateDealPencil($data: CreateDealPencilInput!) {
      createDealPencil(data: $data) { id }
    }
  `, { data })
  if (response.success) revalidateDeal()
  return response
}

export async function saveDealWorksheet(data: {
  dealId: string
  structureType: string
  vehiclePriceCents: number
  tradeInValueCents: number
  downPaymentCents: number
  monthlyPaymentCents: number
  loanTerm: number | null
  apr: number | null
  residualValueCents: number | null
  moneyFactorBasisPoints: number | null
  fees: MoneyLine[]
  rebates: MoneyLine[]
  products: MoneyLine[]
  taxLines: MoneyLine[]
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}) {
  const response = await keystoneClient<{ saveDealWorksheet: DealCommandResult }>(`
    mutation SaveDealWorksheet($data: SaveDealWorksheetInput!) {
      saveDealWorksheet(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidateDeal(data.dealId)
  return response
}

export async function presentDealWorksheet(data: { dealId: string; expectedUpdatedAt: string; idempotencyKey: string }) {
  const response = await keystoneClient<{ presentDealWorksheet: DealCommandResult }>(`
    mutation PresentDealWorksheet($data: PresentDealWorksheetInput!) {
      presentDealWorksheet(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidateDeal(data.dealId)
  return response
}

export async function acceptDealWorksheet(data: { dealId: string; expectedUpdatedAt: string; acknowledgment: string; idempotencyKey: string }) {
  const response = await keystoneClient<{ acceptDealWorksheet: DealCommandResult }>(`
    mutation AcceptDealWorksheet($data: AcceptDealWorksheetInput!) {
      acceptDealWorksheet(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidateDeal(data.dealId)
  return response
}

export async function selectDealLenderOffer(data: { dealId: string; lenderDecisionId: string; expectedUpdatedAt: string; idempotencyKey: string }) {
  const response = await keystoneClient<{ selectDealLenderOffer: DealCommandResult }>(`
    mutation SelectDealLenderOffer($data: SelectDealLenderOfferInput!) {
      selectDealLenderOffer(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidateDeal(data.dealId)
  return response
}

export async function reopenDealWorksheet(data: { dealId: string; expectedUpdatedAt: string; reason: string; idempotencyKey: string }) {
  const response = await keystoneClient<{ reopenDealWorksheet: DealCommandResult }>(`
    mutation ReopenDealWorksheet($data: ReopenDealWorksheetInput!) {
      reopenDealWorksheet(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidateDeal(data.dealId)
  return response
}

export async function transitionDeal(input: { id: string; toStatus: string; notes: string; idempotencyKey: string }) {
  const response = await keystoneClient<{ transitionDeal: { id: string; status: string; saleDate: string | null; lockedAt: string | null } | null }>(`
    mutation TransitionDeal($id: ID!, $toStatus: String!, $notes: String, $idempotencyKey: String!) {
      transitionDeal(id: $id, toStatus: $toStatus, notes: $notes, idempotencyKey: $idempotencyKey) { id status saleDate lockedAt }
    }
  `, input)
  if (response.success) revalidateDeal(input.id)
  return response
}
