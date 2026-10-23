import { getDealershipCurrencyCode, getInventoryMakes, getInventoryWorkspace } from '../actions'
import { VehicleListPageClient } from './VehicleListPageClient'

export async function VehicleListPage() {
  const [response, currencyCode, makes] = await Promise.all([getInventoryWorkspace('all'), getDealershipCurrencyCode(), getInventoryMakes()])

  return (
    <VehicleListPageClient
      initialVehicles={response.success ? response.vehicles : []}
      initialIntakeRooftops={response.success ? response.intakeRooftops : []}
      initialError={response.success ? null : response.error}
      currencyCode={currencyCode}
      makes={makes}
    />
  )
}

export default VehicleListPage
