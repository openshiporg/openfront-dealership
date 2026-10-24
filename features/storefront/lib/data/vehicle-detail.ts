import { cache } from 'react'

import { openfrontClient } from '../config'
import { resolveVehicleDetail, type VehicleDetailLoad } from './vehicle-detail-response'

export type { VehicleDetailLoad } from './vehicle-detail-response'

export const loadVehicleDetail = cache((id: string): Promise<VehicleDetailLoad> =>
  resolveVehicleDetail(id, (query, variables) => openfrontClient.request<unknown>(query, variables)))
