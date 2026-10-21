import { list } from '@keystone-6/core'
import { relationship, text } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const CustomerHousehold = list({
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
    householdKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    displayName: text({ validation: { isRequired: true } }),
    members: relationship({ ref: 'Customer.household', many: true }),
  },
})
