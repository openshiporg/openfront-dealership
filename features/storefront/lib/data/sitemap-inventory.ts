import { openfrontClient } from '../config'
import { GET_VEHICLES } from './queries'
import { buildVehicleWhereInput } from './vehicle-inventory'

const PAGE_SIZE = 100
const MAX_PAGES = 50

// Ids of every publicly listed vehicle, paged through the public inventory query.
export async function listedVehicleIds(): Promise<string[]> {
  const ids: string[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await openfrontClient.request<{ publicInventoryVehicles: { totalCount: number; items: { id: string }[] } | null }>(GET_VEHICLES, {
        where: buildVehicleWhereInput(),
        orderBy: [{ year: 'desc' }],
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
      })
      const items = data.publicInventoryVehicles?.items ?? []
      for (const item of items) if (typeof item?.id === 'string' && item.id) ids.push(item.id)
      const total = data.publicInventoryVehicles?.totalCount ?? 0
      if (items.length < PAGE_SIZE || ids.length >= total) break
    }
  } catch {
    // The sitemap still lists the fixed pages when inventory can't be read.
  }
  return ids
}
