import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text, select, integer, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const ServiceAppointment = list({
  access: {
    operation: {
      query: permissions.canManageService,
      create: permissions.canManageService,
      update: permissions.canManageService,
      delete: permissions.canManageService,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageService'),
    },
    item: { create: canCreateRooftopRecord('canManageService') },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'lead', listKey: 'Lead' },
      { field: 'customer', listKey: 'User', kind: 'user' },
      { field: 'assignedTech', listKey: 'User', kind: 'user' },
      { field: 'servicePackage', listKey: 'ServicePackage' },
    ]),
  },
  ui: {
    listView: {
      initialColumns: ['customer', 'appointmentDate', 'serviceType', 'status', 'assignedTech'],
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    requestedBy: relationship({ ref: 'User', access: { read: denyAll, create: denyAll, update: denyAll } }),
    // Customer and Vehicle
    lead: relationship({
      access: { create: denyAll, update: denyAll },
      ref: 'Lead.serviceAppointments',
      ui: {
        displayMode: 'select',
        labelField: 'email',
      },
      label: 'Customer Lead',
    }),
    customer: relationship({
      ref: 'User.customerAppointments',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Customer',
    }),
    servicePackage: relationship({
      ref: 'ServicePackage',
      ui: { displayMode: 'select', labelField: 'name' },
      label: 'Service Package',
    }),
    vehicleVin: text(),
    transportationNeed: select({ type: 'string', options: ['none','waiter','shuttle','loaner','rental','drop-off'].map(value => ({ label: value, value })), defaultValue: 'none' }),
    capacitySlot: text(),
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
      access: { update: () => false },
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
      access: { update: () => false },
      ref: 'ServiceOrder.appointment',
      ui: {
        displayMode: 'cards',
        cardFields: ['status', 'grandTotal'],
      },
      label: 'Service Order',
    }),
  },
})
