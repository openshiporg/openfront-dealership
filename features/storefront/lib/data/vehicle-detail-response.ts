import type { Vehicle } from '../types'
import { GET_VEHICLE_BY_ID, GET_VEHICLE_RECORD_BY_ID } from './queries'

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

export type VehicleDetailLoad =
  | { id: string; status: 'error' }
  | { id: string; status: 'not-found' }
  | { id: string; status: 'available'; vehicle: Vehicle }
  // Was publicly listed, now pending or sold: rendered read-only and noindex.
  | { id: string; status: 'unlisted'; vehicle: Vehicle }

type VehicleDetailRequest = (query: string, variables: Record<string, any>) => Promise<unknown>

/**
 * Live listing first. A miss falls back to the pending/sold record, which the server returns only for
 * units that passed the public listing gate; anything else stays a 404. Used by the server page and
 * the client retry so both resolve the same way.
 */
export async function resolveVehicleDetail(id: string, request: VehicleDetailRequest): Promise<VehicleDetailLoad> {
  let live: VehicleDetailResolution<Vehicle>
  try {
    live = classifyVehicleDetailResponse<Vehicle>(await request(GET_VEHICLE_BY_ID, { id }), id)
  } catch {
    return { id, status: 'error' }
  }
  if (live.status === 'available') return { id, status: 'available', vehicle: live.vehicle }
  if (live.status === 'malformed') return { id, status: 'error' }
  try {
    const record = classifyVehicleDetailResponse<Vehicle>(await request(GET_VEHICLE_RECORD_BY_ID, { id }), id)
    if (record.status === 'available' && ['pending', 'sold'].includes(record.vehicle.status)) {
      return { id, status: 'unlisted', vehicle: record.vehicle }
    }
  } catch {
    // The record lookup is a courtesy for shared links; failing it keeps the 404.
  }
  return { id, status: 'not-found' }
}
