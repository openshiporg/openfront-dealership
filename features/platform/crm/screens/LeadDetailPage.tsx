import { getCrmViewer, getCustomerDuplicateCount, getLead, getRooftopStaff } from '../actions'
import { LeadDetailPageClient } from './LeadDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, viewer, timeZone] = await Promise.all([getLead(id), getCrmViewer(), getDealershipTimeZone()])
  const lead = response.success ? response.data.lead : null
  const [duplicateCount, staff] = await Promise.all([
    lead?.customer?.id ? getCustomerDuplicateCount(lead.customer.id) : Promise.resolve(0),
    lead?.rooftop?.id ? getRooftopStaff(lead.rooftop.id) : Promise.resolve([]),
  ])

  return (
    <LeadDetailPageClient
      id={id}
      initialLead={lead}
      initialDuplicateCount={duplicateCount}
      viewer={viewer}
      staff={staff}
      timeZone={timeZone}
      initialError={response.success ? (lead ? null : 'This lead was not found.') : response.error}
    />
  )
}

export default LeadDetailPage
