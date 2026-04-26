import { list } from '@keystone-6/core'
import { text, float, integer } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const PartsInventory = list({
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
      initialColumns: ['partNumber', 'description', 'quantity', 'cost', 'price'],
    },
    labelField: 'partNumber',
  },
  fields: {
    // Part Details
    partNumber: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: 'Part Number',
    }),
    description: text({
      validation: { isRequired: true },
      label: 'Description',
    }),

    // Inventory
    quantity: integer({
      validation: { isRequired: true },
      defaultValue: 0,
      label: 'Quantity in Stock',
    }),
    minimumQuantity: integer({
      label: 'Minimum Quantity',
      ui: {
        description: 'Reorder threshold',
      },
    }),

    // Pricing
    cost: float({
      label: 'Cost',
      ui: {
        description: 'Dealer cost per unit',
      },
    }),
    price: float({
      validation: { isRequired: true },
      label: 'Retail Price',
      ui: {
        description: 'Sale price per unit',
      },
    }),

    // Supplier
    supplier: text({
      label: 'Supplier',
      ui: {
        description: 'Parts supplier name',
      },
    }),
    supplierPartNumber: text({
      label: 'Supplier Part Number',
      ui: {
        description: 'Supplier-specific part number',
      },
    }),
  },
})
