import { redirect } from 'next/navigation'
import { HomePage } from '@/features/dashboard/screens/HomePage'
import { getAdminMetaAction, getAuthenticatedUser } from '@/features/dashboard/actions'
import { dashboardLandingPath } from '@/features/dashboard/lib/sidebarAccess'

// Staff land on the operations page for their role; the list index is kept for a role with none.
export default async function DashboardIndexPage() {
  const [adminMetaResponse, userResponse] = await Promise.all([getAdminMetaAction(), getAuthenticatedUser()])
  const lists = adminMetaResponse.success ? adminMetaResponse.data?.lists || [] : []
  const user = userResponse.success ? userResponse.data?.authenticatedItem : null
  const landing = dashboardLandingPath(lists, user)
  if (landing) redirect(`/dashboard${landing}`)
  return <HomePage />
}
