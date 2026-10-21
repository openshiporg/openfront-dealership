import { loadVehicleDetail } from '../lib/data/vehicle-detail'
import { VehicleDetailPageClient } from './VehicleDetailPageClient'

export async function VehicleDetailPage({ id }: { id: string }) {
  const initialState = await loadVehicleDetail(id)
  return <VehicleDetailPageClient key={id} id={id} initialState={initialState} />
}
