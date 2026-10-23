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

// Packages with no charge or no bay time (e.g. counter parts sales) are not appointments.
export function isBookableServicePackage(pkg: ServiceMenuPackage) {
  if (pkg.price !== null && pkg.price <= 0) return false
  if (pkg.estimatedDuration !== null && pkg.estimatedDuration <= 0) return false
  return true
}

export function resolveServiceMenuResponse(value: unknown): ServiceMenuReadResult {
  if (!isRecord(value) || !Array.isArray(value.servicePackages)) return { kind: 'unavailable' }
  const packages = value.servicePackages.filter(isServiceMenuPackage)
  if (packages.length !== value.servicePackages.length) return { kind: 'unavailable' }
  const bookable = packages.filter(isBookableServicePackage)
  if (bookable.length === 0) return { kind: 'empty' }
  return { kind: 'ready', packages: bookable }
}

const SERVICE_TYPE_KEYWORDS: [RegExp, string][] = [
  [/\boil\b/i, 'oil_change'],
  [/\bbrake/i, 'brake_service'],
  [/\bbatter(y|ies)\b/i, 'battery_service'],
  [/\bdiagnos/i, 'diagnostics'],
  [/\b(tire|tyre|rotation|alignment|wheel)/i, 'tire_service'],
  [/\binspection\b/i, 'state_inspection'],
  [/\brepair\b/i, 'repair'],
]

// The service type a package books, so a package and the service type never disagree.
export function serviceTypeForPackage(name: string, types: { value: string; label: string }[]) {
  const normalized = name.trim().toLowerCase()
  const exact = types.find((type) => type.label.toLowerCase() === normalized)
  if (exact) return exact.value
  const keyword = SERVICE_TYPE_KEYWORDS.find(([pattern]) => pattern.test(name))
  return keyword?.[1] ?? 'scheduled_maintenance'
}

export async function readServiceMenu(read: () => Promise<unknown>): Promise<ServiceMenuReadResult> {
  try {
    return resolveServiceMenuResponse(await read())
  } catch {
    return { kind: 'unavailable' }
  }
}
