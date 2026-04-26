import { list } from '@keystone-6/core'
import { relationship, image, checkbox, integer, text, select } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const VehicleImage = list({
  access: {
    operation: {
      query: () => true, // Allow public access to view vehicle images
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['vehicle', 'caption', 'isPrimary', 'sortOrder'],
    },
    labelField: 'caption',
  },
  fields: {
    // Vehicle relationship
    vehicle: relationship({
      ref: 'Vehicle.images',
      ui: {
        displayMode: 'select',
        labelField: 'vin',
      },
      label: 'Vehicle',
    }),

    // Image
    image: image({
      storage: 'my_images',
      label: 'Image',
    }),

    // Caption
    caption: text({
      label: 'Caption',
      ui: {
        description: 'Description or caption for this image',
      },
    }),

    // Category
    category: select({
      type: 'string',
      options: [
        { label: 'Exterior', value: 'exterior' },
        { label: 'Interior', value: 'interior' },
        { label: 'Engine', value: 'engine' },
        { label: 'Damage', value: 'damage' },
      ],
      defaultValue: 'exterior',
      label: 'Category',
      ui: {
        description: 'Type of image',
      },
    }),

    // Sort order
    sortOrder: integer({
      defaultValue: 0,
      label: 'Sort Order',
      ui: {
        description: 'Order in which images appear in gallery (lower = first)',
      },
    }),

    // Primary image flag
    isPrimary: checkbox({
      defaultValue: false,
      label: 'Primary Image',
      ui: {
        description: 'Set as the main display image for this vehicle',
      },
    }),
  },
})
