import { list } from '@keystone-6/core'
import { checkbox, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { requiredRelationshipDb } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const SavedReport = list({
  access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') } },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{ field: 'owner', listKey: 'User', kind: 'user' }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    owner: relationship({ ref: 'User', db: requiredRelationshipDb('owner') }),
    name: text({ validation: { isRequired: true } }),
    reportType: select({ type: 'string', options: ['operations', 'audit', 'accounting-exceptions', 'payment-reconciliation'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    filters: json({ defaultValue: {} }),
    exportFormat: select({ type: 'string', options: ['json', 'csv'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    schedule: select({ type: 'string', options: ['manual', 'daily', 'weekly', 'monthly'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    active: checkbox({ defaultValue: true }),
    nextRunAt: timestamp(),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  },
})
