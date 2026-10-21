import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const FinanceProductQuote = list({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing') }
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{
        field: 'deal',
        listKey: 'Deal'
      }, {
        field: 'product',
        listKey: 'FinanceProduct'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.financeProductQuotes',
      db: requiredRelationshipDb('deal')
    }),
    product: relationship({
      ref: 'FinanceProduct.quotes',
      db: requiredRelationshipDb('product')
    }),
    providerKey: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['requested', 'quoted', 'failed'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    retailPriceCents: integer({ validation: { min: 0 } }),
    costCents: integer({
      validation: { min: 0 },
      access: {
        read: permissions.canViewDealerCost,
        create: () => false,
        update: () => false
      }
    }),
    evidenceReference: text(),
    requestSnapshot: json({ defaultValue: {} }),
    resultSnapshot: json({ defaultValue: {} }),
    requestedAt: timestamp({ validation: { isRequired: true } }),
    completedAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
