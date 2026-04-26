import { list } from '@keystone-6/core'
import { text, float, integer, json } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const ServicePackage = list({
  access: {
    operation: {
      query: () => true, // Allow public access to view service packages
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['name', 'price', 'estimatedDuration'],
    },
    labelField: 'name',
  },
  fields: {
    // Package Details
    name: text({
      validation: { isRequired: true },
      label: 'Package Name',
      ui: {
        description: 'e.g., Oil Change, Tire Rotation, Brake Service',
      },
    }),
    description: text({
      ui: {
        displayMode: 'textarea',
      },
      label: 'Description',
    }),

    // Pricing and Duration
    price: float({
      validation: { isRequired: true },
      label: 'Price',
      ui: {
        description: 'Package price',
      },
    }),
    estimatedDuration: integer({
      label: 'Estimated Duration (Minutes)',
      ui: {
        description: 'Expected time to complete',
      },
    }),

    // Included Services
    includedServices: json({
      defaultValue: [],
      label: 'Included Services',
      ui: {
        description: 'JSON array of services included [{service, description}]',
      },
    }),
  },
})
