import { notFound } from 'next/navigation'
import { getServiceAppointmentDetail } from '../actions'
import { ServiceAppointmentDetailPageClient } from './ServiceAppointmentDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function ServiceAppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getServiceAppointmentDetail(id), getDealershipTimeZone()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success) notFound()

  return (
    <ServiceAppointmentDetailPageClient
      id={id}
      initialAppointment={response.success ? response.data : null}
      initialError={null}
      timeZone={timeZone}
    />
  )
}

export default ServiceAppointmentDetailPage
