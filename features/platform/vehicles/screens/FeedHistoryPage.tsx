import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { getInventoryWorkspace } from '../actions'
import { getFeedHistory } from '../actions/feed'
import { FeedHistoryPageClient } from './FeedHistoryPageClient'

export async function FeedHistoryPage() {
  const [history, workspace, timeZone] = await Promise.all([getFeedHistory('all', 'all'), getInventoryWorkspace('all'), getDealershipTimeZone()])

  return (
    <FeedHistoryPageClient
      initialRuns={history.success ? history.runs : []}
      initialCounts={history.success ? history.counts : null}
      initialVehicles={workspace.success ? workspace.vehicles : []}
      initialError={history.success ? null : history.error}
      timeZone={timeZone}
    />
  )
}

export default FeedHistoryPage
