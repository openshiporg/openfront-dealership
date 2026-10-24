import { getDealSetupOptions } from '../actions'
import { DealCreatePageClient } from './DealCreatePageClient'

export async function DealCreatePage() {
  const response = await getDealSetupOptions()

  return (
    <DealCreatePageClient
      initialVehicles={response.success ? response.data.vehicles : []}
      initialLeads={response.success ? response.data.leads : []}
      initialDealDefaults={response.success ? response.data.dealDefaults : { salesTaxRateBps: 0, docFeeCents: 0 }}
      initialError={response.success ? null : response.error}
    />
  )
}

export default DealCreatePage
