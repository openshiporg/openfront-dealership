import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { getDealershipStoreSettings } from '../actions'
import { StoreSettingsPageClient } from './StoreSettingsPageClient'

export async function StoreSettingsPage() {
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
