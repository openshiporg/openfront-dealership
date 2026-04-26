import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'

export const Role = list({
  access: {
    operation: {
      ...allOperations(permissions.canManageRoles),
      query: () => true,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'assignedTo'],
    },
    itemView: {
      defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),

    // General permissions
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canAccessDashboard: checkbox({ defaultValue: false }),

    // Dealership-specific permissions
    canManageInventory: checkbox({
      defaultValue: false,
      label: 'Can Manage Inventory',
      ui: {
        description: 'Can add, edit, and delete vehicles in inventory',
      },
    }),
    canViewInventory: checkbox({
      defaultValue: true,
      label: 'Can View Inventory',
      ui: {
        description: 'Can view vehicle inventory',
      },
    }),
    canManageLeads: checkbox({
      defaultValue: false,
      label: 'Can Manage Leads',
      ui: {
        description: 'Can create, edit, and assign leads',
      },
    }),
    canViewAllLeads: checkbox({
      defaultValue: false,
      label: 'Can View All Leads',
      ui: {
        description: 'Can view leads assigned to others',
      },
    }),
    canManageDeals: checkbox({
      defaultValue: false,
      label: 'Can Manage Deals',
      ui: {
        description: 'Can create, edit, and close deals',
      },
    }),
    canApproveDeals: checkbox({
      defaultValue: false,
      label: 'Can Approve Deals',
      ui: {
        description: 'Can approve deals above certain thresholds',
      },
    }),
    canManageService: checkbox({
      defaultValue: false,
      label: 'Can Manage Service',
      ui: {
        description: 'Can manage service appointments and orders',
      },
    }),
    canViewReports: checkbox({
      defaultValue: false,
      label: 'Can View Reports',
      ui: {
        description: 'Can view sales and inventory reports',
      },
    }),
    canManageFinancing: checkbox({
      defaultValue: false,
      label: 'Can Manage Financing',
      ui: {
        description: 'Can manage financing options and approvals',
      },
    }),
    canManageTradeIns: checkbox({
      defaultValue: false,
      label: 'Can Manage Trade-Ins',
      ui: {
        description: 'Can appraise and manage trade-in vehicles',
      },
    }),

    // Relationship to users
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      ui: {
        itemView: { fieldMode: 'read' },
      },
    }),
  },
});
