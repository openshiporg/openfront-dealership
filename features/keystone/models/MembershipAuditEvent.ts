import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'

export const MembershipAuditEvent = list({
  access: {
    operation: {
      query: permissions.canManageDealerships,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['occurredAt', 'scopeType', 'action', 'targetUser', 'actor', 'reason'] },
  },
  fields: {
    ...trackingFields,
    scopeType: select({
      type: 'string',
      options: [
        { label: 'Dealer Group', value: 'dealer-group' },
        { label: 'Rooftop', value: 'rooftop' },
      ],
      validation: { isRequired: true },
    }),
    action: select({
      type: 'string',
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Updated', value: 'updated' },
        { label: 'Onboarding Bootstrap', value: 'onboarding-bootstrap' },
      ],
      validation: { isRequired: true },
    }),
    dealerGroup: relationship({ ref: 'DealerGroup.membershipAuditEvents' }),
    rooftop: relationship({ ref: 'Rooftop.membershipAuditEvents' }),
    targetUser: relationship({ ref: 'User.membershipAuditEvents' }),
    actor: relationship({ ref: 'User.performedMembershipAuditEvents' }),
    membershipId: text({ validation: { isRequired: true } }),
    previousSnapshot: json({ defaultValue: null }),
    nextSnapshot: json({ defaultValue: {} }),
    reason: text({ validation: { isRequired: true, length: { min: 1, max: 500 } } }),
    occurredAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
  },
})
