import { list } from '@keystone-6/core'
import { text, integer, json, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions } from '../access'
import { canCreateRooftopRecord, publicActiveRooftopScope, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const ServicePackage = list({
  access: {
    operation: {
      query: () => true, // Allow public access to view service packages
      create: permissions.canManageService,
      update: permissions.canManageService,
      delete: permissions.canManageService,
    },
    filter: {
      query: ({ session }) => session && permissions.canManageService({ session })
        ? withRooftopScope(true, session as any, 'canManageService')
        : publicActiveRooftopScope({}),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
    },
    item: { create: canCreateRooftopRecord('canManageService') },
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args) },
  ui: {
    listView: {
      initialColumns: ['name', 'price', 'estimatedDuration'],
    },
    labelField: 'name',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Package Details
    name: text({
      validation: { isRequired: true },
      label: 'Package Name',
      ui: {
        description: 'e.g., Oil Change, Tire Rotation, Brake Service',
      },
    }),
    description: text({
      ui: {
        displayMode: 'textarea',
      },
      label: 'Description',
    }),

    // Pricing and Duration
    priceCents: integer({ validation: { isRequired: true }, label: 'Price (cents)', ui: { description: 'Package price in integer USD cents' } }),
    price: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.priceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    estimatedDuration: integer({
      label: 'Estimated Duration (Minutes)',
      ui: {
        description: 'Expected time to complete',
      },
    }),

    // Included Services
    includedServices: json({
      defaultValue: [],
      label: 'Included Services',
      ui: {
        description: 'JSON array of services included [{service, description}]',
      },
    }),
  },
})
