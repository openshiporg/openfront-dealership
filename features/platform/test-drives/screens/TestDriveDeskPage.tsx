import { getTestDrives } from '../actions'
import { TestDriveDeskPageClient } from './TestDriveDeskPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function TestDriveDeskPage() {
  const [response, timeZone] = await Promise.all([getTestDrives(), getDealershipTimeZone()])

  return (
    <TestDriveDeskPageClient
      initialTestDrives={response.success ? response.data.testDrives || [] : []}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default TestDriveDeskPage
