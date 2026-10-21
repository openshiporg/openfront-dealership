import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { relationship, text, select, integer, checkbox, image, json, timestamp, virtual } from '@keystone-6/core/fields'
import { graphql } from '@graphql-ts/schema'

import { permissions, rules } from '../access'
import { domainEventRequestHash, recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const Vehicle = list({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadVehicles,
      update: ({ session }) => rules.canReadVehicles({ session }),
      delete: ({ session }) => rules.canReadVehicles({ session }),
    },
  },
  hooks: {
    resolveInput: ({ resolvedData }: any) => {
      const normalized = { ...resolvedData }
      if (typeof normalized.vin === 'string') normalized.vin = normalized.vin.trim().toUpperCase()
      if (typeof normalized.stockNumber === 'string') normalized.stockNumber = normalized.stockNumber.trim().toUpperCase()
      for (const field of ['make', 'model', 'trim', 'exteriorColor', 'interiorColor']) {
        if (typeof normalized[field] === 'string') normalized[field] = normalized[field].trim()
      }
      return normalized
    },
    validate: (args: any) => args.operation === 'delete' ? undefined : validateRooftopRecord(args),
    beforeOperation: async ({ operation, resolvedData, item, context }: any) => {
      const rooftopId = operation === 'create'
        ? resolvedData.rooftop?.connect?.id
        : item?.rooftopId
      if (operation !== 'delete') {
        const rooftop = rooftopId
          ? await context.sudo().prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { status: true } })
          : null
        if (!rooftop || rooftop.status !== 'active') throw new Error('Vehicle rooftop must remain active')
        return
      }
      const [deals, leads, testDrives, financing, acquisitions, inventoryStocks] = await Promise.all([
        context.sudo().prisma.deal.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.lead.count({ where: { interestedVehicleId: item.id } }),
        context.sudo().prisma.testDrive.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.financingApplication.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.inventoryAcquisition.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.inventoryStock.count({ where: { vehicleId: item.id } }),
      ])
      if (deals + leads + testDrives + financing + acquisitions + inventoryStocks > 0) {
        throw new Error('Referenced vehicle records cannot be deleted')
      }
    },
    afterOperation: async ({ operation, item, originalItem, context }: any) => {
      const record = item ?? originalItem
      const occurredAt = new Date()
      const snapshot = record ? {
        id: record.id,
        rooftopId: record.rooftopId,
        vin: record.vin,
        stockNumber: record.stockNumber,
        status: record.status,
        priceCents: record.priceCents,
      } : null
      const beforeSnapshot = operation === 'create' ? null : originalItem ? {
        id: originalItem.id,
        rooftopId: originalItem.rooftopId,
        vin: originalItem.vin,
        stockNumber: originalItem.stockNumber,
        status: originalItem.status,
        priceCents: originalItem.priceCents,
      } : null
      const versionFingerprint = domainEventRequestHash({ operation, beforeSnapshot, snapshot }).slice(0, 16)
      await recordDomainEventInTransaction(context, {
        eventKey: `hook:vehicle:${record.id}:${operation}:${record.updatedAt?.toISOString?.() ?? occurredAt.toISOString()}:${versionFingerprint}`,
        rooftopId: record.rooftopId,
        aggregateType: 'Vehicle',
        aggregateId: record.id,
        action: operation,
        topic: `vehicle.${operation}d`,
        actorId: context.session?.itemId ?? null,
        beforeSnapshot,
        afterSnapshot: operation === 'delete' ? null : snapshot,
        metadata: { source: 'keystone-hook' },
        occurredAt,
      })
    },
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ['vin', 'year', 'make', 'model', 'status', 'price'],
    },
    labelField: 'vin',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),

    // Vehicle Identification
    vin: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: 'VIN',
      ui: {
        description: 'Vehicle Identification Number (17 characters)',
      },
    }),
    stockNumber: text({
      isIndexed: 'unique',
      label: 'Stock Number',
      ui: {
        description: 'Internal stock number for inventory tracking',
      },
    }),

    // Vehicle Details
    year: integer({
      validation: { isRequired: true },
      label: 'Year',
    }),
    make: text({
      validation: { isRequired: true },
      label: 'Make',
      ui: {
        description: 'Vehicle manufacturer (e.g., Toyota, Honda, Ford)',
      },
    }),
    model: text({
      validation: { isRequired: true },
      label: 'Model',
      ui: {
        description: 'Vehicle model name (e.g., Camry, Civic, F-150)',
      },
    }),
    trim: text({
      label: 'Trim',
      ui: {
        description: 'Trim level (e.g., LX, EX, Sport)',
      },
    }),
    exteriorColor: text({
      label: 'Exterior Color',
      ui: {
        description: 'Exterior paint color',
      },
    }),
    interiorColor: text({
      label: 'Interior Color',
      ui: {
        description: 'Interior upholstery color',
      },
    }),
    mileage: integer({
      label: 'Mileage',
      ui: {
        description: 'Current odometer reading',
      },
    }),

    // Pricing
    purchasePriceCents: integer({
      access: { read: permissions.canViewDealerCost },
      isFilterable: permissions.canViewDealerCost,
      isOrderable: permissions.canViewDealerCost,
      label: 'Purchase Price (cents)',
      ui: { description: 'Dealer acquisition cost in integer USD cents' },
    }),
    listPriceCents: integer({
      label: 'List Price (cents)',
      ui: { description: 'Current listing price in integer USD cents' },
    }),
    priceCents: integer({
      label: 'Price (cents)',
      ui: { description: 'Compatibility listing price in integer USD cents' },
    }),
    purchasePrice: virtual({
      access: { read: permissions.canViewDealerCost },
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.purchasePriceCents == null ? null : item.purchasePriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    listPrice: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.listPriceCents == null ? null : item.listPriceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),
    price: virtual({
      field: graphql.field({ type: graphql.Float, resolve(item: any) { return item.priceCents == null ? null : item.priceCents / 100 } }),
      ui: { itemView: { fieldMode: 'read' } },
    }),

    // Condition and Status
    condition: select({
      type: 'string',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Used', value: 'used' },
        { label: 'Certified', value: 'certified' },
      ],
      label: 'Condition',
      ui: {
        description: 'Vehicle condition category',
      },
    }),
    status: select({
      access: { update: () => false },
      type: 'string',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Pending', value: 'pending' },
        { label: 'Sold', value: 'sold' },
        { label: 'Service', value: 'service' },
      ],
      defaultValue: 'available',
      label: 'Status',
      ui: {
        description: 'Current availability status',
      },
    }),

    // Features and Description
    description: text({
      ui: {
        displayMode: 'textarea',
        description: 'Marketing description for listings',
      },
      label: 'Description',
    }),
    features: json({
      defaultValue: [],
      label: 'Features',
      ui: {
        description: 'JSON array of vehicle features and options',
      },
    }),
    metadata: json({
      access: { read: permissions.canViewDealerCost },
      defaultValue: {},
      label: 'Metadata',
      ui: {
        description: 'Additional vehicle specifications and data (engine, transmission, etc.)',
      },
    }),

    // Images
    images: relationship({
      ref: 'VehicleImage.vehicle',
      many: true,
      access: { update: denyAll },
      ui: {
        displayMode: 'cards',
        cardFields: ['image', 'imagePath', 'caption', 'isPrimary', 'sortOrder'],
      },
      label: 'Gallery Images',
    }),

    // Relationships
    deals: relationship({
      access: { read: permissions.canAccessDeals, update: denyAll },
      isFilterable: permissions.canAccessDeals,
      ref: 'Deal.vehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Deals',
    }),
    leads: relationship({
      access: { read: permissions.canAccessLeads, update: denyAll },
      isFilterable: permissions.canAccessLeads,
      ref: 'Lead.interestedVehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Interested Leads',
    }),
    testDrives: relationship({
      access: { read: permissions.canAccessLeads, update: denyAll },
      isFilterable: permissions.canAccessLeads,
      ref: 'TestDrive.vehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Test Drives',
    }),
    conditionReports: relationship({
      access: { read: permissions.canViewInventory, update: denyAll },
      isFilterable: permissions.canViewInventory,
      ref: 'VehicleConditionReport.vehicle',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['reportDate', 'overallCondition', 'inspector'],
      },
      label: 'Condition Reports',
    }),
    history: relationship({
      access: { read: permissions.canViewInventory, update: denyAll },
      isFilterable: permissions.canViewInventory,
      ref: 'VehicleHistory.vehicle',
      ui: {
        displayMode: 'cards',
        cardFields: ['acquisitionDate', 'previousOwners', 'hasAccidents'],
      },
      label: 'Vehicle History',
    }),
    priceHistory: relationship({
      access: { read: permissions.canViewDealerCost, update: denyAll },
      isFilterable: permissions.canViewDealerCost,
      ref: 'PriceHistory.vehicle',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['effectiveDate', 'previousPrice', 'newPrice', 'changeReason'],
      },
      label: 'Price History',
    }),
    inventoryStock: relationship({
      ref: 'InventoryStock.vehicle',
      access: { read: permissions.canViewInventory, update: () => false },
      ui: { itemView: { fieldMode: 'read' } },
      label: 'Inventory Operations Record',
    }),
    acquisition: relationship({
      ref: 'InventoryAcquisition.vehicle',
      access: { read: permissions.canManageInventory, update: () => false },
      ui: { itemView: { fieldMode: 'read' } },
      label: 'Inventory Acquisition',
    }),
    salesVisits: relationship({
      ref: 'SalesVisit.vehicle',
      many: true,
      access: { update: () => false },
      ui: { displayMode: 'count' },
      label: 'Sales visits',
    }),
    financingApplications: relationship({
      access: { read: permissions.canManageFinancing, update: denyAll },
      isFilterable: permissions.canManageFinancing,
      ref: 'FinancingApplication.vehicle',
      many: true,
      ui: { displayMode: 'count' },
      label: 'Restricted Financing Applications',
    }),

  },
})
