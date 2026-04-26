import { list } from '@keystone-6/core'
import { relationship, text, select, float, integer } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const RepairOrderLineItem = list({
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
      initialColumns: ['serviceOrder', 'itemType', 'description', 'quantity', 'price'],
    },
    labelField: 'description',
  },
  fields: {
    // Service Order relationship
    serviceOrder: relationship({
      ref: 'ServiceOrder.lineItems',
      ui: {
        displayMode: 'select',
      },
      label: 'Service Order',
    }),

    // Item Details
    itemType: select({
      type: 'string',
      options: [
        { label: 'Labor', value: 'labor' },
        { label: 'Part', value: 'part' },
      ],
      validation: { isRequired: true },
      label: 'Item Type',
    }),
    description: text({
      validation: { isRequired: true },
      label: 'Description',
      ui: {
        description: 'Description of labor or part',
      },
    }),
    partNumber: text({
      label: 'Part Number',
      ui: {
        description: 'Part number if applicable',
      },
    }),

    // Quantity and Pricing
    quantity: float({
      validation: { isRequired: true },
      defaultValue: 1,
      label: 'Quantity',
      ui: {
        description: 'Quantity or hours',
      },
    }),
    unitPrice: float({
      validation: { isRequired: true },
      label: 'Unit Price',
      ui: {
        description: 'Price per unit or hourly rate',
      },
    }),
    price: float({
      validation: { isRequired: true },
      label: 'Total Price',
      ui: {
        description: 'Quantity × Unit Price',
      },
    }),

    // Cost tracking
    cost: float({
      label: 'Cost',
      ui: {
        description: 'Dealer cost for part (not shown to customer)',
      },
    }),
  },
})
