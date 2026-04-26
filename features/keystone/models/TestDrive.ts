import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, checkbox, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const TestDrive = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true, // Allow public test drive scheduling from storefront
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['lead', 'vehicle', 'scheduledTime', 'salesperson', 'completed'],
    },
  },
  fields: {
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
      defaultValue: false,
      label: 'Completed',
    }),
    driverLicenseVerified: checkbox({
      defaultValue: false,
      label: 'Driver License Verified',
      ui: {
        description: 'Confirm license was checked before test drive',
      },
    }),

    // Feedback
    feedback: text({
      ui: {
        displayMode: 'textarea',
        description: 'Customer feedback after the test drive',
      },
      label: 'Feedback',
    }),
    interestedLevel: select({
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
