import { getBaseUrl } from '../getBaseUrl'

// Public origin for absolute storefront URLs. Sitemaps must list URLs on the host that
// serves them, so this is the request host, not the store's Website URL.
export async function storefrontOrigin(): Promise<string> {
  return (await getBaseUrl()).replace(/\/+$/, '')
}
