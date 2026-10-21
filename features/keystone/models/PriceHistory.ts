import { list } from '@keystone-6/core'
import { relationship, integer, timestamp, text, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const PriceHistory = list({
  access: {
    operation: {
      query: permissions.canViewDealerCost,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, ['canManageInventory', 'canManageFinancing']),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory'),
    },
    item: { create: canCreateRooftopRecord('canManageInventory') },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'vehicle', listKey: 'Vehicle' },
      { field: 'changedBy', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    listView: {
      initialColumns: ['vehicle', 'effectiveDate', 'previousPrice', 'newPrice', 'changeReason'],
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
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
    previousPriceCents: integer({ label: 'Previous Price (cents)', ui: { description: 'Previous price in integer USD cents' } }),
    newPriceCents: integer({ validation: { isRequired: true }, label: 'New Price (cents)', ui: { description: 'New price in integer USD cents' } }),
    previousPrice: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.previousPriceCents == null ? null : item.previousPriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    newPrice: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.newPriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
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
