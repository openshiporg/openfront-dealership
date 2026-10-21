import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { getConnectedId, hasRooftopAccess, membershipKey } from '../tenancy'
import { trackingFields } from './trackingFields'

export const RooftopMembership = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || { user: { id: { equals: session?.itemId } } },
      update: ({ session }) => ({ rooftop: { dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: 'active' }, accessAllRooftops: { equals: true } } } } } }),
      delete: ({ session }) => ({ rooftop: { dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: 'active' }, accessAllRooftops: { equals: true } } } } } }),
    },
    item: {
      create: async ({ session, inputData, context }) => {
        const rooftopId = getConnectedId(inputData.rooftop)
        if (!rooftopId || !session?.itemId) return false
        if (permissions.canManageDealerships({ session })) return true
        const rooftop = await context.sudo().query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id dealerGroup { id }' })
        return Boolean(rooftop?.dealerGroup?.id && hasRooftopAccess(session as any, rooftop.dealerGroup.id, rooftopId))
      },
    },
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const rooftopId = getConnectedId(resolvedData.rooftop)
        const userId = getConnectedId(resolvedData.user)
        if (!rooftopId || !userId) throw new Error('Rooftop and user are required')
        return { ...resolvedData, membershipKey: membershipKey(rooftopId, userId) }
      },
    },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['user', 'rooftop', 'role', 'status'] } },
  fields: {
    ...trackingFields,
    membershipKey: text({
      isIndexed: 'unique',
      access: { read: permissions.canManageDealerships, create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' }, listView: { fieldMode: 'hidden' } },
    }),
    user: relationship({ ref: 'User.rooftopMemberships', access: { update: denyAll } }),
    rooftop: relationship({ ref: 'Rooftop.memberships', access: { update: denyAll } }),
    role: relationship({ ref: 'Role.rooftopMemberships', access: { update: denyAll } }),
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
    invitedBy: relationship({ ref: 'User' }),
    joinedAt: timestamp(),
  },
})
