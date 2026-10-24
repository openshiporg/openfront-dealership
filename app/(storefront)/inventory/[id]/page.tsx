import type { Metadata } from 'next'

import { loadVehicleDetail } from '@/features/storefront/lib/data/vehicle-detail'
import { vehicleTitle } from '@/features/storefront/lib/format'
import { VehicleDetailPage } from '@/features/storefront/screens/VehicleDetailPage'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await loadVehicleDetail(id)
  if (result.status === 'not-found') return { title: 'Vehicle not found', robots: { index: false, follow: true } }
  if (result.status === 'unlisted') return { title: vehicleTitle(result.vehicle), robots: { index: false, follow: true } }
  return { title: result.status === 'available' ? vehicleTitle(result.vehicle) : 'Vehicle' }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <VehicleDetailPage id={id} />
}
