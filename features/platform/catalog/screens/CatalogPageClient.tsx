'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Pill, Segmented, Track } from '@/features/platform/components/desk'
import { type CatalogData, getCatalogData } from '../actions'
import { LeadRoutingPanel } from '../components/LeadRoutingPanel'
import { MakesModelsPanel } from '../components/MakesModelsPanel'
import { ServicePackagesPanel } from '../components/ServicePackagesPanel'
import { TAP } from '../components/formKit'

export type CatalogTab = 'makes' | 'services' | 'routing'

export function CatalogPageClient({ initialData, initialTab }: { initialData: CatalogData; initialTab: CatalogTab }) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<CatalogTab>(initialTab)
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    try { setData(await getCatalogData()) } finally { setLoading(false) }
  }

  const changeTab = (next: CatalogTab) => {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }

  const modelCount = data.makes.data.reduce((total, make) => total + make.modelsCount, 0)
  const activeRules = data.routingRules.data.filter(rule => rule.active).length
  const anyError = data.makes.error || data.servicePackages.error || data.routingRules.error

  const header = (
    <DeskHeader
      title="Catalog"
      tone={anyError ? 'bad' : modelCount === 0 || activeRules === 0 ? 'warn' : 'ok'}
      status={anyError ? 'Partly unavailable' : modelCount === 0 ? 'No models' : activeRules === 0 ? 'No active routing' : 'Ready'}
      meta={`${data.makes.data.length} makes · ${modelCount} models · ${data.servicePackages.data.length} service packages · ${activeRules} active routing rules`}
      actions={
        <Track>
          <Pill className={TAP} onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer
      title="Catalog"
      header={header}
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: basePath },
        { type: 'page', label: 'Platform' },
        { type: 'page', label: 'Catalog' },
      ]}
    >
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        <Segmented<CatalogTab>
          label="Catalog section"
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'makes', label: 'Makes and models', count: data.makes.data.length, tone: data.makes.error ? 'bad' : modelCount === 0 ? 'warn' : undefined },
            { value: 'services', label: 'Service packages', count: data.servicePackages.data.length, tone: data.servicePackages.error ? 'bad' : undefined },
            { value: 'routing', label: 'Lead routing', count: data.routingRules.data.length, tone: data.routingRules.error ? 'bad' : activeRules === 0 ? 'warn' : undefined },
          ]}
        />
        {tab === 'makes' && <MakesModelsPanel makes={data.makes.data} inventoryPairs={data.inventoryPairs} error={data.makes.error} onReload={reload} />}
        {tab === 'services' && <ServicePackagesPanel packages={data.servicePackages.data} rooftops={data.rooftops} currencyCode={data.currencyCode} error={data.servicePackages.error} onReload={reload} />}
        {tab === 'routing' && <LeadRoutingPanel rules={data.routingRules.data} rooftops={data.rooftops} error={data.routingRules.error} onReload={reload} />}
      </div>
    </PageContainer>
  )
}
