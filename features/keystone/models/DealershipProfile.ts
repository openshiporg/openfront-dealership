import { list } from '@keystone-6/core'
import { text } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { normalizeStoreLogoColor } from '../../lib/store-logo'
import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo'
import { trackingFields } from './trackingFields'

const canManageStoreSettings = (args: Parameters<typeof permissions.canManageOnboarding>[0]) =>
  permissions.canManageSettings(args) || permissions.canManageOnboarding(args) || permissions.canManageDealerships(args)

export const DealershipProfile = list({
  isSingleton: true,
  access: {
    operation: {
      query: () => true,
      create: canManageStoreSettings,
      update: canManageStoreSettings,
      delete: canManageStoreSettings,
    },
  },
  ui: {
    label: 'Dealership Profile',
  },
  fields: {
    ...trackingFields,
    name: text({ validation: { isRequired: true } }),
    shortName: text({ validation: { isRequired: true } }),
    salesEmail: text({ defaultValue: '' }),
    serviceEmail: text({ defaultValue: '' }),
    phone: text({ defaultValue: '' }),
    addressLine1: text({ defaultValue: '' }),
    addressLine2: text({ defaultValue: '' }),
    city: text({ defaultValue: '' }),
    state: text({ defaultValue: '' }),
    postalCode: text({ defaultValue: '' }),
    hoursMonFri: text({ defaultValue: '' }),
    hoursSaturday: text({ defaultValue: '' }),
    hoursSunday: text({ defaultValue: '' }),
    websiteUrl: text({ defaultValue: '' }),
    currencyCode: text({ validation: { isRequired: true }, defaultValue: 'USD' }),
    homepageTitle: text({ defaultValue: '' }),
    homepageDescription: text({
      defaultValue: '',
      ui: { displayMode: 'textarea' },
    }),
    logoIcon: text({
      defaultValue: '',
      ui: {
        displayMode: 'textarea',
        description: 'Sanitized SVG brand mark exposed to the public storefront',
      },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey]
          if (value === undefined || value === null || value === '') return value
          return typeof value === 'string' ? sanitizeStoreLogoSvg(value) : ''
        },
        validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
          const submitted = inputData?.[fieldKey]
          if (typeof submitted === 'string' && submitted.trim() && !resolvedData?.[fieldKey]) {
            addValidationError('Brand mark must be a valid, safe SVG document')
          }
        },
      },
    }),
    logoColor: text({
      defaultValue: '0',
      ui: { description: 'Normalized storefront brand hue rotation from 0 through 359 degrees' },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey]
          return value === undefined ? value : normalizeStoreLogoColor(value)
        },
      },
    }),
  },
})
