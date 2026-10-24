import { getCustomers, type CustomerListFilters } from '../actions'
import { CustomerListPageClient } from './CustomerListPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function CustomerListPage() {
  const initialFilters: CustomerListFilters = { status: 'active', segment: 'all', search: '', sort: 'updated', page: 0 }
  const [response, timeZone] = await Promise.all([getCustomers(initialFilters), getDealershipTimeZone()])

  return (
    <CustomerListPageClient
      initialFilters={initialFilters}
      initialData={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default CustomerListPage
