import { list } from '@keystone-6/core'
import { relationship, text, select, float, integer, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions } from '../access'
import { isServiceOrderEvidenceLocked } from '../lifecycle/serviceOrderLifecycle'
import { assertAccessibleRelationship, assertRelationshipUnchanged, connectedId } from '../lifecycle/relationshipGuards'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const RepairOrderLineItem = list({
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
    },
    item: { create: () => false },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: 'read' },
    listView: {
      initialColumns: ['serviceOrder', 'itemType', 'description', 'quantity', 'price'],
    },
    labelField: 'description',
  },
  hooks: {
    validate: async (args: any) => {
      const { operation, resolvedData, item, context } = args
      await validateRooftopRecord(args, [{ field: 'serviceOrder', listKey: 'ServiceOrder' }])
      const serviceOrderId = operation === 'create'
        ? connectedId(resolvedData.serviceOrder)
        : String(item.serviceOrderId || '')
      if (!serviceOrderId) throw new Error('Repair order line item requires a service order')
      if (operation === 'update') {
        assertRelationshipUnchanged('serviceOrder', resolvedData, item.serviceOrderId)
      }
      const order = await assertAccessibleRelationship(context, 'ServiceOrder', serviceOrderId, 'id status')
      if (isServiceOrderEvidenceLocked(order?.status)) {
        throw new Error('Line items are immutable after service completion')
      }
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Service Order relationship
    serviceOrder: relationship({
      ref: 'ServiceOrder.lineItems',
      ui: {
        displayMode: 'select',
      },
      label: 'Service Order',
    }),

    // Item Details
    itemType: select({
      type: 'string',
      options: [
        { label: 'Labor', value: 'labor' },
        { label: 'Part', value: 'part' },
        { label: 'Sublet', value: 'sublet' },
      ],
      validation: { isRequired: true },
      label: 'Item Type',
    }),
    description: text({
      validation: { isRequired: true },
      label: 'Description',
      ui: {
        description: 'Description of labor or part',
      },
    }),
    partNumber: text({
      label: 'Part Number',
      ui: {
        description: 'Part number if applicable',
      },
    }),

    // Quantity and Pricing
    quantity: float({
      validation: { isRequired: true },
      defaultValue: 1,
      label: 'Quantity',
      ui: {
        description: 'Quantity or hours',
      },
    }),
    unitPriceCents: integer({ validation: { isRequired: true }, label: 'Unit Price (cents)', ui: { description: 'Price per unit or hourly rate in integer USD cents' } }),
    priceCents: integer({ validation: { isRequired: true }, label: 'Total Price (cents)', ui: { description: 'Quantity × unit price in integer USD cents' } }),
    costCents: integer({ access: { read: permissions.canViewDealerCost }, label: 'Cost (cents)', ui: { description: 'Dealer cost in integer USD cents' } }),
    unitPrice: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.unitPriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    price: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.priceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    cost: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.costCents == null ? null : item.costCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
  },
})
