import { getOperationalReport } from '../actions'
import { OverviewDashboardPageClient } from './OverviewDashboardPageClient'

export async function OverviewDashboardPage() {
  const response = await getOperationalReport()

  return (
    <OverviewDashboardPageClient
      initialReport={response.success ? response.data.operationalReport : null}
      initialCurrencyCode={response.success ? response.data.dealershipProfile?.currencyCode || 'USD' : 'USD'}
      initialError={response.success ? (response.data.operationalReport ? null : 'Unable to load the overview.') : response.error}
    />
  )
}

export default OverviewDashboardPage
