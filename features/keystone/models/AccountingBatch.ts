import { list } from '@keystone-6/core';
import { integer, json, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, withRooftopScope } from '../tenantRecords';
import { trackingFields } from './trackingFields';

export const AccountingBatch = list({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') }
  },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    sourceType: select({
      type: 'string',
      options: ['deal', 'service', 'parts', 'payment'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    sourceId: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['staged', 'posting', 'posted', 'failed', 'reconciled', 'locked'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    providerKey: text({ validation: { isRequired: true } }),
    lines: json({ defaultValue: [] }),
    totalDebitCents: integer({ validation: {
        isRequired: true,
        min: 0
      } }),
    totalCreditCents: integer({ validation: {
        isRequired: true,
        min: 0
      } }),
    attemptCount: integer({
      validation: {
        isRequired: true,
        min: 0
      },
      defaultValue: 0
    }),
    externalReference: text(),
    lastErrorCode: text(),
    postedAt: timestamp(),
    reconciledAt: timestamp(),
    lockedAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
