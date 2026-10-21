import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text, select, checkbox, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const TestDrive = list({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadLeadChildren,
      update: rules.canReadLeadChildren,
      delete: rules.canReadLeadChildren,
    },
    item: { create: denyAll },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'lead', listKey: 'Lead' },
      { field: 'vehicle', listKey: 'Vehicle' },
      { field: 'salesperson', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: 'read' },
    listView: {
      initialColumns: ['lead', 'vehicle', 'scheduledTime', 'salesperson', 'completed'],
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    requestedBy: relationship({ ref: 'User', access: { read: denyAll, create: denyAll, update: denyAll } }),
    // Relationships
    lead: relationship({
      ref: 'Lead.testDrives',
      ui: {
        displayMode: 'select',
      },
      label: 'Lead',
    }),
    vehicle: relationship({
      ref: 'Vehicle.testDrives',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),
    salesperson: relationship({
      ref: 'User',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Salesperson',
    }),

    // Scheduling
    scheduledTime: timestamp({
      label: 'Scheduled Time',
      validation: { isRequired: true },
    }),

    // Status
    completed: checkbox({
      access: { update: () => false },
      defaultValue: false,
      label: 'Completed',
    }),
    driverLicenseVerified: checkbox({
      access: { update: () => false },
      defaultValue: false,
      label: 'Driver License Verified',
      ui: {
        description: 'Confirm license was checked before test drive',
      },
    }),

    // Feedback
    feedback: text({
      access: { update: () => false },
      ui: {
        displayMode: 'textarea',
        description: 'Customer feedback after the test drive',
      },
      label: 'Feedback',
    }),
    interestedLevel: select({
      access: { update: () => false },
      type: 'string',
      options: [
        { label: 'Not Interested', value: 'not-interested' },
        { label: 'Maybe', value: 'maybe' },
        { label: 'Very Interested', value: 'very-interested' },
      ],
      label: 'Interest Level',
      ui: {
        description: 'Customer interest level after test drive',
      },
    }),
  },
})
