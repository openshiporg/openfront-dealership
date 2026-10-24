import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { getDealershipCurrencyCode } from '../actions'
import { getInventoryStaff, getInventoryVehicleDetail } from '../actions/detail'
import { VehicleDetailPageClient } from './VehicleDetailPageClient'

export async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone, currencyCode] = await Promise.all([getInventoryVehicleDetail(id), getDealershipTimeZone(), getDealershipCurrencyCode()])
  const staff = response.success ? await getInventoryStaff(response.detail.vehicle.rooftopId) : []

  return (
    <VehicleDetailPageClient
      id={id}
      initialDetail={response.success ? response.detail : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
      currencyCode={currencyCode}
      staff={staff}
    />
  )
}

export default VehicleDetailPage
