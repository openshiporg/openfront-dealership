import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, float, timestamp, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { isSignedIn } from '../access'

export const ServiceOrder = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['appointment', 'status', 'laborTotal', 'partsTotal', 'grandTotal'],
    },
  },
  fields: {
    // Link to Appointment
    appointment: relationship({
      ref: 'ServiceAppointment.serviceOrder',
      ui: {
        displayMode: 'select',
      },
      label: 'Appointment',
    }),

    // Work Description
    diagnosis: text({
      ui: {
        displayMode: 'textarea',
        description: 'Initial diagnosis and findings',
      },
      label: 'Diagnosis',
    }),
    workPerformed: text({
      ui: {
        displayMode: 'textarea',
        description: 'Detailed description of work completed',
      },
      label: 'Work Performed',
    }),
    recommendations: text({
      ui: {
        displayMode: 'textarea',
        description: 'Recommended future service',
      },
      label: 'Recommendations',
    }),

    // Line Items
    lineItems: relationship({
      ref: 'RepairOrderLineItem.serviceOrder',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['itemType', 'description', 'quantity', 'price'],
        inlineCreate: { fields: ['itemType', 'description', 'quantity', 'unitPrice', 'price'] },
        inlineEdit: { fields: ['itemType', 'description', 'quantity', 'unitPrice', 'price'] },
      },
      label: 'Line Items',
    }),

    // Totals (can be calculated from line items or entered manually)
    laborTotal: float({
      label: 'Labor Total',
      ui: {
        description: 'Total labor charges',
      },
    }),
    partsTotal: float({
      label: 'Parts Total',
      ui: {
        description: 'Total parts charges',
      },
    }),
    subtotal: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item) {
          const laborTotal = item.laborTotal || 0
          const partsTotal = item.partsTotal || 0
          return laborTotal + partsTotal
        },
      }),
      ui: {
        listView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    tax: float({
      label: 'Tax',
    }),
    grandTotal: float({
      label: 'Grand Total',
      ui: {
        description: 'Total amount including labor, parts, and tax',
      },
    }),

    // Status
    status: select({
      type: 'string',
      options: [
        { label: 'Estimate', value: 'estimate' },
        { label: 'Approved', value: 'approved' },
        { label: 'In Progress', value: 'in-progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Invoiced', value: 'invoiced' },
        { label: 'Paid', value: 'paid' },
      ],
      defaultValue: 'estimate',
      label: 'Status',
    }),

    // Timestamps
    completedAt: timestamp({
      label: 'Completed At',
      ui: {
        description: 'When the service was completed',
      },
    }),
  },
})
