import { list } from '@keystone-6/core';
import { json, relationship, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const AccountingProviderResponse = list({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') }
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{
        field: 'batch',
        listKey: 'AccountingBatch'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    batch: relationship({
      ref: 'AccountingBatch',
      db: requiredRelationshipDb('batch')
    }),
    providerKey: text({ validation: { isRequired: true } }),
    requestFingerprint: text({ validation: { isRequired: true } }),
    responseCode: text({ validation: { isRequired: true } }),
    externalReference: text(),
    immutableResponse: json({ defaultValue: {} }),
    receivedAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
