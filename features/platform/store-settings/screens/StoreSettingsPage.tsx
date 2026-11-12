import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { notFound } from 'next/navigation'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { canEditStoreSettings } from '@/features/dashboard/lib/sidebarAccess'
import { getDealershipStoreSettings } from '../actions'
import { StoreSettingsPageClient } from './StoreSettingsPageClient'

export async function StoreSettingsPage() {
  // Roles that cannot save store settings have no settings page (the sidebar hides it too).
  const me = await getAuthenticatedUser()
  const user = me.success ? (me.data as any)?.authenticatedItem : null
  if (user?.role && !canEditStoreSettings(user)) notFound()
  const response = await getDealershipStoreSettings()

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Store Settings' },
        ]}
      />
      <StoreSettingsPageClient
        initialSettings={response.success ? response.data : null}
        initialError={response.success ? null : response.error}
      />
    </section>
  )
}

export default StoreSettingsPage
