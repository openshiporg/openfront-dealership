export type HomeQueryState<T> =
  | { status: 'ready'; value: T }
  | { status: 'unavailable' }

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function loadHomeQuery<T>(
  request: () => Promise<unknown>,
  select: (response: unknown) => T | null,
): Promise<HomeQueryState<T>> {
  try {
    const value = select(await request())
    return value === null ? { status: 'unavailable' } : { status: 'ready', value }
  } catch {
    return { status: 'unavailable' }
  }
}

export function selectHomeFeaturedVehicles<T>(response: unknown): T[] | null {
  const inventory = record(record(response)?.publicInventoryVehicles)
  return Array.isArray(inventory?.items) ? inventory.items as T[] : null
}

export function selectHomeInventoryCount(response: unknown): number | null {
  const count = record(response)?.publicInventoryCount
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null
}
