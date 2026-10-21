import { list } from '@keystone-6/core'
import { relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const LeadAssignmentEvent = list({
  access: {
    operation: {
      query: permissions.canAccessLeads,
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
    lead: relationship({ ref: 'Lead.assignmentEvents', db: { extendPrismaSchema: field => field.replace(/lead Lead\?/g, 'lead Lead').replace(/leadId String\?/g, 'leadId String') } }),
    fromUser: relationship({ ref: 'User.leadAssignmentsFrom' }),
    toUser: relationship({ ref: 'User.leadAssignmentsTo', db: { extendPrismaSchema: field => field.replace(/toUser User\?/g, 'toUser User').replace(/toUserId String\?/g, 'toUserId String') } }),
    actor: relationship({ ref: 'User.performedLeadAssignments', db: { extendPrismaSchema: field => field.replace(/actor User\?/g, 'actor User').replace(/actorId String\?/g, 'actorId String') } }),
    reason: text({ validation: { isRequired: true } }),
    routeKey: text(),
    assignedAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    firstResponseDueAt: timestamp(),
  },
})
