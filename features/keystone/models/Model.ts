import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, integer } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const Model = list({
  access: {
    operation: {
      query: () => true, // Allow public access
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['name', 'make', 'bodyStyle', 'baseYear'],
    },
    labelField: 'name',
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      label: 'Model Name',
      ui: {
        description: 'Vehicle model name (e.g., Camry, Accord, F-150)',
      },
    }),
    make: relationship({
      ref: 'Make.models',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Make',
    }),
    bodyStyle: select({
      type: 'string',
      options: [
        { label: 'Sedan', value: 'sedan' },
        { label: 'SUV', value: 'suv' },
        { label: 'Truck', value: 'truck' },
        { label: 'Coupe', value: 'coupe' },
        { label: 'Hatchback', value: 'hatchback' },
        { label: 'Convertible', value: 'convertible' },
        { label: 'Wagon', value: 'wagon' },
        { label: 'Van', value: 'van' },
        { label: 'Minivan', value: 'minivan' },
      ],
      label: 'Body Style',
      ui: {
        description: 'Vehicle body style category',
      },
    }),
    baseYear: integer({
      label: 'Base Year',
      ui: {
        description: 'Year when this model was first introduced',
      },
    }),
  },
})
