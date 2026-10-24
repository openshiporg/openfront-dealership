'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

import type { DealMenuData } from '../lib/menuTypes'

export async function getDealFinanceMenu(dealId: string, rooftopId: string) {
  return keystoneClient<{ financeProducts: DealMenuData['products']; financeProductQuotes: DealMenuData['quotes']; financeMenuVersions: DealMenuData['menus'] }>(`
    query DealFinanceMenu($dealId: ID!, $rooftopId: ID!) {
      financeProducts(where: { rooftop: { id: { equals: $rooftopId } } }, orderBy: [{ name: asc }], take: 100) {
        id code name category active retailPriceCents costCents
      }
      financeProductQuotes(where: { deal: { id: { equals: $dealId } } }, orderBy: [{ requestedAt: desc }], take: 200) {
        id status retailPriceCents costCents evidenceReference requestedAt completedAt resultSnapshot product { id code }
      }
      financeMenuVersions(where: { deal: { id: { equals: $dealId } } }, orderBy: [{ version: desc }], take: 20) {
        id version status optionsSnapshot selectedProductCodes declinedProductCodes disclosureAcknowledgment presentedAt decidedAt
      }
    }
  `, { dealId, rooftopId }, { cache: 'no-store' })
}

async function mutate<T>(query: string, variables: Record<string, unknown>) {
  const response = await operatorCommandRequest<T>(query, variables)
  if (response.success) revalidatePath('/dashboard/platform/finance')
  return response
}

export async function quoteFinanceProduct(data: {
  dealId: string
  productId: string
  status: 'requested' | 'quoted' | 'failed'
  retailPriceCents: number | null
  costCents: number | null
  termMonths: number | null
  evidenceReference: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation QuoteFinanceProduct($data: RecordFinanceProductQuoteInput!) {
      recordFinanceProductQuote(data: $data) { id status }
    }
  `, { data })
}

export async function presentDealFinanceMenu(data: { dealId: string; expectedUpdatedAt: string | null; productCodes: string[]; idempotencyKey: string }) {
  return mutate(`
    mutation PresentDealFinanceMenu($data: PresentFinanceMenuInput!) {
      presentFinanceMenu(data: $data) { id status version }
    }
  `, { data })
}

export async function decideDealFinanceMenu(data: {
  dealId: string
  expectedUpdatedAt: string | null
  menuId: string
  selectedProductCodes: string[]
  declinedProductCodes: string[]
  disclosureAcknowledgment: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation DecideDealFinanceMenu($data: DecideFinanceMenuInput!) {
      decideFinanceMenu(data: $data) { id status }
    }
  `, { data })
}
