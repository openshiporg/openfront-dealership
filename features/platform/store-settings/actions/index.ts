'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/lib/store-logo'

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
}

export type StoreSettingsResult =
  | { success: true; data: DealershipStoreSettings | null }
  | { success: false; error: string }

const SETTINGS_FIELDS = `
  id name shortName salesEmail serviceEmail phone
  addressLine1 addressLine2 city state postalCode
  hoursMonFri hoursSaturday hoursSunday websiteUrl currencyCode
  homepageTitle homepageDescription logoIcon logoColor
`

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
  }
}

export async function getDealershipStoreSettings(): Promise<StoreSettingsResult> {
  const response = await keystoneClient<{ dealershipProfile: DealershipStoreSettings | null }>(`
    query DealershipStoreSettings {
      dealershipProfile { ${SETTINGS_FIELDS} }
    }
  `, {}, { cache: 'no-store' })

  if (!response.success) return { success: false, error: response.error }
  const settings = response.data.dealershipProfile
  if (!settings) return { success: true, data: null }
  return {
    success: true,
    data: {
      ...settings,
      logoIcon: sanitizeStoreLogoSvg(settings.logoIcon),
      logoColor: normalizeStoreLogoColor(settings.logoColor),
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

  const { id, ...settingsData } = data
  const mutation = id
    ? `mutation UpdateDealershipStoreSettings($id: ID!, $data: DealershipProfileUpdateInput!) {
        settings: updateDealershipProfile(where: { id: $id }, data: $data) { ${SETTINGS_FIELDS} }
      }`
    : `mutation CreateDealershipStoreSettings($data: DealershipProfileCreateInput!) {
        settings: createDealershipProfile(data: $data) { ${SETTINGS_FIELDS} }
      }`

  const response = await keystoneClient<{ settings: DealershipStoreSettings }>(
    mutation,
    id ? { id, data: settingsData } : { data: settingsData }
  )
  if (!response.success) return { success: false, error: response.error }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/platform/store-settings')
  revalidatePath('/', 'layout')
  return { success: true, data: response.data.settings }
}
