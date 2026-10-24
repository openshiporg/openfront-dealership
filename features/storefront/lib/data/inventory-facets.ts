import { fetchGraphQL } from './graphql-client'

// Lightweight read of the listed (publicly available) inventory, used to build
// make/model facets and the test-drive vehicle picker. The public query caps a
// page at 100 rows, so a few pages are read in sequence.
export const GET_INVENTORY_OPTIONS = `
  query GetInventoryOptions($where: JSON, $orderBy: JSON, $take: Int, $skip: Int) {
    publicInventoryVehicles(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      totalCount
      items { id stockNumber year make model trim price }
    }
  }
`

export type InventoryOption = {
  id: string
  stockNumber: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  price: number | null
}

export type InventoryFacets = {
  makes: string[]
  modelsByMake: Record<string, string[]>
}

const PAGE = 100
const MAX_PAGES = 10

export async function fetchListedInventoryOptions(): Promise<InventoryOption[]> {
  const items: InventoryOption[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await fetchGraphQL<{ publicInventoryVehicles: { totalCount: number; items: InventoryOption[] } }>(
      GET_INVENTORY_OPTIONS,
      {
        where: { AND: [{ status: { equals: 'available' } }] },
        orderBy: [{ year: 'desc' }],
        take: PAGE,
        skip: page * PAGE,
      }
    )
    const result = data.publicInventoryVehicles
    items.push(...(result?.items ?? []))
    if (!result || items.length >= result.totalCount || (result.items ?? []).length < PAGE) break
  }
  return items
}

const clean = (value: string | null | undefined) => String(value ?? '').trim()
const byName = (a: string, b: string) => a.localeCompare(b, 'en-US', { sensitivity: 'base' })

export function buildInventoryFacets(items: InventoryOption[]): InventoryFacets {
  const models = new Map<string, Set<string>>()
  for (const item of items) {
    const make = clean(item.make)
    if (!make) continue
    const key = [...models.keys()].find((existing) => existing.toLowerCase() === make.toLowerCase()) ?? make
    if (!models.has(key)) models.set(key, new Set())
    const model = clean(item.model)
    if (model) models.get(key)!.add(model)
  }
  const makes = [...models.keys()].sort(byName)
  return {
    makes,
    modelsByMake: Object.fromEntries(makes.map((make) => [make, [...models.get(make)!].sort(byName)])),
  }
}

export function facetModels(facets: InventoryFacets, make: string) {
  const key = facets.makes.find((existing) => existing.toLowerCase() === make.trim().toLowerCase())
  if (key) return facets.modelsByMake[key] ?? []
  return [...new Set(Object.values(facets.modelsByMake).flat())].sort(byName)
}
