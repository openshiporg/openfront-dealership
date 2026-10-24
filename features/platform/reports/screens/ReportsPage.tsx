import { getReportsData } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { ReportsPageClient, type ReportsTab } from './ReportsPageClient'

const TABS: ReportsTab[] = ['saved', 'runs', 'audit', 'outbox']

export async function ReportsPage({ searchParams }: { searchParams?: Promise<{ tab?: string | string[] }> }) {
  const [data, timeZone, params] = await Promise.all([getReportsData(), getDealershipTimeZone(), searchParams ?? Promise.resolve({} as { tab?: string | string[] })])
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = TABS.includes(requested as ReportsTab) ? (requested as ReportsTab) : 'saved'
  return <ReportsPageClient initialData={data} initialTab={initialTab} timeZone={timeZone} />
}

export default ReportsPage
