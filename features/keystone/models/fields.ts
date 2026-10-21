import { checkbox } from "@keystone-6/core/fields"

export const permissionFields = {
  canAccessDashboard: checkbox({
    defaultValue: false,
    label: "User can access the dashboard"
  }),
  canSeeOtherPeople: checkbox({
    defaultValue: false,
    label: "User can see other people"
  }),
  canEditOtherPeople: checkbox({
    defaultValue: false,
    label: "User can edit other people"
  }),
  canManagePeople: checkbox({
    defaultValue: false,
    label: "User can create, update and delete people"
  }),
  canReadUsers: checkbox({
    defaultValue: false,
    label: "User can read other users"
  }),
  canManageUsers: checkbox({
    defaultValue: false,
    label: "User can update and delete other users"
  }),
  canReadRoles: checkbox({
    defaultValue: false,
    label: "User can read other roles"
  }),
  canManageRoles: checkbox({
    defaultValue: false,
    label: "User can CRUD roles"
  }),
  canManageSettings: checkbox({
    defaultValue: false,
    label: "User can manage dealership settings"
  }),
  canManageOnboarding: checkbox({
    defaultValue: false,
    label: "User can access onboarding and store configuration"
  }),
  canManageDealerships: checkbox({
    defaultValue: false,
    label: "User can manage dealer groups, rooftops and staff memberships"
  }),
  canViewInventory: checkbox({
    defaultValue: false,
    label: "User can view vehicle inventory"
  }),
  canManageInventory: checkbox({
    defaultValue: false,
    label: "User can add, edit and delete vehicles in inventory"
  }),
  canManageLeads: checkbox({
    defaultValue: false,
    label: "User can create, edit and assign leads"
  }),
  canViewAllLeads: checkbox({
    defaultValue: false,
    label: "User can view leads assigned to others"
  }),
  canManageDeals: checkbox({
    defaultValue: false,
    label: "User can create, edit and close deals"
  }),
  canApproveDeals: checkbox({
    defaultValue: false,
    label: "User can approve deals"
  }),
  canManageTradeIns: checkbox({
    defaultValue: false,
    label: "User can appraise and manage trade-ins"
  }),
  canManageFinancing: checkbox({
    defaultValue: false,
    label: "User can manage financing applications and products"
  }),
  canManageService: checkbox({
    defaultValue: false,
    label: "User can manage service appointments, orders and parts"
  }),
  canViewReports: checkbox({
    defaultValue: false,
    label: "User can view sales, inventory and accounting reports"
  }),
  canReadPayments: checkbox({
    defaultValue: false,
    label: "User can read payments"
  }),
  canManagePayments: checkbox({
    defaultValue: false,
    label: "User can see and manage payments"
  }),
  canManageKeys: checkbox({
    defaultValue: false,
    label: "User can see and manage API Keys"
  }),
}

export const permissionsList = Object.keys(permissionFields) as Array<keyof typeof permissionFields>
