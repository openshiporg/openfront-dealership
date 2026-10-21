export type ServiceMenuPackage = {
  id: string
  name: string
  description: string | null
  price: number | null
  estimatedDuration: number | null
}

export type ServiceMenuState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'empty' }
  | { kind: 'ready'; packages: ServiceMenuPackage[] }

export type ServiceMenuReadResult = Exclude<ServiceMenuState, { kind: 'loading' }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isServiceMenuPackage(value: unknown): value is ServiceMenuPackage {
  if (!isRecord(value)) return false
  const { id, name, description, price, estimatedDuration } = value
  return typeof id === 'string' && id.trim() !== '' &&
    typeof name === 'string' && name.trim() !== '' &&
    (description === null || typeof description === 'string') &&
    (price === null || (typeof price === 'number' && Number.isFinite(price))) &&
    (estimatedDuration === null || (typeof estimatedDuration === 'number' && Number.isInteger(estimatedDuration)))
}

export function resolveServiceMenuResponse(value: unknown): ServiceMenuReadResult {
  if (!isRecord(value) || !Array.isArray(value.servicePackages)) return { kind: 'unavailable' }
  const packages = value.servicePackages.filter(isServiceMenuPackage)
  if (packages.length !== value.servicePackages.length) return { kind: 'unavailable' }
  if (packages.length === 0) return { kind: 'empty' }
  return { kind: 'ready', packages }
}

export async function readServiceMenu(read: () => Promise<unknown>): Promise<ServiceMenuReadResult> {
  try {
    return resolveServiceMenuResponse(await read())
  } catch {
    return { kind: 'unavailable' }
  }
}
