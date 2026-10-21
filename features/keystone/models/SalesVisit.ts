import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const SalesVisit = list({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadLeadChildren, update: rules.canReadLeadChildren, delete: rules.canReadLeadChildren },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    lead: relationship({
      ref: 'Lead.salesVisits',
      db: { extendPrismaSchema: field => field.replace(/lead Lead\?/g, 'lead Lead').replace(/leadId String\?/g, 'leadId String') },
    }),
    customer: relationship({
      ref: 'Customer.salesVisits',
      db: { extendPrismaSchema: field => field.replace(/customer Customer\?/g, 'customer Customer').replace(/customerId String\?/g, 'customerId String') },
    }),
    vehicle: relationship({ ref: 'Vehicle.salesVisits' }),
    assignedSalesperson: relationship({
      ref: 'User.assignedSalesVisits',
      db: { extendPrismaSchema: field => field.replace(/assignedSalesperson User\?/g, 'assignedSalesperson User').replace(/assignedSalespersonId String\?/g, 'assignedSalespersonId String') },
    }),
    manager: relationship({ ref: 'User.managedSalesVisits' }),
    kind: select({
      type: 'string',
      options: [
        { label: 'Sales appointment', value: 'appointment' },
        { label: 'Showroom visit', value: 'showroom' },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: 'string',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Arrived', value: 'arrived' },
        { label: 'Manager turn', value: 'manager-turn' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No show', value: 'no-show' },
      ],
      validation: { isRequired: true },
    }),
    scheduledAt: timestamp(),
    arrivedAt: timestamp(),
    managerTurnAt: timestamp(),
    completedAt: timestamp(),
    outcome: text(),
    notes: text({ ui: { displayMode: 'textarea' } }),
  },
})
