import { list } from '@keystone-6/core'
import { relationship, text, select, timestamp, checkbox } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const Task = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['title', 'assignedTo', 'dueDate', 'priority', 'completed'],
    },
    labelField: 'title',
  },
  fields: {
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
      defaultValue: false,
      label: 'Completed',
    }),

    // Dates
    dueDate: timestamp({
      label: 'Due Date',
    }),
    completedDate: timestamp({
      label: 'Completed Date',
      ui: {
        description: 'When task was marked complete',
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Created At',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
})
