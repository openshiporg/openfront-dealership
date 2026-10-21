import type { GraphQLClient } from 'graphql-request'
import { SECTION_TYPES } from '../config/templates'

export type SeedEntity =
  | 'Dealership'
  | 'Make'
  | 'Model'
  | 'Vehicle'
  | 'ServicePackage'
  | 'Part'
  | 'FinanceProduct'
  | 'LeadRoutingRule'
  | 'AccountingMapping'
  | 'PaymentProvider'
  | 'Role'

export type SeedRecordResult = { id: string; name?: string; reused: boolean; rooftopId?: string }

export function validateDealershipSeed(data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose a setup before confirming')
  if (!data.dealership?.name) throw new Error('Setup requires a dealership name')
  for (const section of SECTION_TYPES) {
    if (section === 'dealership') continue
    if (!Array.isArray(data[section])) throw new Error(`Setup ${section} must be a list`)
  }
  const makes = new Set(data.vehicleMakes.map((make: any) => make.name))
  for (const model of data.vehicleModels) {
    if (!makes.has(model.make)) throw new Error(`Missing make for ${model.make} ${model.name}`)
  }
  const moneyFields: Array<[string, string[]]> = [
    ['vehicles', ['purchasePriceCents', 'listPriceCents', 'priceCents']],
    ['services', ['priceCents']],
    ['parts', ['costCents', 'priceCents']],
    ['financeProducts', ['retailPriceCents', 'costCents']],
  ]
  for (const [section, fields] of moneyFields) {
    for (const record of data[section]) {
      for (const field of fields) {
        if (!Number.isSafeInteger(record[field]) || record[field] < 0) {
          throw new Error(`${field} must be a whole number of cents in ${section}`)
        }
      }
    }
  }
}

export async function requestSeedRecord(client: Pick<GraphQLClient, 'request'>, entity: SeedEntity, data: any) {
  const result: any = await client.request(
    `mutation EnsureDealershipSetup($entity: String!, $data: JSON!) { ensureDealershipOnboardingRecord(entity: $entity, data: $data) }`,
    { entity, data }
  )
  const record = result?.ensureDealershipOnboardingRecord as SeedRecordResult | undefined
  if (!record?.id) throw new Error(`${entity} setup did not return a saved record`)
  return record
}

export async function runSeedPhases(
  start: () => Promise<{ success: boolean; error?: string }>,
  phases: Array<() => Promise<unknown>>,
  complete: () => Promise<{ success: boolean; error?: string }>
) {
  const started = await start()
  if (!started.success) throw new Error(started.error || 'Could not record setup progress')
  for (const phase of phases) await phase()
  const completed = await complete()
  if (!completed.success) throw new Error(completed.error || 'Could not complete setup')
}
