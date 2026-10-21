import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, float, integer, timestamp, json, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions, rules } from '../access'
import { isDealEvidenceLocked } from '../lifecycle/dealLifecycle'
import { calculateDealPrice } from '../lifecycle/dealPricing'
import { assertAccessibleRelationship, assertRelationshipUnchanged, connectedId } from '../lifecycle/relationshipGuards'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const Deal = list({
  access: {
    operation: {
      query: permissions.canAccessDeals,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadDeals,
      update: rules.canReadDeals,
      delete: rules.canReadDeals,
    },
    item: { create: () => false },
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ['lead', 'vehicle', 'salesperson', 'vehiclePrice', 'status', 'saleDate'],
    },
  },
  hooks: {
    validate: async (args: any) => {
      const { operation, resolvedData, item, context } = args
      if (operation !== 'delete') {
        await validateRooftopRecord(args, [
          { field: 'lead', listKey: 'Lead' },
          { field: 'vehicle', listKey: 'Vehicle' },
          { field: 'salesperson', listKey: 'User', kind: 'user' },
          { field: 'tradeInVehicle', listKey: 'TradeIn' },
        ])
      }
      if (operation === 'delete') {
        if (item.status !== 'pencil') throw new Error('Only pencil deals can be deleted')
        return
      }

      if (operation === 'create') {
        if (resolvedData.status && resolvedData.status !== 'pencil') {
          throw new Error('Deals must be created as pencil drafts and submitted through transitionDeal')
        }
        const vehicle = await assertAccessibleRelationship(context, 'Vehicle', connectedId(resolvedData.vehicle), 'id status')
        if (vehicle && vehicle.status !== 'available') throw new Error('Deal vehicle must be available')
        const lead = await assertAccessibleRelationship(context, 'Lead', connectedId(resolvedData.lead), 'id assignedSalesperson { id }')
        const salesperson = await assertAccessibleRelationship(context, 'User', connectedId(resolvedData.salesperson))
        const tradeIn = await assertAccessibleRelationship(context, 'TradeIn', connectedId(resolvedData.tradeInVehicle), 'id lead { id } deal { id }')
        if (tradeIn?.deal) throw new Error('Trade-in is already attached to another deal')
        if (lead && tradeIn?.lead && tradeIn.lead.id !== lead.id) {
          throw new Error('Deal and trade-in must belong to the same lead')
        }
        if (lead?.assignedSalesperson && salesperson && lead.assignedSalesperson.id !== salesperson.id) {
          throw new Error('Deal salesperson must match the lead assignment')
        }
        return
      }

      assertRelationshipUnchanged('lead', resolvedData, item.leadId)
      assertRelationshipUnchanged('vehicle', resolvedData, item.vehicleId)
      assertRelationshipUnchanged('salesperson', resolvedData, item.salespersonId)
      assertRelationshipUnchanged('tradeInVehicle', resolvedData, item.tradeInVehicleId)
      if (resolvedData.status !== undefined) {
        throw new Error('Deal status changes must use transitionDeal')
      }
      if (isDealEvidenceLocked(item.status) && Object.keys(resolvedData).length > 0) {
        throw new Error('Submitted, settled, and cancelled deal evidence is immutable')
      }
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),

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
    vehiclePriceCents: integer({ label: 'Negotiated Price (cents)', ui: { description: 'Final negotiated vehicle price in integer USD cents' } }),
    tradeInValueCents: integer({ label: 'Trade-In Value (cents)', ui: { description: 'Trade-in credit in integer USD cents' } }),
    vehiclePrice: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.vehiclePriceCents == null ? null : item.vehiclePriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    tradeInValue: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.tradeInValueCents == null ? null : item.tradeInValueCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
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
    downPaymentCents: integer({ label: 'Planned Down Payment (cents)', ui: { description: 'Deal structure only, stored in integer USD cents; not proof of captured funds' } }),
    financingAmountCents: integer({ label: 'Financing Amount (cents)', ui: { description: 'Amount financed in integer USD cents' } }),
    monthlyPaymentCents: integer({ label: 'Monthly Payment (cents)' }),
    downPayment: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.downPaymentCents == null ? null : item.downPaymentCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    financingAmount: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.financingAmountCents == null ? null : item.financingAmountCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    monthlyPayment: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.monthlyPaymentCents == null ? null : item.monthlyPaymentCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
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
    taxAmountCents: integer({ label: 'Tax Amount (cents)', ui: { description: 'Sales tax in integer USD cents' } }),
    taxAmount: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.taxAmountCents == null ? null : item.taxAmountCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    fees: json({ defaultValue: [], label: 'Typed fee lines' }),
    rebates: json({ defaultValue: [], label: 'Typed rebate lines' }),
    products: json({ defaultValue: [], label: 'Typed product lines' }),
    taxLines: json({ defaultValue: [], label: 'Typed tax lines' }),
    structureType: select({
      type: 'string',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Finance', value: 'finance' },
        { label: 'Lease', value: 'lease' },
      ],
      defaultValue: 'cash',
      validation: { isRequired: true },
    }),
    residualValueCents: integer({ label: 'Lease residual (cents)' }),
    moneyFactorBasisPoints: integer({ label: 'Lease money factor (basis points)' }),
    worksheetVersion: integer({ defaultValue: 0, validation: { isRequired: true } }),
    grossCents: integer({ access: { create: () => false, update: () => false }, label: 'Front gross estimate excluding fees, product margin and recon (cents)' }),
    presentedSnapshot: json({ access: { create: () => false, update: () => false }, defaultValue: {} }),
    presentedAt: timestamp({ access: { create: () => false, update: () => false } }),
    acceptedSnapshot: json({ access: { create: () => false, update: () => false }, defaultValue: {} }),
    acceptedAt: timestamp({ access: { create: () => false, update: () => false } }),

    // Approvals
    selectedLenderDecision: relationship({
      ref: 'LenderDecision.selectedForDeals',
      access: { read: permissions.canManageFinancing, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' } },
      label: 'Selected lender offer',
    }),
    deliveryCases: relationship({ ref: 'DeliveryCase.deal', many: true }),
    financeProductQuotes: relationship({ ref: 'FinanceProductQuote.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeProductCancellations: relationship({ ref: 'FinanceProductCancellation.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeMenuVersions: relationship({ ref: 'FinanceMenuVersion.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeComplianceChecks: relationship({ ref: 'FinanceComplianceCheck.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeContractPackages: relationship({ ref: 'FinanceContractPackage.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeFundingCases: relationship({ ref: 'FinanceFundingCase.deal', many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    paymentTransactions: relationship({ ref: 'PaymentTransaction.deal', many: true, access: { read: permissions.canViewReports, create: () => false, update: () => false } }),
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
    lockedAt: timestamp({
      label: 'Evidence Locked At',
      ui: { itemView: { fieldMode: 'read' } },
    }),
    evidenceSnapshot: json({
      access: { create: () => false, update: () => false },
      defaultValue: {},
      label: 'Immutable Deal Evidence',
      ui: { itemView: { fieldMode: 'read' } },
    }),

    // Virtual Fields for Calculations
    totalPrice: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item) {
          return calculateDealPrice(item as any).totalPriceCents / 100
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
          const deal = item as any
          const keystone = context as any

          // Get vehicle purchase price
          if (!deal.vehicleId) return null

          const vehicle = await keystone.query.Vehicle.findOne({
            where: { id: deal.vehicleId },
            query: 'purchasePriceCents',
          })

          if (vehicle?.purchasePriceCents == null) return null

          return (calculateDealPrice(deal).vehiclePriceCents - calculateDealPrice(deal).rebatesCents - Number(vehicle.purchasePriceCents)) / 100
        },
      }),
      ui: {
        listView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
})
