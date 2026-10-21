import { getTestDrives } from '../actions'
import { TestDriveDeskPageClient } from './TestDriveDeskPageClient'

export async function TestDriveDeskPage() {
  const response = await getTestDrives()

  return (
    <TestDriveDeskPageClient
      initialTestDrives={response.success ? response.data.testDrives || [] : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default TestDriveDeskPage
