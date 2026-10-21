import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, select, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { dealerGroupAccessFilter } from '../tenancy'
import { trackingFields } from './trackingFields'

export const DealerGroup = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageDealerships,
      update: permissions.canManageDealerships,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || dealerGroupAccessFilter(session as any),
      update: ({ session }) => permissions.canManageDealerships({ session }) && dealerGroupAccessFilter(session as any),
    },
  },
  ui: { listView: { initialColumns: ['name', 'slug', 'status', 'rooftops'] } },
  fields: {
    ...trackingFields,
    name: text({ validation: { isRequired: true, length: { min: 1, max: 200 } } }),
    slug: text({
      isIndexed: 'unique',
      validation: { isRequired: true, length: { min: 2, max: 120 }, match: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ } },
    }),
    legalName: text({ validation: { length: { max: 240 } } }),
    status: select({
      type: 'string',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
    }),
    rooftops: relationship({ ref: 'Rooftop.dealerGroup', many: true, access: { update: denyAll } }),
    memberships: relationship({ ref: 'DealerGroupMembership.dealerGroup', many: true, access: { update: denyAll } }),
    membershipAuditEvents: relationship({ ref: 'MembershipAuditEvent.dealerGroup', many: true, access: { update: denyAll } }),
  },
})
