import { notFound } from 'next/navigation'

import { loadVehicleDetail } from '../lib/data/vehicle-detail'
import { VehicleDetailPageClient } from './VehicleDetailPageClient'

export async function VehicleDetailPage({ id }: { id: string }) {
  const initialState = await loadVehicleDetail(id)
  if (initialState.status === 'not-found') notFound()
  return <VehicleDetailPageClient key={id} id={id} initialState={initialState} />
}
