import { cache } from 'react'

import { openfrontClient } from '../config'
import type { Vehicle } from '../types'
import { GET_VEHICLE_BY_ID } from './queries'
import { classifyVehicleDetailResponse } from './vehicle-detail-response'

export type VehicleDetailLoad =
  | { id: string; status: 'error' }
  | { id: string; status: 'not-found' }
  | { id: string; status: 'available'; vehicle: Vehicle }

export const loadVehicleDetail = cache(async (id: string): Promise<VehicleDetailLoad> => {
  try {
    const response = await openfrontClient.request<unknown>(GET_VEHICLE_BY_ID, { id })
    const result = classifyVehicleDetailResponse<Vehicle>(response, id)
    if (result.status === 'available') return { id, status: 'available', vehicle: result.vehicle }
    if (result.status === 'not-found') return { id, status: 'not-found' }
    return { id, status: 'error' }
  } catch {
    return { id, status: 'error' }
  }
})
