import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text, select, timestamp, checkbox } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const Task = list({
  access: {
    operation: {
      query: permissions.canManageTasks,
      // Task lifecycle and Lead linkage are owned by controlled operator commands.
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadLeadChildren,
      update: rules.canReadLeadChildren,
      delete: rules.canReadLeadChildren,
    },
    item: { create: () => false },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'lead', listKey: 'Lead' },
      { field: 'assignedTo', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ['title', 'assignedTo', 'dueDate', 'priority', 'completed'],
    },
    labelField: 'title',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Task Details
    title: text({
      validation: { isRequired: true },
      label: 'Title',
    }),
    description: text({
      ui: {
        displayMode: 'textarea',
      },
      label: 'Description',
    }),

    // Assignment
    assignedTo: relationship({
      ref: 'User.tasks',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Assigned To',
    }),

    // Related Lead
    lead: relationship({
      ref: 'Lead.tasks',
      ui: {
        displayMode: 'select',
      },
      label: 'Related Lead',
    }),

    // Priority and Status
    priority: select({
      type: 'string',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
      defaultValue: 'medium',
      label: 'Priority',
    }),
    completed: checkbox({
      access: { update: () => false },
      defaultValue: false,
      label: 'Completed',
    }),

    // Dates
    dueDate: timestamp({
      label: 'Due Date',
    }),
    completedDate: timestamp({
      access: { update: () => false },
      label: 'Completed Date',
      ui: {
        description: 'When task was marked complete',
      },
    }),
  },
})
