'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { createStorefrontBusiness, type StorefrontBusiness } from '../lib/business'

const FALLBACK_BUSINESS = createStorefrontBusiness()

const StorefrontBusinessContext = createContext<StorefrontBusiness>(FALLBACK_BUSINESS)

export function StorefrontBusinessProvider({
  business,
  children,
}: {
  business: StorefrontBusiness
  children: ReactNode
}) {
  return (
    <StorefrontBusinessContext.Provider value={business}>
      {children}
    </StorefrontBusinessContext.Provider>
  )
}

export function useStorefrontBusiness() {
  return useContext(StorefrontBusinessContext)
}
