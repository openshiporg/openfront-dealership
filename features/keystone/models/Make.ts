import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { relationship, text, image } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'

export const Make = list({
  access: {
    operation: {
      query: () => true, // Allow public access
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
  },
  ui: {
    listView: {
      initialColumns: ['name', 'models'],
    },
  },
  fields: {
    ...trackingFields,
    name: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: 'Make Name',
      ui: {
        description: 'Vehicle manufacturer name (e.g., Toyota, Honda, Ford)',
      },
    }),
    logo: image({
      storage: 'my_images',
      label: 'Logo',
      ui: {
        description: 'Manufacturer logo image',
      },
    }),
    // Relationships
    models: relationship({
      ref: 'Model.make',
      many: true,
      access: { update: denyAll },
      ui: {
        displayMode: 'cards',
        cardFields: ['name', 'bodyStyle'],
        inlineCreate: { fields: ['name', 'bodyStyle', 'baseYear'] },
        inlineEdit: { fields: ['name', 'bodyStyle', 'baseYear'] },
        inlineConnect: true,
      },
      label: 'Models',
    }),
  },
})
