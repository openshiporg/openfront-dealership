import { getDealSetupOptions } from '../actions'
import { DealCreatePageClient } from './DealCreatePageClient'

export async function DealCreatePage() {
  const response = await getDealSetupOptions()

  return (
    <DealCreatePageClient
      initialVehicles={response.success ? response.data.vehicles : []}
      initialLeads={response.success ? response.data.leads : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default DealCreatePage
