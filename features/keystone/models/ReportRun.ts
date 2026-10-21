import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { requiredRelationshipDb } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const ReportRun = list({
  access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') } },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{ field: 'savedReport', listKey: 'SavedReport' }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    savedReport: relationship({ ref: 'SavedReport', db: requiredRelationshipDb('savedReport') }),
    status: select({ type: 'string', options: ['queued', 'completed', 'failed', 'expired'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    exportFormat: select({ type: 'string', options: ['json', 'csv'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    resultSnapshot: json({ defaultValue: {} }),
    resultDigest: text(),
    errorCode: text(),
    completedAt: timestamp(),
    expiresAt: timestamp(),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  },
})
