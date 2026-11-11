import { notFound } from 'next/navigation'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { getDealershipCurrencyCode } from '../actions'
import { getInventoryStaff, getInventoryVehicleDetail } from '../actions/detail'
import { VehicleDetailPageClient } from './VehicleDetailPageClient'

export async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone, currencyCode] = await Promise.all([getInventoryVehicleDetail(id), getDealershipTimeZone(), getDealershipCurrencyCode()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success) notFound()
  const staff = response.success ? await getInventoryStaff(response.detail.vehicle.rooftopId) : []

  return (
    <VehicleDetailPageClient
      id={id}
      initialDetail={response.success ? response.detail : null}
      initialError={null}
      timeZone={timeZone}
      currencyCode={currencyCode}
      staff={staff}
    />
  )
}

export default VehicleDetailPage
