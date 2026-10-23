import { getCrmLeads } from '../actions'
import { LeadListPageClient } from './LeadListPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function LeadListPage() {
  const [response, timeZone] = await Promise.all([getCrmLeads(), getDealershipTimeZone()])

  return (
    <LeadListPageClient
      initialLeads={response.success ? response.data.crmWorkspace.leads || [] : []}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default LeadListPage
