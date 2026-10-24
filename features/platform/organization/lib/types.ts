export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'
export type RecordStatus = 'active' | 'suspended' | 'archived'
export type ScopeType = 'dealer-group' | 'rooftop'

export type Viewer = {
  id: string
  roleId: string | null
  canManageDealerships: boolean
  canManageRoles: boolean
  canManagePeople: boolean
}

export type DealerGroup = {
  id: string
  name: string
  slug: string
  legalName: string | null
  status: RecordStatus
  createdAt: string | null
  updatedAt: string | null
  rooftopsCount: number | null
  membershipsCount: number | null
}

export type Rooftop = {
  id: string
  code: string
  name: string
  publicSlug: string
  status: RecordStatus
  timezone: string
  currencyCode: string
  createdAt: string | null
  membershipsCount: number | null
  dealerGroup: { id: string; name: string } | null
}

export type PersonRef = { id: string; name: string | null; email?: string | null }

export type Membership = {
  id: string
  scopeType: ScopeType
  scopeId: string
  scopeName: string
  dealerGroupId: string | null
  status: MembershipStatus
  accessAllRooftops: boolean
  joinedAt: string | null
  updatedAt: string
  user: PersonRef | null
  role: { id: string; name: string } | null
  invitedBy: PersonRef | null
}

export type MembershipSnapshot = { id?: string; status?: string; accessAllRooftops?: boolean; roleId?: string | null } | null

export type MembershipAuditEvent = {
  id: string
  scopeType: ScopeType
  action: 'created' | 'updated' | 'onboarding-bootstrap'
  reason: string
  occurredAt: string
  previousSnapshot: MembershipSnapshot
  nextSnapshot: MembershipSnapshot
  dealerGroup: { id: string; name: string } | null
  rooftop: { id: string; name: string; code: string } | null
  targetUser: PersonRef | null
  actor: PersonRef | null
}

export type Role = {
  id: string
  name: string
  assignedToCount: number | null
  dealerGroupMembershipsCount: number | null
  rooftopMembershipsCount: number | null
} & Record<string, unknown>

export type RetentionPolicy = {
  id: string
  category: string
  retentionDays: number
  legalHold: boolean
  rationale: string
  lastSweptAt: string | null
  updatedAt: string
  rooftop: { id: string; name: string; code: string } | null
}

export type StaffOption = { id: string; name: string; email: string; role: { id: string; name: string } | null }

export type OrganizationData = {
  viewer: Viewer | null
  dealerGroups: DealerGroup[]
  rooftops: Rooftop[]
  memberships: Membership[]
  auditEvents: MembershipAuditEvent[]
  roles: Role[]
  retentionPolicies: RetentionPolicy[]
  staff: StaffOption[]
  errors: Partial<Record<'organization' | 'access' | 'audit' | 'roles' | 'retention' | 'staff', string>>
}

export const ORGANIZATION_TABS = ['group', 'rooftops', 'access', 'roles', 'retention'] as const
export type OrganizationTab = (typeof ORGANIZATION_TABS)[number]
