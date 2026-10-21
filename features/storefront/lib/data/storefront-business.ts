import { cache } from 'react'

import { openfrontClient } from '../config'
import {
  createStorefrontBusiness,
  type StorefrontProfileDto,
  type StorefrontSettingsState,
} from '../business'

const STOREFRONT_PROFILE = `
  query StorefrontProfile {
    storefrontProfile {
      rooftopSlug
      fullName
      shortName
      salesEmail
      serviceEmail
      phoneDisplay
      phoneHref
      addressLine1
      addressLine2
      hoursMonFri
      hoursSaturday
      hoursSunday
      websiteUrl
      currencyCode
      homepageTitle
      homepageDescription
      logoIcon
      logoColor
      timezone
    }
  }
`

export const loadStorefrontBusiness = cache(async function (): Promise<StorefrontSettingsState> {
  try {
    const data = await openfrontClient.request<{ storefrontProfile: StorefrontProfileDto | null }>(STOREFRONT_PROFILE)
    return { status: 'ready', business: createStorefrontBusiness(data.storefrontProfile ?? {}) }
  } catch {
    return { status: 'error' }
  }
})
