import { list } from '@keystone-6/core'
import { relationship, text, timestamp, json } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const CustomerContactPreferenceEvent = list({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadCustomers, update: rules.canReadCustomers, delete: rules.canReadCustomers },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    customer: relationship({
      ref: 'Customer.contactPreferenceEvents',
      db: { extendPrismaSchema: field => field.replace(/customer Customer\?/g, 'customer Customer').replace(/customerId String\?/g, 'customerId String') },
    }),
    actor: relationship({
      ref: 'User.customerContactPreferenceEvents',
      db: { extendPrismaSchema: field => field.replace(/actor User\?/g, 'actor User').replace(/actorId String\?/g, 'actorId String') },
    }),
    source: text({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    preferenceSnapshot: json({ defaultValue: {} }),
  },
})
