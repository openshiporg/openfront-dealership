import { getCatalogData } from '../actions'
import { CatalogPageClient, type CatalogTab } from './CatalogPageClient'

const TABS: CatalogTab[] = ['makes', 'services', 'routing']

export async function CatalogPage({ searchParams }: { searchParams?: Promise<{ tab?: string | string[] }> }) {
  const [data, params] = await Promise.all([getCatalogData(), searchParams ?? Promise.resolve({} as { tab?: string | string[] })])
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = TABS.includes(requested as CatalogTab) ? (requested as CatalogTab) : 'makes'
  return <CatalogPageClient initialData={data} initialTab={initialTab} />
}

export default CatalogPage
