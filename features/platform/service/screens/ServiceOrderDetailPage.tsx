import { notFound } from 'next/navigation'
import { getServiceOrderDetail, getServiceTaxRate } from '../actions'
import { ServiceOrderDetailPageClient } from './ServiceOrderDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function ServiceOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone, taxRateBps] = await Promise.all([getServiceOrderDetail(id), getDealershipTimeZone(), getServiceTaxRate()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success) notFound()

  return (
    <ServiceOrderDetailPageClient
      id={id}
      initialOrder={response.success ? response.data : null}
      initialError={null}
      timeZone={timeZone}
      taxRateBps={taxRateBps}
    />
  )
}

export default ServiceOrderDetailPage
