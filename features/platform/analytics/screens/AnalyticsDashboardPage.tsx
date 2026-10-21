import { getAnalyticsData } from '../actions'
import { AnalyticsDashboardPageClient } from './AnalyticsDashboardPageClient'

export async function AnalyticsDashboardPage() {
  const data = await getAnalyticsData()

  return <AnalyticsDashboardPageClient initialData={data} />
}

export default AnalyticsDashboardPage
