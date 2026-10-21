import { list } from '@keystone-6/core'
import { json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const CustomerMergeEvent = list({
  access: {
    operation: {
      query: permissions.canManageLeads,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadLeadOperations,
      update: rules.canReadLeadOperations,
      delete: rules.canReadLeadOperations,
    },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    survivor: relationship({ ref: 'Customer.mergeEventsAsSurvivor', db: { extendPrismaSchema: field => field.replace(/survivor Customer\?/g, 'survivor Customer').replace(/survivorId String\?/g, 'survivorId String') } }),
    duplicate: relationship({ ref: 'Customer.mergeEventsAsDuplicate', db: { extendPrismaSchema: field => field.replace(/duplicate Customer\?/g, 'duplicate Customer').replace(/duplicateId String\?/g, 'duplicateId String') } }),
    actor: relationship({ ref: 'User.customerMergeEvents', db: { extendPrismaSchema: field => field.replace(/actor User\?/g, 'actor User').replace(/actorId String\?/g, 'actorId String') } }),
    reason: text({ validation: { isRequired: true } }),
    mergedAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    movedLeadIds: json({ defaultValue: [] }),
    evidenceSnapshot: json({ defaultValue: {} }),
  },
})
