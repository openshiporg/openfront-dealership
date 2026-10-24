import { getOrganizationData } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { ORGANIZATION_TABS, type OrganizationTab } from '../lib/types'
import { OrganizationPageClient } from './OrganizationPageClient'

export async function OrganizationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, data, timeZone] = await Promise.all([searchParams, getOrganizationData(), getDealershipTimeZone()])
  const requested = typeof params.tab === 'string' ? params.tab : ''
  const initialTab: OrganizationTab = (ORGANIZATION_TABS as readonly string[]).includes(requested) ? (requested as OrganizationTab) : 'group'

  return <OrganizationPageClient data={data} initialTab={initialTab} timeZone={timeZone} />
}

export default OrganizationPage
