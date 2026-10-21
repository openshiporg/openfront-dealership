import { getDealershipCurrencyCode, getInventoryWorkspace } from '../actions'
import { VehicleListPageClient } from './VehicleListPageClient'

export async function VehicleListPage() {
  const [response, currencyCode] = await Promise.all([getInventoryWorkspace('all'), getDealershipCurrencyCode()])

  return (
    <VehicleListPageClient
      initialVehicles={response.success ? response.vehicles : []}
      initialIntakeRooftops={response.success ? response.intakeRooftops : []}
      initialError={response.success ? null : response.error}
      currencyCode={currencyCode}
    />
  )
}

export default VehicleListPage
