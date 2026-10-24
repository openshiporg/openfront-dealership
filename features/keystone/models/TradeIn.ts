import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text, select, integer, image, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions, rules, TRADE_IN_ACCESS_PERMISSIONS } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const TradeIn = list({
  access: {
    operation: {
      query: permissions.canAccessTradeIns,
      create: permissions.canAccessTradeIns,
      update: permissions.canAccessTradeIns,
      delete: permissions.canManageTradeIns,
    },
    filter: {
      query: rules.canReadTradeIns,
      update: rules.canReadTradeIns,
      delete: rules.canReadTradeIns,
    },
    item: { create: canCreateRooftopRecord(TRADE_IN_ACCESS_PERMISSIONS) },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'lead', listKey: 'Lead' },
      { field: 'deal', listKey: 'Deal' },
      { field: 'appraisedBy', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    listView: {
      initialColumns: ['vin', 'year', 'make', 'model', 'condition', 'offerAmount'],
    },
    labelField: 'vin',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle Identification
    vin: text({
      label: 'VIN',
      ui: {
        description: 'Vehicle Identification Number',
      },
    }),

    // Vehicle Details
    year: text({
      label: 'Year',
    }),
    make: text({
      label: 'Make',
      ui: {
        description: 'Vehicle manufacturer (e.g., Toyota)',
      },
    }),
    model: text({
      label: 'Model',
      ui: {
        description: 'Vehicle model (e.g., Camry)',
      },
    }),
    trim: text({
      label: 'Trim',
    }),
    mileage: integer({
      label: 'Mileage',
      ui: {
        description: 'Current odometer reading',
      },
    }),

    // Condition Assessment
    condition: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Overall Condition',
    }),
    exteriorCondition: text({
      ui: {
        displayMode: 'textarea',
        description: 'Notes on exterior condition, damage, paint, etc.',
      },
      label: 'Exterior Condition Notes',
    }),
    interiorCondition: text({
      ui: {
        displayMode: 'textarea',
        description: 'Notes on interior condition, wear, cleanliness, etc.',
      },
      label: 'Interior Condition Notes',
    }),
    mechanicalIssues: text({
      ui: {
        displayMode: 'textarea',
        description: 'Known mechanical issues or concerns',
      },
      label: 'Mechanical Issues',
    }),

    // Valuation
    kbbValueCents: integer({ access: { update: () => false }, label: 'Reference Value Storage (cents)', ui: { description: 'Legacy storage column for an operator-recorded, provider-neutral reference value', itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    offerAmountCents: integer({ access: { update: () => false }, label: 'Offer Amount (cents)', ui: { description: 'Dealership offer in integer USD cents' } }),
    referenceValue: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.kbbValueCents == null ? null : item.kbbValueCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    kbbValue: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.kbbValueCents == null ? null : item.kbbValueCents / 100 } }),
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    offerAmount: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.offerAmountCents == null ? null : item.offerAmountCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),

    // Images
    mainPhoto: image({
      storage: 'my_images',
      label: 'Main Photo',
    }),

    // Relationships
    lead: relationship({
      access: { create: denyAll, update: denyAll },
      ref: 'Lead.tradeIns',
      ui: {
        displayMode: 'select',
      },
      label: 'Customer Lead',
    }),
    deal: relationship({
      // Written only by createDealPencil and setDealTradeIn, which enforce the pencil-only rule;
      // a write from this side would skip the Deal hooks.
      access: { create: denyAll, update: denyAll },
      ref: 'Deal.tradeInVehicle',
      ui: {
        displayMode: 'select',
      },
      label: 'Deal',
    }),
    appraisedBy: relationship({
      access: { update: () => false },
      ref: 'User',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Appraised By',
    }),
  },
})
