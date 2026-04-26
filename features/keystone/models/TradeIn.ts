import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { relationship, text, select, float, integer, image } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const TradeIn = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true, // Allow public trade-in submissions from storefront
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['vin', 'year', 'make', 'model', 'condition', 'offerAmount'],
    },
    labelField: 'vin',
  },
  fields: {
    // Vehicle Identification
    vin: text({
      label: 'VIN',
      ui: {
        description: 'Vehicle Identification Number',
      },
    }),

    // Vehicle Details
    year: text({
      label: 'Year',
    }),
    make: text({
      label: 'Make',
      ui: {
        description: 'Vehicle manufacturer (e.g., Toyota)',
      },
    }),
    model: text({
      label: 'Model',
      ui: {
        description: 'Vehicle model (e.g., Camry)',
      },
    }),
    trim: text({
      label: 'Trim',
    }),
    mileage: integer({
      label: 'Mileage',
      ui: {
        description: 'Current odometer reading',
      },
    }),

    // Condition Assessment
    condition: select({
      type: 'string',
      options: [
        { label: 'Excellent', value: 'excellent' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'Poor', value: 'poor' },
      ],
      label: 'Overall Condition',
    }),
    exteriorCondition: text({
      ui: {
        displayMode: 'textarea',
        description: 'Notes on exterior condition, damage, paint, etc.',
      },
      label: 'Exterior Condition Notes',
    }),
    interiorCondition: text({
      ui: {
        displayMode: 'textarea',
        description: 'Notes on interior condition, wear, cleanliness, etc.',
      },
      label: 'Interior Condition Notes',
    }),
    mechanicalIssues: text({
      ui: {
        displayMode: 'textarea',
        description: 'Known mechanical issues or concerns',
      },
      label: 'Mechanical Issues',
    }),

    // Valuation
    kbbValue: float({
      label: 'KBB Value',
      ui: {
        description: 'Kelley Blue Book estimated value',
      },
    }),
    offerAmount: float({
      label: 'Offer Amount',
      ui: {
        description: 'Actual trade-in offer from dealership',
      },
    }),

    // Images
    mainPhoto: image({
      storage: 'my_images',
      label: 'Main Photo',
    }),

    // Relationships
    deal: relationship({
      ref: 'Deal.tradeInVehicle',
      ui: {
        displayMode: 'select',
      },
      label: 'Deal',
    }),
    appraisedBy: relationship({
      ref: 'User',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Appraised By',
    }),
  },
})
