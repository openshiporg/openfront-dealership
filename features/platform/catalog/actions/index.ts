'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { ROOFTOP_STAFF_QUERY } from '@/features/platform/lib/rooftopStaffQuery'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

const CATALOG_PATH = '/dashboard/platform/catalog'

export type CatalogModel = { id: string; name: string; bodyStyle: string | null; baseYear: number | null }
export type CatalogMake = { id: string; name: string; modelsCount: number; models: CatalogModel[] }
export type CatalogRooftop = { id: string; name: string }
export type IncludedService = { service: string; description?: string }
export type CatalogServicePackage = {
  id: string
  name: string
  description: string | null
  priceCents: number
  estimatedDuration: number | null
  includedServices: IncludedService[] | null
  rooftop: CatalogRooftop | null
  updatedAt: string
}
export type CatalogRoutingRule = {
  id: string
  name: string
  routeKey: string
  active: boolean
  priority: number
  source: string
  firstResponseMinutes: number
  assignee: { id: string; name: string | null; email: string | null } | null
  rooftop: CatalogRooftop | null
  updatedAt: string
}
export type InventoryPair = { make: string; model: string; units: number }

type Section<T> = { data: T; error: string | null }

export type CatalogData = {
  makes: Section<CatalogMake[]>
  inventoryPairs: InventoryPair[]
  servicePackages: Section<CatalogServicePackage[]>
  routingRules: Section<CatalogRoutingRule[]>
  rooftops: CatalogRooftop[]
  currencyCode: string
}

export async function getCatalogMakes(): Promise<Section<CatalogMake[]>> {
  const response = await keystoneClient<{ makes: CatalogMake[] | null }>(`
    query CatalogMakes {
      makes(orderBy: { name: asc }, take: 500) {
        id name modelsCount
        models(orderBy: { name: asc }) { id name bodyStyle baseYear }
      }
    }
  `, {}, { cache: 'no-store' })
  if (!response.success) return { data: [], error: response.error }
  return { data: (response.data.makes || []).map(make => ({ ...make, models: make.models || [] })), error: null }
}

/** Make and model pairs typed on inventory units, so the catalog can be filled from stock. */
async function getInventoryPairs(): Promise<InventoryPair[]> {
  const response = await keystoneClient<{ vehicles: Array<{ make: string | null; model: string | null }> | null }>(`
    query CatalogInventoryPairs { vehicles(take: 1000, orderBy: [{ id: asc }]) { make model } }
  `, {}, { cache: 'no-store' })
  if (!response.success) return []
  const pairs = new Map<string, InventoryPair>()
  for (const vehicle of response.data.vehicles || []) {
    const make = String(vehicle.make || '').trim()
    const model = String(vehicle.model || '').trim()
    if (!make || !model) continue
    const key = `${make.toLowerCase()}|${model.toLowerCase()}`
    const current = pairs.get(key)
    if (current) current.units += 1
    else pairs.set(key, { make, model, units: 1 })
  }
  return [...pairs.values()].sort((left, right) => left.make.localeCompare(right.make) || left.model.localeCompare(right.model))
}

export async function getCatalogServicePackages(): Promise<Section<CatalogServicePackage[]>> {
  const response = await keystoneClient<{ servicePackages: CatalogServicePackage[] | null }>(`
    query CatalogServicePackages {
      servicePackages(orderBy: [{ name: asc }], take: 500) {
        id name description priceCents estimatedDuration includedServices updatedAt
        rooftop { id name }
      }
    }
  `, {}, { cache: 'no-store' })
  if (!response.success) return { data: [], error: response.error }
  return { data: response.data.servicePackages || [], error: null }
}

export async function getCatalogRoutingRules(): Promise<Section<CatalogRoutingRule[]>> {
  const response = await keystoneClient<{ leadRoutingRules: CatalogRoutingRule[] | null }>(`
    query CatalogRoutingRules {
      leadRoutingRules(orderBy: [{ priority: desc }, { routeKey: asc }], take: 500) {
        id name routeKey active priority source firstResponseMinutes updatedAt
        assignee { id name email }
        rooftop { id name }
      }
    }
  `, {}, { cache: 'no-store' })
  if (!response.success) return { data: [], error: response.error }
  return { data: response.data.leadRoutingRules || [], error: null }
}

