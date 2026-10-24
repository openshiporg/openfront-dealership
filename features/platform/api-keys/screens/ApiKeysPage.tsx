import { getApiKeys } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { ApiKeysPageClient } from './ApiKeysPageClient'

export async function ApiKeysPage() {
  const [data, timeZone] = await Promise.all([getApiKeys(), getDealershipTimeZone()])
  return <ApiKeysPageClient data={data} timeZone={timeZone} />
}

export default ApiKeysPage
