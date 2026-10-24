export type CatalogRooftop = { id: string; name: string }

export type CatalogProduct = {
  id: string
  code: string
  name: string
  category: string
  providerKey: string
  active: boolean
  retailPriceCents: number
  /** Null when the viewer cannot see dealer cost. */
  costCents: number | null
  updatedAt: string | null
  quotesCount: number | null
  rooftop: CatalogRooftop | null
}
