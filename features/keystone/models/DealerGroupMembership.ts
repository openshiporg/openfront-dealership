import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { checkbox, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { getConnectedId, hasDealerGroupAccess, membershipKey } from '../tenancy'
import { trackingFields } from './trackingFields'

export const DealerGroupMembership = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || { user: { id: { equals: session?.itemId } } },
      update: ({ session }) => ({ dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: 'active' }, accessAllRooftops: { equals: true } } } } }),
      delete: ({ session }) => ({ dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: 'active' }, accessAllRooftops: { equals: true } } } } }),
    },
    item: {
      create: async ({ session, inputData }) => {
        const dealerGroupId = getConnectedId(inputData.dealerGroup)
        return Boolean(dealerGroupId && session?.itemId && (permissions.canManageDealerships({ session }) || hasDealerGroupAccess(session as any, dealerGroupId)))
      },
    },
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const dealerGroupId = getConnectedId(resolvedData.dealerGroup)
        const userId = getConnectedId(resolvedData.user)
        if (!dealerGroupId || !userId) throw new Error('Dealer group and user are required')
        return { ...resolvedData, membershipKey: membershipKey(dealerGroupId, userId) }
      },
    },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['user', 'dealerGroup', 'role', 'status', 'accessAllRooftops'] } },
  fields: {
    ...trackingFields,
    membershipKey: text({
      isIndexed: 'unique',
      access: { read: permissions.canManageDealerships, create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' }, listView: { fieldMode: 'hidden' } },
    }),
    user: relationship({ ref: 'User.dealerGroupMemberships', access: { update: denyAll } }),
    dealerGroup: relationship({ ref: 'DealerGroup.memberships', access: { update: denyAll } }),
    role: relationship({ ref: 'Role.dealerGroupMemberships', access: { update: denyAll } }),
    status: select({
      access: { update: denyAll },
      type: 'string',
      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
      ],
      defaultValue: 'invited',
      validation: { isRequired: true },
    }),
    accessAllRooftops: checkbox({ defaultValue: false, access: { update: denyAll } }),
    invitedBy: relationship({ ref: 'User' }),
    joinedAt: timestamp(),
  },
})
