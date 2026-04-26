import { list } from '@keystone-6/core'
import { relationship, float, timestamp, text } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const PriceHistory = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['vehicle', 'effectiveDate', 'previousPrice', 'newPrice', 'changeReason'],
    },
  },
  fields: {
    // Vehicle relationship
    vehicle: relationship({
      ref: 'Vehicle.priceHistory',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),

    // Price Change Details
    effectiveDate: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: 'now' },
      label: 'Effective Date',
      ui: {
        description: 'Date when price change took effect',
      },
    }),
    previousPrice: float({
      label: 'Previous Price',
      ui: {
        description: 'Price before this change',
      },
    }),
    newPrice: float({
      validation: { isRequired: true },
      label: 'New Price',
      ui: {
        description: 'Price after this change',
      },
    }),

    // Change Reason
    changeReason: text({
      label: 'Change Reason',
      ui: {
        description: 'Reason for price change (e.g., Market adjustment, Special pricing, Aged inventory)',
      },
    }),

    // Changed By
    changedBy: relationship({
      ref: 'User.priceChanges',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Changed By',
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Additional notes about price change',
      },
      label: 'Notes',
    }),
  },
})
