import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const Lead = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true, // Allow public lead creation from storefront forms
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['firstName', 'lastName', 'status', 'source', 'assignedSalesperson', 'createdAt'],
    },
  },
  fields: {
    // Contact Information
    firstName: text({
      validation: { isRequired: true },
      label: 'First Name',
    }),
    lastName: text({
      validation: { isRequired: true },
      label: 'Last Name',
    }),
    email: text({
      label: 'Email',
    }),
    phone: text({
      label: 'Phone',
    }),

    // Lead Source
    source: select({
      type: 'string',
      options: [
        { label: 'Walk-In', value: 'walk-in' },
        { label: 'Website', value: 'website' },
        { label: 'Phone', value: 'phone' },
        { label: 'Referral', value: 'referral' },
        { label: 'Advertisement', value: 'ad' },
        { label: 'Social Media', value: 'social' },
        { label: 'Third Party', value: 'third-party' },
      ],
      label: 'Source',
      ui: {
        description: 'How the lead found the dealership',
      },
    }),

    // Vehicle Interest
    interestedVehicle: relationship({
      ref: 'Vehicle.leads',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Interested Vehicle',
    }),
    budgetRange: select({
      type: 'string',
      options: [
        { label: 'Under $20,000', value: 'under-20k' },
        { label: '$20,000 - $30,000', value: '20-30k' },
        { label: '$30,000 - $40,000', value: '30-40k' },
        { label: '$40,000 - $50,000', value: '40-50k' },
        { label: '$50,000 - $75,000', value: '50-75k' },
        { label: '$75,000 - $100,000', value: '75-100k' },
        { label: 'Over $100,000', value: 'over-100k' },
      ],
      label: 'Budget Range',
    }),
    tradeInVehicle: text({
      label: 'Trade-In Vehicle',
      ui: {
        description: 'Description of vehicle they want to trade in',
      },
    }),

    // Timeline
    timeframe: select({
      type: 'string',
      options: [
        { label: 'Immediately', value: 'immediately' },
        { label: 'This Week', value: 'this-week' },
        { label: 'This Month', value: 'this-month' },
        { label: 'Just Looking', value: 'just-looking' },
      ],
      label: 'Purchase Timeframe',
    }),

    // Status
    status: select({
      type: 'string',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Test Drive Scheduled', value: 'test-drive-scheduled' },
        { label: 'Negotiating', value: 'negotiating' },
        { label: 'Closed - Won', value: 'closed-won' },
        { label: 'Closed - Lost', value: 'closed-lost' },
      ],
      defaultValue: 'new',
      label: 'Status',
    }),

    // Assignment
    assignedSalesperson: relationship({
      ref: 'User.assignedLeads',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Assigned Salesperson',
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Additional notes about the lead',
      },
      label: 'Notes',
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Created At',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    lastContact: timestamp({
      label: 'Last Contact',
      ui: {
        description: 'Last time this lead was contacted',
      },
    }),

    // Relationships
    testDrives: relationship({
      ref: 'TestDrive.lead',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['vehicle', 'scheduledTime', 'completed'],
        inlineCreate: { fields: ['vehicle', 'scheduledTime'] },
        inlineConnect: true,
      },
      label: 'Test Drives',
    }),
    deals: relationship({
      ref: 'Deal.lead',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['vehicle', 'status', 'vehiclePrice'],
      },
      label: 'Deals',
    }),
    interactions: relationship({
      ref: 'CustomerInteraction.lead',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['interactionType', 'date', 'outcome', 'followUpDate'],
        inlineCreate: { fields: ['interactionType', 'date', 'notes'] },
      },
      label: 'Interactions',
    }),
    tasks: relationship({
      ref: 'Task.lead',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['title', 'dueDate', 'priority', 'completed'],
        inlineCreate: { fields: ['title', 'dueDate', 'priority'] },
      },
      label: 'Tasks',
    }),
  },
})
