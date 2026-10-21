export type VehicleDetailResolution<T extends { id: string }> =
  | { status: 'available'; vehicle: T }
  | { status: 'not-found' }
  | { status: 'malformed' }

export function classifyVehicleDetailResponse<T extends { id: string }>(response: unknown, requestedId: string): VehicleDetailResolution<T> {
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Object.prototype.hasOwnProperty.call(response, 'publicInventoryVehicle')) {
    return { status: 'malformed' }
  }

  const vehicle = (response as { publicInventoryVehicle?: unknown }).publicInventoryVehicle
  if (vehicle === null) return { status: 'not-found' }
  if (!vehicle || typeof vehicle !== 'object' || Array.isArray(vehicle)) return { status: 'malformed' }

  const vehicleRecord = vehicle as Record<string, unknown>
  const selectedFields = [
    'id', 'vin', 'stockNumber', 'year', 'make', 'model', 'trim', 'color', 'mileage', 'price',
    'status', 'condition', 'features', 'description', 'images',
  ]
  if (selectedFields.some((field) => !Object.prototype.hasOwnProperty.call(vehicleRecord, field))) {
    return { status: 'malformed' }
  }
  if (!Array.isArray(vehicleRecord.images)) return { status: 'malformed' }

  const id = vehicleRecord.id
  if (typeof id !== 'string' || !id.trim() || id !== requestedId) return { status: 'malformed' }

  return { status: 'available', vehicle: vehicle as T }
}

export function parseVehicleFeatures(value: unknown): unknown[] {
  if (typeof value !== 'string') return Array.isArray(value) ? value : []
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
