'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { checkedCents, checkedRateBps } from '@/features/keystone/lifecycle/dealPricing'

export type DealershipStoreSettings = {
  id?: string
  name: string
  shortName: string
  salesEmail: string
  serviceEmail: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  hoursMonFri: string
  hoursSaturday: string
  hoursSunday: string
  websiteUrl: string
  currencyCode: string
  homepageTitle: string
  homepageDescription: string
  logoIcon: string
  logoColor: string
  /** Deal defaults: integer basis points (415 = 4.15%) and integer cents. */
  salesTaxRateBps: number
  docFeeCents: number
  /** IANA zone stored on the storefront's rooftop, not on DealershipProfile. */
  timezone: string
}

export type StoreSettingsResult =
  | { success: true; data: DealershipStoreSettings | null; warning?: string }
  | { success: false; error: string }

const SETTINGS_FIELDS = `
  id name shortName salesEmail serviceEmail phone
  addressLine1 addressLine2 city state postalCode
  hoursMonFri hoursSaturday hoursSunday websiteUrl currencyCode
  homepageTitle homepageDescription logoIcon logoColor
  salesTaxRateBps docFeeCents
`

type StorefrontRooftop = { rooftopId: string; timezone: string }

function isTimeZone(value: string) {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

async function getStorefrontRooftop(): Promise<StorefrontRooftop | null> {
  const response = await keystoneClient<{ storefrontProfile: StorefrontRooftop | null }>(`
    query StoreSettingsRooftop {
      storefrontProfile { rooftopId timezone }
    }
  `, {}, { cache: 'no-store' })
  return response.success ? response.data.storefrontProfile : null
}

function boundedText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function prepareSettings(input: DealershipStoreSettings): DealershipStoreSettings {
  const name = boundedText(input.name, 200)
  const shortName = boundedText(input.shortName, 120)
  if (!name || !shortName) throw new Error('Dealership name and short name are required.')

  const websiteUrl = boundedText(input.websiteUrl, 500)
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
    throw new Error('Website URL must start with http:// or https://.')
  }

  const currencyCode = boundedText(input.currencyCode, 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Currency code must contain three letters.')

  const submittedMark = boundedText(input.logoIcon, 20_000)
  const logoIcon = sanitizeStoreLogoSvg(submittedMark)
  if (submittedMark && !logoIcon) throw new Error('Brand mark must be a valid, safe SVG document.')

  const timezone = boundedText(input.timezone, 100)
  if (timezone && !isTimeZone(timezone)) throw new Error('Choose a valid timezone.')

  const salesTaxRateBps = checkedRateBps(input.salesTaxRateBps)
  const docFeeCents = checkedCents(input.docFeeCents, 'Documentation fee')

  return {
    id: input.id,
    name,
    shortName,
    salesEmail: boundedText(input.salesEmail, 320),
    serviceEmail: boundedText(input.serviceEmail, 320),
    phone: boundedText(input.phone, 80),
    addressLine1: boundedText(input.addressLine1, 300),
    addressLine2: boundedText(input.addressLine2, 300),
    city: boundedText(input.city, 120),
    state: boundedText(input.state, 120),
    postalCode: boundedText(input.postalCode, 40),
    hoursMonFri: boundedText(input.hoursMonFri, 160),
    hoursSaturday: boundedText(input.hoursSaturday, 160),
    hoursSunday: boundedText(input.hoursSunday, 160),
    websiteUrl,
    currencyCode,
    homepageTitle: boundedText(input.homepageTitle, 200),
    homepageDescription: boundedText(input.homepageDescription, 1_000),
    logoIcon,
    logoColor: normalizeStoreLogoColor(input.logoColor),
    salesTaxRateBps,
    docFeeCents,
    timezone,
  }
}

export async function getDealershipStoreSettings(): Promise<StoreSettingsResult> {
  const [response, rooftop] = await Promise.all([
    keystoneClient<{ dealershipProfile: Omit<DealershipStoreSettings, 'timezone'> | null }>(`
      query DealershipStoreSettings {
        dealershipProfile { ${SETTINGS_FIELDS} }
      }
    `, {}, { cache: 'no-store' }),
    getStorefrontRooftop(),
  ])

  if (!response.success) return { success: false, error: response.error }
  const settings = response.data.dealershipProfile
  if (!settings) return { success: true, data: null }
  return {
    success: true,
    data: {
      ...settings,
      logoIcon: sanitizeStoreLogoSvg(settings.logoIcon),
      logoColor: normalizeStoreLogoColor(settings.logoColor),
      salesTaxRateBps: Number(settings.salesTaxRateBps) || 0,
      docFeeCents: Number(settings.docFeeCents) || 0,
      timezone: rooftop?.timezone || '',
    },
  }
}

export async function saveDealershipStoreSettings(
  input: DealershipStoreSettings
): Promise<StoreSettingsResult> {
  let data: DealershipStoreSettings
  try {
    data = prepareSettings(input)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Settings are invalid.' }
  }

  const { id, timezone, ...settingsData } = data
  const mutation = id
    ? `mutation UpdateDealershipStoreSettings($id: ID!, $data: DealershipProfileUpdateInput!) {
        settings: updateDealershipProfile(where: { id: $id }, data: $data) { ${SETTINGS_FIELDS} }
      }`
    : `mutation CreateDealershipStoreSettings($data: DealershipProfileCreateInput!) {
        settings: createDealershipProfile(data: $data) { ${SETTINGS_FIELDS} }
      }`

  const response = await keystoneClient<{ settings: Omit<DealershipStoreSettings, 'timezone'> }>(
    mutation,
    id ? { id, data: settingsData } : { data: settingsData }
  )
  if (!response.success) return { success: false, error: response.error }

  // The rooftop is resolved on the server; the timezone is written only when it changed,
  // so merchants without dealership-management access can still save the profile.
  const rooftop = await getStorefrontRooftop()
  let savedTimezone = rooftop?.timezone || ''
  let timezoneError: string | null = null
  if (timezone && rooftop && timezone !== rooftop.timezone) {
    const rooftopResponse = await keystoneClient<{ updateRooftop: { timezone: string } | null }>(`
      mutation UpdateStoreTimezone($id: ID!, $timezone: String!) {
        updateRooftop(where: { id: $id }, data: { timezone: $timezone }) { timezone }
      }
    `, { id: rooftop.rooftopId, timezone })
    if (rooftopResponse.success && rooftopResponse.data.updateRooftop) savedTimezone = rooftopResponse.data.updateRooftop.timezone
    else timezoneError = rooftopResponse.success ? 'Timezone was not saved.' : `Timezone was not saved: ${rooftopResponse.error}`
  } else if (timezone && !rooftop) {
    timezoneError = 'Timezone was not saved: storefront location unavailable.'
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/platform/store-settings')
  revalidatePath('/', 'layout')
  return {
    success: true,
    data: { ...response.data.settings, timezone: savedTimezone },
    ...(timezoneError ? { warning: timezoneError } : {}),
  }
}
