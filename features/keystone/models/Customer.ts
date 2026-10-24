import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { checkbox, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const Customer = list({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadCustomers,
      update: rules.canReadCustomers,
      delete: rules.canReadCustomers,
    },
  },
  ui: {
    hideCreate: true,
    listView: { initialColumns: ['firstName', 'lastName', 'primaryEmail', 'primaryPhone', 'status', 'updatedAt'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    firstName: text({ validation: { isRequired: true } }),
    lastName: text({ validation: { isRequired: true } }),
    primaryEmail: text(),
    primaryPhone: text(),
    normalizedEmail: text({ access: { create: denyAll, update: denyAll }, isIndexed: true }),
    normalizedPhone: text({ access: { create: denyAll, update: denyAll }, isIndexed: true }),
    identityKey: text({ access: { read: denyAll, create: denyAll, update: denyAll }, isIndexed: 'unique', validation: { isRequired: true } }),
    status: select({
      access: { create: denyAll, update: denyAll },
      type: 'string',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Merged', value: 'merged' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
    }),
    emailConsent: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    smsConsent: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    phoneConsent: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    emailSuppressed: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    smsSuppressed: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    phoneSuppressed: checkbox({ access: { create: denyAll, update: denyAll }, defaultValue: false }),
    preferredChannel: select({
      access: { create: denyAll, update: denyAll },
      type: 'string',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'SMS', value: 'sms' },
        { label: 'Phone', value: 'phone' },
        { label: 'No outbound contact', value: 'none' },
      ],
      defaultValue: 'none',
      validation: { isRequired: true },
    }),
    contactPreferenceUpdatedAt: timestamp({ access: { create: denyAll, update: denyAll } }),
    suppressionReason: text({ access: { create: denyAll, update: denyAll } }),
    suppressionSource: text({ access: { create: denyAll, update: denyAll } }),
    // The storefront login that proved ownership of primaryEmail. Written only by
    // confirmCustomerEmailVerification (customerEmailVerification.ts); never from submitted data.
    account: relationship({ ref: 'User', access: { create: denyAll, update: denyAll } }),
    household: relationship({ ref: 'CustomerHousehold.members', access: { create: denyAll, update: denyAll } }),
    contactPreferenceEvents: relationship({ ref: 'CustomerContactPreferenceEvent.customer', many: true, access: { update: denyAll } }),
    salesVisits: relationship({ ref: 'SalesVisit.customer', many: true, access: { update: denyAll } }),
    mergedAt: timestamp({ access: { create: denyAll, update: denyAll } }),
    mergedInto: relationship({ ref: 'Customer.mergedCustomers', access: { create: denyAll, update: denyAll } }),
    mergedCustomers: relationship({ ref: 'Customer.mergedInto', many: true, access: { update: denyAll } }),
    leads: relationship({ ref: 'Lead.customer', many: true, access: { update: denyAll } }),
    mergeEventsAsSurvivor: relationship({ ref: 'CustomerMergeEvent.survivor', many: true, access: { update: denyAll } }),
    mergeEventsAsDuplicate: relationship({ ref: 'CustomerMergeEvent.duplicate', many: true, access: { update: denyAll } }),
  },
})
