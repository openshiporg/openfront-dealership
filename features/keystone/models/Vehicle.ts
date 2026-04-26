import { list } from '@keystone-6/core'
import { relationship, text, select, integer, float, checkbox, image, json, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const Vehicle = list({
  access: {
    operation: {
      query: () => true, // Allow public access to browse inventory
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['vin', 'year', 'make', 'model', 'status', 'price'],
    },
    labelField: 'vin',
  },
  fields: {
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
    purchasePrice: float({
      label: 'Purchase Price',
      ui: {
        description: 'Cost to acquire vehicle (dealer cost)',
      },
    }),
    listPrice: float({
      label: 'List Price',
      ui: {
        description: 'Current listing price (sale price)',
      },
    }),
    price: float({
      label: 'Price',
      ui: {
        description: 'Alias for listPrice - for backward compatibility',
      },
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
      ui: {
        displayMode: 'cards',
        cardFields: ['image', 'caption', 'isPrimary', 'sortOrder'],
        inlineCreate: { fields: ['image', 'caption', 'isPrimary', 'sortOrder'] },
        inlineEdit: { fields: ['image', 'caption', 'isPrimary', 'sortOrder'] },
      },
      label: 'Gallery Images',
    }),

    // Relationships
    deals: relationship({
      ref: 'Deal.vehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Deals',
    }),
    leads: relationship({
      ref: 'Lead.interestedVehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Interested Leads',
    }),
    testDrives: relationship({
      ref: 'TestDrive.vehicle',
      many: true,
      ui: {
        displayMode: 'count',
      },
      label: 'Test Drives',
    }),
    conditionReports: relationship({
      ref: 'VehicleConditionReport.vehicle',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['reportDate', 'overallCondition', 'inspector'],
        inlineCreate: { fields: ['reportDate', 'inspector', 'overallCondition'] },
      },
      label: 'Condition Reports',
    }),
    history: relationship({
      ref: 'VehicleHistory.vehicle',
      ui: {
        displayMode: 'cards',
        cardFields: ['acquisitionDate', 'previousOwners', 'hasAccidents'],
      },
      label: 'Vehicle History',
    }),
    priceHistory: relationship({
      ref: 'PriceHistory.vehicle',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['effectiveDate', 'previousPrice', 'newPrice', 'changeReason'],
      },
      label: 'Price History',
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Created At',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
})
