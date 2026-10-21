import { list } from '@keystone-6/core'
import { relationship, text, integer, timestamp, checkbox } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const VehicleHistory = list({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, ['canViewInventory', 'canManageInventory']),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory'),
    },
    item: { create: canCreateRooftopRecord('canManageInventory') },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [{ field: 'vehicle', listKey: 'Vehicle' }]),
  },
  ui: {
    listView: {
      initialColumns: ['vehicle', 'acquisitionDate', 'previousOwners', 'hasAccidents'],
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle relationship
    vehicle: relationship({
      ref: 'Vehicle.history',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),

    // Acquisition Details
    acquisitionDate: timestamp({
      label: 'Acquisition Date',
      ui: {
        description: 'Date vehicle was acquired by dealership',
      },
    }),
    acquisitionSource: text({
      label: 'Acquisition Source',
      ui: {
        description: 'Where vehicle was acquired (trade-in, auction, etc.)',
      },
    }),

    // Ownership History
    previousOwners: integer({
      label: 'Previous Owners',
      ui: {
        description: 'Number of previous owners',
      },
    }),
    hasAccidents: checkbox({
      defaultValue: false,
      label: 'Has Accidents',
      ui: {
        description: 'Vehicle has been in one or more accidents',
      },
    }),
    accidentDetails: text({
      ui: {
        displayMode: 'textarea',
        description: 'Details of any accidents or damage history',
      },
      label: 'Accident Details',
    }),

    // Service History
    serviceRecords: text({
      ui: {
        displayMode: 'textarea',
        description: 'Summary of known service history',
      },
      label: 'Service Records',
    }),

    // Title Information
    titleStatus: text({
      label: 'Title Status',
      ui: {
        description: 'Clean, Salvage, Rebuilt, etc.',
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Additional history notes',
      },
      label: 'Notes',
    }),
  },
})
