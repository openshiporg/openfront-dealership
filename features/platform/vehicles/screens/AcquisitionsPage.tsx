import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { getDealershipCurrencyCode } from '../actions'
import { getAcquisitions } from '../actions/acquisitions'
import { AcquisitionsPageClient } from './AcquisitionsPageClient'

export async function AcquisitionsPage() {
  const [response, timeZone, currencyCode] = await Promise.all([getAcquisitions('active', ''), getDealershipTimeZone(), getDealershipCurrencyCode()])

  return (
    <AcquisitionsPageClient
      initialAcquisitions={response.success ? response.acquisitions : []}
      initialCounts={response.success ? response.counts : null}
      initialRooftops={response.success ? response.rooftops : []}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
      currencyCode={currencyCode}
    />
  )
}

export default AcquisitionsPage
