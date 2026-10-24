export type MenuProduct = {
  id: string
  code: string
  name: string
  category: string
  active: boolean
  retailPriceCents: number
  costCents: number | null
}

export type MenuQuote = {
  id: string
  status: string
  retailPriceCents: number | null
  costCents: number | null
  evidenceReference: string | null
  requestedAt: string
  completedAt: string | null
  resultSnapshot: { termMonths?: number | null } | null
  product: { id: string; code: string } | null
}

export type MenuOption = { code: string; name?: string; category?: string; retailPriceCents?: number | null; termMonths?: number | null }

export type MenuVersion = {
  id: string
  version: number
  status: string
  optionsSnapshot: MenuOption[] | null
  selectedProductCodes: string[] | null
  declinedProductCodes: string[] | null
  disclosureAcknowledgment: string | null
  presentedAt: string
  decidedAt: string | null
}

export type DealMenuData = { products: MenuProduct[]; quotes: MenuQuote[]; menus: MenuVersion[] }
