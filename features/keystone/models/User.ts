import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { checkbox, password, relationship, text, float, select } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'
import { trackingFields } from './trackingFields'

export const User = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManagePeople,
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
        if (permissions.canEditOtherPeople({ session }) || permissions.canManagePeople({ session })) return 'edit'

        // edit themselves
        if (session?.itemId === item?.id) return 'edit'

        // else, default all fields to read mode
        return 'read'
      },
    },
  },
  fields: {
    ...trackingFields,
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
        create: permissions.canManageRoles,
        update: ({ session, item }) =>
          permissions.canManageRoles({ session }) && session?.itemId !== item.id,
      },
      ui: {
        createView: { fieldMode: args => permissions.canManageRoles(args) ? 'edit' : 'hidden' },
        itemView: {
          fieldMode: ({ session, item }) => permissions.canManageRoles({ session }) && rules.canUpdatePeople({ session }) === true && session?.itemId !== item?.id ? 'edit' : 'read',
        },
      },
    }),
    dealerGroupMemberships: relationship({
      ref: 'DealerGroupMembership.user',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    rooftopMemberships: relationship({
      ref: 'RooftopMembership.user',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    membershipAuditEvents: relationship({
      ref: 'MembershipAuditEvent.targetUser',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    performedMembershipAuditEvents: relationship({
      ref: 'MembershipAuditEvent.actor',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    domainAuditEvents: relationship({
      ref: 'DomainAuditEvent.actor',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count' },
    }),
    apiKeys: relationship({
      access: { create: () => false, update: () => false },
      ref: 'ApiKey.user',
      many: true,
      ui: {
        itemView: { fieldMode: 'read' },
      },
    }),
    onboardingStatus: select({
      type: 'string',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      label: 'Onboarding Status',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        description: 'Tracks whether this user has completed dealership setup.',
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
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople, read: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id },
      label: 'Employee ID',
      ui: {
        description: 'Internal employee identifier',
        itemView: { fieldMode: ({ session, item }) => permissions.canManagePeople({ session }) ? 'edit' : session?.itemId === item?.id ? 'read' : 'hidden' },
      },
    }),
    commissionRate: float({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople, read: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id },
      label: 'Commission Rate (%)',
      defaultValue: 0,
      ui: {
        description: 'Sales commission percentage (e.g., 10 for 10%)',
        itemView: { fieldMode: ({ session, item }) => permissions.canManagePeople({ session }) ? 'edit' : session?.itemId === item?.id ? 'read' : 'hidden' },
      },
    }),
    isSalesperson: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Is Salesperson',
      ui: {
        description: 'Whether this user is a salesperson',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),
    isServiceAdvisor: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Is Service Advisor',
      ui: {
        description: 'Whether this user is a service advisor',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),
    isFinanceManager: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Is Finance Manager',
      ui: {
        description: 'Whether this user handles financing',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),

    // Reverse relationships are read-only. Their owning domain commands control linkage.
    assignedLeads: relationship({ ref: 'Lead.assignedSalesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Assigned Leads' }),
    deals: relationship({ ref: 'Deal.salesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Deals' }),
    customerAppointments: relationship({ ref: 'ServiceAppointment.customer', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Service Appointments (Customer)' }),
    techAppointments: relationship({ ref: 'ServiceAppointment.assignedTech', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Service Appointments (Technician)' }),
    priceChanges: relationship({ ref: 'PriceHistory.changedBy', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Price Changes' }),
    customerMergeEvents: relationship({ ref: 'CustomerMergeEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    leadAssignmentsFrom: relationship({ ref: 'LeadAssignmentEvent.fromUser', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    leadAssignmentsTo: relationship({ ref: 'LeadAssignmentEvent.toUser', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    performedLeadAssignments: relationship({ ref: 'LeadAssignmentEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    leadRoutingRules: relationship({ ref: 'LeadRoutingRule.assignee', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    customerContactPreferenceEvents: relationship({ ref: 'CustomerContactPreferenceEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    assignedSalesVisits: relationship({ ref: 'SalesVisit.assignedSalesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    managedSalesVisits: relationship({ ref: 'SalesVisit.manager', many: true, access: { update: denyAll }, ui: { displayMode: 'count' } }),
    interactions: relationship({ ref: 'CustomerInteraction.performedBy', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Customer Interactions' }),
    tasks: relationship({ ref: 'Task.assignedTo', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Tasks' }),
    dealApprovals: relationship({ ref: 'DealApproval.approver', many: true, access: { update: denyAll }, ui: { displayMode: 'count' }, label: 'Deal Approvals' }),
  },
});
