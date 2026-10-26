import { getCrmRooftops, getCrmViewer, getLeadList, getStaffForRooftops, type LeadListFilters } from '../actions'
import { LeadListPageClient } from './LeadListPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function LeadListPage() {
  const [viewer, rooftops, timeZone] = await Promise.all([getCrmViewer(), getCrmRooftops(), getDealershipTimeZone()])
  const initialFilters: LeadListFilters = {
    status: 'open',
    ownerId: viewer && !viewer.canViewAllLeads ? viewer.id : 'all',
    source: 'all',
    search: '',
    sort: 'newest',
    page: 0,
  }
  // The "waiting on you" queue: open leads in the viewer's scope, earliest response due first.
  const queueFilters: LeadListFilters = { ...initialFilters, sort: 'sla' }
  const [response, queueResponse, staff] = await Promise.all([
    getLeadList(initialFilters),
    getLeadList(queueFilters),
    getStaffForRooftops(rooftops.map(rooftop => rooftop.id)),
  ])

  return (
    <LeadListPageClient
      viewer={viewer}
      rooftops={rooftops}
      staff={staff}
      initialFilters={initialFilters}
      initialData={response.success ? response.data : null}
      initialQueue={queueResponse.success ? queueResponse.data.leads : []}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default LeadListPage
