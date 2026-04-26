import { list } from '@keystone-6/core'
import { relationship, text, select, integer, timestamp, json } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const VehicleConditionReport = list({
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
      initialColumns: ['vehicle', 'reportDate', 'inspector', 'overallCondition'],
    },
    labelField: 'reportDate',
  },
  fields: {
    // Vehicle relationship
    vehicle: relationship({
      ref: 'Vehicle.conditionReports',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),

    // Report Details
    reportDate: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: 'now' },
      label: 'Report Date',
    }),
    inspector: text({
      label: 'Inspector',
      ui: {
        description: 'Name of person who performed inspection',
      },
    }),

    // Condition Ratings
    overallCondition: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Overall Condition',
    }),
    mechanicalRating: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Mechanical Rating',
      ui: {
        description: 'Engine, transmission, drivetrain condition',
      },
    }),
    bodyRating: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Body Rating',
      ui: {
        description: 'Exterior body and paint condition',
      },
    }),
    interiorRating: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Interior Rating',
      ui: {
        description: 'Seats, dashboard, carpet condition',
      },
    }),

    // Issues and Repairs
    issues: json({
      defaultValue: [],
      label: 'Issues',
      ui: {
        description: 'JSON array of identified issues [{description, severity, location}]',
      },
    }),
    estimatedRepairs: integer({
      label: 'Estimated Repair Cost',
      ui: {
        description: 'Estimated cost to address identified issues',
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Additional inspection notes',
      },
      label: 'Notes',
    }),
  },
})
