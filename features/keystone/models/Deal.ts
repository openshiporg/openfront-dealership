import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, float, integer, timestamp, json, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { isSignedIn } from '../access'

export const Deal = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['lead', 'vehicle', 'salesperson', 'vehiclePrice', 'status', 'saleDate'],
    },
  },
  fields: {
    // Core Relationships
    lead: relationship({
      ref: 'Lead.deals',
      ui: {
        displayMode: 'select',
      },
      label: 'Lead',
    }),
    vehicle: relationship({
      ref: 'Vehicle.deals',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),
    salesperson: relationship({
      ref: 'User.deals',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Salesperson',
    }),

    // Pricing
    vehiclePrice: float({
      label: 'Negotiated Price',
      ui: {
        description: 'Final negotiated vehicle price',
      },
    }),
    tradeInValue: float({
      label: 'Trade-In Value',
      ui: {
        description: 'Value credited for trade-in vehicle',
      },
    }),
    tradeInVehicle: relationship({
      ref: 'TradeIn.deal',
      ui: {
        displayMode: 'select',
      },
      label: 'Trade-In Vehicle',
    }),
    tradeInDetails: json({
      defaultValue: {},
      label: 'Trade-In Details',
      ui: {
        description: 'Additional trade-in vehicle details (year, make, model, VIN)',
      },
    }),

    // Financing
    downPayment: float({
      label: 'Down Payment',
    }),
    financingAmount: float({
      label: 'Financing Amount',
      ui: {
        description: 'Total amount being financed',
      },
    }),
    monthlyPayment: float({
      label: 'Monthly Payment',
    }),
    loanTerm: integer({
      label: 'Loan Term (Months)',
      ui: {
        description: 'Number of months for loan',
      },
    }),
    apr: float({
      label: 'APR (%)',
      ui: {
        description: 'Annual Percentage Rate',
      },
    }),

    // Status
    status: select({
      type: 'string',
      options: [
        { label: 'Pencil (Draft)', value: 'pencil' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Financed', value: 'financed' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pencil',
      label: 'Status',
    }),

    // Taxes and Fees
    taxAmount: float({
      label: 'Tax Amount',
      ui: {
        description: 'Sales tax on the vehicle',
      },
    }),
    fees: json({
      defaultValue: [],
      label: 'Fees',
      ui: {
        description: 'JSON array of fees [{name, amount, description}]',
      },
    }),

    // Approvals
    approvals: relationship({
      ref: 'DealApproval.deal',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['approver', 'decision', 'approvalDate', 'notes'],
        inlineCreate: { fields: ['approver', 'decision', 'notes'] },
      },
      label: 'Approvals',
    }),

    // Timestamps
    saleDate: timestamp({
      label: 'Sale Date',
      ui: {
        description: 'Date the sale was completed',
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Created At',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      label: 'Updated At',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),

    // Virtual Fields for Calculations
    totalPrice: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item) {
          const vehiclePrice = item.vehiclePrice || 0
          const tradeInValue = item.tradeInValue || 0
          const taxAmount = item.taxAmount || 0

          // Calculate fees total
          let feesTotal = 0
          if (item.fees && Array.isArray(item.fees)) {
            feesTotal = item.fees.reduce((sum: number, fee: any) => sum + (fee.amount || 0), 0)
          }

          return vehiclePrice - tradeInValue + taxAmount + feesTotal
        },
      }),
      ui: {
        listView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    profit: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item, args, context) {
          // Get vehicle purchase price
          if (!item.vehicleId) return null

          const vehicle = await context.query.Vehicle.findOne({
            where: { id: item.vehicleId },
            query: 'purchasePrice',
          })

          if (!vehicle?.purchasePrice) return null

          const vehiclePrice = item.vehiclePrice || 0
          const purchasePrice = vehicle.purchasePrice || 0

          return vehiclePrice - purchasePrice
        },
      }),
      ui: {
        listView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
})
