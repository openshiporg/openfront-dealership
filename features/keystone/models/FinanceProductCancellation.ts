import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const FinanceProductCancellation = list({
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
        field: 'menu',
        listKey: 'FinanceMenuVersion'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.financeProductCancellations',
      db: requiredRelationshipDb('deal')
    }),
    menu: relationship({
      ref: 'FinanceMenuVersion.cancellations',
      db: requiredRelationshipDb('menu')
    }),
    productCode: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['requested', 'completed', 'denied'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    reason: text({ validation: { isRequired: true } }),
    refundCents: integer({ validation: { min: 0 } }),
    evidence: json({ defaultValue: {} }),
    requestedAt: timestamp({ validation: { isRequired: true } }),
    completedAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