async function getCatalogRooftops(): Promise<{ rooftops: CatalogRooftop[]; currencyCode: string }> {
  const [response, profile] = await Promise.all([
    keystoneClient<{ rooftops: CatalogRooftop[] | null }>(`query CatalogRooftops { rooftops(orderBy: { name: asc }, take: 100) { id name } }`, {}, { cache: 'no-store' }),
    keystoneClient<{ dealershipProfile: { currencyCode: string | null } | null }>(`query CatalogCurrency { dealershipProfile { currencyCode } }`, {}, { cache: 'no-store' }),
  ])
  return {
    rooftops: response.success ? response.data.rooftops || [] : [],
    currencyCode: (profile.success && profile.data.dealershipProfile?.currencyCode) || 'USD',
  }
}

export async function getCatalogData(): Promise<CatalogData> {
  const [makes, inventoryPairs, servicePackages, routingRules, { rooftops, currencyCode }] = await Promise.all([
    getCatalogMakes(),
    getInventoryPairs(),
    getCatalogServicePackages(),
    getCatalogRoutingRules(),
    getCatalogRooftops(),
  ])
  return { makes, inventoryPairs, servicePackages, routingRules, rooftops, currencyCode }
}

type Result = { success: true } | { success: false; error: string }

function done(response: { success: boolean; error?: string }): Result {
  if (!response.success) return { success: false, error: response.error || 'Unable to save' }
  revalidatePath(CATALOG_PATH)
  return { success: true }
}

/* Makes and models (open CRUD, canManageInventory) */

export async function saveMake(input: { id?: string; name: string }): Promise<Result> {
  const name = input.name.trim()
  if (!name) return { success: false, error: 'Name is required' }
  const response = input.id
    ? await keystoneClient(`mutation UpdateMake($id: ID!, $data: MakeUpdateInput!) { updateMake(where: { id: $id }, data: $data) { id } }`, { id: input.id, data: { name } })
    : await keystoneClient(`mutation CreateMake($data: MakeCreateInput!) { createMake(data: $data) { id } }`, { data: { name } })
  return done(response)
}

export async function deleteMake(id: string): Promise<Result> {
  return done(await keystoneClient(`mutation DeleteMake($id: ID!) { deleteMake(where: { id: $id }) { id } }`, { id }))
}

export type ModelInput = { id?: string; makeId: string; name: string; bodyStyle: string | null; baseYear: number | null }

export async function saveModel(input: ModelInput): Promise<Result> {
  const name = input.name.trim()
  if (!name) return { success: false, error: 'Name is required' }
  const data = { name, bodyStyle: input.bodyStyle || null, baseYear: input.baseYear, make: { connect: { id: input.makeId } } }
  const response = input.id
    ? await keystoneClient(`mutation UpdateModel($id: ID!, $data: ModelUpdateInput!) { updateModel(where: { id: $id }, data: $data) { id } }`, { id: input.id, data })
    : await keystoneClient(`mutation CreateModel($data: ModelCreateInput!) { createModel(data: $data) { id } }`, { data })
  return done(response)
}

export async function deleteModel(id: string): Promise<Result> {
  return done(await keystoneClient(`mutation DeleteModel($id: ID!) { deleteModel(where: { id: $id }) { id } }`, { id }))
}

