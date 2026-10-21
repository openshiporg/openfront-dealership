import { list } from '@keystone-6/core';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const FinanceComplianceCheck = list({
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
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['deal', 'checkType', 'status', 'providerKey', 'requestedAt', 'completedAt'] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.financeComplianceChecks',
      db: requiredRelationshipDb('deal')
    }),
    checkType: select({
      type: 'string',
      options: ['identity', 'ofac', 'red-flag', 'privacy'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    providerKey: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['requested', 'completed', 'failed', 'manual-review'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    resultCode: text(),
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
