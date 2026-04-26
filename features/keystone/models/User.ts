import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { checkbox, password, relationship, text, float } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'

export const User = list({
  access: {
    operation: {
      query: () => true,
      create: (args) => {
        // Allow public sign-ups if environment variable is set to true
        if (process.env.PUBLIC_SIGNUPS_ALLOWED === 'true') {
          return true;
        }
        // Otherwise, require canManagePeople permission
        return permissions.canManagePeople(args);
      },
      update: isSignedIn,
      delete: permissions.canManagePeople,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManagePeople(args),
    hideDelete: args => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ['name', 'email', 'role', 'assignedLeads'],
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        // canEditOtherPeople can edit other people
        if (session?.data.role?.canEditOtherPeople) return 'edit'

        // edit themselves
        if (session?.itemId === item?.id) return 'edit'

        // else, default all fields to read mode
        return 'read'
      },
    },
  },
  fields: {
    // Basic Info
    name: text({
      validation: {
        isRequired: true,
      },
    }),
    email: text({
      isFilterable: false,
      isOrderable: false,
      isIndexed: 'unique',
      validation: {
        isRequired: true,
      },
    }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) =>
          permissions.canManagePeople({ session }) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople,
      },
      ui: {
        itemView: {
          fieldMode: args => (permissions.canManagePeople(args) ? 'edit' : 'read'),
        },
      },
    }),

    // Dealership-specific fields
    phone: text({
      label: 'Phone Number',
      ui: {
        description: 'Contact phone number',
      },
    }),
    employeeId: text({
      label: 'Employee ID',
      isIndexed: 'unique',
      ui: {
        description: 'Internal employee identifier',
      },
    }),
    commissionRate: float({
      label: 'Commission Rate (%)',
      defaultValue: 0,
      ui: {
        description: 'Sales commission percentage (e.g., 10 for 10%)',
      },
    }),
    isSalesperson: checkbox({
      defaultValue: false,
      label: 'Is Salesperson',
      ui: {
        description: 'Whether this user is a salesperson',
      },
    }),
    isServiceAdvisor: checkbox({
      defaultValue: false,
      label: 'Is Service Advisor',
      ui: {
        description: 'Whether this user is a service advisor',
      },
    }),
    isFinanceManager: checkbox({
      defaultValue: false,
      label: 'Is Finance Manager',
      ui: {
        description: 'Whether this user handles financing',
      },
    }),

    // Dealership relationships
    assignedLeads: relationship({
      ref: 'Lead.assignedSalesperson',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Assigned Leads',
    }),
    deals: relationship({
      ref: 'Deal.salesperson',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Deals',
    }),
    // Service appointments (as customer)
    customerAppointments: relationship({
      ref: 'ServiceAppointment.customer',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Service Appointments (Customer)',
    }),
    // Service appointments (as technician)
    techAppointments: relationship({
      ref: 'ServiceAppointment.assignedTech',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Service Appointments (Technician)',
    }),
    // Price changes made by this user
    priceChanges: relationship({
      ref: 'PriceHistory.changedBy',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Price Changes',
    }),
    // Customer interactions performed
    interactions: relationship({
      ref: 'CustomerInteraction.performedBy',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Customer Interactions',
    }),
    // Tasks assigned to this user
    tasks: relationship({
      ref: 'Task.assignedTo',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Tasks',
    }),
    // Deal approvals performed
    dealApprovals: relationship({
      ref: 'DealApproval.approver',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Deal Approvals',
    }),
  },
});