/** Adds the given inventory pairs to the catalog, creating any make that does not exist yet. */
export async function addInventoryPairs(pairs: Array<{ make: string; model: string }>): Promise<Result & { added?: number }> {
  if (!pairs.length) return { success: false, error: 'Nothing to add' }
  const current = await getCatalogMakes()
  if (current.error) return { success: false, error: current.error }
  const makeIds = new Map(current.data.map(make => [make.name.toLowerCase(), make.id]))
  const existing = new Set(current.data.flatMap(make => make.models.map(model => `${make.name.toLowerCase()}|${model.name.toLowerCase()}`)))
  const wanted = pairs
    .map(pair => ({ make: pair.make.trim(), model: pair.model.trim() }))
    .filter(pair => pair.make && pair.model && !existing.has(`${pair.make.toLowerCase()}|${pair.model.toLowerCase()}`))
  const unique = [...new Map(wanted.map(pair => [`${pair.make.toLowerCase()}|${pair.model.toLowerCase()}`, pair])).values()]
  if (!unique.length) return { success: true, added: 0 }

  const newMakes = [...new Map(unique.filter(pair => !makeIds.has(pair.make.toLowerCase())).map(pair => [pair.make.toLowerCase(), pair.make])).values()]
  if (newMakes.length) {
    const created = await keystoneClient<{ createMakes: Array<{ id: string; name: string }> }>(
      `mutation CreateCatalogMakes($data: [MakeCreateInput!]!) { createMakes(data: $data) { id name } }`,
      { data: newMakes.map(name => ({ name })) },
    )
    if (!created.success) return { success: false, error: created.error }
    for (const make of created.data.createMakes || []) makeIds.set(make.name.toLowerCase(), make.id)
  }
  const models = unique.map(pair => ({ name: pair.model, make: { connect: { id: makeIds.get(pair.make.toLowerCase()) } } }))
  const createdModels = await keystoneClient(`mutation CreateCatalogModels($data: [ModelCreateInput!]!) { createModels(data: $data) { id } }`, { data: models })
  if (!createdModels.success) return { success: false, error: createdModels.error }
  revalidatePath(CATALOG_PATH)
  return { success: true, added: unique.length }
}

/* Service packages (open CRUD, canManageService, rooftop-scoped) */

export type ServicePackageInput = {
  id?: string
  rooftopId: string
  name: string
  description: string
  priceCents: number
  estimatedDuration: number | null
  includedServices: IncludedService[]
}

export async function saveServicePackage(input: ServicePackageInput): Promise<Result> {
  const data = {
    name: input.name.trim(),
    description: input.description.trim(),
    priceCents: input.priceCents,
    estimatedDuration: input.estimatedDuration,
    includedServices: input.includedServices,
  }
  const response = input.id
    ? await keystoneClient(`mutation UpdateServicePackage($id: ID!, $data: ServicePackageUpdateInput!) { updateServicePackage(where: { id: $id }, data: $data) { id } }`, { id: input.id, data })
    : await keystoneClient(`mutation CreateServicePackage($data: ServicePackageCreateInput!) { createServicePackage(data: $data) { id } }`, { data: { ...data, rooftop: { connect: { id: input.rooftopId } } } })
  return done(response)
}

export async function deleteServicePackage(id: string): Promise<Result> {
  return done(await keystoneClient(`mutation DeleteServicePackage($id: ID!) { deleteServicePackage(where: { id: $id }) { id } }`, { id }))
}

/* Lead routing rules (configureLeadRoutingRule; delete is open CRUD with canManageLeads) */

export async function getRoutingStaff(rooftopId: string) {
  const response = await keystoneClient<{ users: Array<{ id: string; name: string }> }>(ROOFTOP_STAFF_QUERY, { rooftopId }, { cache: 'no-store' })
  return response.success ? { success: true as const, users: response.data.users || [] } : { success: false as const, error: response.error }
}

export type RoutingRuleInput = {
  ruleId?: string
  rooftopId: string
  name: string
  source: string
  assigneeId: string
  priority: number
  firstResponseMinutes: number
  active: boolean
  idempotencyKey: string
}

export async function configureRoutingRule(input: RoutingRuleInput): Promise<Result> {
  const response = await operatorCommandRequest<{ configureLeadRoutingRule: { id: string } }>(`
    mutation ConfigureLeadRoutingRule($data: ConfigureLeadRoutingRuleInput!) {
      configureLeadRoutingRule(data: $data) { id status updatedAt reused }
    }
  `, { data: { ...input, ruleId: input.ruleId || null } })
  return done(response)
}

export async function deleteRoutingRule(id: string): Promise<Result> {
  return done(await keystoneClient(`mutation DeleteLeadRoutingRule($id: ID!) { deleteLeadRoutingRule(where: { id: $id }) { id } }`, { id }))
}
