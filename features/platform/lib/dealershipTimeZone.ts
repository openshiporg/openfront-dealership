import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { DEFAULT_DEALERSHIP_TIME_ZONE } from './format'

/** The dealership's IANA time zone, so desk times render the same on the server and in the browser. */
export async function getDealershipTimeZone(): Promise<string> {
  const response = await keystoneClient(`query DealershipTimeZone { storefrontProfile { timezone } }`)
  const timeZone = response.success ? response.data?.storefrontProfile?.timezone : null
  if (!timeZone) return DEFAULT_DEALERSHIP_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_DEALERSHIP_TIME_ZONE
  }
}
