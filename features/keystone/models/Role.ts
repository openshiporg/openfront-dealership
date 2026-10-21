import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'
import { permissionFields } from './fields'
import { trackingFields } from './trackingFields'

export const Role = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: permissions.canManageRoles,
    },
    filter: {
      // Staff without canReadRoles/canManageRoles can read only their own Role,
      // which the dashboard shell needs for canAccessDashboard.
      query: rules.canReadRoles,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    isHidden: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'assignedTo'],
    },
    itemView: {
      defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
    },
  },
  fields: {
    ...trackingFields,
    name: text({ validation: { isRequired: true } }),
    ...permissionFields,

    // Relationship to users
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      access: { update: denyAll },
      ui: {
        itemView: { fieldMode: 'read' },
      },
    }),
    dealerGroupMemberships: relationship({
      ref: 'DealerGroupMembership.role',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    rooftopMemberships: relationship({
      ref: 'RooftopMembership.role',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
  },
});
