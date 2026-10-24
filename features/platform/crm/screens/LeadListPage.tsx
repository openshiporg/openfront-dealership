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
  const [response, staff] = await Promise.all([getLeadList(initialFilters), getStaffForRooftops(rooftops.map(rooftop => rooftop.id))])

  return (
    <LeadListPageClient
      viewer={viewer}
      rooftops={rooftops}
      staff={staff}
      initialFilters={initialFilters}
      initialData={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default LeadListPage
