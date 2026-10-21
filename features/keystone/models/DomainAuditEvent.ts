import { list } from '@keystone-6/core'
import { json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const DomainAuditEvent = list({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['occurredAt', 'aggregateType', 'aggregateId', 'action', 'actor'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    requestHash: text({ validation: { isRequired: true }, access: { create: () => false, update: () => false } }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true }, isIndexed: true }),
    action: text({ validation: { isRequired: true } }),
    beforeSnapshot: json({ defaultValue: null }),
    afterSnapshot: json({ defaultValue: null }),
    metadata: json({ defaultValue: {} }),
    actor: relationship({ ref: 'User.domainAuditEvents' }),
    occurredAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' }, isIndexed: true }),
  },
})
