import { getDealDeskWorkspace } from '../actions'
import { DealListPageClient } from './DealListPageClient'

export async function DealListPage() {
  const response = await getDealDeskWorkspace('all')

  return (
    <DealListPageClient
      initialDeals={response.success ? response.data.dealDeskWorkspace.deals || [] : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default DealListPage
