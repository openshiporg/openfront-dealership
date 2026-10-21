import { list } from '@keystone-6/core'
import { checkbox, integer, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { prismaModelDirectives } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const RetentionPolicy = list({
  db: prismaModelDirectives('@@unique([rooftopId, category], map: "RetentionPolicy_rooftop_category_key")'),
  access: { operation: { query: permissions.canManageDealerships, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageDealerships') } },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    category: select({ type: 'string', options: ['customer-intake', 'report-export', 'provider-payload', 'audit-evidence'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    retentionDays: integer({ validation: { isRequired: true, min: 1 } }),
    legalHold: checkbox({ defaultValue: false }),
    rationale: text({ validation: { isRequired: true } }),
    lastSweptAt: timestamp(),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  },
})
