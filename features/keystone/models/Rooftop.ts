import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, select, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { getConnectedId, hasDealerGroupAccess, membershipKey, rooftopAccessFilter } from '../tenancy'
import { trackingFields } from './trackingFields'

export const Rooftop = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageDealerships,
      update: permissions.canManageDealerships,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || rooftopAccessFilter(session as any),
      update: ({ session }) => permissions.canManageDealerships({ session }) && rooftopAccessFilter(session as any),
    },
    item: {
      create: async ({ session, inputData, context }) => {
        const dealerGroupId = getConnectedId(inputData.dealerGroup)
        if (!dealerGroupId || !session?.itemId) return false
        return hasDealerGroupAccess(session as any, dealerGroupId) || permissions.canManageDealerships({ session })
      },
    },
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const dealerGroupId = getConnectedId(resolvedData.dealerGroup)
        const code = String(resolvedData.code || '').trim().toUpperCase()
        if (!dealerGroupId || !code) throw new Error('Dealer group and rooftop code are required')
        return { ...resolvedData, code, rooftopKey: membershipKey(dealerGroupId, code) }
      },
    },
  },
  ui: { listView: { initialColumns: ['code', 'name', 'dealerGroup', 'status', 'timezone'] } },
  fields: {
    ...trackingFields,
    rooftopKey: text({
      isIndexed: 'unique',
      access: { read: permissions.canManageDealerships, create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' }, listView: { fieldMode: 'hidden' } },
    }),
    code: text({ validation: { isRequired: true, length: { min: 1, max: 40 } }, access: { update: denyAll } }),
    name: text({ validation: { isRequired: true, length: { min: 1, max: 200 } } }),
    publicSlug: text({
      isIndexed: 'unique',
      validation: { isRequired: true, length: { min: 2, max: 120 }, match: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ } },
    }),
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
    timezone: text({ defaultValue: 'America/New_York', validation: { isRequired: true } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true, length: { min: 3, max: 3 } } }),
    dealerGroup: relationship({ ref: 'DealerGroup.rooftops', access: { update: denyAll } }),
    memberships: relationship({ ref: 'RooftopMembership.rooftop', many: true, access: { update: denyAll } }),
    membershipAuditEvents: relationship({ ref: 'MembershipAuditEvent.rooftop', many: true, access: { update: denyAll } }),
  },
})
