import { list } from '@keystone-6/core'
import { relationship, text, select, integer, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const CustomerInteraction = list({
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
      initialColumns: ['lead', 'interactionType', 'date', 'outcome', 'followUpDate'],
    },
  },
  fields: {
    // Lead relationship
    lead: relationship({
      ref: 'Lead.interactions',
      ui: {
        displayMode: 'select',
      },
      label: 'Lead',
    }),

    // Interaction Details
    interactionType: select({
      type: 'string',
      options: [
        { label: 'Phone Call', value: 'phone' },
        { label: 'Email', value: 'email' },
        { label: 'In-Person Visit', value: 'visit' },
        { label: 'Test Drive', value: 'test-drive' },
        { label: 'Text Message', value: 'sms' },
        { label: 'Video Call', value: 'video' },
      ],
      validation: { isRequired: true },
      label: 'Interaction Type',
    }),
    date: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: 'now' },
      label: 'Date',
    }),
    duration: integer({
      label: 'Duration (Minutes)',
      ui: {
        description: 'How long the interaction lasted',
      },
    }),

    // Content
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Detailed notes about the interaction',
      },
      label: 'Notes',
    }),

    // Outcome
    outcome: select({
      type: 'string',
      options: [
        { label: 'Positive', value: 'positive' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Negative', value: 'negative' },
        { label: 'No Answer', value: 'no-answer' },
        { label: 'Left Voicemail', value: 'voicemail' },
      ],
      label: 'Outcome',
    }),

    // Follow-up
    followUpDate: timestamp({
      label: 'Follow-Up Date',
      ui: {
        description: 'When to follow up next',
      },
    }),
    followUpCompleted: timestamp({
      label: 'Follow-Up Completed',
      ui: {
        description: 'When the follow-up was actually completed',
      },
    }),

    // User who performed interaction
    performedBy: relationship({
      ref: 'User.interactions',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Performed By',
    }),
  },
})
