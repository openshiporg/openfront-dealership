import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, integer, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const ServiceAppointment = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['customer', 'appointmentDate', 'serviceType', 'status', 'assignedTech'],
    },
  },
  fields: {
    // Customer and Vehicle
    customer: relationship({
      ref: 'User.customerAppointments',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Customer',
    }),
    customerVehicleDescription: text({
      label: 'Customer Vehicle',
      ui: {
        description: 'Description of customer vehicle (Year Make Model)',
      },
    }),

    // Appointment Details
    appointmentDate: timestamp({
      label: 'Appointment Date',
      validation: { isRequired: true },
    }),
    serviceType: select({
      type: 'string',
      options: [
        { label: 'Maintenance', value: 'maintenance' },
        { label: 'Repair', value: 'repair' },
        { label: 'Warranty', value: 'warranty' },
        { label: 'Recall', value: 'recall' },
        { label: 'Inspection', value: 'inspection' },
        { label: 'Diagnostic', value: 'diagnostic' },
      ],
      label: 'Service Type',
    }),
    description: text({
      ui: {
        displayMode: 'textarea',
        description: 'Customer complaint or service requested',
      },
      label: 'Description',
    }),
    estimatedDuration: integer({
      label: 'Estimated Duration (Minutes)',
      ui: {
        description: 'Estimated time to complete service',
      },
    }),

    // Assignment
    assignedTech: relationship({
      ref: 'User.techAppointments',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Assigned Technician',
    }),

    // Status
    status: select({
      type: 'string',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Checked In', value: 'checked-in' },
        { label: 'In Progress', value: 'in-progress' },
        { label: 'Waiting for Parts', value: 'waiting-parts' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'scheduled',
      label: 'Status',
    }),

    // Vehicle Info at Service
    mileageIn: integer({
      label: 'Mileage In',
      ui: {
        description: 'Odometer reading when vehicle checked in',
      },
    }),

    // Notes
    advisorNotes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Service advisor notes',
      },
      label: 'Advisor Notes',
    }),

    // Relationship to Service Order
    serviceOrder: relationship({
      ref: 'ServiceOrder.appointment',
      ui: {
        displayMode: 'cards',
        cardFields: ['status', 'grandTotal'],
      },
      label: 'Service Order',
    }),
  },
})
