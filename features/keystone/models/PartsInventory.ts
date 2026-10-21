import { list } from '@keystone-6/core'
import { text, integer, relationship, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { prismaModelDirectives } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const PartsInventory = list({
  db: prismaModelDirectives('@@unique([rooftopId, partNumber], map: "PartsInventory_rooftop_partNumber_key")'),
  access: {
    operation: {
      query: permissions.canManageService,
      create: permissions.canManageService,
      update: permissions.canManageService,
      delete: permissions.canManageService,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
    },
    item: { create: canCreateRooftopRecord('canManageService') },
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args) },
  ui: {
    listView: {
      initialColumns: ['partNumber', 'description', 'quantity', 'cost', 'price'],
    },
    labelField: 'partNumber',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Part Details
    partNumber: text({
      validation: { isRequired: true },
      label: 'Part Number',
    }),
    description: text({
      validation: { isRequired: true },
      label: 'Description',
    }),

    // Inventory
    binLocation: text(),
    // Stock quantities change only through recorded parts movements.
    committedQuantity: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { create: () => false, update: () => false } }),
    onOrderQuantity: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { create: () => false, update: () => false } }),
    movements: relationship({ ref: 'PartsMovement.part', many: true, access: { create: () => false, update: () => false } }),
    quantity: integer({
      validation: { isRequired: true },
      defaultValue: 0,
      access: { create: () => false, update: () => false },
      label: 'Quantity in Stock',
    }),
    minimumQuantity: integer({
      label: 'Minimum Quantity',
      ui: {
        description: 'Reorder threshold',
      },
    }),

    // Pricing
    costCents: integer({ label: 'Cost (cents)', ui: { description: 'Dealer cost per unit in integer USD cents' } }),
    priceCents: integer({ validation: { isRequired: true }, label: 'Retail Price (cents)', ui: { description: 'Retail price in integer USD cents' } }),
    cost: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.costCents == null ? null : item.costCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    price: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.priceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),

    // Supplier
    supplier: text({
      label: 'Supplier',
      ui: {
        description: 'Parts supplier name',
      },
    }),
    supplierPartNumber: text({
      label: 'Supplier Part Number',
      ui: {
        description: 'Supplier-specific part number',
      },
    }),
  },
})
