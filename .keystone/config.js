"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key5 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key5) && key5 !== except)
        __defProp(to, key5, { get: () => from[key5], enumerable: !(desc = __getOwnPropDesc(from, key5)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core70 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access2 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");

// features/keystone/tenantRecords.ts
var import_access = require("@keystone-6/core/access");
var import_fields = require("@keystone-6/core/fields");

// features/keystone/lifecycle/relationshipGuards.ts
function connectedId(value) {
  if (value === void 0) return void 0;
  if (value === null) return null;
  if (typeof value !== "object") return void 0;
  const relation = value;
  if (relation.disconnect === true) return null;
  if (Array.isArray(relation.connect)) {
    const id = relation.connect[0]?.id;
    return id == null ? void 0 : String(id);
  }
  if (relation.connect?.id != null) return String(relation.connect.id);
  if (Array.isArray(relation.set)) {
    const id = relation.set[0]?.id;
    return id == null ? null : String(id);
  }
  return void 0;
}
function assertRelationshipUnchanged(field, resolvedData, currentId) {
  const nextId = connectedId(resolvedData[field]);
  if (nextId === void 0) return;
  const normalizedCurrent = currentId == null ? null : String(currentId);
  if (nextId !== normalizedCurrent) {
    throw new Error(`${field} cannot be moved to another record`);
  }
}
async function assertAccessibleRelationship(context, listKey, id, query = "id") {
  if (!id) return null;
  const item = await context.query[listKey].findOne({ where: { id }, query });
  if (!item) throw new Error(`${listKey} relationship is not accessible`);
  return item;
}

// features/keystone/tenancy.ts
function getConnectedId(value) {
  if (!value || typeof value !== "object") return null;
  const connect = value.connect;
  if (!connect || typeof connect !== "object") return null;
  const id = connect.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
function hasDealerGroupAccess(session, dealerGroupId) {
  if (!session) return false;
  return Boolean(session.data.dealerGroupMemberships?.some(
    (membership) => membership.status === "active" && membership.dealerGroup?.id === dealerGroupId
  ));
}
function hasRooftopAccess(session, dealerGroupId, rooftopId) {
  if (!session) return false;
  const groupWide = session.data.dealerGroupMemberships?.some(
    (membership) => membership.status === "active" && membership.accessAllRooftops && membership.dealerGroup?.id === dealerGroupId
  );
  if (groupWide) return true;
  return Boolean(session.data.rooftopMemberships?.some(
    (membership) => membership.status === "active" && membership.rooftop?.id === rooftopId && membership.rooftop.dealerGroup?.id === dealerGroupId
  ));
}
function hasAnyMembershipPermission(session, permission) {
  if (!session) return false;
  if (session.data.role?.[permission] === true) return true;
  return Boolean(
    session.data.dealerGroupMemberships?.some(
      (membership) => membership.status === "active" && membership.role?.[permission] === true
    ) || session.data.rooftopMemberships?.some(
      (membership) => membership.status === "active" && membership.role?.[permission] === true
    )
  );
}
function hasRooftopPermission(session, dealerGroupId, rooftopId, permissions2) {
  if (!session) return false;
  const required7 = Array.isArray(permissions2) ? permissions2 : [permissions2];
  const roleAllows = (role) => required7.some((permission) => role?.[permission] === true);
  if (roleAllows(session.data.role) && hasRooftopAccess(session, dealerGroupId, rooftopId)) return true;
  const groupWide = session.data.dealerGroupMemberships?.some(
    (membership) => membership.status === "active" && membership.accessAllRooftops && membership.dealerGroup?.id === dealerGroupId && roleAllows(membership.role)
  );
  if (groupWide) return true;
  return Boolean(session.data.rooftopMemberships?.some(
    (membership) => membership.status === "active" && membership.rooftop?.id === rooftopId && membership.rooftop.dealerGroup?.id === dealerGroupId && roleAllows(membership.role)
  ));
}
function rooftopPermissionAccessFilter(session, permissions2) {
  if (!session) return false;
  const required7 = Array.isArray(permissions2) ? permissions2 : [permissions2];
  if (required7.some((permission) => session.data.role?.[permission] === true)) {
    return rooftopAccessFilter(session);
  }
  const roleFilter = {
    OR: required7.map((permission) => ({ [permission]: { equals: true } }))
  };
  return {
    OR: [
      {
        dealerGroup: {
          memberships: {
            some: {
              user: { id: { equals: session.itemId } },
              status: { equals: "active" },
              accessAllRooftops: { equals: true },
              role: roleFilter
            }
          }
        }
      },
      {
        memberships: {
          some: {
            user: { id: { equals: session.itemId } },
            status: { equals: "active" },
            role: roleFilter
          }
        }
      }
    ]
  };
}
function hasPermissionAcrossAllRooftops(session, permissions2) {
  if (!session) return false;
  const required7 = Array.isArray(permissions2) ? permissions2 : [permissions2];
  if (required7.some((permission) => session.data.role?.[permission] === true)) return true;
  const roleAllows = (role) => required7.some((permission) => role?.[permission] === true);
  const groupScopes = (session.data.dealerGroupMemberships || []).filter(
    (membership) => membership.status === "active" && membership.accessAllRooftops
  );
  const rooftopScopes = (session.data.rooftopMemberships || []).filter(
    (membership) => membership.status === "active"
  );
  const scopes = [...groupScopes, ...rooftopScopes];
  return scopes.length > 0 && scopes.every((scope) => roleAllows(scope.role));
}
function dealerGroupAccessFilter(session) {
  if (!session) return false;
  return {
    memberships: {
      some: {
        user: { id: { equals: session.itemId } },
        status: { equals: "active" }
      }
    }
  };
}
function rooftopAccessFilter(session) {
  if (!session) return false;
  return {
    OR: [
      {
        dealerGroup: {
          memberships: {
            some: {
              user: { id: { equals: session.itemId } },
              status: { equals: "active" },
              accessAllRooftops: { equals: true }
            }
          }
        }
      },
      {
        memberships: {
          some: {
            user: { id: { equals: session.itemId } },
            status: { equals: "active" }
          }
        }
      }
    ]
  };
}
function membershipKey(scopeId, userId) {
  if (!scopeId || !userId) throw new Error("Membership scope and user are required");
  return `${scopeId}:${userId}`;
}

// features/keystone/tenantRecords.ts
function rooftopField() {
  return (0, import_fields.relationship)({
    ref: "Rooftop",
    db: {
      extendPrismaSchema: (field) => field.replace(/rooftop Rooftop\?/g, "rooftop Rooftop").replace(/rooftopId String\?/g, "rooftopId String")
    },
    access: { update: import_access.denyAll }
  });
}
function withRooftopScope(filter, session, permissions2) {
  if (filter === false) return false;
  const tenant = permissions2 ? rooftopPermissionAccessFilter(session, permissions2) : rooftopAccessFilter(session);
  if (tenant === false) return false;
  const scoped = { rooftop: tenant };
  return filter === true ? scoped : { AND: [filter, scoped] };
}
function withRooftopPermissionScope(filter, session, permissions2) {
  if (filter === false) return false;
  const rooftopFilter = rooftopPermissionAccessFilter(session, permissions2);
  if (rooftopFilter === false) return false;
  const tenant = { rooftop: rooftopFilter };
  return filter === true ? tenant : { AND: [filter, tenant] };
}
function configuredStorefrontRooftopSlug() {
  const slug = String(process.env.NEXT_PUBLIC_STOREFRONT_ROOFTOP_SLUG || "main").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120 ? slug : null;
}
function assertConfiguredStorefrontRooftopSlug(value) {
  const requested = String(value || "").trim().toLowerCase();
  const configured2 = configuredStorefrontRooftopSlug();
  if (!configured2 || requested !== configured2) throw new Error("The requested dealership location is not served by this storefront");
  return configured2;
}
function publicActiveRooftopScope(filter) {
  const publicSlug = configuredStorefrontRooftopSlug();
  if (!publicSlug) return false;
  return {
    AND: [
      filter,
      {
        rooftop: {
          publicSlug: { equals: publicSlug },
          status: { equals: "active" },
          dealerGroup: { status: { equals: "active" } }
        }
      }
    ]
  };
}
function canCreateRooftopRecord(requiredPermissions) {
  return async ({ session, inputData, context }) => {
    const rooftopId = connectedId(inputData.rooftop);
    if (!session?.itemId || !rooftopId) return false;
    const rooftop = await context.sudo().query.Rooftop.findOne({
      where: { id: rooftopId },
      query: "id status dealerGroup { id status }"
    });
    return Boolean(
      rooftop?.status === "active" && rooftop.dealerGroup?.id && rooftop.dealerGroup.status === "active" && hasRooftopPermission(
        session,
        rooftop.dealerGroup.id,
        rooftop.id,
        requiredPermissions
      )
    );
  };
}
async function assertSessionRooftopPermission(context, rooftopId, permissions2) {
  const session = context.session;
  if (!session?.itemId) throw new Error("Authentication required");
  const rooftop = await context.sudo().query.Rooftop.findOne({
    where: { id: rooftopId },
    query: "id status dealerGroup { id status }"
  });
  if (!rooftop?.dealerGroup?.id || rooftop.status !== "active" || rooftop.dealerGroup.status !== "active" || !hasRooftopPermission(session, rooftop.dealerGroup.id, rooftop.id, permissions2)) {
    throw new Error("Rooftop not found or permission denied");
  }
  return rooftop;
}
async function assertUserRooftopAccess(context, userId, rooftopId) {
  const prisma = context.sudo().prisma;
  const [groupAccess, directAccess] = await Promise.all([
    prisma.dealerGroupMembership.count({
      where: {
        userId,
        status: "active",
        accessAllRooftops: true,
        dealerGroup: { rooftops: { some: { id: rooftopId } } }
      }
    }),
    prisma.rooftopMembership.count({
      where: { userId, status: "active", rooftopId }
    })
  ]);
  if (groupAccess === 0 && directAccess === 0) {
    throw new Error("User relationship must have active access to the same rooftop");
  }
}
async function validateRooftopRecord({ operation, resolvedData, item, context }, relationships = []) {
  const inputRooftopId = connectedId(resolvedData.rooftop);
  const currentRooftopId = item?.rooftopId == null ? null : String(item.rooftopId);
  if (operation === "create" && !inputRooftopId) throw new Error("Rooftop is required");
  if (operation === "update" && inputRooftopId !== void 0 && inputRooftopId !== currentRooftopId) {
    throw new Error("Rooftop cannot be moved to another record");
  }
  const rooftopId = operation === "create" ? inputRooftopId : currentRooftopId;
  if (!rooftopId) throw new Error("Rooftop is required");
  const rooftop = await context.sudo().query.Rooftop.findOne({ where: { id: rooftopId }, query: "id status" });
  if (!rooftop) throw new Error("Rooftop does not exist");
  for (const relation of relationships) {
    const relationId = connectedId(resolvedData[relation.field]);
    if (relationId === void 0 || relationId === null) continue;
    if (relation.kind === "user") {
      await assertUserRooftopAccess(context, relationId, rooftopId);
      continue;
    }
    const related = await context.sudo().query[relation.listKey].findOne({
      where: { id: relationId },
      query: "id rooftop { id }"
    });
    if (!related || related.rooftop?.id !== rooftopId) {
      throw new Error(`${relation.field} must belong to the same rooftop`);
    }
  }
}
async function resolvePublicRooftopId(context, publicSlug) {
  const rooftops = await context.sudo().query.Rooftop.findMany({
    where: {
      publicSlug: { equals: publicSlug },
      status: { equals: "active" },
      dealerGroup: { status: { equals: "active" } }
    },
    take: 2,
    query: "id publicSlug dealerGroup { id status }"
  });
  if (rooftops.length !== 1 || !rooftops[0]?.dealerGroup?.id) {
    throw new Error("The requested public dealership location is unavailable");
  }
  return rooftops[0].id;
}

// features/keystone/access.ts
var LEAD_ACCESS_PERMISSIONS = [
  "canManageLeads",
  "canManageDeals",
  "canManageService",
  "canManageFinancing",
  "canManageTradeIns"
];
var TRADE_IN_ACCESS_PERMISSIONS = [
  "canManageTradeIns",
  "canManageDeals",
  "canManageLeads"
];
function hasPermission({ session }, permission) {
  return hasAnyMembershipPermission(session, permission);
}
function isSignedIn({ session }) {
  return Boolean(session);
}
var permissions = {
  // User/Role are shared identity-control-plane records, not rooftop records.
  // A membership capability must never grant global CRUD or role assignment.
  canManageGlobalPeople: ({ session }) => session?.data.role?.canManagePeople === true,
  canManageGlobalRoles: ({ session }) => session?.data.role?.canManageRoles === true,
  canSeeOtherPeople: (args) => hasPermission(args, "canSeeOtherPeople"),
  canEditOtherPeople: (args) => hasPermission(args, "canEditOtherPeople"),
  canManagePeople: (args) => hasPermission(args, "canManagePeople"),
  canManageRoles: (args) => hasPermission(args, "canManageRoles"),
  canAccessDashboard: (args) => hasPermission(args, "canAccessDashboard"),
  canManageOnboarding: (args) => hasPermission(args, "canManageOnboarding"),
  canManageDealerships: (args) => hasPermission(args, "canManageDealerships"),
  canManageInventory: (args) => hasPermission(args, "canManageInventory"),
  canViewInventory: (args) => hasPermission(args, "canViewInventory") || hasPermission(args, "canManageInventory"),
  canManageLeads: (args) => hasPermission(args, "canManageLeads"),
  canViewAllLeads: (args) => hasPermission(args, "canViewAllLeads"),
  canManageDeals: (args) => hasPermission(args, "canManageDeals"),
  canApproveDeals: (args) => hasPermission(args, "canApproveDeals"),
  canManageService: (args) => hasPermission(args, "canManageService"),
  canViewReports: (args) => hasPermission(args, "canViewReports"),
  canManageFinancing: (args) => hasPermission(args, "canManageFinancing"),
  canManageTradeIns: (args) => hasPermission(args, "canManageTradeIns"),
  canAccessDeals: (args) => hasPermission(args, "canManageDeals") || hasPermission(args, "canApproveDeals") || hasPermission(args, "canManageFinancing"),
  canAccessTradeIns: (args) => TRADE_IN_ACCESS_PERMISSIONS.some((permission) => hasPermission(args, permission)),
  canAccessLeads: (args) => LEAD_ACCESS_PERMISSIONS.some((permission) => hasPermission(args, permission)),
  canManageTasks: (args) => hasPermission(args, "canManageLeads") || hasPermission(args, "canManageFinancing") || hasPermission(args, "canManageService"),
  canViewDealerCost: ({ session }) => hasPermissionAcrossAllRooftops(session, ["canManageInventory", "canManageFinancing"])
};
var rules = {
  canReadRooftopRecords: ({ session }) => {
    if (!session) return false;
    return withRooftopScope(true, session);
  },
  canReadLeadOperations: ({ session }) => {
    if (!session || !permissions.canManageLeads({ session })) return false;
    return withRooftopPermissionScope(true, session, "canManageLeads");
  },
  canReadCustomers: ({ session }) => {
    if (!session || !permissions.canAccessLeads({ session })) return false;
    return withRooftopPermissionScope(
      true,
      session,
      ["canManageLeads", "canManageDeals", "canManageService", "canManageFinancing", "canManageTradeIns"]
    );
  },
  canReadRoles: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageGlobalRoles({ session })) return true;
    return {
      OR: [
        { assignedTo: { some: { id: { equals: session.itemId } } } },
        { dealerGroupMemberships: { some: { user: { id: { equals: session.itemId } }, status: { equals: "active" } } } },
        { rooftopMemberships: { some: { user: { id: { equals: session.itemId } }, status: { equals: "active" } } } }
      ]
    };
  },
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople || permissions.canManageGlobalPeople({ session })) return true;
    const self = { id: { equals: session.itemId } };
    if (!permissions.canSeeOtherPeople({ session }) && !permissions.canManagePeople({ session })) return self;
    const scope = rooftopPermissionAccessFilter(session, ["canSeeOtherPeople", "canManagePeople"]);
    if (scope === false) return self;
    return { OR: [
      self,
      { rooftopMemberships: { some: { status: { equals: "active" }, rooftop: scope } } },
      { dealerGroupMemberships: { some: { status: { equals: "active" }, accessAllRooftops: { equals: true }, dealerGroup: { rooftops: { some: scope } } } } }
    ] };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canEditOtherPeople || permissions.canManageGlobalPeople({ session })) return true;
    return { id: { equals: session.itemId } };
  },
  canReadLeads: ({ session }) => {
    if (!session || !permissions.canAccessLeads({ session })) return false;
    const roleFilter = hasPermissionAcrossAllRooftops(session, "canViewAllLeads") ? true : {
      OR: [
        { assignedSalesperson: { id: { equals: session.itemId } } },
        ...hasPermissionAcrossAllRooftops(session, "canManageService") ? [{ serviceAppointments: { some: {} } }] : [],
        ...hasPermissionAcrossAllRooftops(session, "canManageTradeIns") ? [{ tradeIns: { some: {} } }] : []
      ]
    };
    return withRooftopPermissionScope(
      roleFilter,
      session,
      ["canManageLeads", "canManageDeals", "canManageService", "canManageFinancing", "canManageTradeIns"]
    );
  },
  canReadLeadChildren: ({ session }) => {
    if (!session || !permissions.canAccessLeads({ session })) return false;
    const roleFilter = hasPermissionAcrossAllRooftops(session, "canViewAllLeads") ? true : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } };
    return withRooftopPermissionScope(
      roleFilter,
      session,
      ["canManageLeads", "canManageDeals", "canManageService", "canManageFinancing", "canManageTradeIns"]
    );
  },
  canReadTradeIns: ({ session }) => {
    if (!session || !permissions.canAccessTradeIns({ session })) return false;
    const roleFilter = hasPermissionAcrossAllRooftops(session, ["canManageTradeIns", "canViewAllLeads"]) ? true : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } };
    return withRooftopPermissionScope(
      roleFilter,
      session,
      ["canManageTradeIns", "canManageDeals", "canManageLeads"]
    );
  },
  canReadDeals: ({ session }) => {
    if (!session || !permissions.canAccessDeals({ session })) return false;
    const roleFilter = hasPermissionAcrossAllRooftops(session, "canViewAllLeads") ? true : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } };
    return withRooftopPermissionScope(
      roleFilter,
      session,
      ["canManageDeals", "canApproveDeals", "canManageFinancing"]
    );
  },
  canReadDealApprovals: ({ session }) => {
    if (!session || !permissions.canAccessDeals({ session })) return false;
    const roleFilter = hasPermissionAcrossAllRooftops(session, "canViewAllLeads") ? true : { deal: { lead: { assignedSalesperson: { id: { equals: session.itemId } } } } };
    return withRooftopPermissionScope(
      roleFilter,
      session,
      ["canManageDeals", "canApproveDeals", "canManageFinancing"]
    );
  },
  canReadVehicles: ({ session }) => {
    if (!session || !permissions.canViewInventory({ session })) return false;
    return withRooftopPermissionScope(true, session, ["canViewInventory", "canManageInventory"]);
  },
  canReadVehicleImages: ({ session }) => {
    if (!session || !permissions.canViewInventory({ session })) return false;
    return withRooftopPermissionScope(true, session, ["canViewInventory", "canManageInventory"]);
  }
};

// features/keystone/models/trackingFields.ts
var import_fields2 = require("@keystone-6/core/fields");
var trackingFieldUi = {
  createView: { fieldMode: "hidden" },
  itemView: { fieldMode: "read" }
};
var trackingFields = {
  createdAt: (0, import_fields2.timestamp)({
    access: {
      create: () => false,
      update: () => false
    },
    defaultValue: { kind: "now" },
    db: { isNullable: false },
    label: "Created At",
    ui: trackingFieldUi
  }),
  updatedAt: (0, import_fields2.timestamp)({
    access: {
      create: () => false,
      update: () => false
    },
    defaultValue: { kind: "now" },
    db: { isNullable: false, updatedAt: true },
    label: "Updated At",
    ui: trackingFieldUi
  })
};

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageGlobalPeople,
      update: isSignedIn,
      delete: permissions.canManageGlobalPeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageGlobalPeople(args),
    hideDelete: (args) => !permissions.canManageGlobalPeople(args),
    listView: {
      initialColumns: ["name", "email", "role", "assignedLeads"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    ...trackingFields,
    // Basic Info
    name: (0, import_fields3.text)({
      validation: {
        isRequired: true
      }
    }),
    email: (0, import_fields3.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: {
        isRequired: true
      }
    }),
    password: (0, import_fields3.password)({
      access: {
        read: import_access2.denyAll,
        update: ({ session, item }) => permissions.canManageGlobalPeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields3.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManageGlobalRoles,
        update: ({ session, item }) => permissions.canManageGlobalRoles({ session }) && session?.itemId !== item.id
      },
      ui: {
        createView: { fieldMode: (args) => permissions.canManageGlobalRoles(args) ? "edit" : "hidden" },
        itemView: {
          fieldMode: ({ session, item }) => permissions.canManageGlobalRoles({ session }) && rules.canUpdatePeople({ session }) === true && session?.itemId !== item?.id ? "edit" : "read"
        }
      }
    }),
    dealerGroupMemberships: (0, import_fields3.relationship)({
      ref: "DealerGroupMembership.user",
      many: true,
      access: { update: import_access2.denyAll },
      ui: { displayMode: "count" }
    }),
    rooftopMemberships: (0, import_fields3.relationship)({
      ref: "RooftopMembership.user",
      many: true,
      access: { update: import_access2.denyAll },
      ui: { displayMode: "count" }
    }),
    membershipAuditEvents: (0, import_fields3.relationship)({
      ref: "MembershipAuditEvent.targetUser",
      many: true,
      access: { update: import_access2.denyAll },
      ui: { displayMode: "count" }
    }),
    performedMembershipAuditEvents: (0, import_fields3.relationship)({
      ref: "MembershipAuditEvent.actor",
      many: true,
      access: { update: import_access2.denyAll },
      ui: { displayMode: "count" }
    }),
    domainAuditEvents: (0, import_fields3.relationship)({
      ref: "DomainAuditEvent.actor",
      many: true,
      access: { update: import_access2.denyAll },
      ui: { displayMode: "count" }
    }),
    onboardingStatus: (0, import_fields3.select)({
      access: { create: import_access2.denyAll, update: ({ inputData }) => inputData.onboardingStatus === "dismissed" },
      type: "string",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      label: "Onboarding Status",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Tracks whether this user has completed dealership setup."
      }
    }),
    // Dealership-specific fields
    phone: (0, import_fields3.text)({
      label: "Phone Number",
      ui: {
        description: "Contact phone number"
      }
    }),
    employeeId: (0, import_fields3.text)({
      access: { create: permissions.canManageGlobalPeople, update: permissions.canManageGlobalPeople, read: ({ session, item }) => permissions.canManageGlobalPeople({ session }) || session?.itemId === item.id },
      label: "Employee ID",
      ui: {
        description: "Internal employee identifier",
        itemView: { fieldMode: ({ session, item }) => permissions.canManageGlobalPeople({ session }) ? "edit" : session?.itemId === item?.id ? "read" : "hidden" }
      }
    }),
    commissionRate: (0, import_fields3.float)({
      access: { create: permissions.canManageGlobalPeople, update: permissions.canManageGlobalPeople, read: ({ session, item }) => permissions.canManageGlobalPeople({ session }) || session?.itemId === item.id },
      label: "Commission Rate (%)",
      defaultValue: 0,
      ui: {
        description: "Sales commission percentage (e.g., 10 for 10%)",
        itemView: { fieldMode: ({ session, item }) => permissions.canManageGlobalPeople({ session }) ? "edit" : session?.itemId === item?.id ? "read" : "hidden" }
      }
    }),
    isSalesperson: (0, import_fields3.checkbox)({
      access: { create: permissions.canManageGlobalPeople, update: permissions.canManageGlobalPeople },
      defaultValue: false,
      label: "Is Salesperson",
      ui: {
        description: "Whether this user is a salesperson",
        itemView: { fieldMode: (args) => permissions.canManageGlobalPeople(args) ? "edit" : "read" }
      }
    }),
    isServiceAdvisor: (0, import_fields3.checkbox)({
      access: { create: permissions.canManageGlobalPeople, update: permissions.canManageGlobalPeople },
      defaultValue: false,
      label: "Is Service Advisor",
      ui: {
        description: "Whether this user is a service advisor",
        itemView: { fieldMode: (args) => permissions.canManageGlobalPeople(args) ? "edit" : "read" }
      }
    }),
    isFinanceManager: (0, import_fields3.checkbox)({
      access: { create: permissions.canManageGlobalPeople, update: permissions.canManageGlobalPeople },
      defaultValue: false,
      label: "Is Finance Manager",
      ui: {
        description: "Whether this user handles financing",
        itemView: { fieldMode: (args) => permissions.canManageGlobalPeople(args) ? "edit" : "read" }
      }
    }),
    // Reverse relationships are read-only. Their owning domain commands control linkage.
    assignedLeads: (0, import_fields3.relationship)({ ref: "Lead.assignedSalesperson", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Assigned Leads" }),
    deals: (0, import_fields3.relationship)({ ref: "Deal.salesperson", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Deals" }),
    customerAppointments: (0, import_fields3.relationship)({ ref: "ServiceAppointment.customer", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Service Appointments (Customer)" }),
    techAppointments: (0, import_fields3.relationship)({ ref: "ServiceAppointment.assignedTech", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Service Appointments (Technician)" }),
    priceChanges: (0, import_fields3.relationship)({ ref: "PriceHistory.changedBy", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Price Changes" }),
    customerMergeEvents: (0, import_fields3.relationship)({ ref: "CustomerMergeEvent.actor", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    leadAssignmentsFrom: (0, import_fields3.relationship)({ ref: "LeadAssignmentEvent.fromUser", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    leadAssignmentsTo: (0, import_fields3.relationship)({ ref: "LeadAssignmentEvent.toUser", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    performedLeadAssignments: (0, import_fields3.relationship)({ ref: "LeadAssignmentEvent.actor", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    leadRoutingRules: (0, import_fields3.relationship)({ ref: "LeadRoutingRule.assignee", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    customerContactPreferenceEvents: (0, import_fields3.relationship)({ ref: "CustomerContactPreferenceEvent.actor", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    assignedSalesVisits: (0, import_fields3.relationship)({ ref: "SalesVisit.assignedSalesperson", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    managedSalesVisits: (0, import_fields3.relationship)({ ref: "SalesVisit.manager", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" } }),
    interactions: (0, import_fields3.relationship)({ ref: "CustomerInteraction.performedBy", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Customer Interactions" }),
    tasks: (0, import_fields3.relationship)({ ref: "Task.assignedTo", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Tasks" }),
    dealApprovals: (0, import_fields3.relationship)({ ref: "DealApproval.approver", many: true, access: { update: import_access2.denyAll }, ui: { displayMode: "count" }, label: "Deal Approvals" })
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access4 = require("@keystone-6/core/access");
var import_fields4 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      query: ({ session }) => Boolean(session),
      create: permissions.canManageGlobalRoles,
      update: permissions.canManageGlobalRoles,
      delete: permissions.canManageGlobalRoles
    },
    filter: {
      query: rules.canReadRoles,
      update: () => true,
      delete: () => true
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageGlobalRoles(args),
    hideDelete: (args) => !permissions.canManageGlobalRoles(args),
    listView: {
      initialColumns: ["name", "assignedTo"]
    },
    itemView: {
      defaultFieldMode: (args) => permissions.canManageGlobalRoles(args) ? "edit" : "read"
    }
  },
  fields: {
    ...trackingFields,
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    // General permissions
    canSeeOtherPeople: (0, import_fields4.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields4.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields4.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields4.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields4.checkbox)({ defaultValue: false }),
    canManageOnboarding: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Onboarding",
      ui: {
        description: "Can run or dismiss the dealership onboarding seed flow"
      }
    }),
    canManageDealerships: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Dealer Groups & Rooftops",
      ui: {
        description: "Can create and administer dealer groups, rooftops, and staff memberships"
      }
    }),
    // Dealership-specific permissions
    canManageInventory: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Inventory",
      ui: {
        description: "Can add, edit, and delete vehicles in inventory"
      }
    }),
    canViewInventory: (0, import_fields4.checkbox)({
      defaultValue: true,
      label: "Can View Inventory",
      ui: {
        description: "Can view vehicle inventory"
      }
    }),
    canManageLeads: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Leads",
      ui: {
        description: "Can create, edit, and assign leads"
      }
    }),
    canViewAllLeads: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can View All Leads",
      ui: {
        description: "Can view leads assigned to others"
      }
    }),
    canManageDeals: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Deals",
      ui: {
        description: "Can create, edit, and close deals"
      }
    }),
    canApproveDeals: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Approve Deals",
      ui: {
        description: "Can approve deals above certain thresholds"
      }
    }),
    canManageService: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Service",
      ui: {
        description: "Can manage service appointments and orders"
      }
    }),
    canViewReports: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can View Reports",
      ui: {
        description: "Can view sales and inventory reports"
      }
    }),
    canManageFinancing: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Financing",
      ui: {
        description: "Can manage financing options and approvals"
      }
    }),
    canManageTradeIns: (0, import_fields4.checkbox)({
      defaultValue: false,
      label: "Can Manage Trade-Ins",
      ui: {
        description: "Can appraise and manage trade-in vehicles"
      }
    }),
    // Relationship to users
    assignedTo: (0, import_fields4.relationship)({
      ref: "User.role",
      many: true,
      access: { update: import_access4.denyAll },
      ui: {
        itemView: { fieldMode: "read" }
      }
    }),
    dealerGroupMemberships: (0, import_fields4.relationship)({
      ref: "DealerGroupMembership.role",
      many: true,
      access: { update: import_access4.denyAll },
      ui: { displayMode: "count" }
    }),
    rooftopMemberships: (0, import_fields4.relationship)({
      ref: "RooftopMembership.role",
      many: true,
      access: { update: import_access4.denyAll },
      ui: { displayMode: "count" }
    })
  }
});

// features/keystone/models/Make.ts
var import_core3 = require("@keystone-6/core");
var import_access6 = require("@keystone-6/core/access");
var import_fields5 = require("@keystone-6/core/fields");
var Make = (0, import_core3.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "models"]
    }
  },
  fields: {
    ...trackingFields,
    name: (0, import_fields5.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      label: "Make Name",
      ui: {
        description: "Vehicle manufacturer name (e.g., Toyota, Honda, Ford)"
      }
    }),
    logo: (0, import_fields5.image)({
      storage: "my_images",
      label: "Logo",
      ui: {
        description: "Manufacturer logo image"
      }
    }),
    // Relationships
    models: (0, import_fields5.relationship)({
      ref: "Model.make",
      many: true,
      access: { update: import_access6.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["name", "bodyStyle"],
        inlineCreate: { fields: ["name", "bodyStyle", "baseYear"] },
        inlineEdit: { fields: ["name", "bodyStyle", "baseYear"] },
        inlineConnect: true
      },
      label: "Models"
    })
  }
});

// features/keystone/models/Model.ts
var import_core4 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var Model = (0, import_core4.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "make", "bodyStyle", "baseYear"]
    },
    labelField: "name"
  },
  fields: {
    ...trackingFields,
    name: (0, import_fields6.text)({
      validation: { isRequired: true },
      label: "Model Name",
      ui: {
        description: "Vehicle model name (e.g., Camry, Accord, F-150)"
      }
    }),
    make: (0, import_fields6.relationship)({
      ref: "Make.models",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Make"
    }),
    bodyStyle: (0, import_fields6.select)({
      type: "string",
      options: [
        { label: "Sedan", value: "sedan" },
        { label: "SUV", value: "suv" },
        { label: "Truck", value: "truck" },
        { label: "Coupe", value: "coupe" },
        { label: "Hatchback", value: "hatchback" },
        { label: "Convertible", value: "convertible" },
        { label: "Wagon", value: "wagon" },
        { label: "Van", value: "van" },
        { label: "Minivan", value: "minivan" }
      ],
      label: "Body Style",
      ui: {
        description: "Vehicle body style category"
      }
    }),
    baseYear: (0, import_fields6.integer)({
      label: "Base Year",
      ui: {
        description: "Year when this model was first introduced"
      }
    })
  }
});

// features/keystone/models/Vehicle.ts
var import_core5 = require("@keystone-6/core");
var import_access9 = require("@keystone-6/core/access");
var import_fields7 = require("@keystone-6/core/fields");
var import_schema = require("@graphql-ts/schema");

// features/keystone/lifecycle/domainEvents.ts
var import_node_crypto = require("node:crypto");
function normalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key5, entry]) => [key5, normalize(entry)])
    );
  }
  return value;
}
function stableJson(value) {
  return JSON.stringify(normalize(value));
}
function domainEventRequestHash(value) {
  return (0, import_node_crypto.createHash)("sha256").update(stableJson(value)).digest("hex");
}
function validateEvent(input2) {
  for (const [label, value] of Object.entries({
    eventKey: input2.eventKey,
    rooftopId: input2.rooftopId,
    aggregateType: input2.aggregateType,
    aggregateId: input2.aggregateId,
    action: input2.action,
    topic: input2.topic
  })) {
    if (!String(value || "").trim()) throw new Error(`Domain event ${label} is required`);
  }
  if (input2.eventKey.length > 240) throw new Error("Domain event key is too long");
}
async function recordDomainEventInTransaction(transactionContext, input2) {
  validateEvent(input2);
  const prisma = transactionContext.prisma;
  const request = {
    rooftopId: input2.rooftopId,
    aggregateType: input2.aggregateType,
    aggregateId: input2.aggregateId,
    action: input2.action,
    topic: input2.topic,
    beforeSnapshot: input2.beforeSnapshot ?? null,
    afterSnapshot: input2.afterSnapshot ?? null,
    metadata: input2.metadata ?? {},
    payload: input2.payload ?? input2.afterSnapshot ?? {}
  };
  const requestHash = domainEventRequestHash(request);
  await prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`domain-event:${input2.eventKey}`}, 0))`;
  const existing = await prisma.domainAuditEvent.findUnique({
    where: { eventKey: input2.eventKey },
    select: { id: true, requestHash: true }
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error("Domain event idempotency key was reused with different evidence");
    }
    return { id: existing.id, reused: true };
  }
  const occurredAt = input2.occurredAt ?? /* @__PURE__ */ new Date();
  const audit = await prisma.domainAuditEvent.create({
    data: {
      rooftopId: input2.rooftopId,
      eventKey: input2.eventKey,
      requestHash,
      aggregateType: input2.aggregateType,
      aggregateId: input2.aggregateId,
      action: input2.action,
      beforeSnapshot: input2.beforeSnapshot ?? null,
      afterSnapshot: input2.afterSnapshot ?? null,
      metadata: input2.metadata ?? {},
      actorId: input2.actorId ?? null,
      occurredAt
    },
    select: { id: true }
  });
  await prisma.domainOutboxEvent.create({
    data: {
      rooftopId: input2.rooftopId,
      deliveryKey: input2.eventKey,
      topic: input2.topic,
      aggregateType: input2.aggregateType,
      aggregateId: input2.aggregateId,
      payload: input2.payload ?? input2.afterSnapshot ?? {},
      status: "pending",
      attemptCount: 0,
      availableAt: occurredAt
    }
  });
  return { id: audit.id, reused: false };
}
async function recordDomainEvent(context, input2) {
  return context.transaction(
    (transactionContext) => recordDomainEventInTransaction(transactionContext, input2),
    { timeout: 3e4 }
  );
}

// features/keystone/models/Vehicle.ts
var Vehicle = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadVehicles,
      update: ({ session }) => rules.canReadVehicles({ session }),
      delete: ({ session }) => rules.canReadVehicles({ session })
    }
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      const normalized = { ...resolvedData };
      if (typeof normalized.vin === "string") normalized.vin = normalized.vin.trim().toUpperCase();
      if (typeof normalized.stockNumber === "string") normalized.stockNumber = normalized.stockNumber.trim().toUpperCase();
      for (const field of ["make", "model", "trim", "exteriorColor", "interiorColor"]) {
        if (typeof normalized[field] === "string") normalized[field] = normalized[field].trim();
      }
      return normalized;
    },
    validate: (args) => args.operation === "delete" ? void 0 : validateRooftopRecord(args),
    beforeOperation: async ({ operation, resolvedData, item, context }) => {
      const rooftopId = operation === "create" ? resolvedData.rooftop?.connect?.id : item?.rooftopId;
      if (operation !== "delete") {
        const rooftop = rooftopId ? await context.sudo().prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { status: true } }) : null;
        if (!rooftop || rooftop.status !== "active") throw new Error("Vehicle rooftop must remain active");
        return;
      }
      const [deals, leads, testDrives, financing, acquisitions, inventoryStocks] = await Promise.all([
        context.sudo().prisma.deal.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.lead.count({ where: { interestedVehicleId: item.id } }),
        context.sudo().prisma.testDrive.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.financingApplication.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.inventoryAcquisition.count({ where: { vehicleId: item.id } }),
        context.sudo().prisma.inventoryStock.count({ where: { vehicleId: item.id } })
      ]);
      if (deals + leads + testDrives + financing + acquisitions + inventoryStocks > 0) {
        throw new Error("Referenced vehicle records cannot be deleted");
      }
    },
    afterOperation: async ({ operation, item, originalItem, context }) => {
      const record = item ?? originalItem;
      const occurredAt = /* @__PURE__ */ new Date();
      const snapshot2 = record ? {
        id: record.id,
        rooftopId: record.rooftopId,
        vin: record.vin,
        stockNumber: record.stockNumber,
        status: record.status,
        priceCents: record.priceCents
      } : null;
      const beforeSnapshot = operation === "create" ? null : originalItem ? {
        id: originalItem.id,
        rooftopId: originalItem.rooftopId,
        vin: originalItem.vin,
        stockNumber: originalItem.stockNumber,
        status: originalItem.status,
        priceCents: originalItem.priceCents
      } : null;
      const versionFingerprint = domainEventRequestHash({ operation, beforeSnapshot, snapshot: snapshot2 }).slice(0, 16);
      await recordDomainEventInTransaction(context, {
        eventKey: `hook:vehicle:${record.id}:${operation}:${record.updatedAt?.toISOString?.() ?? occurredAt.toISOString()}:${versionFingerprint}`,
        rooftopId: record.rooftopId,
        aggregateType: "Vehicle",
        aggregateId: record.id,
        action: operation,
        topic: `vehicle.${operation}d`,
        actorId: context.session?.itemId ?? null,
        beforeSnapshot,
        afterSnapshot: operation === "delete" ? null : snapshot2,
        metadata: { source: "keystone-hook" },
        occurredAt
      });
    }
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["vin", "year", "make", "model", "status", "price"]
    },
    labelField: "vin"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle Identification
    vin: (0, import_fields7.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      label: "VIN",
      ui: {
        description: "Vehicle Identification Number (17 characters)"
      }
    }),
    stockNumber: (0, import_fields7.text)({
      isIndexed: "unique",
      label: "Stock Number",
      ui: {
        description: "Internal stock number for inventory tracking"
      }
    }),
    // Vehicle Details
    year: (0, import_fields7.integer)({
      validation: { isRequired: true },
      label: "Year"
    }),
    make: (0, import_fields7.text)({
      validation: { isRequired: true },
      label: "Make",
      ui: {
        description: "Vehicle manufacturer (e.g., Toyota, Honda, Ford)"
      }
    }),
    model: (0, import_fields7.text)({
      validation: { isRequired: true },
      label: "Model",
      ui: {
        description: "Vehicle model name (e.g., Camry, Civic, F-150)"
      }
    }),
    trim: (0, import_fields7.text)({
      label: "Trim",
      ui: {
        description: "Trim level (e.g., LX, EX, Sport)"
      }
    }),
    exteriorColor: (0, import_fields7.text)({
      label: "Exterior Color",
      ui: {
        description: "Exterior paint color"
      }
    }),
    interiorColor: (0, import_fields7.text)({
      label: "Interior Color",
      ui: {
        description: "Interior upholstery color"
      }
    }),
    mileage: (0, import_fields7.integer)({
      label: "Mileage",
      ui: {
        description: "Current odometer reading"
      }
    }),
    // Pricing
    purchasePriceCents: (0, import_fields7.integer)({
      access: { read: permissions.canViewDealerCost },
      isFilterable: permissions.canViewDealerCost,
      isOrderable: permissions.canViewDealerCost,
      label: "Purchase Price (cents)",
      ui: { description: "Dealer acquisition cost in integer USD cents" }
    }),
    listPriceCents: (0, import_fields7.integer)({
      label: "List Price (cents)",
      ui: { description: "Current listing price in integer USD cents" }
    }),
    priceCents: (0, import_fields7.integer)({
      label: "Price (cents)",
      ui: { description: "Compatibility listing price in integer USD cents" }
    }),
    purchasePrice: (0, import_fields7.virtual)({
      access: { read: permissions.canViewDealerCost },
      field: import_schema.graphql.field({ type: import_schema.graphql.Float, resolve(item) {
        return item.purchasePriceCents == null ? null : item.purchasePriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    listPrice: (0, import_fields7.virtual)({
      field: import_schema.graphql.field({ type: import_schema.graphql.Float, resolve(item) {
        return item.listPriceCents == null ? null : item.listPriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    price: (0, import_fields7.virtual)({
      field: import_schema.graphql.field({ type: import_schema.graphql.Float, resolve(item) {
        return item.priceCents == null ? null : item.priceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Condition and Status
    condition: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "New", value: "new" },
        { label: "Used", value: "used" },
        { label: "Certified", value: "certified" }
      ],
      label: "Condition",
      ui: {
        description: "Vehicle condition category"
      }
    }),
    status: (0, import_fields7.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "Available", value: "available" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Service", value: "service" }
      ],
      defaultValue: "available",
      label: "Status",
      ui: {
        description: "Current availability status"
      }
    }),
    // Features and Description
    description: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea",
        description: "Marketing description for listings"
      },
      label: "Description"
    }),
    features: (0, import_fields7.json)({
      defaultValue: [],
      label: "Features",
      ui: {
        description: "JSON array of vehicle features and options"
      }
    }),
    metadata: (0, import_fields7.json)({
      access: { read: permissions.canViewDealerCost },
      defaultValue: {},
      label: "Metadata",
      ui: {
        description: "Additional vehicle specifications and data (engine, transmission, etc.)"
      }
    }),
    // Images
    images: (0, import_fields7.relationship)({
      ref: "VehicleImage.vehicle",
      many: true,
      access: { update: import_access9.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["image", "imagePath", "caption", "isPrimary", "sortOrder"]
      },
      label: "Gallery Images"
    }),
    // Relationships
    deals: (0, import_fields7.relationship)({
      access: { read: permissions.canAccessDeals, update: import_access9.denyAll },
      isFilterable: permissions.canAccessDeals,
      ref: "Deal.vehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Deals"
    }),
    leads: (0, import_fields7.relationship)({
      access: { read: permissions.canAccessLeads, update: import_access9.denyAll },
      isFilterable: permissions.canAccessLeads,
      ref: "Lead.interestedVehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Interested Leads"
    }),
    testDrives: (0, import_fields7.relationship)({
      access: { read: permissions.canAccessLeads, update: import_access9.denyAll },
      isFilterable: permissions.canAccessLeads,
      ref: "TestDrive.vehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Test Drives"
    }),
    conditionReports: (0, import_fields7.relationship)({
      access: { read: permissions.canViewInventory, update: import_access9.denyAll },
      isFilterable: permissions.canViewInventory,
      ref: "VehicleConditionReport.vehicle",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["reportDate", "overallCondition", "inspector"]
      },
      label: "Condition Reports"
    }),
    history: (0, import_fields7.relationship)({
      access: { read: permissions.canViewInventory, update: import_access9.denyAll },
      isFilterable: permissions.canViewInventory,
      ref: "VehicleHistory.vehicle",
      ui: {
        displayMode: "cards",
        cardFields: ["acquisitionDate", "previousOwners", "hasAccidents"]
      },
      label: "Vehicle History"
    }),
    priceHistory: (0, import_fields7.relationship)({
      access: { read: permissions.canViewDealerCost, update: import_access9.denyAll },
      isFilterable: permissions.canViewDealerCost,
      ref: "PriceHistory.vehicle",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["effectiveDate", "previousPrice", "newPrice", "changeReason"]
      },
      label: "Price History"
    }),
    inventoryStock: (0, import_fields7.relationship)({
      ref: "InventoryStock.vehicle",
      access: { read: permissions.canViewInventory, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
      label: "Inventory Operations Record"
    }),
    acquisition: (0, import_fields7.relationship)({
      ref: "InventoryAcquisition.vehicle",
      access: { read: permissions.canManageInventory, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
      label: "Inventory Acquisition"
    }),
    salesVisits: (0, import_fields7.relationship)({
      ref: "SalesVisit.vehicle",
      many: true,
      access: { update: () => false },
      ui: { displayMode: "count" },
      label: "Sales visits"
    }),
    financingApplications: (0, import_fields7.relationship)({
      access: { read: permissions.canManageFinancing, update: import_access9.denyAll },
      isFilterable: permissions.canManageFinancing,
      ref: "FinancingApplication.vehicle",
      many: true,
      ui: { displayMode: "count" },
      label: "Restricted Financing Applications"
    })
  }
});

// features/keystone/models/VehicleImage.ts
var import_core6 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var VehicleImage = (0, import_core6.list)({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadVehicleImages,
      update: ({ session }) => rules.canReadVehicleImages({ session }),
      delete: ({ session }) => rules.canReadVehicleImages({ session })
    }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [{ field: "vehicle", listKey: "Vehicle" }])
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["vehicle", "caption", "isPrimary", "sortOrder"]
    },
    labelField: "caption"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle relationship
    vehicle: (0, import_fields8.relationship)({
      ref: "Vehicle.images",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Image
    image: (0, import_fields8.image)({
      storage: "my_images",
      label: "Image"
    }),
    imagePath: (0, import_fields8.text)({
      label: "Static Image Path",
      ui: {
        description: "Public storefront asset path, for example /images/luxury-sedan.jpg"
      }
    }),
    // Caption
    caption: (0, import_fields8.text)({
      label: "Caption",
      ui: {
        description: "Description or caption for this image"
      }
    }),
    // Category
    category: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "Exterior", value: "exterior" },
        { label: "Interior", value: "interior" },
        { label: "Engine", value: "engine" },
        { label: "Damage", value: "damage" }
      ],
      defaultValue: "exterior",
      label: "Category",
      ui: {
        description: "Type of image"
      }
    }),
    // Sort order
    sortOrder: (0, import_fields8.integer)({
      defaultValue: 0,
      label: "Sort Order",
      ui: {
        description: "Order in which images appear in gallery (lower = first)"
      }
    }),
    // Primary image flag
    isPrimary: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Primary Image",
      ui: {
        description: "Set as the main display image for this vehicle"
      }
    })
  }
});

// features/keystone/models/VehicleConditionReport.ts
var import_core7 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var VehicleConditionReport = (0, import_core7.list)({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, ["canViewInventory", "canManageInventory"]),
      update: ({ session }) => withRooftopScope(true, session, "canManageInventory"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageInventory")
    },
    item: { create: canCreateRooftopRecord("canManageInventory") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [{ field: "vehicle", listKey: "Vehicle" }])
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "reportDate", "inspector", "overallCondition"]
    },
    labelField: "reportDate"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle relationship
    vehicle: (0, import_fields9.relationship)({
      ref: "Vehicle.conditionReports",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Report Details
    reportDate: (0, import_fields9.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Report Date"
    }),
    inspector: (0, import_fields9.text)({
      label: "Inspector",
      ui: {
        description: "Name of person who performed inspection"
      }
    }),
    // Condition Ratings
    overallCondition: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Overall Condition"
    }),
    mechanicalRating: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Mechanical Rating",
      ui: {
        description: "Engine, transmission, drivetrain condition"
      }
    }),
    bodyRating: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Body Rating",
      ui: {
        description: "Exterior body and paint condition"
      }
    }),
    interiorRating: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Interior Rating",
      ui: {
        description: "Seats, dashboard, carpet condition"
      }
    }),
    // Issues and Repairs
    issues: (0, import_fields9.json)({
      defaultValue: [],
      label: "Issues",
      ui: {
        description: "JSON array of identified issues [{description, severity, location}]"
      }
    }),
    estimatedRepairs: (0, import_fields9.integer)({
      label: "Estimated Repair Cost",
      ui: {
        description: "Estimated cost to address identified issues"
      }
    }),
    // Notes
    notes: (0, import_fields9.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional inspection notes"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/VehicleHistory.ts
var import_core8 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var VehicleHistory = (0, import_core8.list)({
  access: {
    operation: {
      query: permissions.canViewInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, ["canViewInventory", "canManageInventory"]),
      update: ({ session }) => withRooftopScope(true, session, "canManageInventory"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageInventory")
    },
    item: { create: canCreateRooftopRecord("canManageInventory") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [{ field: "vehicle", listKey: "Vehicle" }])
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "acquisitionDate", "previousOwners", "hasAccidents"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle relationship
    vehicle: (0, import_fields10.relationship)({
      ref: "Vehicle.history",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Acquisition Details
    acquisitionDate: (0, import_fields10.timestamp)({
      label: "Acquisition Date",
      ui: {
        description: "Date vehicle was acquired by dealership"
      }
    }),
    acquisitionSource: (0, import_fields10.text)({
      label: "Acquisition Source",
      ui: {
        description: "Where vehicle was acquired (trade-in, auction, etc.)"
      }
    }),
    // Ownership History
    previousOwners: (0, import_fields10.integer)({
      label: "Previous Owners",
      ui: {
        description: "Number of previous owners"
      }
    }),
    hasAccidents: (0, import_fields10.checkbox)({
      defaultValue: false,
      label: "Has Accidents",
      ui: {
        description: "Vehicle has been in one or more accidents"
      }
    }),
    accidentDetails: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Details of any accidents or damage history"
      },
      label: "Accident Details"
    }),
    // Service History
    serviceRecords: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Summary of known service history"
      },
      label: "Service Records"
    }),
    // Title Information
    titleStatus: (0, import_fields10.text)({
      label: "Title Status",
      ui: {
        description: "Clean, Salvage, Rebuilt, etc."
      }
    }),
    // Notes
    notes: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional history notes"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/PriceHistory.ts
var import_core9 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var import_schema2 = require("@graphql-ts/schema");
var PriceHistory = (0, import_core9.list)({
  access: {
    operation: {
      query: permissions.canViewDealerCost,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, ["canManageInventory", "canManageFinancing"]),
      update: ({ session }) => withRooftopScope(true, session, "canManageInventory"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageInventory")
    },
    item: { create: canCreateRooftopRecord("canManageInventory") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "vehicle", listKey: "Vehicle" },
      { field: "changedBy", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "effectiveDate", "previousPrice", "newPrice", "changeReason"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle relationship
    vehicle: (0, import_fields11.relationship)({
      ref: "Vehicle.priceHistory",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Price Change Details
    effectiveDate: (0, import_fields11.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Effective Date",
      ui: {
        description: "Date when price change took effect"
      }
    }),
    previousPriceCents: (0, import_fields11.integer)({ label: "Previous Price (cents)", ui: { description: "Previous price in integer USD cents" } }),
    newPriceCents: (0, import_fields11.integer)({ validation: { isRequired: true }, label: "New Price (cents)", ui: { description: "New price in integer USD cents" } }),
    previousPrice: (0, import_fields11.virtual)({
      field: import_schema2.graphql.field({ type: import_schema2.graphql.Float, resolve(item) {
        return item.previousPriceCents == null ? null : item.previousPriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    newPrice: (0, import_fields11.virtual)({
      field: import_schema2.graphql.field({ type: import_schema2.graphql.Float, resolve(item) {
        return item.newPriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Change Reason
    changeReason: (0, import_fields11.text)({
      label: "Change Reason",
      ui: {
        description: "Reason for price change (e.g., Market adjustment, Special pricing, Aged inventory)"
      }
    }),
    // Changed By
    changedBy: (0, import_fields11.relationship)({
      ref: "User.priceChanges",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Changed By"
    }),
    // Notes
    notes: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about price change"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/Lead.ts
var import_core10 = require("@keystone-6/core");
var import_access15 = require("@keystone-6/core/access");
var import_fields12 = require("@keystone-6/core/fields");
var Lead = (0, import_core10.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      // Public intake and operator commands own identity, assignment and lifecycle.
      // Raw and nested writes must not bypass their validation/audit transactions.
      create: import_access15.denyAll,
      update: import_access15.denyAll,
      delete: import_access15.denyAll
    },
    filter: {
      query: rules.canReadLeads
    }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "customer", listKey: "Customer" },
      { field: "interestedVehicle", listKey: "Vehicle" },
      { field: "assignedSalesperson", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["firstName", "lastName", "status", "source", "assignedSalesperson", "createdAt"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    customer: (0, import_fields12.relationship)({
      ref: "Customer.leads",
      db: {
        extendPrismaSchema: (field) => field.replace(/customer Customer\?/g, "customer Customer").replace(/customerId String\?/g, "customerId String")
      },
      ui: { displayMode: "select", labelField: "primaryEmail" }
    }),
    // Contact Information
    firstName: (0, import_fields12.text)({
      validation: { isRequired: true },
      label: "First Name"
    }),
    lastName: (0, import_fields12.text)({
      validation: { isRequired: true },
      label: "Last Name"
    }),
    email: (0, import_fields12.text)({
      label: "Email"
    }),
    phone: (0, import_fields12.text)({
      label: "Phone"
    }),
    // Lead Source
    source: (0, import_fields12.select)({
      type: "string",
      options: [
        { label: "Walk-In", value: "walk-in" },
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Referral", value: "referral" },
        { label: "Advertisement", value: "ad" },
        { label: "Social Media", value: "social" },
        { label: "Third Party", value: "third-party" }
      ],
      label: "Source",
      ui: {
        description: "How the lead found the dealership"
      }
    }),
    campaignKey: (0, import_fields12.text)({ access: { update: () => false }, label: "Campaign key" }),
    cadenceKey: (0, import_fields12.text)({ access: { update: () => false }, label: "Cadence key" }),
    cadenceStatus: (0, import_fields12.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "Not enrolled", value: "none" },
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Completed", value: "completed" },
        { label: "Suppressed", value: "suppressed" }
      ],
      defaultValue: "none",
      validation: { isRequired: true }
    }),
    cadenceStep: (0, import_fields12.text)({ access: { update: () => false }, label: "Cadence step" }),
    cadenceDueAt: (0, import_fields12.timestamp)({ access: { update: () => false }, label: "Cadence due" }),
    // Vehicle Interest
    interestedVehicle: (0, import_fields12.relationship)({
      ref: "Vehicle.leads",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Interested Vehicle"
    }),
    budgetRange: (0, import_fields12.select)({
      type: "string",
      options: [
        { label: "Under $20,000", value: "under-20k" },
        { label: "$20,000 - $30,000", value: "20-30k" },
        { label: "$30,000 - $40,000", value: "30-40k" },
        { label: "$40,000 - $50,000", value: "40-50k" },
        { label: "$50,000 - $75,000", value: "50-75k" },
        { label: "$75,000 - $100,000", value: "75-100k" },
        { label: "Over $100,000", value: "over-100k" }
      ],
      label: "Budget Range"
    }),
    tradeInVehicle: (0, import_fields12.text)({
      label: "Trade-In Vehicle",
      ui: {
        description: "Description of vehicle they want to trade in"
      }
    }),
    // Timeline
    timeframe: (0, import_fields12.select)({
      type: "string",
      options: [
        { label: "Immediately", value: "immediately" },
        { label: "This Week", value: "this-week" },
        { label: "This Month", value: "this-month" },
        { label: "Just Looking", value: "just-looking" }
      ],
      label: "Purchase Timeframe"
    }),
    // Status
    status: (0, import_fields12.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "New", value: "new" },
        { label: "Contacted", value: "contacted" },
        { label: "Test Drive Scheduled", value: "test-drive-scheduled" },
        { label: "Negotiating", value: "negotiating" },
        { label: "Closed - Won", value: "closed-won" },
        { label: "Closed - Lost", value: "closed-lost" }
      ],
      defaultValue: "new",
      label: "Status"
    }),
    // Assignment
    assignedSalesperson: (0, import_fields12.relationship)({
      ref: "User.assignedLeads",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned Salesperson"
    }),
    assignedAt: (0, import_fields12.timestamp)({ access: { update: () => false }, label: "Assigned At" }),
    firstResponseDueAt: (0, import_fields12.timestamp)({ access: { update: () => false }, label: "First Response Due" }),
    firstResponseAt: (0, import_fields12.timestamp)({ access: { update: () => false }, label: "First Response At" }),
    assignmentEvents: (0, import_fields12.relationship)({ ref: "LeadAssignmentEvent.lead", many: true, access: { update: import_access15.denyAll }, ui: { displayMode: "count" } }),
    lostReasonCode: (0, import_fields12.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "Purchased elsewhere", value: "purchased-elsewhere" },
        { label: "Price", value: "price" },
        { label: "Financing", value: "financing" },
        { label: "Vehicle unavailable", value: "vehicle-unavailable" },
        { label: "No response", value: "no-response" },
        { label: "Timing", value: "timing" },
        { label: "Other", value: "other" }
      ],
      label: "Lost-sale outcome"
    }),
    lostReason: (0, import_fields12.text)({ access: { update: () => false }, label: "Lost-sale details" }),
    // Notes
    notes: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about the lead"
      },
      label: "Notes"
    }),
    // Timestamps
    lastContact: (0, import_fields12.timestamp)({
      access: { update: () => false },
      label: "Last Contact",
      ui: {
        description: "Last time this lead was contacted"
      }
    }),
    // Relationships
    testDrives: (0, import_fields12.relationship)({
      ref: "TestDrive.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["vehicle", "scheduledTime", "completed"],
        inlineCreate: { fields: ["vehicle", "scheduledTime"] },
        inlineConnect: true
      },
      label: "Test Drives"
    }),
    tradeIns: (0, import_fields12.relationship)({
      ref: "TradeIn.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["year", "make", "model", "condition", "offerAmount"]
      },
      label: "Trade-In Requests"
    }),
    serviceAppointments: (0, import_fields12.relationship)({
      ref: "ServiceAppointment.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["appointmentDate", "serviceType", "status", "customerVehicleDescription"]
      },
      label: "Service Appointments"
    }),
    deals: (0, import_fields12.relationship)({
      ref: "Deal.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["vehicle", "status", "vehiclePrice"]
      },
      label: "Deals"
    }),
    interactions: (0, import_fields12.relationship)({
      ref: "CustomerInteraction.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["interactionType", "date", "outcome", "followUpDate"],
        inlineCreate: { fields: ["interactionType", "date", "notes"] }
      },
      label: "Interactions"
    }),
    tasks: (0, import_fields12.relationship)({
      ref: "Task.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: {
        displayMode: "cards",
        cardFields: ["title", "dueDate", "priority", "completed"],
        inlineCreate: { fields: ["title", "dueDate", "priority"] }
      },
      label: "Tasks"
    }),
    salesVisits: (0, import_fields12.relationship)({
      ref: "SalesVisit.lead",
      many: true,
      access: { update: import_access15.denyAll },
      ui: { displayMode: "count" },
      label: "Sales appointments and showroom visits"
    }),
    financingApplications: (0, import_fields12.relationship)({
      access: { read: permissions.canManageFinancing, update: import_access15.denyAll },
      ref: "FinancingApplication.lead",
      many: true,
      ui: { displayMode: "count" },
      label: "Restricted Financing Applications"
    })
  }
});

// features/keystone/models/CustomerInteraction.ts
var import_core11 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var CustomerInteraction = (0, import_core11.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadChildren,
      update: rules.canReadLeadChildren,
      delete: rules.canReadLeadChildren
    },
    item: { create: () => false }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "performedBy", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["lead", "interactionType", "date", "outcome", "followUpDate"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Lead relationship
    lead: (0, import_fields13.relationship)({
      ref: "Lead.interactions",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    // Interaction Details
    interactionType: (0, import_fields13.select)({
      type: "string",
      options: [
        { label: "Phone Call", value: "phone" },
        { label: "Email", value: "email" },
        { label: "In-Person Visit", value: "visit" },
        { label: "Test Drive", value: "test-drive" },
        { label: "Text Message", value: "sms" },
        { label: "Video Call", value: "video" }
      ],
      validation: { isRequired: true },
      label: "Interaction Type"
    }),
    date: (0, import_fields13.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Date"
    }),
    duration: (0, import_fields13.integer)({
      label: "Duration (Minutes)",
      ui: {
        description: "How long the interaction lasted"
      }
    }),
    // Content
    notes: (0, import_fields13.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed notes about the interaction"
      },
      label: "Notes"
    }),
    // Outcome
    outcome: (0, import_fields13.select)({
      type: "string",
      options: [
        { label: "Positive", value: "positive" },
        { label: "Neutral", value: "neutral" },
        { label: "Negative", value: "negative" },
        { label: "No Answer", value: "no-answer" },
        { label: "Left Voicemail", value: "voicemail" }
      ],
      label: "Outcome"
    }),
    // Follow-up
    followUpDate: (0, import_fields13.timestamp)({
      label: "Follow-Up Date",
      ui: {
        description: "When to follow up next"
      }
    }),
    followUpCompleted: (0, import_fields13.timestamp)({
      label: "Follow-Up Completed",
      ui: {
        description: "When the follow-up was actually completed"
      }
    }),
    // User who performed interaction
    performedBy: (0, import_fields13.relationship)({
      ref: "User.interactions",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Performed By"
    })
  }
});

// features/keystone/models/Task.ts
var import_core12 = require("@keystone-6/core");
var import_access18 = require("@keystone-6/core/access");
var import_fields14 = require("@keystone-6/core/fields");
var Task = (0, import_core12.list)({
  access: {
    operation: {
      query: permissions.canManageTasks,
      // Task lifecycle and Lead linkage are owned by controlled operator commands.
      create: import_access18.denyAll,
      update: import_access18.denyAll,
      delete: import_access18.denyAll
    },
    filter: {
      query: rules.canReadLeadChildren,
      update: rules.canReadLeadChildren,
      delete: rules.canReadLeadChildren
    },
    item: { create: () => false }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "assignedTo", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["title", "assignedTo", "dueDate", "priority", "completed"]
    },
    labelField: "title"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Task Details
    title: (0, import_fields14.text)({
      validation: { isRequired: true },
      label: "Title"
    }),
    description: (0, import_fields14.text)({
      ui: {
        displayMode: "textarea"
      },
      label: "Description"
    }),
    // Assignment
    assignedTo: (0, import_fields14.relationship)({
      ref: "User.tasks",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned To"
    }),
    // Related Lead
    lead: (0, import_fields14.relationship)({
      ref: "Lead.tasks",
      ui: {
        displayMode: "select"
      },
      label: "Related Lead"
    }),
    // Priority and Status
    priority: (0, import_fields14.select)({
      type: "string",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" }
      ],
      defaultValue: "medium",
      label: "Priority"
    }),
    completed: (0, import_fields14.checkbox)({
      access: { update: () => false },
      defaultValue: false,
      label: "Completed"
    }),
    // Dates
    dueDate: (0, import_fields14.timestamp)({
      label: "Due Date"
    }),
    completedDate: (0, import_fields14.timestamp)({
      access: { update: () => false },
      label: "Completed Date",
      ui: {
        description: "When task was marked complete"
      }
    })
  }
});

// features/keystone/models/TestDrive.ts
var import_core13 = require("@keystone-6/core");
var import_access20 = require("@keystone-6/core/access");
var import_fields15 = require("@keystone-6/core/fields");
var TestDrive = (0, import_core13.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: import_access20.denyAll,
      update: import_access20.denyAll,
      delete: import_access20.denyAll
    },
    filter: {
      query: rules.canReadLeadChildren,
      update: rules.canReadLeadChildren,
      delete: rules.canReadLeadChildren
    },
    item: { create: import_access20.denyAll }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "vehicle", listKey: "Vehicle" },
      { field: "salesperson", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["lead", "vehicle", "scheduledTime", "salesperson", "completed"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    requestedBy: (0, import_fields15.relationship)({ ref: "User", access: { read: import_access20.denyAll, create: import_access20.denyAll, update: import_access20.denyAll } }),
    // Relationships
    lead: (0, import_fields15.relationship)({
      ref: "Lead.testDrives",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    vehicle: (0, import_fields15.relationship)({
      ref: "Vehicle.testDrives",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    salesperson: (0, import_fields15.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Salesperson"
    }),
    // Scheduling
    scheduledTime: (0, import_fields15.timestamp)({
      label: "Scheduled Time",
      validation: { isRequired: true }
    }),
    // Status
    completed: (0, import_fields15.checkbox)({
      access: { update: () => false },
      defaultValue: false,
      label: "Completed"
    }),
    driverLicenseVerified: (0, import_fields15.checkbox)({
      access: { update: () => false },
      defaultValue: false,
      label: "Driver License Verified",
      ui: {
        description: "Confirm license was checked before test drive"
      }
    }),
    // Feedback
    feedback: (0, import_fields15.text)({
      access: { update: () => false },
      ui: {
        displayMode: "textarea",
        description: "Customer feedback after the test drive"
      },
      label: "Feedback"
    }),
    interestedLevel: (0, import_fields15.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "Not Interested", value: "not-interested" },
        { label: "Maybe", value: "maybe" },
        { label: "Very Interested", value: "very-interested" }
      ],
      label: "Interest Level",
      ui: {
        description: "Customer interest level after test drive"
      }
    })
  }
});

// features/keystone/models/Deal.ts
var import_core14 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var import_schema3 = require("@graphql-ts/schema");

// features/keystone/lifecycle/dealPricing.ts
var MAX_CENTS = 2147483647;
function checkedCents(value, label = "Amount", allowNegative = false) {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > MAX_CENTS || !allowNegative && amount < 0) {
    throw new Error(`${label} must be ${allowNegative ? "" : "non-negative "}integer cents within the supported range`);
  }
  return amount;
}
function lineAmountCents(line) {
  return checkedCents(line?.amountCents ?? Math.round(Number(line?.amount ?? 0) * 100), "Line amount");
}
function sumMoneyLines(lines) {
  if (lines == null) return 0;
  if (!Array.isArray(lines)) throw new Error("Money lines must be an array");
  return checkedCents(lines.reduce((sum, line) => sum + lineAmountCents(line), 0), "Line total");
}
function normalizeMoneyLines(value, label) {
  if (!Array.isArray(value) || value.length > 50) throw new Error(`${label} must be an array with at most 50 lines`);
  const codes2 = /* @__PURE__ */ new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label} line ${index + 1} is invalid`);
    const name = String(item.name || "").trim();
    if (!name || name.length > 160) throw new Error(`${label} name is required and must be at most 160 characters`);
    const code = String(item.code || `legacy-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
    if (!code || code.length > 80 || codes2.has(code)) throw new Error(`${label} codes must be unique and at most 80 characters`);
    codes2.add(code);
    const source = String(item.source || "operator-recorded");
    if (!["operator-recorded", "configured-policy"].includes(source)) throw new Error(`${label} source must be operator-recorded or configured-policy`);
    return { ...item, code, name, amountCents: lineAmountCents(item), source };
  });
}
function calculateDealPrice(deal) {
  const vehiclePriceCents = checkedCents(deal.vehiclePriceCents, "Vehicle price");
  const feesCents = sumMoneyLines(deal.fees);
  const productsCents = sumMoneyLines(deal.products);
  const rebatesCents = sumMoneyLines(deal.rebates);
  const taxAmountCents = Array.isArray(deal.taxLines) && deal.taxLines.length ? sumMoneyLines(deal.taxLines) : checkedCents(deal.taxAmountCents, "Tax");
  const tradeInValueCents = checkedCents(deal.tradeInValueCents, "Trade-in credit");
  const downPaymentCents = checkedCents(deal.downPaymentCents, "Down payment");
  const subtotalCents = checkedCents(vehiclePriceCents + feesCents + productsCents - rebatesCents, "Subtotal", true);
  const totalPriceCents = checkedCents(subtotalCents + taxAmountCents - tradeInValueCents, "Total price", true);
  const balanceCents = checkedCents(totalPriceCents - downPaymentCents, "Balance", true);
  const cashPayableCents = checkedCents(totalPriceCents - checkedCents(deal.financingAmountCents, "Financing amount"), "Cash payable", true);
  return { vehiclePriceCents, feesCents, productsCents, rebatesCents, taxAmountCents, tradeInValueCents, downPaymentCents, subtotalCents, totalPriceCents, balanceCents, cashPayableCents };
}
function assertValidDealPrice(price) {
  if (price.subtotalCents < 0 || price.totalPriceCents < 0) throw new Error("Credits cannot exceed the sale total");
  if (price.balanceCents < 0) throw new Error("Down payment cannot exceed the remaining sale total");
}
function amortizedPaymentCents(principalCents, aprPercent, termMonths) {
  checkedCents(principalCents, "Principal");
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) throw new Error("Loan term is invalid");
  if (!Number.isFinite(aprPercent) || aprPercent < 0 || aprPercent > 100) throw new Error("APR is invalid");
  if (principalCents === 0) return 0;
  if (aprPercent === 0) return Math.round(principalCents / termMonths);
  const rate = aprPercent / 100 / 12;
  return checkedCents(Math.round(principalCents * rate / (1 - Math.pow(1 + rate, -termMonths))), "Monthly payment");
}

// features/keystone/lifecycle/dealLifecycle.ts
var DEAL_STATUSES = [
  "pencil",
  "submitted",
  "approved",
  "financed",
  "delivered",
  "cancelled"
];
var DEAL_TRANSITIONS = {
  pencil: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["financed", "cancelled"],
  financed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};
function isDealStatus(value) {
  return typeof value === "string" && DEAL_STATUSES.includes(value);
}
function isDealEvidenceLocked(status) {
  return status !== "pencil";
}
function assertDealTransition(current, next, permissions2) {
  if (!isDealStatus(current) || !isDealStatus(next)) {
    throw new Error("Invalid deal status transition");
  }
  if (!DEAL_TRANSITIONS[current].includes(next)) {
    throw new Error(`Deal cannot transition from ${current} to ${next}`);
  }
  if (current === "submitted" && !permissions2.canApproveDeals) {
    throw new Error("Deal approval permission is required");
  }
  if ((current === "approved" || current === "financed") && !permissions2.canManageFinancing) {
    throw new Error("Financing permission is required");
  }
  if (current === "pencil" && !permissions2.canManageDeals) {
    throw new Error("Deal management permission is required");
  }
}
function moneyToCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) throw new Error("Invalid money value");
  return Math.round(amount * 100);
}
function buildDealEvidenceSnapshot(deal) {
  const fees = Array.isArray(deal.fees) ? deal.fees.map((fee) => ({
    name: String(fee.name || ""),
    description: String(fee.description || ""),
    code: String(fee.code || ""),
    amountCents: Number.isInteger(fee.amountCents) ? Number(fee.amountCents) : moneyToCents(fee.amount)
  })) : [];
  const cents4 = (name) => checkedCents(deal[`${name}Cents`] ?? moneyToCents(deal[name]), name);
  const amounts = {
    vehiclePriceCents: cents4("vehiclePrice"),
    tradeInValueCents: cents4("tradeInValue"),
    downPaymentCents: cents4("downPayment"),
    financingAmountCents: cents4("financingAmount"),
    monthlyPaymentCents: cents4("monthlyPayment"),
    taxAmountCents: cents4("taxAmount")
  };
  const pricing = calculateDealPrice({ ...deal, ...amounts, fees });
  return {
    version: 3,
    pricing,
    worksheetVersion: Number(deal.worksheetVersion || 0),
    structureType: deal.structureType || "cash",
    leadId: deal.lead?.id || null,
    vehicle: deal.vehicle ? {
      id: deal.vehicle.id,
      vin: deal.vehicle.vin || null,
      stockNumber: deal.vehicle.stockNumber || null,
      year: deal.vehicle.year || null,
      make: deal.vehicle.make || null,
      model: deal.vehicle.model || null,
      trim: deal.vehicle.trim || null
    } : null,
    salespersonId: deal.salesperson?.id || null,
    tradeInVehicleId: deal.tradeInVehicle?.id || null,
    ...amounts,
    taxAmountCents: pricing.taxAmountCents,
    loanTerm: Number(deal.loanTerm || 0),
    aprBasisPoints: Math.round(Number(deal.apr || 0) * 100),
    fees,
    rebates: Array.isArray(deal.rebates) ? deal.rebates : [],
    products: Array.isArray(deal.products) ? deal.products : [],
    taxLines: Array.isArray(deal.taxLines) ? deal.taxLines : [],
    residualValueCents: deal.residualValueCents ?? null,
    moneyFactorBasisPoints: deal.moneyFactorBasisPoints ?? null,
    grossCents: deal.grossCents ?? null,
    selectedLenderDecisionId: deal.selectedLenderDecision?.id || null
  };
}

// features/keystone/models/Deal.ts
var Deal = (0, import_core14.list)({
  access: {
    operation: {
      query: permissions.canAccessDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadDeals,
      update: rules.canReadDeals,
      delete: rules.canReadDeals
    },
    item: { create: () => false }
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["lead", "vehicle", "salesperson", "vehiclePrice", "status", "saleDate"]
    }
  },
  hooks: {
    validate: async (args) => {
      const { operation, resolvedData, item, context } = args;
      if (operation !== "delete") {
        await validateRooftopRecord(args, [
          { field: "lead", listKey: "Lead" },
          { field: "vehicle", listKey: "Vehicle" },
          { field: "salesperson", listKey: "User", kind: "user" },
          { field: "tradeInVehicle", listKey: "TradeIn" }
        ]);
      }
      if (operation === "delete") {
        if (item.status !== "pencil") throw new Error("Only pencil deals can be deleted");
        return;
      }
      if (operation === "create") {
        if (resolvedData.status && resolvedData.status !== "pencil") {
          throw new Error("Deals must be created as pencil drafts and submitted through transitionDeal");
        }
        const vehicle = await assertAccessibleRelationship(context, "Vehicle", connectedId(resolvedData.vehicle), "id status");
        if (vehicle && vehicle.status !== "available") throw new Error("Deal vehicle must be available");
        const lead = await assertAccessibleRelationship(context, "Lead", connectedId(resolvedData.lead), "id assignedSalesperson { id }");
        const salesperson = await assertAccessibleRelationship(context, "User", connectedId(resolvedData.salesperson));
        const tradeIn = await assertAccessibleRelationship(context, "TradeIn", connectedId(resolvedData.tradeInVehicle), "id lead { id } deal { id }");
        if (tradeIn?.deal) throw new Error("Trade-in is already attached to another deal");
        if (lead && tradeIn?.lead && tradeIn.lead.id !== lead.id) {
          throw new Error("Deal and trade-in must belong to the same lead");
        }
        if (lead?.assignedSalesperson && salesperson && lead.assignedSalesperson.id !== salesperson.id) {
          throw new Error("Deal salesperson must match the lead assignment");
        }
        return;
      }
      assertRelationshipUnchanged("lead", resolvedData, item.leadId);
      assertRelationshipUnchanged("vehicle", resolvedData, item.vehicleId);
      assertRelationshipUnchanged("salesperson", resolvedData, item.salespersonId);
      assertRelationshipUnchanged("tradeInVehicle", resolvedData, item.tradeInVehicleId);
      if (resolvedData.status !== void 0) {
        throw new Error("Deal status changes must use transitionDeal");
      }
      if (isDealEvidenceLocked(item.status) && Object.keys(resolvedData).length > 0) {
        throw new Error("Submitted, settled, and cancelled deal evidence is immutable");
      }
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Core Relationships
    lead: (0, import_fields16.relationship)({
      ref: "Lead.deals",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    vehicle: (0, import_fields16.relationship)({
      ref: "Vehicle.deals",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    salesperson: (0, import_fields16.relationship)({
      ref: "User.deals",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Salesperson"
    }),
    // Pricing
    vehiclePriceCents: (0, import_fields16.integer)({ label: "Negotiated Price (cents)", ui: { description: "Final negotiated vehicle price in integer USD cents" } }),
    tradeInValueCents: (0, import_fields16.integer)({ label: "Trade-In Value (cents)", ui: { description: "Trade-in credit in integer USD cents" } }),
    vehiclePrice: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.vehiclePriceCents == null ? null : item.vehiclePriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    tradeInValue: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.tradeInValueCents == null ? null : item.tradeInValueCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    tradeInVehicle: (0, import_fields16.relationship)({
      ref: "TradeIn.deal",
      ui: {
        displayMode: "select"
      },
      label: "Trade-In Vehicle"
    }),
    tradeInDetails: (0, import_fields16.json)({
      defaultValue: {},
      label: "Trade-In Details",
      ui: {
        description: "Additional trade-in vehicle details (year, make, model, VIN)"
      }
    }),
    // Financing
    downPaymentCents: (0, import_fields16.integer)({ label: "Planned Down Payment (cents)", ui: { description: "Deal structure only, stored in integer USD cents; not proof of captured funds" } }),
    financingAmountCents: (0, import_fields16.integer)({ label: "Financing Amount (cents)", ui: { description: "Amount financed in integer USD cents" } }),
    monthlyPaymentCents: (0, import_fields16.integer)({ label: "Monthly Payment (cents)" }),
    downPayment: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.downPaymentCents == null ? null : item.downPaymentCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    financingAmount: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.financingAmountCents == null ? null : item.financingAmountCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    monthlyPayment: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.monthlyPaymentCents == null ? null : item.monthlyPaymentCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    loanTerm: (0, import_fields16.integer)({
      label: "Loan Term (Months)",
      ui: {
        description: "Number of months for loan"
      }
    }),
    apr: (0, import_fields16.float)({
      label: "APR (%)",
      ui: {
        description: "Annual Percentage Rate"
      }
    }),
    // Status
    status: (0, import_fields16.select)({
      type: "string",
      options: [
        { label: "Pencil (Draft)", value: "pencil" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Financed", value: "financed" },
        { label: "Delivered", value: "delivered" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "pencil",
      label: "Status"
    }),
    // Taxes and Fees
    taxAmountCents: (0, import_fields16.integer)({ label: "Tax Amount (cents)", ui: { description: "Sales tax in integer USD cents" } }),
    taxAmount: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({ type: import_schema3.graphql.Float, resolve(item) {
        return item.taxAmountCents == null ? null : item.taxAmountCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    fees: (0, import_fields16.json)({ defaultValue: [], label: "Typed fee lines" }),
    rebates: (0, import_fields16.json)({ defaultValue: [], label: "Typed rebate lines" }),
    products: (0, import_fields16.json)({ defaultValue: [], label: "Typed product lines" }),
    taxLines: (0, import_fields16.json)({ defaultValue: [], label: "Typed tax lines" }),
    structureType: (0, import_fields16.select)({
      type: "string",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Finance", value: "finance" },
        { label: "Lease", value: "lease" }
      ],
      defaultValue: "cash",
      validation: { isRequired: true }
    }),
    residualValueCents: (0, import_fields16.integer)({ label: "Lease residual (cents)" }),
    moneyFactorBasisPoints: (0, import_fields16.integer)({ label: "Lease money factor (basis points)" }),
    worksheetVersion: (0, import_fields16.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    grossCents: (0, import_fields16.integer)({ access: { create: () => false, update: () => false }, label: "Front gross estimate excluding fees, product margin and recon (cents)" }),
    presentedSnapshot: (0, import_fields16.json)({ access: { create: () => false, update: () => false }, defaultValue: {} }),
    presentedAt: (0, import_fields16.timestamp)({ access: { create: () => false, update: () => false } }),
    acceptedSnapshot: (0, import_fields16.json)({ access: { create: () => false, update: () => false }, defaultValue: {} }),
    acceptedAt: (0, import_fields16.timestamp)({ access: { create: () => false, update: () => false } }),
    // Approvals
    selectedLenderDecision: (0, import_fields16.relationship)({
      ref: "LenderDecision.selectedForDeals",
      access: { read: permissions.canManageFinancing, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
      label: "Selected lender offer"
    }),
    deliveryCases: (0, import_fields16.relationship)({ ref: "DeliveryCase.deal", many: true }),
    financeProductQuotes: (0, import_fields16.relationship)({ ref: "FinanceProductQuote.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeProductCancellations: (0, import_fields16.relationship)({ ref: "FinanceProductCancellation.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeMenuVersions: (0, import_fields16.relationship)({ ref: "FinanceMenuVersion.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeComplianceChecks: (0, import_fields16.relationship)({ ref: "FinanceComplianceCheck.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeContractPackages: (0, import_fields16.relationship)({ ref: "FinanceContractPackage.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    financeFundingCases: (0, import_fields16.relationship)({ ref: "FinanceFundingCase.deal", many: true, access: { read: permissions.canManageFinancing, create: () => false, update: () => false } }),
    paymentTransactions: (0, import_fields16.relationship)({ ref: "PaymentTransaction.deal", many: true, access: { read: permissions.canViewReports, create: () => false, update: () => false } }),
    approvals: (0, import_fields16.relationship)({
      ref: "DealApproval.deal",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["approver", "decision", "approvalDate", "notes"],
        inlineCreate: { fields: ["approver", "decision", "notes"] }
      },
      label: "Approvals"
    }),
    // Timestamps
    saleDate: (0, import_fields16.timestamp)({
      label: "Sale Date",
      ui: {
        description: "Date the sale was completed"
      }
    }),
    lockedAt: (0, import_fields16.timestamp)({
      label: "Evidence Locked At",
      ui: { itemView: { fieldMode: "read" } }
    }),
    evidenceSnapshot: (0, import_fields16.json)({
      access: { create: () => false, update: () => false },
      defaultValue: {},
      label: "Immutable Deal Evidence",
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Virtual Fields for Calculations
    totalPrice: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({
        type: import_schema3.graphql.Float,
        async resolve(item) {
          return calculateDealPrice(item).totalPriceCents / 100;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    profit: (0, import_fields16.virtual)({
      field: import_schema3.graphql.field({
        type: import_schema3.graphql.Float,
        async resolve(item, args, context) {
          const deal = item;
          const keystone = context;
          if (!deal.vehicleId) return null;
          const vehicle = await keystone.query.Vehicle.findOne({
            where: { id: deal.vehicleId },
            query: "purchasePriceCents"
          });
          if (vehicle?.purchasePriceCents == null) return null;
          return (calculateDealPrice(deal).vehiclePriceCents - calculateDealPrice(deal).rebatesCents - Number(vehicle.purchasePriceCents)) / 100;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/DealApproval.ts
var import_core15 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var DealApproval = (0, import_core15.list)({
  access: {
    operation: {
      query: permissions.canAccessDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadDealApprovals
    }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "deal", listKey: "Deal" },
      { field: "approver", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["deal", "approver", "decision", "approvalDate"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Deal relationship
    deal: (0, import_fields17.relationship)({
      ref: "Deal.approvals",
      ui: {
        displayMode: "select"
      },
      label: "Deal"
    }),
    // Approver
    approver: (0, import_fields17.relationship)({
      ref: "User.dealApprovals",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Approver"
    }),
    // Approval Decision
    decision: (0, import_fields17.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
        { label: "Changes Requested", value: "changes-requested" }
      ],
      defaultValue: "pending",
      label: "Decision"
    }),
    // Feedback
    notes: (0, import_fields17.text)({
      ui: {
        displayMode: "textarea",
        description: "Approval notes or requested changes"
      },
      label: "Notes"
    }),
    // Timestamps
    approvalDate: (0, import_fields17.timestamp)({
      defaultValue: { kind: "now" },
      label: "Approval Date"
    })
  }
});

// features/keystone/models/TradeIn.ts
var import_core16 = require("@keystone-6/core");
var import_access24 = require("@keystone-6/core/access");
var import_fields18 = require("@keystone-6/core/fields");
var import_schema4 = require("@graphql-ts/schema");
var TradeIn = (0, import_core16.list)({
  access: {
    operation: {
      query: permissions.canAccessTradeIns,
      create: permissions.canAccessTradeIns,
      update: permissions.canAccessTradeIns,
      delete: permissions.canManageTradeIns
    },
    filter: {
      query: rules.canReadTradeIns,
      update: rules.canReadTradeIns,
      delete: rules.canReadTradeIns
    },
    item: { create: canCreateRooftopRecord(TRADE_IN_ACCESS_PERMISSIONS) }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "deal", listKey: "Deal" },
      { field: "appraisedBy", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    listView: {
      initialColumns: ["vin", "year", "make", "model", "condition", "offerAmount"]
    },
    labelField: "vin"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Vehicle Identification
    vin: (0, import_fields18.text)({
      label: "VIN",
      ui: {
        description: "Vehicle Identification Number"
      }
    }),
    // Vehicle Details
    year: (0, import_fields18.text)({
      label: "Year"
    }),
    make: (0, import_fields18.text)({
      label: "Make",
      ui: {
        description: "Vehicle manufacturer (e.g., Toyota)"
      }
    }),
    model: (0, import_fields18.text)({
      label: "Model",
      ui: {
        description: "Vehicle model (e.g., Camry)"
      }
    }),
    trim: (0, import_fields18.text)({
      label: "Trim"
    }),
    mileage: (0, import_fields18.integer)({
      label: "Mileage",
      ui: {
        description: "Current odometer reading"
      }
    }),
    // Condition Assessment
    condition: (0, import_fields18.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Overall Condition"
    }),
    exteriorCondition: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes on exterior condition, damage, paint, etc."
      },
      label: "Exterior Condition Notes"
    }),
    interiorCondition: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes on interior condition, wear, cleanliness, etc."
      },
      label: "Interior Condition Notes"
    }),
    mechanicalIssues: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Known mechanical issues or concerns"
      },
      label: "Mechanical Issues"
    }),
    // Valuation
    kbbValueCents: (0, import_fields18.integer)({ access: { update: () => false }, label: "Reference Value Storage (cents)", ui: { description: "Legacy storage column for an operator-recorded, provider-neutral reference value", itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    offerAmountCents: (0, import_fields18.integer)({ access: { update: () => false }, label: "Offer Amount (cents)", ui: { description: "Dealership offer in integer USD cents" } }),
    referenceValue: (0, import_fields18.virtual)({
      field: import_schema4.graphql.field({ type: import_schema4.graphql.Float, resolve(item) {
        return item.kbbValueCents == null ? null : item.kbbValueCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    kbbValue: (0, import_fields18.virtual)({
      field: import_schema4.graphql.field({ type: import_schema4.graphql.Float, resolve(item) {
        return item.kbbValueCents == null ? null : item.kbbValueCents / 100;
      } }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    }),
    offerAmount: (0, import_fields18.virtual)({
      field: import_schema4.graphql.field({ type: import_schema4.graphql.Float, resolve(item) {
        return item.offerAmountCents == null ? null : item.offerAmountCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Images
    mainPhoto: (0, import_fields18.image)({
      storage: "my_images",
      label: "Main Photo"
    }),
    // Relationships
    lead: (0, import_fields18.relationship)({
      access: { create: import_access24.denyAll, update: import_access24.denyAll },
      ref: "Lead.tradeIns",
      ui: {
        displayMode: "select"
      },
      label: "Customer Lead"
    }),
    deal: (0, import_fields18.relationship)({
      ref: "Deal.tradeInVehicle",
      ui: {
        displayMode: "select"
      },
      label: "Deal"
    }),
    appraisedBy: (0, import_fields18.relationship)({
      access: { update: () => false },
      ref: "User",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Appraised By"
    })
  }
});

// features/keystone/models/ServiceAppointment.ts
var import_core17 = require("@keystone-6/core");
var import_access26 = require("@keystone-6/core/access");
var import_fields19 = require("@keystone-6/core/fields");
var ServiceAppointment = (0, import_core17.list)({
  access: {
    operation: {
      query: permissions.canManageService,
      create: permissions.canManageService,
      update: permissions.canManageService,
      delete: permissions.canManageService
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, "canManageService"),
      update: ({ session }) => withRooftopScope(true, session, "canManageService"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageService")
    },
    item: { create: canCreateRooftopRecord("canManageService") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "customer", listKey: "User", kind: "user" },
      { field: "assignedTech", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    listView: {
      initialColumns: ["customer", "appointmentDate", "serviceType", "status", "assignedTech"]
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    requestedBy: (0, import_fields19.relationship)({ ref: "User", access: { read: import_access26.denyAll, create: import_access26.denyAll, update: import_access26.denyAll } }),
    // Customer and Vehicle
    lead: (0, import_fields19.relationship)({
      access: { create: import_access26.denyAll, update: import_access26.denyAll },
      ref: "Lead.serviceAppointments",
      ui: {
        displayMode: "select",
        labelField: "email"
      },
      label: "Customer Lead"
    }),
    customer: (0, import_fields19.relationship)({
      ref: "User.customerAppointments",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Customer"
    }),
    vehicleVin: (0, import_fields19.text)(),
    transportationNeed: (0, import_fields19.select)({ type: "string", options: ["none", "waiter", "shuttle", "loaner", "rental", "drop-off"].map((value) => ({ label: value, value })), defaultValue: "none" }),
    capacitySlot: (0, import_fields19.text)(),
    customerVehicleDescription: (0, import_fields19.text)({
      label: "Customer Vehicle",
      ui: {
        description: "Description of customer vehicle (Year Make Model)"
      }
    }),
    // Appointment Details
    appointmentDate: (0, import_fields19.timestamp)({
      label: "Appointment Date",
      validation: { isRequired: true }
    }),
    serviceType: (0, import_fields19.select)({
      type: "string",
      options: [
        { label: "Maintenance", value: "maintenance" },
        { label: "Repair", value: "repair" },
        { label: "Warranty", value: "warranty" },
        { label: "Recall", value: "recall" },
        { label: "Inspection", value: "inspection" },
        { label: "Diagnostic", value: "diagnostic" }
      ],
      label: "Service Type"
    }),
    description: (0, import_fields19.text)({
      ui: {
        displayMode: "textarea",
        description: "Customer complaint or service requested"
      },
      label: "Description"
    }),
    estimatedDuration: (0, import_fields19.integer)({
      label: "Estimated Duration (Minutes)",
      ui: {
        description: "Estimated time to complete service"
      }
    }),
    // Assignment
    assignedTech: (0, import_fields19.relationship)({
      ref: "User.techAppointments",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned Technician"
    }),
    // Status
    status: (0, import_fields19.select)({
      access: { update: () => false },
      type: "string",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Checked In", value: "checked-in" },
        { label: "In Progress", value: "in-progress" },
        { label: "Waiting for Parts", value: "waiting-parts" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "scheduled",
      label: "Status"
    }),
    // Vehicle Info at Service
    mileageIn: (0, import_fields19.integer)({
      label: "Mileage In",
      ui: {
        description: "Odometer reading when vehicle checked in"
      }
    }),
    // Notes
    advisorNotes: (0, import_fields19.text)({
      ui: {
        displayMode: "textarea",
        description: "Service advisor notes"
      },
      label: "Advisor Notes"
    }),
    // Relationship to Service Order
    serviceOrder: (0, import_fields19.relationship)({
      access: { update: () => false },
      ref: "ServiceOrder.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["status", "grandTotal"]
      },
      label: "Service Order"
    })
  }
});

// features/keystone/models/ServiceOrder.ts
var import_core18 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var import_schema5 = require("@graphql-ts/schema");

// features/keystone/lifecycle/serviceOrderLifecycle.ts
var SERVICE_ORDER_STATUSES = [
  "estimate",
  "approved",
  "in-progress",
  "completed",
  "invoiced",
  "paid"
];
var SERVICE_ORDER_TRANSITIONS = {
  estimate: ["approved"],
  approved: ["in-progress"],
  "in-progress": ["completed"],
  completed: ["invoiced"],
  invoiced: ["paid"],
  paid: []
};
function isServiceOrderStatus(value) {
  return typeof value === "string" && SERVICE_ORDER_STATUSES.includes(value);
}
function isServiceOrderEvidenceLocked(status) {
  return status === "completed" || status === "invoiced" || status === "paid";
}
function assertServiceOrderTransition(current, next) {
  if (!isServiceOrderStatus(current) || !isServiceOrderStatus(next)) {
    throw new Error("Invalid service order status transition");
  }
  if (!SERVICE_ORDER_TRANSITIONS[current].includes(next)) {
    throw new Error(`Service order cannot transition from ${current} to ${next}`);
  }
}
function buildServiceOrderEvidenceSnapshot(order2) {
  return {
    version: 2,
    appointmentId: order2.appointment?.id || null,
    concern: String(order2.concern || ""),
    cause: String(order2.cause || ""),
    correction: String(order2.correction || ""),
    payType: order2.payType || "customer",
    authorizationStatus: order2.authorizationStatus || "pending",
    authorizationEvidence: order2.authorizationEvidence || {},
    inspectionEvidence: order2.inspectionEvidence || [],
    declinedWork: order2.declinedWork || [],
    invoiceNumber: String(order2.invoiceNumber || ""),
    diagnosis: String(order2.diagnosis || ""),
    workPerformed: String(order2.workPerformed || ""),
    recommendations: String(order2.recommendations || ""),
    laborTotalCents: moneyToCents(order2.laborTotal),
    partsTotalCents: moneyToCents(order2.partsTotal),
    taxCents: moneyToCents(order2.tax),
    grandTotalCents: moneyToCents(order2.grandTotal),
    laborOperations: (order2.laborOperations || []).map((operation) => ({ id: operation.id, operationCode: operation.operationCode, description: operation.description, status: operation.status, technicianId: operation.technician?.id || null, soldHours: operation.soldHours, actualMinutes: operation.actualMinutes, timePunches: operation.timePunches, startedAt: operation.startedAt, completedAt: operation.completedAt })),
    partsMovements: (order2.partsMovements || []).map((movement) => ({ id: movement.id, partId: movement.part?.id || null, partNumber: movement.part?.partNumber || null, movementType: movement.movementType, quantityDelta: movement.quantityDelta, onHandAfter: movement.onHandAfter, committedAfter: movement.committedAfter, onOrderAfter: movement.onOrderAfter, reference: movement.reference, reason: movement.reason, occurredAt: movement.occurredAt })),
    lineItems: (order2.lineItems || []).map((line) => ({
      id: line.id,
      itemType: line.itemType || null,
      description: line.description || "",
      partNumber: line.partNumber || "",
      quantity: Number(line.quantity || 0),
      unitPriceCents: moneyToCents(line.unitPrice),
      priceCents: moneyToCents(line.price),
      costCents: moneyToCents(line.cost)
    }))
  };
}

// features/keystone/models/ServiceOrder.ts
var ServiceOrder = (0, import_core18.list)({
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, "canManageService"),
      update: ({ session }) => withRooftopScope(true, session, "canManageService")
    },
    item: { create: () => false }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["appointment", "status", "laborTotal", "partsTotal", "grandTotal"]
    }
  },
  hooks: {
    validate: async (args) => {
      const { operation, resolvedData, item, context } = args;
      if (operation === "delete") throw new Error("Service order evidence cannot be deleted");
      await validateRooftopRecord(args, [{ field: "appointment", listKey: "ServiceAppointment" }]);
      if (operation === "create") {
        if (resolvedData.status && resolvedData.status !== "estimate") {
          throw new Error("Service orders must start as estimates");
        }
        const appointmentId = connectedId(resolvedData.appointment);
        if (!appointmentId) throw new Error("Service order requires an appointment");
        const appointment = await assertAccessibleRelationship(
          context,
          "ServiceAppointment",
          appointmentId,
          "id serviceOrder { id }"
        );
        if (appointment?.serviceOrder) throw new Error("Appointment already has a service order");
        return;
      }
      if (resolvedData.appointment !== void 0) {
        throw new Error("appointment cannot be moved to another record");
      }
      if (resolvedData.status !== void 0) {
        throw new Error("Service order status changes must use transitionServiceOrder");
      }
      if (isServiceOrderEvidenceLocked(item.status) && Object.keys(resolvedData).length > 0) {
        throw new Error("Completed, invoiced, and paid service order evidence is immutable");
      }
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Link to Appointment
    appointment: (0, import_fields20.relationship)({
      ref: "ServiceAppointment.serviceOrder",
      ui: {
        displayMode: "select"
      },
      label: "Appointment"
    }),
    // Work Description
    concern: (0, import_fields20.text)({ label: "Customer Concern", ui: { displayMode: "textarea" } }),
    cause: (0, import_fields20.text)({ label: "Verified Cause", ui: { displayMode: "textarea" } }),
    correction: (0, import_fields20.text)({ label: "Correction", ui: { displayMode: "textarea" } }),
    payType: (0, import_fields20.select)({ type: "string", options: ["customer", "warranty", "internal"].map((value) => ({ label: value, value })), defaultValue: "customer" }),
    authorizationStatus: (0, import_fields20.select)({ type: "string", options: ["pending", "authorized", "declined"].map((value) => ({ label: value, value })), defaultValue: "pending" }),
    authorizationEvidence: (0, import_fields20.json)({ defaultValue: {} }),
    inspectionEvidence: (0, import_fields20.json)({ defaultValue: [] }),
    declinedWork: (0, import_fields20.json)({ defaultValue: [] }),
    invoiceNumber: (0, import_fields20.text)(),
    diagnosis: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea",
        description: "Initial diagnosis and findings"
      },
      label: "Diagnosis"
    }),
    workPerformed: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed description of work completed"
      },
      label: "Work Performed"
    }),
    recommendations: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea",
        description: "Recommended future service"
      },
      label: "Recommendations"
    }),
    // Line Items
    laborOperations: (0, import_fields20.relationship)({ ref: "ServiceLaborOperation.serviceOrder", many: true }),
    partsMovements: (0, import_fields20.relationship)({ ref: "PartsMovement.serviceOrder", many: true }),
    paymentTransactions: (0, import_fields20.relationship)({ ref: "PaymentTransaction.serviceOrder", many: true, access: { read: permissions.canViewReports, create: () => false, update: () => false } }),
    lineItems: (0, import_fields20.relationship)({
      ref: "RepairOrderLineItem.serviceOrder",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["itemType", "description", "quantity", "price"],
        inlineCreate: { fields: ["itemType", "description", "quantity", "unitPriceCents", "priceCents"] },
        inlineEdit: { fields: ["itemType", "description", "quantity", "unitPriceCents", "priceCents"] }
      },
      label: "Line Items"
    }),
    // Totals (can be calculated from line items or entered manually)
    laborTotalCents: (0, import_fields20.integer)({ label: "Labor Total (cents)", ui: { description: "Total labor charges in integer USD cents" } }),
    partsTotalCents: (0, import_fields20.integer)({ label: "Parts Total (cents)", ui: { description: "Total parts charges in integer USD cents" } }),
    laborTotal: (0, import_fields20.virtual)({
      field: import_schema5.graphql.field({ type: import_schema5.graphql.Float, resolve(item) {
        return item.laborTotalCents == null ? null : item.laborTotalCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    partsTotal: (0, import_fields20.virtual)({
      field: import_schema5.graphql.field({ type: import_schema5.graphql.Float, resolve(item) {
        return item.partsTotalCents == null ? null : item.partsTotalCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    subtotal: (0, import_fields20.virtual)({
      field: import_schema5.graphql.field({
        type: import_schema5.graphql.Float,
        async resolve(item) {
          const serviceOrder = item;
          return (Number(serviceOrder.laborTotalCents || 0) + Number(serviceOrder.partsTotalCents || 0)) / 100;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    taxCents: (0, import_fields20.integer)({ label: "Tax (cents)" }),
    grandTotalCents: (0, import_fields20.integer)({ label: "Grand Total (cents)", ui: { description: "Total including labor, parts, and tax in integer USD cents" } }),
    tax: (0, import_fields20.virtual)({
      field: import_schema5.graphql.field({ type: import_schema5.graphql.Float, resolve(item) {
        return item.taxCents == null ? null : item.taxCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    grandTotal: (0, import_fields20.virtual)({
      field: import_schema5.graphql.field({ type: import_schema5.graphql.Float, resolve(item) {
        return item.grandTotalCents == null ? null : item.grandTotalCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Status
    status: (0, import_fields20.select)({
      type: "string",
      options: [
        { label: "Estimate", value: "estimate" },
        { label: "Approved", value: "approved" },
        { label: "In Progress", value: "in-progress" },
        { label: "Completed", value: "completed" },
        { label: "Invoiced", value: "invoiced" },
        { label: "Paid Externally", value: "paid" }
      ],
      defaultValue: "estimate",
      label: "Status",
      ui: {
        description: "Paid means an operator reconciled an external/offline settlement; the app does not authorize or capture service payments."
      }
    }),
    // Timestamps
    completedAt: (0, import_fields20.timestamp)({
      label: "Completed At",
      ui: {
        description: "When the service was completed"
      }
    }),
    lockedAt: (0, import_fields20.timestamp)({
      label: "Evidence Locked At",
      ui: { itemView: { fieldMode: "read" } }
    }),
    settledAt: (0, import_fields20.timestamp)({
      label: "External Settlement Recorded At",
      ui: { itemView: { fieldMode: "read" } }
    }),
    evidenceSnapshot: (0, import_fields20.json)({
      access: { create: () => false, update: () => false },
      defaultValue: {},
      label: "Immutable Service Evidence",
      ui: { itemView: { fieldMode: "read" } }
    })
  }
});

// features/keystone/models/RepairOrderLineItem.ts
var import_core19 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var import_schema6 = require("@graphql-ts/schema");
var RepairOrderLineItem = (0, import_core19.list)({
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, "canManageService"),
      update: ({ session }) => withRooftopScope(true, session, "canManageService"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageService")
    },
    item: { create: () => false }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["serviceOrder", "itemType", "description", "quantity", "price"]
    },
    labelField: "description"
  },
  hooks: {
    validate: async (args) => {
      const { operation, resolvedData, item, context } = args;
      await validateRooftopRecord(args, [{ field: "serviceOrder", listKey: "ServiceOrder" }]);
      const serviceOrderId = operation === "create" ? connectedId(resolvedData.serviceOrder) : String(item.serviceOrderId || "");
      if (!serviceOrderId) throw new Error("Repair order line item requires a service order");
      if (operation === "update") {
        assertRelationshipUnchanged("serviceOrder", resolvedData, item.serviceOrderId);
      }
      const order2 = await assertAccessibleRelationship(context, "ServiceOrder", serviceOrderId, "id status");
      if (isServiceOrderEvidenceLocked(order2?.status)) {
        throw new Error("Line items are immutable after service completion");
      }
    }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Service Order relationship
    serviceOrder: (0, import_fields21.relationship)({
      ref: "ServiceOrder.lineItems",
      ui: {
        displayMode: "select"
      },
      label: "Service Order"
    }),
    // Item Details
    itemType: (0, import_fields21.select)({
      type: "string",
      options: [
        { label: "Labor", value: "labor" },
        { label: "Part", value: "part" },
        { label: "Sublet", value: "sublet" }
      ],
      validation: { isRequired: true },
      label: "Item Type"
    }),
    description: (0, import_fields21.text)({
      validation: { isRequired: true },
      label: "Description",
      ui: {
        description: "Description of labor or part"
      }
    }),
    partNumber: (0, import_fields21.text)({
      label: "Part Number",
      ui: {
        description: "Part number if applicable"
      }
    }),
    // Quantity and Pricing
    quantity: (0, import_fields21.float)({
      validation: { isRequired: true },
      defaultValue: 1,
      label: "Quantity",
      ui: {
        description: "Quantity or hours"
      }
    }),
    unitPriceCents: (0, import_fields21.integer)({ validation: { isRequired: true }, label: "Unit Price (cents)", ui: { description: "Price per unit or hourly rate in integer USD cents" } }),
    priceCents: (0, import_fields21.integer)({ validation: { isRequired: true }, label: "Total Price (cents)", ui: { description: "Quantity \xD7 unit price in integer USD cents" } }),
    costCents: (0, import_fields21.integer)({ access: { read: permissions.canViewDealerCost }, label: "Cost (cents)", ui: { description: "Dealer cost in integer USD cents" } }),
    unitPrice: (0, import_fields21.virtual)({
      field: import_schema6.graphql.field({ type: import_schema6.graphql.Float, resolve(item) {
        return item.unitPriceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    price: (0, import_fields21.virtual)({
      field: import_schema6.graphql.field({ type: import_schema6.graphql.Float, resolve(item) {
        return item.priceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    cost: (0, import_fields21.virtual)({
      field: import_schema6.graphql.field({ type: import_schema6.graphql.Float, resolve(item) {
        return item.costCents == null ? null : item.costCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    })
  }
});

// features/keystone/models/ServicePackage.ts
var import_core20 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var import_schema7 = require("@graphql-ts/schema");
var ServicePackage = (0, import_core20.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access to view service packages
      create: permissions.canManageService,
      update: permissions.canManageService,
      delete: permissions.canManageService
    },
    filter: {
      query: ({ session }) => session && permissions.canManageService({ session }) ? withRooftopScope(true, session, "canManageService") : publicActiveRooftopScope({}),
      update: ({ session }) => withRooftopScope(true, session, "canManageService"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageService")
    },
    item: { create: canCreateRooftopRecord("canManageService") }
  },
  hooks: { validate: (args) => validateRooftopRecord(args) },
  ui: {
    listView: {
      initialColumns: ["name", "price", "estimatedDuration"]
    },
    labelField: "name"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Package Details
    name: (0, import_fields22.text)({
      validation: { isRequired: true },
      label: "Package Name",
      ui: {
        description: "e.g., Oil Change, Tire Rotation, Brake Service"
      }
    }),
    description: (0, import_fields22.text)({
      ui: {
        displayMode: "textarea"
      },
      label: "Description"
    }),
    // Pricing and Duration
    priceCents: (0, import_fields22.integer)({ validation: { isRequired: true }, label: "Price (cents)", ui: { description: "Package price in integer USD cents" } }),
    price: (0, import_fields22.virtual)({
      field: import_schema7.graphql.field({ type: import_schema7.graphql.Float, resolve(item) {
        return item.priceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    estimatedDuration: (0, import_fields22.integer)({
      label: "Estimated Duration (Minutes)",
      ui: {
        description: "Expected time to complete"
      }
    }),
    // Included Services
    includedServices: (0, import_fields22.json)({
      defaultValue: [],
      label: "Included Services",
      ui: {
        description: "JSON array of services included [{service, description}]"
      }
    })
  }
});

// features/keystone/models/PartsInventory.ts
var import_core21 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var import_schema8 = require("@graphql-ts/schema");

// features/keystone/models/prismaSchema.ts
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function requiredRelationshipDb(fieldName) {
  const field = escapeRegExp(fieldName);
  return {
    extendPrismaSchema: (schema) => schema.replace(new RegExp(`(${field}\\s+\\w+)\\?`), "$1").replace(new RegExp(`(${field}Id\\s+String)\\?`), "$1")
  };
}
function prismaModelDirectives(...directives) {
  return {
    extendPrismaSchema: (schema) => schema.replace(
      /\n}$/,
      `

  ${directives.join("\n  ")}
}`
    )
  };
}

// features/keystone/models/PartsInventory.ts
var PartsInventory = (0, import_core21.list)({
  db: prismaModelDirectives('@@unique([rooftopId, partNumber], map: "PartsInventory_rooftop_partNumber_key")'),
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session, "canManageService"),
      update: ({ session }) => withRooftopScope(true, session, "canManageService"),
      delete: ({ session }) => withRooftopScope(true, session, "canManageService")
    },
    item: { create: () => false }
  },
  hooks: { validate: (args) => validateRooftopRecord(args) },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["partNumber", "description", "quantity", "cost", "price"]
    },
    labelField: "partNumber"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Part Details
    partNumber: (0, import_fields23.text)({
      validation: { isRequired: true },
      label: "Part Number"
    }),
    description: (0, import_fields23.text)({
      validation: { isRequired: true },
      label: "Description"
    }),
    // Inventory
    binLocation: (0, import_fields23.text)(),
    committedQuantity: (0, import_fields23.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    onOrderQuantity: (0, import_fields23.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    movements: (0, import_fields23.relationship)({ ref: "PartsMovement.part", many: true }),
    quantity: (0, import_fields23.integer)({
      validation: { isRequired: true },
      defaultValue: 0,
      label: "Quantity in Stock"
    }),
    minimumQuantity: (0, import_fields23.integer)({
      label: "Minimum Quantity",
      ui: {
        description: "Reorder threshold"
      }
    }),
    // Pricing
    costCents: (0, import_fields23.integer)({ label: "Cost (cents)", ui: { description: "Dealer cost per unit in integer USD cents" } }),
    priceCents: (0, import_fields23.integer)({ validation: { isRequired: true }, label: "Retail Price (cents)", ui: { description: "Retail price in integer USD cents" } }),
    cost: (0, import_fields23.virtual)({
      field: import_schema8.graphql.field({ type: import_schema8.graphql.Float, resolve(item) {
        return item.costCents == null ? null : item.costCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    price: (0, import_fields23.virtual)({
      field: import_schema8.graphql.field({ type: import_schema8.graphql.Float, resolve(item) {
        return item.priceCents / 100;
      } }),
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Supplier
    supplier: (0, import_fields23.text)({
      label: "Supplier",
      ui: {
        description: "Parts supplier name"
      }
    }),
    supplierPartNumber: (0, import_fields23.text)({
      label: "Supplier Part Number",
      ui: {
        description: "Supplier-specific part number"
      }
    })
  }
});

// features/keystone/models/DealershipProfile.ts
var import_core22 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");

// features/storefront/lib/branding.ts
var DEFAULT_STOREFRONT_LOGO_HUE = "0";
function normalizeStorefrontLogoHue(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STOREFRONT_LOGO_HUE));
  if (!Number.isFinite(numeric)) return DEFAULT_STOREFRONT_LOGO_HUE;
  return String((numeric % 360 + 360) % 360);
}

// features/lib/sanitize-store-logo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) return "";
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) return "";
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/keystone/models/DealershipProfile.ts
var canManageStoreSettings = (args) => permissions.canManageOnboarding(args) || permissions.canManageDealerships(args);
var DealershipProfile = (0, import_core22.list)({
  isSingleton: true,
  access: {
    operation: {
      query: () => true,
      create: canManageStoreSettings,
      update: canManageStoreSettings,
      delete: canManageStoreSettings
    }
  },
  ui: {
    label: "Dealership Profile"
  },
  fields: {
    ...trackingFields,
    name: (0, import_fields24.text)({ validation: { isRequired: true } }),
    shortName: (0, import_fields24.text)({ validation: { isRequired: true } }),
    salesEmail: (0, import_fields24.text)({ defaultValue: "" }),
    serviceEmail: (0, import_fields24.text)({ defaultValue: "" }),
    phone: (0, import_fields24.text)({ defaultValue: "" }),
    addressLine1: (0, import_fields24.text)({ defaultValue: "" }),
    addressLine2: (0, import_fields24.text)({ defaultValue: "" }),
    city: (0, import_fields24.text)({ defaultValue: "" }),
    state: (0, import_fields24.text)({ defaultValue: "" }),
    postalCode: (0, import_fields24.text)({ defaultValue: "" }),
    hoursMonFri: (0, import_fields24.text)({ defaultValue: "" }),
    hoursSaturday: (0, import_fields24.text)({ defaultValue: "" }),
    hoursSunday: (0, import_fields24.text)({ defaultValue: "" }),
    websiteUrl: (0, import_fields24.text)({ defaultValue: "" }),
    currencyCode: (0, import_fields24.text)({ validation: { isRequired: true }, defaultValue: "USD" }),
    homepageTitle: (0, import_fields24.text)({ defaultValue: "" }),
    homepageDescription: (0, import_fields24.text)({
      defaultValue: "",
      ui: { displayMode: "textarea" }
    }),
    logoIcon: (0, import_fields24.text)({
      defaultValue: "",
      ui: {
        displayMode: "textarea",
        description: "Sanitized SVG brand mark exposed to the public storefront"
      },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          if (value === void 0 || value === null || value === "") return value;
          return typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
        },
        validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
          const submitted = inputData?.[fieldKey];
          if (typeof submitted === "string" && submitted.trim() && !resolvedData?.[fieldKey]) {
            addValidationError("Brand mark must be a valid, safe SVG document");
          }
        }
      }
    }),
    logoColor: (0, import_fields24.text)({
      defaultValue: "0",
      ui: { description: "Normalized storefront brand hue rotation from 0 through 359 degrees" },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return value === void 0 ? value : normalizeStorefrontLogoHue(value);
        }
      }
    })
  }
});

// features/keystone/models/FinancingApplication.ts
var import_core23 = require("@keystone-6/core");
var import_access33 = require("@keystone-6/core/access");
var import_fields25 = require("@keystone-6/core/fields");
var privateRead = { read: permissions.canManageFinancing, create: () => false, update: () => false };
var FinancingApplication = (0, import_core23.list)({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "lead", listKey: "Lead" },
      { field: "vehicle", listKey: "Vehicle" }
    ])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["reference", "status", "lead", "vehicle", "requestedAmountCents", "submittedAt"] },
    labelField: "reference"
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    reference: (0, import_fields25.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    idempotencyKey: (0, import_fields25.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      access: { read: import_access33.denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    }),
    status: (0, import_fields25.select)({
      type: "string",
      options: [
        { label: "Submitted", value: "submitted" },
        { label: "Under Review", value: "under-review" },
        { label: "Approved", value: "approved" },
        { label: "Declined", value: "declined" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "submitted",
      validation: { isRequired: true }
    }),
    lead: (0, import_fields25.relationship)({ ref: "Lead.financingApplications" }),
    vehicle: (0, import_fields25.relationship)({ ref: "Vehicle.financingApplications" }),
    applicantName: (0, import_fields25.text)({ access: privateRead, validation: { isRequired: true } }),
    applicantEmail: (0, import_fields25.text)({ access: privateRead, validation: { isRequired: true } }),
    applicantPhone: (0, import_fields25.text)({ access: privateRead, validation: { isRequired: true } }),
    employmentStatus: (0, import_fields25.text)({ access: privateRead, validation: { isRequired: true } }),
    annualIncomeCents: (0, import_fields25.integer)({ access: privateRead, validation: { isRequired: true, min: 1 } }),
    selfReportedCreditTier: (0, import_fields25.text)({ access: privateRead, validation: { isRequired: true } }),
    requestedAmountCents: (0, import_fields25.integer)({ validation: { min: 0 } }),
    plannedMonthlyPaymentCents: (0, import_fields25.integer)({ validation: { min: 0 } }),
    plannedDownPaymentCents: (0, import_fields25.integer)({ validation: { min: 0 } }),
    tradeInValueCents: (0, import_fields25.integer)({ validation: { min: 0 } }),
    aprBasisPoints: (0, import_fields25.integer)({ validation: { min: 0 } }),
    loanTermMonths: (0, import_fields25.integer)({ validation: { min: 0 } }),
    consentAt: (0, import_fields25.timestamp)({ validation: { isRequired: true } }),
    submittedAt: (0, import_fields25.timestamp)({ validation: { isRequired: true } }),
    lockedAt: (0, import_fields25.timestamp)({ validation: { isRequired: true } }),
    immutableSnapshot: (0, import_fields25.json)({
      access: privateRead,
      defaultValue: {},
      ui: { itemView: { fieldMode: "read" } }
    }),
    submissions: (0, import_fields25.relationship)({ ref: "LenderSubmission.application", many: true }),
    decisions: (0, import_fields25.relationship)({ ref: "LenderDecision.application", many: true })
  }
});

// features/keystone/models/LenderSubmission.ts
var import_core24 = require("@keystone-6/core");
var import_access35 = require("@keystone-6/core/access");
var import_fields26 = require("@keystone-6/core/fields");
var restricted = { read: permissions.canManageFinancing, create: () => false, update: () => false };
var LenderSubmission = (0, import_core24.list)({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [{ field: "application", listKey: "FinancingApplication" }])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["application", "providerKey", "status", "queuedAt", "submittedAt"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    application: (0, import_fields26.relationship)({ ref: "FinancingApplication.submissions" }),
    providerKey: (0, import_fields26.text)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields26.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      access: { read: import_access35.denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    }),
    status: (0, import_fields26.select)({
      type: "string",
      options: [
        { label: "Queued", value: "queued" },
        { label: "Submitted", value: "submitted" },
        { label: "Failed", value: "failed" }
      ],
      defaultValue: "queued",
      validation: { isRequired: true }
    }),
    externalReference: (0, import_fields26.text)({ db: { isNullable: true } }),
    requestSnapshot: (0, import_fields26.json)({ access: restricted, defaultValue: {}, ui: { itemView: { fieldMode: "read" } } }),
    responseSummary: (0, import_fields26.json)({ access: restricted, defaultValue: {}, ui: { itemView: { fieldMode: "read" } } }),
    errorCode: (0, import_fields26.text)({ db: { isNullable: true } }),
    queuedAt: (0, import_fields26.timestamp)({ validation: { isRequired: true } }),
    submittedAt: (0, import_fields26.timestamp)()
  }
});

// features/keystone/models/LenderDecision.ts
var import_core25 = require("@keystone-6/core");
var import_access37 = require("@keystone-6/core/access");
var import_fields27 = require("@keystone-6/core/fields");
var restricted2 = { read: permissions.canManageFinancing, create: () => false, update: () => false };
var LenderDecision = (0, import_core25.list)({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "application", listKey: "FinancingApplication" },
      { field: "submission", listKey: "LenderSubmission" },
      { field: "recordedBy", listKey: "User", kind: "user" }
    ])
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["application", "providerKey", "decision", "approvedAmountCents", "decidedAt"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    application: (0, import_fields27.relationship)({ ref: "FinancingApplication.decisions" }),
    submission: (0, import_fields27.relationship)({ ref: "LenderSubmission" }),
    idempotencyKey: (0, import_fields27.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      access: { read: import_access37.denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    }),
    providerKey: (0, import_fields27.text)({ validation: { isRequired: true } }),
    externalReference: (0, import_fields27.text)({ db: { isNullable: true } }),
    decision: (0, import_fields27.select)({
      type: "string",
      options: [
        { label: "Approved", value: "approved" },
        { label: "Declined", value: "declined" },
        { label: "Conditional", value: "conditional" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" }
      ],
      validation: { isRequired: true }
    }),
    approvedAmountCents: (0, import_fields27.integer)({ validation: { min: 0 } }),
    aprBasisPoints: (0, import_fields27.integer)({ validation: { min: 0 } }),
    termMonths: (0, import_fields27.integer)({ validation: { min: 0 } }),
    monthlyPaymentCents: (0, import_fields27.integer)({ validation: { min: 0 } }),
    reasonCodes: (0, import_fields27.json)({ access: restricted2, defaultValue: [] }),
    immutableSnapshot: (0, import_fields27.json)({ access: restricted2, defaultValue: {}, ui: { itemView: { fieldMode: "read" } } }),
    decidedAt: (0, import_fields27.timestamp)({ validation: { isRequired: true } }),
    recordedBy: (0, import_fields27.relationship)({ ref: "User" }),
    selectedForDeals: (0, import_fields27.relationship)({ ref: "Deal.selectedLenderDecision", many: true, access: restricted2 })
  }
});

// features/keystone/models/DealerGroup.ts
var import_core26 = require("@keystone-6/core");
var import_access39 = require("@keystone-6/core/access");
var import_fields28 = require("@keystone-6/core/fields");
var DealerGroup = (0, import_core26.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageDealerships,
      update: permissions.canManageDealerships,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || dealerGroupAccessFilter(session),
      update: ({ session }) => permissions.canManageDealerships({ session }) && dealerGroupAccessFilter(session)
    }
  },
  ui: { listView: { initialColumns: ["name", "slug", "status", "rooftops"] } },
  fields: {
    ...trackingFields,
    name: (0, import_fields28.text)({ validation: { isRequired: true, length: { min: 1, max: 200 } } }),
    slug: (0, import_fields28.text)({
      isIndexed: "unique",
      validation: { isRequired: true, length: { min: 2, max: 120 }, match: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ } }
    }),
    legalName: (0, import_fields28.text)({ validation: { length: { max: 240 } } }),
    status: (0, import_fields28.select)({
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    rooftops: (0, import_fields28.relationship)({ ref: "Rooftop.dealerGroup", many: true, access: { update: import_access39.denyAll } }),
    memberships: (0, import_fields28.relationship)({ ref: "DealerGroupMembership.dealerGroup", many: true, access: { update: import_access39.denyAll } }),
    membershipAuditEvents: (0, import_fields28.relationship)({ ref: "MembershipAuditEvent.dealerGroup", many: true, access: { update: import_access39.denyAll } })
  }
});

// features/keystone/models/Rooftop.ts
var import_core27 = require("@keystone-6/core");
var import_access41 = require("@keystone-6/core/access");
var import_fields29 = require("@keystone-6/core/fields");
var Rooftop = (0, import_core27.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageDealerships,
      update: permissions.canManageDealerships,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || rooftopAccessFilter(session),
      update: ({ session }) => permissions.canManageDealerships({ session }) && rooftopAccessFilter(session)
    },
    item: {
      create: async ({ session, inputData, context }) => {
        const dealerGroupId = getConnectedId(inputData.dealerGroup);
        if (!dealerGroupId || !session?.itemId) return false;
        return hasDealerGroupAccess(session, dealerGroupId) || permissions.canManageDealerships({ session });
      }
    }
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const dealerGroupId = getConnectedId(resolvedData.dealerGroup);
        const code = String(resolvedData.code || "").trim().toUpperCase();
        if (!dealerGroupId || !code) throw new Error("Dealer group and rooftop code are required");
        return { ...resolvedData, code, rooftopKey: membershipKey(dealerGroupId, code) };
      }
    }
  },
  ui: { listView: { initialColumns: ["code", "name", "dealerGroup", "status", "timezone"] } },
  fields: {
    ...trackingFields,
    rooftopKey: (0, import_fields29.text)({
      isIndexed: "unique",
      access: { read: permissions.canManageDealerships, create: import_access41.denyAll, update: import_access41.denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" }, listView: { fieldMode: "hidden" } }
    }),
    code: (0, import_fields29.text)({ validation: { isRequired: true, length: { min: 1, max: 40 } }, access: { update: import_access41.denyAll } }),
    name: (0, import_fields29.text)({ validation: { isRequired: true, length: { min: 1, max: 200 } } }),
    publicSlug: (0, import_fields29.text)({
      isIndexed: "unique",
      validation: { isRequired: true, length: { min: 2, max: 120 }, match: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ } }
    }),
    status: (0, import_fields29.select)({
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    timezone: (0, import_fields29.text)({ defaultValue: "America/New_York", validation: { isRequired: true } }),
    currencyCode: (0, import_fields29.text)({ defaultValue: "USD", validation: { isRequired: true, length: { min: 3, max: 3 } } }),
    dealerGroup: (0, import_fields29.relationship)({ ref: "DealerGroup.rooftops", access: { update: import_access41.denyAll } }),
    memberships: (0, import_fields29.relationship)({ ref: "RooftopMembership.rooftop", many: true, access: { update: import_access41.denyAll } }),
    membershipAuditEvents: (0, import_fields29.relationship)({ ref: "MembershipAuditEvent.rooftop", many: true, access: { update: import_access41.denyAll } })
  }
});

// features/keystone/models/DealerGroupMembership.ts
var import_core28 = require("@keystone-6/core");
var import_access43 = require("@keystone-6/core/access");
var import_fields30 = require("@keystone-6/core/fields");
var DealerGroupMembership = (0, import_core28.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || { user: { id: { equals: session?.itemId } } },
      update: ({ session }) => ({ dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: "active" }, accessAllRooftops: { equals: true } } } } }),
      delete: ({ session }) => ({ dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: "active" }, accessAllRooftops: { equals: true } } } } })
    },
    item: {
      create: async ({ session, inputData }) => {
        const dealerGroupId = getConnectedId(inputData.dealerGroup);
        return Boolean(dealerGroupId && session?.itemId && (permissions.canManageDealerships({ session }) || hasDealerGroupAccess(session, dealerGroupId)));
      }
    }
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const dealerGroupId = getConnectedId(resolvedData.dealerGroup);
        const userId = getConnectedId(resolvedData.user);
        if (!dealerGroupId || !userId) throw new Error("Dealer group and user are required");
        return { ...resolvedData, membershipKey: membershipKey(dealerGroupId, userId) };
      }
    }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["user", "dealerGroup", "role", "status", "accessAllRooftops"] } },
  fields: {
    ...trackingFields,
    membershipKey: (0, import_fields30.text)({
      isIndexed: "unique",
      access: { read: permissions.canManageDealerships, create: import_access43.denyAll, update: import_access43.denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" }, listView: { fieldMode: "hidden" } }
    }),
    user: (0, import_fields30.relationship)({ ref: "User.dealerGroupMemberships", access: { update: import_access43.denyAll } }),
    dealerGroup: (0, import_fields30.relationship)({ ref: "DealerGroup.memberships", access: { update: import_access43.denyAll } }),
    role: (0, import_fields30.relationship)({ ref: "Role.dealerGroupMemberships", access: { update: import_access43.denyAll } }),
    status: (0, import_fields30.select)({
      access: { update: import_access43.denyAll },
      type: "string",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    accessAllRooftops: (0, import_fields30.checkbox)({ defaultValue: false, access: { update: import_access43.denyAll } }),
    invitedBy: (0, import_fields30.relationship)({ ref: "User" }),
    joinedAt: (0, import_fields30.timestamp)()
  }
});

// features/keystone/models/RooftopMembership.ts
var import_core29 = require("@keystone-6/core");
var import_access45 = require("@keystone-6/core/access");
var import_fields31 = require("@keystone-6/core/fields");
var RooftopMembership = (0, import_core29.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageDealerships({ session }) || { user: { id: { equals: session?.itemId } } },
      update: ({ session }) => ({ rooftop: { dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: "active" }, accessAllRooftops: { equals: true } } } } } }),
      delete: ({ session }) => ({ rooftop: { dealerGroup: { memberships: { some: { user: { id: { equals: session?.itemId } }, status: { equals: "active" }, accessAllRooftops: { equals: true } } } } } })
    },
    item: {
      create: async ({ session, inputData, context }) => {
        const rooftopId = getConnectedId(inputData.rooftop);
        if (!rooftopId || !session?.itemId) return false;
        if (permissions.canManageDealerships({ session })) return true;
        const rooftop = await context.sudo().query.Rooftop.findOne({ where: { id: rooftopId }, query: "id dealerGroup { id }" });
        return Boolean(rooftop?.dealerGroup?.id && hasRooftopAccess(session, rooftop.dealerGroup.id, rooftopId));
      }
    }
  },
  hooks: {
    resolveInput: {
      create: ({ resolvedData }) => {
        const rooftopId = getConnectedId(resolvedData.rooftop);
        const userId = getConnectedId(resolvedData.user);
        if (!rooftopId || !userId) throw new Error("Rooftop and user are required");
        return { ...resolvedData, membershipKey: membershipKey(rooftopId, userId) };
      }
    }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["user", "rooftop", "role", "status"] } },
  fields: {
    ...trackingFields,
    membershipKey: (0, import_fields31.text)({
      isIndexed: "unique",
      access: { read: permissions.canManageDealerships, create: import_access45.denyAll, update: import_access45.denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" }, listView: { fieldMode: "hidden" } }
    }),
    user: (0, import_fields31.relationship)({ ref: "User.rooftopMemberships", access: { update: import_access45.denyAll } }),
    rooftop: (0, import_fields31.relationship)({ ref: "Rooftop.memberships", access: { update: import_access45.denyAll } }),
    role: (0, import_fields31.relationship)({ ref: "Role.rooftopMemberships", access: { update: import_access45.denyAll } }),
    status: (0, import_fields31.select)({
      access: { update: import_access45.denyAll },
      type: "string",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    invitedBy: (0, import_fields31.relationship)({ ref: "User" }),
    joinedAt: (0, import_fields31.timestamp)()
  }
});

// features/keystone/models/MembershipAuditEvent.ts
var import_core30 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var MembershipAuditEvent = (0, import_core30.list)({
  access: {
    operation: {
      query: permissions.canManageDealerships,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "scopeType", "action", "targetUser", "actor", "reason"] }
  },
  fields: {
    ...trackingFields,
    scopeType: (0, import_fields32.select)({
      type: "string",
      options: [
        { label: "Dealer Group", value: "dealer-group" },
        { label: "Rooftop", value: "rooftop" }
      ],
      validation: { isRequired: true }
    }),
    action: (0, import_fields32.select)({
      type: "string",
      options: [
        { label: "Created", value: "created" },
        { label: "Updated", value: "updated" },
        { label: "Onboarding Bootstrap", value: "onboarding-bootstrap" }
      ],
      validation: { isRequired: true }
    }),
    dealerGroup: (0, import_fields32.relationship)({ ref: "DealerGroup.membershipAuditEvents" }),
    rooftop: (0, import_fields32.relationship)({ ref: "Rooftop.membershipAuditEvents" }),
    targetUser: (0, import_fields32.relationship)({ ref: "User.membershipAuditEvents" }),
    actor: (0, import_fields32.relationship)({ ref: "User.performedMembershipAuditEvents" }),
    membershipId: (0, import_fields32.text)({ validation: { isRequired: true } }),
    previousSnapshot: (0, import_fields32.json)({ defaultValue: null }),
    nextSnapshot: (0, import_fields32.json)({ defaultValue: {} }),
    reason: (0, import_fields32.text)({ validation: { isRequired: true, length: { min: 1, max: 500 } } }),
    occurredAt: (0, import_fields32.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } })
  }
});

// features/keystone/models/InventoryAcquisition.ts
var import_core31 = require("@keystone-6/core");
var import_access48 = require("@keystone-6/core/access");
var import_fields33 = require("@keystone-6/core/fields");
var InventoryAcquisition = (0, import_core31.list)({
  access: {
    operation: {
      query: permissions.canManageInventory,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    labelField: "reference",
    listView: { initialColumns: ["reference", "status", "vin", "vehicle", "acquisitionSource", "updatedAt"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    reference: (0, import_fields33.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    idempotencyKey: (0, import_fields33.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      access: { read: import_access48.denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    }),
    status: (0, import_fields33.select)({
      type: "string",
      options: [
        { label: "Appraised", value: "appraised" },
        { label: "Approved", value: "approved" },
        { label: "Purchased", value: "purchased" },
        { label: "Arrived", value: "arrived" },
        { label: "Reconditioning", value: "reconditioning" },
        { label: "Frontline Ready", value: "frontline" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "appraised",
      validation: { isRequired: true }
    }),
    acquisitionSource: (0, import_fields33.select)({
      type: "string",
      options: [
        { label: "Trade-in", value: "trade-in" },
        { label: "Auction", value: "auction" },
        { label: "Wholesale", value: "wholesale" },
        { label: "Consumer Purchase", value: "consumer-purchase" },
        { label: "OEM / Distributor", value: "oem-distributor" },
        { label: "Dealer Transfer", value: "dealer-transfer" }
      ],
      validation: { isRequired: true }
    }),
    sourceReference: (0, import_fields33.text)({ validation: { length: { max: 200 } } }),
    vin: (0, import_fields33.text)({ validation: { isRequired: true, length: { min: 17, max: 17 } } }),
    year: (0, import_fields33.integer)({ validation: { isRequired: true, min: 1900, max: 2200 } }),
    make: (0, import_fields33.text)({ validation: { isRequired: true } }),
    model: (0, import_fields33.text)({ validation: { isRequired: true } }),
    odometer: (0, import_fields33.integer)({ validation: { min: 0 } }),
    appraisalCents: (0, import_fields33.integer)({ validation: { isRequired: true, min: 0 } }),
    purchaseCents: (0, import_fields33.integer)({ validation: { min: 0 } }),
    reconEstimateCents: (0, import_fields33.integer)({ validation: { min: 0 } }),
    vehicle: (0, import_fields33.relationship)({ ref: "Vehicle.acquisition", access: { update: import_access48.denyAll } }),
    immutablePurchaseSnapshot: (0, import_fields33.json)({ defaultValue: null, access: { create: () => false, update: () => false } }),
    purchasedAt: (0, import_fields33.timestamp)(),
    arrivedAt: (0, import_fields33.timestamp)(),
    frontlineAt: (0, import_fields33.timestamp)(),
    requestedBy: (0, import_fields33.relationship)({ ref: "User" }),
    lastTransitionedBy: (0, import_fields33.relationship)({ ref: "User" }),
    stock: (0, import_fields33.relationship)({ ref: "InventoryStock.acquisition", access: { update: import_access48.denyAll } }),
    events: (0, import_fields33.relationship)({ ref: "InventoryAcquisitionEvent.acquisition", many: true })
  }
});

// features/keystone/models/InventoryAcquisitionEvent.ts
var import_core32 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var InventoryAcquisitionEvent = (0, import_core32.list)({
  access: {
    operation: {
      query: permissions.canManageInventory,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "acquisition", "fromStatus", "toStatus", "actor", "reason"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    acquisition: (0, import_fields34.relationship)({
      ref: "InventoryAcquisition.events",
      db: {
        extendPrismaSchema: (field) => field.replace(/acquisition InventoryAcquisition\?/g, "acquisition InventoryAcquisition").replace(/acquisitionId String\?/g, "acquisitionId String")
      }
    }),
    fromStatus: (0, import_fields34.text)(),
    toStatus: (0, import_fields34.text)({ validation: { isRequired: true } }),
    reason: (0, import_fields34.text)({ validation: { isRequired: true, length: { min: 1, max: 500 } } }),
    evidence: (0, import_fields34.json)({ defaultValue: {} }),
    actor: (0, import_fields34.relationship)({ ref: "User" }),
    occurredAt: (0, import_fields34.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } })
  }
});

// features/keystone/models/DomainAuditEvent.ts
var import_core33 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var DomainAuditEvent = (0, import_core33.list)({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "aggregateType", "aggregateId", "action", "actor"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    eventKey: (0, import_fields35.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    requestHash: (0, import_fields35.text)({ validation: { isRequired: true }, access: { create: () => false, update: () => false } }),
    aggregateType: (0, import_fields35.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields35.text)({ validation: { isRequired: true }, isIndexed: true }),
    action: (0, import_fields35.text)({ validation: { isRequired: true } }),
    beforeSnapshot: (0, import_fields35.json)({ defaultValue: null }),
    afterSnapshot: (0, import_fields35.json)({ defaultValue: null }),
    metadata: (0, import_fields35.json)({ defaultValue: {} }),
    actor: (0, import_fields35.relationship)({ ref: "User.domainAuditEvents" }),
    occurredAt: (0, import_fields35.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, isIndexed: true })
  }
});

// features/keystone/models/DomainOutboxEvent.ts
var import_core34 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
var DomainOutboxEvent = (0, import_core34.list)({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["topic", "aggregateType", "aggregateId", "status", "availableAt", "attemptCount"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deliveryKey: (0, import_fields36.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    topic: (0, import_fields36.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateType: (0, import_fields36.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields36.text)({ validation: { isRequired: true } }),
    payload: (0, import_fields36.json)({ defaultValue: {} }),
    status: (0, import_fields36.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
      isIndexed: true
    }),
    attemptCount: (0, import_fields36.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    availableAt: (0, import_fields36.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, isIndexed: true }),
    processedAt: (0, import_fields36.timestamp)(),
    lastError: (0, import_fields36.text)({ db: { isNullable: true } })
  }
});

// features/keystone/models/InventoryStock.ts
var import_core35 = require("@keystone-6/core");
var import_access53 = require("@keystone-6/core/access");
var import_fields37 = require("@keystone-6/core/fields");
var InventoryStock = (0, import_core35.list)({
  access: {
    operation: { query: permissions.canViewInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, ["canViewInventory", "canManageInventory"]) }
  },
  ui: { hideCreate: true, hideDelete: true, labelField: "stockNumber", listView: { initialColumns: ["stockNumber", "vehicle", "locationCode", "reconStatus", "merchandisingStatus", "stockedAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    vehicle: (0, import_fields37.relationship)({
      ref: "Vehicle.inventoryStock",
      access: { update: import_access53.denyAll },
      db: { extendPrismaSchema: (field) => field.replace(/vehicle Vehicle\?/g, "vehicle Vehicle").replace(/vehicleId String\?/g, "vehicleId String") }
    }),
    acquisition: (0, import_fields37.relationship)({ ref: "InventoryAcquisition.stock", access: { update: import_access53.denyAll } }),
    stockNumber: (0, import_fields37.text)({ validation: { isRequired: true } }),
    stockKey: (0, import_fields37.text)({ validation: { isRequired: true }, isIndexed: "unique", access: { read: import_access53.denyAll, create: import_access53.denyAll, update: import_access53.denyAll }, ui: { itemView: { fieldMode: "hidden" } } }),
    locationCode: (0, import_fields37.text)({ validation: { isRequired: true } }),
    locationLabel: (0, import_fields37.text)(),
    stockedAt: (0, import_fields37.timestamp)({ validation: { isRequired: true } }),
    frontlineAt: (0, import_fields37.timestamp)(),
    purchaseCostCents: (0, import_fields37.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    reconCostCents: (0, import_fields37.integer)({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    otherCostCents: (0, import_fields37.integer)({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    totalCostCents: (0, import_fields37.integer)({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    reconStatus: (0, import_fields37.select)({ type: "string", options: ["not-started", "in-progress", "completed"].map((value) => ({ label: value, value })), defaultValue: "not-started" }),
    merchandisingStatus: (0, import_fields37.select)({ type: "string", options: ["draft", "submitted", "approved", "rejected"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    approvedRevisionHash: (0, import_fields37.text)({ defaultValue: "", access: { create: import_access53.denyAll, update: import_access53.denyAll, read: permissions.canViewInventory }, label: "Approved marketing revision", ui: { itemView: { fieldMode: "read" } } }),
    feedStatus: (0, import_fields37.select)({ type: "string", options: ["not-published", "succeeded", "partial", "failed"].map((value) => ({ label: value, value })), defaultValue: "not-published" }),
    events: (0, import_fields37.relationship)({ ref: "InventoryStockEvent.stock", many: true }),
    reconWorkItems: (0, import_fields37.relationship)({ ref: "InventoryReconWorkItem.stock", many: true }),
    merchandisingVersions: (0, import_fields37.relationship)({ ref: "InventoryMerchandisingVersion.stock", many: true })
  }
});

// features/keystone/models/InventoryStockEvent.ts
var import_core36 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var InventoryStockEvent = (0, import_core36.list)({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, ["canViewInventory", "canManageInventory"]) }
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["occurredAt", "stock", "eventType", "reason", "actor"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: (0, import_fields38.relationship)({ ref: "InventoryStock.events", db: { extendPrismaSchema: (field) => field.replace(/stock InventoryStock\?/g, "stock InventoryStock").replace(/stockId String\?/g, "stockId String") } }),
    eventKey: (0, import_fields38.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    eventType: (0, import_fields38.text)({ validation: { isRequired: true }, isIndexed: true }),
    reason: (0, import_fields38.text)({ validation: { isRequired: true, length: { max: 500 } } }),
    amountCents: (0, import_fields38.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    evidence: (0, import_fields38.json)({ defaultValue: {} }),
    actor: (0, import_fields38.relationship)({ ref: "User" }),
    occurredAt: (0, import_fields38.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, isIndexed: true })
  }
});

// features/keystone/models/InventoryReconWorkItem.ts
var import_core37 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var InventoryReconWorkItem = (0, import_core37.list)({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["title", "stock", "status", "assignedTo", "dueAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: (0, import_fields39.relationship)({ ref: "InventoryStock.reconWorkItems", db: { extendPrismaSchema: (field) => field.replace(/stock InventoryStock\?/g, "stock InventoryStock").replace(/stockId String\?/g, "stockId String") } }),
    title: (0, import_fields39.text)({ validation: { isRequired: true, length: { max: 200 } } }),
    category: (0, import_fields39.select)({ type: "string", options: ["mechanical", "body", "detail", "tires", "inspection", "other"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    status: (0, import_fields39.select)({ type: "string", options: ["open", "in-progress", "completed", "cancelled"].map((value) => ({ label: value, value })), defaultValue: "open" }),
    estimatedCostCents: (0, import_fields39.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    actualCostCents: (0, import_fields39.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    vendorName: (0, import_fields39.text)({ validation: { length: { max: 200 } } }),
    assignedTo: (0, import_fields39.relationship)({ ref: "User" }),
    dueAt: (0, import_fields39.timestamp)(),
    completedAt: (0, import_fields39.timestamp)()
  }
});

// features/keystone/models/InventoryMerchandisingVersion.ts
var import_core38 = require("@keystone-6/core");
var import_fields40 = require("@keystone-6/core/fields");
var InventoryMerchandisingVersion = (0, import_core38.list)({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["stock", "version", "status", "submittedAt", "decidedAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: (0, import_fields40.relationship)({ ref: "InventoryStock.merchandisingVersions", db: { extendPrismaSchema: (field) => field.replace(/stock InventoryStock\?/g, "stock InventoryStock").replace(/stockId String\?/g, "stockId String") } }),
    version: (0, import_fields40.integer)({ validation: { isRequired: true, min: 1 } }),
    versionKey: (0, import_fields40.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: (0, import_fields40.select)({ type: "string", options: ["submitted", "approved", "rejected"].map((value) => ({ label: value, value })), defaultValue: "submitted" }),
    snapshot: (0, import_fields40.json)({ defaultValue: {} }),
    submittedBy: (0, import_fields40.relationship)({ ref: "User" }),
    submittedAt: (0, import_fields40.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    decidedBy: (0, import_fields40.relationship)({ ref: "User" }),
    decidedAt: (0, import_fields40.timestamp)(),
    decisionReason: (0, import_fields40.text)({ validation: { length: { max: 500 } } })
  }
});

// features/keystone/models/InventoryFeedRun.ts
var import_core39 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");
var InventoryFeedRun = (0, import_core39.list)({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["channelKey", "status", "attemptedCount", "succeededCount", "failedCount", "completedAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    runKey: (0, import_fields41.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    channelKey: (0, import_fields41.text)({ validation: { isRequired: true }, isIndexed: true }),
    status: (0, import_fields41.select)({ type: "string", options: ["succeeded", "partial", "failed"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    attemptedCount: (0, import_fields41.integer)({ validation: { isRequired: true, min: 0 } }),
    succeededCount: (0, import_fields41.integer)({ validation: { isRequired: true, min: 0 } }),
    failedCount: (0, import_fields41.integer)({ validation: { isRequired: true, min: 0 } }),
    requestSnapshot: (0, import_fields41.json)({ defaultValue: {} }),
    responseSummary: (0, import_fields41.json)({ defaultValue: {} }),
    startedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    recordedBy: (0, import_fields41.relationship)({ ref: "User" }),
    errors: (0, import_fields41.relationship)({ ref: "InventoryFeedError.run", many: true })
  }
});

// features/keystone/models/InventoryFeedError.ts
var import_core40 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");
var InventoryFeedError = (0, import_core40.list)({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canManageInventory") }
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["run", "errorCode", "rowReference", "message"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    run: (0, import_fields42.relationship)({ ref: "InventoryFeedRun.errors", db: { extendPrismaSchema: (field) => field.replace(/run InventoryFeedRun\?/g, "run InventoryFeedRun").replace(/runId String\?/g, "runId String") } }),
    stock: (0, import_fields42.relationship)({ ref: "InventoryStock" }),
    errorCode: (0, import_fields42.text)({ validation: { isRequired: true } }),
    message: (0, import_fields42.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    rowReference: (0, import_fields42.text)({ validation: { length: { max: 200 } } }),
    evidence: (0, import_fields42.json)({ defaultValue: {} })
  }
});

// features/keystone/models/Customer.ts
var import_core41 = require("@keystone-6/core");
var import_access60 = require("@keystone-6/core/access");
var import_fields43 = require("@keystone-6/core/fields");
var Customer = (0, import_core41.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadCustomers,
      update: rules.canReadCustomers,
      delete: rules.canReadCustomers
    }
  },
  ui: {
    hideCreate: true,
    listView: { initialColumns: ["firstName", "lastName", "primaryEmail", "primaryPhone", "status", "updatedAt"] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    firstName: (0, import_fields43.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields43.text)({ validation: { isRequired: true } }),
    primaryEmail: (0, import_fields43.text)(),
    primaryPhone: (0, import_fields43.text)(),
    normalizedEmail: (0, import_fields43.text)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, isIndexed: true }),
    normalizedPhone: (0, import_fields43.text)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, isIndexed: true }),
    identityKey: (0, import_fields43.text)({ access: { read: import_access60.denyAll, create: import_access60.denyAll, update: import_access60.denyAll }, isIndexed: "unique", validation: { isRequired: true } }),
    status: (0, import_fields43.select)({
      access: { create: import_access60.denyAll, update: import_access60.denyAll },
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Merged", value: "merged" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    emailConsent: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    smsConsent: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    phoneConsent: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    emailSuppressed: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    smsSuppressed: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    phoneSuppressed: (0, import_fields43.checkbox)({ access: { create: import_access60.denyAll, update: import_access60.denyAll }, defaultValue: false }),
    preferredChannel: (0, import_fields43.select)({
      access: { create: import_access60.denyAll, update: import_access60.denyAll },
      type: "string",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Phone", value: "phone" },
        { label: "No outbound contact", value: "none" }
      ],
      defaultValue: "none",
      validation: { isRequired: true }
    }),
    contactPreferenceUpdatedAt: (0, import_fields43.timestamp)({ access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    suppressionReason: (0, import_fields43.text)({ access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    suppressionSource: (0, import_fields43.text)({ access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    household: (0, import_fields43.relationship)({ ref: "CustomerHousehold.members", access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    contactPreferenceEvents: (0, import_fields43.relationship)({ ref: "CustomerContactPreferenceEvent.customer", many: true, access: { update: import_access60.denyAll } }),
    salesVisits: (0, import_fields43.relationship)({ ref: "SalesVisit.customer", many: true, access: { update: import_access60.denyAll } }),
    mergedAt: (0, import_fields43.timestamp)({ access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    mergedInto: (0, import_fields43.relationship)({ ref: "Customer.mergedCustomers", access: { create: import_access60.denyAll, update: import_access60.denyAll } }),
    mergedCustomers: (0, import_fields43.relationship)({ ref: "Customer.mergedInto", many: true, access: { update: import_access60.denyAll } }),
    leads: (0, import_fields43.relationship)({ ref: "Lead.customer", many: true, access: { update: import_access60.denyAll } }),
    mergeEventsAsSurvivor: (0, import_fields43.relationship)({ ref: "CustomerMergeEvent.survivor", many: true, access: { update: import_access60.denyAll } }),
    mergeEventsAsDuplicate: (0, import_fields43.relationship)({ ref: "CustomerMergeEvent.duplicate", many: true, access: { update: import_access60.denyAll } })
  }
});

// features/keystone/models/CustomerMergeEvent.ts
var import_core42 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");
var CustomerMergeEvent = (0, import_core42.list)({
  access: {
    operation: {
      query: permissions.canManageLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadOperations,
      update: rules.canReadLeadOperations,
      delete: rules.canReadLeadOperations
    }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    survivor: (0, import_fields44.relationship)({ ref: "Customer.mergeEventsAsSurvivor", db: { extendPrismaSchema: (field) => field.replace(/survivor Customer\?/g, "survivor Customer").replace(/survivorId String\?/g, "survivorId String") } }),
    duplicate: (0, import_fields44.relationship)({ ref: "Customer.mergeEventsAsDuplicate", db: { extendPrismaSchema: (field) => field.replace(/duplicate Customer\?/g, "duplicate Customer").replace(/duplicateId String\?/g, "duplicateId String") } }),
    actor: (0, import_fields44.relationship)({ ref: "User.customerMergeEvents", db: { extendPrismaSchema: (field) => field.replace(/actor User\?/g, "actor User").replace(/actorId String\?/g, "actorId String") } }),
    reason: (0, import_fields44.text)({ validation: { isRequired: true } }),
    mergedAt: (0, import_fields44.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    movedLeadIds: (0, import_fields44.json)({ defaultValue: [] }),
    evidenceSnapshot: (0, import_fields44.json)({ defaultValue: {} })
  }
});

// features/keystone/models/LeadAssignmentEvent.ts
var import_core43 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");
var LeadAssignmentEvent = (0, import_core43.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadOperations,
      update: rules.canReadLeadOperations,
      delete: rules.canReadLeadOperations
    }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    lead: (0, import_fields45.relationship)({ ref: "Lead.assignmentEvents", db: { extendPrismaSchema: (field) => field.replace(/lead Lead\?/g, "lead Lead").replace(/leadId String\?/g, "leadId String") } }),
    fromUser: (0, import_fields45.relationship)({ ref: "User.leadAssignmentsFrom" }),
    toUser: (0, import_fields45.relationship)({ ref: "User.leadAssignmentsTo", db: { extendPrismaSchema: (field) => field.replace(/toUser User\?/g, "toUser User").replace(/toUserId String\?/g, "toUserId String") } }),
    actor: (0, import_fields45.relationship)({ ref: "User.performedLeadAssignments", db: { extendPrismaSchema: (field) => field.replace(/actor User\?/g, "actor User").replace(/actorId String\?/g, "actorId String") } }),
    reason: (0, import_fields45.text)({ validation: { isRequired: true } }),
    routeKey: (0, import_fields45.text)(),
    assignedAt: (0, import_fields45.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    firstResponseDueAt: (0, import_fields45.timestamp)()
  }
});

// features/keystone/models/LeadRoutingRule.ts
var import_core44 = require("@keystone-6/core");
var import_fields46 = require("@keystone-6/core/fields");
var LeadRoutingRule = (0, import_core44.list)({
  access: {
    operation: {
      query: permissions.canManageLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadOperations,
      update: rules.canReadLeadOperations,
      delete: rules.canReadLeadOperations
    }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    name: (0, import_fields46.text)({ validation: { isRequired: true } }),
    routeKey: (0, import_fields46.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    active: (0, import_fields46.checkbox)({ defaultValue: true }),
    priority: (0, import_fields46.integer)({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 1e4 } }),
    source: (0, import_fields46.select)({
      type: "string",
      options: [
        { label: "Any source", value: "any" },
        { label: "Walk-In", value: "walk-in" },
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Referral", value: "referral" },
        { label: "Advertisement", value: "ad" },
        { label: "Social Media", value: "social" },
        { label: "Third Party", value: "third-party" }
      ],
      defaultValue: "any",
      validation: { isRequired: true }
    }),
    assignee: (0, import_fields46.relationship)({ ref: "User.leadRoutingRules", db: { extendPrismaSchema: (field) => field.replace(/assignee User\?/g, "assignee User").replace(/assigneeId String\?/g, "assigneeId String") } }),
    firstResponseMinutes: (0, import_fields46.integer)({ defaultValue: 30, validation: { isRequired: true, min: 1, max: 10080 } })
  }
});

// features/keystone/models/CustomerContactPreferenceEvent.ts
var import_core45 = require("@keystone-6/core");
var import_fields47 = require("@keystone-6/core/fields");
var CustomerContactPreferenceEvent = (0, import_core45.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadCustomers, update: rules.canReadCustomers, delete: rules.canReadCustomers }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    customer: (0, import_fields47.relationship)({
      ref: "Customer.contactPreferenceEvents",
      db: { extendPrismaSchema: (field) => field.replace(/customer Customer\?/g, "customer Customer").replace(/customerId String\?/g, "customerId String") }
    }),
    actor: (0, import_fields47.relationship)({
      ref: "User.customerContactPreferenceEvents",
      db: { extendPrismaSchema: (field) => field.replace(/actor User\?/g, "actor User").replace(/actorId String\?/g, "actorId String") }
    }),
    source: (0, import_fields47.text)({ validation: { isRequired: true } }),
    reason: (0, import_fields47.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields47.timestamp)({ validation: { isRequired: true } }),
    preferenceSnapshot: (0, import_fields47.json)({ defaultValue: {} })
  }
});

// features/keystone/models/CustomerHousehold.ts
var import_core46 = require("@keystone-6/core");
var import_fields48 = require("@keystone-6/core/fields");
var CustomerHousehold = (0, import_core46.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadCustomers, update: rules.canReadCustomers, delete: rules.canReadCustomers }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    householdKey: (0, import_fields48.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    displayName: (0, import_fields48.text)({ validation: { isRequired: true } }),
    members: (0, import_fields48.relationship)({ ref: "Customer.household", many: true })
  }
});

// features/keystone/models/SalesVisit.ts
var import_core47 = require("@keystone-6/core");
var import_fields49 = require("@keystone-6/core/fields");
var SalesVisit = (0, import_core47.list)({
  access: {
    operation: {
      query: permissions.canAccessLeads,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadLeadChildren, update: rules.canReadLeadChildren, delete: rules.canReadLeadChildren }
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    lead: (0, import_fields49.relationship)({
      ref: "Lead.salesVisits",
      db: { extendPrismaSchema: (field) => field.replace(/lead Lead\?/g, "lead Lead").replace(/leadId String\?/g, "leadId String") }
    }),
    customer: (0, import_fields49.relationship)({
      ref: "Customer.salesVisits",
      db: { extendPrismaSchema: (field) => field.replace(/customer Customer\?/g, "customer Customer").replace(/customerId String\?/g, "customerId String") }
    }),
    vehicle: (0, import_fields49.relationship)({ ref: "Vehicle.salesVisits" }),
    assignedSalesperson: (0, import_fields49.relationship)({
      ref: "User.assignedSalesVisits",
      db: { extendPrismaSchema: (field) => field.replace(/assignedSalesperson User\?/g, "assignedSalesperson User").replace(/assignedSalespersonId String\?/g, "assignedSalespersonId String") }
    }),
    manager: (0, import_fields49.relationship)({ ref: "User.managedSalesVisits" }),
    kind: (0, import_fields49.select)({
      type: "string",
      options: [
        { label: "Sales appointment", value: "appointment" },
        { label: "Showroom visit", value: "showroom" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields49.select)({
      type: "string",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Arrived", value: "arrived" },
        { label: "Manager turn", value: "manager-turn" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No show", value: "no-show" }
      ],
      validation: { isRequired: true }
    }),
    scheduledAt: (0, import_fields49.timestamp)(),
    arrivedAt: (0, import_fields49.timestamp)(),
    managerTurnAt: (0, import_fields49.timestamp)(),
    completedAt: (0, import_fields49.timestamp)(),
    outcome: (0, import_fields49.text)(),
    notes: (0, import_fields49.text)({ ui: { displayMode: "textarea" } })
  }
});

// features/keystone/models/FinanceProduct.ts
var import_core48 = require("@keystone-6/core");
var import_fields50 = require("@keystone-6/core/fields");
var FinanceProduct = (0, import_core48.list)({
  db: prismaModelDirectives('@@unique([rooftopId, code], map: "FinanceProduct_rooftop_code_key")'),
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["code", "name", "category", "providerKey", "active"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    code: (0, import_fields50.text)({ validation: { isRequired: true } }),
    name: (0, import_fields50.text)({ validation: { isRequired: true } }),
    category: (0, import_fields50.select)({ type: "string", options: ["service-contract", "gap", "maintenance", "appearance", "tire-wheel", "other"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    providerKey: (0, import_fields50.text)({ validation: { isRequired: true } }),
    active: (0, import_fields50.checkbox)({ defaultValue: true }),
    quotes: (0, import_fields50.relationship)({ ref: "FinanceProductQuote.product", many: true }),
    retailPriceCents: (0, import_fields50.integer)({ validation: { isRequired: true, min: 0 } }),
    costCents: (0, import_fields50.integer)({ validation: { isRequired: true, min: 0 }, access: { read: permissions.canViewDealerCost, create: () => false, update: () => false } })
  }
});

// features/keystone/models/FinanceMenuVersion.ts
var import_core49 = require("@keystone-6/core");
var import_fields51 = require("@keystone-6/core/fields");
var FinanceMenuVersion = (0, import_core49.list)({
  db: prismaModelDirectives('@@unique([dealId, version], map: "FinanceMenuVersion_deal_version_key")'),
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }]) },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["deal", "version", "status", "presentedAt", "decidedAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: (0, import_fields51.relationship)({ ref: "Deal.financeMenuVersions", db: requiredRelationshipDb("deal") }),
    version: (0, import_fields51.integer)({ validation: { isRequired: true, min: 1 } }),
    status: (0, import_fields51.select)({ type: "string", options: ["presented", "accepted", "declined", "superseded"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    optionsSnapshot: (0, import_fields51.json)({ defaultValue: [] }),
    selectedProductCodes: (0, import_fields51.json)({ defaultValue: [] }),
    declinedProductCodes: (0, import_fields51.json)({ defaultValue: [] }),
    disclosureAcknowledgment: (0, import_fields51.text)(),
    presentedAt: (0, import_fields51.timestamp)({ validation: { isRequired: true } }),
    decidedAt: (0, import_fields51.timestamp)(),
    cancellations: (0, import_fields51.relationship)({ ref: "FinanceProductCancellation.menu", many: true }),
    idempotencyKey: (0, import_fields51.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/FinanceComplianceCheck.ts
var import_core50 = require("@keystone-6/core");
var import_fields52 = require("@keystone-6/core/fields");
var FinanceComplianceCheck = (0, import_core50.list)({
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }]) },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["deal", "checkType", "status", "providerKey", "requestedAt", "completedAt"] } },
  fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields52.relationship)({ ref: "Deal.financeComplianceChecks", db: requiredRelationshipDb("deal") }), checkType: (0, import_fields52.select)({ type: "string", options: ["identity", "ofac", "red-flag", "privacy"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), providerKey: (0, import_fields52.text)({ validation: { isRequired: true } }), status: (0, import_fields52.select)({ type: "string", options: ["requested", "completed", "failed", "manual-review"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), resultCode: (0, import_fields52.text)(), requestSnapshot: (0, import_fields52.json)({ defaultValue: {} }), resultSnapshot: (0, import_fields52.json)({ defaultValue: {} }), requestedAt: (0, import_fields52.timestamp)({ validation: { isRequired: true } }), completedAt: (0, import_fields52.timestamp)(), idempotencyKey: (0, import_fields52.text)({ validation: { isRequired: true }, isIndexed: "unique" }) }
});

// features/keystone/models/FinanceContractPackage.ts
var import_core51 = require("@keystone-6/core");
var import_fields53 = require("@keystone-6/core/fields");
var FinanceContractPackage = (0, import_core51.list)({
  db: prismaModelDirectives('@@unique([dealId], map: "FinanceContractPackage_deal_key")'),
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }]) },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["deal", "status", "providerKey", "envelopeReference", "updatedAt"] } },
  fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields53.relationship)({ ref: "Deal.financeContractPackages", db: requiredRelationshipDb("deal") }), status: (0, import_fields53.select)({ type: "string", options: ["preparing", "ready", "awaiting-external-handoff", "sent", "viewed", "signed", "declined", "void"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), providerKey: (0, import_fields53.text)({ validation: { isRequired: true } }), envelopeReference: (0, import_fields53.text)(), requiredDocuments: (0, import_fields53.json)({ defaultValue: [] }), documentChecklist: (0, import_fields53.json)({ defaultValue: [] }), immutableStatusEvidence: (0, import_fields53.json)({ defaultValue: {} }), sentAt: (0, import_fields53.timestamp)(), signedAt: (0, import_fields53.timestamp)(), lastWebhookAt: (0, import_fields53.timestamp)(), idempotencyKey: (0, import_fields53.text)({ validation: { isRequired: true }, isIndexed: "unique" }) }
});

// features/keystone/models/FinanceFundingCase.ts
var import_core52 = require("@keystone-6/core");
var import_fields54 = require("@keystone-6/core/fields");
var FinanceFundingCase = (0, import_core52.list)({
  db: prismaModelDirectives('@@unique([dealId], map: "FinanceFundingCase_deal_key")'),
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }]) },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["deal", "status", "fundingReference", "fundedAt", "updatedAt"] } },
  fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields54.relationship)({ ref: "Deal.financeFundingCases", db: requiredRelationshipDb("deal") }), status: (0, import_fields54.select)({ type: "string", options: ["pending", "exception", "clear-to-fund", "funded", "cancelled"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), checklist: (0, import_fields54.json)({ defaultValue: [] }), exceptions: (0, import_fields54.json)({ defaultValue: [] }), fundingReference: (0, import_fields54.text)(), fundedAt: (0, import_fields54.timestamp)(), immutableEvidence: (0, import_fields54.json)({ defaultValue: {} }), idempotencyKey: (0, import_fields54.text)({ validation: { isRequired: true }, isIndexed: "unique" }) }
});

// features/keystone/models/FinanceProductQuote.ts
var import_core53 = require("@keystone-6/core");
var import_fields55 = require("@keystone-6/core/fields");
var FinanceProductQuote = (0, import_core53.list)({ access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }, { field: "product", listKey: "FinanceProduct" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields55.relationship)({ ref: "Deal.financeProductQuotes", db: requiredRelationshipDb("deal") }), product: (0, import_fields55.relationship)({ ref: "FinanceProduct.quotes", db: requiredRelationshipDb("product") }), providerKey: (0, import_fields55.text)({ validation: { isRequired: true } }), status: (0, import_fields55.select)({ type: "string", options: ["requested", "quoted", "failed"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), retailPriceCents: (0, import_fields55.integer)({ validation: { min: 0 } }), costCents: (0, import_fields55.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost, create: () => false, update: () => false } }), evidenceReference: (0, import_fields55.text)(), requestSnapshot: (0, import_fields55.json)({ defaultValue: {} }), resultSnapshot: (0, import_fields55.json)({ defaultValue: {} }), requestedAt: (0, import_fields55.timestamp)({ validation: { isRequired: true } }), completedAt: (0, import_fields55.timestamp)(), idempotencyKey: (0, import_fields55.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/FinanceProductCancellation.ts
var import_core54 = require("@keystone-6/core");
var import_fields56 = require("@keystone-6/core/fields");
var FinanceProductCancellation = (0, import_core54.list)({ access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageFinancing") } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }, { field: "menu", listKey: "FinanceMenuVersion" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields56.relationship)({ ref: "Deal.financeProductCancellations", db: requiredRelationshipDb("deal") }), menu: (0, import_fields56.relationship)({ ref: "FinanceMenuVersion.cancellations", db: requiredRelationshipDb("menu") }), productCode: (0, import_fields56.text)({ validation: { isRequired: true } }), status: (0, import_fields56.select)({ type: "string", options: ["requested", "completed", "denied"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), reason: (0, import_fields56.text)({ validation: { isRequired: true } }), refundCents: (0, import_fields56.integer)({ validation: { min: 0 } }), evidence: (0, import_fields56.json)({ defaultValue: {} }), requestedAt: (0, import_fields56.timestamp)({ validation: { isRequired: true } }), completedAt: (0, import_fields56.timestamp)(), idempotencyKey: (0, import_fields56.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/DeliveryCase.ts
var import_core55 = require("@keystone-6/core");
var import_fields57 = require("@keystone-6/core/fields");
var DeliveryCase = (0, import_core55.list)({ db: prismaModelDirectives('@@unique([dealId], map: "DeliveryCase_deal_key")'), access: { operation: { query: permissions.canAccessDeals, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, ["canManageDeals", "canApproveDeals", "canManageFinancing"]) } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deal", listKey: "Deal" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), deal: (0, import_fields57.relationship)({ ref: "Deal.deliveryCases", db: requiredRelationshipDb("deal") }), status: (0, import_fields57.select)({ type: "string", options: ["scheduled", "arrived", "ready", "delivered", "cancelled"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), appointmentAt: (0, import_fields57.timestamp)(), arrivedAt: (0, import_fields57.timestamp)(), checklist: (0, import_fields57.json)({ defaultValue: [] }), customerAcknowledgment: (0, import_fields57.text)(), acknowledgedAt: (0, import_fields57.timestamp)(), deliverySnapshot: (0, import_fields57.json)({ defaultValue: {} }), idempotencyKey: (0, import_fields57.text)({ validation: { isRequired: true }, isIndexed: "unique" }), weOweItems: (0, import_fields57.relationship)({ ref: "WeOweItem.deliveryCase", many: true }) } });

// features/keystone/models/WeOweItem.ts
var import_core56 = require("@keystone-6/core");
var import_fields58 = require("@keystone-6/core/fields");
var WeOweItem = (0, import_core56.list)({ access: { operation: { query: permissions.canAccessDeals, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, ["canManageDeals", "canApproveDeals", "canManageFinancing"]) } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "deliveryCase", listKey: "DeliveryCase" }, { field: "owner", listKey: "User", kind: "user" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), deliveryCase: (0, import_fields58.relationship)({ ref: "DeliveryCase.weOweItems", db: requiredRelationshipDb("deliveryCase") }), description: (0, import_fields58.text)({ validation: { isRequired: true } }), status: (0, import_fields58.select)({ type: "string", options: ["open", "fulfilled", "waived"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), promisedAt: (0, import_fields58.timestamp)({ validation: { isRequired: true } }), owner: (0, import_fields58.relationship)({ ref: "User", db: requiredRelationshipDb("owner") }), estimatedCostCents: (0, import_fields58.integer)({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost, create: () => false, update: () => false } }), fulfillmentEvidence: (0, import_fields58.text)(), customerAcknowledgment: (0, import_fields58.text)(), fulfilledAt: (0, import_fields58.timestamp)(), idempotencyKey: (0, import_fields58.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/ServiceLaborOperation.ts
var import_core57 = require("@keystone-6/core");
var import_fields59 = require("@keystone-6/core/fields");
var ServiceLaborOperation = (0, import_core57.list)({ access: { operation: { query: permissions.canManageService, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageService") } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "serviceOrder", listKey: "ServiceOrder" }, { field: "technician", listKey: "User", kind: "user" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), serviceOrder: (0, import_fields59.relationship)({ ref: "ServiceOrder.laborOperations", db: requiredRelationshipDb("serviceOrder") }), operationCode: (0, import_fields59.text)({ validation: { isRequired: true } }), description: (0, import_fields59.text)({ validation: { isRequired: true } }), status: (0, import_fields59.select)({ type: "string", options: ["open", "dispatched", "in-progress", "paused", "completed", "cancelled"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), technician: (0, import_fields59.relationship)({ ref: "User" }), soldHours: (0, import_fields59.float)({ validation: { min: 0 } }), actualMinutes: (0, import_fields59.integer)({ validation: { min: 0 } }), timePunches: (0, import_fields59.json)({ defaultValue: [] }), startedAt: (0, import_fields59.timestamp)(), completedAt: (0, import_fields59.timestamp)(), idempotencyKey: (0, import_fields59.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/PartsMovement.ts
var import_core58 = require("@keystone-6/core");
var import_fields60 = require("@keystone-6/core/fields");
var PartsMovement = (0, import_core58.list)({ access: { operation: { query: permissions.canManageService, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageService") } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "part", listKey: "PartsInventory" }, { field: "serviceOrder", listKey: "ServiceOrder" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), part: (0, import_fields60.relationship)({ ref: "PartsInventory.movements", db: requiredRelationshipDb("part") }), serviceOrder: (0, import_fields60.relationship)({ ref: "ServiceOrder.partsMovements" }), movementType: (0, import_fields60.select)({ type: "string", options: ["receipt", "issue", "return", "adjustment", "count", "commit", "release", "po-order", "po-cancel"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), quantityDelta: (0, import_fields60.integer)({ validation: { isRequired: true } }), onHandAfter: (0, import_fields60.integer)({ validation: { min: 0 } }), committedAfter: (0, import_fields60.integer)({ validation: { min: 0 } }), onOrderAfter: (0, import_fields60.integer)({ validation: { min: 0 } }), reference: (0, import_fields60.text)({ validation: { isRequired: true } }), reason: (0, import_fields60.text)({ validation: { isRequired: true } }), evidence: (0, import_fields60.json)({ defaultValue: {} }), occurredAt: (0, import_fields60.timestamp)({ validation: { isRequired: true } }), idempotencyKey: (0, import_fields60.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/PartsPurchaseOrder.ts
var import_core59 = require("@keystone-6/core");
var import_fields61 = require("@keystone-6/core/fields");
var PartsPurchaseOrder = (0, import_core59.list)({ db: prismaModelDirectives('@@unique([rooftopId, reference], map: "PartsPurchaseOrder_rooftop_reference_key")'), access: { operation: { query: permissions.canManageService, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageService") } }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), reference: (0, import_fields61.text)({ validation: { isRequired: true } }), supplier: (0, import_fields61.text)({ validation: { isRequired: true } }), status: (0, import_fields61.select)({ type: "string", options: ["draft", "ordered", "partially-received", "received", "cancelled"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), lines: (0, import_fields61.json)({ defaultValue: [] }), orderedAt: (0, import_fields61.timestamp)(), receivedAt: (0, import_fields61.timestamp)(), idempotencyKey: (0, import_fields61.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/AccountingMapping.ts
var import_core60 = require("@keystone-6/core");
var import_fields62 = require("@keystone-6/core/fields");
var AccountingMapping = (0, import_core60.list)({ db: prismaModelDirectives('@@unique([rooftopId, sourceType, sourceCode, providerKey], map: "AccountingMapping_rooftop_source_provider_key")'), access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") } }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), sourceType: (0, import_fields62.select)({ type: "string", options: ["deal", "service", "parts", "payment"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), sourceCode: (0, import_fields62.text)({ validation: { isRequired: true } }), debitAccount: (0, import_fields62.text)({ validation: { isRequired: true } }), creditAccount: (0, import_fields62.text)({ validation: { isRequired: true } }), providerKey: (0, import_fields62.text)({ validation: { isRequired: true } }) } });

// features/keystone/models/AccountingBatch.ts
var import_core61 = require("@keystone-6/core");
var import_fields63 = require("@keystone-6/core/fields");
var AccountingBatch = (0, import_core61.list)({ access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") } }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), sourceType: (0, import_fields63.select)({ type: "string", options: ["deal", "service", "parts", "payment"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), sourceId: (0, import_fields63.text)({ validation: { isRequired: true } }), status: (0, import_fields63.select)({ type: "string", options: ["staged", "posting", "posted", "failed", "reconciled", "locked"].map((value) => ({ label: value, value })), validation: { isRequired: true } }), providerKey: (0, import_fields63.text)({ validation: { isRequired: true } }), lines: (0, import_fields63.json)({ defaultValue: [] }), totalDebitCents: (0, import_fields63.integer)({ validation: { isRequired: true, min: 0 } }), totalCreditCents: (0, import_fields63.integer)({ validation: { isRequired: true, min: 0 } }), attemptCount: (0, import_fields63.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }), externalReference: (0, import_fields63.text)(), lastErrorCode: (0, import_fields63.text)(), postedAt: (0, import_fields63.timestamp)(), reconciledAt: (0, import_fields63.timestamp)(), lockedAt: (0, import_fields63.timestamp)(), idempotencyKey: (0, import_fields63.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/AccountingProviderResponse.ts
var import_core62 = require("@keystone-6/core");
var import_fields64 = require("@keystone-6/core/fields");
var AccountingProviderResponse = (0, import_core62.list)({ access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") } }, hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "batch", listKey: "AccountingBatch" }]) }, ui: { hideCreate: true, hideDelete: true }, fields: { ...trackingFields, rooftop: rooftopField(), batch: (0, import_fields64.relationship)({ ref: "AccountingBatch", db: requiredRelationshipDb("batch") }), providerKey: (0, import_fields64.text)({ validation: { isRequired: true } }), requestFingerprint: (0, import_fields64.text)({ validation: { isRequired: true } }), responseCode: (0, import_fields64.text)({ validation: { isRequired: true } }), externalReference: (0, import_fields64.text)(), immutableResponse: (0, import_fields64.json)({ defaultValue: {} }), receivedAt: (0, import_fields64.timestamp)({ validation: { isRequired: true } }), idempotencyKey: (0, import_fields64.text)({ validation: { isRequired: true }, isIndexed: "unique" }) } });

// features/keystone/models/PaymentTransaction.ts
var import_core63 = require("@keystone-6/core");
var import_fields65 = require("@keystone-6/core/fields");
var PaymentTransaction = (0, import_core63.list)({
  access: {
    operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") }
  },
  hooks: {
    validate: (args) => validateRooftopRecord(args, [
      { field: "deal", listKey: "Deal" },
      { field: "serviceOrder", listKey: "ServiceOrder" }
    ])
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["sourceType", "amountCents", "status", "providerKey", "updatedAt"] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: (0, import_fields65.relationship)({ ref: "Deal.paymentTransactions" }),
    serviceOrder: (0, import_fields65.relationship)({ ref: "ServiceOrder.paymentTransactions" }),
    sourceType: (0, import_fields65.select)({ type: "string", options: ["deal", "service"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    amountCents: (0, import_fields65.integer)({ validation: { isRequired: true, min: 1 } }),
    currency: (0, import_fields65.text)({ validation: { isRequired: true }, defaultValue: "usd" }),
    providerKey: (0, import_fields65.text)({ validation: { isRequired: true } }),
    providerTransactionId: (0, import_fields65.text)(),
    providerSessionId: (0, import_fields65.text)(),
    checkoutUrl: (0, import_fields65.text)(),
    status: (0, import_fields65.select)({ type: "string", options: ["creating", "pending", "authorized", "captured", "failed", "canceled", "partially-refunded", "refunded"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    capturedCents: (0, import_fields65.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    refundedCents: (0, import_fields65.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    failureCode: (0, import_fields65.text)(),
    reconciliationReference: (0, import_fields65.text)(),
    reconciledAt: (0, import_fields65.timestamp)(),
    version: (0, import_fields65.integer)({ validation: { isRequired: true, min: 1 }, defaultValue: 1 }),
    idempotencyKey: (0, import_fields65.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/PaymentRefund.ts
var import_core64 = require("@keystone-6/core");
var import_fields66 = require("@keystone-6/core/fields");
var PaymentRefund = (0, import_core64.list)({
  access: {
    operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") }
  },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "transaction", listKey: "PaymentTransaction" }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    transaction: (0, import_fields66.relationship)({ ref: "PaymentTransaction", db: requiredRelationshipDb("transaction") }),
    amountCents: (0, import_fields66.integer)({ validation: { isRequired: true, min: 1 } }),
    reason: (0, import_fields66.text)({ validation: { isRequired: true } }),
    status: (0, import_fields66.select)({ type: "string", options: ["creating", "pending", "succeeded", "failed", "canceled"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    providerRefundId: (0, import_fields66.text)(),
    failureCode: (0, import_fields66.text)(),
    idempotencyKey: (0, import_fields66.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/PaymentProviderEvent.ts
var import_core65 = require("@keystone-6/core");
var import_fields67 = require("@keystone-6/core/fields");
var PaymentProviderEvent = (0, import_core65.list)({
  access: {
    operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") }
  },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "transaction", listKey: "PaymentTransaction" }, { field: "refund", listKey: "PaymentRefund" }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    transaction: (0, import_fields67.relationship)({ ref: "PaymentTransaction", db: requiredRelationshipDb("transaction") }),
    refund: (0, import_fields67.relationship)({ ref: "PaymentRefund" }),
    providerKey: (0, import_fields67.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields67.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    eventType: (0, import_fields67.text)({ validation: { isRequired: true } }),
    payloadDigest: (0, import_fields67.text)({ validation: { isRequired: true } }),
    signatureTimestamp: (0, import_fields67.timestamp)({ validation: { isRequired: true } }),
    receivedAt: (0, import_fields67.timestamp)({ validation: { isRequired: true } })
  }
});

// features/keystone/models/SavedReport.ts
var import_core66 = require("@keystone-6/core");
var import_fields68 = require("@keystone-6/core/fields");
var SavedReport = (0, import_core66.list)({
  access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "owner", listKey: "User", kind: "user" }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    owner: (0, import_fields68.relationship)({ ref: "User", db: requiredRelationshipDb("owner") }),
    name: (0, import_fields68.text)({ validation: { isRequired: true } }),
    reportType: (0, import_fields68.select)({ type: "string", options: ["operations", "audit", "accounting-exceptions", "payment-reconciliation"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    filters: (0, import_fields68.json)({ defaultValue: {} }),
    exportFormat: (0, import_fields68.select)({ type: "string", options: ["json", "csv"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    schedule: (0, import_fields68.select)({ type: "string", options: ["manual", "daily", "weekly", "monthly"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    active: (0, import_fields68.checkbox)({ defaultValue: true }),
    nextRunAt: (0, import_fields68.timestamp)(),
    idempotencyKey: (0, import_fields68.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/ReportRun.ts
var import_core67 = require("@keystone-6/core");
var import_fields69 = require("@keystone-6/core/fields");
var ReportRun = (0, import_core67.list)({
  access: { operation: { query: permissions.canViewReports, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canViewReports") } },
  hooks: { validate: (args) => validateRooftopRecord(args, [{ field: "savedReport", listKey: "SavedReport" }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    savedReport: (0, import_fields69.relationship)({ ref: "SavedReport", db: requiredRelationshipDb("savedReport") }),
    status: (0, import_fields69.select)({ type: "string", options: ["queued", "completed", "failed", "expired"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    exportFormat: (0, import_fields69.select)({ type: "string", options: ["json", "csv"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    resultSnapshot: (0, import_fields69.json)({ defaultValue: {} }),
    resultDigest: (0, import_fields69.text)(),
    errorCode: (0, import_fields69.text)(),
    completedAt: (0, import_fields69.timestamp)(),
    expiresAt: (0, import_fields69.timestamp)(),
    idempotencyKey: (0, import_fields69.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/RetentionPolicy.ts
var import_core68 = require("@keystone-6/core");
var import_fields70 = require("@keystone-6/core/fields");
var RetentionPolicy = (0, import_core68.list)({
  db: prismaModelDirectives('@@unique([rooftopId, category], map: "RetentionPolicy_rooftop_category_key")'),
  access: { operation: { query: permissions.canManageDealerships, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session, "canManageDealerships") } },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    category: (0, import_fields70.select)({ type: "string", options: ["customer-intake", "report-export", "provider-payload", "audit-evidence"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    retentionDays: (0, import_fields70.integer)({ validation: { isRequired: true, min: 1 } }),
    legalHold: (0, import_fields70.checkbox)({ defaultValue: false }),
    rationale: (0, import_fields70.text)({ validation: { isRequired: true } }),
    lastSweptAt: (0, import_fields70.timestamp)(),
    idempotencyKey: (0, import_fields70.text)({ validation: { isRequired: true }, isIndexed: "unique" })
  }
});

// features/keystone/models/AuthenticationThrottle.ts
var import_core69 = require("@keystone-6/core");
var import_fields71 = require("@keystone-6/core/fields");
var AuthenticationThrottle = (0, import_core69.list)({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    ...trackingFields,
    keyHash: (0, import_fields71.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    purpose: (0, import_fields71.text)({ validation: { isRequired: true } }),
    failureCount: (0, import_fields71.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    windowStartedAt: (0, import_fields71.timestamp)({ validation: { isRequired: true } }),
    blockedUntil: (0, import_fields71.timestamp)({ isIndexed: true }),
    updatedAt: (0, import_fields71.timestamp)({
      access: { create: () => false, update: () => false },
      defaultValue: { kind: "now" },
      db: { isNullable: false, updatedAt: true },
      isIndexed: true,
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
    })
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  Make,
  Model,
  Vehicle,
  VehicleImage,
  VehicleConditionReport,
  VehicleHistory,
  PriceHistory,
  Lead,
  CustomerInteraction,
  Task,
  TestDrive,
  Deal,
  DealApproval,
  TradeIn,
  ServiceAppointment,
  ServiceOrder,
  RepairOrderLineItem,
  ServicePackage,
  PartsInventory,
  DealershipProfile,
  FinancingApplication,
  LenderSubmission,
  LenderDecision,
  DealerGroup,
  Rooftop,
  DealerGroupMembership,
  RooftopMembership,
  MembershipAuditEvent,
  InventoryAcquisition,
  InventoryAcquisitionEvent,
  DomainAuditEvent,
  DomainOutboxEvent,
  InventoryStock,
  InventoryStockEvent,
  InventoryReconWorkItem,
  InventoryMerchandisingVersion,
  InventoryFeedRun,
  InventoryFeedError,
  Customer,
  CustomerMergeEvent,
  LeadAssignmentEvent,
  LeadRoutingRule,
  CustomerContactPreferenceEvent,
  CustomerHousehold,
  SalesVisit,
  FinanceProduct,
  FinanceMenuVersion,
  FinanceComplianceCheck,
  FinanceContractPackage,
  FinanceFundingCase,
  FinanceProductQuote,
  FinanceProductCancellation,
  DeliveryCase,
  WeOweItem,
  ServiceLaborOperation,
  PartsMovement,
  PartsPurchaseOrder,
  AccountingMapping,
  AccountingBatch,
  AccountingProviderResponse,
  PaymentTransaction,
  PaymentRefund,
  PaymentProviderEvent,
  SavedReport,
  ReportRun,
  RetentionPolicy,
  AuthenticationThrottle
};
for (const model of Object.values(models)) {
  model.graphql = { ...model.graphql, maxTake: model.graphql?.maxTake ?? 1e3 };
}

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema9 = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/lib/graphqlRequestSecurity.ts
var import_node_crypto2 = require("node:crypto");
var import_graphql = require("graphql");

// features/dashboard/lib/internalGraphqlAuth.ts
var LOCAL_INTERNAL_GRAPHQL_SECRET = "openfront-dealership-local-internal-graphql-boundary-v1";
function resolveInternalGraphqlSecret(env = process.env) {
  const configured2 = env.INTERNAL_GRAPHQL_SECRET?.trim() || "";
  if (env.NODE_ENV === "production") {
    if (configured2.length < 32) {
      throw new Error("INTERNAL_GRAPHQL_SECRET is required in production");
    }
    return configured2;
  }
  if (configured2.length >= 32) return configured2;
  const sessionSecret2 = env.SESSION_SECRET?.trim() || "";
  if (sessionSecret2.length >= 32) return sessionSecret2;
  return LOCAL_INTERNAL_GRAPHQL_SECRET;
}

// features/keystone/lib/graphqlRequestSecurity.ts
var internalAuthSecret = resolveInternalGraphqlSecret();
function validInternalAuthHeader(value) {
  if (!value || internalAuthSecret.length < 32) return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(internalAuthSecret);
  return supplied.length === expected.length && (0, import_node_crypto2.timingSafeEqual)(supplied, expected);
}

// features/keystone/mutations/submissionErrors.ts
var import_graphql2 = require("graphql");
var SubmissionError = class extends import_graphql2.GraphQLError {
  constructor(message, status = 400, code = "INVALID_SUBMISSION") {
    super(message, {
      extensions: {
        code,
        http: { status }
      }
    });
    this.name = "SubmissionError";
    this.status = status;
    this.submissionCode = code;
  }
};

// features/keystone/utils/localSchedule.mjs
function localScheduleIso(date4, hours, minutes, timezone) {
  const [year, month, day] = date4.split("-").map(Number);
  const civil = Date.UTC(year, month - 1, day, hours, minutes);
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = (timestamp53) => Object.fromEntries(format.formatToParts(timestamp53).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  const candidates = /* @__PURE__ */ new Set();
  for (const delta of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = civil + delta * 36e5;
    const p = parts(sample);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample;
    const candidate = civil - offset;
    const c = parts(candidate);
    if (c.year === year && c.month === month && c.day === day && c.hour === hours && c.minute === minutes) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error("Date/time does not identify one valid local appointment; choose another time.");
  return new Date([...candidates][0]).toISOString();
}

// features/keystone/lifecycle/inventoryPublication.ts
async function lockInventoryStock(tx, stockId) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`inventory-stock:${stockId}`}, 0))`;
}
async function loadInventoryPublication(tx, stockId) {
  const stock = await tx.prisma.inventoryStock.findUnique({
    where: { id: stockId },
    include: { vehicle: { include: { images: true } }, merchandisingVersions: { orderBy: { version: "desc" }, take: 1 } }
  });
  if (!stock?.vehicle) throw new Error("Inventory stock no longer exists");
  return stock;
}
function merchandisingSnapshot(stock) {
  const v = stock.vehicle;
  if (!v) throw new Error("Inventory vehicle is missing");
  const images = (v.images || []).map((image5) => ({
    id: String(image5.id),
    imagePath: String(image5.imagePath || ""),
    imageId: image5.image_id || null,
    imageExtension: image5.image_extension || null,
    caption: String(image5.caption || ""),
    category: image5.category || null,
    isPrimary: Boolean(image5.isPrimary),
    sortOrder: image5.sortOrder ?? 0
  })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 2,
    vehicleId: v.id,
    vin: v.vin,
    stockNumber: stock.stockNumber,
    title: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || "",
    exteriorColor: v.exteriorColor || "",
    interiorColor: v.interiorColor || "",
    mileage: v.mileage ?? null,
    condition: v.condition ?? null,
    description: String(v.description || "").trim(),
    priceCents: v.priceCents ?? null,
    listPriceCents: v.listPriceCents ?? null,
    features: v.features ?? [],
    images,
    primaryImagePath: images.find((image5) => image5.isPrimary)?.imagePath || images[0]?.imagePath || ""
  };
}
function assertMerchandisingContent(stock) {
  const snapshot2 = merchandisingSnapshot(stock);
  if (!snapshot2.description || !Number.isInteger(snapshot2.priceCents) || snapshot2.priceCents <= 0 || !snapshot2.images.some((image5) => image5.imagePath || image5.imageId)) {
    throw new Error("Merchandising submission requires price, description, and at least one image");
  }
  if (!["available", "service"].includes(stock.vehicle.status)) throw new Error("Only active inventory can be reviewed");
  return snapshot2;
}
function assertCurrentInventoryApproval(stock) {
  const latest = stock.merchandisingVersions?.[0];
  if (stock.merchandisingStatus !== "approved" || latest?.status !== "approved" || latest.snapshot?.schemaVersion !== 2) {
    throw new Error("Current merchandising approval is required; submit this listing for review");
  }
  const digest = domainEventRequestHash(merchandisingSnapshot(stock));
  if (stock.approvedRevisionHash !== digest || domainEventRequestHash(latest.snapshot) !== digest) {
    throw new Error("Inventory content changed after review; submit the current revision for approval");
  }
  return { versionId: latest.id, version: latest.version, revisionHash: digest };
}
function assertPublishableInventory(stock) {
  const approval = assertCurrentInventoryApproval(stock);
  if (stock.reconStatus !== "completed" || !stock.frontlineAt || stock.vehicle.status !== "available") {
    throw new Error("Public inventory requires available stock, completed recon and frontline evidence");
  }
  return approval;
}

// features/keystone/mutations/submissionUtils.ts
function requiredText(value, label, maxLength = 500) {
  const text75 = String(value || "").trim();
  if (!text75) throw new SubmissionError(`${label} is required.`);
  if (text75.length > maxLength) throw new SubmissionError(`${label} must be ${maxLength} characters or fewer.`);
  return text75;
}
function optionalText(value, maxLength = 4e3, label = "Value") {
  const text75 = String(value || "").trim();
  if (text75.length > maxLength) throw new SubmissionError(`${label} must be ${maxLength} characters or fewer.`);
  return text75;
}
function validEmail(value) {
  const email = requiredText(value, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SubmissionError("A valid email is required.");
  }
  return email;
}
function validPhone(value, required7 = true) {
  const phone = optionalText(value, 50, "Phone");
  if (!phone && !required7) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) throw new SubmissionError("A valid phone number is required.");
  return phone;
}
function finiteNumber(value, label, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new SubmissionError(`${label} must be a finite number.`);
  if (options.integer && !Number.isInteger(number)) throw new SubmissionError(`${label} must be a whole number.`);
  if (options.min != null && number < options.min) throw new SubmissionError(`${label} must be at least ${options.min}.`);
  if (options.max != null && number > options.max) throw new SubmissionError(`${label} must be at most ${options.max}.`);
  return number;
}
function splitCustomerName(value, fallbackFirst = "Website", fallbackLast = "Customer") {
  const parts = requiredText(value, "Customer name", 200).split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || fallbackFirst;
  const lastName = parts.length ? parts.join(" ") : fallbackLast;
  return { firstName, lastName };
}
function parseScheduledTime(dateValue, timeValue, label = "Appointment", timezone = "UTC") {
  const date4 = requiredText(dateValue, `${label} date`, 10);
  const time = requiredText(timeValue, `${label} time`, 20);
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date4) || !match) {
    throw new SubmissionError(`${label} date or time is invalid.`);
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem && (hours < 1 || hours > 12)) throw new SubmissionError(`${label} date or time is invalid.`);
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) throw new SubmissionError(`${label} date or time is invalid.`);
  let scheduled;
  try {
    scheduled = new Date(localScheduleIso(date4, hours, minutes, timezone));
  } catch {
    throw new SubmissionError(`${label} date or time is invalid or ambiguous in the dealership timezone.`);
  }
  const now = Date.now();
  if (scheduled.getTime() < now - 5 * 60 * 1e3 || scheduled.getTime() > now + 366 * 24 * 60 * 60 * 1e3) {
    throw new SubmissionError(`${label} must be within the next year.`);
  }
  return { iso: scheduled.toISOString(), date: date4, time };
}
var PUBLIC_SUBMISSION_VEHICLE_QUERY = `
  id vin stockNumber year make model trim exteriorColor interiorColor mileage condition description priceCents listPriceCents features status
  images { id imagePath image { id extension } caption category isPrimary sortOrder }
  rooftop { id status dealerGroup { id status } }
  inventoryStock {
    id stockNumber reconStatus merchandisingStatus approvedRevisionHash frontlineAt
    rooftop { id status dealerGroup { id status } }
    merchandisingVersions(orderBy: { version: desc }, take: 1) { id version status snapshot }
  }
`;
function unavailableVehicle() {
  throw new SubmissionError(
    "The selected vehicle is no longer available. Please choose another vehicle.",
    404,
    "VEHICLE_NOT_AVAILABLE"
  );
}
async function resolveAvailableVehicle(context, vehicleId, rooftopId) {
  const id = optionalText(vehicleId, 100, "Vehicle");
  if (!id) return null;
  const candidate = await context.sudo().query.Vehicle.findOne({
    where: { id },
    query: PUBLIC_SUBMISSION_VEHICLE_QUERY
  });
  if (!candidate || candidate.rooftop?.id !== rooftopId || !candidate.inventoryStock?.id || candidate.inventoryStock.rooftop?.id !== rooftopId) unavailableVehicle();
  await lockInventoryStock(context, candidate.inventoryStock.id);
  await context.prisma.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${candidate.id} FOR SHARE`;
  await context.prisma.$queryRaw`SELECT "id" FROM "VehicleImage" WHERE "vehicle" = ${candidate.id} FOR SHARE`;
  await context.prisma.$queryRaw`SELECT "id" FROM "InventoryStock" WHERE "id" = ${candidate.inventoryStock.id} FOR SHARE`;
  const vehicle = await context.sudo().query.Vehicle.findOne({
    where: { id },
    query: PUBLIC_SUBMISSION_VEHICLE_QUERY
  });
  if (!vehicle || vehicle.inventoryStock?.id !== candidate.inventoryStock.id || vehicle.status !== "available" || vehicle.rooftop?.id !== rooftopId || vehicle.rooftop?.status !== "active" || vehicle.rooftop?.dealerGroup?.status !== "active" || vehicle.inventoryStock?.rooftop?.id !== rooftopId || vehicle.inventoryStock?.rooftop?.status !== "active" || vehicle.inventoryStock?.rooftop?.dealerGroup?.status !== "active" || vehicle.inventoryStock?.rooftop?.dealerGroup?.id !== vehicle.rooftop?.dealerGroup?.id || vehicle.inventoryStock?.reconStatus !== "completed" || vehicle.inventoryStock?.merchandisingStatus !== "approved" || !vehicle.inventoryStock?.approvedRevisionHash || !vehicle.inventoryStock?.frontlineAt) unavailableVehicle();
  try {
    const revisionVehicle = { ...vehicle, images: (vehicle.images || []).map((image5) => ({
      ...image5,
      image_id: image5.image?.id ?? null,
      image_extension: image5.image?.extension ?? null
    })) };
    assertPublishableInventory({ ...vehicle.inventoryStock, vehicle: revisionVehicle });
  } catch {
    unavailableVehicle();
  }
  return vehicle;
}
function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(number);
}

// features/keystone/mutations/customerAccount.ts
async function registerCustomerAccount(_root, { name, email, password: password2 }, context) {
  const header = context.req?.headers?.["x-openfront-internal-auth"];
  if (!validInternalAuthHeader(typeof header === "string" ? header : null)) throw new Error("Account registration is unavailable");
  if (context.session?.itemId) throw new Error("Sign out before creating an account");
  const configured2 = await context.prisma.user.count({ where: { role: { is: { canManagePeople: true } } } });
  if (!configured2) throw new Error("Account registration is unavailable");
  const cleanName = requiredText(name, "Name", 200);
  const cleanEmail = validEmail(email).toLowerCase();
  if (typeof password2 !== "string" || password2.length < 12 || password2.length > 200) throw new Error("Password must contain 12\u2013200 characters");
  const user = await context.sudo().query.User.createOne({
    data: { name: cleanName, email: cleanEmail, password: password2, onboardingStatus: "dismissed" },
    query: "id"
  });
  return { id: user.id };
}
function requestingAccountId(context) {
  return context.session?.listKey === "User" && typeof context.session.itemId === "string" ? context.session.itemId : null;
}
async function customerRequestHistory(_root, _args, context) {
  const accountId = requestingAccountId(context);
  if (!accountId) throw new Error("Sign in required");
  const [drives, services] = await Promise.all([
    context.prisma.testDrive.findMany({
      where: { requestedById: accountId },
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, scheduledTime: true, completed: true }
    }),
    context.prisma.serviceAppointment.findMany({
      where: { requestedById: accountId },
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, appointmentDate: true, serviceType: true, status: true }
    })
  ]);
  return [
    ...drives.map((item) => ({ id: item.id, kind: "Test drive", scheduledAt: item.scheduledTime, status: item.completed ? "completed" : "requested" })),
    ...services.map((item) => ({ id: item.id, kind: "Service", scheduledAt: item.appointmentDate, status: item.status }))
  ].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).slice(0, 50);
}

// features/keystone/mutations/updateActiveUser.ts
var ALLOWED_ONBOARDING_STATUSES = /* @__PURE__ */ new Set(["dismissed"]);
async function updateActiveUser(_root, { data }, context) {
  const userId = context.session?.itemId;
  if (!userId) {
    throw new Error("You must be signed in to update onboarding status.");
  }
  const updateData = {};
  if (data.onboardingStatus !== void 0 && data.onboardingStatus !== null) {
    if (!ALLOWED_ONBOARDING_STATUSES.has(data.onboardingStatus)) {
      throw new Error("Invalid onboarding status.");
    }
    updateData.onboardingStatus = data.onboardingStatus;
  }
  if (Object.keys(updateData).length === 0) {
    throw new Error("No supported active user fields were provided.");
  }
  return context.query.User.updateOne({
    where: { id: userId },
    data: updateData,
    query: "id onboardingStatus"
  });
}

// features/keystone/mutations/customerIdentity.ts
var import_node_crypto3 = require("node:crypto");
function normalizeCustomerEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizeCustomerPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}
function customerIdentityKey(rooftopId, email, phone) {
  const strongest = email ? `email:${email}` : phone ? `phone:${phone}` : "";
  if (!rooftopId || !strongest) throw new Error("Customer identity requires a rooftop and normalized contact point");
  return (0, import_node_crypto3.createHash)("sha256").update(`${rooftopId}:${strongest}`).digest("hex");
}
async function lockCustomerIdentityScope(tx, rooftopId) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`customer-identity-rooftop:${rooftopId}`}, 0))`;
}
async function resolveMergedCustomer(tx, customerId, rooftopId) {
  const visited = /* @__PURE__ */ new Set();
  let currentId = customerId;
  for (let depth = 0; depth < 32; depth += 1) {
    if (visited.has(currentId)) throw new Error("Customer merge history contains a cycle; operator review is required");
    visited.add(currentId);
    const customer = await tx.prisma.customer.findUnique({
      where: { id: currentId },
      select: { id: true, rooftopId: true, status: true, mergedIntoId: true }
    });
    if (!customer || customer.rooftopId !== rooftopId) throw new Error("Customer identity is no longer available");
    if (customer.status === "active" && !customer.mergedIntoId) return customer;
    if (customer.status !== "merged" || !customer.mergedIntoId) throw new Error("Customer merge history is incomplete; operator review is required");
    currentId = customer.mergedIntoId;
  }
  throw new Error("Customer merge history exceeds the supported depth; operator review is required");
}
async function resolveCustomerInTransaction(tx, input2) {
  const normalizedEmail = normalizeCustomerEmail(input2.email);
  const normalizedPhone = normalizeCustomerPhone(input2.phone);
  if (!normalizedEmail && normalizedPhone.length < 7) throw new Error("A valid customer email or phone is required");
  const identityKey = customerIdentityKey(input2.rooftopId, normalizedEmail, normalizedPhone);
  await lockCustomerIdentityScope(tx, input2.rooftopId);
  const identities = [
    ...normalizedEmail ? [{ normalizedEmail }] : [],
    ...normalizedPhone.length >= 7 ? [{ normalizedPhone }] : []
  ];
  const matches2 = await tx.prisma.customer.findMany({
    where: {
      rooftopId: input2.rooftopId,
      status: { in: ["active", "merged"] },
      OR: [...identities, { identityKey }]
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 51,
    select: { id: true }
  });
  if (matches2.length > 50) throw new Error("Customer identity has too many historical matches; operator review is required");
  if (matches2.length) {
    const roots = /* @__PURE__ */ new Map();
    for (const match of matches2) {
      const root2 = await resolveMergedCustomer(tx, String(match.id), input2.rooftopId);
      roots.set(root2.id, root2);
    }
    if (roots.size !== 1) throw new Error("Customer contact details match multiple active records; operator review is required");
    const root = roots.values().next().value;
    const current = await tx.prisma.customer.findUnique({
      where: { id: root.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        primaryEmail: true,
        primaryPhone: true,
        normalizedEmail: true,
        normalizedPhone: true
      }
    });
    if (!current) throw new Error("Customer identity is no longer available");
    const customer2 = await tx.prisma.customer.update({
      where: { id: current.id },
      data: {
        firstName: current.firstName || input2.firstName,
        lastName: current.lastName || input2.lastName,
        primaryEmail: current.primaryEmail || input2.email,
        primaryPhone: current.primaryPhone || input2.phone,
        normalizedEmail: current.normalizedEmail || normalizedEmail,
        normalizedPhone: current.normalizedPhone || normalizedPhone
      }
    });
    return { customer: customer2, reused: true, duplicateCandidateCount: Math.max(0, matches2.length - 1) };
  }
  const customer = await tx.prisma.customer.create({
    data: {
      rooftopId: input2.rooftopId,
      firstName: input2.firstName,
      lastName: input2.lastName,
      primaryEmail: input2.email,
      primaryPhone: input2.phone,
      normalizedEmail,
      normalizedPhone,
      identityKey,
      status: "active"
    }
  });
  return { customer, reused: false, duplicateCandidateCount: 0 };
}

// features/keystone/security/publicSubmissionToken.ts
var import_node_crypto4 = require("node:crypto");
var PUBLIC_SUBMISSION_TOKEN_MAX_AGE_MS = 5 * 60 * 1e3;
var TOKEN_MAX_LENGTH = 2048;
var LOCAL_ONLY_SECRET = "local-public-submission-policy-secret-change-me";
function policySecret() {
  const configured2 = (process.env.PUBLIC_SUBMISSION_SECRET || process.env.INTERNAL_GRAPHQL_SECRET || process.env.SESSION_SECRET || "").trim();
  if (process.env.NODE_ENV === "production" && configured2.length < 32) {
    throw new Error("PUBLIC_SUBMISSION_SECRET or INTERNAL_GRAPHQL_SECRET is required in production");
  }
  return configured2.length >= 32 ? configured2 : LOCAL_ONLY_SECRET;
}
function publicSubmissionHmac(value) {
  return (0, import_node_crypto4.createHmac)("sha256", policySecret()).update(value).digest("hex");
}
function safeEqual(left, right) {
  const supplied = Buffer.from(left);
  const expected = Buffer.from(right);
  return supplied.length === expected.length && (0, import_node_crypto4.timingSafeEqual)(supplied, expected);
}
function trustedPublicSubmissionAddressHash(token, workflow, idempotencyKey2) {
  const value = typeof token === "string" ? token : "";
  if (!value || value.length > TOKEN_MAX_LENGTH) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra || !/^[a-f0-9]{64}$/.test(signature) || !safeEqual(signature, publicSubmissionHmac(`public-submission-token:${payload}`))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.version !== 1 || parsed.workflow !== workflow || parsed.idempotencyKey !== idempotencyKey2 || typeof parsed.addressHash !== "string" || !/^[a-f0-9]{64}$/.test(parsed.addressHash) || typeof parsed.issuedAt !== "number" || !Number.isFinite(parsed.issuedAt) || Math.abs(Date.now() - parsed.issuedAt) > PUBLIC_SUBMISSION_TOKEN_MAX_AGE_MS) return null;
    return parsed.addressHash;
  } catch {
    return null;
  }
}

// features/keystone/mutations/publicSubmissionPolicy.ts
var WINDOW_MS = 15 * 60 * 1e3;
var IDENTITY_LIMIT = 8;
var PUBLIC_SUBMISSION_NETWORK_LIMIT = 30;
function publicSubmissionIdempotencyKey(value) {
  const key5 = String(value || "").trim();
  if (key5.length < 8 || key5.length > 180 || !/^[a-zA-Z0-9:_-]+$/.test(key5)) {
    throw new SubmissionError("A valid idempotency key is required.", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  return key5;
}
function publicSubmissionRooftopSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (slug.length < 2 || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new SubmissionError("A valid dealership location is required.", 400, "INVALID_ROOFTOP");
  }
  try {
    return assertConfiguredStorefrontRooftopSlug(slug);
  } catch {
    throw new SubmissionError("This dealership location is unavailable.", 404, "INVALID_ROOFTOP");
  }
}
function publicSubmissionIdentity(email, phone) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "").slice(-15);
  return `${email.trim().toLowerCase()}:${normalizedPhone || "no-phone"}`;
}
async function reservePublicSubmissionBudget(context, keyHash, purpose, maximum) {
  return context.transaction(async (transactionContext) => {
    await transactionContext.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`public-submission-budget:${keyHash}`}, 0))`;
    const current = await transactionContext.prisma.authenticationThrottle.findUnique({ where: { keyHash } });
    const now = /* @__PURE__ */ new Date();
    const inWindow = Boolean(current && now.getTime() - current.windowStartedAt.getTime() <= WINDOW_MS);
    const count = inWindow ? current.failureCount + 1 : 1;
    const alreadyBlocked = Boolean(current?.blockedUntil && current.blockedUntil.getTime() > now.getTime());
    const blocked = alreadyBlocked || count > maximum;
    const blockedUntil = blocked ? new Date(now.getTime() + WINDOW_MS) : null;
    if (current) {
      await transactionContext.prisma.authenticationThrottle.update({
        where: { id: current.id },
        data: {
          purpose,
          failureCount: count,
          windowStartedAt: inWindow ? current.windowStartedAt : now,
          blockedUntil
        }
      });
    } else {
      await transactionContext.prisma.authenticationThrottle.create({
        data: { keyHash, purpose, failureCount: count, windowStartedAt: now, blockedUntil }
      });
    }
    return !blocked;
  }, { timeout: 1e4 });
}
function requirePublicSubmissionAddressHash(requestToken, workflow, idempotencyKey2) {
  const addressHash = trustedPublicSubmissionAddressHash(requestToken, workflow, idempotencyKey2);
  if (!addressHash) {
    throw new SubmissionError(
      "A valid submission request token is required.",
      400,
      "INVALID_REQUEST_TOKEN"
    );
  }
  return addressHash;
}
async function enforceRequestBudget(context, workflow, rooftopId, identity, addressHash) {
  const networkAllowed = await reservePublicSubmissionBudget(
    context,
    publicSubmissionHmac(`public-submission:${workflow}:${rooftopId}:network:${addressHash}`),
    `public-${workflow}-network`,
    PUBLIC_SUBMISSION_NETWORK_LIMIT
  );
  if (!networkAllowed) {
    throw new SubmissionError(
      "Too many requests were received. Please wait and try again.",
      429,
      "SUBMISSION_RATE_LIMITED"
    );
  }
  const identityKey = publicSubmissionHmac(`public-submission:${workflow}:${rooftopId}:identity:${identity}`);
  const identityAllowed = await reservePublicSubmissionBudget(
    context,
    identityKey,
    `public-${workflow}-identity`,
    IDENTITY_LIMIT
  );
  if (!identityAllowed) {
    throw new SubmissionError(
      "Too many requests were received. Please wait and try again.",
      429,
      "SUBMISSION_RATE_LIMITED"
    );
  }
}
function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
async function lockCurrentPublicRooftop(context, publicSlug, expectedRooftopId) {
  const candidates = await context.prisma.rooftop.findMany({
    where: { publicSlug, status: "active", dealerGroup: { is: { status: "active" } } },
    select: { id: true, publicSlug: true, status: true, dealerGroupId: true },
    take: 2
  });
  if (candidates.length !== 1 || candidates[0].id !== expectedRooftopId || !candidates[0].dealerGroupId) {
    throw new SubmissionError("This dealership location is unavailable.", 404, "INVALID_ROOFTOP");
  }
  const candidate = candidates[0];
  await context.prisma.$queryRaw`SELECT "id" FROM "Rooftop" WHERE "id" = ${candidate.id} FOR SHARE`;
  await context.prisma.$queryRaw`SELECT "id" FROM "DealerGroup" WHERE "id" = ${candidate.dealerGroupId} FOR SHARE`;
  const current = await context.prisma.rooftop.findUnique({
    where: { id: candidate.id },
    select: { id: true, publicSlug: true, status: true, dealerGroupId: true, dealerGroup: { select: { id: true, status: true } } }
  });
  if (current?.id !== expectedRooftopId || current.publicSlug !== publicSlug || current.status !== "active" || current.dealerGroupId !== candidate.dealerGroupId || current.dealerGroup?.id !== candidate.dealerGroupId || current.dealerGroup?.status !== "active") {
    throw new SubmissionError("This dealership location is unavailable.", 404, "INVALID_ROOFTOP");
  }
}
async function runPublicSubmission(options) {
  const rooftopSlug = publicSubmissionRooftopSlug(options.rooftopSlug);
  const idempotencyKey2 = publicSubmissionIdempotencyKey(options.idempotencyKey);
  const addressHash = requirePublicSubmissionAddressHash(
    options.requestToken,
    options.workflow,
    idempotencyKey2
  );
  if (String(options.honeypot || "").trim()) {
    throw new SubmissionError("Unable to process this request.", 400, "INVALID_SUBMISSION");
  }
  const rooftopId = await resolvePublicRooftopId(options.context, rooftopSlug);
  await enforceRequestBudget(
    options.context,
    options.workflow,
    rooftopId,
    options.identity,
    addressHash
  );
  const eventKey = `public-submission:${options.workflow}:${idempotencyKey2}`;
  const submissionRequestHash = domainEventRequestHash({
    workflow: options.workflow,
    rooftopId,
    requestEvidence: options.requestEvidence,
    // Prevent an idempotency-key replay from transferring another account's request.
    requestingAccountId: options.context.session?.listKey === "User" ? options.context.session.itemId : null
  });
  return options.context.transaction(async (transactionContext) => {
    await transactionContext.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`;
    const existing = await transactionContext.prisma.domainAuditEvent.findUnique({
      where: { eventKey },
      select: { metadata: true }
    });
    if (existing) {
      const metadata = existing.metadata;
      if (metadata?.submissionRequestHash !== submissionRequestHash) {
        throw new SubmissionError(
          "The idempotency key was already used for a different request.",
          409,
          "IDEMPOTENCY_CONFLICT"
        );
      }
      const response2 = metadata?.response;
      if (!response2 || typeof response2 !== "object" || Array.isArray(response2)) {
        throw new Error("Public submission replay evidence is incomplete");
      }
      return { ...response2, reused: true };
    }
    await lockCurrentPublicRooftop(transactionContext, rooftopSlug, rooftopId);
    const result2 = await options.handler(transactionContext, { rooftopId, reused: false });
    const response = jsonSafe(result2);
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId,
      aggregateType: options.aggregateType,
      aggregateId: options.aggregateId(result2),
      action: "submitted",
      topic: options.topic,
      afterSnapshot: { workflow: options.workflow, accepted: true, response },
      metadata: { submissionRequestHash, response },
      payload: { workflow: options.workflow, rooftopId, response }
    });
    return { ...result2, reused: false };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/submitInquiry.ts
var INTENTS = {
  "general-contact": "General contact request",
  "vehicle-question": "Vehicle question",
  "get-quote": "Price quote request"
};
var CONTACTS = /* @__PURE__ */ new Set(["email", "phone", "text"]);
async function submitInquiry(_root, { data }, context) {
  const firstName = requiredText(data.firstName, "First name", 100);
  const lastName = requiredText(data.lastName, "Last name", 100);
  const email = validEmail(data.email);
  const phone = validPhone(data.phone, false);
  const message = optionalText(data.message, 4e3, "Message");
  const intent = requiredText(data.intent, "Inquiry type", 50);
  const preferredContact = optionalText(data.preferredContact || "email", 20, "Preferred contact");
  const intentLabel = INTENTS[intent];
  if (!intentLabel || !CONTACTS.has(preferredContact)) {
    throw new SubmissionError("Inquiry type or preferred contact method is invalid.");
  }
  if ((preferredContact !== "email" || intent !== "general-contact") && !phone) {
    throw new SubmissionError("A phone number is required for this request.");
  }
  if ((intent === "general-contact" || intent === "vehicle-question") && !message) {
    throw new SubmissionError("A message is required for this request.");
  }
  if (intent !== "general-contact" && !data.vehicleId) {
    throw new SubmissionError("A selected vehicle is required for this request.");
  }
  return runPublicSubmission({
    context,
    workflow: "inquiry",
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    identity: publicSubmissionIdentity(email, phone),
    requestToken: data.requestToken,
    honeypot: data.website,
    requestEvidence: {
      firstName,
      lastName,
      email,
      phone,
      message,
      intent,
      preferredContact,
      vehicleId: optionalText(data.vehicleId, 100, "Vehicle")
    },
    aggregateType: "Lead",
    topic: "public-inquiry.submitted",
    aggregateId: (result2) => String(result2.leadId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId);
      const rooftop = { connect: { id: rooftopId } };
      const vehicleSummary = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})` : "No inventory vehicle selected";
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone
      });
      const lead = await transactionContext.sudo().query.Lead.createOne({
        data: {
          rooftop,
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          email,
          phone,
          source: "website",
          status: "new",
          ...intent === "get-quote" ? { timeframe: "immediately" } : {},
          notes: [
            `${intentLabel} submitted from storefront.`,
            `Preferred contact: ${preferredContact}.`,
            `Selected inventory: ${vehicleSummary}.`,
            message ? `Customer message: ${message}` : "Customer did not include an additional message."
          ].join("\n"),
          ...vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}
        },
        query: "id"
      });
      return {
        leadId: lead.id,
        intent,
        intentLabel,
        preferredContact,
        selectedVehicle: vehicle
      };
    }
  });
}

// features/keystone/mutations/submitTestDrive.ts
async function submitTestDrive(_root, { data }, context) {
  const customerName = requiredText(data.customerName, "Customer name", 200);
  const email = validEmail(data.customerEmail);
  const phone = validPhone(data.customerPhone);
  const message = optionalText(data.message, 4e3, "Message");
  const requestedDate = requiredText(data.preferredDate, "Preferred date", 10);
  const requestedTime = requiredText(data.preferredTime, "Preferred time", 20);
  const { firstName, lastName } = splitCustomerName(customerName, "Website", "Lead");
  return runPublicSubmission({
    context,
    workflow: "test-drive",
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    identity: publicSubmissionIdentity(email, phone),
    requestToken: data.requestToken,
    honeypot: data.website,
    requestEvidence: {
      customerName,
      email,
      phone,
      message,
      requestedDate,
      requestedTime,
      vehicleId: optionalText(data.vehicleId, 100, "Vehicle")
    },
    aggregateType: "TestDrive",
    topic: "public-test-drive.submitted",
    aggregateId: (result2) => String(result2.testDriveId),
    handler: async (transactionContext, { rooftopId }) => {
      const location = await transactionContext.prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { timezone: true } });
      const scheduled = parseScheduledTime(requestedDate, requestedTime, "Preferred", location?.timezone || "UTC");
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId);
      const rooftop = { connect: { id: rooftopId } };
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone
      });
      const testDrive = await transactionContext.sudo().query.TestDrive.createOne({
        data: {
          rooftop,
          ...requestingAccountId(context) ? { requestedBy: { connect: { id: requestingAccountId(context) } } } : {},
          scheduledTime: scheduled.iso,
          completed: false,
          driverLicenseVerified: false,
          ...vehicle ? { vehicle: { connect: { id: vehicle.id } } } : {},
          lead: {
            create: {
              rooftop,
              customer: { connect: { id: customer.id } },
              firstName,
              lastName,
              email,
              phone,
              source: "website",
              status: "test-drive-scheduled",
              notes: [
                `Test drive request submitted for ${scheduled.date} at ${scheduled.time}.`,
                message ? `Customer notes: ${message}` : null
              ].filter(Boolean).join("\n"),
              ...vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}
            }
          }
        },
        query: "id scheduledTime lead { id }"
      });
      return {
        testDriveId: testDrive.id,
        leadId: testDrive.lead.id,
        scheduledTime: new Date(testDrive.scheduledTime),
        vehicle
      };
    }
  });
}

// features/keystone/mutations/submitTradeIn.ts
var CONDITIONS = /* @__PURE__ */ new Set(["excellent", "good", "fair", "poor"]);
var OWNERSHIP = /* @__PURE__ */ new Set(["own", "financing", "lease"]);
function preliminaryTradeRange(year, mileage, condition) {
  const age = (/* @__PURE__ */ new Date()).getFullYear() - year;
  let base = 3e4 - age * 4500;
  base -= (mileage - age * 12e3) * 0.1;
  base *= { excellent: 1.1, good: 1, fair: 0.85, poor: 0.7 }[condition];
  base = Math.max(base, 2e3);
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1) };
}
async function submitTradeIn(_root, { data }, context) {
  const firstName = requiredText(data.firstName, "First name", 100);
  const lastName = requiredText(data.lastName, "Last name", 100);
  const email = validEmail(data.email);
  const phone = validPhone(data.phone);
  const year = finiteNumber(data.year, "Vehicle year", {
    min: 1980,
    max: (/* @__PURE__ */ new Date()).getFullYear() + 1,
    integer: true
  });
  const mileage = finiteNumber(data.mileage, "Mileage", { min: 0, max: 2e6, integer: true });
  const make = requiredText(data.make, "Make", 100);
  const model = requiredText(data.model, "Model", 100);
  const trim = optionalText(data.trim, 100, "Trim");
  const vin = optionalText(data.vin, 17, "VIN").toUpperCase();
  const condition = requiredText(data.condition, "Condition", 30);
  const ownership = requiredText(data.ownership, "Ownership", 30);
  const payoffAmount = finiteNumber(data.payoffAmount || 0, "Payoff amount", { min: 0, max: 1e7 });
  if (!CONDITIONS.has(condition) || !OWNERSHIP.has(ownership)) {
    throw new SubmissionError("Condition or ownership is invalid.");
  }
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    throw new SubmissionError("VIN must be a valid 17-character identifier when provided.");
  }
  const estimate = preliminaryTradeRange(year, mileage, condition);
  const summary = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  return runPublicSubmission({
    context,
    workflow: "trade-in",
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    identity: publicSubmissionIdentity(email, phone),
    requestToken: data.requestToken,
    honeypot: data.website,
    requestEvidence: {
      firstName,
      lastName,
      email,
      phone,
      year,
      mileage,
      make,
      model,
      trim,
      vin,
      condition,
      ownership,
      payoffAmount,
      interestedVehicleId: optionalText(data.interestedVehicleId, 100, "Interested vehicle")
    },
    aggregateType: "TradeIn",
    topic: "public-trade-in.submitted",
    aggregateId: (result2) => String(result2.tradeInId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.interestedVehicleId, rooftopId);
      const interested = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})` : "No replacement vehicle selected";
      const rooftop = { connect: { id: rooftopId } };
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone
      });
      const tradeIn = await transactionContext.sudo().query.TradeIn.createOne({
        data: {
          rooftop,
          vin,
          year: String(year),
          make,
          model,
          trim,
          mileage,
          condition,
          exteriorCondition: "Storefront appraisal request; detailed exterior inspection pending.",
          interiorCondition: `Ownership: ${ownership}${payoffAmount > 0 ? `; customer-reported payoff: ${formatCurrency(payoffAmount)}` : ""}`,
          lead: {
            create: {
              rooftop,
              customer: { connect: { id: customer.id } },
              firstName,
              lastName,
              email,
              phone,
              source: "website",
              status: "new",
              timeframe: "immediately",
              tradeInVehicle: summary,
              notes: [
                `Trade-in appraisal request for ${summary}.`,
                `Automated preliminary range: ${formatCurrency(estimate.min)}\u2013${formatCurrency(estimate.max)}; not a provider-backed valuation or dealership offer.`,
                `Ownership: ${ownership}${payoffAmount > 0 ? `; customer-reported payoff: ${formatCurrency(payoffAmount)}` : ""}.`,
                `Interested inventory: ${interested}.`
              ].join("\n"),
              ...vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}
            }
          }
        },
        query: "id lead { id }"
      });
      return {
        tradeInId: tradeIn.id,
        leadId: tradeIn.lead.id,
        estimatedMin: estimate.min,
        estimatedMax: estimate.max,
        estimateMode: "automated-preliminary",
        providerRequestSent: false,
        vehicle
      };
    }
  });
}

// features/keystone/mutations/financingPrivacy.ts
function buildFinancingLeadContent(input2) {
  const requestedAmount = input2.requestedAmount == null ? "Requested amount: Not provided (no calculator amount was recorded)." : `Requested amount: ${formatCurrency(input2.requestedAmount)}`;
  const paymentEstimate = input2.monthlyPayment == null ? "Payment estimate: Not provided." : `Estimated payment: ${formatCurrency(input2.monthlyPayment)} / month for ${input2.loanTerm || "unknown"} months at ${input2.apr || "unknown"}% APR`;
  const notes = [
    "Finance options inquiry submitted from storefront.",
    `Selected vehicle: ${input2.vehicleSummary}`,
    requestedAmount,
    paymentEstimate,
    `Planned down payment: ${formatCurrency(input2.downPayment)}`,
    `Trade-in credit: ${formatCurrency(input2.tradeInValue)}`,
    "Customer consented to contact about financing options. Eligibility details must be handled only through an approved restricted lender workflow; this CRM note is not a credit application or decision."
  ].join("\n");
  const taskDescription = [
    `Review finance options inquiry. Selected vehicle: ${input2.vehicleSummary}.`,
    input2.requestedAmount == null ? "Requested amount was not provided." : `Requested amount: ${formatCurrency(input2.requestedAmount)}.`,
    "Use an approved restricted lender workflow for any eligibility or credit data."
  ].join(" ");
  return { notes, taskDescription };
}

// features/keystone/mutations/financingUtils.ts
function financingIdempotencyKey(value, prefix) {
  const provided = String(value || "").trim();
  if (!provided) return `${prefix}_${crypto.randomUUID()}`;
  if (provided.length < 16 || provided.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(provided)) {
    throw new Error("Idempotency key must be 16-200 URL-safe characters");
  }
  return provided;
}
function financingReference() {
  return `FIN-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}
function dollarsToCents(value, label, required7 = false) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0 || required7 && amount <= 0) {
    throw new Error(`${label} must be a valid non-negative amount`);
  }
  return Math.round(amount * 100);
}

// features/keystone/mutations/submitFinancing.ts
var LOAN_TERMS = /* @__PURE__ */ new Set([36, 48, 60, 72, 84]);
function budgetRange(amount) {
  if (amount < 2e4) return "under-20k";
  if (amount < 3e4) return "20-30k";
  if (amount < 4e4) return "30-40k";
  if (amount < 5e4) return "40-50k";
  if (amount < 75e3) return "50-75k";
  if (amount < 1e5) return "75-100k";
  return "over-100k";
}
async function submitFinancing(_root, { data }, context) {
  const fullName = requiredText(data.fullName, "Full name", 200);
  const email = validEmail(data.email);
  const phone = validPhone(data.phone);
  const employmentStatus = requiredText(data.employmentStatus, "Employment status", 100);
  const creditTier = requiredText(data.creditTier, "Credit range", 100);
  const annualIncome = finiteNumber(data.annualIncome, "Annual income", { min: 1, max: 1e8 });
  const requestedAmount = data.requestedAmount == null ? null : finiteNumber(data.requestedAmount, "Requested amount", { min: 0, max: 1e7 });
  const monthlyPayment = data.monthlyPayment == null ? null : finiteNumber(data.monthlyPayment, "Monthly payment", { min: 0, max: 1e6 });
  const downPayment = finiteNumber(data.downPayment || 0, "Down payment", { min: 0, max: 1e7 });
  const tradeInValue = finiteNumber(data.tradeInValue || 0, "Trade-in value", { min: 0, max: 1e7 });
  const apr = finiteNumber(data.apr || 0, "APR", { min: 0, max: 40 });
  const loanTerm = finiteNumber(data.loanTerm || 0, "Loan term", { min: 0, max: 120, integer: true });
  if (loanTerm && !LOAN_TERMS.has(loanTerm)) throw new SubmissionError("Loan term is unsupported.");
  if (data.consent !== true || data.privacyAcknowledged !== true) {
    throw new SubmissionError("Contact consent and the privacy acknowledgment are required.");
  }
  const idempotencyKey2 = publicSubmissionIdempotencyKey(data.idempotencyKey);
  const { firstName, lastName } = splitCustomerName(fullName, "Finance", "Applicant");
  return runPublicSubmission({
    context,
    workflow: "financing",
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: idempotencyKey2,
    identity: publicSubmissionIdentity(email, phone),
    requestToken: data.requestToken,
    honeypot: data.website,
    requestEvidence: {
      fullName,
      email,
      phone,
      employmentStatus,
      creditTier,
      annualIncome,
      requestedAmount,
      monthlyPayment,
      downPayment,
      tradeInValue,
      apr,
      loanTerm,
      vehicleId: data.vehicleId || null,
      consent: true,
      privacyAcknowledged: true
    },
    aggregateType: "FinancingApplication",
    topic: "financing-application.submitted",
    aggregateId: (result2) => String(result2.applicationId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId);
      const sudo = transactionContext.sudo();
      const existing = await sudo.query.FinancingApplication.findMany({
        where: { idempotencyKey: { equals: idempotencyKey2 } },
        take: 1,
        query: `
          id reference rooftop { id }
          lead { id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate } }
          vehicle { id vin stockNumber year make model price status }
        `
      });
      if (existing.length) {
        const application2 = existing[0];
        if (application2.rooftop?.id !== rooftopId) throw new SubmissionError("The idempotency key conflicts with another location.", 409, "IDEMPOTENCY_CONFLICT");
        const task2 = application2.lead?.tasks?.[0];
        return {
          applicationId: application2.id,
          applicationReference: application2.reference,
          leadId: application2.lead?.id || null,
          taskId: task2?.id || null,
          followUpDueAt: task2?.dueDate ? new Date(task2.dueDate) : null,
          vehicle: application2.vehicle || null,
          applicationStatus: "submitted",
          providerMode: "operator-recorded",
          providerRequestSent: false
        };
      }
      const due = /* @__PURE__ */ new Date();
      due.setDate(due.getDate() + 1);
      const now = /* @__PURE__ */ new Date();
      const reference2 = financingReference();
      const requestedAmountCents = requestedAmount == null ? null : dollarsToCents(requestedAmount, "Requested amount");
      const plannedMonthlyPaymentCents = monthlyPayment == null ? null : dollarsToCents(monthlyPayment, "Monthly payment");
      const plannedDownPaymentCents = dollarsToCents(downPayment, "Down payment");
      const tradeInValueCents = dollarsToCents(tradeInValue, "Trade-in value");
      const annualIncomeCents = dollarsToCents(annualIncome, "Annual income", true);
      const aprBasisPoints = Math.round(apr * 100);
      const rooftop = { connect: { id: rooftopId } };
      const vehicleSummary = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})` : "No vehicle selected";
      const { notes, taskDescription } = buildFinancingLeadContent({
        vehicleSummary,
        requestedAmount,
        monthlyPayment,
        downPayment,
        tradeInValue,
        apr,
        loanTerm
      });
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone
      });
      const lead = await sudo.query.Lead.createOne({
        data: {
          rooftop,
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          email,
          phone,
          source: "website",
          status: "new",
          timeframe: "immediately",
          ...requestedAmount != null && requestedAmount > 0 ? { budgetRange: budgetRange(requestedAmount) } : {},
          notes,
          ...vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {},
          tasks: {
            create: [{
              rooftop,
              title: `F&I follow-up: ${fullName}`,
              description: taskDescription,
              priority: "high",
              completed: false,
              dueDate: due.toISOString()
            }]
          }
        },
        query: "id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate }"
      });
      const immutableSnapshot = {
        version: 2,
        reference: reference2,
        applicant: {
          fullName,
          email,
          phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier
        },
        requestedTerms: {
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null
        },
        vehicle: vehicle ? {
          id: vehicle.id,
          vin: vehicle.vin,
          stockNumber: vehicle.stockNumber,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model
        } : null,
        consentAt: now.toISOString(),
        privacyAcknowledgedAt: now.toISOString(),
        providerMode: "operator-recorded",
        providerRequestSent: false
      };
      const application = await sudo.query.FinancingApplication.createOne({
        data: {
          rooftop,
          reference: reference2,
          idempotencyKey: idempotencyKey2,
          status: "submitted",
          lead: { connect: { id: lead.id } },
          ...vehicle ? { vehicle: { connect: { id: vehicle.id } } } : {},
          applicantName: fullName,
          applicantEmail: email,
          applicantPhone: phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier,
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null,
          consentAt: now.toISOString(),
          submittedAt: now.toISOString(),
          lockedAt: now.toISOString(),
          immutableSnapshot
        },
        query: "id reference"
      });
      const task = lead.tasks[0];
      return {
        applicationId: application.id,
        applicationReference: application.reference,
        leadId: lead.id,
        taskId: task.id,
        followUpDueAt: task.dueDate ? new Date(task.dueDate) : null,
        vehicle,
        applicationStatus: "submitted",
        providerMode: "operator-recorded",
        providerRequestSent: false
      };
    }
  });
}

// features/keystone/mutations/submitServiceBooking.ts
var SERVICES = {
  oil_change: { serviceType: "maintenance", label: "Oil Change", duration: 45 },
  brake_service: { serviceType: "repair", label: "Brake Service", duration: 120 },
  battery_service: { serviceType: "maintenance", label: "Battery Service", duration: 60 },
  diagnostics: { serviceType: "diagnostic", label: "Diagnostics", duration: 90 },
  tire_service: { serviceType: "maintenance", label: "Tire Service", duration: 90 },
  state_inspection: { serviceType: "inspection", label: "State Inspection", duration: 60 },
  scheduled_maintenance: { serviceType: "maintenance", label: "Scheduled Maintenance", duration: 120 },
  repair: { serviceType: "repair", label: "Repair", duration: 120 },
  other: { serviceType: "diagnostic", label: "Other / Initial Diagnosis", duration: 90 }
};
async function submitServiceBooking(_root, { data }, context) {
  const customerName = requiredText(data.customerName, "Customer name", 200);
  const email = validEmail(data.customerEmail);
  const phone = validPhone(data.customerPhone);
  const year = finiteNumber(data.vehicleYear, "Vehicle year", {
    min: 1900,
    max: (/* @__PURE__ */ new Date()).getFullYear() + 1,
    integer: true
  });
  const make = requiredText(data.vehicleMake, "Vehicle make", 100);
  const model = requiredText(data.vehicleModel, "Vehicle model", 100);
  const vin = optionalText(data.vehicleVin, 17, "VIN").toUpperCase();
  const serviceKey = requiredText(data.serviceType, "Service type", 100);
  const service = SERVICES[serviceKey];
  if (!service) throw new SubmissionError("A supported service is required.");
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    throw new SubmissionError("VIN must be a valid 17-character identifier when provided.");
  }
  const requestedDate = requiredText(data.appointmentDate, "Appointment date", 10);
  const requestedTime = requiredText(data.appointmentTime, "Appointment time", 20);
  const concern = optionalText(data.description, 4e3, "Service concern") || `${service.label} requested from storefront.`;
  const vehicleDescription = `${year} ${make} ${model}${vin ? ` \xB7 VIN ${vin}` : ""}`;
  const { firstName, lastName } = splitCustomerName(customerName, "Service", "Customer");
  return runPublicSubmission({
    context,
    workflow: "service",
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    identity: publicSubmissionIdentity(email, phone),
    requestToken: data.requestToken,
    honeypot: data.website,
    requestEvidence: {
      customerName,
      email,
      phone,
      year,
      make,
      model,
      vin,
      serviceKey,
      requestedDate,
      requestedTime,
      concern
    },
    aggregateType: "ServiceAppointment",
    topic: "public-service-appointment.submitted",
    aggregateId: (result2) => String(result2.serviceAppointmentId),
    handler: async (transactionContext, { rooftopId }) => {
      const location = await transactionContext.prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { timezone: true } });
      const scheduled = parseScheduledTime(requestedDate, requestedTime, "Appointment", location?.timezone || "UTC");
      const slotStart = new Date(scheduled.iso);
      slotStart.setUTCMinutes(0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1e3);
      const capacitySlot = slotStart.toISOString();
      await transactionContext.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service-capacity:${rooftopId}:${capacitySlot}`}, 0))`;
      const scheduledCount = await transactionContext.prisma.serviceAppointment.count({
        where: {
          rooftopId,
          appointmentDate: { gte: slotStart, lt: slotEnd },
          status: { not: "cancelled" }
        }
      });
      if (scheduledCount >= 4) {
        throw new SubmissionError("That service capacity slot is full. Choose another time.");
      }
      const rooftop = { connect: { id: rooftopId } };
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone
      });
      const appointment = await transactionContext.sudo().query.ServiceAppointment.createOne({
        data: {
          rooftop,
          ...requestingAccountId(context) ? { requestedBy: { connect: { id: requestingAccountId(context) } } } : {},
          appointmentDate: scheduled.iso,
          serviceType: service.serviceType,
          status: "scheduled",
          vehicleVin: vin || "",
          transportationNeed: "drop-off",
          capacitySlot,
          customerVehicleDescription: vehicleDescription,
          description: concern,
          estimatedDuration: service.duration,
          advisorNotes: [
            `Requested service: ${service.label}`,
            `Requested slot: ${scheduled.date} at ${scheduled.time}`,
            vin ? `Customer vehicle VIN: ${vin}` : "Customer vehicle VIN not provided"
          ].join("\n"),
          lead: {
            create: {
              rooftop,
              customer: { connect: { id: customer.id } },
              firstName,
              lastName,
              email,
              phone,
              source: "website",
              status: "new",
              timeframe: "immediately",
              notes: [
                `Service appointment request for ${service.label}.`,
                `Customer vehicle: ${vehicleDescription}.`,
                `Requested slot: ${scheduled.date} at ${scheduled.time}.`,
                `Customer concern: ${concern}`
              ].join("\n")
            }
          }
        },
        query: "id appointmentDate serviceType status lead { id }"
      });
      return {
        serviceAppointmentId: appointment.id,
        leadId: appointment.lead.id,
        appointmentDate: new Date(appointment.appointmentDate),
        serviceType: appointment.serviceType,
        status: appointment.status,
        requestedServiceLabel: service.label
      };
    }
  });
}

// features/keystone/mutations/publicSubmissionResolver.ts
function publicSubmissionResolver(service) {
  return async (root, args, context) => {
    try {
      return {
        ok: true,
        errorCode: null,
        errorMessage: null,
        ...await service(root, args, context)
      };
    } catch (error) {
      if (error instanceof SubmissionError) {
        return {
          ok: false,
          errorCode: error.submissionCode,
          errorMessage: error.message
        };
      }
      console.error("Unexpected public submission error:", error);
      return {
        ok: false,
        errorCode: "SUBMISSION_FAILED",
        errorMessage: "Unable to process this request. Please try again or contact the dealership."
      };
    }
  };
}

// features/keystone/mutations/storefrontProfile.ts
function text70(value) {
  return typeof value === "string" ? value.trim() : "";
}
function phoneHref(phone) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}
async function storefrontProfile(_root, { rooftopSlug }, context) {
  const publicSlug = publicSubmissionRooftopSlug(rooftopSlug);
  const rooftopId = await resolvePublicRooftopId(context, publicSlug);
  const profile = await context.sudo().query.DealershipProfile.findOne({
    where: { id: 1 },
    query: `
      id name shortName salesEmail serviceEmail phone
      addressLine1 addressLine2 city state postalCode
      hoursMonFri hoursSaturday hoursSunday websiteUrl currencyCode
      homepageTitle homepageDescription logoIcon logoColor
    `
  });
  const fullName = text70(profile?.name);
  const shortName = text70(profile?.shortName);
  const phone = text70(profile?.phone);
  const locality = [profile?.city, profile?.state, profile?.postalCode].map(text70).filter(Boolean).join(", ");
  return {
    configured: Boolean(profile && fullName && shortName),
    rooftopId,
    rooftopSlug: publicSlug,
    fullName,
    shortName,
    salesEmail: text70(profile?.salesEmail),
    serviceEmail: text70(profile?.serviceEmail),
    phoneDisplay: phone,
    phoneHref: phoneHref(phone),
    addressLine1: text70(profile?.addressLine1),
    addressLine2: [text70(profile?.addressLine2), locality].filter(Boolean).join(" \xB7 "),
    hoursMonFri: text70(profile?.hoursMonFri),
    hoursSaturday: text70(profile?.hoursSaturday),
    hoursSunday: text70(profile?.hoursSunday),
    websiteUrl: text70(profile?.websiteUrl),
    currencyCode: text70(profile?.currencyCode).toUpperCase(),
    homepageTitle: text70(profile?.homepageTitle),
    homepageDescription: text70(profile?.homepageDescription),
    logoIcon: sanitizeStoreLogoSvg(text70(profile?.logoIcon)),
    logoColor: normalizeStorefrontLogoHue(profile?.logoColor)
  };
}

// features/keystone/lifecycle/financePrerequisites.ts
var import_zod = require("zod");

// features/keystone/integrations/financing/providerRegistry.ts
var operatorRecordedAdapter = Object.freeze({
  key: "operator-recorded",
  label: "Operator-recorded external lender review",
  async submit() {
    return {
      status: "queued",
      externalReference: null,
      responseSummary: {
        mode: "operator-recorded",
        externalRequestSent: false
      }
    };
  }
});
var FINANCING_PROVIDER_ADAPTERS = Object.freeze({
  [operatorRecordedAdapter.key]: operatorRecordedAdapter
});
function resolveFinancingProviderAdapter(providerKey) {
  const adapter = FINANCING_PROVIDER_ADAPTERS[providerKey];
  if (!adapter) throw new Error("Unsupported financing provider");
  return adapter;
}
function financingPrerequisiteCapability(providerKey) {
  resolveFinancingProviderAdapter(providerKey);
  if (providerKey !== "operator-recorded") throw new Error("Configured provider prerequisite verification is unavailable");
  return {
    providerKey,
    configurationVersion: 1,
    mode: "operator-recorded",
    humanReviewRequired: true,
    externalRequestSent: false,
    documentSignatureVerified: false,
    legalPolicyVerified: false,
    fundingSettlementVerified: false
  };
}
function financingProviderKeys() {
  return Object.keys(FINANCING_PROVIDER_ADAPTERS);
}

// features/keystone/lifecycle/financePrerequisites.ts
var text71 = import_zod.z.string().trim().min(1).max(1e3);
var date = import_zod.z.date().refine((value) => Number.isFinite(value.getTime()));
var parent = import_zod.z.object({ id: text71, dealId: text71, rooftopId: text71, updatedAt: date });
var documents = import_zod.z.array(import_zod.z.object({ code: text71, status: text71 })).max(100);
var contractSchema = parent.extend({
  status: import_zod.z.literal("signed"),
  providerKey: text71,
  envelopeReference: text71,
  requiredDocuments: import_zod.z.array(text71).min(1).max(100),
  documentChecklist: documents,
  signedAt: date,
  immutableStatusEvidence: import_zod.z.object({ evidenceReference: text71 }).passthrough()
});
var menuSchema = parent.extend({
  version: import_zod.z.number().int().positive(),
  status: import_zod.z.enum(["accepted", "declined"]),
  optionsSnapshot: import_zod.z.array(import_zod.z.object({ code: text71 }).passthrough()).max(100),
  selectedProductCodes: import_zod.z.array(text71).max(100),
  declinedProductCodes: import_zod.z.array(text71).max(100),
  disclosureAcknowledgment: text71,
  decidedAt: date
});
var checkSchema = parent.extend({
  checkType: import_zod.z.enum(["identity", "ofac", "red-flag", "privacy"]),
  providerKey: text71,
  status: import_zod.z.literal("completed"),
  requestedAt: date,
  completedAt: date,
  requestSnapshot: import_zod.z.unknown(),
  resultSnapshot: import_zod.z.object({ evidenceReference: text71 }).passthrough()
});
function revision(row) {
  const json34 = stableJson(row);
  if (!json34 || json34.length > 128e3) throw new Error("Prerequisite evidence exceeds bounded review projection");
  return { id: row.id, status: row.status, updatedAt: row.updatedAt.toISOString(), revisionHash: domainEventRequestHash(row), ...row.providerKey ? { providerKey: row.providerKey } : {} };
}
async function readCurrentPrerequisites(tx, deal) {
  const where = { dealId: deal.id, rooftopId: deal.rooftopId };
  const requiredChecks = ["identity", "ofac", "red-flag", "privacy"];
  const [rawContract, rawMenu, checkGroups] = await Promise.all([
    tx.prisma.financeContractPackage.findFirst({ where }),
    tx.prisma.financeMenuVersion.findFirst({ where, orderBy: [{ version: "desc" }, { id: "desc" }] }),
    // Bound each current reader, not the size of preserved historical evidence.
    Promise.all(requiredChecks.map((checkType) => tx.prisma.financeComplianceCheck.findMany({ where: { ...where, checkType }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: 1 })))
  ]);
  const contract = contractSchema.safeParse(rawContract), menu = menuSchema.safeParse(rawMenu);
  if (!contract.success || !menu.success) throw new Error("Current signed contract, decided menu and bounded compliance prerequisites are required");
  for (const artifact of [contract.data, menu.data]) if (artifact.dealId !== deal.id || artifact.rooftopId !== deal.rooftopId) throw new Error("Prerequisite belongs to a different deal or rooftop");
  if (new Set(contract.data.requiredDocuments).size !== contract.data.requiredDocuments.length || new Set(contract.data.documentChecklist.map((item) => item.code)).size !== contract.data.documentChecklist.length || !contract.data.requiredDocuments.every((code) => contract.data.documentChecklist.some((item) => item.code === code && item.status === "complete"))) throw new Error("Current contract documents are incomplete or contradictory");
  const available = menu.data.optionsSnapshot.map((option) => option.code);
  const choices = [...menu.data.selectedProductCodes, ...menu.data.declinedProductCodes];
  if (new Set(available).size !== available.length || new Set(choices).size !== choices.length || choices.length !== available.length || choices.some((code) => !available.includes(code))) throw new Error("Current menu decisions do not cover distinct presented options");
  if (menu.data.status === "accepted" !== menu.data.selectedProductCodes.length > 0) throw new Error("Current menu status contradicts its recorded decisions");
  const compliance = requiredChecks.map((checkType, index) => {
    const parsed = checkSchema.safeParse(checkGroups[index][0]);
    if (checkGroups[index].length !== 1 || !parsed.success || parsed.data.checkType !== checkType || parsed.data.dealId !== deal.id || parsed.data.rooftopId !== deal.rooftopId) throw new Error(`Current ${checkType} compliance prerequisite is unavailable, foreign or not completed`);
    financingPrerequisiteCapability(parsed.data.providerKey);
    return { ...revision(parsed.data), checkType };
  });
  financingPrerequisiteCapability(contract.data.providerKey);
  const snapshot2 = { version: 1, contract: revision(contract.data), menu: { ...revision(menu.data), version: menu.data.version }, compliance };
  return { snapshot: snapshot2, digest: domainEventRequestHash(snapshot2) };
}
var reviewSchema = import_zod.z.object({ eventKey: text71, actorId: text71, afterSnapshot: import_zod.z.object({
  version: import_zod.z.literal(1),
  purpose: import_zod.z.literal("funding-delivery-prerequisite-review"),
  actorId: text71,
  binding: import_zod.z.unknown(),
  digest: text71,
  snapshot: import_zod.z.unknown(),
  policyReference: text71,
  policyVersion: text71,
  reviewerAuthorityReference: text71,
  reviewReference: text71
}) });
async function assertReviewedPrerequisites(tx, deal, expected) {
  const binding = await fundingBinding(tx, deal);
  const current = await readCurrentPrerequisites(tx, deal);
  const raw = await tx.prisma.domainAuditEvent.findFirst({ where: { rooftopId: deal.rooftopId, aggregateType: "Deal", aggregateId: deal.id, action: "prerequisites-reviewed" }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }] });
  const review = reviewSchema.safeParse(raw);
  if (!review.success || review.data.actorId !== review.data.afterSnapshot.actorId || stableJson(review.data.afterSnapshot.binding) !== stableJson(binding) || review.data.afterSnapshot.digest !== current.digest || stableJson(review.data.afterSnapshot.snapshot) !== stableJson(current.snapshot)) throw new Error("Prerequisite revisions need explicit review against current accepted terms and configured policy");
  const evidence = {
    ...current,
    reviewEventKey: review.data.eventKey,
    binding,
    policyReference: review.data.afterSnapshot.policyReference,
    policyVersion: review.data.afterSnapshot.policyVersion,
    reviewerAuthorityReference: review.data.afterSnapshot.reviewerAuthorityReference,
    capability: financingPrerequisiteCapability("operator-recorded")
  };
  if (expected !== void 0 && stableJson(expected) !== stableJson(evidence)) throw new Error("Funding prerequisite revisions or review were invalidated; review and reconfirm");
  return evidence;
}
async function prerequisiteReadiness(tx, deal) {
  let digest = null, snapshot2 = null;
  try {
    const current = await readCurrentPrerequisites(tx, deal);
    digest = current.digest;
    snapshot2 = current.snapshot;
    const reviewed = await assertReviewedPrerequisites(tx, deal);
    return { current: true, digest, snapshot: snapshot2, reviewEventKey: reviewed.reviewEventKey, issue: null, capability: reviewed.capability };
  } catch (error) {
    return { current: false, digest, snapshot: snapshot2, reviewEventKey: null, issue: error instanceof Error ? error.message : "Prerequisite authority unavailable", capability: financingPrerequisiteCapability("operator-recorded") };
  }
}

// features/keystone/lifecycle/dealFinanceEvidence.ts
var TERM_FIELDS = [
  "vehiclePriceCents",
  "tradeInValueCents",
  "downPaymentCents",
  "financingAmountCents",
  "monthlyPaymentCents",
  "taxAmountCents",
  "loanTerm",
  "apr",
  "residualValueCents",
  "moneyFactorBasisPoints",
  "fees",
  "rebates",
  "products",
  "taxLines",
  "grossCents"
];
function worksheetTerms(deal) {
  return Object.fromEntries(TERM_FIELDS.map((field) => [field, deal[field] ?? null]));
}
function worksheetBinding(deal) {
  const identity = {
    dealId: deal.id,
    rooftopId: deal.rooftopId,
    vehicleId: deal.vehicleId,
    leadId: deal.leadId,
    tradeInVehicleId: deal.tradeInVehicleId ?? null,
    worksheetVersion: deal.worksheetVersion,
    structureType: deal.structureType
  };
  return { ...identity, worksheetHash: domainEventRequestHash({ ...identity, terms: worksheetTerms(deal) }) };
}
function assertAcceptedWorksheet(deal) {
  const presented = deal.presentedSnapshot;
  const accepted = deal.acceptedSnapshot;
  const submitted = deal.evidenceSnapshot;
  const expectedSubmitted = buildDealEvidenceSnapshot({
    ...deal,
    lead: deal.leadId ? { id: deal.leadId } : null,
    vehicle: submitted?.vehicle,
    // Keep original vehicle description; identity is checked below.
    salesperson: deal.salespersonId ? { id: deal.salespersonId } : null,
    tradeInVehicle: deal.tradeInVehicleId ? { id: deal.tradeInVehicleId } : null,
    selectedLenderDecision: deal.selectedLenderDecisionId ? { id: deal.selectedLenderDecisionId } : null
  });
  if (!deal.presentedAt || !deal.acceptedAt || !deal.lockedAt || deal.worksheetVersion < 1 || presented?.dealId !== deal.id || accepted?.dealId !== deal.id || presented?.worksheetVersion !== deal.worksheetVersion || accepted?.worksheetVersion !== deal.worksheetVersion || submitted?.worksheetVersion !== deal.worksheetVersion || presented?.structureType !== deal.structureType || submitted?.structureType !== deal.structureType || presented?.vehicleId !== deal.vehicleId || presented?.leadId !== deal.leadId || submitted?.vehicle?.id !== deal.vehicleId || submitted?.leadId !== deal.leadId || stableJson(worksheetTerms(presented?.terms || {})) !== stableJson(worksheetTerms(deal)) || stableJson(submitted) !== stableJson(expectedSubmitted) || stableJson(presented?.pricing) !== stableJson(calculateDealPrice(deal)) || stableJson(submitted?.pricing) !== stableJson(calculateDealPrice(deal)) || stableJson(accepted?.presentedSnapshot) !== stableJson(presented)) {
    throw new Error("Current presented, accepted, and submitted worksheet evidence is required; reopen and reconfirm");
  }
}
async function lockDeal(tx, dealId) {
  await tx.prisma.$queryRaw`SELECT "id" FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`;
}
async function currentDealAuthority(tx, session, dealId, required7) {
  if (!session?.itemId || session.listKey !== "User") throw new Error("Authentication required");
  const user = await tx.prisma.user.findUnique({ where: { id: session.itemId }, include: {
    role: true,
    dealerGroupMemberships: { include: { role: true, dealerGroup: { select: { id: true } } } },
    rooftopMemberships: { include: { role: true, rooftop: { include: { dealerGroup: { select: { id: true } } } } } }
  } });
  if (!user) throw new Error("Current actor is unavailable");
  const current = tx.withSession({ ...session, data: { ...session.data, ...user } });
  const visible = await current.query.Deal.findOne({ where: { id: dealId }, query: "id rooftop { id }" });
  if (!visible?.rooftop?.id) throw new Error("Deal not found or not accessible");
  for (const permission of required7) await assertSessionRooftopPermission(current, visible.rooftop.id, permission);
  return { context: current, rooftopId: visible.rooftop.id };
}
async function readLockedFunding(tx, dealId) {
  await tx.prisma.$queryRaw`SELECT "id" FROM "FinanceFundingCase" WHERE "deal" = ${dealId} FOR UPDATE`;
  return tx.prisma.financeFundingCase.findFirst({ where: { dealId } });
}
async function assertCurrentSelectedOffer(tx, deal) {
  if (deal.structureType === "cash") return null;
  if (!deal.selectedLenderDecisionId) throw new Error("Select and reconfirm a lender offer for the current worksheet");
  const decision = await tx.prisma.lenderDecision.findUnique({ where: { id: deal.selectedLenderDecisionId }, include: { application: { select: { id: true, leadId: true, rooftopId: true } } } });
  if (!decision || decision.rooftopId !== deal.rooftopId || decision.application?.rooftopId !== deal.rooftopId || decision.application?.leadId !== deal.leadId || !["approved", "conditional"].includes(decision.decision) || Number(decision.approvedAmountCents || 0) < Number(deal.financingAmountCents || 0)) {
    throw new Error("Selected lender offer no longer covers the current worksheet or authority");
  }
  const event2 = await tx.prisma.domainAuditEvent.findFirst({
    where: { rooftopId: deal.rooftopId, aggregateType: "Deal", aggregateId: deal.id, action: "lender-offer-selected" },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }]
  });
  if (event2?.afterSnapshot?.lenderDecisionId !== decision.id || stableJson(event2?.afterSnapshot?.binding) !== stableJson(worksheetBinding(deal))) {
    throw new Error("Selected lender evidence is unbound or stale; reconfirm it for the current worksheet");
  }
  return event2.eventKey;
}
async function fundingBinding(tx, deal) {
  assertAcceptedWorksheet(deal);
  const [vehicle, lead] = await Promise.all([
    tx.prisma.vehicle.findUnique({ where: { id: deal.vehicleId }, select: { id: true, rooftopId: true } }),
    tx.prisma.lead.findUnique({ where: { id: deal.leadId }, select: { id: true, rooftopId: true } })
  ]);
  if (vehicle?.id !== deal.vehicleId || vehicle?.rooftopId !== deal.rooftopId || lead?.id !== deal.leadId || lead?.rooftopId !== deal.rooftopId) throw new Error("Current financing deal/vehicle/lead parent authority changed");
  const selectionEventKey = await assertCurrentSelectedOffer(tx, deal);
  return {
    ...worksheetBinding(deal),
    selectedLenderDecisionId: deal.selectedLenderDecisionId ?? null,
    selectionEventKey,
    acceptedHash: domainEventRequestHash(deal.acceptedSnapshot),
    submittedHash: domainEventRequestHash(deal.evidenceSnapshot)
  };
}
async function assertCurrentFunding(tx, deal, funding, currentPrerequisites = true) {
  const binding = await fundingBinding(tx, deal);
  if (!funding || funding.dealId !== deal.id || funding.rooftopId !== deal.rooftopId || funding.status !== "funded" || !String(funding.fundingReference || "").trim() || !funding.fundedAt || funding.immutableEvidence?.version !== 2 || stableJson(funding.immutableEvidence?.binding) !== stableJson(binding) || funding.immutableEvidence?.status !== "funded" || funding.immutableEvidence?.fundedAt !== funding.fundedAt.toISOString() || funding.immutableEvidence?.fundingReference !== funding.fundingReference) {
    throw new Error("Current worksheet-bound funded evidence and reference are required; reconfirm funding");
  }
  if (currentPrerequisites) {
    if (!funding.immutableEvidence.prerequisites?.reviewEventKey) throw new Error("Historical funding prerequisites are unbound; explicitly review and reconfirm");
    await assertReviewedPrerequisites(tx, deal, funding.immutableEvidence.prerequisites);
  }
  return binding;
}
async function financeEvidenceReadiness(tx, deal) {
  const funding = await tx.prisma.financeFundingCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId } });
  let selectedOfferCurrent = deal.structureType === "cash";
  let fundingCurrent = false;
  let issue = null;
  try {
    await assertCurrentSelectedOffer(tx, deal);
    selectedOfferCurrent = true;
  } catch (error) {
    issue = error.message;
  }
  try {
    await assertCurrentFunding(tx, deal, funding);
    fundingCurrent = true;
  } catch (error) {
    issue ||= error.message;
  }
  return {
    worksheetVersion: deal.worksheetVersion,
    selectedOfferCurrent,
    fundingCurrent,
    fundingStatus: funding?.status ?? null,
    fundingReference: funding?.fundingReference ?? null,
    fundingUpdatedAt: funding?.updatedAt?.toISOString() ?? null,
    fundingWorksheetVersion: funding?.immutableEvidence?.binding?.worksheetVersion ?? null,
    prerequisites: await prerequisiteReadiness(tx, deal),
    issue
  };
}

// features/keystone/mutations/transitionDeal.ts
function transitionPermissions(session) {
  return {
    canManageDeals: permissions.canManageDeals({ session }),
    canApproveDeals: permissions.canApproveDeals({ session }),
    canManageFinancing: permissions.canManageFinancing({ session })
  };
}
var DEAL_EVIDENCE_QUERY = `
  id status updatedAt lockedAt evidenceSnapshot saleDate worksheetVersion presentedSnapshot presentedAt acceptedSnapshot acceptedAt structureType rebates products taxLines residualValueCents moneyFactorBasisPoints grossCents
  rooftop { id }
  vehiclePrice tradeInValue downPayment financingAmount monthlyPayment loanTerm apr taxAmount fees
  vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents
  lead { id }
  vehicle { id vin stockNumber year make model trim status priceCents }
  selectedLenderDecision { id decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents providerKey }
  salesperson { id }
  tradeInVehicle { id }
`;
async function transitionDeal(_root, { id, toStatus, notes, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId) throw new Error("Authentication required");
  const commandKey4 = String(idempotencyKey2 || "").trim();
  if (toStatus === "delivered") throw new Error("Deal delivery must use completeDealDelivery with checklist evidence");
  if (commandKey4.length < 8 || commandKey4.length > 200) throw new Error("A valid idempotency key is required");
  return context.transaction(async (transactionContext) => {
    await lockDeal(transactionContext, id);
    const authority = await currentDealAuthority(transactionContext, context.session, id, []);
    const sessionContext = authority.context;
    const deal = await sessionContext.query.Deal.findOne({
      where: { id },
      query: DEAL_EVIDENCE_QUERY
    });
    if (!deal) throw new Error("Deal not found or not accessible");
    if (!deal.rooftop?.id) throw new Error("Deal rooftop is missing");
    const requiredPermission = toStatus === "approved" || deal.status === "submitted" ? "canApproveDeals" : toStatus === "financed" || ["approved", "financed"].includes(deal.status) ? "canManageFinancing" : "canManageDeals";
    await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, requiredPermission);
    const rawDeal = await transactionContext.prisma.deal.findUnique({ where: { id } });
    if (!rawDeal || rawDeal.rooftopId !== authority.rooftopId) throw new Error("Deal authority changed");
    const eventKey = `deal-transition:${commandKey4}`;
    if (toStatus === "financed") {
      const header = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { actorId: true, rooftopId: true, aggregateType: true, aggregateId: true, action: true } });
      if (header) {
        if (header.actorId !== context.session.itemId || header.rooftopId !== rawDeal.rooftopId || header.aggregateType !== "Deal" || header.aggregateId !== id || header.action !== "transitioned:financed") throw new Error("Financing retry is outside original actor/purpose scope");
        const prior = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
        const original = prior?.afterSnapshot;
        const vehicle = await transactionContext.prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId }, select: { id: true, rooftopId: true } });
        const lead = await transactionContext.prisma.lead.findUnique({ where: { id: rawDeal.leadId }, select: { id: true, rooftopId: true } });
        if (original?.dealId !== id || original.toStatus !== toStatus || original.notes !== String(notes || "").trim() || original.worksheet?.dealId !== id || original.worksheet?.rooftopId !== rawDeal.rooftopId || original.worksheet?.vehicleId !== rawDeal.vehicleId || original.worksheet?.leadId !== rawDeal.leadId || !original.fundingAuthority?.id || !vehicle || !lead || vehicle.rooftopId !== rawDeal.rooftopId || lead.rooftopId !== rawDeal.rooftopId) throw new Error("Financing retry changed or current related identity is unavailable");
        const readback = await sessionContext.db.Deal.findOne({ where: { id } });
        if (!readback) throw new Error("Committed financing readback unavailable in current scope; reconcile the original receipt");
        return readback;
      }
    }
    const negotiatedPriceCents = Math.round(Number(deal.vehiclePrice || 0) * 100);
    const retailPriceCents = Number(deal.vehicle?.priceCents || 0);
    const approvalRequirements = {
      managerApproval: true,
      financeApproval: ["finance", "lease"].includes(deal.structureType),
      seniorApproval: Number(deal.grossCents || 0) < 0 || retailPriceCents > 0 && negotiatedPriceCents < Math.round(retailPriceCents * 0.9)
    };
    let fundingAuthority = null;
    if (toStatus === "approved") {
      if (approvalRequirements.financeApproval) await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, "canManageFinancing");
      assertAcceptedWorksheet(rawDeal);
      await assertCurrentSelectedOffer(transactionContext, rawDeal);
      if (approvalRequirements.seniorApproval) await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, "canManageDealerships");
    }
    if (toStatus === "financed") {
      const funding = await readLockedFunding(transactionContext, deal.id);
      await assertCurrentFunding(transactionContext, rawDeal, funding);
      fundingAuthority = { id: funding.id, updatedAt: funding.updatedAt.toISOString(), fundingReference: funding.fundingReference, evidenceHash: domainEventRequestHash(funding.immutableEvidence) };
    }
    const requestEvidence = {
      dealId: id,
      toStatus,
      notes: String(notes || "").trim(),
      approvalRequirements,
      worksheet: worksheetBinding(rawDeal),
      acceptedHash: domainEventRequestHash(rawDeal.acceptedSnapshot),
      fundingAuthority
    };
    const replay = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } });
    if (replay) {
      if (replay.aggregateId !== id) throw new Error("Deal transition idempotency key belongs to another deal");
      await recordDomainEventInTransaction(transactionContext, {
        eventKey,
        rooftopId: deal.rooftop.id,
        aggregateType: "Deal",
        aggregateId: id,
        action: `transitioned:${toStatus}`,
        topic: "deal.transitioned",
        actorId: context.session.itemId,
        afterSnapshot: requestEvidence,
        payload: {
          dealId: id,
          rooftopId: deal.rooftop.id,
          status: toStatus,
          vehicleId: deal.vehicle?.id ?? null,
          vehicleStatus: toStatus === "submitted" ? "pending" : toStatus === "cancelled" && deal.status !== "pencil" ? "available" : null
        }
      });
      return sessionContext.db.Deal.findOne({ where: { id } });
    }
    assertDealTransition(deal.status, toStatus, transitionPermissions(sessionContext.session));
    const now = /* @__PURE__ */ new Date();
    const update = { status: toStatus };
    if (toStatus === "submitted") {
      if (!deal.vehicle?.id) throw new Error("A vehicle is required before deal submission");
      if (!deal.acceptedAt || !deal.acceptedSnapshot || Object.keys(deal.acceptedSnapshot).length === 0) throw new Error("Accepted worksheet evidence is required before submission");
      if (Number(deal.acceptedSnapshot.worksheetVersion || 0) !== Number(deal.worksheetVersion || 0)) throw new Error("The current worksheet version must be presented and accepted before submission");
      const vehicleState = await transactionContext.prisma.vehicle.findUnique({ where: { id: deal.vehicle.id }, select: { status: true } });
      if (vehicleState?.status === "available") {
        const reserved = await transactionContext.prisma.vehicle.updateMany({ where: { id: deal.vehicle.id, status: "available" }, data: { status: "pending" } });
        if (reserved.count !== 1) throw new Error("Vehicle is no longer available for this deal");
      } else if (vehicleState?.status === "pending") {
        const competing = await transactionContext.prisma.deal.count({ where: { id: { not: deal.id }, vehicleId: deal.vehicle.id, status: { in: ["submitted", "approved", "financed"] } } });
        if (competing > 0) throw new Error("Vehicle is reserved by another active deal");
      } else {
        throw new Error("Vehicle is no longer available for this deal");
      }
      update.lockedAt = now;
      update.evidenceSnapshot = buildDealEvidenceSnapshot(deal);
    }
    const changed = await transactionContext.prisma.deal.updateMany({
      where: { id, rooftopId: authority.rooftopId, worksheetVersion: rawDeal.worksheetVersion, status: deal.status, updatedAt: new Date(deal.updatedAt) },
      data: update
    });
    if (changed.count !== 1) throw new Error("Deal changed concurrently; reload before retrying");
    const decision = toStatus === "submitted" ? "pending" : toStatus === "approved" ? "approved" : deal.status === "submitted" && toStatus === "cancelled" ? "rejected" : null;
    if (decision) {
      await transactionContext.prisma.dealApproval.create({
        data: {
          rooftopId: deal.rooftop.id,
          dealId: id,
          approverId: context.session.itemId,
          decision,
          notes: String(notes || "").trim(),
          approvalDate: now
        }
      });
    }
    if (toStatus === "cancelled" && deal.status !== "pencil" && deal.vehicle?.id) {
      const released = await transactionContext.prisma.vehicle.updateMany({
        where: { id: deal.vehicle.id, status: "pending" },
        data: { status: "available" }
      });
      if (released.count !== 1) throw new Error("Reserved vehicle could not be released");
    }
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: deal.rooftop.id,
      aggregateType: "Deal",
      aggregateId: id,
      action: `transitioned:${toStatus}`,
      topic: "deal.transitioned",
      actorId: context.session.itemId,
      afterSnapshot: requestEvidence,
      payload: {
        dealId: id,
        rooftopId: deal.rooftop.id,
        status: toStatus,
        vehicleId: deal.vehicle?.id ?? null,
        vehicleStatus: toStatus === "submitted" ? "pending" : toStatus === "cancelled" && deal.status !== "pencil" ? "available" : null
      }
    });
    return sessionContext.db.Deal.findOne({ where: { id } });
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}

// features/keystone/lifecycle/serviceOrderAuthority.ts
async function lockServiceOrder(tx, id) {
  const locked = await tx.prisma.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`;
  if (!Array.isArray(locked)) throw new Error("Service lock is unavailable");
}
async function currentServiceOrderAuthority(tx, session, id) {
  if (!session?.itemId || session.listKey !== "User") throw new Error("Authentication required");
  const user = await tx.prisma.user.findUnique({ where: { id: session.itemId }, include: {
    role: true,
    dealerGroupMemberships: { include: { role: true, dealerGroup: { select: { id: true } } } },
    rooftopMemberships: { include: { role: true, rooftop: { include: { dealerGroup: { select: { id: true } } } } } }
  } });
  if (!user || user.id !== session.itemId) throw new Error("Current actor is unavailable");
  const context = tx.withSession({ ...session, data: { ...session.data, ...user } });
  const visible = await context.query.ServiceOrder.findOne({ where: { id }, query: "id rooftop { id }" });
  if (!visible?.rooftop?.id) throw new Error("Service order not found or not accessible");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageService");
  return { context, rooftopId: visible.rooftop.id };
}
async function serviceSettlementEvidence(tx, id, rooftopId, totalCents) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error("Invalid service invoice total");
  await tx.prisma.$queryRaw`SELECT "id" FROM "PaymentTransaction" WHERE "serviceOrder" = ${id} ORDER BY "id" FOR UPDATE`;
  const payments = await tx.prisma.paymentTransaction.findMany({ where: { serviceOrderId: id, rooftopId, sourceType: "service", status: { in: ["captured", "partially-refunded"] } }, select: { id: true, capturedCents: true, refundedCents: true, providerTransactionId: true } });
  const verified = payments.filter((payment) => payment.providerTransactionId && Number.isSafeInteger(payment.capturedCents) && Number.isSafeInteger(payment.refundedCents) && payment.refundedCents >= 0 && payment.capturedCents >= payment.refundedCents);
  const netCents = verified.reduce((sum, payment) => sum + payment.capturedCents - payment.refundedCents, 0);
  if (netCents < totalCents) throw new Error("Verified net payment settlement is required before marking this invoice paid");
  return { totalCents, netCents, zeroBalance: totalCents === 0, paymentIds: verified.map((payment) => payment.id) };
}

// features/keystone/mutations/transitionServiceOrder.ts
var SERVICE_ORDER_EVIDENCE_QUERY = `
  id status completedAt lockedAt settledAt evidenceSnapshot
  rooftop { id }
  concern cause correction payType authorizationStatus authorizationEvidence inspectionEvidence declinedWork invoiceNumber
  diagnosis workPerformed recommendations laborTotal partsTotal tax grandTotal grandTotalCents
  appointment { id }
  lineItems { id itemType description partNumber quantity unitPrice price cost }
  laborOperations { id operationCode description status technician { id } soldHours actualMinutes timePunches startedAt completedAt }
  partsMovements { id part { id partNumber } movementType quantityDelta onHandAfter committedAfter onOrderAfter reference reason occurredAt }
`;
async function transitionServiceOrder(_root, { id, toStatus, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error("Service management permission is required");
  }
  const commandKey4 = String(idempotencyKey2 || "").trim();
  if (commandKey4.length < 8 || commandKey4.length > 200) throw new Error("A valid idempotency key is required");
  return context.transaction(async (transactionContext) => {
    await lockServiceOrder(transactionContext, id);
    const authority = await currentServiceOrderAuthority(transactionContext, context.session, id);
    const sessionContext = authority.context;
    const order2 = await sessionContext.query.ServiceOrder.findOne({
      where: { id },
      query: SERVICE_ORDER_EVIDENCE_QUERY
    });
    if (!order2?.rooftop?.id) throw new Error("Service order not found or not accessible");
    await assertSessionRooftopPermission(sessionContext, order2.rooftop.id, "canManageService");
    const eventKey = `service-order-transition:${commandKey4}`;
    const requestEvidence = { serviceOrderId: id, toStatus };
    const replay = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, actorId: true, rooftopId: true, afterSnapshot: true, metadata: true } });
    if (replay) {
      if (replay.aggregateId !== id || replay.actorId !== context.session.itemId || replay.rooftopId !== authority.rooftopId || stableJson(replay.afterSnapshot) !== stableJson(requestEvidence)) throw new Error("Service transition retry differs from the original actor, scope or request");
      await recordDomainEventInTransaction(transactionContext, {
        eventKey,
        rooftopId: order2.rooftop.id,
        aggregateType: "ServiceOrder",
        aggregateId: id,
        action: `transitioned:${toStatus}`,
        topic: "service-order.transitioned",
        actorId: context.session.itemId,
        afterSnapshot: requestEvidence,
        metadata: replay.metadata,
        payload: { serviceOrderId: id, rooftopId: order2.rooftop.id, status: toStatus }
      });
      return sessionContext.db.ServiceOrder.findOne({ where: { id } });
    }
    assertServiceOrderTransition(order2.status, toStatus);
    if (toStatus === "approved" && (!String(order2.concern || "").trim() || order2.authorizationStatus !== "authorized")) throw new Error("Authorized customer concern evidence is required before repair approval");
    if (toStatus === "completed" && (!String(order2.cause || "").trim() || !String(order2.correction || "").trim() || order2.laborOperations.some((operation) => !["completed", "cancelled"].includes(operation.status)))) throw new Error("Cause, correction, and completed labor operations are required");
    if (toStatus === "invoiced" && !String(order2.invoiceNumber || "").trim()) throw new Error("Invoice number is required before invoicing");
    if (toStatus === "paid") {
      await assertSessionRooftopPermission(sessionContext, authority.rooftopId, "canViewReports");
      await assertSessionRooftopPermission(sessionContext, authority.rooftopId, "canManageDealerships");
    }
    const settlement = toStatus === "paid" ? await serviceSettlementEvidence(transactionContext, id, authority.rooftopId, order2.grandTotalCents) : void 0;
    const now = /* @__PURE__ */ new Date();
    const update = { status: toStatus };
    if (toStatus === "completed") {
      update.completedAt = now;
      update.lockedAt = now;
      update.evidenceSnapshot = buildServiceOrderEvidenceSnapshot(order2);
    }
    if (toStatus === "paid") update.settledAt = now;
    const changed = await transactionContext.prisma.serviceOrder.updateMany({
      where: { id, status: order2.status },
      data: update
    });
    if (changed.count !== 1) throw new Error("Service order changed concurrently; reload before retrying");
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: order2.rooftop.id,
      aggregateType: "ServiceOrder",
      aggregateId: id,
      action: `transitioned:${toStatus}`,
      topic: "service-order.transitioned",
      actorId: context.session.itemId,
      afterSnapshot: requestEvidence,
      metadata: settlement ? { settlement } : {},
      payload: { serviceOrderId: id, rooftopId: order2.rooftop.id, status: toStatus }
    });
    return sessionContext.db.ServiceOrder.findOne({ where: { id } });
  }, { timeout: 3e4 });
}

// features/keystone/lifecycle/inventoryOperationsLifecycle.ts
var INVENTORY_RECON_STATUSES = ["open", "in-progress", "completed", "cancelled"];
var RECON_TRANSITIONS = {
  open: ["in-progress", "completed", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: []
};
function normalizeStockNumber(value) {
  const stockNumber = String(value || "").trim().toUpperCase();
  if (!stockNumber || stockNumber.length > 80) throw new Error("Stock number is required and must be at most 80 characters");
  return stockNumber;
}
function inventoryStockKey(rooftopId, stockNumber) {
  const rooftop = String(rooftopId || "").trim();
  if (!rooftop) throw new Error("Rooftop is required");
  return `${rooftop}:${normalizeStockNumber(stockNumber)}`;
}
function assertReconTransition(current, next) {
  if (!INVENTORY_RECON_STATUSES.includes(current) || !INVENTORY_RECON_STATUSES.includes(next)) {
    throw new Error("Invalid reconditioning status");
  }
  if (!RECON_TRANSITIONS[current].includes(next)) {
    throw new Error(`Reconditioning work cannot transition from ${current} to ${next}`);
  }
}
function assertMerchandisingTransition(current, next) {
  if (current !== "submitted" || !["approved", "rejected"].includes(String(next))) {
    throw new Error(`Merchandising evidence cannot transition from ${current} to ${next}`);
  }
}
function nonNegativeCents(value, label) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`${label} must be non-negative integer cents`);
  return amount;
}

// features/keystone/mutations/intakeInventoryVehicle.ts
var SOURCES = /* @__PURE__ */ new Set(["trade-in", "auction", "wholesale", "consumer-purchase", "oem-distributor", "dealer-transfer"]);
var CONDITIONS2 = /* @__PURE__ */ new Set(["new", "used", "certified"]);
function boundedText(value, label, maximum, required7 = true) {
  const result2 = String(value ?? "").trim();
  if (required7 && !result2 || result2.length > maximum) {
    throw new Error(`${label} ${required7 ? "is required and " : ""}must be at most ${maximum} characters`);
  }
  return result2;
}
function normalizeVin(value, label = "VIN") {
  const vin = boundedText(value, label, 17).toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error(`${label} must be a valid 17-character VIN`);
  return vin;
}
function optionalLegacyVin(value) {
  const vin = String(value ?? "").trim().toUpperCase();
  if (!vin) return null;
  if (!/^[A-Z0-9]{11,17}$/.test(vin)) throw new Error("Legacy VIN must be an 11\u201317 character identifier");
  return vin;
}
function integer37(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const result2 = Number(value);
  if (!Number.isInteger(result2) || result2 < minimum || result2 > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return result2;
}
function normalizeIntake(input2) {
  const rooftopId = boundedText(input2.rooftopId, "Rooftop", 100);
  const idempotencyKey2 = boundedText(input2.idempotencyKey, "Idempotency key", 100);
  if (idempotencyKey2.length < 8) throw new Error("Idempotency key must be at least 8 characters");
  const acquisitionSource = boundedText(input2.acquisitionSource, "Acquisition source", 40);
  if (!SOURCES.has(acquisitionSource)) throw new Error("Unsupported acquisition source");
  const condition = boundedText(input2.condition, "Vehicle condition", 30);
  if (!CONDITIONS2.has(condition)) throw new Error("Unsupported vehicle condition");
  const vin = normalizeVin(input2.vin);
  const legacyVin = optionalLegacyVin(input2.legacyVin);
  const stockNumber = normalizeStockNumber(input2.stockNumber);
  const year = integer37(input2.year, "Model year", 1900, 2200);
  const mileage = input2.mileage == null ? null : integer37(input2.mileage, "Mileage");
  const purchasePriceCents = nonNegativeCents(input2.purchasePriceCents, "Purchase price");
  const listPriceCents = nonNegativeCents(input2.listPriceCents, "List price");
  const priceCents = nonNegativeCents(input2.priceCents, "Retail price");
  if (priceCents === 0) throw new Error("Retail price must be greater than zero");
  const features = Array.isArray(input2.features) ? input2.features.slice(0, 100).map((feature, index) => boundedText(feature, `Feature ${index + 1}`, 200)) : [];
  return {
    rooftopId,
    idempotencyKey: idempotencyKey2,
    reason: boundedText(input2.reason, "Audit reason", 500),
    acquisitionSource,
    sourceReference: boundedText(input2.sourceReference, "Source reference", 200, false) || null,
    vin,
    legacyVin,
    stockNumber,
    year,
    make: boundedText(input2.make, "Make", 100),
    model: boundedText(input2.model, "Model", 100),
    trim: boundedText(input2.trim, "Trim", 100, false),
    exteriorColor: boundedText(input2.exteriorColor, "Exterior color", 100, false),
    interiorColor: boundedText(input2.interiorColor, "Interior color", 100, false),
    mileage,
    purchasePriceCents,
    listPriceCents,
    priceCents,
    condition,
    description: boundedText(input2.description, "Description", 4e3, false),
    features,
    imagePath: boundedText(input2.imagePath, "Image path", 500, false) || null,
    locationCode: boundedText(input2.locationCode, "Location code", 80).toUpperCase(),
    locationLabel: boundedText(input2.locationLabel, "Location label", 200, false)
  };
}
function eventEvidence(input2, mode) {
  return {
    mode,
    rooftopId: input2.rooftopId,
    vin: input2.vin,
    legacyVin: input2.legacyVin,
    stockNumber: input2.stockNumber,
    year: input2.year,
    make: input2.make,
    model: input2.model,
    mileage: input2.mileage,
    acquisitionSource: input2.acquisitionSource,
    sourceReference: input2.sourceReference,
    purchasePriceCents: input2.purchasePriceCents,
    listPriceCents: input2.listPriceCents,
    priceCents: input2.priceCents,
    condition: input2.condition,
    locationCode: input2.locationCode,
    locationLabel: input2.locationLabel,
    description: input2.description,
    features: input2.features,
    imagePath: input2.imagePath,
    reason: input2.reason
  };
}
async function intakeInventoryVehicleInTransaction(transactionContext, rawInput, options) {
  const input2 = normalizeIntake(rawInput);
  const eventKey = `inventory-intake:${input2.rooftopId}:${input2.idempotencyKey}`;
  const evidence = eventEvidence(input2, options.mode);
  const prisma = transactionContext.prisma;
  await prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
  const replay = await prisma.domainAuditEvent.findUnique({
    where: { eventKey },
    select: { aggregateId: true, metadata: true }
  });
  if (replay) {
    const metadata2 = replay.metadata;
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: input2.rooftopId,
      aggregateType: "InventoryStock",
      aggregateId: String(metadata2.stockId || replay.aggregateId),
      action: "vehicle-intake",
      topic: "inventory.vehicle-intake",
      actorId: options.actorId,
      afterSnapshot: evidence,
      metadata: metadata2,
      payload: { rooftopId: input2.rooftopId, ...metadata2 }
    });
    return {
      vehicleId: String(metadata2.vehicleId || ""),
      acquisitionId: String(metadata2.acquisitionId || ""),
      stockId: String(metadata2.stockId || replay.aggregateId),
      reused: true,
      vehicleCreated: false,
      acquisitionCreated: false,
      stockCreated: false,
      imageCreated: false,
      publicationEvidenceCreated: false
    };
  }
  const rooftop = await prisma.rooftop.findUnique({
    where: { id: input2.rooftopId },
    select: { id: true, status: true, dealerGroup: { select: { status: true } } }
  });
  if (!rooftop || rooftop.status !== "active" || rooftop.dealerGroup.status !== "active") {
    throw new Error("Inventory intake requires an active rooftop and dealer group");
  }
  const candidateVins = [...new Set([input2.vin, input2.legacyVin].filter(Boolean))];
  const existingVehicle = await prisma.vehicle.findFirst({
    where: { vin: { in: candidateVins } },
    include: {
      images: { select: { id: true, imagePath: true } },
      inventoryStock: { select: { id: true, rooftopId: true, stockNumber: true } },
      acquisition: { select: { id: true, rooftopId: true, idempotencyKey: true } }
    }
  });
  if (existingVehicle && !options.allowExistingVehicle) throw new Error("A vehicle with this VIN already exists");
  if (existingVehicle && existingVehicle.rooftopId !== input2.rooftopId) throw new Error("Vehicle belongs to another rooftop");
  if (existingVehicle && options.mode === "onboarding-ready" && !["available", "service"].includes(String(existingVehicle.status))) {
    throw new Error("Onboarding will not overwrite a pending or sold vehicle without prior replay evidence");
  }
  const stockCollision = await prisma.inventoryStock.findUnique({
    where: { stockKey: inventoryStockKey(input2.rooftopId, input2.stockNumber) },
    select: { id: true, vehicleId: true }
  });
  if (stockCollision && stockCollision.vehicleId !== existingVehicle?.id) {
    throw new Error("Stock number already exists at this rooftop");
  }
  const now = /* @__PURE__ */ new Date();
  const ready = options.mode === "onboarding-ready";
  const provenance = {
    mode: options.mode,
    acquisitionSource: input2.acquisitionSource,
    sourceReference: input2.sourceReference,
    intakeEventKey: eventKey
  };
  const vehicleValues = {
    rooftopId: input2.rooftopId,
    vin: input2.vin,
    stockNumber: input2.stockNumber,
    year: input2.year,
    make: input2.make,
    model: input2.model,
    trim: input2.trim,
    exteriorColor: input2.exteriorColor,
    interiorColor: input2.interiorColor,
    mileage: input2.mileage,
    purchasePriceCents: input2.purchasePriceCents,
    listPriceCents: input2.listPriceCents,
    priceCents: input2.priceCents,
    condition: input2.condition,
    status: ready ? "available" : "service",
    description: input2.description,
    features: input2.features,
    metadata: { ...existingVehicle?.metadata || {}, provenance }
  };
  const vehicle = existingVehicle ? await prisma.vehicle.update({ where: { id: existingVehicle.id }, data: vehicleValues, select: { id: true } }) : await prisma.vehicle.create({ data: vehicleValues, select: { id: true } });
  let imageCreated = false;
  if (input2.imagePath) {
    const existingImage = existingVehicle?.images.find((image5) => image5.imagePath === input2.imagePath);
    const imageValues = {
      rooftopId: input2.rooftopId,
      vehicleId: vehicle.id,
      imagePath: input2.imagePath,
      caption: `${input2.year} ${input2.make} ${input2.model}`,
      category: "exterior",
      sortOrder: 0,
      isPrimary: true
    };
    if (existingImage) await prisma.vehicleImage.update({ where: { id: existingImage.id }, data: imageValues });
    else {
      await prisma.vehicleImage.create({ data: imageValues });
      imageCreated = true;
    }
  }
  const acquisitionKey = `inventory-intake:${input2.rooftopId}:${input2.idempotencyKey}`;
  if (existingVehicle?.acquisition && existingVehicle.acquisition.idempotencyKey !== acquisitionKey) {
    throw new Error("Vehicle already belongs to a different acquisition lifecycle");
  }
  const purchaseSnapshot = {
    vin: input2.vin,
    stockNumber: input2.stockNumber,
    acquisitionSource: input2.acquisitionSource,
    sourceReference: input2.sourceReference,
    purchaseCents: input2.purchasePriceCents,
    odometer: input2.mileage
  };
  const acquisitionValues = {
    rooftopId: input2.rooftopId,
    reference: existingVehicle?.acquisition ? void 0 : `ACQ-${domainEventRequestHash(acquisitionKey).slice(0, 20).toUpperCase()}`,
    idempotencyKey: existingVehicle?.acquisition ? void 0 : acquisitionKey,
    status: ready ? "frontline" : "arrived",
    acquisitionSource: input2.acquisitionSource,
    sourceReference: input2.sourceReference || "",
    vin: input2.vin,
    year: input2.year,
    make: input2.make,
    model: input2.model,
    odometer: input2.mileage,
    appraisalCents: input2.purchasePriceCents,
    purchaseCents: input2.purchasePriceCents,
    reconEstimateCents: 0,
    vehicleId: vehicle.id,
    immutablePurchaseSnapshot: purchaseSnapshot,
    purchasedAt: now,
    arrivedAt: now,
    frontlineAt: ready ? now : null,
    requestedById: options.actorId,
    lastTransitionedById: options.actorId
  };
  const acquisition = existingVehicle?.acquisition ? await prisma.inventoryAcquisition.update({
    where: { id: existingVehicle.acquisition.id },
    data: Object.fromEntries(Object.entries(acquisitionValues).filter(([, value]) => value !== void 0)),
    select: { id: true }
  }) : await prisma.inventoryAcquisition.create({ data: acquisitionValues, select: { id: true } });
  const stockValues = {
    rooftopId: input2.rooftopId,
    vehicleId: vehicle.id,
    stockNumber: input2.stockNumber,
    stockKey: inventoryStockKey(input2.rooftopId, input2.stockNumber),
    locationCode: input2.locationCode,
    locationLabel: input2.locationLabel,
    stockedAt: now,
    frontlineAt: ready ? now : null,
    purchaseCostCents: input2.purchasePriceCents,
    reconCostCents: 0,
    otherCostCents: 0,
    totalCostCents: input2.purchasePriceCents,
    reconStatus: ready ? "completed" : "not-started",
    merchandisingStatus: ready ? "approved" : "draft",
    approvedRevisionHash: "",
    feedStatus: ready ? "succeeded" : "not-published"
  };
  const stock = existingVehicle?.inventoryStock ? await prisma.inventoryStock.update({ where: { id: existingVehicle.inventoryStock.id }, data: stockValues, select: { id: true } }) : await prisma.inventoryStock.create({ data: stockValues, select: { id: true } });
  await prisma.inventoryAcquisition.update({ where: { id: acquisition.id }, data: { stockId: stock.id } });
  await prisma.inventoryAcquisitionEvent.create({
    data: {
      rooftopId: input2.rooftopId,
      acquisitionId: acquisition.id,
      fromStatus: "",
      toStatus: ready ? "frontline" : "arrived",
      reason: input2.reason,
      evidence: purchaseSnapshot,
      actorId: options.actorId,
      occurredAt: now
    }
  });
  await prisma.inventoryStockEvent.create({
    data: {
      rooftopId: input2.rooftopId,
      stockId: stock.id,
      eventKey: `${eventKey}:stock`,
      eventType: "vehicle-intake",
      reason: input2.reason,
      amountCents: input2.purchasePriceCents,
      evidence: { acquisitionId: acquisition.id, vehicleId: vehicle.id, locationCode: input2.locationCode },
      actorId: options.actorId,
      occurredAt: now
    }
  });
  let publicationEvidenceCreated = false;
  let merchandisingVersionId = null;
  let feedRunId = null;
  let reconWorkItemId = null;
  if (ready) {
    const reconWorkItem = await prisma.inventoryReconWorkItem.create({
      data: {
        rooftopId: input2.rooftopId,
        stockId: stock.id,
        title: "Onboarding readiness inspection",
        category: "inspection",
        status: "completed",
        estimatedCostCents: 0,
        actualCostCents: 0,
        assignedToId: options.actorId,
        completedAt: now
      },
      select: { id: true }
    });
    reconWorkItemId = reconWorkItem.id;
    if (!input2.description || !input2.imagePath) {
      throw new Error("Onboarding-ready inventory requires a description and primary image");
    }
    const publication = await prisma.inventoryStock.findUnique({
      where: { id: stock.id },
      include: {
        vehicle: { include: { images: true } },
        merchandisingVersions: { orderBy: { version: "desc" }, take: 1 }
      }
    });
    if (!publication?.vehicle) throw new Error("Onboarding inventory could not be reviewed");
    const snapshot2 = assertMerchandisingContent(publication);
    const revisionHash = domainEventRequestHash(snapshot2);
    const latestVersion = publication.merchandisingVersions[0];
    if (latestVersion?.status === "submitted") {
      await prisma.inventoryMerchandisingVersion.updateMany({
        where: { id: latestVersion.id, status: "submitted" },
        data: { status: "rejected", decisionReason: "Superseded by validated onboarding inventory", decidedById: options.actorId, decidedAt: now }
      });
    }
    if (latestVersion?.status === "approved" && latestVersion.snapshot?.schemaVersion === 2 && domainEventRequestHash(latestVersion.snapshot) === revisionHash) {
      merchandisingVersionId = latestVersion.id;
    } else {
      const version = (latestVersion?.version ?? 0) + 1;
      const merchandising = await prisma.inventoryMerchandisingVersion.create({
        data: {
          rooftopId: input2.rooftopId,
          stockId: stock.id,
          version,
          versionKey: `${stock.id}:${version}`,
          status: "approved",
          snapshot: snapshot2,
          submittedById: options.actorId,
          submittedAt: now,
          decidedById: options.actorId,
          decidedAt: now,
          decisionReason: "Approved as validated fictional onboarding inventory"
        },
        select: { id: true }
      });
      merchandisingVersionId = merchandising.id;
      publicationEvidenceCreated = true;
    }
    await prisma.inventoryStock.update({
      where: { id: stock.id },
      data: { merchandisingStatus: "approved", approvedRevisionHash: revisionHash, feedStatus: "succeeded" }
    });
    const feedRun = await prisma.inventoryFeedRun.create({
      data: {
        rooftopId: input2.rooftopId,
        runKey: `${eventKey}:public-feed`,
        channelKey: "public-inventory-feed",
        status: "succeeded",
        attemptedCount: 1,
        succeededCount: 1,
        failedCount: 0,
        requestSnapshot: { stockIds: [stock.id] },
        responseSummary: { mode: "onboarding-internal", externalRequestSent: false },
        startedAt: now,
        completedAt: now,
        recordedById: options.actorId
      },
      select: { id: true }
    });
    feedRunId = feedRun.id;
    publicationEvidenceCreated = true;
  }
  const metadata = {
    vehicleId: vehicle.id,
    acquisitionId: acquisition.id,
    stockId: stock.id,
    reconWorkItemId,
    merchandisingVersionId,
    feedRunId,
    imageCreated
  };
  await recordDomainEventInTransaction(transactionContext, {
    eventKey,
    rooftopId: input2.rooftopId,
    aggregateType: "InventoryStock",
    aggregateId: stock.id,
    action: "vehicle-intake",
    topic: "inventory.vehicle-intake",
    actorId: options.actorId,
    afterSnapshot: evidence,
    metadata,
    payload: { rooftopId: input2.rooftopId, ...metadata }
  });
  return {
    ...metadata,
    reused: false,
    vehicleCreated: !existingVehicle,
    acquisitionCreated: !existingVehicle?.acquisition,
    stockCreated: !existingVehicle?.inventoryStock,
    publicationEvidenceCreated
  };
}
async function intakeInventoryVehicle(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error("Inventory management permission is required");
  }
  const rooftopId = String(data.rooftopId || "");
  await assertSessionRooftopPermission(context, rooftopId, "canManageInventory");
  const command = await context.transaction(
    (transactionContext) => intakeInventoryVehicleInTransaction(transactionContext, data, {
      actorId: context.session.itemId,
      mode: "operator-intake",
      allowExistingVehicle: false
    }),
    { timeout: 3e4 }
  );
  const stock = await context.sudo().prisma.inventoryStock.findUnique({
    where: { id: command.stockId },
    select: { id: true, updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true }
  });
  if (!stock) throw new Error("Inventory intake result no longer exists");
  return {
    id: command.vehicleId,
    vehicleId: command.vehicleId,
    acquisitionId: command.acquisitionId,
    stockId: stock.id,
    status: stock.reconStatus,
    merchandisingStatus: stock.merchandisingStatus,
    feedStatus: stock.feedStatus,
    updatedAt: stock.updatedAt,
    reused: command.reused
  };
}

// features/keystone/mutations/runDealershipOnboarding.ts
function text72(value, fallback = "", max = 500) {
  const normalized = String(value ?? fallback).trim();
  return normalized.slice(0, max);
}
function entries(value, max) {
  if (!Array.isArray(value)) return [];
  if (value.length > max) throw new Error(`Onboarding section exceeds ${max} items`);
  return value.filter((item) => item && typeof item === "object");
}
function rolePermissions(roleCode) {
  const base = { canAccessDashboard: true, canViewInventory: true };
  switch (roleCode) {
    case "sales-manager":
      return { ...base, canManageInventory: true, canManageLeads: true, canViewAllLeads: true, canManageDeals: true, canApproveDeals: true, canViewReports: true, canManageTradeIns: true };
    case "sales-associate":
      return { ...base, canManageLeads: true, canManageDeals: true, canManageTradeIns: true };
    case "finance-manager":
      return { ...base, canViewAllLeads: true, canManageDeals: true, canApproveDeals: true, canManageFinancing: true, canViewReports: true };
    case "service-manager":
      return { ...base, canManageService: true, canViewReports: true };
    case "technician":
    case "parts-specialist":
      return { ...base, canManageService: true };
    default:
      return base;
  }
}
function onboardingSlug(value, fallback, label) {
  const slug = text72(value, fallback, 120).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${label} must be a stable lowercase slug`);
  return slug;
}
function optionalEmail(value, label) {
  const email = text72(value, "", 320).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label} is invalid`);
  return email;
}
function profileData(input2 = {}) {
  const name = text72(input2.name, "Sam\u2019s Motor Company", 200);
  if (!name) throw new Error("Dealership name is required");
  const currencyCode = text72(input2.currencyCode || input2.defaultCurrencyCode, "USD", 3).toUpperCase();
  if (currencyCode !== "USD") throw new Error("This bounded dealership release supports USD only");
  const websiteUrl = text72(input2.websiteUrl, "", 500);
  if (websiteUrl && !/^https?:\/\//.test(websiteUrl)) throw new Error("Dealership website URL must use HTTP or HTTPS");
  return {
    name,
    shortName: text72(input2.shortName, name, 200),
    salesEmail: optionalEmail(input2.salesEmail, "Sales email"),
    serviceEmail: optionalEmail(input2.serviceEmail, "Service email"),
    phone: text72(input2.phone, "", 50),
    addressLine1: text72(input2.addressLine1, "", 200),
    addressLine2: text72(input2.addressLine2, "", 200),
    city: text72(input2.city, "", 100),
    state: text72(input2.state, "", 100),
    postalCode: text72(input2.postalCode, "", 30),
    hoursMonFri: text72(input2.hoursMonFri, "", 100),
    hoursSaturday: text72(input2.hoursSaturday, "", 100),
    hoursSunday: text72(input2.hoursSunday, "", 100),
    websiteUrl,
    currencyCode,
    homepageTitle: text72(input2.homepageTitle, "", 200),
    homepageDescription: text72(input2.homepageDescription, "", 1e3),
    logoIcon: text72(input2.logoIcon, "", 2e4),
    logoColor: text72(input2.logoColor, "", 100)
  };
}
function vehicleData(input2) {
  const vin = text72(input2.vin, "", 17).toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error("Every onboarding vehicle requires a valid 17-character VIN");
  const legacyVin = text72(input2.legacyVin, "", 17).toUpperCase() || null;
  if (legacyVin && !/^[A-Z0-9]{11,17}$/.test(legacyVin)) throw new Error(`Vehicle ${vin} has an invalid legacy VIN`);
  const year = Number(input2.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error(`Invalid model year for ${vin}`);
  const make = text72(input2.make, "", 100);
  const model = text72(input2.model, "", 100);
  if (!make || !model) throw new Error(`Vehicle ${vin} requires make and model`);
  const data = {
    vin,
    stockNumber: text72(input2.stockNumber, "", 100),
    year,
    make,
    model,
    trim: text72(input2.trim, "", 100),
    exteriorColor: text72(input2.exteriorColor, "", 100),
    interiorColor: text72(input2.interiorColor, "", 100),
    mileage: Number(input2.mileage || 0),
    purchasePriceCents: Number(input2.purchasePriceCents ?? Math.round(Number(input2.purchasePrice || 0) * 100)),
    listPriceCents: Number(input2.listPriceCents ?? Math.round(Number(input2.listPrice || input2.price || 0) * 100)),
    priceCents: Number(input2.priceCents ?? Math.round(Number(input2.price || input2.listPrice || 0) * 100)),
    condition: text72(input2.condition, "used", 30),
    status: text72(input2.status, "available", 30),
    description: text72(input2.description, "", 4e3),
    features: Array.isArray(input2.features) ? input2.features.slice(0, 100).map((value) => text72(value, "", 200)) : []
  };
  for (const [label, value] of Object.entries({
    mileage: data.mileage,
    purchasePriceCents: data.purchasePriceCents,
    listPriceCents: data.listPriceCents,
    priceCents: data.priceCents
  })) {
    if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`Vehicle ${vin} ${label} must be non-negative integer cents/count`);
  }
  if (!data.stockNumber) throw new Error(`Vehicle ${vin} requires a stock number`);
  return { vin, legacyVin, imagePath: text72(input2.imagePath, "", 500), data };
}
async function runDealershipOnboardingTransaction(data, context, failurePoint) {
  const userId = context.session?.itemId;
  if (!userId) throw new Error("Authentication required");
  return context.transaction(async (transactionContext) => {
    const sessionContext = transactionContext.withSession(context.session);
    const sudo = sessionContext.sudo();
    const result2 = {
      profile: "reused",
      dealerGroup: "reused",
      rooftop: "reused",
      membership: "reused",
      makesCreated: 0,
      makesReused: 0,
      servicesCreated: 0,
      servicesReused: 0,
      rolesCreated: 0,
      rolesReused: 0,
      vehiclesCreated: 0,
      vehiclesReused: 0,
      imagesCreated: 0,
      imagesReused: 0,
      acquisitionsCreated: 0,
      acquisitionsReused: 0,
      stocksCreated: 0,
      stocksReused: 0,
      publicationEvidenceCreated: 0,
      publicationEvidenceReused: 0
    };
    const profileInput = data.dealership || {};
    const profile = profileData(profileInput);
    const groupSlug = onboardingSlug(profileInput.groupSlug, "sams-motor-company", "Dealer group slug");
    const rooftopSlug = onboardingSlug(profileInput.rooftopSlug, "main", "Rooftop slug");
    const rooftopCode = text72(profileInput.rooftopCode, "SAM-MAIN", 40).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]*$/.test(rooftopCode)) throw new Error("Rooftop code must use letters, numbers, or hyphens");
    const groupRows = await sudo.query.DealerGroup.findMany({ where: { slug: { equals: groupSlug } }, take: 1, query: "id" });
    let dealerGroupId;
    if (groupRows.length) {
      dealerGroupId = groupRows[0].id;
    } else {
      const group = await sudo.db.DealerGroup.createOne({ data: { name: profile.name, slug: groupSlug, status: "active" } });
      dealerGroupId = group.id;
      result2.dealerGroup = "created";
    }
    const rooftopRows = await sudo.query.Rooftop.findMany({ where: { publicSlug: { equals: rooftopSlug } }, take: 1, query: "id dealerGroup { id }" });
    let rooftopId;
    if (rooftopRows.length) {
      if (rooftopRows[0].dealerGroup?.id !== dealerGroupId) throw new Error("Rooftop slug already belongs to another dealer group");
      rooftopId = rooftopRows[0].id;
    } else {
      const rooftop = await sudo.db.Rooftop.createOne({
        data: {
          rooftopKey: `${dealerGroupId}:${rooftopCode}`,
          code: rooftopCode,
          name: profile.name,
          publicSlug: rooftopSlug,
          status: "active",
          timezone: "America/New_York",
          currencyCode: profile.currencyCode,
          dealerGroup: { connect: { id: dealerGroupId } }
        }
      });
      rooftopId = rooftop.id;
      result2.rooftop = "created";
    }
    const membershipKey2 = `${dealerGroupId}:${userId}`;
    const membershipRows = await sudo.query.DealerGroupMembership.findMany({ where: { membershipKey: { equals: membershipKey2 } }, take: 1, query: "id" });
    const activeUser = await sudo.query.User.findOne({ where: { id: userId }, query: "id role { id }" });
    const membershipData = {
      status: "active",
      accessAllRooftops: true,
      ...activeUser?.role?.id ? { role: { connect: { id: activeUser.role.id } } } : {}
    };
    let membershipId;
    if (membershipRows.length) {
      membershipId = membershipRows[0].id;
    } else {
      const membership = await sudo.db.DealerGroupMembership.createOne({
        data: {
          membershipKey: membershipKey2,
          ...membershipData,
          joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
          dealerGroup: { connect: { id: dealerGroupId } },
          user: { connect: { id: userId } }
        }
      });
      membershipId = membership.id;
      result2.membership = "created";
      await sudo.db.MembershipAuditEvent.createOne({
        data: {
          scopeType: "dealer-group",
          action: "onboarding-bootstrap",
          dealerGroup: { connect: { id: dealerGroupId } },
          targetUser: { connect: { id: userId } },
          actor: { connect: { id: userId } },
          membershipId,
          previousSnapshot: null,
          nextSnapshot: {
            id: membershipId,
            status: "active",
            accessAllRooftops: true,
            roleId: activeUser?.role?.id || null
          },
          reason: "Initial dealership onboarding owner membership",
          occurredAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    const existingProfile = await sudo.query.DealershipProfile.findOne({ where: { id: 1 }, query: "id" });
    if (!existingProfile) {
      await sudo.db.DealershipProfile.createOne({ data: profile });
      result2.profile = "created";
    }
    if (failurePoint === "after-profile") throw new Error("Injected onboarding failure after profile");
    for (const makeInput of entries(data.vehicleMakes, 100)) {
      const name = text72(makeInput.name, "", 100);
      if (!name) throw new Error("Every vehicle make requires a name");
      const existing = await sudo.query.Make.findMany({ where: { name: { equals: name } }, take: 1, query: "id" });
      if (existing.length) result2.makesReused += 1;
      else {
        await sudo.db.Make.createOne({ data: { name } });
        result2.makesCreated += 1;
      }
    }
    if (failurePoint === "after-makes") throw new Error("Injected onboarding failure after makes");
    for (const service of entries(data.services, 100)) {
      const name = text72(service.name, "", 200);
      if (!name) throw new Error("Every service package requires a name");
      const serviceData = {
        rooftop: { connect: { id: rooftopId } },
        name,
        description: text72(service.description, "", 2e3),
        priceCents: Math.round(Number(service.price || 0)),
        estimatedDuration: Number(service.duration || 0),
        includedServices: [{ service: name, description: text72(service.description, "", 500) }]
      };
      const existing = await sudo.query.ServicePackage.findMany({ where: { AND: [{ name: { equals: name } }, { rooftop: { id: { equals: rooftopId } } }] }, take: 1, query: "id" });
      if (existing.length) {
        result2.servicesReused += 1;
      } else {
        await sudo.db.ServicePackage.createOne({ data: serviceData });
        result2.servicesCreated += 1;
      }
    }
    if (failurePoint === "after-services") throw new Error("Injected onboarding failure after services");
    for (const role of entries(data.staff, 100)) {
      const name = text72(role.role, "", 200);
      if (!name) throw new Error("Every staff role requires a name");
      const roleData = { name, ...rolePermissions(text72(role.code, name.toLowerCase(), 100)) };
      const existing = await sudo.query.Role.findMany({ where: { name: { equals: name } }, take: 1, query: "id" });
      if (existing.length) {
        result2.rolesReused += 1;
      } else {
        await sudo.db.Role.createOne({ data: roleData });
        result2.rolesCreated += 1;
      }
    }
    if (failurePoint === "after-roles") throw new Error("Injected onboarding failure after roles");
    for (const vehicleInput of entries(data.vehicles, 100)) {
      const normalized = vehicleData(vehicleInput);
      const intake = await intakeInventoryVehicleInTransaction(transactionContext, {
        rooftopId,
        idempotencyKey: `onboarding:${rooftopSlug}:${normalized.vin}`,
        reason: "Validated fictional inventory created by dealership onboarding",
        acquisitionSource: text72(vehicleInput.acquisitionSource, "dealer-transfer", 40),
        sourceReference: text72(vehicleInput.sourceReference, `onboarding:${rooftopSlug}`, 200),
        vin: normalized.vin,
        legacyVin: normalized.legacyVin,
        stockNumber: normalized.data.stockNumber,
        year: normalized.data.year,
        make: normalized.data.make,
        model: normalized.data.model,
        trim: normalized.data.trim,
        exteriorColor: normalized.data.exteriorColor,
        interiorColor: normalized.data.interiorColor,
        mileage: normalized.data.mileage,
        purchasePriceCents: normalized.data.purchasePriceCents,
        listPriceCents: normalized.data.listPriceCents,
        priceCents: normalized.data.priceCents,
        condition: normalized.data.condition,
        description: normalized.data.description,
        features: normalized.data.features,
        imagePath: normalized.imagePath,
        locationCode: text72(vehicleInput.locationCode, "FRONTLINE", 80),
        locationLabel: text72(vehicleInput.locationLabel, "Frontline display", 200)
      }, {
        actorId: userId,
        mode: "onboarding-ready",
        allowExistingVehicle: true
      });
      result2[intake.vehicleCreated ? "vehiclesCreated" : "vehiclesReused"] += 1;
      result2[intake.acquisitionCreated ? "acquisitionsCreated" : "acquisitionsReused"] += 1;
      result2[intake.stockCreated ? "stocksCreated" : "stocksReused"] += 1;
      result2[intake.publicationEvidenceCreated ? "publicationEvidenceCreated" : "publicationEvidenceReused"] += 1;
      if (intake.imageCreated) result2.imagesCreated += 1;
      else result2.imagesReused += 1;
    }
    if (failurePoint === "after-vehicles") throw new Error("Injected onboarding failure after vehicles");
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: "completed" }
    });
    return { ...result2, completed: true };
  }, { timeout: 12e4 });
}
async function runDealershipOnboarding(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageOnboarding({ session: context.session })) {
    throw new Error("Onboarding management permission is required");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("A dealership onboarding document is required");
  }
  return runDealershipOnboardingTransaction(data, context);
}

// features/keystone/lifecycle/financingLifecycle.ts
var FINANCING_APPLICATION_STATUSES = [
  "submitted",
  "under-review",
  "approved",
  "declined",
  "expired",
  "cancelled"
];
var APPLICATION_TRANSITIONS = {
  submitted: ["under-review", "cancelled"],
  "under-review": ["approved", "declined", "expired", "cancelled"],
  approved: ["expired", "cancelled"],
  declined: [],
  expired: [],
  cancelled: []
};
function isFinancingApplicationStatus(value) {
  return typeof value === "string" && FINANCING_APPLICATION_STATUSES.includes(value);
}
function assertFinancingTransition(current, next) {
  if (!isFinancingApplicationStatus(current) || !isFinancingApplicationStatus(next)) {
    throw new Error("Invalid financing application status");
  }
  if (!APPLICATION_TRANSITIONS[current].includes(next)) {
    throw new Error(`Financing application cannot transition from ${current} to ${next}`);
  }
}
function statusForDecision(decision) {
  if (decision === "conditional") return "under-review";
  return decision;
}
function assertDecisionTerms(decision, terms) {
  if (decision !== "approved" && decision !== "conditional") return;
  if (!Number.isInteger(terms.approvedAmountCents) || Number(terms.approvedAmountCents) <= 0) {
    throw new Error("Approved or conditional decisions require an approved amount");
  }
  if (!Number.isInteger(terms.aprBasisPoints) || Number(terms.aprBasisPoints) < 0) {
    throw new Error("Approved or conditional decisions require APR basis points");
  }
  if (!Number.isInteger(terms.termMonths) || Number(terms.termMonths) <= 0) {
    throw new Error("Approved or conditional decisions require a term");
  }
}

// features/keystone/mutations/queueFinancingApplication.ts
async function queueFinancingApplication(_root, { applicationId, providerKey, idempotencyKey: rawKey }, context) {
  if (!context.session || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error("Access denied: financing permission required");
  }
  const adapter = resolveFinancingProviderAdapter(String(providerKey || "").trim());
  const idempotencyKey2 = financingIdempotencyKey(rawKey, "lender-submission");
  const replay = await context.sudo().prisma.lenderSubmission.findUnique({
    where: { idempotencyKey: idempotencyKey2 },
    select: { id: true, applicationId: true, providerKey: true, rooftopId: true, status: true }
  });
  if (replay) {
    await assertSessionRooftopPermission(context, replay.rooftopId, "canManageFinancing");
    if (replay.applicationId !== applicationId || replay.providerKey !== adapter.key) throw new Error("Lender submission idempotency key was reused with different evidence");
    await recordDomainEvent(context, {
      eventKey: `lender-submission:${idempotencyKey2}`,
      rooftopId: replay.rooftopId,
      aggregateType: "LenderSubmission",
      aggregateId: replay.id,
      action: "queued",
      topic: "lender-submission.queued",
      actorId: context.session.itemId,
      afterSnapshot: { applicationId: replay.applicationId, providerKey: adapter.key, status: replay.status },
      payload: { submissionId: replay.id, applicationId: replay.applicationId, rooftopId: replay.rooftopId, status: replay.status }
    });
    return context.db.LenderSubmission.findOne({ where: { id: replay.id } });
  }
  const application = await context.query.FinancingApplication.findOne({
    where: { id: applicationId },
    query: "id reference status requestedAmountCents rooftop { id } vehicle { vin }"
  });
  if (!application?.rooftop?.id) throw new Error("Financing application not found");
  await assertSessionRooftopPermission(context, application.rooftop.id, "canManageFinancing");
  if (application.status === "submitted") assertFinancingTransition(application.status, "under-review");
  else if (application.status !== "under-review") throw new Error("Only submitted applications can be queued");
  const providerResult = await adapter.submit({
    applicationReference: application.reference,
    idempotencyKey: idempotencyKey2,
    requestedAmountCents: application.requestedAmountCents || 0,
    vehicleVin: application.vehicle?.vin || null
  });
  const submissionId = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey2}, 0))`;
    const existing = await tx.prisma.lenderSubmission.findUnique({ where: { idempotencyKey: idempotencyKey2 }, select: { id: true } });
    if (existing) return existing.id;
    if (application.status === "submitted") {
      const changed = await tx.prisma.financingApplication.updateMany({
        where: { id: application.id, status: "submitted" },
        data: { status: "under-review" }
      });
      if (changed.count !== 1) throw new Error("Financing application changed; refresh and retry");
    }
    const created = await tx.prisma.lenderSubmission.create({
      data: {
        rooftopId: application.rooftop.id,
        applicationId: application.id,
        providerKey: adapter.key,
        idempotencyKey: idempotencyKey2,
        status: providerResult.status,
        externalReference: providerResult.externalReference,
        requestSnapshot: {
          version: 1,
          applicationReference: application.reference,
          requestedAmountCents: application.requestedAmountCents || 0,
          vehicleVin: application.vehicle?.vin || null
        },
        responseSummary: providerResult.responseSummary,
        queuedAt: /* @__PURE__ */ new Date()
      },
      select: { id: true }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey: `lender-submission:${idempotencyKey2}`,
      rooftopId: application.rooftop.id,
      aggregateType: "LenderSubmission",
      aggregateId: created.id,
      action: "queued",
      topic: "lender-submission.queued",
      actorId: context.session.itemId,
      afterSnapshot: { applicationId: application.id, providerKey: adapter.key, status: providerResult.status },
      payload: { submissionId: created.id, applicationId: application.id, rooftopId: application.rooftop.id, status: providerResult.status }
    });
    return created.id;
  }, { timeout: 3e4 });
  return context.db.LenderSubmission.findOne({ where: { id: submissionId } });
}

// features/keystone/mutations/recordLenderDecision.ts
async function recordLenderDecision(_root, { data }, context) {
  if (!context.session || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error("Access denied: financing permission required");
  }
  const adapter = resolveFinancingProviderAdapter(String(data.providerKey || "").trim());
  const decision = String(data.decision || "");
  if (!["approved", "declined", "conditional", "expired", "cancelled"].includes(decision)) {
    throw new Error("Invalid lender decision");
  }
  const approvedAmountCents = data.approvedAmountCents == null ? null : Number(data.approvedAmountCents);
  const aprBasisPoints = data.aprBasisPoints == null ? null : Number(data.aprBasisPoints);
  const termMonths = data.termMonths == null ? null : Number(data.termMonths);
  const monthlyPaymentCents = data.monthlyPaymentCents == null ? null : Number(data.monthlyPaymentCents);
  const externalReference = String(data.externalReference || "").trim() || null;
  const reasonCodes = Array.isArray(data.reasonCodes) ? data.reasonCodes.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 20) : [];
  assertDecisionTerms(decision, { approvedAmountCents, aprBasisPoints, termMonths });
  if (monthlyPaymentCents != null && (!Number.isInteger(monthlyPaymentCents) || monthlyPaymentCents < 0)) throw new Error("Monthly payment must be non-negative integer cents");
  if (adapter.key === "operator-recorded" && !externalReference) throw new Error("Operator-recorded lender decisions require an evidence reference");
  if (decision === "declined" && reasonCodes.length === 0) throw new Error("Declined decisions require at least one reason code");
  const idempotencyKey2 = financingIdempotencyKey(data.idempotencyKey, "lender-decision");
  const targetStatus = statusForDecision(decision);
  const eventEvidence2 = {
    applicationId: String(data.applicationId || ""),
    submissionId: data.submissionId ? String(data.submissionId) : null,
    providerKey: adapter.key,
    externalReference,
    decision,
    approvedAmountCents,
    aprBasisPoints,
    termMonths,
    monthlyPaymentCents,
    reasonCodes
  };
  const accessibleApplication = await context.query.FinancingApplication.findOne({
    where: { id: String(data.applicationId || "") },
    query: "id rooftop { id }"
  });
  if (!accessibleApplication?.rooftop?.id) throw new Error("Financing application not found");
  await assertSessionRooftopPermission(context, accessibleApplication.rooftop.id, "canManageFinancing");
  const decisionId = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey2}, 0))`;
    const existing = await tx.prisma.lenderDecision.findUnique({
      where: { idempotencyKey: idempotencyKey2 },
      select: { id: true, rooftopId: true, applicationId: true }
    });
    if (existing) {
      if (existing.applicationId !== accessibleApplication.id || existing.rooftopId !== accessibleApplication.rooftop.id) throw new Error("Lender decision idempotency key belongs to another application");
      await recordDomainEventInTransaction(tx, {
        eventKey: `lender-decision:${idempotencyKey2}`,
        rooftopId: existing.rooftopId,
        aggregateType: "LenderDecision",
        aggregateId: existing.id,
        action: `recorded:${decision}`,
        topic: "lender-decision.recorded",
        actorId: context.session.itemId,
        afterSnapshot: eventEvidence2,
        payload: { decisionId: existing.id, applicationId: existing.applicationId, rooftopId: existing.rooftopId, decision }
      });
      return existing.id;
    }
    const application = await tx.prisma.financingApplication.findUnique({
      where: { id: data.applicationId },
      select: { id: true, reference: true, status: true, rooftopId: true }
    });
    if (!application) throw new Error("Financing application not found");
    if (decision === "conditional" && application.status === "under-review") {
    } else {
      assertFinancingTransition(application.status, targetStatus);
      const changed = await tx.prisma.financingApplication.updateMany({
        where: { id: application.id, status: application.status },
        data: { status: targetStatus }
      });
      if (changed.count !== 1) throw new Error("Financing application changed; refresh and retry");
    }
    if (data.submissionId) {
      const submission = await tx.prisma.lenderSubmission.findFirst({ where: { id: data.submissionId, applicationId: application.id }, select: { id: true } });
      if (!submission) throw new Error("Lender submission does not belong to this application");
    }
    const now = /* @__PURE__ */ new Date();
    const created = await tx.prisma.lenderDecision.create({
      data: {
        rooftopId: application.rooftopId,
        applicationId: application.id,
        submissionId: data.submissionId || null,
        idempotencyKey: idempotencyKey2,
        providerKey: adapter.key,
        externalReference,
        decision,
        approvedAmountCents,
        aprBasisPoints,
        termMonths,
        monthlyPaymentCents,
        reasonCodes,
        decidedAt: now,
        recordedById: context.session.itemId,
        immutableSnapshot: {
          version: 1,
          applicationReference: application.reference,
          providerKey: adapter.key,
          externalReference,
          decision,
          approvedAmountCents,
          aprBasisPoints,
          termMonths,
          monthlyPaymentCents,
          reasonCodes,
          decidedAt: now.toISOString(),
          recordedById: context.session.itemId
        }
      },
      select: { id: true }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey: `lender-decision:${idempotencyKey2}`,
      rooftopId: application.rooftopId,
      aggregateType: "LenderDecision",
      aggregateId: created.id,
      action: `recorded:${decision}`,
      topic: "lender-decision.recorded",
      actorId: context.session.itemId,
      afterSnapshot: eventEvidence2,
      payload: { decisionId: created.id, applicationId: application.id, rooftopId: application.rooftopId, decision }
    });
    return created.id;
  }, { timeout: 3e4 });
  return context.db.LenderDecision.findOne({ where: { id: decisionId } });
}

// features/keystone/mutations/membershipPolicy.ts
var MEMBERSHIP_STATUSES = /* @__PURE__ */ new Set([
  "invited",
  "active",
  "suspended",
  "revoked"
]);
var PLATFORM_ADMIN_PERMISSIONS = [
  "canManageDealerships",
  "canManageRoles",
  "canManagePeople",
  "canEditOtherPeople",
  "canSeeOtherPeople",
  "canManageOnboarding"
];
function assertMembershipChangePolicy(input2) {
  if (!input2.actorUserId || !input2.targetUserId) throw new Error("Actor and target user are required");
  if (input2.actorUserId === input2.targetUserId) {
    throw new Error("Operators cannot change their own membership");
  }
  if (input2.scopeType !== "dealer-group" && input2.scopeType !== "rooftop") {
    throw new Error("Unsupported membership scope");
  }
  if (!MEMBERSHIP_STATUSES.has(input2.status)) {
    throw new Error("Unsupported membership status");
  }
  if (input2.scopeType === "rooftop" && input2.accessAllRooftops) {
    throw new Error("Rooftop memberships cannot grant group-wide access");
  }
  if (!input2.reason.trim()) throw new Error("An audit reason is required");
  if (input2.reason.trim().length > 500) throw new Error("Audit reason must be 500 characters or fewer");
}
function assertTenantAssignableRole(role) {
  const elevated = PLATFORM_ADMIN_PERMISSIONS.filter((permission) => role[permission] === true);
  if (elevated.length) {
    throw new Error(`Tenant memberships cannot assign platform-administration permissions: ${elevated.join(", ")}`);
  }
}

// features/keystone/mutations/changeDealerMembership.ts
var roleQuery = `
  id name
  canManageDealerships canManageRoles canManagePeople canEditOtherPeople
  canSeeOtherPeople canManageOnboarding
  canManageInventory canViewInventory canManageLeads canViewAllLeads
  canManageDeals canApproveDeals canManageService canViewReports
  canManageFinancing canManageTradeIns
`;
function snapshot(membership) {
  if (!membership) return null;
  return {
    id: membership.id,
    status: membership.status,
    accessAllRooftops: Boolean(membership.accessAllRooftops),
    roleId: membership.role?.id || null
  };
}
async function changeDealerMembership(_root, { data }, context) {
  const actorUserId = context.session?.itemId;
  if (!actorUserId || !permissions.canManageDealerships({ session: context.session })) {
    throw new Error("Dealer membership management permission is required");
  }
  const scopeType = String(data.scopeType || "");
  const scopeId = String(data.scopeId || "");
  const targetUserId = String(data.targetUserId || "");
  const roleId = String(data.roleId || "");
  const status = String(data.status || "");
  const accessAllRooftops = data.accessAllRooftops === true;
  const reason = String(data.reason || "").trim();
  const expectedUpdatedAt = data.expectedUpdatedAt == null ? null : data.expectedUpdatedAt instanceof Date ? data.expectedUpdatedAt.toISOString() : String(data.expectedUpdatedAt);
  if (!scopeId || !roleId) throw new Error("Membership scope and role are required");
  assertMembershipChangePolicy({ actorUserId, targetUserId, scopeType, status, accessAllRooftops, reason });
  return context.transaction(async (transactionContext) => {
    const sudo = transactionContext.withSession(context.session).sudo();
    const [targetUser, role] = await Promise.all([
      sudo.query.User.findOne({ where: { id: targetUserId }, query: "id" }),
      sudo.query.Role.findOne({ where: { id: roleId }, query: roleQuery })
    ]);
    if (!targetUser) throw new Error("Target user was not found");
    if (!role) throw new Error("Membership role was not found");
    assertTenantAssignableRole(role);
    let dealerGroupId;
    let rooftopId = null;
    if (scopeType === "dealer-group") {
      const group = await sudo.query.DealerGroup.findOne({ where: { id: scopeId }, query: "id" });
      if (!group) throw new Error("Dealer group was not found");
      dealerGroupId = group.id;
    } else {
      const rooftop = await sudo.query.Rooftop.findOne({ where: { id: scopeId }, query: "id dealerGroup { id }" });
      if (!rooftop?.dealerGroup?.id) throw new Error("Rooftop was not found");
      rooftopId = rooftop.id;
      dealerGroupId = rooftop.dealerGroup.id;
    }
    const listKey = scopeType === "dealer-group" ? "DealerGroupMembership" : "RooftopMembership";
    const scopeField = scopeType === "dealer-group" ? "dealerGroup" : "rooftop";
    const membershipKey2 = `${scopeId}:${targetUserId}`;
    const existingRows = await sudo.query[listKey].findMany({
      where: { membershipKey: { equals: membershipKey2 } },
      take: 1,
      query: scopeType === "dealer-group" ? "id status accessAllRooftops updatedAt role { id }" : "id status updatedAt role { id }"
    });
    const existing = existingRows[0] || null;
    if (existing && !expectedUpdatedAt) throw new Error("expectedUpdatedAt is required to change an existing membership");
    const expectedVersion = expectedUpdatedAt ? new Date(expectedUpdatedAt) : null;
    if (expectedVersion && Number.isNaN(expectedVersion.getTime())) throw new Error("expectedUpdatedAt is invalid");
    if (existing && new Date(existing.updatedAt).toISOString() !== expectedVersion.toISOString()) {
      throw new Error("Membership changed since it was loaded");
    }
    if (!existing && expectedUpdatedAt) throw new Error("Membership no longer exists");
    const joinedAt = status === "active" && (!existing || existing.status !== "active") ? /* @__PURE__ */ new Date() : void 0;
    const membershipData = {
      status,
      ...scopeType === "dealer-group" ? { accessAllRooftops } : {},
      role: { connect: { id: roleId } },
      ...joinedAt ? { joinedAt: joinedAt.toISOString() } : {}
    };
    let membership;
    if (existing) {
      const prismaModel = scopeType === "dealer-group" ? transactionContext.prisma.dealerGroupMembership : transactionContext.prisma.rooftopMembership;
      const changed = await prismaModel.updateMany({
        where: { id: existing.id, updatedAt: expectedVersion },
        data: {
          status,
          roleId,
          ...scopeType === "dealer-group" ? { accessAllRooftops } : {},
          ...joinedAt ? { joinedAt } : {}
        }
      });
      if (changed.count !== 1) throw new Error("Membership changed since it was loaded");
      membership = { id: existing.id };
    } else {
      membership = await sudo.db[listKey].createOne({
        data: {
          ...membershipData,
          membershipKey: membershipKey2,
          user: { connect: { id: targetUserId } },
          [scopeField]: { connect: { id: scopeId } },
          invitedBy: { connect: { id: actorUserId } }
        }
      });
    }
    const nextSnapshot = {
      id: membership.id,
      status,
      accessAllRooftops: scopeType === "dealer-group" ? accessAllRooftops : false,
      roleId
    };
    await sudo.db.MembershipAuditEvent.createOne({
      data: {
        scopeType,
        action: existing ? "updated" : "created",
        dealerGroup: { connect: { id: dealerGroupId } },
        ...rooftopId ? { rooftop: { connect: { id: rooftopId } } } : {},
        targetUser: { connect: { id: targetUserId } },
        actor: { connect: { id: actorUserId } },
        membershipId: membership.id,
        previousSnapshot: snapshot(existing),
        nextSnapshot,
        reason,
        occurredAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const saved = await sudo.query[listKey].findOne({ where: { id: membership.id }, query: "id updatedAt" });
    return { ...nextSnapshot, scopeType, scopeId, updatedAt: new Date(saved.updatedAt) };
  });
}

// features/keystone/lifecycle/inventoryAcquisitionLifecycle.ts
var NEXT = {
  appraised: ["approved", "cancelled"],
  approved: ["purchased", "cancelled"],
  purchased: ["arrived", "cancelled"],
  arrived: ["reconditioning", "cancelled"],
  reconditioning: ["frontline", "cancelled"],
  frontline: [],
  cancelled: []
};
function assertInventoryAcquisitionTransition(from, to) {
  if (from === "frontline" || from === "cancelled") {
    throw new Error(`Inventory acquisition status ${from} is terminal`);
  }
  if (!NEXT[from]?.includes(to)) {
    throw new Error(`Invalid inventory acquisition transition: ${from} -> ${to}`);
  }
}
function buildAcquisitionEvidence(input2) {
  return {
    version: 1,
    reference: String(input2.reference || ""),
    rooftopId: String(input2.rooftopId || ""),
    vehicleIdentity: {
      vin: String(input2.vin || ""),
      year: Number(input2.year || 0),
      make: String(input2.make || ""),
      model: String(input2.model || "")
    },
    acquisitionSource: String(input2.acquisitionSource || ""),
    appraisalCents: Number(input2.appraisalCents || 0),
    purchaseCents: Number(input2.purchaseCents || 0),
    reconEstimateCents: Number(input2.reconEstimateCents || 0)
  };
}

// features/keystone/mutations/startInventoryAcquisition.ts
var SOURCES2 = /* @__PURE__ */ new Set(["trade-in", "auction", "wholesale", "consumer-purchase", "oem-distributor", "dealer-transfer"]);
function nonNegativeInteger(value, label, required7 = false) {
  if (value == null && !required7) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer number of cents`);
  return number;
}
async function startInventoryAcquisition(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error("Inventory management permission is required");
  }
  const rooftopId = requiredText(data.rooftopId, "Rooftop", 100);
  const idempotencyKey2 = String(data.idempotencyKey || "").trim();
  if (idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    throw new Error("Idempotency key must be between 8 and 200 characters");
  }
  const reason = requiredText(data.reason, "Audit reason", 500);
  const vin = String(data.vin || "").trim().toUpperCase();
  if (vin.length !== 17) throw new Error("VIN must be exactly 17 characters");
  const year = Number(data.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Vehicle year is invalid");
  const make = requiredText(data.make, "Make", 100);
  const model = requiredText(data.model, "Model", 100);
  const acquisitionSource = requiredText(data.acquisitionSource, "Acquisition source", 50);
  if (!SOURCES2.has(acquisitionSource)) throw new Error("Unsupported acquisition source");
  const appraisalCents = nonNegativeInteger(data.appraisalCents, "Appraisal", true);
  const reconEstimateCents = nonNegativeInteger(data.reconEstimateCents, "Recon estimate");
  const odometer = nonNegativeInteger(data.odometer, "Odometer");
  await assertSessionRooftopPermission(context, rooftopId, "canManageInventory");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id status" });
  if (!rooftop || rooftop.status !== "active") throw new Error("Rooftop not found or not accessible");
  let vehicleId = null;
  if (data.vehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: String(data.vehicleId) }, query: "id vin rooftop { id }" });
    if (!vehicle || vehicle.rooftop?.id !== rooftopId) throw new Error("Vehicle must belong to the same rooftop");
    if (vehicle.vin !== vin) throw new Error("Linked vehicle VIN must match the acquisition VIN");
    vehicleId = vehicle.id;
  }
  const domainEvidence = {
    rooftopId,
    vin,
    year,
    make,
    model,
    acquisitionSource,
    appraisalCents,
    reconEstimateCents,
    odometer,
    vehicleId
  };
  const acquisitionId = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey2}, 0))`;
    const replay = await tx.prisma.inventoryAcquisition.findUnique({ where: { idempotencyKey: idempotencyKey2 }, select: { id: true, rooftopId: true, status: true } });
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey: `inventory-acquisition-start:${idempotencyKey2}`,
        rooftopId: replay.rooftopId,
        aggregateType: "InventoryAcquisition",
        aggregateId: replay.id,
        action: "started",
        topic: "inventory-acquisition.started",
        actorId: context.session.itemId,
        afterSnapshot: domainEvidence,
        payload: { acquisitionId: replay.id, rooftopId: replay.rooftopId, status: replay.status }
      });
      return replay.id;
    }
    const now = /* @__PURE__ */ new Date();
    const reference2 = `ACQ-${now.toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const acquisition = await tx.prisma.inventoryAcquisition.create({
      data: {
        rooftopId,
        reference: reference2,
        idempotencyKey: idempotencyKey2,
        status: "appraised",
        acquisitionSource,
        sourceReference: String(data.sourceReference || "").trim().slice(0, 200),
        vin,
        year,
        make,
        model,
        odometer,
        appraisalCents,
        reconEstimateCents,
        vehicleId,
        requestedById: context.session.itemId,
        lastTransitionedById: context.session.itemId
      },
      select: { id: true }
    });
    await tx.prisma.inventoryAcquisitionEvent.create({
      data: {
        rooftopId,
        acquisitionId: acquisition.id,
        fromStatus: "",
        toStatus: "appraised",
        reason,
        evidence: buildAcquisitionEvidence({ reference: reference2, rooftopId, vin, year, make, model, acquisitionSource, appraisalCents, reconEstimateCents }),
        actorId: context.session.itemId,
        occurredAt: now
      }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey: `inventory-acquisition-start:${idempotencyKey2}`,
      rooftopId,
      aggregateType: "InventoryAcquisition",
      aggregateId: acquisition.id,
      action: "started",
      topic: "inventory-acquisition.started",
      actorId: context.session.itemId,
      afterSnapshot: domainEvidence,
      payload: { acquisitionId: acquisition.id, rooftopId, status: "appraised" }
    });
    return acquisition.id;
  }, { timeout: 3e4 });
  return context.db.InventoryAcquisition.findOne({ where: { id: acquisitionId } });
}

// features/keystone/mutations/transitionInventoryAcquisition.ts
function optionalCents(value, label) {
  if (value == null) return void 0;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer number of cents`);
  return number;
}
async function transitionInventoryAcquisition(_root, { id, toStatus, expectedUpdatedAt, reason, purchaseCents, reconEstimateCents, vehicleId, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error("Inventory management permission is required");
  }
  const auditReason = requiredText(reason, "Audit reason", 500);
  const commandKey4 = String(idempotencyKey2 || "").trim();
  if (commandKey4.length < 8 || commandKey4.length > 200) throw new Error("A valid idempotency key is required");
  const expectedVersion = new Date(expectedUpdatedAt);
  if (Number.isNaN(expectedVersion.getTime())) throw new Error("expectedUpdatedAt is invalid");
  const acquisition = await context.query.InventoryAcquisition.findOne({
    where: { id },
    query: `
      id reference status updatedAt rooftop { id } vehicle { id }
      vin year make model acquisitionSource appraisalCents purchaseCents reconEstimateCents
    `
  });
  if (!acquisition?.rooftop?.id) throw new Error("Inventory acquisition not found or not accessible");
  await assertSessionRooftopPermission(context, acquisition.rooftop.id, "canManageInventory");
  const eventKey = `inventory-acquisition-transition:${commandKey4}`;
  const requestEvidence = {
    acquisitionId: id,
    toStatus,
    reason: auditReason,
    purchaseCents: purchaseCents ?? null,
    reconEstimateCents: reconEstimateCents ?? null,
    vehicleId: vehicleId ?? null
  };
  const domainEvent = {
    eventKey,
    rooftopId: acquisition.rooftop.id,
    aggregateType: "InventoryAcquisition",
    aggregateId: id,
    action: `transitioned:${toStatus}`,
    topic: "inventory-acquisition.transitioned",
    actorId: context.session.itemId,
    afterSnapshot: requestEvidence,
    payload: { acquisitionId: id, rooftopId: acquisition.rooftop.id, status: toStatus }
  };
  const replay = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } });
  if (replay) {
    if (replay.aggregateId !== id) throw new Error("Acquisition transition idempotency key belongs to another acquisition");
    await context.transaction((tx) => recordDomainEventInTransaction(tx, domainEvent), { timeout: 3e4 });
    return context.db.InventoryAcquisition.findOne({ where: { id } });
  }
  if (new Date(acquisition.updatedAt).toISOString() !== expectedVersion.toISOString()) {
    throw new Error("Inventory acquisition changed since it was loaded");
  }
  assertInventoryAcquisitionTransition(acquisition.status, toStatus);
  const nextPurchaseCents = optionalCents(purchaseCents, "Purchase amount") ?? acquisition.purchaseCents;
  const nextReconEstimateCents = optionalCents(reconEstimateCents, "Recon estimate") ?? acquisition.reconEstimateCents;
  const nextVehicleId = vehicleId ? String(vehicleId) : acquisition.vehicle?.id || null;
  if (nextVehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: nextVehicleId }, query: "id vin rooftop { id } priceCents description imagesCount inventoryStock { id reconStatus merchandisingStatus }" });
    if (!vehicle || vehicle.rooftop?.id !== acquisition.rooftop.id) throw new Error("Vehicle must belong to the same rooftop");
    if (vehicle.vin !== acquisition.vin) throw new Error("Linked vehicle VIN must match the acquisition VIN");
    if (toStatus === "frontline" && (!(vehicle.priceCents > 0) || !String(vehicle.description || "").trim() || vehicle.imagesCount < 1)) {
      throw new Error("Frontline readiness requires a price, description, and at least one image");
    }
    if (toStatus === "frontline" && (!vehicle.inventoryStock || vehicle.inventoryStock.reconStatus !== "completed" || vehicle.inventoryStock.merchandisingStatus !== "approved")) {
      throw new Error("Frontline readiness requires completed reconditioning and approved merchandising evidence");
    }
  }
  if (toStatus === "purchased" && !(nextPurchaseCents > 0)) throw new Error("Purchase amount is required before purchase");
  if (toStatus === "frontline" && !nextVehicleId) throw new Error("A linked vehicle is required for frontline readiness");
  const now = /* @__PURE__ */ new Date();
  const evidence = buildAcquisitionEvidence({
    ...acquisition,
    rooftopId: acquisition.rooftop.id,
    purchaseCents: nextPurchaseCents,
    reconEstimateCents: nextReconEstimateCents
  });
  await context.transaction(async (tx) => {
    let frontlineStockId = null;
    if (toStatus === "frontline") {
      const stock = await tx.prisma.inventoryStock.findFirst({
        where: { vehicleId: nextVehicleId, rooftopId: acquisition.rooftop.id, reconStatus: "completed", merchandisingStatus: "approved" },
        select: { id: true }
      });
      if (!stock) throw new Error("Inventory readiness changed; completed recon and approved merchandising are required");
      const eligibleVehicle = await tx.prisma.vehicle.updateMany({
        where: { id: nextVehicleId, rooftopId: acquisition.rooftop.id, status: { in: ["available", "service"] } },
        data: { status: "available" }
      });
      if (eligibleVehicle.count !== 1) {
        throw new Error("Vehicle is reserved or no longer eligible for frontline readiness; reload and retry");
      }
      frontlineStockId = stock.id;
    }
    const changed = await tx.prisma.inventoryAcquisition.updateMany({
      where: { id, status: acquisition.status, updatedAt: expectedVersion },
      data: {
        status: toStatus,
        purchaseCents: nextPurchaseCents,
        reconEstimateCents: nextReconEstimateCents,
        vehicleId: nextVehicleId,
        lastTransitionedById: context.session.itemId,
        ...toStatus === "purchased" ? { purchasedAt: now, immutablePurchaseSnapshot: evidence } : {},
        ...toStatus === "arrived" ? { arrivedAt: now } : {},
        ...toStatus === "frontline" ? { frontlineAt: now } : {}
      }
    });
    if (changed.count !== 1) throw new Error("Inventory acquisition changed concurrently; reload and retry");
    await tx.prisma.inventoryAcquisitionEvent.create({
      data: {
        rooftopId: acquisition.rooftop.id,
        acquisitionId: id,
        fromStatus: acquisition.status,
        toStatus,
        reason: auditReason,
        evidence,
        actorId: context.session.itemId,
        occurredAt: now
      }
    });
    if (frontlineStockId) {
      await tx.prisma.inventoryStock.update({ where: { id: frontlineStockId }, data: { frontlineAt: now } });
    }
    await recordDomainEventInTransaction(tx, domainEvent);
  }, { timeout: 3e4 });
  return context.db.InventoryAcquisition.findOne({ where: { id } });
}

// features/keystone/mutations/createDealPencil.ts
function cents(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be non-negative integer cents`);
  return number;
}
async function createDealPencil(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) {
    throw new Error("Deal management permission is required");
  }
  const rooftopId = String(data.rooftopId || "");
  const vehicleId = String(data.vehicleId || "");
  const leadId = data.leadId ? String(data.leadId) : null;
  const salespersonId = data.salespersonId ? String(data.salespersonId) : null;
  const tradeInId = data.tradeInId ? String(data.tradeInId) : null;
  const idempotencyKey2 = String(data.idempotencyKey || "").trim();
  if (!rooftopId || !vehicleId || idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    throw new Error("Rooftop, vehicle, and a valid idempotency key are required");
  }
  await assertSessionRooftopPermission(context, rooftopId, "canManageDeals");
  const [rooftop, vehicle, lead, tradeIn] = await Promise.all([
    context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id status" }),
    context.query.Vehicle.findOne({ where: { id: vehicleId }, query: "id status rooftop { id } vin stockNumber year make model trim" }),
    leadId ? context.query.Lead.findOne({ where: { id: leadId }, query: "id rooftop { id } assignedSalesperson { id }" }) : null,
    tradeInId ? context.query.TradeIn.findOne({ where: { id: tradeInId }, query: "id rooftop { id } lead { id } deal { id }" }) : null
  ]);
  if (!rooftop || rooftop.status !== "active") throw new Error("Rooftop not found or not accessible");
  if (!vehicle || vehicle.rooftop?.id !== rooftopId || vehicle.status !== "available") throw new Error("Deal vehicle is not available at this rooftop");
  if (leadId && (!lead || lead.rooftop?.id !== rooftopId)) throw new Error("Deal lead must belong to the same rooftop");
  if (tradeInId && (!tradeIn || tradeIn.rooftop?.id !== rooftopId || tradeIn.deal)) throw new Error("Trade-in is unavailable or belongs to another rooftop");
  if (lead && tradeIn?.lead?.id && tradeIn.lead.id !== lead.id) throw new Error("Deal and trade-in must belong to the same lead");
  if (salespersonId) {
    await assertUserRooftopAccess(context, salespersonId, rooftopId);
    if (lead?.assignedSalesperson?.id && lead.assignedSalesperson.id !== salespersonId) {
      throw new Error("Deal salesperson must match the lead assignment");
    }
  }
  const terms = {
    vehiclePriceCents: cents(data.vehiclePriceCents, "Vehicle price"),
    tradeInValueCents: cents(data.tradeInValueCents, "Trade-in value"),
    downPaymentCents: cents(data.downPaymentCents, "Down payment"),
    financingAmountCents: 0,
    monthlyPaymentCents: 0,
    taxAmountCents: 0,
    loanTerm: null,
    apr: null,
    fees: [],
    rebates: [],
    products: [],
    taxLines: [],
    structureType: "cash",
    worksheetVersion: 0
  };
  const eventKey = `deal-pencil:${idempotencyKey2}`;
  const evidence = {
    rooftopId,
    vehicleId,
    leadId,
    salespersonId,
    tradeInId,
    terms,
    vehicle: { id: vehicle.id, vin: vehicle.vin, stockNumber: vehicle.stockNumber, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim }
  };
  const dealId = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } });
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId,
        aggregateType: "Deal",
        aggregateId: replay.aggregateId,
        action: "pencil-created",
        topic: "deal.pencil-created",
        actorId: context.session.itemId,
        afterSnapshot: evidence,
        payload: { dealId: replay.aggregateId, rooftopId, status: "pencil" }
      });
      return replay.aggregateId;
    }
    const deal = await tx.prisma.deal.create({
      data: {
        rooftopId,
        vehicleId,
        leadId,
        salespersonId,
        tradeInVehicleId: tradeInId,
        status: "pencil",
        ...terms
      },
      select: { id: true }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "Deal",
      aggregateId: deal.id,
      action: "pencil-created",
      topic: "deal.pencil-created",
      actorId: context.session.itemId,
      afterSnapshot: evidence,
      payload: { dealId: deal.id, rooftopId, status: "pencil" }
    });
    return deal.id;
  }, { timeout: 3e4 });
  return context.db.Deal.findOne({ where: { id: dealId } });
}

// features/keystone/mutations/openServiceOrder.ts
function cents2(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be non-negative integer cents`);
  return number;
}
async function openServiceOrder(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error("Service management permission is required");
  }
  const appointmentId = String(data.appointmentId || "");
  const idempotencyKey2 = String(data.idempotencyKey || "").trim();
  if (!appointmentId || idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    throw new Error("Appointment and a valid idempotency key are required");
  }
  const appointment = await context.query.ServiceAppointment.findOne({
    where: { id: appointmentId },
    query: "id rooftop { id } status serviceOrder { id } lead { id } customerVehicleDescription"
  });
  if (!appointment?.rooftop?.id) throw new Error("Service appointment not found or not accessible");
  await assertSessionRooftopPermission(context, appointment.rooftop.id, "canManageService");
  if (appointment.serviceOrder?.id) throw new Error("Appointment already has a service order");
  if (["completed", "cancelled"].includes(appointment.status)) throw new Error("Closed appointments cannot open repair orders");
  const rooftopId = appointment.rooftop.id;
  const eventKey = `service-order-open:${idempotencyKey2}`;
  const evidence = {
    rooftopId,
    appointmentId,
    leadId: appointment.lead?.id ?? null,
    customerVehicleDescription: appointment.customerVehicleDescription,
    diagnosis: String(data.diagnosis || "").trim().slice(0, 4e3),
    laborTotalCents: cents2(data.laborTotalCents, "Labor total"),
    partsTotalCents: cents2(data.partsTotalCents, "Parts total"),
    taxCents: cents2(data.taxCents, "Tax"),
    grandTotalCents: cents2(data.grandTotalCents, "Grand total")
  };
  const orderId = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } });
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId,
        aggregateType: "ServiceOrder",
        aggregateId: replay.aggregateId,
        action: "opened",
        topic: "service-order.opened",
        actorId: context.session.itemId,
        afterSnapshot: evidence,
        payload: { serviceOrderId: replay.aggregateId, rooftopId, status: "estimate" }
      });
      return replay.aggregateId;
    }
    const current = await tx.prisma.serviceAppointment.findUnique({ where: { id: appointmentId }, select: { serviceOrder: { select: { id: true } } } });
    if (current?.serviceOrder) throw new Error("Appointment already has a service order");
    const order2 = await tx.prisma.serviceOrder.create({
      data: {
        rooftopId,
        status: "estimate",
        diagnosis: evidence.diagnosis,
        laborTotalCents: evidence.laborTotalCents,
        partsTotalCents: evidence.partsTotalCents,
        taxCents: evidence.taxCents,
        grandTotalCents: evidence.grandTotalCents
      },
      select: { id: true }
    });
    const attached = await tx.prisma.serviceAppointment.updateMany({
      where: { id: appointmentId, rooftopId, serviceOrderId: null },
      data: { serviceOrderId: order2.id }
    });
    if (attached.count !== 1) throw new Error("Appointment changed concurrently; reload and retry");
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "ServiceOrder",
      aggregateId: order2.id,
      action: "opened",
      topic: "service-order.opened",
      actorId: context.session.itemId,
      afterSnapshot: evidence,
      payload: { serviceOrderId: order2.id, rooftopId, status: "estimate" }
    });
    return order2.id;
  }, { timeout: 3e4 });
  return context.db.ServiceOrder.findOne({ where: { id: orderId } });
}

// features/keystone/lifecycle/serviceAppointmentTransitions.ts
var SERVICE_APPOINTMENT_TRANSITIONS = {
  scheduled: ["checked-in", "cancelled"],
  "checked-in": ["in-progress", "waiting-parts", "cancelled"],
  "in-progress": ["waiting-parts", "completed"],
  "waiting-parts": ["in-progress", "completed"],
  completed: [],
  cancelled: []
};

// features/keystone/mutations/operatorWorkflows.ts
function commandKey(value) {
  const key5 = String(value || "").trim();
  if (key5.length < 8 || key5.length > 200) throw new Error("A valid idempotency key is required");
  return key5;
}
async function replayOrLock(tx, event2) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${event2.eventKey}`}, 0))`;
  const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey: event2.eventKey }, select: { aggregateId: true } });
  if (!replay) return false;
  if (replay.aggregateId !== event2.aggregateId) throw new Error("Idempotency key belongs to another record");
  await recordDomainEventInTransaction(tx, event2);
  return true;
}
var LEAD_TRANSITIONS = {
  new: ["contacted", "test-drive-scheduled", "closed-lost"],
  contacted: ["test-drive-scheduled", "negotiating", "closed-won", "closed-lost"],
  "test-drive-scheduled": ["contacted", "negotiating", "closed-won", "closed-lost"],
  negotiating: ["closed-won", "closed-lost"],
  "closed-won": [],
  "closed-lost": []
};
async function transitionLead(_root, { id, toStatus, lostReasonCode, lostReasonDetails, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const lead = await context.query.Lead.findOne({ where: { id }, query: "id status rooftop { id } updatedAt" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageLeads");
  if (!LEAD_TRANSITIONS[lead.status]?.includes(toStatus)) throw new Error(`Invalid lead transition: ${lead.status} -> ${toStatus}`);
  const allowedLostReasons = ["purchased-elsewhere", "price", "financing", "vehicle-unavailable", "no-response", "timing", "other"];
  const normalizedLostReason = String(lostReasonCode || "");
  const normalizedLostDetails = String(lostReasonDetails || "").trim().slice(0, 2e3);
  if (toStatus === "closed-lost" && !allowedLostReasons.includes(normalizedLostReason)) throw new Error("A structured lost-sale reason is required");
  if (toStatus !== "closed-lost" && (normalizedLostReason || normalizedLostDetails)) throw new Error("Lost-sale evidence is only valid for closed-lost");
  const event2 = {
    eventKey: `lead-transition:${commandKey(idempotencyKey2)}`,
    rooftopId: lead.rooftop.id,
    aggregateType: "Lead",
    aggregateId: id,
    action: `transitioned:${toStatus}`,
    topic: "lead.transitioned",
    actorId: context.session.itemId,
    afterSnapshot: { leadId: id, toStatus, lostReasonCode: normalizedLostReason || null, lostReasonDetails: normalizedLostDetails || null },
    payload: { leadId: id, rooftopId: lead.rooftop.id, status: toStatus, lostReasonCode: normalizedLostReason || null }
  };
  await context.transaction(async (tx) => {
    if (await replayOrLock(tx, event2)) return;
    const changed = await tx.prisma.lead.updateMany({
      where: { id, rooftopId: lead.rooftop.id, status: lead.status, updatedAt: new Date(lead.updatedAt) },
      data: { status: toStatus, lastContact: /* @__PURE__ */ new Date(), ...toStatus === "closed-lost" ? { lostReasonCode: normalizedLostReason, lostReason: normalizedLostDetails || null, cadenceStatus: "completed", cadenceDueAt: null } : {} }
    });
    if (changed.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    await recordDomainEventInTransaction(tx, event2);
  }, { timeout: 3e4 });
  return context.db.Lead.findOne({ where: { id } });
}
async function recordLeadInteraction(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const leadId = String(data.leadId || "");
  const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: "id status firstResponseAt rooftop { id } updatedAt" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageLeads");
  const interactionType = String(data.interactionType || "");
  const outcome = String(data.outcome || "");
  const notes = String(data.notes || "").trim().slice(0, 4e3);
  if (!notes) throw new Error("Interaction notes are required");
  const occurredAt = data.date ? new Date(data.date) : /* @__PURE__ */ new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Interaction date is invalid");
  const followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
  if (followUpDate && Number.isNaN(followUpDate.getTime())) throw new Error("Follow-up date is invalid");
  const event2 = {
    eventKey: `lead-interaction:${commandKey(data.idempotencyKey)}`,
    rooftopId: lead.rooftop.id,
    aggregateType: "Lead",
    aggregateId: leadId,
    action: "interaction-recorded",
    topic: "lead.interaction-recorded",
    actorId: context.session.itemId,
    afterSnapshot: {
      leadId,
      interactionType,
      outcome,
      notesHash: domainEventRequestHash(notes),
      requestedDate: data.date ? occurredAt.toISOString() : null,
      followUpDate: followUpDate?.toISOString() ?? null
    },
    payload: { leadId, rooftopId: lead.rooftop.id, interactionType, outcome }
  };
  let interactionId = "";
  await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${event2.eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey: event2.eventKey }, select: { metadata: true } });
    if (replay) {
      const metadata = replay.metadata || {};
      await recordDomainEventInTransaction(tx, { ...event2, metadata });
      interactionId = String(metadata.interactionId || "");
      if (!interactionId) throw new Error("Interaction replay evidence is incomplete");
      return;
    }
    const interaction = await tx.prisma.customerInteraction.create({
      data: {
        rooftopId: lead.rooftop.id,
        leadId,
        performedById: context.session.itemId,
        interactionType,
        outcome,
        notes,
        date: occurredAt,
        followUpDate
      },
      select: { id: true }
    });
    interactionId = interaction.id;
    const changed = await tx.prisma.lead.updateMany({
      where: { id: leadId, updatedAt: new Date(lead.updatedAt) },
      data: {
        lastContact: occurredAt,
        ...lead.firstResponseAt ? {} : { firstResponseAt: occurredAt },
        ...lead.status === "new" ? { status: "contacted" } : {}
      }
    });
    if (changed.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    await recordDomainEventInTransaction(tx, { ...event2, metadata: { interactionId: interaction.id } });
  }, { timeout: 3e4 });
  return { id: interactionId, leadId };
}
async function updateTestDriveWorkflow(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const id = String(data.id || "");
  const action = String(data.action || "");
  if (!["verify-license", "complete"].includes(action)) throw new Error("Unsupported test-drive action");
  const drive = await context.query.TestDrive.findOne({ where: { id }, query: "id completed driverLicenseVerified rooftop { id } lead { id status updatedAt } updatedAt" });
  if (!drive?.rooftop?.id) throw new Error("Test drive not found or not accessible");
  await assertSessionRooftopPermission(context, drive.rooftop.id, "canManageLeads");
  if (drive.completed) throw new Error("Completed test drives are immutable");
  if (action === "complete" && !drive.driverLicenseVerified) throw new Error("Driver license must be verified before completion");
  const interestedLevel = String(data.interestedLevel || "maybe");
  if (action === "complete" && !["not-interested", "maybe", "very-interested"].includes(interestedLevel)) throw new Error("Interest level is invalid");
  const targetLeadStatus = interestedLevel === "very-interested" ? "negotiating" : "contacted";
  if (action === "complete" && drive.lead?.id && drive.lead.status !== targetLeadStatus && !LEAD_TRANSITIONS[drive.lead.status]?.includes(targetLeadStatus)) {
    throw new Error(`Test drive cannot move lead from ${drive.lead.status} to ${targetLeadStatus}`);
  }
  const event2 = {
    eventKey: `test-drive:${commandKey(data.idempotencyKey)}`,
    rooftopId: drive.rooftop.id,
    aggregateType: "TestDrive",
    aggregateId: id,
    action,
    topic: `test-drive.${action}`,
    actorId: context.session.itemId,
    afterSnapshot: { testDriveId: id, action, interestedLevel: action === "complete" ? interestedLevel : null },
    payload: { testDriveId: id, rooftopId: drive.rooftop.id, action }
  };
  await context.transaction(async (tx) => {
    if (await replayOrLock(tx, event2)) return;
    const now = /* @__PURE__ */ new Date();
    const changed = await tx.prisma.testDrive.updateMany({
      where: { id, updatedAt: new Date(drive.updatedAt), completed: false },
      data: action === "verify-license" ? { driverLicenseVerified: true } : { completed: true, interestedLevel, feedback: String(data.feedback || "").trim().slice(0, 4e3) }
    });
    if (changed.count !== 1) throw new Error("Test drive changed concurrently; reload and retry");
    if (action === "complete" && drive.lead?.id) {
      const leadChanged = await tx.prisma.lead.updateMany({
        where: { id: drive.lead.id, rooftopId: drive.rooftop.id, status: drive.lead.status, updatedAt: new Date(drive.lead.updatedAt) },
        data: { status: targetLeadStatus, lastContact: now }
      });
      if (leadChanged.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    }
    await recordDomainEventInTransaction(tx, event2);
  }, { timeout: 3e4 });
  return context.db.TestDrive.findOne({ where: { id } });
}
var APPOINTMENT_TRANSITIONS = SERVICE_APPOINTMENT_TRANSITIONS;
async function transitionServiceAppointment(_root, { id, toStatus, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service management permission is required");
  const appointment = await context.query.ServiceAppointment.findOne({ where: { id }, query: "id status rooftop { id } updatedAt" });
  if (!appointment?.rooftop?.id) throw new Error("Service appointment not found or not accessible");
  await assertSessionRooftopPermission(context, appointment.rooftop.id, "canManageService");
  if (!APPOINTMENT_TRANSITIONS[appointment.status]?.includes(toStatus)) throw new Error(`Invalid service appointment transition: ${appointment.status} -> ${toStatus}`);
  const event2 = {
    eventKey: `service-appointment:${commandKey(idempotencyKey2)}`,
    rooftopId: appointment.rooftop.id,
    aggregateType: "ServiceAppointment",
    aggregateId: id,
    action: `transitioned:${toStatus}`,
    topic: "service-appointment.transitioned",
    actorId: context.session.itemId,
    afterSnapshot: { appointmentId: id, toStatus },
    payload: { appointmentId: id, rooftopId: appointment.rooftop.id, status: toStatus }
  };
  await context.transaction(async (tx) => {
    if (await replayOrLock(tx, event2)) return;
    const changed = await tx.prisma.serviceAppointment.updateMany({
      where: { id, status: appointment.status, updatedAt: new Date(appointment.updatedAt) },
      data: { status: toStatus }
    });
    if (changed.count !== 1) throw new Error("Service appointment changed concurrently; reload and retry");
    await recordDomainEventInTransaction(tx, event2);
  }, { timeout: 3e4 });
  return context.db.ServiceAppointment.findOne({ where: { id } });
}
async function recordTradeInAppraisal(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageTradeIns({ session: context.session })) throw new Error("Trade-in management permission is required");
  const id = String(data.id || "");
  const tradeIn = await context.query.TradeIn.findOne({ where: { id }, query: "id rooftop { id } deal { id } updatedAt" });
  if (!tradeIn?.rooftop?.id) throw new Error("Trade-in not found or not accessible");
  await assertSessionRooftopPermission(context, tradeIn.rooftop.id, "canManageTradeIns");
  if (tradeIn.deal?.id) throw new Error("Attached trade-in appraisal is immutable");
  const referenceValueCents = Number(data.referenceValueCents ?? 0);
  const offerAmountCents = Number(data.offerAmountCents ?? 0);
  if (![referenceValueCents, offerAmountCents].every((value) => Number.isInteger(value) && value >= 0)) throw new Error("Appraisal values must be non-negative integer cents");
  const event2 = {
    eventKey: `trade-in-appraisal:${commandKey(data.idempotencyKey)}`,
    rooftopId: tradeIn.rooftop.id,
    aggregateType: "TradeIn",
    aggregateId: id,
    action: "appraised",
    topic: "trade-in.appraised",
    actorId: context.session.itemId,
    afterSnapshot: { tradeInId: id, referenceValueCents, offerAmountCents, valuationSource: "operator-recorded" },
    payload: { tradeInId: id, rooftopId: tradeIn.rooftop.id, referenceValueCents, offerAmountCents, valuationSource: "operator-recorded" }
  };
  await context.transaction(async (tx) => {
    if (await replayOrLock(tx, event2)) return;
    const changed = await tx.prisma.tradeIn.updateMany({
      where: { id, updatedAt: new Date(tradeIn.updatedAt), deal: { is: null } },
      data: { kbbValueCents: referenceValueCents, offerAmountCents, appraisedById: context.session.itemId }
    });
    if (changed.count !== 1) throw new Error("Trade-in changed concurrently; reload and retry");
    await recordDomainEventInTransaction(tx, event2);
  }, { timeout: 3e4 });
  return context.db.TradeIn.findOne({ where: { id } });
}
async function createLeadTask(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageTasks({ session: context.session })) throw new Error("Task management permission is required");
  const leadId = String(data.leadId || "");
  const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: "id rooftop { id } assignedSalesperson { id } customer { id emailConsent smsConsent phoneConsent emailSuppressed smsSuppressed phoneSuppressed }" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, ["canManageLeads", "canManageFinancing", "canManageService"]);
  const communicationChannel = String(data.communicationChannel || "internal");
  if (!["internal", "email", "sms", "phone"].includes(communicationChannel)) throw new Error("Task communication channel is invalid");
  if (communicationChannel !== "internal") {
    const consent = lead.customer?.[`${communicationChannel}Consent`] === true;
    const suppressed = lead.customer?.[`${communicationChannel}Suppressed`] === true;
    if (!consent || suppressed) throw new Error(`Customer ${communicationChannel} contact is not permitted`);
  }
  const title = String(data.title || "").trim().slice(0, 200);
  const description = String(data.description || "").trim().slice(0, 4e3);
  const priority = String(data.priority || "medium");
  if (!title) throw new Error("Task title is required");
  if (!["low", "medium", "high", "urgent"].includes(priority)) throw new Error("Task priority is invalid");
  const dueDate = data.dueDate ? data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) throw new Error("Task due date is invalid");
  const assignedToId = String(data.assignedToId || lead.assignedSalesperson?.id || context.session.itemId);
  const event2 = {
    eventKey: `task-create:${commandKey(data.idempotencyKey)}`,
    rooftopId: lead.rooftop.id,
    aggregateType: "Lead",
    aggregateId: leadId,
    action: "task-created",
    topic: "lead.task-created",
    actorId: context.session.itemId,
    afterSnapshot: { leadId, title, descriptionHash: domainEventRequestHash(description), priority, communicationChannel, dueDate: dueDate?.toISOString() ?? null, assignedToId },
    payload: { leadId, rooftopId: lead.rooftop.id, title, priority, communicationChannel, dueDate: dueDate?.toISOString() ?? null, assignedToId }
  };
  let taskId = "";
  await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${event2.eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey: event2.eventKey }, select: { metadata: true } });
    if (replay) {
      await recordDomainEventInTransaction(tx, { ...event2, metadata: replay.metadata });
      taskId = String(replay.metadata?.taskId || "");
      if (!taskId) throw new Error("Task replay evidence is incomplete");
      return;
    }
    const [groupAccess, directAccess] = await Promise.all([
      tx.prisma.dealerGroupMembership.count({ where: { userId: assignedToId, status: "active", accessAllRooftops: true, dealerGroup: { rooftops: { some: { id: lead.rooftop.id } } } } }),
      tx.prisma.rooftopMembership.count({ where: { userId: assignedToId, status: "active", rooftopId: lead.rooftop.id } })
    ]);
    if (groupAccess === 0 && directAccess === 0) throw new Error("Task assignee must have active rooftop access");
    const task = await tx.prisma.task.create({ data: { rooftopId: lead.rooftop.id, leadId, assignedToId, title, description, priority, completed: false, dueDate }, select: { id: true } });
    taskId = task.id;
    await recordDomainEventInTransaction(tx, { ...event2, metadata: { taskId } });
  }, { timeout: 3e4 });
  return context.db.Task.findOne({ where: { id: taskId } });
}
async function completeTask(_root, { id, idempotencyKey: idempotencyKey2 }, context) {
  if (!context.session?.itemId || !permissions.canManageTasks({ session: context.session })) throw new Error("Task management permission is required");
  const task = await context.query.Task.findOne({ where: { id }, query: "id completed rooftop { id } updatedAt" });
  if (!task?.rooftop?.id) throw new Error("Task not found or not accessible");
  await assertSessionRooftopPermission(context, task.rooftop.id, ["canManageLeads", "canManageFinancing", "canManageService"]);
  const event2 = {
    eventKey: `task-complete:${commandKey(idempotencyKey2)}`,
    rooftopId: task.rooftop.id,
    aggregateType: "Task",
    aggregateId: id,
    action: "completed",
    topic: "task.completed",
    actorId: context.session.itemId,
    afterSnapshot: { taskId: id, completed: true },
    payload: { taskId: id, rooftopId: task.rooftop.id, completed: true }
  };
  await context.transaction(async (tx) => {
    if (await replayOrLock(tx, event2)) return;
    if (!task.completed) {
      const changed = await tx.prisma.task.updateMany({ where: { id, updatedAt: new Date(task.updatedAt), completed: false }, data: { completed: true, completedDate: /* @__PURE__ */ new Date() } });
      if (changed.count !== 1) throw new Error("Task changed concurrently; reload and retry");
    }
    await recordDomainEventInTransaction(tx, event2);
  }, { timeout: 3e4 });
  return context.db.Task.findOne({ where: { id } });
}

// features/keystone/mutations/domainTimeline.ts
var AGGREGATE_TYPES = /* @__PURE__ */ new Set([
  "Vehicle",
  "Lead",
  "Task",
  "TestDrive",
  "TradeIn",
  "Deal",
  "FinanceFundingCase",
  "DeliveryCase",
  "FinancingApplication",
  "LenderSubmission",
  "LenderDecision",
  "ServiceAppointment",
  "ServiceOrder",
  "InventoryAcquisition",
  "Customer",
  "LeadRoutingRule"
]);
async function domainTimeline(_root, { aggregateType, aggregateId, limit = 50 }, context) {
  if (!context.session?.itemId) throw new Error("Authentication required");
  if (!AGGREGATE_TYPES.has(aggregateType)) throw new Error("Unsupported timeline aggregate type");
  const take = Math.max(1, Math.min(100, Number(limit) || 50));
  const events = await context.query.DomainAuditEvent.findMany({
    where: {
      aggregateType: { equals: aggregateType },
      aggregateId: { equals: String(aggregateId || "") }
    },
    orderBy: { occurredAt: "desc" },
    take,
    query: "id eventKey aggregateType aggregateId action beforeSnapshot afterSnapshot metadata occurredAt actor { id name }"
  });
  return events.map((event2) => ({
    ...event2,
    occurredAt: event2.occurredAt instanceof Date ? event2.occurredAt : new Date(event2.occurredAt)
  }));
}

// features/keystone/integrations/inventory/channelRegistry.ts
var CHANNELS = Object.freeze({
  "public-inventory-feed": Object.freeze({
    key: "public-inventory-feed",
    label: "Built-in public inventory feed",
    mode: "internal",
    externalRequestSent: false
  }),
  "manual-marketplace-export": Object.freeze({
    key: "manual-marketplace-export",
    label: "Operator-recorded marketplace export",
    mode: "operator-recorded",
    externalRequestSent: false
  })
});
function resolveInventoryChannel(key5) {
  const channel = CHANNELS[String(key5 || "")];
  if (!channel) throw new Error("Unsupported inventory channel");
  return channel;
}
function inventoryChannelKeys() {
  return Object.keys(CHANNELS);
}

// features/keystone/mutations/inventoryWorkspace.ts
function boundedPage(limitValue, offsetValue) {
  const limit = Math.max(1, Math.min(100, Number(limitValue) || 50));
  const offset = Math.max(0, Math.min(1e4, Number(offsetValue) || 0));
  return { limit, offset };
}
async function inventoryWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canViewInventory({ session: context.session })) {
    throw new Error("Inventory access is required");
  }
  const { limit, offset } = boundedPage(args.limit, args.offset);
  const status = String(args.status || "").trim();
  const search = String(args.search || "").trim().slice(0, 100);
  const filters = [];
  if (status && status !== "all") filters.push({ vehicle: { status: { equals: status } } });
  if (search) filters.push({ OR: [
    { stockNumber: { contains: search } },
    { vehicle: { vin: { contains: search } } },
    { vehicle: { make: { contains: search } } },
    { vehicle: { model: { contains: search } } }
  ] });
  const accessible = await context.query.InventoryStock.findMany({
    where: filters.length ? { AND: filters } : {},
    orderBy: { stockedAt: "asc" },
    take: limit + 1,
    skip: offset,
    query: "id"
  });
  const hasMore = accessible.length > limit;
  const ids = accessible.slice(0, limit).map((item) => String(item.id));
  const canViewCost = permissions.canViewDealerCost({ session: context.session });
  const rows = ids.length ? await context.sudo().prisma.inventoryStock.findMany({
    where: { id: { in: ids } },
    include: {
      rooftop: { select: { id: true, name: true } },
      vehicle: { select: { id: true, vin: true, stockNumber: true, year: true, make: true, model: true, trim: true, mileage: true, status: true, priceCents: true, description: true, images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } } } },
      acquisition: { select: { id: true, reference: true, status: true, vin: true, year: true, make: true, model: true, acquisitionSource: true, appraisalCents: true, purchaseCents: true, reconEstimateCents: true, updatedAt: true, vehicleId: true } },
      reconWorkItems: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, category: true, status: true, estimatedCostCents: true, actualCostCents: true, dueAt: true, updatedAt: true } },
      merchandisingVersions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, status: true, submittedAt: true, decidedAt: true, decisionReason: true, updatedAt: true } }
    }
  }) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const now = Date.now();
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row?.vehicle) return [];
    const daysInStock = Math.max(0, Math.floor((now - new Date(row.stockedAt).getTime()) / 864e5));
    return [{
      id: row.id,
      rooftop: row.rooftop,
      vehicle: { ...row.vehicle, primaryImagePath: row.vehicle.images[0]?.imagePath ?? null, images: void 0 },
      acquisition: row.acquisition ?? null,
      stockNumber: row.stockNumber,
      locationCode: row.locationCode,
      locationLabel: row.locationLabel || null,
      stockedAt: row.stockedAt,
      updatedAt: row.updatedAt,
      frontlineAt: row.frontlineAt,
      daysInStock,
      isAged: daysInStock >= 60,
      reconStatus: row.reconStatus,
      merchandisingStatus: row.merchandisingStatus,
      feedStatus: row.feedStatus,
      cost: canViewCost ? { purchaseCostCents: row.purchaseCostCents ?? 0, reconCostCents: row.reconCostCents ?? 0, otherCostCents: row.otherCostCents ?? 0, totalCostCents: row.totalCostCents ?? 0 } : null,
      reconWorkItems: row.reconWorkItems.map((work) => ({ ...work, estimatedCostCents: canViewCost ? work.estimatedCostCents : null, actualCostCents: canViewCost ? work.actualCostCents : null })),
      latestMerchandisingVersion: row.merchandisingVersions[0] ?? null
    }];
  });
  const canManageInventory = permissions.canManageInventory({ session: context.session });
  const intakeRooftops = canManageInventory ? await context.query.Rooftop.findMany({ where: { status: { equals: "active" } }, orderBy: { name: "asc" }, take: 100, query: "id name" }) : [];
  const acquisitionIds = canManageInventory ? (await context.query.InventoryAcquisition.findMany({ where: { status: { in: ["appraised", "approved", "purchased", "arrived", "reconditioning"] } }, orderBy: { updatedAt: "asc" }, take: 50, query: "id" })).map((item) => item.id) : [];
  const acquisitions = acquisitionIds.length ? await context.sudo().prisma.inventoryAcquisition.findMany({
    where: { id: { in: acquisitionIds } },
    select: { id: true, reference: true, status: true, vin: true, year: true, make: true, model: true, acquisitionSource: true, appraisalCents: true, purchaseCents: true, reconEstimateCents: true, updatedAt: true, vehicleId: true }
  }) : [];
  const feedRunIds = permissions.canManageInventory({ session: context.session }) ? (await context.query.InventoryFeedRun.findMany({ orderBy: { completedAt: "desc" }, take: 10, query: "id" })).map((item) => item.id) : [];
  const feedRuns = feedRunIds.length ? await context.sudo().prisma.inventoryFeedRun.findMany({ where: { id: { in: feedRunIds } }, orderBy: { completedAt: "desc" }, select: { id: true, channelKey: true, status: true, attemptedCount: true, succeededCount: true, failedCount: true, completedAt: true, _count: { select: { errors: true } } } }) : [];
  return {
    items,
    acquisitions,
    feedRuns: feedRuns.map((run) => ({ ...run, errorCount: run._count.errors, _count: void 0 })),
    channels: inventoryChannelKeys(),
    intakeRooftops,
    summary: {
      visibleCount: items.length,
      availableCount: items.filter((item) => item.vehicle.status === "available").length,
      agedCount: items.filter((item) => item.isAged).length,
      reconOpenCount: items.reduce((count, item) => count + item.reconWorkItems.filter((work) => ["open", "in-progress"].includes(work.status)).length, 0),
      totalRetailValueCents: items.reduce((total, item) => total + (item.vehicle.priceCents ?? 0), 0),
      totalCostCents: canViewCost ? items.reduce((total, item) => total + (item.cost?.totalCostCents ?? 0), 0) : null
    },
    pageInfo: { limit, offset, hasMore }
  };
}

// features/keystone/mutations/inventoryStockCommands.ts
var import_node_crypto5 = require("node:crypto");
function text73(value, label, max = 500) {
  const result2 = String(value || "").trim();
  if (!result2 || result2.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result2;
}
function commandKey2(value) {
  const result2 = String(value || "").trim();
  if (result2.length < 8 || result2.length > 180) throw new Error("A valid idempotency key is required");
  return result2;
}
function requireInventory(context) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error("Inventory management permission is required");
  }
}
async function accessibleStock(context, id) {
  const stock = await context.query.InventoryStock.findOne({
    where: { id },
    query: "id stockNumber locationCode locationLabel reconStatus merchandisingStatus feedStatus stockedAt updatedAt rooftop { id } vehicle { id vin stockNumber } acquisition { id }"
  });
  if (!stock?.rooftop?.id) throw new Error("Inventory stock not found or not accessible");
  await assertSessionRooftopPermission(context, stock.rooftop.id, "canManageInventory");
  return stock;
}
async function commandEvent(tx, event2) {
  const result2 = await recordDomainEventInTransaction(tx, event2);
  return result2.reused;
}
async function stockEvent(tx, event2, eventType, reason, amountCents, evidence = {}) {
  await tx.prisma.inventoryStockEvent.create({
    data: {
      rooftopId: event2.rooftopId,
      stockId: event2.aggregateId,
      eventKey: event2.eventKey,
      eventType,
      reason,
      amountCents,
      evidence,
      actorId: event2.actorId ?? null,
      occurredAt: event2.occurredAt ?? /* @__PURE__ */ new Date()
    }
  });
}
async function result(context, stockId, reused, relatedId) {
  const stock = await context.sudo().prisma.inventoryStock.findUnique({ where: { id: stockId }, select: { id: true, updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true } });
  if (!stock) throw new Error("Inventory stock no longer exists");
  return { id: relatedId ?? stock.id, stockId: stock.id, status: stock.reconStatus, merchandisingStatus: stock.merchandisingStatus, feedStatus: stock.feedStatus, updatedAt: stock.updatedAt, reused };
}
async function establishInventoryStock(_root, { data }, context) {
  requireInventory(context);
  const vehicleId = String(data.vehicleId || "");
  const vehicle = await context.query.Vehicle.findOne({ where: { id: vehicleId }, query: "id vin stockNumber rooftop { id } acquisition { id status purchaseCents arrivedAt frontlineAt }" });
  if (!vehicle?.rooftop?.id) throw new Error("Vehicle not found or not accessible");
  const rooftopId = vehicle.rooftop.id;
  await assertSessionRooftopPermission(context, rooftopId, "canManageInventory");
  const stockNumber = normalizeStockNumber(data.stockNumber || vehicle.stockNumber);
  const stockKey = inventoryStockKey(rooftopId, stockNumber);
  const locationCode = text73(data.locationCode, "Location code", 80).toUpperCase();
  const locationLabel = String(data.locationLabel || "").trim().slice(0, 200);
  const idempotencyKey2 = commandKey2(data.idempotencyKey);
  const reason = text73(data.reason, "Audit reason");
  const acquisitionId = data.acquisitionId ? String(data.acquisitionId) : vehicle.acquisition?.id ?? null;
  if (data.acquisitionId && acquisitionId !== vehicle.acquisition?.id) throw new Error("Acquisition must be attached to the same vehicle");
  const purchaseCostCents = nonNegativeCents(data.purchaseCostCents ?? vehicle.acquisition?.purchaseCents ?? 0, "Purchase cost");
  const evidence = { vehicleId, acquisitionId, stockNumber, locationCode, locationLabel, purchaseCostCents, reason };
  const eventKey = `inventory-stock-establish:${idempotencyKey2}`;
  const command = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } });
    if (replay) {
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "InventoryStock", aggregateId: replay.aggregateId, action: "established", topic: "inventory-stock.established", actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: replay.aggregateId, rooftopId, ...evidence } });
      return { id: replay.aggregateId, reused: true };
    }
    const existing = await tx.prisma.inventoryStock.findFirst({ where: { OR: [{ stockKey }, { vehicleId }] }, select: { id: true } });
    if (existing) throw new Error("Vehicle or rooftop stock number already has an inventory stock record");
    const id = (0, import_node_crypto5.randomUUID)();
    const stockedAt = vehicle.acquisition?.arrivedAt ? new Date(vehicle.acquisition.arrivedAt) : /* @__PURE__ */ new Date();
    await tx.prisma.inventoryStock.create({ data: { id, rooftopId, vehicleId, stockNumber, stockKey, locationCode, locationLabel, stockedAt, frontlineAt: vehicle.acquisition?.frontlineAt ? new Date(vehicle.acquisition.frontlineAt) : null, purchaseCostCents, totalCostCents: purchaseCostCents } });
    await tx.prisma.vehicle.update({ where: { id: vehicleId }, data: { stockNumber } });
    if (acquisitionId) {
      const attached = await tx.prisma.inventoryAcquisition.updateMany({ where: { id: acquisitionId, rooftopId, vehicleId, stockId: null }, data: { stockId: id } });
      if (attached.count !== 1) throw new Error("Acquisition changed concurrently or is already stocked");
    }
    const event2 = { eventKey, rooftopId, aggregateType: "InventoryStock", aggregateId: id, action: "established", topic: "inventory-stock.established", actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: id, rooftopId, ...evidence } };
    await recordDomainEventInTransaction(tx, event2);
    await stockEvent(tx, event2, "established", reason, purchaseCostCents, evidence);
    return { id, reused: false };
  }, { timeout: 3e4 });
  return result(context, command.id, command.reused);
}
async function moveInventoryStock(_root, { data }, context) {
  requireInventory(context);
  const stock = await accessibleStock(context, String(data.stockId || ""));
  const locationCode = text73(data.locationCode, "Location code", 80).toUpperCase();
  const locationLabel = String(data.locationLabel || "").trim().slice(0, 200);
  const reason = text73(data.reason, "Audit reason");
  const expectedUpdatedAt = data.expectedUpdatedAt instanceof Date ? new Date(data.expectedUpdatedAt.getTime()) : new Date(String(data.expectedUpdatedAt || ""));
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error("expectedUpdatedAt is invalid");
  const eventKey = `inventory-stock-move:${commandKey2(data.idempotencyKey)}`;
  const evidence = { stockId: stock.id, toLocationCode: locationCode, locationLabel, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason };
  const reused = await context.transaction(async (tx) => {
    const event2 = { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "moved", topic: "inventory-stock.moved", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } };
    if (await commandEvent(tx, event2)) return true;
    const changed = await tx.prisma.inventoryStock.updateMany({ where: { id: stock.id, rooftopId: stock.rooftop.id, updatedAt: expectedUpdatedAt }, data: { locationCode, locationLabel } });
    if (changed.count !== 1) throw new Error("Inventory stock changed concurrently; reload and retry");
    await stockEvent(tx, event2, "moved", reason, void 0, evidence);
    return false;
  }, { timeout: 3e4 });
  return result(context, stock.id, reused);
}
async function recordInventoryCost(_root, { data }, context) {
  requireInventory(context);
  const stock = await accessibleStock(context, String(data.stockId || ""));
  const costType = String(data.costType || "");
  if (!["reconditioning", "transport", "auction-fee", "detail", "other"].includes(costType)) throw new Error("Unsupported inventory cost type");
  const amountCents = nonNegativeCents(data.amountCents, "Cost amount");
  if (amountCents === 0) throw new Error("Cost amount must be greater than zero");
  const reason = text73(data.reason, "Audit reason");
  const eventKey = `inventory-stock-cost:${commandKey2(data.idempotencyKey)}`;
  const evidence = { stockId: stock.id, costType, amountCents, reference: String(data.reference || "").trim().slice(0, 200) || null, reason };
  const reused = await context.transaction(async (tx) => {
    const event2 = { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: `cost-recorded:${costType}`, topic: "inventory-stock.cost-recorded", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } };
    if (await commandEvent(tx, event2)) return true;
    await tx.prisma.inventoryStock.update({
      where: { id: stock.id },
      data: costType === "reconditioning" ? { reconCostCents: { increment: amountCents }, totalCostCents: { increment: amountCents } } : { otherCostCents: { increment: amountCents }, totalCostCents: { increment: amountCents } }
    });
    await stockEvent(tx, event2, `cost:${costType}`, reason, amountCents, evidence);
    return false;
  }, { timeout: 3e4 });
  return result(context, stock.id, reused);
}
async function openInventoryReconWorkItem(_root, { data }, context) {
  requireInventory(context);
  const stock = await accessibleStock(context, String(data.stockId || ""));
  const title = text73(data.title, "Work item title", 200);
  const category = String(data.category || "");
  if (!["mechanical", "body", "detail", "tires", "inspection", "other"].includes(category)) throw new Error("Unsupported reconditioning category");
  const estimatedCostCents = data.estimatedCostCents == null ? null : nonNegativeCents(data.estimatedCostCents, "Estimated cost");
  const assignedToId = data.assignedToId ? String(data.assignedToId) : null;
  if (assignedToId) await assertUserRooftopAccess(context, assignedToId, stock.rooftop.id);
  const dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("dueAt is invalid");
  const idempotencyKey2 = commandKey2(data.idempotencyKey);
  const eventKey = `inventory-recon-create:${idempotencyKey2}`;
  const itemId = (0, import_node_crypto5.randomUUID)();
  const reason = text73(data.reason, "Audit reason");
  const evidence = { stockId: stock.id, title, category, estimatedCostCents, assignedToId, dueAt: dueAt?.toISOString() ?? null, reason };
  const resolvedId = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, metadata: true } });
    if (replay) {
      const priorItemId = String(replay.metadata?.workItemId || "");
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "recon-work-created", topic: "inventory-recon.created", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { workItemId: priorItemId }, payload: { rooftopId: stock.rooftop.id, ...evidence, workItemId: priorItemId } });
      return priorItemId;
    }
    await tx.prisma.inventoryReconWorkItem.create({ data: { id: itemId, rooftopId: stock.rooftop.id, stockId: stock.id, title, category, status: "open", estimatedCostCents, assignedToId, dueAt } });
    await tx.prisma.inventoryStock.update({ where: { id: stock.id }, data: { reconStatus: "in-progress" } });
    const event2 = { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "recon-work-created", topic: "inventory-recon.created", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { workItemId: itemId }, payload: { rooftopId: stock.rooftop.id, ...evidence, workItemId: itemId } };
    await recordDomainEventInTransaction(tx, event2);
    await stockEvent(tx, event2, "recon-work-created", reason, estimatedCostCents ?? void 0, { ...evidence, workItemId: itemId });
    return itemId;
  }, { timeout: 3e4 });
  return result(context, stock.id, resolvedId !== itemId, resolvedId);
}
async function transitionInventoryReconWorkItem(_root, { data }, context) {
  requireInventory(context);
  const item = await context.query.InventoryReconWorkItem.findOne({ where: { id: String(data.id || "") }, query: "id status updatedAt stock { id rooftop { id } }" });
  if (!item?.stock?.rooftop?.id) throw new Error("Reconditioning work item not found or not accessible");
  await assertSessionRooftopPermission(context, item.stock.rooftop.id, "canManageInventory");
  const toStatus = String(data.toStatus || "");
  const actualCostCents = data.actualCostCents == null ? null : nonNegativeCents(data.actualCostCents, "Actual cost");
  if (toStatus === "completed" && actualCostCents == null) throw new Error("Completed work requires actual cost evidence");
  const expectedUpdatedAt = new Date(String(data.expectedUpdatedAt || ""));
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error("expectedUpdatedAt is invalid");
  const reason = text73(data.reason, "Audit reason");
  const eventKey = `inventory-recon-transition:${commandKey2(data.idempotencyKey)}`;
  const evidence = { workItemId: item.id, stockId: item.stock.id, toStatus, actualCostCents, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason };
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } });
  if (!priorEvent) assertReconTransition(item.status, toStatus);
  const reused = await context.transaction(async (tx) => {
    const event2 = { eventKey, rooftopId: item.stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: item.stock.id, action: `recon-work:${toStatus}`, topic: "inventory-recon.transitioned", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: item.stock.rooftop.id, ...evidence } };
    if (await commandEvent(tx, event2)) return true;
    const changed = await tx.prisma.inventoryReconWorkItem.updateMany({ where: { id: item.id, status: item.status, updatedAt: expectedUpdatedAt }, data: { status: toStatus, actualCostCents, completedAt: toStatus === "completed" ? /* @__PURE__ */ new Date() : null } });
    if (changed.count !== 1) throw new Error("Reconditioning work changed concurrently; reload and retry");
    if (toStatus === "completed") {
      const openCount = await tx.prisma.inventoryReconWorkItem.count({ where: { stockId: item.stock.id, id: { not: item.id }, status: { in: ["open", "in-progress"] } } });
      await tx.prisma.inventoryStock.update({ where: { id: item.stock.id }, data: { reconStatus: openCount === 0 ? "completed" : "in-progress", reconCostCents: { increment: actualCostCents ?? 0 }, totalCostCents: { increment: actualCostCents ?? 0 } } });
    }
    await stockEvent(tx, event2, `recon-work:${toStatus}`, reason, actualCostCents ?? void 0, evidence);
    return false;
  }, { timeout: 3e4 });
  return result(context, item.stock.id, reused, item.id);
}

// features/keystone/mutations/inventoryPublishingCommands.ts
var import_node_crypto6 = require("node:crypto");

// features/keystone/lifecycle/commandDate.ts
function commandDate(value, label = "expectedUpdatedAt") {
  const date4 = value instanceof Date ? new Date(value.getTime()) : new Date(String(value ?? ""));
  if (Number.isNaN(date4.getTime())) throw new Error(`${label} is invalid`);
  return date4;
}

// features/keystone/mutations/inventoryPublishingCommands.ts
function required(value, label, max = 500) {
  const result2 = String(value || "").trim();
  if (!result2 || result2.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result2;
}
function key(value) {
  const result2 = String(value || "").trim();
  if (result2.length < 8 || result2.length > 180) throw new Error("A valid idempotency key is required");
  return result2;
}
function requireInventory2(context) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) throw new Error("Inventory management permission is required");
}
async function stockAccess(context, id) {
  const stock = await context.query.InventoryStock.findOne({ where: { id }, query: "id stockNumber reconStatus merchandisingStatus feedStatus frontlineAt updatedAt rooftop { id } vehicle { id vin year make model trim description priceCents status images { id imagePath isPrimary } }" });
  if (!stock?.rooftop?.id || !stock.vehicle?.id) throw new Error("Inventory stock not found or not accessible");
  await assertSessionRooftopPermission(context, stock.rooftop.id, "canManageInventory");
  return stock;
}
function nonNegativeInteger2(value, label) {
  const result2 = Number(value);
  if (!Number.isSafeInteger(result2) || result2 < 0 || result2 > 2147483647) throw new Error(`${label} must be non-negative integer cents/count`);
  return result2;
}
async function commandResult(context, stockId, id, reused) {
  const stock = await context.sudo().prisma.inventoryStock.findUnique({ where: { id: stockId }, select: { updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true } });
  if (!stock) throw new Error("Inventory stock no longer exists");
  return { id, stockId, status: stock.reconStatus, merchandisingStatus: stock.merchandisingStatus, feedStatus: stock.feedStatus, updatedAt: stock.updatedAt, reused };
}
async function updateInventoryMerchandisingDraft(_root, { data }, context) {
  requireInventory2(context);
  const stock = await stockAccess(context, String(data.stockId || ""));
  if (!["available", "service"].includes(stock.vehicle.status)) throw new Error("Only active inventory can be edited");
  const priceCents = nonNegativeInteger2(data.priceCents, "Retail price");
  const listPriceCents = data.listPriceCents == null ? priceCents : nonNegativeInteger2(data.listPriceCents, "List price");
  const mileage = data.mileage == null ? null : nonNegativeInteger2(data.mileage, "Mileage");
  if (priceCents === 0) throw new Error("Retail price must be greater than zero");
  const description = required(data.description, "Description", 4e3);
  const imagePath = required(data.imagePath, "Primary image path", 500);
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const reason = required(data.reason, "Audit reason");
  const eventKey = `inventory-merchandising-draft:${key(data.idempotencyKey)}`;
  const evidence = {
    stockId: stock.id,
    vehicleId: stock.vehicle.id,
    priceCents,
    listPriceCents,
    mileage,
    description,
    imagePath,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    reason
  };
  const reused = await context.transaction(async (tx) => {
    await lockInventoryStock(tx, stock.id);
    const event2 = { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "merchandising-draft-updated", topic: "inventory-merchandising.draft-updated", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const current = await loadInventoryPublication(tx, stock.id);
    if (!["available", "service"].includes(current.vehicle.status)) throw new Error("Only active inventory can be edited");
    const changed = await tx.prisma.inventoryStock.updateMany({
      where: { id: stock.id, rooftopId: stock.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { merchandisingStatus: "draft", approvedRevisionHash: "", feedStatus: "not-published" }
    });
    if (changed.count !== 1) throw new Error("Inventory stock changed concurrently; reload and retry");
    await tx.prisma.inventoryMerchandisingVersion.updateMany({ where: { stockId: stock.id, status: "submitted" }, data: { status: "rejected", decisionReason: "Superseded by edited draft", decidedById: context.session.itemId, decidedAt: /* @__PURE__ */ new Date() } });
    await tx.prisma.vehicle.update({
      where: { id: stock.vehicle.id },
      data: { priceCents, listPriceCents, mileage, description }
    });
    const primary = await tx.prisma.vehicleImage.findFirst({ where: { vehicleId: stock.vehicle.id, isPrimary: true }, select: { id: true } });
    if (primary) await tx.prisma.vehicleImage.update({ where: { id: primary.id }, data: { rooftopId: stock.rooftop.id, imagePath, caption: `${stock.vehicle.year} ${stock.vehicle.make} ${stock.vehicle.model}`, category: "exterior", sortOrder: 0 } });
    else await tx.prisma.vehicleImage.create({ data: { rooftopId: stock.rooftop.id, vehicleId: stock.vehicle.id, imagePath, caption: `${stock.vehicle.year} ${stock.vehicle.make} ${stock.vehicle.model}`, category: "exterior", sortOrder: 0, isPrimary: true } });
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: stock.rooftop.id, stockId: stock.id, eventKey, eventType: "merchandising-draft-updated", reason, evidence, actorId: context.session.itemId } });
    return false;
  }, { timeout: 3e4 });
  return commandResult(context, stock.id, stock.id, reused);
}
async function submitInventoryMerchandising(_root, { data }, context) {
  requireInventory2(context);
  const stock = await stockAccess(context, String(data.stockId || ""));
  const idempotencyKey2 = key(data.idempotencyKey);
  const eventKey = `inventory-merchandising-submit:${idempotencyKey2}`;
  const reason = required(data.reason, "Audit reason");
  const command = await context.transaction(async (tx) => {
    await lockInventoryStock(tx, stock.id);
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } });
    if (replay) {
      const eventEvidence3 = { snapshot: replay.afterSnapshot?.snapshot, reason };
      const versionId2 = String(replay.metadata?.versionId || "");
      const version2 = await tx.prisma.inventoryMerchandisingVersion.findUnique({ where: { id: versionId2 }, select: { version: true } });
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "merchandising-submitted", topic: "inventory-merchandising.submitted", actorId: context.session.itemId, afterSnapshot: eventEvidence3, metadata: { versionId: versionId2, version: version2?.version }, payload: { stockId: stock.id, rooftopId: stock.rooftop.id, versionId: versionId2, version: version2?.version } });
      return { id: versionId2, reused: true };
    }
    const current = await loadInventoryPublication(tx, stock.id);
    if (current.merchandisingStatus === "submitted") throw new Error("Merchandising review is already pending");
    if (commandDate(current.updatedAt).getTime() !== commandDate(data.expectedUpdatedAt ?? stock.updatedAt).getTime()) throw new Error("Inventory changed concurrently; reload before submitting");
    const snapshot2 = assertMerchandisingContent(current);
    const eventEvidence2 = { snapshot: snapshot2, reason };
    const version = (current.merchandisingVersions[0]?.version ?? 0) + 1;
    const versionId = (0, import_node_crypto6.randomUUID)();
    await tx.prisma.inventoryMerchandisingVersion.create({ data: { id: versionId, rooftopId: stock.rooftop.id, stockId: stock.id, version, versionKey: `${stock.id}:${version}`, status: "submitted", snapshot: snapshot2, submittedById: context.session.itemId, submittedAt: /* @__PURE__ */ new Date() } });
    await tx.prisma.inventoryStock.update({ where: { id: stock.id }, data: { merchandisingStatus: "submitted", approvedRevisionHash: "", feedStatus: "not-published" } });
    const event2 = { eventKey, rooftopId: stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: stock.id, action: "merchandising-submitted", topic: "inventory-merchandising.submitted", actorId: context.session.itemId, afterSnapshot: eventEvidence2, metadata: { versionId, version }, payload: { stockId: stock.id, rooftopId: stock.rooftop.id, versionId, version } };
    await recordDomainEventInTransaction(tx, event2);
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: stock.rooftop.id, stockId: stock.id, eventKey, eventType: "merchandising-submitted", reason, evidence: { versionId, version }, actorId: context.session.itemId } });
    return { id: versionId, reused: false };
  }, { timeout: 3e4 });
  return commandResult(context, stock.id, command.id, command.reused);
}
async function decideInventoryMerchandising(_root, { data }, context) {
  requireInventory2(context);
  const version = await context.query.InventoryMerchandisingVersion.findOne({ where: { id: String(data.id || "") }, query: "id version status updatedAt stock { id rooftop { id } }" });
  if (!version?.stock?.rooftop?.id) throw new Error("Merchandising version not found or not accessible");
  await assertSessionRooftopPermission(context, version.stock.rooftop.id, "canManageInventory");
  const decision = String(data.decision || "");
  const reason = required(data.reason, "Decision reason");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const eventKey = `inventory-merchandising-decision:${key(data.idempotencyKey)}`;
  const evidence = { stockId: version.stock.id, versionId: version.id, version: version.version, decision, reason, expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } });
  if (!priorEvent) assertMerchandisingTransition(version.status, decision);
  const reused = await context.transaction(async (tx) => {
    await lockInventoryStock(tx, version.stock.id);
    const event2 = { eventKey, rooftopId: version.stock.rooftop.id, aggregateType: "InventoryStock", aggregateId: version.stock.id, action: `merchandising-${decision}`, topic: "inventory-merchandising.decided", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: version.stock.rooftop.id, ...evidence } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const current = await loadInventoryPublication(tx, version.stock.id);
    const latest = current.merchandisingVersions[0];
    if (current.merchandisingStatus !== "submitted" || latest?.id !== version.id || latest.status !== "submitted") throw new Error("This merchandising review was superseded; reload the current revision");
    const snapshot2 = assertMerchandisingContent(current);
    if (latest.snapshot?.schemaVersion !== 2 || domainEventRequestHash(latest.snapshot) !== domainEventRequestHash(snapshot2)) throw new Error("Inventory changed after submission; submit the current revision again");
    const changed = await tx.prisma.inventoryMerchandisingVersion.updateMany({ where: { id: version.id, status: "submitted", updatedAt: expectedUpdatedAt }, data: { status: decision, decisionReason: reason, decidedById: context.session.itemId, decidedAt: /* @__PURE__ */ new Date() } });
    if (changed.count !== 1) throw new Error("Merchandising version changed concurrently; reload and retry");
    const changedStock = await tx.prisma.inventoryStock.updateMany({
      where: {
        id: version.stock.id,
        rooftopId: version.stock.rooftop.id,
        merchandisingStatus: "submitted",
        approvedRevisionHash: ""
      },
      data: {
        merchandisingStatus: decision,
        approvedRevisionHash: decision === "approved" ? domainEventRequestHash(merchandisingSnapshot(current)) : "",
        feedStatus: "not-published"
      }
    });
    if (changedStock.count !== 1) throw new Error("Inventory changed concurrently; reload the current revision");
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: version.stock.rooftop.id, stockId: version.stock.id, eventKey, eventType: `merchandising-${decision}`, reason, evidence, actorId: context.session.itemId } });
    return false;
  }, { timeout: 3e4 });
  return commandResult(context, version.stock.id, version.id, reused);
}
async function recordInventoryFeedRun(_root, { data }, context) {
  requireInventory2(context);
  const channel = resolveInventoryChannel(data.channelKey);
  const stockIds = [...new Set((Array.isArray(data.stockIds) ? data.stockIds : []).map((value) => String(value)))].slice(0, 500);
  if (stockIds.length === 0) throw new Error("At least one inventory stock record is required");
  const stocks = await Promise.all(stockIds.map((id) => stockAccess(context, id)));
  const rooftopId = stocks[0].rooftop.id;
  if (stocks.some((stock) => stock.rooftop.id !== rooftopId)) throw new Error("Feed run inventory must belong to one rooftop");
  const errors = (Array.isArray(data.errors) ? data.errors : []).slice(0, 500).map((error) => ({
    stockId: error.stockId ? String(error.stockId) : null,
    errorCode: required(error.errorCode, "Feed error code", 100),
    message: required(error.message, "Feed error message", 1e3),
    rowReference: String(error.rowReference || "").trim().slice(0, 200) || null
  }));
  const stockIdSet = new Set(stockIds);
  if (errors.some((error) => error.stockId && !stockIdSet.has(error.stockId))) throw new Error("Feed errors must reference inventory in the same run");
  const failedStockIds = new Set(errors.flatMap((error) => error.stockId ? [error.stockId] : []));
  if (errors.length && failedStockIds.size === 0) stockIds.forEach((id) => failedStockIds.add(id));
  const failedCount = failedStockIds.size;
  const succeededCount = Math.max(0, stockIds.length - failedCount);
  const status = failedCount === 0 ? "succeeded" : succeededCount === 0 ? "failed" : "partial";
  const eventKey = `inventory-feed-run:${key(data.idempotencyKey)}`;
  const priorRun = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } });
  const startedAt = commandDate(data.startedAt ?? priorRun?.afterSnapshot?.startedAt ?? /* @__PURE__ */ new Date(), "startedAt");
  const completedAt = commandDate(data.completedAt ?? priorRun?.afterSnapshot?.completedAt ?? /* @__PURE__ */ new Date(), "completedAt");
  if ([startedAt, completedAt].some((date4) => Number.isNaN(date4.getTime())) || completedAt < startedAt) throw new Error("Feed run timestamps are invalid");
  const evidence = {
    channelKey: channel.key,
    stockIds,
    status,
    attemptedCount: stockIds.length,
    succeededCount,
    failedCount,
    externalRequestSent: channel.externalRequestSent,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    errors: errors.map((error) => ({ stockId: error.stockId, errorCode: error.errorCode, rowReference: error.rowReference, messageHash: domainEventRequestHash(error.message) }))
  };
  const command = await context.transaction(async (tx) => {
    for (const stockId of [...stockIds].sort()) await lockInventoryStock(tx, stockId);
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } });
    if (replay) {
      const runId2 = String(replay.metadata?.runId || "");
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "InventoryFeedRun", aggregateId: runId2, action: "recorded", topic: "inventory-feed.recorded", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { runId: runId2 }, payload: { rooftopId, runId: runId2, ...evidence } });
      return { id: runId2, reused: true };
    }
    const revisions = [];
    for (const stockId of stockIds) {
      const current = await loadInventoryPublication(tx, stockId);
      if (current.rooftopId !== rooftopId) throw new Error("Inventory rooftop changed");
      if (channel.key === "public-inventory-feed") revisions.push({ stockId, ...assertPublishableInventory(current) });
    }
    const runId = (0, import_node_crypto6.randomUUID)();
    await tx.prisma.inventoryFeedRun.create({ data: { id: runId, rooftopId, runKey: eventKey, channelKey: channel.key, status, attemptedCount: stockIds.length, succeededCount, failedCount, requestSnapshot: { stockIds, revisions }, responseSummary: { mode: channel.mode, externalRequestSent: channel.externalRequestSent }, startedAt, completedAt, recordedById: context.session.itemId } });
    if (errors.length) await tx.prisma.inventoryFeedError.createMany({ data: errors.map((error) => ({ rooftopId, runId, stockId: error.stockId, errorCode: error.errorCode, message: error.message, rowReference: error.rowReference, evidence: { source: "operator-recorded" } })) });
    const failedIds = [...failedStockIds];
    const succeededIds = stockIds.filter((id) => !failedStockIds.has(id));
    if (failedIds.length) await tx.prisma.inventoryStock.updateMany({ where: { id: { in: failedIds }, rooftopId }, data: { feedStatus: "failed" } });
    if (succeededIds.length) await tx.prisma.inventoryStock.updateMany({ where: { id: { in: succeededIds }, rooftopId }, data: { feedStatus: "succeeded" } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "InventoryFeedRun", aggregateId: runId, action: "recorded", topic: "inventory-feed.recorded", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { runId }, payload: { rooftopId, runId, ...evidence } });
    return { id: runId, reused: false };
  }, { timeout: 3e4 });
  return { id: command.id, rooftopId, channelKey: channel.key, status, attemptedCount: stockIds.length, succeededCount, failedCount, errorCount: errors.length, completedAt, reused: command.reused };
}

// features/keystone/mutations/operatorProjections.ts
function date2(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}
function operatorDateFields(value, fields) {
  const result2 = { ...value };
  for (const field of fields) result2[field] = date2(value[field]);
  return result2;
}
function person(value) {
  return value ? { id: value.id, name: value.name ?? (`${value.firstName ?? ""} ${value.lastName ?? ""}`.trim() || null) } : null;
}
function crmLeadResult(value) {
  return {
    id: value.id,
    firstName: value.firstName ?? "",
    lastName: value.lastName ?? "",
    email: value.email ?? null,
    phone: value.phone ?? null,
    source: value.source ?? null,
    status: value.status ?? null,
    temperature: value.timeframe ?? null,
    interestedVehicle: value.interestedVehicle ? { id: value.interestedVehicle.id, year: value.interestedVehicle.year, make: value.interestedVehicle.make, model: value.interestedVehicle.model } : null,
    customerId: value.customer?.id ?? null,
    assignedSalesperson: person(value.assignedSalesperson),
    assignedAt: date2(value.assignedAt),
    firstResponseDueAt: date2(value.firstResponseDueAt),
    firstResponseAt: date2(value.firstResponseAt),
    lastContact: date2(value.lastContact),
    createdAt: date2(value.createdAt),
    updatedAt: date2(value.updatedAt)
  };
}
function deliveryDealResult(value) {
  return {
    id: value.id,
    status: value.status ?? null,
    saleDate: date2(value.saleDate),
    lockedAt: date2(value.lockedAt),
    updatedAt: date2(value.updatedAt),
    vehicle: value.vehicle ? {
      id: value.vehicle.id,
      vin: value.vehicle.vin ?? null,
      stockNumber: value.vehicle.stockNumber ?? null,
      year: value.vehicle.year ?? null,
      make: value.vehicle.make ?? null,
      model: value.vehicle.model ?? null,
      status: value.vehicle.status ?? null
    } : null,
    lead: value.lead ? { id: value.lead.id, firstName: value.lead.firstName ?? "", lastName: value.lead.lastName ?? "" } : null,
    salesperson: person(value.salesperson)
  };
}
function serviceOrderResult(value) {
  return {
    id: value.id,
    rooftop: value.rooftop ? { id: value.rooftop.id, name: value.rooftop.name } : null,
    status: value.status ?? null,
    concern: value.concern ?? "",
    cause: value.cause ?? "",
    correction: value.correction ?? "",
    payType: value.payType ?? "customer",
    authorizationStatus: value.authorizationStatus ?? "pending",
    authorizationEvidence: value.authorizationEvidence ?? {},
    inspectionEvidence: value.inspectionEvidence ?? [],
    declinedWork: value.declinedWork ?? [],
    invoiceNumber: value.invoiceNumber ?? null,
    diagnosis: value.diagnosis ?? "",
    workPerformed: value.workPerformed ?? "",
    recommendations: value.recommendations ?? "",
    laborTotalCents: value.laborTotalCents ?? 0,
    partsTotalCents: value.partsTotalCents ?? 0,
    taxCents: value.taxCents ?? 0,
    grandTotalCents: value.grandTotalCents ?? 0,
    completedAt: date2(value.completedAt),
    settledAt: date2(value.settledAt),
    updatedAt: date2(value.updatedAt),
    appointment: value.appointment ? {
      id: value.appointment.id,
      appointmentDate: date2(value.appointment.appointmentDate),
      serviceType: value.appointment.serviceType ?? null,
      assignedTech: person(value.appointment.assignedTech),
      vehicleVin: value.appointment.vehicleVin ?? null,
      transportationNeed: value.appointment.transportationNeed ?? "none",
      capacitySlot: value.appointment.capacitySlot ?? null,
      customerVehicleDescription: value.appointment.customerVehicleDescription ?? "",
      lead: value.appointment.lead ? { id: value.appointment.lead.id, firstName: value.appointment.lead.firstName ?? "", lastName: value.appointment.lead.lastName ?? "" } : null
    } : null,
    laborOperations: (value.laborOperations ?? []).map((operation) => operatorDateFields(operation, ["startedAt", "completedAt"])),
    lineItems: (value.lineItems ?? []).map((line) => ({ id: line.id, itemType: line.itemType, description: line.description, partNumber: line.partNumber, quantity: line.quantity, unitPriceCents: line.unitPriceCents, priceCents: line.priceCents }))
  };
}
function financeApplicationResult(value) {
  return {
    id: value.id,
    reference: value.reference ?? null,
    status: value.status ?? null,
    applicantName: value.applicantName ?? null,
    applicantEmail: value.applicantEmail ?? null,
    applicantPhone: value.applicantPhone ?? null,
    employmentStatus: value.employmentStatus ?? null,
    annualIncomeCents: value.annualIncomeCents ?? null,
    selfReportedCreditTier: value.selfReportedCreditTier ?? null,
    requestedAmountCents: value.requestedAmountCents ?? null,
    plannedMonthlyPaymentCents: value.plannedMonthlyPaymentCents ?? null,
    plannedDownPaymentCents: value.plannedDownPaymentCents ?? null,
    tradeInValueCents: value.tradeInValueCents ?? null,
    aprBasisPoints: value.aprBasisPoints ?? null,
    loanTermMonths: value.loanTermMonths ?? null,
    consentAt: date2(value.consentAt),
    submittedAt: date2(value.submittedAt),
    updatedAt: date2(value.updatedAt),
    vehicle: value.vehicle ? { id: value.vehicle.id, vin: value.vehicle.vin, stockNumber: value.vehicle.stockNumber, year: value.vehicle.year, make: value.vehicle.make, model: value.vehicle.model, priceCents: value.vehicle.priceCents ?? null } : null,
    lead: value.lead ? {
      id: value.lead.id,
      rooftop: value.rooftop ? { id: value.rooftop.id } : null,
      firstName: value.lead.firstName,
      lastName: value.lead.lastName,
      email: value.lead.email,
      phone: value.lead.phone,
      status: value.lead.status,
      createdAt: date2(value.lead.createdAt),
      interestedVehicle: value.lead.interestedVehicle ? { id: value.lead.interestedVehicle.id, year: value.lead.interestedVehicle.year, make: value.lead.interestedVehicle.make, model: value.lead.interestedVehicle.model, stockNumber: value.lead.interestedVehicle.stockNumber, priceCents: value.lead.interestedVehicle.priceCents } : null,
      tasks: (value.lead.tasks ?? []).map((task) => ({ id: task.id, title: task.title, dueDate: date2(task.dueDate), completed: task.completed, priority: task.priority }))
    } : null,
    submissions: (value.submissions ?? []).map((submission) => ({
      id: submission.id,
      providerKey: submission.providerKey,
      providerMode: submission.responseSummary?.mode ?? "operator-recorded",
      externalRequestSent: submission.responseSummary?.externalRequestSent === true,
      status: submission.status,
      externalReference: submission.externalReference ?? null,
      queuedAt: date2(submission.queuedAt),
      submittedAt: date2(submission.submittedAt)
    })),
    decisions: (value.decisions ?? []).map((decision) => ({ id: decision.id, providerKey: decision.providerKey, decision: decision.decision, approvedAmountCents: decision.approvedAmountCents ?? null, aprBasisPoints: decision.aprBasisPoints ?? null, termMonths: decision.termMonths ?? null, monthlyPaymentCents: decision.monthlyPaymentCents ?? null, reasonCodes: decision.reasonCodes ?? [], decidedAt: date2(decision.decidedAt) }))
  };
}

// features/keystone/mutations/operatorWorkspaces.ts
async function financeEvidenceForVisibleDeal(context, id) {
  if (!permissions.canManageFinancing({ session: context.session })) return null;
  return context.transaction(async (tx) => {
    await lockDeal(tx, id);
    const authority = await currentDealAuthority(tx, context.session, id, ["canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id } });
    if (!deal || deal.rooftopId !== authority.rooftopId) return null;
    return financeEvidenceReadiness(tx, deal);
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
function asDate(value) {
  return value ? value instanceof Date ? value : new Date(value) : null;
}
function dealTotalPriceCents(deal) {
  return calculateDealPrice(deal).totalPriceCents;
}
function page(limitValue, offsetValue, max = 100) {
  return { limit: Math.max(1, Math.min(max, Number(limitValue) || 50)), offset: Math.max(0, Math.min(1e4, Number(offsetValue) || 0)) };
}
async function crmWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canAccessLeads({ session: context.session })) throw new Error("CRM access is required");
  const { limit, offset } = page(args.limit, args.offset);
  const filters = [];
  const status = String(args.status || "").trim();
  const search = String(args.search || "").trim().slice(0, 100);
  if (status && status !== "all") filters.push({ status: { equals: status } });
  if (search) filters.push({ OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] });
  const rows = await context.query.Lead.findMany({
    where: filters.length ? { AND: filters } : {},
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    skip: offset,
    query: "id firstName lastName email phone source status timeframe assignedAt firstResponseDueAt firstResponseAt lastContact createdAt updatedAt customer { id } assignedSalesperson { id name } interestedVehicle { id year make model }"
  });
  const hasMore = rows.length > limit;
  const leads = rows.slice(0, limit).map(crmLeadResult);
  return { leads, summary: { visibleCount: leads.length, newCount: leads.filter((lead) => lead.status === "new").length, overdueCount: leads.filter((lead) => lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now()).length }, pageInfo: { limit, offset, hasMore } };
}
async function dealDeskWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error("Deal access is required");
  const { limit, offset } = page(args.limit, args.offset, 100);
  const status = String(args.status || "").trim();
  const rows = await context.query.Deal.findMany({ where: status && status !== "all" ? { status: { equals: status } } : {}, orderBy: { createdAt: "desc" }, take: limit + 1, skip: offset, query: "id status vehiclePriceCents tradeInValueCents taxAmountCents fees products rebates taxLines saleDate createdAt updatedAt salesperson { id name } lead { id firstName lastName status } vehicle { id vin stockNumber year make model trim status priceCents }" });
  const hasMore = rows.length > limit;
  const deals = rows.slice(0, limit).map((deal) => ({ ...deal, createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), saleDate: asDate(deal.saleDate), totalPriceCents: dealTotalPriceCents(deal) }));
  return { deals, summary: { visibleCount: deals.length, pendingCount: deals.filter((deal) => ["pencil", "submitted"].includes(deal.status)).length, deliveredCount: deals.filter((deal) => deal.status === "delivered").length, totalRevenueCents: deals.filter((deal) => deal.status === "delivered" && deal.saleDate).reduce((total, deal) => total + (deal.vehiclePriceCents ?? 0), 0) }, pageInfo: { limit, offset, hasMore } };
}
async function dealWorkspace(_root, { id }, context) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error("Deal access is required");
  const deal = await context.query.Deal.findOne({ where: { id }, query: `id status vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents loanTerm apr fees rebates products taxLines structureType residualValueCents moneyFactorBasisPoints worksheetVersion grossCents presentedSnapshot presentedAt acceptedSnapshot acceptedAt evidenceSnapshot lockedAt saleDate createdAt updatedAt rooftop { id name } vehicle { id vin stockNumber year make model trim status priceCents } lead { id firstName lastName status } salesperson { id name } tradeInVehicle { id year make model offerAmountCents } approvals(orderBy: { approvalDate: desc }) { id decision notes approvalDate approver { id name } }` });
  if (!deal) throw new Error("Deal not found");
  const worksheetEvents = await context.sudo().prisma.domainAuditEvent.findMany({
    where: { rooftopId: deal.rooftop.id, aggregateType: "Deal", aggregateId: id, action: "worksheet-saved" },
    orderBy: { occurredAt: "desc" },
    take: 20,
    select: { id: true, afterSnapshot: true, occurredAt: true, actor: { select: { id: true, name: true } } }
  });
  return {
    deal: { ...deal, financeEvidence: await financeEvidenceForVisibleDeal(context, id), totalPriceCents: dealTotalPriceCents(deal), presentedAt: asDate(deal.presentedAt), acceptedAt: asDate(deal.acceptedAt), lockedAt: asDate(deal.lockedAt), saleDate: asDate(deal.saleDate), createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), approvals: deal.approvals.map((approval) => ({ ...approval, approvalDate: asDate(approval.approvalDate) })) },
    worksheetVersions: worksheetEvents.map((event2) => ({ id: event2.id, snapshot: event2.afterSnapshot, occurredAt: asDate(event2.occurredAt), actor: event2.actor }))
  };
}
async function financeWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error("Financing management permission is required");
  const { limit, offset } = page(args.limit, args.offset, 50);
  const status = String(args.status || "").trim();
  const rows = await context.query.FinancingApplication.findMany({
    where: status && status !== "all" ? { status: { equals: status } } : {},
    orderBy: { submittedAt: "desc" },
    take: limit + 1,
    skip: offset,
    query: `id reference status applicantName applicantEmail applicantPhone employmentStatus annualIncomeCents selfReportedCreditTier requestedAmountCents plannedMonthlyPaymentCents plannedDownPaymentCents tradeInValueCents aprBasisPoints loanTermMonths consentAt submittedAt updatedAt rooftop { id } vehicle { id vin stockNumber year make model priceCents } lead { id firstName lastName email phone status createdAt interestedVehicle { id year make model stockNumber priceCents } tasks(orderBy: { dueDate: asc }) { id title dueDate completed priority } } submissions(orderBy: { queuedAt: desc }) { id providerKey status externalReference responseSummary queuedAt submittedAt } decisions(orderBy: { decidedAt: desc }) { id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt }`
  });
  const hasMore = rows.length > limit;
  const applications = rows.slice(0, limit).map(financeApplicationResult);
  const dealRows = await context.query.Deal.findMany({ orderBy: { createdAt: "desc" }, take: 100, query: `id worksheetVersion rooftop { id name } vehiclePrice tradeInValue downPayment financingAmount monthlyPayment loanTerm apr taxAmount status totalPrice profit createdAt updatedAt salesperson { id name } lead { id firstName lastName } vehicle { id year make model stockNumber vin purchasePrice } approvals(orderBy: { approvalDate: desc }) { id decision approvalDate notes approver { id name } }` });
  const deals = await Promise.all(dealRows.map(async (deal) => ({ ...deal, financeEvidence: await financeEvidenceForVisibleDeal(context, deal.id), createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), approvals: deal.approvals.map((approval) => ({ ...approval, approvalDate: asDate(approval.approvalDate) })) })));
  const [products, productQuotes, productCancellations, menus, complianceChecks, contractPackages, fundingCases] = await Promise.all([
    context.query.FinanceProduct.findMany({ where: { active: { equals: true } }, orderBy: { code: "asc" }, take: 100, query: "id rooftop { id } code name category providerKey active retailPriceCents costCents updatedAt" }),
    context.query.FinanceProductQuote.findMany({ orderBy: { requestedAt: "desc" }, take: 100, query: "id deal { id } product { id code name } providerKey status retailPriceCents evidenceReference requestedAt completedAt" }),
    context.query.FinanceProductCancellation.findMany({ orderBy: { requestedAt: "desc" }, take: 100, query: "id deal { id } menu { id } productCode status reason refundCents requestedAt completedAt" }),
    context.query.FinanceMenuVersion.findMany({ orderBy: { presentedAt: "desc" }, take: 100, query: "id deal { id } version status optionsSnapshot selectedProductCodes declinedProductCodes disclosureAcknowledgment presentedAt decidedAt" }),
    context.query.FinanceComplianceCheck.findMany({ orderBy: { requestedAt: "desc" }, take: 100, query: "id deal { id } checkType providerKey status resultCode requestedAt completedAt" }),
    context.query.FinanceContractPackage.findMany({ orderBy: { updatedAt: "desc" }, take: 100, query: "id deal { id } status providerKey envelopeReference requiredDocuments documentChecklist sentAt signedAt lastWebhookAt updatedAt" }),
    context.query.FinanceFundingCase.findMany({ orderBy: { updatedAt: "desc" }, take: 100, query: "id deal { id } status checklist exceptions fundingReference fundedAt immutableEvidence updatedAt" })
  ]);
  return {
    applications,
    deals,
    products: products.map((row) => operatorDateFields(row, ["updatedAt"])),
    productQuotes: productQuotes.map((row) => operatorDateFields(row, ["requestedAt", "completedAt"])),
    productCancellations: productCancellations.map((row) => operatorDateFields(row, ["requestedAt", "completedAt"])),
    menus: menus.map((row) => operatorDateFields(row, ["presentedAt", "decidedAt"])),
    complianceChecks: complianceChecks.map((row) => operatorDateFields(row, ["requestedAt", "completedAt"])),
    contractPackages: contractPackages.map((row) => operatorDateFields(row, ["sentAt", "signedAt", "lastWebhookAt", "updatedAt"])),
    fundingCases: fundingCases.map((row) => operatorDateFields(row, ["fundedAt", "updatedAt"])),
    summary: { visibleCount: applications.length, submittedCount: applications.filter((item) => item.status === "submitted").length, reviewCount: applications.filter((item) => item.status === "under-review").length, approvedCount: applications.filter((item) => item.status === "approved").length },
    pageInfo: { limit, offset, hasMore }
  };
}
async function deliveryWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error("Deal access is required");
  const { limit, offset } = page(args.limit, args.offset, 100);
  const rows = await context.query.Deal.findMany({ where: { status: { in: ["financed", "delivered"] } }, orderBy: { updatedAt: "asc" }, take: limit + 1, skip: offset, query: "id status saleDate lockedAt updatedAt vehicle { id vin stockNumber year make model status } lead { id firstName lastName } salesperson { id name }" });
  const hasMore = rows.length > limit;
  const deliveries = await Promise.all(rows.slice(0, limit).map(async (row) => ({ ...deliveryDealResult(row), financeEvidence: await financeEvidenceForVisibleDeal(context, row.id) })));
  const cases = await context.query.DeliveryCase.findMany({ orderBy: { appointmentAt: "asc" }, take: 100, query: "id deal { id } status appointmentAt arrivedAt checklist customerAcknowledgment acknowledgedAt deliverySnapshot updatedAt weOweItems(orderBy: { promisedAt: asc }) { id description status promisedAt owner { id name } estimatedCostCents fulfillmentEvidence customerAcknowledgment fulfilledAt updatedAt }" });
  return { deliveries, cases: cases.map((row) => ({
    ...operatorDateFields(row, ["appointmentAt", "arrivedAt", "acknowledgedAt", "updatedAt"]),
    weOweItems: row.weOweItems.map((item) => operatorDateFields(item, ["promisedAt", "fulfilledAt", "updatedAt"]))
  })), summary: { readyCount: deliveries.filter((deal) => deal.status === "financed").length, deliveredCount: deliveries.filter((deal) => deal.status === "delivered").length }, pageInfo: { limit, offset, hasMore } };
}
async function fixedOpsWorkspace(_root, args, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service management permission is required");
  const { limit, offset } = page(args.limit, args.offset, 100);
  const orders = await context.query.ServiceOrder.findMany({ orderBy: { updatedAt: "desc" }, take: limit + 1, skip: offset, query: `id rooftop { id name } status concern cause correction payType authorizationStatus authorizationEvidence inspectionEvidence declinedWork invoiceNumber diagnosis workPerformed recommendations laborTotalCents partsTotalCents taxCents grandTotalCents completedAt settledAt updatedAt appointment { id appointmentDate serviceType customerVehicleDescription assignedTech { id name } lead { id firstName lastName } } laborOperations { id operationCode description status technician { id name } soldHours actualMinutes timePunches startedAt completedAt } lineItems { id itemType description partNumber quantity unitPriceCents priceCents }` });
  const appointments = await context.query.ServiceAppointment.findMany({ orderBy: { appointmentDate: "asc" }, take: 100, query: "id appointmentDate serviceType status vehicleVin transportationNeed capacitySlot customerVehicleDescription description estimatedDuration mileageIn advisorNotes rooftop { id } lead { id firstName lastName email phone } assignedTech { id name } serviceOrder { id status grandTotalCents }" });
  const serviceScope = rooftopPermissionAccessFilter(context.session, "canManageService");
  const serviceRooftops = serviceScope === false ? [] : await context.query.Rooftop.findMany({
    where: { AND: [{ status: { equals: "active" } }, serviceScope] },
    orderBy: { name: "asc" },
    take: 100,
    query: "id name"
  });
  const parts = await context.query.PartsInventory.findMany({ orderBy: { quantity: "asc" }, take: 50, query: "id partNumber description binLocation quantity committedQuantity onOrderQuantity minimumQuantity priceCents supplier" });
  const [partsMovements, purchaseOrders] = await Promise.all([
    context.query.PartsMovement.findMany({ orderBy: { occurredAt: "desc" }, take: 100, query: "id part { id partNumber } serviceOrder { id } movementType quantityDelta onHandAfter committedAfter onOrderAfter reference reason occurredAt" }),
    context.query.PartsPurchaseOrder.findMany({ orderBy: { updatedAt: "desc" }, take: 100, query: "id reference supplier status lines orderedAt receivedAt updatedAt" })
  ]);
  const hasMore = orders.length > limit;
  const projected = orders.slice(0, limit).map(serviceOrderResult);
  const appointmentResults = appointments.map((appointment) => ({ ...appointment, appointmentDate: asDate(appointment.appointmentDate) }));
  return {
    orders: projected,
    appointments: appointmentResults,
    parts,
    serviceRooftops,
    partsMovements: partsMovements.map((row) => operatorDateFields(row, ["occurredAt"])),
    purchaseOrders: purchaseOrders.map((row) => operatorDateFields(row, ["orderedAt", "receivedAt", "updatedAt"])),
    summary: { openOrderCount: projected.filter((order2) => !["paid"].includes(order2.status)).length, awaitingOrderCount: appointmentResults.filter((appointment) => !appointment.serviceOrder).length },
    pageInfo: { limit, offset, hasMore }
  };
}

// features/keystone/mutations/operatorCommands.ts
var import_node_crypto7 = require("node:crypto");
function idempotencyKey(value) {
  const key5 = String(value || "").trim();
  if (key5.length < 8 || key5.length > 180) throw new Error("A valid idempotency key is required");
  return key5;
}
function required2(value, label, max = 500) {
  const result2 = String(value || "").trim();
  if (!result2 || result2.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result2;
}
var cents3 = checkedCents;
async function transferLeadOwnership(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const lead = await context.query.Lead.findOne({ where: { id: String(data.leadId || "") }, query: "id status updatedAt rooftop { id } assignedSalesperson { id }" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageLeads");
  const assignedToId = String(data.assignedToId || "");
  await assertUserRooftopAccess(context, assignedToId, lead.rooftop.id);
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const reason = required2(data.reason, "Transfer reason");
  const eventKey = `lead-owner-transfer:${idempotencyKey(data.idempotencyKey)}`;
  const assignedAt = /* @__PURE__ */ new Date();
  const firstResponseDueAt = new Date(assignedAt.getTime() + 30 * 6e4);
  const evidence = { leadId: lead.id, assignedToId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, assignedAt, firstResponseDueAt };
  const reused = await context.transaction(async (tx) => {
    const event2 = { eventKey, rooftopId: lead.rooftop.id, aggregateType: "Lead", aggregateId: lead.id, action: "ownership-transferred", topic: "lead.ownership-transferred", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, assignedToId } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const changed = await tx.prisma.lead.updateMany({ where: { id: lead.id, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt }, data: { assignedSalespersonId: assignedToId, assignedAt, firstResponseDueAt } });
    if (changed.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    await tx.prisma.leadAssignmentEvent.create({
      data: {
        rooftopId: lead.rooftop.id,
        leadId: lead.id,
        fromUserId: lead.assignedSalesperson?.id || null,
        toUserId: assignedToId,
        actorId: context.session.itemId,
        reason,
        routeKey: "manual-transfer",
        assignedAt,
        firstResponseDueAt
      }
    });
    return false;
  }, { timeout: 3e4 });
  const current = await context.query.Lead.findOne({ where: { id: lead.id }, query: "id status updatedAt assignedSalesperson { id name }" });
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused };
}
async function saveDealWorksheet(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error("Deal management permission is required");
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id status updatedAt worksheetVersion structureType tradeInValueCents downPaymentCents taxAmountCents fees rebates products taxLines rooftop { id } vehicle { id vin stockNumber year make model trim purchasePriceCents } lead { id customer { id firstName lastName } } tradeInVehicle { id vin year make model mileage }" });
  if (!deal?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageDeals");
  const expectedUpdatedAt = data.expectedUpdatedAt instanceof Date ? new Date(data.expectedUpdatedAt.getTime()) : new Date(String(data.expectedUpdatedAt || ""));
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error("expectedUpdatedAt is invalid");
  const reason = required2(data.reason, "Worksheet reason");
  const structureType = String(data.structureType || deal.structureType || "cash");
  if (!["cash", "finance", "lease"].includes(structureType)) throw new Error("Deal structure must be cash, finance, or lease");
  const fees = normalizeMoneyLines(data.fees === void 0 ? deal.fees ?? [] : data.fees, "Fee");
  const rebates = normalizeMoneyLines(data.rebates === void 0 ? deal.rebates ?? [] : data.rebates, "Rebate");
  const products = normalizeMoneyLines(data.products === void 0 ? deal.products ?? [] : data.products, "Product");
  const retainedTax = deal.taxLines?.length ? deal.taxLines : Number(deal.taxAmountCents || 0) > 0 ? [{ code: "legacy-tax", name: "Retained operator-recorded tax", amountCents: deal.taxAmountCents, source: "operator-recorded" }] : [];
  const taxLines = normalizeMoneyLines(data.taxLines === void 0 ? retainedTax : data.taxLines, "Tax");
  const vehiclePriceCents = cents3(data.vehiclePriceCents, "Vehicle price");
  const tradeInValueCents = cents3(data.tradeInValueCents === void 0 ? deal.tradeInValueCents : data.tradeInValueCents, "Trade-in value");
  const downPaymentCents = cents3(data.downPaymentCents === void 0 ? deal.downPaymentCents : data.downPaymentCents, "Down payment");
  const taxAmountCents = sumMoneyLines(taxLines);
  const pricing = calculateDealPrice({ vehiclePriceCents, tradeInValueCents, downPaymentCents, fees, rebates, products, taxLines, taxAmountCents });
  assertValidDealPrice(pricing);
  const { balanceCents } = pricing;
  const loanTerm = data.loanTerm == null ? null : Number(data.loanTerm);
  const apr = data.apr == null ? null : Number(data.apr);
  const residualValueCents = data.residualValueCents == null ? null : cents3(data.residualValueCents, "Residual value");
  const moneyFactorBasisPoints = data.moneyFactorBasisPoints == null ? null : cents3(data.moneyFactorBasisPoints, "Money factor");
  if (structureType === "cash" && (loanTerm || apr || residualValueCents || moneyFactorBasisPoints)) throw new Error("Cash structures cannot contain finance or lease terms");
  if (structureType === "finance" && (!loanTerm || apr == null)) throw new Error("Finance structures require term and APR");
  if (structureType === "lease" && (!loanTerm || residualValueCents == null || moneyFactorBasisPoints == null)) throw new Error("Lease structures require term, residual, and money factor");
  if (loanTerm != null && (!Number.isInteger(loanTerm) || loanTerm < 1 || loanTerm > 120)) throw new Error("Loan term is invalid");
  if (apr != null && (!Number.isFinite(apr) || apr < 0 || apr > 100)) throw new Error("APR is invalid");
  const monthlyPaymentCents = structureType === "cash" ? 0 : structureType === "finance" ? amortizedPaymentCents(balanceCents, apr, loanTerm) : cents3(data.monthlyPaymentCents, "Monthly payment");
  const terms = {
    structureType,
    vehiclePriceCents,
    tradeInValueCents,
    downPaymentCents,
    financingAmountCents: structureType === "cash" ? 0 : balanceCents,
    monthlyPaymentCents,
    taxAmountCents,
    loanTerm,
    apr,
    residualValueCents,
    moneyFactorBasisPoints,
    fees,
    rebates,
    products,
    taxLines,
    worksheetVersion: Number(deal.worksheetVersion || 0) + 1,
    // Product margin/fees/recon are not inferred from retail product prices.
    grossCents: deal.vehicle?.purchasePriceCents == null ? null : checkedCents(vehiclePriceCents - pricing.rebatesCents - deal.vehicle.purchasePriceCents, "Front gross estimate", true)
  };
  const eventKey = `deal-worksheet:${idempotencyKey(data.idempotencyKey)}`;
  const evidence = { dealId: deal.id, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, terms, pricing: calculateDealPrice(terms), vehicle: deal.vehicle, customer: deal.lead?.customer || null, tradeIn: deal.tradeInVehicle || null };
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } });
  if (priorEvent) {
    const priorTerms = priorEvent.afterSnapshot?.terms;
    const comparable = { ...terms, worksheetVersion: priorTerms?.worksheetVersion };
    if (stableJson(priorTerms) !== stableJson(comparable)) throw new Error("Deal worksheet idempotency key was reused with different evidence");
    terms.worksheetVersion = priorTerms.worksheetVersion;
  }
  if (!priorEvent && deal.status !== "pencil") throw new Error("Only pencil deals can be reworked");
  const reused = await context.transaction(async (tx) => {
    await lockDeal(tx, deal.id);
    await currentDealAuthority(tx, context.session, deal.id, ["canManageDeals"]);
    const event2 = { eventKey, rooftopId: deal.rooftop.id, aggregateType: "Deal", aggregateId: deal.id, action: "worksheet-saved", topic: "deal.worksheet-saved", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, terms } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const changed = await tx.prisma.deal.updateMany({
      where: { id: deal.id, rooftopId: deal.rooftop.id, status: "pencil", updatedAt: expectedUpdatedAt },
      data: { ...terms, selectedLenderDecisionId: null, presentedAt: null, presentedSnapshot: {}, acceptedAt: null, acceptedSnapshot: {} }
    });
    if (changed.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    return false;
  }, { timeout: 3e4 });
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused };
}
async function presentDealWorksheet(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error("Deal management permission is required");
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id status updatedAt worksheetVersion structureType vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents loanTerm apr residualValueCents moneyFactorBasisPoints fees rebates products taxLines grossCents rooftop { id } vehicle { id vin stockNumber } lead { id customer { id } } tradeInVehicle { id }" });
  if (!deal?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageDeals");
  if (deal.status !== "pencil" || Number(deal.worksheetVersion || 0) < 1) throw new Error("A saved pencil worksheet is required before presentation");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const eventKey = `deal-present:${idempotencyKey(data.idempotencyKey)}`;
  const snapshot2 = { pricing: calculateDealPrice(deal), dealId: deal.id, worksheetVersion: deal.worksheetVersion, structureType: deal.structureType, vehicleId: deal.vehicle?.id, leadId: deal.lead?.id, customerId: deal.lead?.customer?.id, tradeInId: deal.tradeInVehicle?.id, terms: { vehiclePriceCents: deal.vehiclePriceCents, tradeInValueCents: deal.tradeInValueCents, downPaymentCents: deal.downPaymentCents, financingAmountCents: deal.financingAmountCents, monthlyPaymentCents: deal.monthlyPaymentCents, taxAmountCents: deal.taxAmountCents, loanTerm: deal.loanTerm, apr: deal.apr, residualValueCents: deal.residualValueCents, moneyFactorBasisPoints: deal.moneyFactorBasisPoints, fees: deal.fees, rebates: deal.rebates, products: deal.products, taxLines: deal.taxLines, grossCents: deal.grossCents }, expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  const reused = await context.transaction(async (tx) => {
    await lockDeal(tx, deal.id);
    await currentDealAuthority(tx, context.session, deal.id, ["canManageDeals"]);
    const event2 = { eventKey, rooftopId: deal.rooftop.id, aggregateType: "Deal", aggregateId: deal.id, action: "worksheet-presented", topic: "deal.worksheet-presented", actorId: context.session.itemId, afterSnapshot: snapshot2, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, worksheetVersion: deal.worksheetVersion } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: "pencil", updatedAt: expectedUpdatedAt }, data: { presentedSnapshot: snapshot2, presentedAt: /* @__PURE__ */ new Date() } });
    if (changed.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    return false;
  }, { timeout: 3e4 });
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
  return { id: current.id, status: "presented", updatedAt: current.updatedAt, reused };
}
async function acceptDealWorksheet(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error("Deal management permission is required");
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id status updatedAt worksheetVersion presentedAt presentedSnapshot rooftop { id }" });
  if (!deal?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageDeals");
  if (deal.status !== "pencil" || !deal.presentedAt || !deal.presentedSnapshot || Object.keys(deal.presentedSnapshot).length === 0) throw new Error("Presented worksheet evidence is required before acceptance");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const acknowledgment = required2(data.acknowledgment, "Acceptance acknowledgment", 1e3);
  const eventKey = `deal-accept:${idempotencyKey(data.idempotencyKey)}`;
  const snapshot2 = { dealId: deal.id, worksheetVersion: deal.worksheetVersion, presentedSnapshot: deal.presentedSnapshot, acknowledgment, expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  const reused = await context.transaction(async (tx) => {
    await lockDeal(tx, deal.id);
    await currentDealAuthority(tx, context.session, deal.id, ["canManageDeals"]);
    const event2 = { eventKey, rooftopId: deal.rooftop.id, aggregateType: "Deal", aggregateId: deal.id, action: "worksheet-accepted", topic: "deal.worksheet-accepted", actorId: context.session.itemId, afterSnapshot: snapshot2, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, worksheetVersion: deal.worksheetVersion } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: "pencil", updatedAt: expectedUpdatedAt }, data: { acceptedSnapshot: snapshot2, acceptedAt: /* @__PURE__ */ new Date() } });
    if (changed.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    return false;
  }, { timeout: 3e4 });
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
  return { id: current.id, status: "accepted", updatedAt: current.updatedAt, reused };
}
async function selectDealLenderOffer(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session }) || !permissions.canManageDeals({ session: context.session })) throw new Error("Deal and financing permissions are required");
  const visible = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id rooftop { id }" });
  if (!visible?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageDeals");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageFinancing");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const eventKey = `deal-lender-select:${idempotencyKey(data.idempotencyKey)}`;
  const request = { dealId: visible.id, lenderDecisionId: required2(data.lenderDecisionId, "Lender decision ID", 100), expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  return context.transaction(async (tx) => {
    await lockDeal(tx, visible.id);
    const authority = await currentDealAuthority(tx, context.session, visible.id, ["canManageDeals", "canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id } });
    if (!deal || deal.rooftopId !== authority.rooftopId || !deal.leadId || !["finance", "lease"].includes(deal.structureType)) throw new Error("Finance or lease deal is required");
    const decision = await authority.context.query.LenderDecision.findOne({ where: { id: request.lenderDecisionId }, query: "id decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents providerKey rooftop { id } application { id lead { id } }" });
    if (!decision || decision.rooftop?.id !== deal.rooftopId || decision.application?.lead?.id !== deal.leadId) throw new Error("Lender offer must belong to the same rooftop and lead");
    if (!["approved", "conditional"].includes(decision.decision)) throw new Error("Only approved or conditional lender offers can be selected");
    if (Number(decision.approvedAmountCents || 0) < Number(deal.financingAmountCents || 0)) throw new Error("Selected lender offer does not cover the financed amount");
    const binding = worksheetBinding(deal);
    const evidence = { request, dealId: deal.id, lenderDecisionId: decision.id, binding, offer: { providerKey: decision.providerKey, decision: decision.decision, approvedAmountCents: decision.approvedAmountCents, aprBasisPoints: decision.aprBasisPoints, termMonths: decision.termMonths, monthlyPaymentCents: decision.monthlyPaymentCents } };
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
    if (!prior && deal.status !== "pencil") throw new Error("Only pencil finance or lease deals can select lender offers");
    const recorded = await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: "Deal", aggregateId: deal.id, action: "lender-offer-selected", topic: "deal.lender-offer-selected", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftopId, dealId: deal.id, lenderDecisionId: decision.id } });
    if (recorded.reused) {
      if (deal.selectedLenderDecisionId !== decision.id) throw new Error("Lender selection was superseded; select with a new request");
    } else {
      const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, rooftopId: deal.rooftopId, status: "pencil", worksheetVersion: binding.worksheetVersion, updatedAt: expectedUpdatedAt }, data: { selectedLenderDecisionId: decision.id } });
      if (changed.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    }
    const current = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
    return { ...current, reused: recorded.reused };
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
async function reopenDealWorksheet(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session }) || !permissions.canApproveDeals({ session: context.session })) throw new Error("Deal management and approval permissions are required");
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id status updatedAt worksheetVersion acceptedSnapshot presentedSnapshot evidenceSnapshot rooftop { id } vehicle { id status }" });
  if (!deal?.rooftop?.id || !["submitted", "approved"].includes(deal.status)) throw new Error("Only submitted or approved deals can be reopened");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageDeals");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canApproveDeals");
  const rawDeal = await context.sudo().prisma.deal.findUnique({ where: { id: deal.id }, select: { vehicleId: true, rooftopId: true } });
  const reservedVehicle = rawDeal?.vehicleId ? await context.sudo().prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId }, select: { status: true, rooftopId: true } }) : null;
  if (rawDeal?.rooftopId !== deal.rooftop.id || reservedVehicle?.status !== "pending" || reservedVehicle.rooftopId !== deal.rooftop.id) throw new Error("Reserved vehicle is required to reopen a deal");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const reason = required2(data.reason, "Reopen reason", 1e3);
  const eventKey = `deal-reopen:${idempotencyKey(data.idempotencyKey)}`;
  const evidence = { dealId: deal.id, priorStatus: deal.status, worksheetVersion: deal.worksheetVersion, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, supersededPresentedHash: domainEventRequestHash(deal.presentedSnapshot || {}), supersededAcceptedHash: domainEventRequestHash(deal.acceptedSnapshot || {}), supersededSubmissionHash: domainEventRequestHash(deal.evidenceSnapshot || {}) };
  const reused = await context.transaction(async (tx) => {
    await lockDeal(tx, deal.id);
    await currentDealAuthority(tx, context.session, deal.id, ["canManageDeals", "canApproveDeals"]);
    const currentVehicle = await tx.prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId } });
    if (currentVehicle?.status !== "pending" || currentVehicle.rooftopId !== deal.rooftop.id) throw new Error("Reserved vehicle is required to reopen a deal");
    const event2 = { eventKey, rooftopId: deal.rooftop.id, aggregateType: "Deal", aggregateId: deal.id, action: "worksheet-reopened", topic: "deal.worksheet-reopened", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, priorStatus: deal.status, status: "pencil" } };
    const recorded = await recordDomainEventInTransaction(tx, event2);
    if (recorded.reused) return true;
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: deal.status, updatedAt: expectedUpdatedAt }, data: { status: "pencil", lockedAt: null, evidenceSnapshot: {}, presentedAt: null, presentedSnapshot: {}, acceptedAt: null, acceptedSnapshot: {}, selectedLenderDecisionId: null } });
    if (changed.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    await tx.prisma.dealApproval.create({ data: { rooftopId: deal.rooftop.id, dealId: deal.id, approverId: context.session.itemId, decision: "changes-requested", notes: reason, approvalDate: /* @__PURE__ */ new Date() } });
    return false;
  }, { timeout: 3e4 });
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused };
}
async function completeDealDelivery(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session }) || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error("Deal and financing permissions are required for delivery");
  }
  const visible = await context.query.Deal.findOne({ where: { id: String(data.dealId || "") }, query: "id rooftop { id }" });
  if (!visible?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageDeals");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageFinancing");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const expectedFundingUpdatedAt = commandDate(data.expectedFundingUpdatedAt);
  const expectedDeliveryCaseUpdatedAt = commandDate(data.expectedDeliveryCaseUpdatedAt);
  const eventKey = `deal-delivery:${idempotencyKey(data.idempotencyKey)}`;
  const request = {
    ...data,
    idempotencyKey: void 0,
    dealId: visible.id,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    expectedFundingUpdatedAt: expectedFundingUpdatedAt.toISOString(),
    expectedDeliveryCaseUpdatedAt: expectedDeliveryCaseUpdatedAt.toISOString()
  };
  return context.transaction(async (tx) => {
    await lockDeal(tx, visible.id);
    const authority = await currentDealAuthority(tx, context.session, visible.id, ["canManageDeals", "canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id }, include: { vehicle: true } });
    if (!deal?.vehicle || deal.rooftopId !== authority.rooftopId || deal.vehicle.rooftopId !== deal.rooftopId) throw new Error("Same-rooftop deal and vehicle are required");
    const header = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true, actorId: true, rooftopId: true, aggregateType: true, aggregateId: true, action: true } });
    if (header) {
      if (header.actorId !== context.session.itemId || header.rooftopId !== authority.rooftopId || header.aggregateType !== "Deal" || header.aggregateId !== deal.id || header.action !== "delivery-completed") throw new Error("Delivery receipt is outside original actor/purpose scope");
      const lead = await tx.prisma.lead.findUnique({ where: { id: deal.leadId }, select: { id: true, rooftopId: true } });
      if (!lead || lead.rooftopId !== deal.rooftopId) throw new Error("Committed delivery related identity is unavailable in current scope");
      const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
      if (stableJson(prior.afterSnapshot?.request) !== stableJson(request) || prior.afterSnapshot?.binding?.leadId !== deal.leadId || prior.afterSnapshot?.vehicleId !== deal.vehicleId || prior.afterSnapshot?.binding?.rooftopId !== authority.rooftopId || deal.status !== "delivered" || deal.vehicle.status !== "sold") throw new Error("Delivery retry is changed, superseded, or inconsistent; reload and reconcile");
      const current2 = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
      if (!current2) throw new Error("Committed delivery receipt readback is unavailable in current scope");
      return { ...current2, reused: true };
    }
    const funding = await readLockedFunding(tx, deal.id);
    const binding = await assertCurrentFunding(tx, deal, funding);
    await tx.prisma.$queryRaw`SELECT "id" FROM "DeliveryCase" WHERE "deal" = ${deal.id} FOR UPDATE`;
    const deliveryCase = await tx.prisma.deliveryCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId }, include: { weOweItems: { orderBy: { promisedAt: "asc" } } } });
    if (!deliveryCase?.acknowledgedAt || !deliveryCase.customerAcknowledgment) throw new Error("Ready customer-acknowledged delivery case is required");
    const checklist = Array.isArray(deliveryCase.checklist) ? deliveryCase.checklist : [];
    const required7 = ["identity", "insurance", "registration", "title-handoff", "funding"];
    if (!required7.every((code) => checklist.some((item) => item.code === code && ["complete", "waived"].includes(item.status) && String(item.evidenceReference || "").trim()))) throw new Error("Server-verified delivery checklist is incomplete");
    if (stableJson(deliveryCase.deliverySnapshot?.checklist) !== stableJson(checklist) || deliveryCase.deliverySnapshot?.customerAcknowledgment !== deliveryCase.customerAcknowledgment || deliveryCase.deliverySnapshot?.acknowledgedAt !== deliveryCase.acknowledgedAt.toISOString()) throw new Error("Delivery acknowledgment no longer matches its recorded checklist evidence");
    const payload = { rooftopId: deal.rooftopId, dealId: deal.id, vehicleId: deal.vehicleId, status: "delivered" };
    if (deal.status !== "financed") throw new Error("Only financed deals can be delivered");
    if (deliveryCase.status !== "ready") throw new Error("Ready customer-acknowledged delivery case is required");
    if (stableJson(deliveryCase.deliverySnapshot?.binding) !== stableJson({ ...worksheetBinding(deal), acceptedHash: domainEventRequestHash(deal.acceptedSnapshot) })) throw new Error("Delivery acknowledgment is unbound or stale; record it for the current worksheet");
    if (funding.updatedAt.getTime() !== expectedFundingUpdatedAt.getTime() || deliveryCase.updatedAt.getTime() !== expectedDeliveryCaseUpdatedAt.getTime()) throw new Error("Funding or delivery case changed; reload and review before completion");
    const evidence = {
      version: 2,
      request,
      binding,
      dealId: deal.id,
      deliveryCaseId: deliveryCase.id,
      vehicleId: deal.vehicleId,
      funding: { id: funding.id, fundingReference: funding.fundingReference, updatedAt: funding.updatedAt.toISOString(), immutableEvidence: funding.immutableEvidence },
      checklist,
      customerAcknowledgment: deliveryCase.customerAcknowledgment,
      acknowledgedAt: deliveryCase.acknowledgedAt.toISOString(),
      weOweItems: deliveryCase.weOweItems.map((item) => ({ id: item.id, description: item.description, status: item.status, promisedAt: item.promisedAt, ownerId: item.ownerId, estimatedCostCents: item.estimatedCostCents }))
    };
    const delivered = await tx.prisma.deal.updateMany({ where: { id: deal.id, rooftopId: deal.rooftopId, status: "financed", worksheetVersion: binding.worksheetVersion, updatedAt: expectedUpdatedAt }, data: { status: "delivered", saleDate: /* @__PURE__ */ new Date() } });
    if (delivered.count !== 1) throw new Error("Deal changed concurrently; reload and retry");
    const sold = await tx.prisma.vehicle.updateMany({ where: { id: deal.vehicleId, rooftopId: deal.rooftopId, status: "pending" }, data: { status: "sold" } });
    if (sold.count !== 1) throw new Error("Reserved vehicle could not be released for delivery");
    const completedCase = await tx.prisma.deliveryCase.updateMany({ where: { id: deliveryCase.id, dealId: deal.id, rooftopId: deal.rooftopId, status: "ready", updatedAt: expectedDeliveryCaseUpdatedAt }, data: { status: "delivered", deliverySnapshot: evidence } });
    if (completedCase.count !== 1) throw new Error("Delivery case changed concurrently");
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: "Deal", aggregateId: deal.id, action: "delivery-completed", topic: "deal.delivery-completed", actorId: context.session.itemId, afterSnapshot: evidence, payload });
    const current = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: "id status updatedAt" });
    return { ...current, reused: false };
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
async function openFinanceFollowUp(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error("Financing management permission is required");
  const lead = await context.query.Lead.findOne({ where: { id: String(data.leadId || "") }, query: "id firstName lastName rooftop { id } tasks(where: { completed: { equals: false } }) { id }" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageFinancing");
  const eventKey = `finance-follow-up:${idempotencyKey(data.idempotencyKey)}`;
  const evidence = { leadId: lead.id, priority: "high", reason: required2(data.reason, "Follow-up reason") };
  const taskId = (0, import_node_crypto7.randomUUID)();
  const resolved = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } });
    if (replay) {
      const priorTaskId = String(replay.metadata?.taskId || "");
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: "Lead", aggregateId: lead.id, action: "finance-follow-up-opened", topic: "financing.follow-up-opened", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId: priorTaskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId: priorTaskId } });
      return { id: priorTaskId, reused: true };
    }
    if (lead.tasks.length) {
      const existingTaskId = lead.tasks[0].id;
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: "Lead", aggregateId: lead.id, action: "finance-follow-up-opened", topic: "financing.follow-up-opened", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId: existingTaskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId: existingTaskId } });
      return { id: existingTaskId, reused: true };
    }
    const dueDate = new Date(Date.now() + 864e5);
    await tx.prisma.task.create({ data: { id: taskId, rooftopId: lead.rooftop.id, leadId: lead.id, title: `F&I follow-up: ${`${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Finance applicant"}`, description: evidence.reason, priority: "high", completed: false, dueDate } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: "Lead", aggregateId: lead.id, action: "finance-follow-up-opened", topic: "financing.follow-up-opened", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId } });
    return { id: taskId, reused: false };
  }, { timeout: 3e4 });
  return { id: resolved.id, status: "open", updatedAt: /* @__PURE__ */ new Date(), reused: resolved.reused };
}
async function addServiceOrderLineItem(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service management permission is required");
  const order2 = await context.query.ServiceOrder.findOne({ where: { id: String(data.serviceOrderId || "") }, query: "id status updatedAt rooftop { id }" });
  if (!order2?.rooftop?.id) throw new Error("Service order not found or not accessible");
  await assertSessionRooftopPermission(context, order2.rooftop.id, "canManageService");
  const itemType = String(data.itemType || "");
  if (!["labor", "part", "sublet"].includes(itemType)) throw new Error("Service line type must be labor, part, or sublet");
  const description = required2(data.description, "Line description", 500);
  const quantity = Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e4) throw new Error("Quantity must be greater than zero");
  const unitPriceCents = cents3(data.unitPriceCents, "Unit price");
  const priceCents = Math.round(unitPriceCents * quantity);
  const costCents = data.costCents == null ? null : cents3(data.costCents, "Line cost");
  if (costCents != null) await assertSessionRooftopPermission(context, order2.rooftop.id, "canViewDealerCost");
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const eventKey = `service-line-add:${idempotencyKey(data.idempotencyKey)}`;
  const evidence = { serviceOrderId: order2.id, itemType, description, partNumber: String(data.partNumber || "").trim().slice(0, 100), quantity, unitPriceCents, priceCents, costCents, expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  const lineId = (0, import_node_crypto7.randomUUID)();
  const resolved = await context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } });
    if (replay) {
      const priorLineId = String(replay.metadata?.lineItemId || "");
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: order2.rooftop.id, aggregateType: "ServiceOrder", aggregateId: order2.id, action: "line-item-added", topic: "service-order.line-item-added", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { lineItemId: priorLineId }, payload: { rooftopId: order2.rooftop.id, serviceOrderId: order2.id, lineItemId: priorLineId, priceCents } });
      return { id: priorLineId, reused: true };
    }
    if (!["estimate", "approved", "in-progress"].includes(order2.status)) throw new Error("Service order lines are locked at completion");
    const current2 = await tx.prisma.serviceOrder.findUnique({ where: { id: order2.id }, select: { updatedAt: true, taxCents: true } });
    if (!current2 || current2.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error("Service order changed concurrently; reload and retry");
    await tx.prisma.repairOrderLineItem.create({ data: { id: lineId, rooftopId: order2.rooftop.id, serviceOrderId: order2.id, itemType, description, partNumber: evidence.partNumber, quantity, unitPriceCents, priceCents, costCents } });
    const totals = await tx.prisma.repairOrderLineItem.groupBy({ by: ["itemType"], where: { serviceOrderId: order2.id }, _sum: { priceCents: true } });
    const laborTotalCents = (totals.find((total) => total.itemType === "labor")?._sum.priceCents ?? 0) + (totals.find((total) => total.itemType === "sublet")?._sum.priceCents ?? 0);
    const partsTotalCents = totals.find((total) => total.itemType === "part")?._sum.priceCents ?? 0;
    await tx.prisma.serviceOrder.update({ where: { id: order2.id }, data: { laborTotalCents, partsTotalCents, grandTotalCents: laborTotalCents + partsTotalCents + (current2.taxCents ?? 0) } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: order2.rooftop.id, aggregateType: "ServiceOrder", aggregateId: order2.id, action: "line-item-added", topic: "service-order.line-item-added", actorId: context.session.itemId, afterSnapshot: evidence, metadata: { lineItemId: lineId }, payload: { rooftopId: order2.rooftop.id, serviceOrderId: order2.id, lineItemId: lineId, priceCents } });
    return { id: lineId, reused: false };
  }, { timeout: 3e4 });
  const current = await context.query.ServiceOrder.findOne({ where: { id: order2.id }, query: "id status updatedAt" });
  return { id: resolved.id, status: current.status, updatedAt: current.updatedAt, reused: resolved.reused };
}

// features/keystone/mutations/crmIdentityWorkflows.ts
var import_node_crypto8 = require("node:crypto");
function required3(value, label, max = 1e3) {
  const result2 = String(value || "").trim();
  if (!result2 || result2.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result2;
}
function commandKey3(value) {
  const key5 = String(value || "").trim();
  if (key5.length < 8 || key5.length > 180) throw new Error("A valid idempotency key is required");
  return key5;
}
function expectedDate(value, label) {
  const date4 = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date4.getTime())) throw new Error(`${label} is invalid`);
  return date4;
}
async function customerDuplicateCandidates(_root, { customerId, limit = 20 }, context) {
  if (!context.session?.itemId || !permissions.canAccessLeads({ session: context.session })) throw new Error("CRM access is required");
  const customer = await context.query.Customer.findOne({
    where: { id: String(customerId || "") },
    query: "id rooftop { id } normalizedEmail normalizedPhone status"
  });
  if (!customer?.rooftop?.id || customer.status !== "active") throw new Error("Customer not found or not accessible");
  const filters = [
    ...customer.normalizedEmail ? [{ normalizedEmail: { equals: customer.normalizedEmail } }] : [],
    ...customer.normalizedPhone ? [{ normalizedPhone: { equals: customer.normalizedPhone } }] : []
  ];
  if (!filters.length) return [];
  const candidates = await context.query.Customer.findMany({
    where: { id: { not: { equals: customer.id } }, status: { equals: "active" }, OR: filters },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(50, Number(limit) || 20)),
    query: "id firstName lastName primaryEmail primaryPhone status createdAt updatedAt leadsCount"
  });
  return candidates.map((candidate) => operatorDateFields(candidate, ["createdAt", "updatedAt"]));
}
async function mergeCustomers(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const survivorId = String(data.survivorId || "");
  const duplicateId = String(data.duplicateId || "");
  if (!survivorId || !duplicateId || survivorId === duplicateId) throw new Error("Two different customers are required");
  const reason = required3(data.reason, "Merge reason");
  const survivorExpected = expectedDate(data.survivorExpectedUpdatedAt, "Survivor expectedUpdatedAt");
  const duplicateExpected = expectedDate(data.duplicateExpectedUpdatedAt, "Duplicate expectedUpdatedAt");
  const eventKey = `customer-merge:${commandKey3(data.idempotencyKey)}`;
  const visible = await context.query.Customer.findMany({
    where: { id: { in: [survivorId, duplicateId] } },
    query: "id rooftop { id } status"
  });
  if (visible.length !== 2) throw new Error("Customer not found or not accessible");
  if (visible[0].rooftop?.id !== visible[1].rooftop?.id) throw new Error("Customers must belong to the same rooftop");
  const rooftopId = visible[0].rooftop.id;
  await assertSessionRooftopPermission(context, rooftopId, "canManageLeads");
  return context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`customer-identity-rooftop:${rooftopId}`}, 0))`;
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } });
    if (replay) {
      const metadata = replay.metadata || {};
      const prior = replay.afterSnapshot || {};
      if (prior.survivorId !== survivorId || prior.duplicateId !== duplicateId || prior.reason !== reason || prior.survivorExpectedUpdatedAt && prior.survivorExpectedUpdatedAt !== survivorExpected.toISOString() || prior.duplicateExpectedUpdatedAt && prior.duplicateExpectedUpdatedAt !== duplicateExpected.toISOString()) {
        throw new Error("Customer merge idempotency key was reused with different evidence");
      }
      return {
        id: survivorId,
        duplicateId,
        movedLeadCount: Number(metadata.movedLeadCount || 0),
        movedSalesVisitCount: Number(metadata.movedSalesVisitCount || 0),
        reused: true
      };
    }
    const [survivor, duplicate] = await Promise.all([
      tx.prisma.customer.findFirst({ where: { id: survivorId, rooftopId, status: "active", updatedAt: survivorExpected } }),
      tx.prisma.customer.findFirst({ where: { id: duplicateId, rooftopId, status: "active", updatedAt: duplicateExpected } })
    ]);
    if (!survivor || !duplicate) throw new Error("Customer changed concurrently; reload and retry");
    const leadLinks = await tx.prisma.lead.findMany({ where: { customerId: duplicateId }, select: { id: true, rooftopId: true }, orderBy: { id: "asc" } });
    const salesVisitLinks = await tx.prisma.salesVisit.findMany({ where: { customerId: duplicateId }, select: { id: true, rooftopId: true }, orderBy: { id: "asc" } });
    if (leadLinks.some((lead) => lead.rooftopId !== rooftopId) || salesVisitLinks.some((visit2) => visit2.rooftopId !== rooftopId)) {
      throw new Error("Customer merge is blocked by customer-linked records outside this rooftop");
    }
    const movedLeadIds = leadLinks.map((lead) => lead.id);
    const movedSalesVisitIds = salesVisitLinks.map((visit2) => visit2.id);
    const beforePreferences = (customer) => ({
      emailConsent: Boolean(customer.emailConsent),
      smsConsent: Boolean(customer.smsConsent),
      phoneConsent: Boolean(customer.phoneConsent),
      emailSuppressed: Boolean(customer.emailSuppressed),
      smsSuppressed: Boolean(customer.smsSuppressed),
      phoneSuppressed: Boolean(customer.phoneSuppressed),
      preferredChannel: customer.preferredChannel || "none",
      updatedAt: customer.contactPreferenceUpdatedAt || null
    });
    const survivorPreferences = beforePreferences(survivor);
    const duplicatePreferences = beforePreferences(duplicate);
    const mergedPreferences = {
      emailSuppressed: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed,
      smsSuppressed: survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed,
      phoneSuppressed: survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed,
      emailConsent: survivorPreferences.emailConsent && duplicatePreferences.emailConsent && !(survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed),
      smsConsent: survivorPreferences.smsConsent && duplicatePreferences.smsConsent && !(survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed),
      phoneConsent: survivorPreferences.phoneConsent && duplicatePreferences.phoneConsent && !(survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed),
      preferredChannel: survivorPreferences.preferredChannel === duplicatePreferences.preferredChannel && survivorPreferences.preferredChannel !== "none" && (survivorPreferences.preferredChannel === "email" ? survivorPreferences.emailConsent && duplicatePreferences.emailConsent && !survivorPreferences.emailSuppressed && !duplicatePreferences.emailSuppressed : survivorPreferences.preferredChannel === "sms" ? survivorPreferences.smsConsent && duplicatePreferences.smsConsent && !survivorPreferences.smsSuppressed && !duplicatePreferences.smsSuppressed : survivorPreferences.preferredChannel === "phone" ? survivorPreferences.phoneConsent && duplicatePreferences.phoneConsent && !survivorPreferences.phoneSuppressed && !duplicatePreferences.phoneSuppressed : false) ? survivorPreferences.preferredChannel : "none",
      contactPreferenceUpdatedAt: /* @__PURE__ */ new Date(),
      suppressionReason: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed || survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed || survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed ? `Suppression preserved during customer merge: ${reason}` : null,
      suppressionSource: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed || survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed || survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed ? "customer-merge" : null
    };
    const mergedAt = /* @__PURE__ */ new Date();
    const survivorHouseholdId = survivor.householdId || null;
    const duplicateHouseholdId = duplicate.householdId || null;
    const effectiveHouseholdId = survivorHouseholdId || duplicateHouseholdId;
    const survivorChanged = await tx.prisma.customer.updateMany({
      where: { id: survivorId, rooftopId, status: "active", updatedAt: survivorExpected },
      data: { ...mergedPreferences, ...effectiveHouseholdId && !survivorHouseholdId ? { householdId: effectiveHouseholdId } : {} }
    });
    if (survivorChanged.count !== 1) throw new Error("Surviving customer changed concurrently; reload and retry");
    const leadTransfer = await tx.prisma.lead.updateMany({ where: { customerId: duplicateId, rooftopId }, data: { customerId: survivorId } });
    const salesVisitTransfer = await tx.prisma.salesVisit.updateMany({ where: { customerId: duplicateId, rooftopId }, data: { customerId: survivorId } });
    if (leadTransfer.count !== movedLeadIds.length || salesVisitTransfer.count !== movedSalesVisitIds.length) {
      throw new Error("Customer-linked records changed during merge; reload and retry");
    }
    const duplicateChanged = await tx.prisma.customer.updateMany({
      where: { id: duplicateId, rooftopId, status: "active", updatedAt: duplicateExpected },
      data: { status: "merged", mergedIntoId: survivorId, mergedAt }
    });
    if (duplicateChanged.count !== 1) throw new Error("Duplicate customer changed concurrently; reload and retry");
    await tx.prisma.customerContactPreferenceEvent.create({
      data: {
        rooftopId,
        customerId: survivorId,
        actorId: context.session.itemId,
        source: "customer-merge",
        reason,
        occurredAt: mergedAt,
        preferenceSnapshot: { survivorBefore: survivorPreferences, duplicateBefore: duplicatePreferences, mergedAfter: mergedPreferences }
      }
    });
    await tx.prisma.customerMergeEvent.create({
      data: {
        rooftopId,
        survivorId,
        duplicateId,
        actorId: context.session.itemId,
        reason,
        mergedAt,
        movedLeadIds,
        evidenceSnapshot: {
          survivor: { id: survivor.id, normalizedEmail: survivor.normalizedEmail, normalizedPhone: survivor.normalizedPhone },
          duplicate: { id: duplicate.id, normalizedEmail: duplicate.normalizedEmail, normalizedPhone: duplicate.normalizedPhone },
          movedSalesVisitIds,
          householdPolicy: { survivorHouseholdId, duplicateHouseholdId, effectiveHouseholdId, duplicateMembershipRetained: true },
          preferences: { survivorBefore: survivorPreferences, duplicateBefore: duplicatePreferences, mergedAfter: mergedPreferences }
        }
      }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "Customer",
      aggregateId: survivorId,
      action: "duplicate-merged",
      topic: "customer.duplicate-merged",
      actorId: context.session.itemId,
      afterSnapshot: { survivorId, duplicateId, movedLeadIds, movedSalesVisitIds, reason, survivorExpectedUpdatedAt: survivorExpected.toISOString(), duplicateExpectedUpdatedAt: duplicateExpected.toISOString(), preferences: mergedPreferences },
      metadata: { duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length },
      payload: { rooftopId, survivorId, duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length }
    });
    return { id: survivorId, duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length, reused: false };
  }, { timeout: 3e4 });
}
async function configureLeadRoutingRule(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const rooftopId = String(data.rooftopId || "");
  const assigneeId = String(data.assigneeId || "");
  const name = required3(data.name, "Rule name", 200);
  const source = String(data.source || "any");
  if (!["any", "walk-in", "website", "phone", "referral", "ad", "social", "third-party"].includes(source)) throw new Error("Routing source is invalid");
  const priority = Number(data.priority ?? 100);
  const firstResponseMinutes = Number(data.firstResponseMinutes ?? 30);
  if (!Number.isInteger(priority) || priority < 0 || priority > 1e4) throw new Error("Routing priority is invalid");
  if (!Number.isInteger(firstResponseMinutes) || firstResponseMinutes < 1 || firstResponseMinutes > 10080) throw new Error("First response target is invalid");
  await assertSessionRooftopPermission(context, rooftopId, "canManageLeads");
  await assertUserRooftopAccess(context, assigneeId, rooftopId);
  const routeKey = `${rooftopId}:${source}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const eventKey = `lead-route-rule:${commandKey3(data.idempotencyKey)}`;
  const ruleId = (0, import_node_crypto8.randomUUID)();
  return context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } });
    if (replay) {
      const prior = replay.afterSnapshot || {};
      if (prior.routeKey !== routeKey || prior.source !== source || prior.priority !== priority || prior.firstResponseMinutes !== firstResponseMinutes || prior.assigneeId !== assigneeId || prior.active !== (data.active !== false)) {
        throw new Error("Lead routing rule idempotency key was reused with different evidence");
      }
      return { id: String(replay.metadata?.ruleId || ""), status: prior.active ? "active" : "inactive", updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const rule = await tx.prisma.leadRoutingRule.upsert({
      where: { routeKey },
      create: { id: ruleId, rooftopId, routeKey, name, source, priority, firstResponseMinutes, assigneeId, active: true },
      update: { name, source, priority, firstResponseMinutes, assigneeId, active: data.active !== false }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "LeadRoutingRule",
      aggregateId: rule.id,
      action: "configured",
      topic: "lead-routing.configured",
      actorId: context.session.itemId,
      afterSnapshot: { ruleId: rule.id, routeKey, source, priority, firstResponseMinutes, assigneeId, active: rule.active },
      metadata: { ruleId: rule.id },
      payload: { rooftopId, ruleId: rule.id, source, assigneeId }
    });
    return { id: rule.id, status: rule.active ? "active" : "inactive", updatedAt: rule.updatedAt, reused: false };
  }, { timeout: 3e4 });
}
async function routeLead(_root, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
  const leadId = String(data.leadId || "");
  const expectedUpdatedAt = expectedDate(data.expectedUpdatedAt, "Lead expectedUpdatedAt");
  const eventKey = `lead-route:${commandKey3(data.idempotencyKey)}`;
  const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: "id source status updatedAt rooftop { id } assignedSalesperson { id }" });
  if (!lead?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageLeads");
  return context.transaction(async (tx) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } });
    const rule = await tx.prisma.leadRoutingRule.findFirst({
      where: { rooftopId: lead.rooftop.id, active: true, source: { in: [lead.source || "any", "any"] } },
      orderBy: [{ priority: "desc" }, { routeKey: "asc" }]
    });
    if (!rule) throw new Error("No active routing rule matches this lead");
    if (replay) {
      const prior = replay.afterSnapshot || {};
      if (prior.leadId !== leadId || prior.ruleId !== rule.id || prior.routeKey !== rule.routeKey || prior.assigneeId !== rule.assigneeId || prior.requestExpectedUpdatedAt && prior.requestExpectedUpdatedAt !== expectedUpdatedAt.toISOString()) {
        throw new Error("Lead routing idempotency key was reused with different evidence");
      }
      return { id: leadId, status: lead.status, updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const [groupAccess, directAccess] = await Promise.all([
      tx.prisma.dealerGroupMembership.count({ where: { userId: rule.assigneeId, status: "active", accessAllRooftops: true, dealerGroup: { rooftops: { some: { id: lead.rooftop.id } } } } }),
      tx.prisma.rooftopMembership.count({ where: { userId: rule.assigneeId, status: "active", rooftopId: lead.rooftop.id } })
    ]);
    if (groupAccess === 0 && directAccess === 0) throw new Error("Routing assignee no longer has active rooftop access");
    const assignedAt = /* @__PURE__ */ new Date();
    const firstResponseDueAt = new Date(assignedAt.getTime() + rule.firstResponseMinutes * 6e4);
    const changed = await tx.prisma.lead.updateMany({
      where: { id: leadId, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { assignedSalespersonId: rule.assigneeId, assignedAt, firstResponseDueAt }
    });
    if (changed.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    await tx.prisma.leadAssignmentEvent.create({
      data: { rooftopId: lead.rooftop.id, leadId, fromUserId: lead.assignedSalesperson?.id || null, toUserId: rule.assigneeId, actorId: context.session.itemId, reason: "Matched active routing rule", routeKey: rule.routeKey, assignedAt, firstResponseDueAt }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: lead.rooftop.id,
      aggregateType: "Lead",
      aggregateId: leadId,
      action: "routed",
      topic: "lead.routed",
      actorId: context.session.itemId,
      afterSnapshot: { leadId, ruleId: rule.id, routeKey: rule.routeKey, assigneeId: rule.assigneeId, assignedAt, firstResponseDueAt, requestExpectedUpdatedAt: expectedUpdatedAt.toISOString() },
      metadata: { ruleId: rule.id },
      payload: { rooftopId: lead.rooftop.id, leadId, assigneeId: rule.assigneeId, firstResponseDueAt }
    });
    return { id: leadId, status: lead.status, updatedAt: assignedAt, reused: false };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/crmEngagementWorkflows.ts
var import_node_crypto9 = require("node:crypto");
var CADENCES = {
  "internet-lead-first-response": [
    { step: "initial-response", channel: "email", delayMinutes: 0, taskTitle: "Respond to internet lead" },
    { step: "two-hour-call", channel: "phone", delayMinutes: 120, taskTitle: "Call internet lead" },
    { step: "day-one-text", channel: "sms", delayMinutes: 1440, taskTitle: "Send day-one internet lead follow-up" }
  ],
  "showroom-follow-up": [
    { step: "post-visit-call", channel: "phone", delayMinutes: 60, taskTitle: "Follow up after showroom visit" },
    { step: "day-one-email", channel: "email", delayMinutes: 1440, taskTitle: "Send showroom follow-up recap" }
  ],
  "unsold-follow-up": [
    { step: "unsold-day-one", channel: "sms", delayMinutes: 1440, taskTitle: "Follow up with unsold customer" },
    { step: "unsold-day-three", channel: "phone", delayMinutes: 4320, taskTitle: "Call unsold customer" }
  ]
};
function requireManager(context) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error("Lead management permission is required");
}
function text74(value, label, max = 1e3) {
  const result2 = String(value || "").trim();
  if (!result2 || result2.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result2;
}
function key2(value) {
  const result2 = String(value || "").trim();
  if (result2.length < 8 || result2.length > 180) throw new Error("A valid idempotency key is required");
  return result2;
}
function date3(value, label) {
  const result2 = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(result2.getTime())) throw new Error(`${label} is invalid`);
  return result2;
}
async function lockAndReplay(tx, eventKey) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`;
  return tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true, metadata: true } });
}
async function updateCustomerCommunicationPreferences(_root, { data }, context) {
  requireManager(context);
  const customerId = String(data.customerId || "");
  const expectedUpdatedAt = date3(data.expectedUpdatedAt, "Customer expectedUpdatedAt");
  const source = text74(data.source, "Preference source", 120);
  const reason = text74(data.reason, "Preference reason", 1e3);
  const preferredChannel = String(data.preferredChannel || "none");
  if (!["email", "sms", "phone", "none"].includes(preferredChannel)) throw new Error("Preferred channel is invalid");
  const snapshot2 = {
    emailConsent: data.emailConsent === true,
    smsConsent: data.smsConsent === true,
    phoneConsent: data.phoneConsent === true,
    emailSuppressed: data.emailSuppressed === true,
    smsSuppressed: data.smsSuppressed === true,
    phoneSuppressed: data.phoneSuppressed === true,
    preferredChannel,
    source,
    reason
  };
  const channelAllowed = preferredChannel === "none" || snapshot2[`${preferredChannel}Consent`] && !snapshot2[`${preferredChannel}Suppressed`];
  if (!channelAllowed) throw new Error("Preferred channel must have affirmative consent and must not be suppressed");
  const eventKey = `customer-contact-preference:${key2(data.idempotencyKey)}`;
  const visible = await context.query.Customer.findOne({ where: { id: customerId }, query: "id rooftop { id } status" });
  if (!visible?.rooftop?.id || visible.status !== "active") throw new Error("Customer not found or not accessible");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageLeads");
  return context.transaction(async (tx) => {
    const replay = await lockAndReplay(tx, eventKey);
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId: visible.rooftop.id,
        aggregateType: "Customer",
        aggregateId: customerId,
        action: "contact-preferences-updated",
        topic: "customer.contact-preferences-updated",
        actorId: context.session.itemId,
        afterSnapshot: { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), ...snapshot2 },
        metadata: replay.metadata,
        payload: { customerId, rooftopId: visible.rooftop.id, preferredChannel }
      });
      return { id: customerId, status: preferredChannel, updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const now = /* @__PURE__ */ new Date();
    const changed = await tx.prisma.customer.updateMany({
      where: { id: customerId, rooftopId: visible.rooftop.id, status: "active", updatedAt: expectedUpdatedAt },
      data: {
        emailConsent: snapshot2.emailConsent,
        smsConsent: snapshot2.smsConsent,
        phoneConsent: snapshot2.phoneConsent,
        emailSuppressed: snapshot2.emailSuppressed,
        smsSuppressed: snapshot2.smsSuppressed,
        phoneSuppressed: snapshot2.phoneSuppressed,
        preferredChannel,
        contactPreferenceUpdatedAt: now,
        suppressionReason: snapshot2.emailSuppressed || snapshot2.smsSuppressed || snapshot2.phoneSuppressed ? reason : "",
        suppressionSource: snapshot2.emailSuppressed || snapshot2.smsSuppressed || snapshot2.phoneSuppressed ? source : ""
      }
    });
    if (changed.count !== 1) throw new Error("Customer changed concurrently; reload and retry");
    const preferenceEvent = await tx.prisma.customerContactPreferenceEvent.create({
      data: { rooftopId: visible.rooftop.id, customerId, actorId: context.session.itemId, source, reason, occurredAt: now, preferenceSnapshot: snapshot2 },
      select: { id: true }
    });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: visible.rooftop.id,
      aggregateType: "Customer",
      aggregateId: customerId,
      action: "contact-preferences-updated",
      topic: "customer.contact-preferences-updated",
      actorId: context.session.itemId,
      afterSnapshot: { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), ...snapshot2 },
      metadata: { preferenceEventId: preferenceEvent.id },
      payload: { customerId, rooftopId: visible.rooftop.id, preferredChannel }
    });
    return { id: customerId, status: preferredChannel, updatedAt: now, reused: false };
  }, { timeout: 3e4 });
}
async function enrollLeadCadence(_root, { data }, context) {
  requireManager(context);
  const leadId = String(data.leadId || "");
  const expectedUpdatedAt = date3(data.expectedUpdatedAt, "Lead expectedUpdatedAt");
  const cadenceKey = String(data.cadenceKey || "");
  const cadence = CADENCES[cadenceKey]?.[0];
  if (!cadence) throw new Error("Cadence key is not registered");
  const campaignKey = text74(data.campaignKey, "Campaign key", 160).toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
  const eventKey = `lead-cadence:${key2(data.idempotencyKey)}`;
  const lead = await context.query.Lead.findOne({
    where: { id: leadId },
    query: "id status rooftop { id } customer { id emailConsent smsConsent phoneConsent emailSuppressed smsSuppressed phoneSuppressed } assignedSalesperson { id }"
  });
  if (!lead?.rooftop?.id || !lead.customer?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, lead.rooftop.id, "canManageLeads");
  if (["closed-won", "closed-lost"].includes(lead.status)) throw new Error("Closed leads cannot enter a cadence");
  const consent = lead.customer[`${cadence.channel}Consent`] === true;
  const suppressed = lead.customer[`${cadence.channel}Suppressed`] === true;
  const cadenceStatus = consent && !suppressed ? "active" : "suppressed";
  return context.transaction(async (tx) => {
    const replay = await lockAndReplay(tx, eventKey);
    const afterSnapshot = { leadId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), cadenceKey, campaignKey, channel: cadence.channel, cadenceStatus };
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId: lead.rooftop.id,
        aggregateType: "Lead",
        aggregateId: leadId,
        action: "cadence-enrolled",
        topic: "lead.cadence-enrolled",
        actorId: context.session.itemId,
        afterSnapshot,
        metadata: replay.metadata,
        payload: { leadId, rooftopId: lead.rooftop.id, cadenceKey, campaignKey, cadenceStatus, taskId: replay.metadata?.taskId ?? null }
      });
      return { id: leadId, status: cadenceStatus, updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const dueAt = new Date(Date.now() + cadence.delayMinutes * 6e4);
    const changed = await tx.prisma.lead.updateMany({
      where: { id: leadId, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { campaignKey, cadenceKey, cadenceStatus, cadenceStep: cadence.step, cadenceDueAt: cadenceStatus === "active" ? dueAt : null }
    });
    if (changed.count !== 1) throw new Error("Lead changed concurrently; reload and retry");
    let taskId = null;
    if (cadenceStatus === "active") {
      const task = await tx.prisma.task.create({
        data: { rooftopId: lead.rooftop.id, leadId, assignedToId: lead.assignedSalesperson?.id || context.session.itemId, title: cadence.taskTitle, description: `Campaign ${campaignKey}; ${cadence.channel} consent verified at enrollment.`, priority: "high", completed: false, dueDate: dueAt },
        select: { id: true }
      });
      taskId = task.id;
    }
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: lead.rooftop.id,
      aggregateType: "Lead",
      aggregateId: leadId,
      action: "cadence-enrolled",
      topic: "lead.cadence-enrolled",
      actorId: context.session.itemId,
      afterSnapshot,
      metadata: { taskId },
      payload: { leadId, rooftopId: lead.rooftop.id, cadenceKey, campaignKey, cadenceStatus, taskId }
    });
    return { id: leadId, status: cadenceStatus, updatedAt: dueAt, reused: false };
  }, { timeout: 3e4 });
}
async function advanceLeadCadence(_root, { data }, context) {
  requireManager(context);
  const leadId = String(data.leadId || "");
  const expectedUpdatedAt = date3(data.expectedUpdatedAt, "Lead expectedUpdatedAt");
  const eventKey = `lead-cadence-advance:${key2(data.idempotencyKey)}`;
  const visible = await context.query.Lead.findOne({ where: { id: leadId }, query: "id rooftop { id }" });
  if (!visible?.rooftop?.id) throw new Error("Lead not found or not accessible");
  await assertSessionRooftopPermission(context, visible.rooftop.id, "canManageLeads");
  const requestEvidence = { leadId, expectedUpdatedAt: expectedUpdatedAt.toISOString() };
  return context.transaction(async (tx) => {
    const replay = await lockAndReplay(tx, eventKey);
    if (replay) {
      const prior = replay.afterSnapshot;
      if (JSON.stringify(prior?.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error("Cadence idempotency key was reused with different evidence");
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId: visible.rooftop.id,
        aggregateType: "Lead",
        aggregateId: leadId,
        action: "cadence-advanced",
        topic: "lead.cadence-advanced",
        actorId: context.session.itemId,
        afterSnapshot: prior,
        metadata: replay.metadata,
        payload: { leadId, rooftopId: visible.rooftop.id, cadenceKey: prior.cadenceKey, cadenceStatus: prior.cadenceStatus, cadenceStep: prior.cadenceStep, taskId: replay.metadata?.taskId ?? null }
      });
      return { id: leadId, status: String(prior.cadenceStatus), updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const lead = await tx.prisma.lead.findFirst({
      where: { id: leadId, rooftopId: visible.rooftop.id, updatedAt: expectedUpdatedAt },
      include: { customer: true }
    });
    if (!lead) throw new Error("Lead changed concurrently; reload and retry");
    if (lead.cadenceStatus !== "active" || !lead.cadenceKey || !lead.cadenceStep) throw new Error("Lead does not have an active cadence");
    const steps = CADENCES[lead.cadenceKey];
    const currentIndex = steps?.findIndex((step) => step.step === lead.cadenceStep) ?? -1;
    if (!steps || currentIndex < 0) throw new Error("Lead cadence evidence is not registered");
    const nextStep = steps[currentIndex + 1];
    const consent = nextStep ? lead.customer[`${nextStep.channel}Consent`] === true : false;
    const suppressed = nextStep ? lead.customer[`${nextStep.channel}Suppressed`] === true : false;
    const cadenceStatus = !nextStep ? "completed" : consent && !suppressed ? "active" : "suppressed";
    const dueAt = nextStep && cadenceStatus === "active" ? new Date(Date.now() + nextStep.delayMinutes * 6e4) : null;
    await tx.prisma.lead.update({
      where: { id: leadId },
      data: { cadenceStatus, cadenceStep: nextStep?.step || lead.cadenceStep, cadenceDueAt: dueAt }
    });
    let taskId = null;
    if (nextStep && cadenceStatus === "active") {
      const task = await tx.prisma.task.create({
        data: { rooftopId: visible.rooftop.id, leadId, assignedToId: lead.assignedSalespersonId || context.session.itemId, title: nextStep.taskTitle, description: `Campaign ${lead.campaignKey}; ${nextStep.channel} consent verified at cadence advance.`, priority: "high", completed: false, dueDate: dueAt },
        select: { id: true }
      });
      taskId = task.id;
    }
    const afterSnapshot = { requestEvidence, cadenceKey: lead.cadenceKey, campaignKey: lead.campaignKey, priorStep: lead.cadenceStep, cadenceStep: nextStep?.step || lead.cadenceStep, channel: nextStep?.channel || null, cadenceStatus, dueAt: dueAt?.toISOString() || null };
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: visible.rooftop.id,
      aggregateType: "Lead",
      aggregateId: leadId,
      action: "cadence-advanced",
      topic: "lead.cadence-advanced",
      actorId: context.session.itemId,
      afterSnapshot,
      metadata: { taskId },
      payload: { leadId, rooftopId: visible.rooftop.id, cadenceKey: lead.cadenceKey, cadenceStatus, cadenceStep: afterSnapshot.cadenceStep, taskId }
    });
    return { id: leadId, status: cadenceStatus, updatedAt: /* @__PURE__ */ new Date(), reused: false };
  }, { timeout: 3e4 });
}
async function linkCustomerHousehold(_root, { data }, context) {
  requireManager(context);
  const customerIds = [String(data.primaryCustomerId || ""), String(data.memberCustomerId || "")];
  if (!customerIds[0] || !customerIds[1] || customerIds[0] === customerIds[1]) throw new Error("Two different customers are required");
  const expected = [date3(data.primaryExpectedUpdatedAt, "Primary expectedUpdatedAt"), date3(data.memberExpectedUpdatedAt, "Member expectedUpdatedAt")];
  const displayName = text74(data.displayName, "Household display name", 200);
  const eventKey = `customer-household:${key2(data.idempotencyKey)}`;
  const customers = await context.query.Customer.findMany({ where: { id: { in: customerIds } }, query: "id status rooftop { id } household { id }" });
  if (customers.length !== 2 || customers.some((customer) => customer.status !== "active")) throw new Error("Customers not found or not accessible");
  if (customers[0].rooftop?.id !== customers[1].rooftop?.id) throw new Error("Household members must belong to the same rooftop");
  const rooftopId = customers[0].rooftop.id;
  await assertSessionRooftopPermission(context, rooftopId, "canManageLeads");
  const householdKey = `${rooftopId}:${[...customerIds].sort().join(":")}`;
  return context.transaction(async (tx) => {
    const replay = await lockAndReplay(tx, eventKey);
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId,
        aggregateType: "CustomerHousehold",
        aggregateId: replay.aggregateId,
        action: "members-linked",
        topic: "customer.household-linked",
        actorId: context.session.itemId,
        afterSnapshot: { customerIds: [...customerIds].sort(), displayName, expectedUpdatedAt: expected.map((value) => value.toISOString()) },
        metadata: replay.metadata,
        payload: { rooftopId, householdId: replay.aggregateId, customerIds }
      });
      return { id: replay.aggregateId, status: "active", updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const rows = await tx.prisma.customer.findMany({ where: { id: { in: customerIds }, rooftopId, status: "active" }, select: { id: true, updatedAt: true, householdId: true } });
    if (rows.length !== 2 || rows.some((row, index) => row.updatedAt.getTime() !== expected[customerIds.indexOf(row.id)].getTime())) throw new Error("Customer changed concurrently; reload and retry");
    const existingHouseholds = [...new Set(rows.map((row) => row.householdId).filter(Boolean))];
    if (existingHouseholds.length > 1) throw new Error("Customers already belong to different households");
    const household = existingHouseholds.length === 1 ? await tx.prisma.customerHousehold.update({ where: { id: existingHouseholds[0] }, data: { displayName } }) : await tx.prisma.customerHousehold.create({ data: { id: (0, import_node_crypto9.randomUUID)(), rooftopId, householdKey, displayName } });
    await tx.prisma.customer.updateMany({ where: { id: { in: customerIds }, rooftopId }, data: { householdId: household.id } });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "CustomerHousehold",
      aggregateId: household.id,
      action: "members-linked",
      topic: "customer.household-linked",
      actorId: context.session.itemId,
      afterSnapshot: { customerIds: [...customerIds].sort(), displayName, expectedUpdatedAt: expected.map((value) => value.toISOString()) },
      metadata: { householdId: household.id },
      payload: { rooftopId, householdId: household.id, customerIds }
    });
    return { id: household.id, status: "active", updatedAt: household.updatedAt, reused: false };
  }, { timeout: 3e4 });
}
var VISIT_TRANSITIONS = {
  scheduled: ["arrived", "cancelled", "no-show"],
  arrived: ["manager-turn", "completed", "cancelled"],
  "manager-turn": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  "no-show": []
};
async function manageSalesVisit(_root, { data }, context) {
  requireManager(context);
  const action = String(data.action || "");
  if (!["schedule", "arrive", "manager-turn", "complete", "cancel", "no-show"].includes(action)) throw new Error("Sales visit action is invalid");
  const eventKey = `sales-visit:${key2(data.idempotencyKey)}`;
  const requestedVisitId = String(data.visitId || "");
  const leadId = String(data.leadId || "");
  const lead = leadId ? await context.query.Lead.findOne({ where: { id: leadId }, query: "id rooftop { id } customer { id } assignedSalesperson { id } interestedVehicle { id }" }) : null;
  const visibleVisit = requestedVisitId ? await context.query.SalesVisit.findOne({ where: { id: requestedVisitId }, query: "id status kind updatedAt rooftop { id } lead { id }" }) : null;
  const rooftopId = lead?.rooftop?.id || visibleVisit?.rooftop?.id;
  if (!rooftopId) throw new Error("Lead or sales visit not found or not accessible");
  await assertSessionRooftopPermission(context, rooftopId, "canManageLeads");
  if (lead && visibleVisit && (lead.id !== visibleVisit.lead?.id || lead.rooftop.id !== visibleVisit.rooftop?.id)) throw new Error("Sales visit must belong to the selected lead");
  if (data.vehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: String(data.vehicleId) }, query: "id rooftop { id }" });
    if (!vehicle || vehicle.rooftop?.id !== rooftopId) throw new Error("Vehicle must belong to the same rooftop");
  }
  const expectedUpdatedAt = action === "schedule" ? null : date3(data.expectedUpdatedAt, "Sales visit expectedUpdatedAt");
  if (data.managerId) await assertUserRooftopAccess(context, String(data.managerId), rooftopId);
  const requestEvidence = {
    action,
    visitId: requestedVisitId || null,
    leadId: leadId || visibleVisit?.lead?.id || null,
    kind: data.kind ? String(data.kind) : null,
    vehicleId: data.vehicleId ? String(data.vehicleId) : null,
    managerId: data.managerId ? String(data.managerId) : null,
    requestedScheduledAt: data.scheduledAt ? date3(data.scheduledAt, "Scheduled time").toISOString() : null,
    requestExpectedUpdatedAt: expectedUpdatedAt?.toISOString() || null,
    outcome: data.outcome ? String(data.outcome).trim().slice(0, 300) : null,
    notesHash: domainEventRequestHash(String(data.notes || "").trim().slice(0, 4e3))
  };
  return context.transaction(async (tx) => {
    const replay = await lockAndReplay(tx, eventKey);
    if (replay) {
      const prior = replay.afterSnapshot;
      if (JSON.stringify(prior?.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error("Sales visit idempotency key was reused with different evidence");
      await recordDomainEventInTransaction(tx, {
        eventKey,
        rooftopId,
        aggregateType: "SalesVisit",
        aggregateId: replay.aggregateId,
        action,
        topic: `sales-visit.${action}`,
        actorId: context.session.itemId,
        afterSnapshot: prior,
        metadata: replay.metadata,
        payload: { rooftopId, visitId: replay.aggregateId, action }
      });
      return { id: replay.aggregateId, status: String(prior?.status || action), updatedAt: /* @__PURE__ */ new Date(), reused: true };
    }
    const now = /* @__PURE__ */ new Date();
    let visit2;
    if (action === "schedule") {
      if (!lead?.customer?.id) throw new Error("A lead with a customer is required");
      const kind = String(data.kind || "appointment");
      if (!["appointment", "showroom"].includes(kind)) throw new Error("Sales visit kind is invalid");
      const scheduledAt = date3(data.scheduledAt || now, "Scheduled time");
      visit2 = await tx.prisma.salesVisit.create({
        data: { id: (0, import_node_crypto9.randomUUID)(), rooftopId, leadId, customerId: lead.customer.id, vehicleId: String(data.vehicleId || lead.interestedVehicle?.id || "") || null, assignedSalespersonId: lead.assignedSalesperson?.id || context.session.itemId, kind, status: kind === "showroom" ? "arrived" : "scheduled", scheduledAt, arrivedAt: kind === "showroom" ? now : null, notes: String(data.notes || "").trim().slice(0, 4e3) }
      });
    } else {
      if (!visibleVisit || !expectedUpdatedAt) throw new Error("Sales visit is required");
      const target = action === "cancel" ? "cancelled" : action === "complete" ? "completed" : action === "arrive" ? "arrived" : action;
      if (!VISIT_TRANSITIONS[visibleVisit.status]?.includes(target)) throw new Error(`Invalid sales visit transition: ${visibleVisit.status} -> ${target}`);
      const changed = await tx.prisma.salesVisit.updateMany({
        where: { id: requestedVisitId, rooftopId, status: visibleVisit.status, updatedAt: expectedUpdatedAt },
        data: { status: target, ...target === "arrived" ? { arrivedAt: now } : {}, ...target === "manager-turn" ? { managerId: String(data.managerId || context.session.itemId), managerTurnAt: now } : {}, ...target === "completed" ? { completedAt: now, outcome: text74(data.outcome, "Visit outcome", 300) } : {}, notes: String(data.notes || "").trim().slice(0, 4e3) || void 0 }
      });
      if (changed.count !== 1) throw new Error("Sales visit changed concurrently; reload and retry");
      visit2 = await tx.prisma.salesVisit.findUniqueOrThrow({ where: { id: requestedVisitId } });
    }
    const afterSnapshot = { visitId: visit2.id, leadId: visit2.leadId, kind: visit2.kind, status: visit2.status, managerId: visit2.managerId || null, vehicleId: visit2.vehicleId || null, scheduledAt: visit2.scheduledAt?.toISOString() || null, outcome: visit2.outcome || null, requestEvidence };
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: "SalesVisit",
      aggregateId: visit2.id,
      action,
      topic: `sales-visit.${action}`,
      actorId: context.session.itemId,
      afterSnapshot,
      metadata: { visitId: visit2.id },
      payload: { rooftopId, visitId: visit2.id, leadId: visit2.leadId, status: visit2.status }
    });
    return { id: visit2.id, status: visit2.status, updatedAt: visit2.updatedAt, reused: false };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/dealLenderOffers.ts
async function dealLenderOffers(_root, { dealId }, context) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session }) || !permissions.canAccessDeals({ session: context.session })) throw new Error("Deal and financing permissions are required");
  const deal = await context.query.Deal.findOne({ where: { id: String(dealId || "") }, query: "id rooftop { id } lead { id } selectedLenderDecision { id }" });
  if (!deal?.rooftop?.id || !deal.lead?.id) throw new Error("Deal not found or not accessible");
  const decisions = await context.query.LenderDecision.findMany({
    where: { application: { lead: { id: { equals: deal.lead.id } } }, decision: { in: ["approved", "conditional"] } },
    orderBy: [{ aprBasisPoints: "asc" }, { monthlyPaymentCents: "asc" }, { decidedAt: "desc" }],
    take: 25,
    query: "id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt"
  });
  return decisions.map((decision) => ({ ...decision, selected: decision.id === deal.selectedLenderDecision?.id }));
}

// features/keystone/mutations/accountingOperations.ts
var req = (v, n, max = 500) => {
  const s = String(v || "").trim();
  if (!s || s.length > max) throw Error(`${n} is required`);
  return s;
};
var ik = (v) => req(v, "Idempotency key", 200);
function auth(c) {
  if (!c.session?.itemId || !permissions.canViewReports({ session: c.session }) || !permissions.canManageDealerships({ session: c.session })) throw Error("Accounting administration permission is required");
}
async function ev(c, e, w) {
  return c.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${e.eventKey},0))`;
    const x = await recordDomainEventInTransaction(tx, e);
    return w(tx, x.reused);
  }, { timeout: 3e4 });
}
async function configureAccountingMapping(_r, { data }, c) {
  auth(c);
  const roof = await c.query.Rooftop.findOne({ where: { id: String(data.rooftopId || "") }, query: "id" });
  if (!roof) throw Error("Rooftop inaccessible");
  await assertSessionRooftopPermission(c, roof.id, "canManageDealerships");
  await assertSessionRooftopPermission(c, roof.id, "canViewReports");
  const sourceType = req(data.sourceType, "Source type", 30), sourceCode = req(data.sourceCode, "Source code", 80), providerKey = req(data.providerKey, "Provider", 80);
  if (!["deal", "service", "parts", "payment"].includes(sourceType) || providerKey !== "operator-recorded") throw Error("Unsupported accounting source/provider");
  const evidence = { rooftopId: roof.id, sourceType, sourceCode, debitAccount: req(data.debitAccount, "Debit account", 100), creditAccount: req(data.creditAccount, "Credit account", 100), providerKey }, eventKey = `accounting-mapping:${ik(data.idempotencyKey)}`;
  const id = await ev(c, { eventKey, rooftopId: roof.id, aggregateType: "AccountingMapping", aggregateId: `${roof.id}:${sourceType}:${sourceCode}`, action: "configured", topic: "accounting.mapping-configured", actorId: c.session.itemId, afterSnapshot: evidence, payload: evidence }, async (tx, reused) => {
    const found = await tx.prisma.accountingMapping.findFirst({ where: { rooftopId: roof.id, sourceType, sourceCode, providerKey } });
    if (reused) {
      if (!found) throw Error("Mapping replay missing");
      return found.id;
    }
    return found ? (await tx.prisma.accountingMapping.update({ where: { id: found.id }, data: evidence, select: { id: true } })).id : (await tx.prisma.accountingMapping.create({ data: evidence, select: { id: true } })).id;
  });
  return c.db.AccountingMapping.findOne({ where: { id } });
}
async function sourcePairs(prisma, type, id) {
  if (type === "deal") {
    const d = await prisma.deal.findUnique({ where: { id }, select: { id: true, rooftopId: true, status: true, vehiclePriceCents: true, taxAmountCents: true, taxLines: true, fees: true, products: true, rebates: true, tradeInValueCents: true } });
    if (!d || d.status !== "delivered") throw Error("Delivered deal source required");
    const price = calculateDealPrice(d);
    return { rooftopId: d.rooftopId, pairs: [["vehicle-sale", price.vehiclePriceCents], ["sales-tax", price.taxAmountCents], ["fees", price.feesCents], ["finance-products", price.productsCents], ["rebates", price.rebatesCents], ["trade-in", price.tradeInValueCents]].filter((x) => x[1] > 0) };
  }
  if (type === "service") {
    const o = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!o || o.status !== "paid") throw Error("Paid service-order source required");
    return { rooftopId: o.rooftopId, pairs: [["labor", o.laborTotalCents], ["parts", o.partsTotalCents], ["sales-tax", o.taxCents]].filter((x) => Number(x[1]) > 0) };
  }
  if (type === "parts") {
    const po = await prisma.partsPurchaseOrder.findUnique({ where: { id } });
    if (!po || po.status !== "received") throw Error("Received parts PO source required");
    const amount = Array.isArray(po.lines) ? po.lines.reduce((n, x) => n + Number(x.quantity || 0) * Number(x.unitCostCents || 0), 0) : 0;
    return { rooftopId: po.rooftopId, pairs: [["inventory-receipt", amount]] };
  }
  if (type === "payment") {
    const payment = await prisma.paymentTransaction.findUnique({ where: { id } });
    if (!payment || !payment.reconciledAt || !["captured", "partially-refunded", "refunded"].includes(payment.status)) throw Error("Reconciled payment source required");
    return { rooftopId: payment.rooftopId, pairs: [["payment-capture", payment.capturedCents], ["payment-refund", payment.refundedCents]].filter((x) => Number(x[1]) > 0) };
  }
  throw Error("Unsupported accounting source");
}
async function stageAccountingBatch(_r, { data }, c) {
  auth(c);
  const sourceType = req(data.sourceType, "Source type", 30), sourceId = req(data.sourceId, "Source ID", 100), providerKey = req(data.providerKey, "Provider", 80);
  if (providerKey !== "operator-recorded") throw Error("Unsupported accounting provider");
  const source = await sourcePairs(c.sudo().prisma, sourceType, sourceId), roof = await c.query.Rooftop.findOne({ where: { id: source.rooftopId }, query: "id" });
  if (!roof) throw Error("Source rooftop inaccessible");
  await assertSessionRooftopPermission(c, roof.id, "canManageDealerships");
  await assertSessionRooftopPermission(c, roof.id, "canViewReports");
  const mappings = await c.sudo().prisma.accountingMapping.findMany({ where: { rooftopId: source.rooftopId, sourceType, providerKey } }), byCode = new Map(mappings.map((m) => [m.sourceCode, m]));
  const lines = [];
  for (const [code, amount] of source.pairs) {
    const m = byCode.get(code);
    if (!m) throw Error(`Accounting mapping missing for ${code}`);
    lines.push({ account: m.debitAccount, direction: "debit", amountCents: Number(amount), sourceCode: code }, { account: m.creditAccount, direction: "credit", amountCents: Number(amount), sourceCode: code });
  }
  const debit = lines.filter((x) => x.direction === "debit").reduce((n, x) => n + x.amountCents, 0), credit = lines.filter((x) => x.direction === "credit").reduce((n, x) => n + x.amountCents, 0);
  if (!lines.length || debit !== credit) throw Error("Accounting batch must be non-empty and balanced");
  const eventKey = `accounting-stage:${ik(data.idempotencyKey)}`, evidence = { sourceType, sourceId, providerKey, lines, totalDebitCents: debit, totalCreditCents: credit };
  const id = await ev(c, { eventKey, rooftopId: source.rooftopId, aggregateType: "AccountingBatch", aggregateId: sourceId, action: "staged", topic: "accounting.batch-staged", actorId: c.session.itemId, afterSnapshot: evidence, payload: { rooftopId: source.rooftopId, sourceType, sourceId, status: "staged" } }, async (tx, reused) => {
    if (reused) {
      const f = await tx.prisma.accountingBatch.findUnique({ where: { idempotencyKey: ik(data.idempotencyKey) } });
      if (!f) throw Error("Batch replay missing");
      return f.id;
    }
    const duplicate = await tx.prisma.accountingBatch.findFirst({ where: { rooftopId: source.rooftopId, sourceType, sourceId, status: { not: "failed" } } });
    if (duplicate) throw Error("Active accounting batch already exists for source");
    return (await tx.prisma.accountingBatch.create({ data: { rooftopId: source.rooftopId, sourceType, sourceId, status: "staged", providerKey, lines, totalDebitCents: debit, totalCreditCents: credit, idempotencyKey: ik(data.idempotencyKey) }, select: { id: true } })).id;
  });
  return c.db.AccountingBatch.findOne({ where: { id } });
}
async function manageAccountingBatch(_r, { data }, c) {
  auth(c);
  const batch = await c.query.AccountingBatch.findOne({ where: { id: String(data.batchId || "") }, query: "id status providerKey lines totalDebitCents totalCreditCents attemptCount externalReference lastErrorCode postedAt reconciledAt lockedAt rooftop { id }" });
  if (!batch?.rooftop?.id) throw Error("Batch inaccessible");
  await assertSessionRooftopPermission(c, batch.rooftop.id, "canManageDealerships");
  await assertSessionRooftopPermission(c, batch.rooftop.id, "canViewReports");
  const action = req(data.action, "Action", 30);
  if (!["queue-post", "record-posted", "record-failed", "reconcile", "lock"].includes(action)) throw Error("Invalid accounting action");
  let status = batch.status, attemptCount = batch.attemptCount, externalReference = batch.externalReference || "", lastErrorCode = batch.lastErrorCode || "", postedAt = batch.postedAt ? new Date(batch.postedAt) : null, reconciledAt = batch.reconciledAt ? new Date(batch.reconciledAt) : null, lockedAt = batch.lockedAt ? new Date(batch.lockedAt) : null;
  if (action === "queue-post") {
    if (!["staged", "failed"].includes(status)) throw Error("Only staged/failed batches can retry");
    status = "posting";
    attemptCount++;
    lastErrorCode = "";
  }
  if (action === "record-posted") {
    if (status !== "posting") throw Error("Posting batch required");
    externalReference = req(data.externalReference, "External reference", 200);
    status = "posted";
    lastErrorCode = "";
    postedAt = /* @__PURE__ */ new Date();
  }
  if (action === "record-failed") {
    if (status !== "posting") throw Error("Posting batch required");
    lastErrorCode = req(data.errorCode, "Error code", 100);
    status = "failed";
  }
  if (action === "reconcile") {
    if (status !== "posted") throw Error("Posted batch required");
    if (!req(data.reconciliationReference, "Reconciliation reference", 200)) throw Error("Reconciliation reference required");
    status = "reconciled";
    reconciledAt = /* @__PURE__ */ new Date();
  }
  if (action === "lock") {
    if (status !== "reconciled") throw Error("Reconciled batch required");
    status = "locked";
    lockedAt = /* @__PURE__ */ new Date();
  }
  const eventKey = `accounting-batch:${ik(data.idempotencyKey)}`, evidence = { batchId: batch.id, action, status, attemptCount, externalReference: externalReference || null, lastErrorCode: lastErrorCode || null, reconciliationReference: String(data.reconciliationReference || "").trim() || null, externalRequestSent: action === "queue-post" ? false : null };
  await ev(c, { eventKey, rooftopId: batch.rooftop.id, aggregateType: "AccountingBatch", aggregateId: batch.id, action, topic: "accounting.batch-updated", actorId: c.session.itemId, afterSnapshot: evidence, payload: { rooftopId: batch.rooftop.id, batchId: batch.id, status } }, async (tx, reused) => {
    if (reused) return;
    const changed = await tx.prisma.accountingBatch.updateMany({ where: { id: batch.id, status: batch.status }, data: { status, attemptCount, externalReference, lastErrorCode, postedAt, reconciledAt, lockedAt } });
    if (changed.count !== 1) throw Error("Accounting batch changed concurrently");
    if (["record-posted", "record-failed"].includes(action)) await tx.prisma.accountingProviderResponse.create({ data: { rooftopId: batch.rooftop.id, batchId: batch.id, providerKey: batch.providerKey, requestFingerprint: domainEventRequestHash({ lines: batch.lines, attemptCount }), responseCode: status, externalReference, immutableResponse: evidence, receivedAt: /* @__PURE__ */ new Date(), idempotencyKey: ik(data.idempotencyKey) } });
  });
  return c.db.AccountingBatch.findOne({ where: { id: batch.id } });
}

// features/keystone/mutations/accountingWorkspace.ts
async function accountingWorkspace(_root, { limit = 50 }, context) {
  if (!context.session?.itemId || !permissions.canViewReports({ session: context.session })) throw new Error("Reporting permission is required");
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [mappings, batches, payments, refunds] = await Promise.all([
    context.db.AccountingMapping.findMany({ orderBy: [{ updatedAt: "desc" }], take }),
    context.db.AccountingBatch.findMany({ orderBy: [{ updatedAt: "desc" }], take }),
    context.db.PaymentTransaction.findMany({ orderBy: [{ updatedAt: "desc" }], take }),
    context.db.PaymentRefund.findMany({ orderBy: [{ updatedAt: "desc" }], take })
  ]);
  return { mappings, batches, payments, refunds };
}

// features/keystone/mutations/paymentOperations.ts
var import_node_crypto11 = require("node:crypto");

// features/keystone/integrations/payments/providerRegistry.ts
var import_node_crypto10 = require("node:crypto");
function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
}
function assertPaymentsEnabled() {
  if (!paymentsEnabled()) throw new Error("Payments are disabled for this deployment");
}
function configured(name) {
  assertPaymentsEnabled();
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Payment provider is not configured: ${name}`);
  return value;
}
async function stripeRequest(path, body, idempotencyKey2) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configured("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey2
    },
    body,
    signal: AbortSignal.timeout(15e3)
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error("Payment provider request failed");
    error.code = String(payload?.error?.code || payload?.error?.type || `HTTP_${response.status}`).slice(0, 100);
    throw error;
  }
  return payload;
}
function signatureParts(header) {
  const values = /* @__PURE__ */ new Map();
  for (const part of header.split(",")) {
    const [key5, value] = part.trim().split("=", 2);
    if (!key5 || !value) continue;
    values.set(key5, [...values.get(key5) || [], value]);
  }
  return { timestamp: values.get("t")?.[0], signatures: values.get("v1") || [] };
}
var stripePaymentProvider = {
  key: "stripe",
  async createCheckout(request) {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": request.currency,
      "line_items[0][price_data][unit_amount]": String(request.amountCents),
      "line_items[0][price_data][product_data][name]": request.description,
      "metadata[openfront_transaction_id]": request.transactionId,
      "payment_intent_data[metadata][openfront_transaction_id]": request.transactionId
    });
    const payload = await stripeRequest("checkout/sessions", body, request.idempotencyKey);
    if (!payload.id || !payload.url) throw new Error("Payment provider returned incomplete checkout evidence");
    return { providerSessionId: String(payload.id), checkoutUrl: String(payload.url), providerTransactionId: payload.payment_intent ? String(payload.payment_intent) : void 0 };
  },
  async createRefund(input2) {
    const body = new URLSearchParams({
      payment_intent: input2.providerTransactionId,
      amount: String(input2.amountCents),
      reason: "requested_by_customer",
      "metadata[openfront_refund_id]": input2.refundId,
      "metadata[openfront_transaction_id]": input2.transactionId,
      "metadata[openfront_reason]": input2.reason.slice(0, 200)
    });
    const payload = await stripeRequest("refunds", body, input2.idempotencyKey);
    if (!payload.id || !payload.status) throw new Error("Payment provider returned incomplete refund evidence");
    return { providerRefundId: String(payload.id), status: String(payload.status) };
  },
  verifyWebhook(rawBody, signatureHeader, now = Date.now()) {
    const secret = configured("STRIPE_WEBHOOK_SECRET");
    const { timestamp: timestamp53, signatures } = signatureParts(signatureHeader);
    if (!timestamp53 || signatures.length === 0 || !/^\d+$/.test(timestamp53)) throw new Error("Invalid payment webhook signature");
    const ageSeconds = Math.abs(Math.floor(now / 1e3) - Number(timestamp53));
    if (ageSeconds > 300) throw new Error("Expired payment webhook signature");
    const expected = (0, import_node_crypto10.createHmac)("sha256", secret).update(`${timestamp53}.${rawBody}`).digest();
    const valid = signatures.some((value) => {
      if (!/^[a-f0-9]{64}$/i.test(value)) return false;
      return (0, import_node_crypto10.timingSafeEqual)(expected, Buffer.from(value, "hex"));
    });
    if (!valid) throw new Error("Invalid payment webhook signature");
    const event2 = JSON.parse(rawBody);
    const object = event2?.data?.object || {};
    const transactionId = String(object?.metadata?.openfront_transaction_id || "");
    if (!event2?.id || !event2?.type || !transactionId) throw new Error("Payment webhook is missing Openfront transaction evidence");
    return {
      id: String(event2.id),
      type: String(event2.type),
      createdAt: new Date(Number(event2.created || timestamp53) * 1e3),
      signatureTimestamp: new Date(Number(timestamp53) * 1e3),
      transactionId,
      providerTransactionId: object.payment_intent ? String(object.payment_intent) : object.object === "payment_intent" ? String(object.id) : void 0,
      providerSessionId: object.object === "checkout.session" ? String(object.id) : void 0,
      providerRefundId: object.object === "refund" ? String(object.id) : void 0,
      amountCents: Number(object.amount_received ?? object.amount_total ?? object.amount ?? 0) || void 0,
      providerStatus: object.payment_status ? String(object.payment_status) : object.status ? String(object.status) : void 0,
      rawDigest: (0, import_node_crypto10.createHash)("sha256").update(rawBody).digest("hex")
    };
  }
};
function getPaymentProvider(key5) {
  assertPaymentsEnabled();
  if (key5 !== stripePaymentProvider.key) throw new Error("Unsupported payment provider");
  return stripePaymentProvider;
}

// features/keystone/mutations/paymentOperations.ts
var required4 = (value, name, max = 500) => {
  const text75 = String(value || "").trim();
  if (!text75 || text75.length > max) throw new Error(`${name} is required`);
  return text75;
};
var positiveCents = (value, name) => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`${name} must be positive integer cents`);
  return amount;
};
function assertPaymentAdmin(context) {
  if (!context.session?.itemId || !permissions.canViewReports({ session: context.session }) || !permissions.canManageDealerships({ session: context.session })) {
    throw new Error("Payment administration permission is required");
  }
}
async function payableSource(context, sourceType, sourceId) {
  if (sourceType === "deal") {
    const deal = await context.sudo().prisma.deal.findUnique({ where: { id: sourceId }, include: { vehicle: { select: { year: true, make: true, model: true } } } });
    if (deal) {
      await assertSessionRooftopPermission(context, deal.rooftopId, "canViewReports");
      await assertSessionRooftopPermission(context, deal.rooftopId, "canManageDealerships");
    }
    const rooftop = deal ? await context.query.Rooftop.findOne({ where: { id: deal.rooftopId }, query: "id" }) : null;
    if (!deal || !rooftop?.id || !["approved", "financed", "delivered"].includes(deal.status)) throw new Error("Accessible approved deal source required");
    const total = calculateDealPrice(deal).cashPayableCents;
    return { rooftopId: rooftop.id, maximumCents: Math.max(0, total), description: `${deal.vehicle?.year || ""} ${deal.vehicle?.make || ""} ${deal.vehicle?.model || ""} deal payment`.trim(), relation: { dealId: deal.id } };
  }
  if (sourceType === "service") {
    const order2 = await context.sudo().prisma.serviceOrder.findUnique({ where: { id: sourceId } });
    if (order2) {
      await assertSessionRooftopPermission(context, order2.rooftopId, "canViewReports");
      await assertSessionRooftopPermission(context, order2.rooftopId, "canManageDealerships");
    }
    const rooftop = order2 ? await context.query.Rooftop.findOne({ where: { id: order2.rooftopId }, query: "id" }) : null;
    if (!order2 || !rooftop?.id || !["invoiced", "paid"].includes(order2.status)) throw new Error("Accessible invoiced service-order source required");
    return { rooftopId: rooftop.id, maximumCents: Number(order2.grandTotalCents || 0), description: `Service invoice ${order2.invoiceNumber || order2.id}`, relation: { serviceOrderId: order2.id } };
  }
  throw new Error("Unsupported payment source");
}
async function createPaymentCheckout(_root, { data }, context) {
  assertPaymentAdmin(context);
  const sourceType = required4(data.sourceType, "Source type", 20);
  const sourceId = required4(data.sourceId, "Source ID", 100);
  const providerKey = required4(data.providerKey, "Provider", 50);
  const idempotencyKey2 = required4(data.idempotencyKey, "Idempotency key", 200);
  const amountCents = positiveCents(data.amountCents, "Amount");
  const source = await payableSource(context, sourceType, sourceId);
  const provider = getPaymentProvider(providerKey);
  const eventKey = `payment-checkout:${idempotencyKey2}`;
  const transactionId = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${source.rooftopId}:${sourceType}:${sourceId}`}, 0))`;
    const existing = await tx.prisma.paymentTransaction.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: source.rooftopId, aggregateType: "PaymentTransaction", aggregateId: sourceId, action: "checkout-requested", topic: "payment.checkout-requested", actorId: context.session.itemId, afterSnapshot: { sourceType, sourceId, amountCents, currency: "usd", providerKey }, payload: { rooftopId: source.rooftopId, sourceType, sourceId, amountCents, providerKey } });
    if (existing) {
      if (existing.sourceType !== sourceType || existing.amountCents !== amountCents || existing.providerKey !== providerKey || existing.dealId !== (source.relation.dealId || null) || existing.serviceOrderId !== (source.relation.serviceOrderId || null)) throw new Error("Payment idempotency key was reused with different evidence");
      return existing.id;
    }
    const captured = await tx.prisma.paymentTransaction.aggregate({ where: { rooftopId: source.rooftopId, sourceType, ...source.relation, status: { in: ["creating", "pending", "authorized", "captured", "partially-refunded", "refunded"] } }, _sum: { amountCents: true, refundedCents: true } });
    const reservedBalance = Number(captured._sum.amountCents || 0) - Number(captured._sum.refundedCents || 0);
    if (amountCents > source.maximumCents - reservedBalance) throw new Error("Payment exceeds the remaining source balance");
    return (await tx.prisma.paymentTransaction.create({ data: { rooftopId: source.rooftopId, ...source.relation, sourceType, amountCents, currency: "usd", providerKey, status: "creating", idempotencyKey: idempotencyKey2 }, select: { id: true } })).id;
  }, { timeout: 3e4 });
  const current = await context.sudo().prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
  if (current.checkoutUrl && current.providerSessionId) return context.db.PaymentTransaction.findOne({ where: { id: transactionId } });
  try {
    const origin = required4(process.env.NEXT_PUBLIC_SITE_URL || process.env.PORTLESS_URL, "Public site URL", 500).replace(/\/$/, "");
    const response = await provider.createCheckout({ transactionId, amountCents, currency: "usd", description: source.description, idempotencyKey: idempotencyKey2, successUrl: `${origin}/dashboard/platform/analytics?payment=success`, cancelUrl: `${origin}/dashboard/platform/analytics?payment=cancelled` });
    await context.sudo().prisma.paymentTransaction.update({ where: { id: transactionId }, data: { status: "pending", ...response, version: { increment: 1 } } });
  } catch (error) {
    await context.sudo().prisma.paymentTransaction.update({ where: { id: transactionId }, data: { status: "failed", failureCode: String(error?.code || error?.message || "PROVIDER_ERROR").slice(0, 100), version: { increment: 1 } } });
    throw error;
  }
  return context.db.PaymentTransaction.findOne({ where: { id: transactionId } });
}
async function requestPaymentRefund(_root, { data }, context) {
  assertPaymentAdmin(context);
  const transactionId = required4(data.transactionId, "Transaction ID", 100);
  const idempotencyKey2 = required4(data.idempotencyKey, "Idempotency key", 200);
  const amountCents = positiveCents(data.amountCents, "Refund amount");
  const reason = required4(data.reason, "Refund reason", 500);
  const transaction = await context.query.PaymentTransaction.findOne({ where: { id: transactionId }, query: "id status amountCents capturedCents refundedCents providerKey providerTransactionId rooftop { id }" });
  if (!transaction?.rooftop?.id || !["captured", "partially-refunded"].includes(transaction.status) || !transaction.providerTransactionId) throw new Error("Captured payment transaction required");
  await assertSessionRooftopPermission(context, transaction.rooftop.id, "canViewReports");
  await assertSessionRooftopPermission(context, transaction.rooftop.id, "canManageDealerships");
  const provider = getPaymentProvider(transaction.providerKey);
  const refundId = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment-refund:${transactionId}`}, 0))`;
    const existing2 = await tx.prisma.paymentRefund.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
    await recordDomainEventInTransaction(tx, { eventKey: `payment-refund:${idempotencyKey2}`, rooftopId: transaction.rooftop.id, aggregateType: "PaymentRefund", aggregateId: transactionId, action: "requested", topic: "payment.refund-requested", actorId: context.session.itemId, afterSnapshot: { transactionId, amountCents, reason }, payload: { rooftopId: transaction.rooftop.id, transactionId, amountCents } });
    if (existing2) {
      if (existing2.transactionId !== transactionId || existing2.amountCents !== amountCents || existing2.reason !== reason) throw new Error("Refund idempotency key was reused with different evidence");
      return existing2.id;
    }
    const reserved = await tx.prisma.paymentRefund.aggregate({ where: { transactionId, status: { in: ["creating", "pending", "succeeded"] } }, _sum: { amountCents: true } });
    if (amountCents > transaction.capturedCents - Number(reserved._sum.amountCents || 0)) throw new Error("Refund exceeds remaining captured amount");
    return (await tx.prisma.paymentRefund.create({ data: { rooftopId: transaction.rooftop.id, transactionId, amountCents, reason, status: "creating", idempotencyKey: idempotencyKey2 }, select: { id: true } })).id;
  }, { timeout: 3e4 });
  const existing = await context.sudo().prisma.paymentRefund.findUnique({ where: { id: refundId } });
  if (!existing.providerRefundId) {
    try {
      const result2 = await provider.createRefund({ providerTransactionId: transaction.providerTransactionId, amountCents, reason, idempotencyKey: idempotencyKey2, refundId, transactionId });
      await context.sudo().prisma.paymentRefund.update({ where: { id: refundId }, data: { providerRefundId: result2.providerRefundId, status: result2.status === "succeeded" ? "succeeded" : "pending" } });
    } catch (error) {
      await context.sudo().prisma.paymentRefund.update({ where: { id: refundId }, data: { status: "failed", failureCode: String(error?.code || error?.message || "PROVIDER_ERROR").slice(0, 100) } });
      throw error;
    }
  }
  return context.db.PaymentRefund.findOne({ where: { id: refundId } });
}
async function reconcilePaymentTransaction(_root, { data }, context) {
  assertPaymentAdmin(context);
  const transactionId = required4(data.transactionId, "Transaction ID", 100);
  const reference2 = required4(data.reconciliationReference, "Reconciliation reference", 200);
  const idempotencyKey2 = required4(data.idempotencyKey, "Idempotency key", 200);
  return context.transaction(async (tx) => {
    const session = tx.withSession(context.session);
    const transaction = await session.query.PaymentTransaction.findOne({ where: { id: transactionId }, query: "id status reconciliationReference rooftop { id }" });
    if (!transaction?.rooftop?.id || !["captured", "partially-refunded", "refunded"].includes(transaction.status)) throw new Error("Settled payment required for reconciliation");
    await assertSessionRooftopPermission(context, transaction.rooftop.id, "canViewReports");
    await assertSessionRooftopPermission(context, transaction.rooftop.id, "canManageDealerships");
    await recordDomainEventInTransaction(tx, { eventKey: `payment-reconcile:${idempotencyKey2}`, rooftopId: transaction.rooftop.id, aggregateType: "PaymentTransaction", aggregateId: transactionId, action: "reconciled", topic: "payment.reconciled", actorId: context.session.itemId, afterSnapshot: { transactionId, reference: reference2 }, payload: { rooftopId: transaction.rooftop.id, transactionId, reference: reference2 } });
    if (transaction.reconciliationReference && transaction.reconciliationReference !== reference2) throw new Error("Payment is already reconciled with different evidence");
    await tx.prisma.paymentTransaction.updateMany({ where: { id: transactionId, reconciliationReference: "" }, data: { reconciliationReference: reference2, reconciledAt: /* @__PURE__ */ new Date(), version: { increment: 1 } } });
    return session.db.PaymentTransaction.findOne({ where: { id: transactionId } });
  }, { timeout: 3e4 });
}

// features/keystone/mutations/reportingOperations.ts
var import_node_crypto12 = require("node:crypto");
var required5 = (value, name, max = 500) => {
  const text75 = String(value || "").trim();
  if (!text75 || text75.length > max) throw new Error(`${name} is required`);
  return text75;
};
function canReport(context) {
  if (!context.session?.itemId || !permissions.canViewReports({ session: context.session })) throw new Error("Reporting permission is required");
}
function canAdmin(context) {
  canReport(context);
  if (!permissions.canManageDealerships({ session: context.session })) throw new Error("Dealership administration permission is required");
}
async function accessibleRooftops(context) {
  return context.query.Rooftop.findMany({
    where: rooftopPermissionAccessFilter(context.session, "canViewReports"),
    take: 100,
    query: "id name"
  });
}
var grouped = (items, key5) => Object.entries(items.reduce((result2, item) => {
  const value = String(item[key5] || "unknown");
  result2[value] = (result2[value] || 0) + 1;
  return result2;
}, {})).map(([label, count]) => ({ label, count }));
function periodMetric(current, previous) {
  const direction = current === previous ? "neutral" : current > previous ? "up" : "down";
  const percentChange = previous === 0 ? null : Math.round((current - previous) / previous * 1e4) / 100;
  return { current, previous, direction, percentChange };
}
async function operationalReport(_root, args, context) {
  canReport(context);
  const accessible = await accessibleRooftops(context);
  const rooftops = args?.rooftopId ? accessible.filter((item) => item.id === args.rooftopId) : accessible;
  if (args?.rooftopId && rooftops.length !== 1) throw new Error("Report rooftop inaccessible");
  const rooftopIds = rooftops.map((item) => item.id);
  const where = { rooftopId: { in: rooftopIds } };
  const prisma = context.sudo().prisma;
  const reportNow = /* @__PURE__ */ new Date();
  const currentStart = new Date(reportNow.getTime() - 30 * 864e5);
  const previousStart = new Date(reportNow.getTime() - 60 * 864e5);
  const todayStart = new Date(reportNow);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 864e5);
  const [leads, deals, stocks, menus, labor, parts, serviceOrders, todayServiceAppointments, todayTestDrives, accountingExceptions, paymentExceptions, fundingExceptions] = await Promise.all([
    prisma.lead.findMany({ where, select: { status: true, createdAt: true } }),
    prisma.deal.findMany({ where, select: { id: true, status: true, vehiclePriceCents: true, grossCents: true, saleDate: true, createdAt: true, salesperson: { select: { id: true, name: true } }, vehicle: { select: { year: true, make: true, model: true } }, lead: { select: { firstName: true, lastName: true } } } }),
    prisma.inventoryStock.findMany({ where, select: { stockedAt: true, totalCostCents: true, vehicle: { select: { status: true, priceCents: true } } } }),
    prisma.financeMenuVersion.findMany({ where: { ...where, status: "accepted" }, select: { dealId: true, selectedProductCodes: true } }),
    prisma.serviceLaborOperation.findMany({ where, select: { soldHours: true, actualMinutes: true, status: true } }),
    prisma.partsInventory.findMany({ where, select: { quantity: true, committedQuantity: true, onOrderQuantity: true, minimumQuantity: true, updatedAt: true } }),
    prisma.serviceOrder.findMany({ where, select: { status: true, laborTotalCents: true, grandTotalCents: true, settledAt: true } }),
    prisma.serviceAppointment.count({ where: { ...where, appointmentDate: { gte: todayStart, lt: tomorrowStart }, status: { not: "cancelled" } } }),
    prisma.testDrive.count({ where: { ...where, scheduledTime: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.accountingBatch.count({ where: { ...where, status: { in: ["failed", "posting"] } } }),
    prisma.paymentTransaction.count({ where: { ...where, status: { in: ["creating", "failed"] } } }),
    prisma.financeFundingCase.count({ where: { ...where, status: "exception" } })
  ]);
  const delivered = deals.filter((item) => item.status === "delivered" && item.saleDate);
  const currentDelivered = delivered.filter((item) => new Date(item.saleDate).getTime() >= currentStart.getTime());
  const previousDelivered = delivered.filter((item) => {
    const value = new Date(item.saleDate).getTime();
    return value >= previousStart.getTime() && value < currentStart.getTime();
  });
  const currentLeads = leads.filter((item) => new Date(item.createdAt).getTime() >= currentStart.getTime());
  const previousLeads = leads.filter((item) => {
    const value = new Date(item.createdAt).getTime();
    return value >= previousStart.getTime() && value < currentStart.getTime();
  });
  const settledService = serviceOrders.filter((item) => item.status === "paid" && item.settledAt);
  const currentService = settledService.filter((item) => new Date(item.settledAt).getTime() >= currentStart.getTime());
  const previousService = settledService.filter((item) => {
    const value = new Date(item.settledAt).getTime();
    return value >= previousStart.getTime() && value < currentStart.getTime();
  });
  const now = reportNow.getTime();
  const availableStocks = stocks.filter((item) => item.vehicle?.status === "available");
  const soldHours = labor.filter((item) => item.status === "completed").reduce((total, item) => total + Number(item.soldHours || 0), 0);
  const laborRevenue = serviceOrders.reduce((total, item) => total + Number(item.laborTotalCents || 0), 0);
  const acceptedDealsWithProducts = new Set(menus.filter((menu) => Array.isArray(menu.selectedProductCodes) && menu.selectedProductCodes.length > 0).map((menu) => menu.dealId));
  const deliveredByMonth = Object.values(delivered.reduce((result2, item) => {
    const month = new Date(item.saleDate).toISOString().slice(0, 7);
    result2[month] ||= { month, revenueCents: 0, grossCents: 0, count: 0 };
    result2[month].revenueCents += Number(item.vehiclePriceCents || 0);
    result2[month].grossCents += Number(item.grossCents || 0);
    result2[month].count += 1;
    return result2;
  }, {})).sort((left, right) => left.month.localeCompare(right.month)).slice(-12);
  const topSalespeople = Object.values(delivered.reduce((result2, item) => {
    const id = String(item.salesperson?.id || "unassigned");
    result2[id] ||= { id, name: item.salesperson?.name || "Unassigned", deals: 0, revenueCents: 0, grossCents: 0 };
    result2[id].deals += 1;
    result2[id].revenueCents += Number(item.vehiclePriceCents || 0);
    result2[id].grossCents += Number(item.grossCents || 0);
    return result2;
  }, {})).sort((left, right) => right.grossCents - left.grossCents).slice(0, 5);
  const metrics = {
    rooftopCount: rooftops.length,
    period: { generatedAt: reportNow.toISOString(), currentStart: currentStart.toISOString(), previousStart: previousStart.toISOString(), days: 30 },
    periodComparison: {
      deliveredCount: periodMetric(currentDelivered.length, previousDelivered.length),
      deliveredRevenueCents: periodMetric(currentDelivered.reduce((total, item) => total + Number(item.vehiclePriceCents || 0), 0), previousDelivered.reduce((total, item) => total + Number(item.vehiclePriceCents || 0), 0)),
      deliveredGrossCents: periodMetric(currentDelivered.reduce((total, item) => total + Number(item.grossCents || 0), 0), previousDelivered.reduce((total, item) => total + Number(item.grossCents || 0), 0)),
      newLeads: periodMetric(currentLeads.length, previousLeads.length),
      settledServiceRevenueCents: periodMetric(currentService.reduce((total, item) => total + Number(item.grandTotalCents || 0), 0), previousService.reduce((total, item) => total + Number(item.grandTotalCents || 0), 0))
    },
    salesFunnel: grouped(leads, "status"),
    totalLeads: leads.length,
    leadConversionPercent: leads.length ? Math.round(leads.filter((item) => item.status === "closed-won").length / leads.length * 1e4) / 100 : 0,
    pendingDeals: deals.filter((item) => ["pencil", "submitted"].includes(item.status)).length,
    todayAppointments: todayServiceAppointments + todayTestDrives,
    deliveredDeals: delivered.length,
    deliveredRevenueCents: delivered.reduce((total, item) => total + Number(item.vehiclePriceCents || 0), 0),
    deliveredGrossCents: delivered.reduce((total, item) => total + Number(item.grossCents || 0), 0),
    averageDeliveredGrossCents: delivered.length ? Math.round(delivered.reduce((total, item) => total + Number(item.grossCents || 0), 0) / delivered.length) : 0,
    deliveredByMonth,
    topSalespeople,
    recentDeals: [...deals].sort((left, right) => new Date(right.saleDate || right.createdAt).getTime() - new Date(left.saleDate || left.createdAt).getTime()).slice(0, 5).map((item) => ({ id: item.id, status: item.status, vehiclePriceCents: item.vehiclePriceCents, grossCents: item.grossCents, occurredAt: item.saleDate || item.createdAt, vehicle: item.vehicle, lead: item.lead })),
    financeProductPenetrationPercent: delivered.length ? Math.round(acceptedDealsWithProducts.size / delivered.length * 1e4) / 100 : 0,
    inventory: { available: availableStocks.length, averageAgeDays: availableStocks.length ? Math.round(availableStocks.reduce((total, item) => total + Math.max(0, (now - new Date(item.stockedAt).getTime()) / 864e5), 0) / availableStocks.length) : 0, retailCents: availableStocks.reduce((total, item) => total + Number(item.vehicle?.priceCents || 0), 0), costCents: availableStocks.reduce((total, item) => total + Number(item.totalCostCents || 0), 0) },
    service: { soldHours, actualHours: Math.round(labor.reduce((total, item) => total + Number(item.actualMinutes || 0), 0) / 60 * 100) / 100, effectiveLaborRateCents: soldHours ? Math.round(laborRevenue / soldHours) : 0, ordersByStatus: grouped(serviceOrders, "status") },
    parts: { lowStockCount: parts.filter((item) => item.quantity - item.committedQuantity <= Number(item.minimumQuantity || 0)).length, fillRatePercent: parts.reduce((total, item) => total + item.committedQuantity, 0) ? Math.round(parts.reduce((total, item) => total + Math.min(item.quantity, item.committedQuantity), 0) / parts.reduce((total, item) => total + item.committedQuantity, 0) * 1e4) / 100 : 100, obsoleteCount: parts.filter((item) => item.quantity > 0 && now - new Date(item.updatedAt).getTime() > 180 * 864e5).length }
  };
  return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), metrics, exceptions: { accounting: accountingExceptions, payments: paymentExceptions, funding: fundingExceptions, total: accountingExceptions + paymentExceptions + fundingExceptions } };
}
function nextRun(schedule, from = /* @__PURE__ */ new Date()) {
  const next = new Date(from);
  if (schedule === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (schedule === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (schedule === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else return null;
  return next;
}
async function saveOperationalReport(_root, { data }, context) {
  canReport(context);
  const rooftopId = required5(data.rooftopId, "Rooftop ID", 100), idempotencyKey2 = required5(data.idempotencyKey, "Idempotency key", 200);
  await assertSessionRooftopPermission(context, rooftopId, "canViewReports");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
  if (!rooftop) throw new Error("Rooftop inaccessible");
  const reportType = required5(data.reportType, "Report type", 50), exportFormat = required5(data.exportFormat, "Export format", 10), schedule = required5(data.schedule, "Schedule", 20), filters = data.filters && typeof data.filters === "object" && !Array.isArray(data.filters) ? data.filters : {};
  if (Object.keys(filters).length) throw new Error("Saved report filters are not supported yet");
  if (!["operations", "audit", "accounting-exceptions", "payment-reconciliation"].includes(reportType) || !["json", "csv"].includes(exportFormat) || !["manual", "daily", "weekly", "monthly"].includes(schedule)) throw new Error("Unsupported report configuration");
  const eventKey = `saved-report:${idempotencyKey2}`;
  const id = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`;
    const existing = await tx.prisma.savedReport.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "SavedReport", aggregateId: rooftopId, action: "configured", topic: "report.saved", actorId: context.session.itemId, afterSnapshot: { name: required5(data.name, "Name", 100), reportType, filters, exportFormat, schedule }, payload: { rooftopId, reportType, schedule } });
    if (existing) return existing.id;
    return (await tx.prisma.savedReport.create({ data: { rooftopId, ownerId: context.session.itemId, name: required5(data.name, "Name", 100), reportType, filters, exportFormat, schedule, active: true, nextRunAt: nextRun(schedule), idempotencyKey: idempotencyKey2 }, select: { id: true } })).id;
  });
  return context.db.SavedReport.findOne({ where: { id } });
}
async function savedReportPayload(saved, context) {
  const rooftopId = saved.rooftop.id, prisma = context.sudo().prisma;
  if (saved.reportType === "operations") return operationalReport(null, { rooftopId }, context);
  if (saved.reportType === "audit") return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), events: await prisma.domainAuditEvent.findMany({ where: { rooftopId }, orderBy: { occurredAt: "desc" }, take: 1e3, select: { eventKey: true, aggregateType: true, aggregateId: true, action: true, occurredAt: true, actorId: true } }) };
  if (saved.reportType === "accounting-exceptions") return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), batches: await prisma.accountingBatch.findMany({ where: { rooftopId, status: { in: ["failed", "posting"] } }, orderBy: { updatedAt: "desc" }, take: 1e3, select: { id: true, sourceType: true, sourceId: true, status: true, attemptCount: true, lastErrorCode: true, updatedAt: true } }) };
  if (saved.reportType === "payment-reconciliation") return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), payments: await prisma.paymentTransaction.findMany({ where: { rooftopId }, orderBy: { updatedAt: "desc" }, take: 1e3, select: { id: true, sourceType: true, amountCents: true, capturedCents: true, refundedCents: true, status: true, providerKey: true, reconciliationReference: true, reconciledAt: true, updatedAt: true } }) };
  throw new Error("Unsupported saved report type");
}
function reportCsv(value) {
  const rows = [];
  const visit2 = (current, path) => {
    if (current === null || current === void 0 || typeof current !== "object") {
      rows.push([path, String(current ?? "")]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit2(item, `${path}[${index}]`));
      return;
    }
    for (const [key5, item] of Object.entries(current)) visit2(item, path ? `${path}.${key5}` : key5);
  };
  visit2(value, "");
  const quote = (text75) => `"${text75.replaceAll('"', '""')}"`;
  return ["path,value", ...rows.map(([path, value2]) => `${quote(path)},${quote(value2)}`)].join("\n");
}
async function runSavedReport(_root, { data }, context) {
  canReport(context);
  const reportId = required5(data.reportId, "Report ID", 100), idempotencyKey2 = required5(data.idempotencyKey, "Idempotency key", 200);
  const saved = await context.query.SavedReport.findOne({ where: { id: reportId }, query: "id name reportType exportFormat schedule nextRunAt rooftop { id }" });
  if (!saved?.rooftop?.id) throw new Error("Saved report inaccessible");
  await assertSessionRooftopPermission(context, saved.rooftop.id, "canViewReports");
  const priorRun = await context.sudo().prisma.reportRun.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
  if (priorRun) {
    if (priorRun.savedReportId !== saved.id) throw new Error("Report-run idempotency key belongs to another report");
    return context.db.ReportRun.findOne({ where: { id: priorRun.id } });
  }
  const report = await savedReportPayload(saved, context);
  const exportPayload = saved.exportFormat === "csv" ? { contentType: "text/csv", content: reportCsv(report) } : report;
  const snapshot2 = { schema: "openfront.report.v1", reportType: saved.reportType, exportFormat: saved.exportFormat, report: exportPayload };
  const digest = (0, import_node_crypto12.createHash)("sha256").update(JSON.stringify(snapshot2)).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 864e5);
  const id = await context.transaction(async (tx) => {
    const eventKey = `report-run:${idempotencyKey2}`;
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`;
    const existing = await tx.prisma.reportRun.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: saved.rooftop.id, aggregateType: "ReportRun", aggregateId: saved.id, action: "completed", topic: "report.completed", actorId: context.session.itemId, afterSnapshot: { reportId: saved.id, digest, exportFormat: saved.exportFormat, expiresAt }, payload: { rooftopId: saved.rooftop.id, reportId: saved.id, digest } });
    if (existing) return existing.id;
    const run = await tx.prisma.reportRun.create({ data: { rooftopId: saved.rooftop.id, savedReportId: saved.id, status: "completed", exportFormat: saved.exportFormat, resultSnapshot: snapshot2, resultDigest: digest, completedAt: /* @__PURE__ */ new Date(), expiresAt, idempotencyKey: idempotencyKey2 }, select: { id: true } });
    if (saved.schedule !== "manual") await tx.prisma.savedReport.update({ where: { id: saved.id }, data: { nextRunAt: nextRun(saved.schedule) } });
    return run.id;
  });
  return context.db.ReportRun.findOne({ where: { id } });
}
async function queueDueSavedReports(_root, _args, context) {
  canAdmin(context);
  const rooftops = await accessibleRooftops(context), rooftopIds = rooftops.map((item) => item.id), now = /* @__PURE__ */ new Date();
  const due = await context.sudo().prisma.savedReport.findMany({ where: { rooftopId: { in: rooftopIds }, active: true, schedule: { not: "manual" }, nextRunAt: { lte: now } }, take: 100 });
  const queuedIds = [];
  for (const saved of due) {
    await assertSessionRooftopPermission(context, saved.rooftopId, "canManageDealerships");
    await assertSessionRooftopPermission(context, saved.rooftopId, "canViewReports");
    const scheduledFor = saved.nextRunAt || now, idempotencyKey2 = `scheduled:${saved.id}:${scheduledFor.toISOString()}`;
    const runId = await context.transaction(async (tx) => {
      await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey2}, 0))`;
      const existing = await tx.prisma.reportRun.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
      await recordDomainEventInTransaction(tx, { eventKey: `report-scheduled:${idempotencyKey2}`, rooftopId: saved.rooftopId, aggregateType: "ReportRun", aggregateId: saved.id, action: "queued", topic: "report.run-requested", actorId: context.session.itemId, afterSnapshot: { reportId: saved.id, scheduledFor, exportFormat: saved.exportFormat }, payload: { rooftopId: saved.rooftopId, reportId: saved.id, scheduledFor } });
      if (existing) return existing.id;
      const run = await tx.prisma.reportRun.create({ data: { rooftopId: saved.rooftopId, savedReportId: saved.id, status: "queued", exportFormat: saved.exportFormat, idempotencyKey: idempotencyKey2 }, select: { id: true } });
      await tx.prisma.savedReport.update({ where: { id: saved.id }, data: { nextRunAt: nextRun(saved.schedule, scheduledFor) } });
      return run.id;
    });
    queuedIds.push(runId);
  }
  return { queuedCount: queuedIds.length, runIds: queuedIds };
}
var minimumDays = { "customer-intake": 730, "report-export": 1, "provider-payload": 365, "audit-evidence": 2555 };
async function configureRetentionPolicy(_root, { data }, context) {
  canAdmin(context);
  const rooftopId = required5(data.rooftopId, "Rooftop ID", 100), category = required5(data.category, "Category", 50), idempotencyKey2 = required5(data.idempotencyKey, "Idempotency key", 200);
  await assertSessionRooftopPermission(context, rooftopId, "canManageDealerships");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
  if (!rooftop) throw new Error("Rooftop inaccessible");
  const retentionDays = Number(data.retentionDays);
  if (!Number.isSafeInteger(retentionDays) || retentionDays < (minimumDays[category] || 1)) throw new Error(`Retention must be at least ${minimumDays[category] || 1} days for ${category}`);
  const evidence = { category, retentionDays, legalHold: data.legalHold === true, rationale: required5(data.rationale, "Rationale", 500) };
  const id = await context.transaction(async (tx) => {
    const eventKey = `retention-policy:${idempotencyKey2}`;
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`retention-policy:${rooftopId}:${category}`}, 0))`;
    const existing = await tx.prisma.retentionPolicy.findFirst({ where: { rooftopId, category } });
    const recorded = await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "RetentionPolicy", aggregateId: `${rooftopId}:${category}`, action: "configured", topic: "retention.configured", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId, ...evidence } });
    if (recorded.reused) {
      if (!existing) throw new Error("Retention-policy replay evidence is missing");
      return existing.id;
    }
    if (existing) {
      await tx.prisma.retentionPolicy.update({ where: { id: existing.id }, data: { ...evidence, idempotencyKey: idempotencyKey2 } });
      return existing.id;
    }
    return (await tx.prisma.retentionPolicy.create({ data: { rooftopId, ...evidence, idempotencyKey: idempotencyKey2 }, select: { id: true } })).id;
  });
  return context.db.RetentionPolicy.findOne({ where: { id } });
}
async function sweepExpiredReportExports(_root, { data }, context) {
  canAdmin(context);
  const rooftopId = required5(data.rooftopId, "Rooftop ID", 100), idempotencyKey2 = required5(data.idempotencyKey, "Idempotency key", 200), dryRun = data.dryRun !== false;
  await assertSessionRooftopPermission(context, rooftopId, "canManageDealerships");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
  if (!rooftop) throw new Error("Rooftop inaccessible");
  return context.transaction(async (tx) => {
    const eventKey = `retention-sweep:${idempotencyKey2}`;
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`;
    const policy = await tx.prisma.retentionPolicy.findFirst({ where: { rooftopId, category: "report-export" } });
    if (!policy || policy.legalHold) throw new Error("Active report-export retention policy without legal hold is required");
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true } });
    if (replay) {
      const snapshot2 = replay.afterSnapshot;
      if (replay.aggregateId !== policy.id || snapshot2?.dryRun !== dryRun) throw new Error("Retention-sweep idempotency key was reused with different evidence");
      return { rooftopId, dryRun, expiredCount: Number(snapshot2?.expiredCount || 0) };
    }
    const expired = await tx.prisma.reportRun.findMany({ where: { rooftopId, status: "completed", expiresAt: { lt: /* @__PURE__ */ new Date() } }, select: { id: true } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: "RetentionPolicy", aggregateId: policy.id, action: dryRun ? "dry-run" : "swept", topic: "retention.sweep", actorId: context.session.itemId, afterSnapshot: { category: "report-export", dryRun, expiredCount: expired.length }, payload: { rooftopId, dryRun, expiredCount: expired.length } });
    if (!dryRun && expired.length) await tx.prisma.reportRun.updateMany({ where: { id: { in: expired.map((item) => item.id) } }, data: { status: "expired", resultSnapshot: {}, errorCode: "RETENTION_EXPIRED" } });
    await tx.prisma.retentionPolicy.update({ where: { id: policy.id }, data: { lastSweptAt: /* @__PURE__ */ new Date() } });
    return { rooftopId, dryRun, expiredCount: expired.length };
  });
}
async function auditSearch(_root, { aggregateType, aggregateId, action, limit = 50 }, context) {
  canReport(context);
  const rooftops = await accessibleRooftops(context), rooftopIds = rooftops.map((item) => item.id);
  return context.sudo().prisma.domainAuditEvent.findMany({ where: { rooftopId: { in: rooftopIds }, ...aggregateType ? { aggregateType: String(aggregateType) } : {}, ...aggregateId ? { aggregateId: String(aggregateId) } : {}, ...action ? { action: { contains: String(action), mode: "insensitive" } } : {} }, orderBy: { occurredAt: "desc" }, take: Math.min(Math.max(Number(limit) || 50, 1), 100) });
}

// features/keystone/mutations/fixedOpsOperations.ts
var req2 = (v, n, max = 1e3) => {
  const s = String(v || "").trim();
  if (!s || s.length > max) throw new Error(`${n} is required`);
  return s;
};
var key3 = (v) => req2(v, "Idempotency key", 200);
async function order(context, id) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service management permission is required");
  const value = await context.query.ServiceOrder.findOne({ where: { id: String(id || "") }, query: "id status updatedAt rooftop { id } appointment { id lead { id } }" });
  if (!value?.rooftop?.id) throw new Error("Service order not found or accessible");
  await assertSessionRooftopPermission(context, value.rooftop.id, "canManageService");
  return value;
}
async function event(context, e, write) {
  return context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${e.eventKey},0))`;
    const r = await recordDomainEventInTransaction(tx, e);
    return write(tx, r.reused);
  }, { timeout: 3e4 });
}
async function recordServiceOrderEvidence(_r, { data }, context) {
  const o = await order(context, data.serviceOrderId);
  if (!["estimate", "approved", "in-progress"].includes(o.status)) throw new Error("Service evidence is locked");
  const concern = req2(data.concern, "Concern"), cause = req2(data.cause, "Cause"), correction = req2(data.correction, "Correction"), payType = req2(data.payType, "Pay type", 30), authorizationStatus = req2(data.authorizationStatus, "Authorization status", 30);
  if (!["customer", "warranty", "internal"].includes(payType) || !["pending", "authorized", "declined"].includes(authorizationStatus)) throw new Error("Invalid service evidence");
  const authorizationEvidence = data.authorizationEvidence || {};
  if (authorizationStatus !== "pending" && !req2(authorizationEvidence.reference, "Authorization reference", 200)) throw new Error("Authorization evidence is required");
  const inspection = Array.isArray(data.inspectionEvidence) ? data.inspectionEvidence.slice(0, 100) : [], declinedWork = Array.isArray(data.declinedWork) ? data.declinedWork.slice(0, 100) : [];
  const expected = commandDate(data.expectedUpdatedAt);
  const eventKey = `service-evidence:${key3(data.idempotencyKey)}`, evidence = { serviceOrderId: o.id, concern, cause, correction, payType, authorizationStatus, authorizationEvidence, inspection, declinedWork, invoiceNumber: String(data.invoiceNumber || "").trim() || null, expectedUpdatedAt: expected.toISOString() };
  await event(context, { eventKey, rooftopId: o.rooftop.id, aggregateType: "ServiceOrder", aggregateId: o.id, action: "evidence-recorded", topic: "service-order.evidence-recorded", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: o.rooftop.id, serviceOrderId: o.id, authorizationStatus } }, async (tx, reused) => {
    if (reused) return;
    const changed = await tx.prisma.serviceOrder.updateMany({ where: { id: o.id, updatedAt: expected, status: { in: ["estimate", "approved", "in-progress"] } }, data: { concern, cause, correction, payType, authorizationStatus, authorizationEvidence, inspectionEvidence: inspection, declinedWork, invoiceNumber: String(data.invoiceNumber || "").trim() } });
    if (changed.count !== 1) throw new Error("Service order changed concurrently");
  });
  return context.db.ServiceOrder.findOne({ where: { id: o.id } });
}
async function manageLaborOperation(_root, { data }, context) {
  const serviceOrderId = req2(data.serviceOrderId, "Service order", 100);
  const action = req2(data.action, "Labor action", 30);
  if (!["create", "dispatch", "start", "pause", "complete", "cancel"].includes(action)) throw new Error("Invalid labor action");
  const request = { serviceOrderId, action, operationId: action === "create" ? null : req2(data.operationId, "Labor operation", 100) };
  if (action === "create") {
    request.operationCode = req2(data.operationCode, "Operation code", 80);
    request.description = req2(data.description, "Description");
    request.soldHours = Number(data.soldHours);
    if (!Number.isFinite(request.soldHours) || request.soldHours < 0) throw new Error("Sold hours are invalid");
  }
  if (action === "dispatch") request.technicianId = req2(data.technicianId, "Technician", 100);
  if (action === "complete") {
    request.actualMinutes = Number(data.actualMinutes);
    if (!Number.isInteger(request.actualMinutes) || request.actualMinutes < 0) throw new Error("Actual minutes are required");
  }
  const eventKey = `labor-operation:${key3(data.idempotencyKey)}`;
  return context.transaction(async (tx) => {
    await lockServiceOrder(tx, serviceOrderId);
    const authority = await currentServiceOrderAuthority(tx, context.session, serviceOrderId);
    const scoped = authority.context;
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
    if (prior) {
      if (prior.actorId !== context.session.itemId || prior.rooftopId !== authority.rooftopId || prior.afterSnapshot?.version !== 2 || stableJson(prior.afterSnapshot.request) !== stableJson(request)) throw new Error("Labor retry changed or requires legacy receipt reconciliation");
      const receipt = await scoped.db.ServiceLaborOperation.findOne({ where: { id: prior.aggregateId } });
      if (!receipt || receipt.serviceOrderId !== serviceOrderId) throw new Error("Labor receipt is unavailable in current scope");
      return receipt;
    }
    const order2 = await tx.prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    if (!order2 || order2.rooftopId !== authority.rooftopId || !["estimate", "approved", "in-progress"].includes(order2.status)) throw new Error("Service labor is locked");
    if (["start", "pause", "complete"].includes(action) && (!["approved", "in-progress"].includes(order2.status) || order2.authorizationStatus !== "authorized")) throw new Error("Authorized approved repair is required before labor work");
    const existing = request.operationId ? await tx.prisma.serviceLaborOperation.findFirst({ where: { id: request.operationId, serviceOrderId, rooftopId: authority.rooftopId } }) : null;
    if (action !== "create") {
      const allowed = { open: ["dispatch", "cancel"], dispatched: ["start", "cancel"], "in-progress": ["pause", "complete"], paused: ["start", "complete", "cancel"] };
      if (!existing || !allowed[existing.status]?.includes(action)) throw new Error("Invalid labor transition");
    }
    if (action === "dispatch") {
      if (!await scoped.query.User.findOne({ where: { id: request.technicianId }, query: "id" })) throw new Error("Technician not accessible");
      await assertUserRooftopAccess(scoped, request.technicianId, authority.rooftopId);
    }
    const now = /* @__PURE__ */ new Date();
    const punches = Array.isArray(existing?.timePunches) ? existing.timePunches : [];
    const patch = action === "create" ? { operationCode: request.operationCode, description: request.description, soldHours: request.soldHours, status: "open" } : action === "dispatch" ? { technicianId: request.technicianId, status: "dispatched" } : action === "start" ? { status: "in-progress", startedAt: existing.startedAt || now, timePunches: [...punches, { type: "in", at: now.toISOString(), actorId: context.session.itemId }] } : action === "pause" ? { status: "paused", timePunches: [...punches, { type: "out", at: now.toISOString(), actorId: context.session.itemId }] } : action === "complete" ? { status: "completed", completedAt: now, actualMinutes: request.actualMinutes, timePunches: [...punches, { type: "out", at: now.toISOString(), actorId: context.session.itemId }] } : { status: "cancelled" };
    const saved = existing ? await tx.prisma.serviceLaborOperation.update({ where: { id: existing.id }, data: patch }) : await tx.prisma.serviceLaborOperation.create({ data: { ...patch, rooftopId: authority.rooftopId, serviceOrderId, idempotencyKey: key3(data.idempotencyKey) } });
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: authority.rooftopId,
      aggregateType: "ServiceLaborOperation",
      aggregateId: saved.id,
      action,
      topic: "service-labor.updated",
      actorId: context.session.itemId,
      afterSnapshot: { version: 2, request, status: saved.status },
      payload: { rooftopId: authority.rooftopId, serviceOrderId, operationId: saved.id, status: saved.status }
    });
    return scoped.db.ServiceLaborOperation.findOne({ where: { id: saved.id } });
  }, { timeout: 3e4 });
}
async function configurePart(_r, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service permission required");
  const rooftopId = String(data.rooftopId || "");
  await assertSessionRooftopPermission(context, rooftopId, "canManageService");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
  if (!rooftop) throw new Error("Rooftop inaccessible");
  const partNumber = req2(data.partNumber, "Part number", 100).toUpperCase(), description = req2(data.description, "Description"), priceCents = Number(data.priceCents), costCents = Number(data.costCents || 0);
  if (!Number.isInteger(priceCents) || priceCents < 0 || !Number.isInteger(costCents) || costCents < 0) throw new Error("Part money is invalid");
  const eventKey = `part-config:${key3(data.idempotencyKey)}`, evidence = { rooftopId: rooftop.id, partNumber, description, binLocation: String(data.binLocation || "").trim(), minimumQuantity: Number(data.minimumQuantity || 0), priceCents, costCents, supplier: String(data.supplier || "").trim() };
  const id = await event(context, { eventKey, rooftopId: rooftop.id, aggregateType: "PartsInventory", aggregateId: `${rooftop.id}:${partNumber}`, action: "configured", topic: "parts.configured", actorId: context.session.itemId, afterSnapshot: evidence, payload: evidence }, async (tx, reused) => {
    const found = await tx.prisma.partsInventory.findFirst({ where: { rooftopId: rooftop.id, partNumber } });
    if (reused) {
      if (!found) throw new Error("Part replay missing");
      return found.id;
    }
    const values = { ...evidence, quantity: found?.quantity || 0, committedQuantity: found?.committedQuantity || 0, onOrderQuantity: found?.onOrderQuantity || 0 };
    return found ? (await tx.prisma.partsInventory.update({ where: { id: found.id }, data: values, select: { id: true } })).id : (await tx.prisma.partsInventory.create({ data: values, select: { id: true } })).id;
  });
  return context.db.PartsInventory.findOne({ where: { id } });
}
async function recordPartsMovement(_r, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error("Service permission required");
  }
  const part = await context.query.PartsInventory.findOne({
    where: { id: String(data.partId || "") },
    query: "id partNumber quantity committedQuantity onOrderQuantity rooftop { id }"
  });
  if (!part?.rooftop?.id) throw new Error("Part inaccessible");
  await assertSessionRooftopPermission(context, part.rooftop.id, "canManageService");
  const type = req2(data.movementType, "Movement type", 30);
  const quantity = Number(data.quantity);
  const movementTypes = ["receipt", "issue", "return", "adjustment", "count", "commit", "release", "po-order", "po-cancel"];
  if (!movementTypes.includes(type) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Invalid parts movement");
  }
  const serviceOrderId = String(data.serviceOrderId || "").trim() || null;
  const serviceLinkedTypes = /* @__PURE__ */ new Set(["issue", "return", "commit", "release"]);
  if (serviceLinkedTypes.has(type) && !serviceOrderId) {
    throw new Error("A service order is required for this parts movement");
  }
  if (serviceOrderId) {
    const serviceOrder = await context.query.ServiceOrder.findOne({
      where: { id: serviceOrderId },
      query: "id status rooftop { id }"
    });
    if (!serviceOrder || serviceOrder.rooftop?.id !== part.rooftop.id || !["estimate", "approved", "in-progress"].includes(serviceOrder.status)) {
      throw new Error("Service order not found, inaccessible, or unavailable for parts movement");
    }
  }
  let onHand = Number(part.quantity || 0);
  let committed = Number(part.committedQuantity || 0);
  let onOrder = Number(part.onOrderQuantity || 0);
  let delta = 0;
  if (type === "receipt") {
    onHand += quantity;
    onOrder = Math.max(0, onOrder - quantity);
    delta = quantity;
  } else if (type === "issue") {
    onHand -= quantity;
    committed = Math.max(0, committed - quantity);
    delta = -quantity;
  } else if (type === "return") {
    onHand += quantity;
    delta = quantity;
  } else if (type === "adjustment") {
    delta = Number(data.quantityDelta);
    if (!Number.isInteger(delta)) throw new Error("Adjustment delta required");
    onHand += delta;
  } else if (type === "count") {
    delta = quantity - onHand;
    onHand = quantity;
  } else if (type === "commit") committed += quantity;
  else if (type === "release") committed -= quantity;
  else if (type === "po-order") onOrder += quantity;
  else if (type === "po-cancel") onOrder -= quantity;
  if (onHand < 0 || committed < 0 || onOrder < 0 || committed > onHand) {
    throw new Error("Parts movement would violate available inventory");
  }
  const idempotencyKey2 = key3(data.idempotencyKey);
  const eventKey = `parts-movement:${idempotencyKey2}`;
  const reference2 = req2(data.reference, "Reference", 200);
  const reason = req2(data.reason, "Reason");
  const evidence = {
    partId: part.id,
    partNumber: part.partNumber,
    movementType: type,
    quantity,
    quantityDelta: delta,
    onHandAfter: onHand,
    committedAfter: committed,
    onOrderAfter: onOrder,
    reference: reference2,
    reason,
    serviceOrderId
  };
  const id = await event(context, {
    eventKey,
    rooftopId: part.rooftop.id,
    aggregateType: "PartsMovement",
    aggregateId: part.id,
    action: type,
    topic: "parts.moved",
    actorId: context.session.itemId,
    afterSnapshot: evidence,
    payload: { rooftopId: part.rooftop.id, partId: part.id, movementType: type, serviceOrderId }
  }, async (tx, reused) => {
    if (reused) {
      const found = await tx.prisma.partsMovement.findUnique({ where: { idempotencyKey: idempotencyKey2 } });
      if (!found) throw new Error("Movement replay missing");
      return found.id;
    }
    if (serviceOrderId) {
      const scopedOrder = await tx.prisma.serviceOrder.findFirst({
        where: {
          id: serviceOrderId,
          rooftopId: part.rooftop.id,
          status: { in: ["estimate", "approved", "in-progress"] }
        },
        select: { id: true }
      });
      if (!scopedOrder) throw new Error("Service order changed or is outside the parts rooftop");
    }
    const changed = await tx.prisma.partsInventory.updateMany({
      where: {
        id: part.id,
        quantity: part.quantity,
        committedQuantity: part.committedQuantity,
        onOrderQuantity: part.onOrderQuantity
      },
      data: { quantity: onHand, committedQuantity: committed, onOrderQuantity: onOrder }
    });
    if (changed.count !== 1) throw new Error("Part inventory changed concurrently");
    const movement = await tx.prisma.partsMovement.create({
      data: {
        rooftopId: part.rooftop.id,
        partId: part.id,
        serviceOrderId,
        movementType: type,
        quantityDelta: delta,
        onHandAfter: onHand,
        committedAfter: committed,
        onOrderAfter: onOrder,
        reference: reference2,
        reason,
        evidence,
        occurredAt: /* @__PURE__ */ new Date(),
        idempotencyKey: idempotencyKey2
      },
      select: { id: true }
    });
    return movement.id;
  });
  return context.db.PartsMovement.findOne({ where: { id } });
}
async function managePartsPurchaseOrder(_r, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error("Service permission required");
  const action = req2(data.action, "PO action", 30);
  if (!["create", "order", "receive", "cancel"].includes(action)) throw new Error("Invalid purchase-order action");
  const existing = data.purchaseOrderId ? await context.query.PartsPurchaseOrder.findOne({ where: { id: String(data.purchaseOrderId) }, query: "id reference supplier status lines orderedAt receivedAt rooftop { id }" }) : null;
  const rooftopId = existing?.rooftop?.id || String(data.rooftopId || "");
  await assertSessionRooftopPermission(context, rooftopId, "canManageService");
  let reference2 = existing?.reference || "", supplier = existing?.supplier || "", status = existing?.status || "draft", lines = Array.isArray(existing?.lines) ? existing.lines : [], orderedAt = existing?.orderedAt ? new Date(existing.orderedAt) : null, receivedAt = existing?.receivedAt ? new Date(existing.receivedAt) : null;
  if (action === "create") {
    await assertSessionRooftopPermission(context, rooftopId, "canManageService");
    const roof = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
    if (!roof) throw new Error("Rooftop inaccessible");
    reference2 = req2(data.reference, "PO reference", 100);
    supplier = req2(data.supplier, "Supplier", 200);
    if (!Array.isArray(data.lines) || !data.lines.length) throw new Error("PO lines required");
    lines = data.lines.map((x) => ({ partId: req2(x.partId, "Part ID", 100), quantity: Number(x.quantity), unitCostCents: Number(x.unitCostCents) }));
    if (lines.some((x) => !Number.isInteger(x.quantity) || x.quantity <= 0 || !Number.isInteger(x.unitCostCents) || x.unitCostCents < 0)) throw new Error("Invalid PO line");
  } else {
    if (!existing) throw new Error("Purchase order not found");
    if (action === "order" && existing.status === "draft") {
      status = "ordered";
      orderedAt = /* @__PURE__ */ new Date();
    } else if (action === "receive" && ["ordered", "partially-received"].includes(existing.status)) {
      status = "received";
      receivedAt = /* @__PURE__ */ new Date();
    } else if (action === "cancel" && ["draft", "ordered"].includes(existing.status)) status = "cancelled";
    else throw new Error("Invalid purchase-order transition");
  }
  const eventKey = `parts-po:${key3(data.idempotencyKey)}`, evidence = { purchaseOrderId: existing?.id || null, reference: reference2, supplier, action, status, lines };
  const id = await event(context, { eventKey, rooftopId, aggregateType: "PartsPurchaseOrder", aggregateId: existing?.id || reference2, action, topic: "parts-purchase-order.updated", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId, status, reference: reference2 } }, async (tx, reused) => {
    if (reused) {
      const f = existing || await tx.prisma.partsPurchaseOrder.findUnique({ where: { idempotencyKey: key3(data.idempotencyKey) } });
      if (!f) throw new Error("PO replay missing");
      return f.id;
    }
    const values = { reference: reference2, supplier, status, lines, orderedAt, receivedAt };
    return existing ? (await tx.prisma.partsPurchaseOrder.update({ where: { id: existing.id }, data: values, select: { id: true } })).id : (await tx.prisma.partsPurchaseOrder.create({ data: { ...values, rooftopId, idempotencyKey: key3(data.idempotencyKey) }, select: { id: true } })).id;
  });
  return context.db.PartsPurchaseOrder.findOne({ where: { id } });
}

// features/keystone/mutations/financePrerequisiteReview.ts
var import_zod2 = require("zod");
var reference = import_zod2.z.string().trim().min(1).max(200);
var input = import_zod2.z.object({
  dealId: reference,
  worksheetVersion: import_zod2.z.number().int().positive(),
  expectedUpdatedAt: import_zod2.z.union([import_zod2.z.date(), reference]),
  expectedPrerequisiteDigest: import_zod2.z.string().regex(/^[a-f0-9]{64}$/),
  providerKey: import_zod2.z.literal("operator-recorded"),
  reviewReference: reference,
  policyReference: reference,
  policyVersion: reference,
  reviewerAuthorityReference: reference,
  idempotencyKey: import_zod2.z.string().trim().min(8).max(180)
}).strict();
async function reviewFinancePrerequisites(_root, { data }, context) {
  const request = input.parse(data);
  const expected = commandDate(request.expectedUpdatedAt);
  const actorId = context.session?.itemId;
  if (!actorId) throw new Error("Authentication required");
  const purpose = "funding-delivery-prerequisite-review";
  const eventKey = `finance-prerequisite-review:${request.idempotencyKey}`;
  return context.transaction(async (tx) => {
    await lockDeal(tx, request.dealId);
    const authority = await currentDealAuthority(tx, context.session, request.dealId, ["canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: request.dealId } });
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error("Deal authority changed");
    const body = { ...request, expectedUpdatedAt: expected.toISOString(), idempotencyKey: void 0, actorId, purpose };
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
    if (prior) {
      if (prior.actorId !== actorId || prior.rooftopId !== deal.rooftopId || stableJson(prior.afterSnapshot?.request) !== stableJson(body)) throw new Error("Prerequisite review retry is changed or outside original actor/purpose scope");
      return { id: deal.id, status: "review-recorded", reused: true, updatedAt: prior.occurredAt };
    }
    if (!["approved", "financed"].includes(deal.status) || deal.worksheetVersion !== request.worksheetVersion || deal.updatedAt.getTime() !== expected.getTime()) throw new Error("Current approved or financed worksheet is required for prerequisite review");
    const binding = await fundingBinding(tx, deal);
    const current = await readCurrentPrerequisites(tx, deal);
    if (current.digest !== request.expectedPrerequisiteDigest) throw new Error("Prerequisite artifacts changed; refresh and inspect before review");
    const afterSnapshot = {
      version: 1,
      purpose,
      actorId,
      request: body,
      ...current,
      binding,
      reviewReference: request.reviewReference,
      policyReference: request.policyReference,
      policyVersion: request.policyVersion,
      reviewerAuthorityReference: request.reviewerAuthorityReference,
      capability: financingPrerequisiteCapability(request.providerKey),
      // A version-bound human record, not a software-issued legal or vendor approval.
      acceptedTermsHash: domainEventRequestHash(deal.acceptedSnapshot)
    };
    const occurredAt = /* @__PURE__ */ new Date();
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: deal.rooftopId,
      aggregateType: "Deal",
      aggregateId: deal.id,
      action: "prerequisites-reviewed",
      topic: "finance-prerequisites.reviewed",
      actorId,
      afterSnapshot,
      occurredAt,
      payload: { dealId: deal.id, rooftopId: deal.rooftopId, worksheetVersion: deal.worksheetVersion }
    });
    return { id: deal.id, status: "review-recorded", reused: false, updatedAt: occurredAt };
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}

// features/keystone/mutations/deliveryOperations.ts
var req3 = (v, n, max = 1e3) => {
  const s = String(v || "").trim();
  if (!s || s.length > max) throw new Error(`${n} is required`);
  return s;
};
var ik2 = (v) => req3(v, "Idempotency key", 200);
var deliveryChecklistCodes = /* @__PURE__ */ new Set(["identity", "insurance", "registration", "title-handoff", "funding"]);
function mergeSingleDeliveryChecklistEntry(existing, incoming) {
  if (!Array.isArray(incoming) || incoming.length !== 1) {
    throw new Error("Exactly one delivery checklist item is required");
  }
  const raw = incoming[0];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("A delivery checklist item is required");
  }
  const item = raw;
  const code = req3(item.code, "Checklist code", 80);
  const status = req3(item.status, "Checklist status", 30);
  const evidenceReference = req3(item.evidenceReference, "Checklist evidence reference", 200);
  if (!deliveryChecklistCodes.has(code)) throw new Error("Invalid delivery checklist item");
  if (!["complete", "waived"].includes(status)) throw new Error("Delivery checklist status must be complete or waived");
  const prior = Array.isArray(existing) ? existing : [];
  return [...prior.filter((value) => value?.code !== code), { code, status, evidenceReference }];
}
async function deliveryDeal(context, id) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session }) || !permissions.canManageDeals({ session: context.session })) throw new Error("Deal management permission is required");
  const deal = await context.query.Deal.findOne({ where: { id: String(id || "") }, query: "id status rooftop { id } vehicle { id vin stockNumber } lead { id customer { id } }" });
  if (!deal?.rooftop?.id || !["financed", "delivered"].includes(deal.status)) throw new Error("Financed deal not found or accessible");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageDeals");
  return deal;
}
async function manageDeliveryCase(_r, { data }, context) {
  const visible = await deliveryDeal(context, data.dealId);
  const action = req3(data.action, "Delivery action", 40);
  if (!["schedule", "arrive", "record-checklist", "acknowledge", "cancel"].includes(action)) throw new Error("Invalid delivery action");
  if (action === "record-checklist") mergeSingleDeliveryChecklistEntry([], data.checklist);
  const eventKey = `delivery-case:${ik2(data.idempotencyKey)}`;
  const request = { ...data, dealId: visible.id, idempotencyKey: void 0 };
  return context.transaction(async (tx) => {
    await lockDeal(tx, visible.id);
    const authority = await currentDealAuthority(tx, context.session, visible.id, ["canManageDeals"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id } });
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error("Deal authority changed");
    const binding = { ...worksheetBinding(deal), acceptedHash: domainEventRequestHash(deal.acceptedSnapshot) };
    const existing = await tx.prisma.deliveryCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId } });
    const payload = (status2) => ({ rooftopId: deal.rooftopId, dealId: deal.id, status: status2 });
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
    if (prior) {
      if (!existing || stableJson(prior.afterSnapshot?.request) !== stableJson(request) || stableJson(prior.afterSnapshot?.binding) !== stableJson(binding)) throw new Error("Delivery case retry is changed or superseded");
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: "DeliveryCase", aggregateId: deal.id, action, topic: "delivery-case.updated", actorId: context.session.itemId, afterSnapshot: prior.afterSnapshot, payload: payload(prior.afterSnapshot.status) });
      return authority.context.db.DeliveryCase.findOne({ where: { id: existing.id } });
    }
    if (deal.status !== "financed" || existing?.status === "delivered") throw new Error("Only active financed delivery cases can be changed");
    const now = /* @__PURE__ */ new Date();
    let status = existing?.status || "scheduled";
    let appointmentAt = existing?.appointmentAt || null;
    let arrivedAt = existing?.arrivedAt || null;
    let checklist = Array.isArray(existing?.checklist) ? existing.checklist : [];
    let customerAcknowledgment = existing?.customerAcknowledgment || "";
    let acknowledgedAt = existing?.acknowledgedAt || null;
    if (action === "schedule") {
      appointmentAt = new Date(String(data.appointmentAt || ""));
      if (Number.isNaN(appointmentAt.getTime()) || appointmentAt.getTime() < Date.now() - 3e5) throw new Error("Valid future delivery appointment is required");
      status = "scheduled";
      acknowledgedAt = null;
      customerAcknowledgment = "";
    }
    if (action === "arrive") {
      if (existing?.status !== "scheduled") throw new Error("Scheduled delivery is required before arrival");
      status = "arrived";
      arrivedAt = now;
    }
    if (action === "record-checklist") {
      if (!["scheduled", "arrived", "ready"].includes(existing?.status)) throw new Error("Active delivery case is required");
      checklist = mergeSingleDeliveryChecklistEntry(checklist, data.checklist);
      status = existing?.status === "arrived" ? "arrived" : "scheduled";
      acknowledgedAt = null;
      customerAcknowledgment = "";
    }
    if (action === "acknowledge") {
      if (!["scheduled", "arrived", "ready"].includes(existing?.status)) throw new Error("Active delivery case is required");
      const required7 = ["identity", "insurance", "registration", "title-handoff", "funding"];
      if (!required7.every((code) => checklist.some((x) => x.code === code && ["complete", "waived"].includes(x.status) && String(x.evidenceReference || "").trim()))) throw new Error("Complete delivery checklist is required");
      customerAcknowledgment = req3(data.customerAcknowledgment, "Customer acknowledgment");
      acknowledgedAt = now;
      status = "ready";
    }
    if (action === "cancel") {
      status = "cancelled";
      acknowledgedAt = null;
      customerAcknowledgment = "";
    }
    const evidence = {
      version: 2,
      request,
      binding,
      dealId: deal.id,
      action,
      status,
      appointmentAt: appointmentAt?.toISOString() || null,
      arrivedAt: arrivedAt?.toISOString() || null,
      checklist,
      customerAcknowledgment: customerAcknowledgment || null,
      acknowledgedAt: acknowledgedAt?.toISOString() || null
    };
    const values = { status, appointmentAt, arrivedAt, checklist, customerAcknowledgment, acknowledgedAt, deliverySnapshot: evidence };
    const saved = existing ? await tx.prisma.deliveryCase.update({ where: { id: existing.id }, data: values, select: { id: true } }) : await tx.prisma.deliveryCase.create({ data: { ...values, rooftopId: deal.rooftopId, dealId: deal.id, idempotencyKey: ik2(data.idempotencyKey) }, select: { id: true } });
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: "DeliveryCase", aggregateId: deal.id, action, topic: "delivery-case.updated", actorId: context.session.itemId, afterSnapshot: evidence, payload: payload(status) });
    return authority.context.db.DeliveryCase.findOne({ where: { id: saved.id } });
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
async function manageWeOweItem(_r, { data }, context) {
  const deal = await deliveryDeal(context, data.dealId), action = req3(data.action, "We-owe action", 30);
  if (!["create", "fulfill", "waive"].includes(action)) throw new Error("Invalid we-owe action");
  const delivery = await context.sudo().prisma.deliveryCase.findFirst({ where: { dealId: deal.id }, select: { id: true } });
  if (!delivery) throw new Error("Delivery case is required");
  const existing = data.itemId ? await context.sudo().prisma.weOweItem.findFirst({ where: { id: String(data.itemId), deliveryCaseId: delivery.id } }) : null;
  let status = existing?.status || "open", description = existing?.description || "", promisedAt = existing?.promisedAt || null, ownerId = existing?.ownerId || null, estimatedCostCents = existing?.estimatedCostCents || 0, fulfillmentEvidence = existing?.fulfillmentEvidence || "", customerAcknowledgment = existing?.customerAcknowledgment || "", fulfilledAt = existing?.fulfilledAt || null;
  if (action === "create") {
    description = req3(data.description, "Description");
    promisedAt = new Date(String(data.promisedAt || ""));
    if (Number.isNaN(promisedAt.getTime())) throw new Error("Promised date is invalid");
    ownerId = req3(data.ownerId, "Owner ID", 100);
    const owner = await context.query.User.findOne({ where: { id: ownerId }, query: "id" });
    if (!owner) throw new Error("Owner is not accessible");
    await assertUserRooftopAccess(context, ownerId, deal.rooftop.id);
    estimatedCostCents = Number(data.estimatedCostCents || 0);
    if (!Number.isInteger(estimatedCostCents) || estimatedCostCents < 0) throw new Error("Estimated cost is invalid");
  } else {
    if (!existing || existing.status !== "open") throw new Error("Open we-owe item is required");
    status = action === "fulfill" ? "fulfilled" : "waived";
    fulfillmentEvidence = req3(data.fulfillmentEvidence, "Fulfillment evidence");
    customerAcknowledgment = req3(data.customerAcknowledgment, "Customer acknowledgment");
    fulfilledAt = /* @__PURE__ */ new Date();
  }
  const eventKey = `we-owe:${ik2(data.idempotencyKey)}`, evidence = { dealId: deal.id, deliveryCaseId: delivery.id, itemId: existing?.id || null, action, status, description, promisedAt: promisedAt?.toISOString(), ownerId, estimatedCostCents, fulfillmentEvidence: fulfillmentEvidence || null, customerAcknowledgment: customerAcknowledgment || null, fulfilledAt: fulfilledAt?.toISOString() || null };
  const id = await context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey},0))`;
    const recorded = await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftop.id, aggregateType: "WeOweItem", aggregateId: existing?.id || deal.id, action, topic: "we-owe.updated", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, status } });
    if (recorded.reused) {
      const found = await tx.prisma.weOweItem.findUnique({ where: { idempotencyKey: ik2(data.idempotencyKey) }, select: { id: true } });
      if (found) return found.id;
      if (existing) return existing.id;
      throw new Error("We-owe replay missing");
    }
    const values = { status, description, promisedAt, ownerId, estimatedCostCents, fulfillmentEvidence, customerAcknowledgment, fulfilledAt };
    return existing ? (await tx.prisma.weOweItem.update({ where: { id: existing.id }, data: values, select: { id: true } })).id : (await tx.prisma.weOweItem.create({ data: { ...values, rooftopId: deal.rooftop.id, deliveryCaseId: delivery.id, idempotencyKey: ik2(data.idempotencyKey) }, select: { id: true } })).id;
  }, { timeout: 3e4 });
  return context.db.WeOweItem.findOne({ where: { id } });
}

// features/keystone/mutations/keystoneItemResult.ts
function keystoneItemResult(listKey, command) {
  return async (root, args, context) => {
    const receipt = await command(root, args, context);
    if (!receipt) return null;
    if (typeof receipt.id !== "string" || !receipt.id) throw new Error("Command item readback is unavailable");
    return context.db[listKey].findOne({ where: { id: receipt.id } });
  };
}

// features/keystone/mutations/financeOperations.ts
var required6 = (v, n, max = 500) => {
  const s = String(v || "").trim();
  if (!s || s.length > max) throw new Error(`${n} is required`);
  return s;
};
var key4 = (v) => required6(v, "Idempotency key", 200);
var codes = (v, n) => {
  if (!Array.isArray(v)) throw new Error(`${n} must be an array`);
  return [...new Set(v.map((x) => required6(x, n, 80)))].slice(0, 50);
};
async function dealForFinance(context, id) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error("Financing permission is required");
  const deal = await context.query.Deal.findOne({ where: { id: String(id || "") }, query: "id status updatedAt rooftop { id } lead { id } vehicle { id vin stockNumber } selectedLenderDecision { id }" });
  if (!deal?.rooftop?.id) throw new Error("Deal not found or not accessible");
  await assertSessionRooftopPermission(context, deal.rooftop.id, "canManageFinancing");
  return deal;
}
async function eventTx(context, event2, write) {
  return context.transaction(async (tx) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${event2.eventKey}, 0))`;
    const recorded = await recordDomainEventInTransaction(tx, event2);
    return write(tx, recorded.reused);
  }, { timeout: 3e4 });
}
async function artifactCommand(context, data, action, execute) {
  const expected = commandDate(data.expectedUpdatedAt);
  const actorId = context.session?.itemId;
  if (!actorId) throw new Error("Authentication required");
  const dealId = required6(data.dealId, "Deal ID", 100);
  const eventKey = `finance-artifact:${action}:${key4(data.idempotencyKey)}`;
  const request = { ...data, idempotencyKey: void 0, expectedUpdatedAt: expected.toISOString(), actorId, purpose: action };
  return context.transaction(async (tx) => {
    await lockDeal(tx, dealId);
    const authority = await currentDealAuthority(tx, context.session, dealId, ["canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error("Deal authority changed");
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } });
    if (prior) {
      if (prior.actorId !== actorId || prior.rooftopId !== deal.rooftopId || stableJson(prior.afterSnapshot?.request) !== stableJson(request) || typeof prior.afterSnapshot?.result?.id !== "string" || typeof prior.afterSnapshot?.result?.status !== "string") throw new Error("Artifact retry differs from the original authorized request");
      return prior.afterSnapshot.result;
    }
    if (!["submitted", "approved", "financed"].includes(deal.status) || deal.updatedAt.getTime() !== expected.getTime()) throw new Error("Active accepted worksheet changed; refresh before recording artifacts");
    const binding = await fundingBinding(tx, deal);
    const { result: result2, detail } = await execute(tx, authority.context, deal);
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: deal.rooftopId,
      aggregateType: "Deal",
      aggregateId: deal.id,
      action: `artifact:${action}`,
      topic: "finance-artifact.updated",
      actorId,
      afterSnapshot: { version: 2, request, binding, result: result2, ...detail },
      payload: { rooftopId: deal.rooftopId, dealId: deal.id, action }
    });
    return result2;
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
async function configureFinanceProduct(_r, { data }, context) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error("Financing permission is required");
  const rooftopId = String(data.rooftopId || "");
  await assertSessionRooftopPermission(context, rooftopId, "canManageFinancing");
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: "id" });
  if (!rooftop) throw new Error("Rooftop not found or not accessible");
  const category = required6(data.category, "Category", 50);
  if (!["service-contract", "gap", "maintenance", "appearance", "tire-wheel", "other"].includes(category)) throw new Error("Unsupported product category");
  const providerKey = required6(data.providerKey, "Provider key", 80);
  if (!financingProviderKeys().includes(providerKey)) throw new Error("Unsupported financing provider");
  const evidence = { rooftopId: rooftop.id, code: required6(data.code, "Code", 80).toUpperCase(), name: required6(data.name, "Name", 200), category, providerKey, retailPriceCents: Number(data.retailPriceCents), costCents: Number(data.costCents), active: data.active !== false };
  for (const f of ["retailPriceCents", "costCents"]) if (!Number.isInteger(evidence[f]) || evidence[f] < 0) throw new Error(`${f} is invalid`);
  const eventKey = `finance-product:${key4(data.idempotencyKey)}`;
  const id = await eventTx(context, { eventKey, rooftopId: rooftop.id, aggregateType: "FinanceProduct", aggregateId: `${rooftop.id}:${evidence.code}`, action: "configured", topic: "finance-product.configured", actorId: context.session.itemId, afterSnapshot: evidence, payload: evidence }, async (tx, reused) => {
    if (reused) {
      const found = await tx.prisma.financeProduct.findFirst({ where: { rooftopId: rooftop.id, code: evidence.code }, select: { id: true } });
      if (!found) throw new Error("Finance product replay record is missing");
      return found.id;
    }
    const existing = await tx.prisma.financeProduct.findFirst({ where: { rooftopId: rooftop.id, code: evidence.code }, select: { id: true } });
    const saved = existing ? await tx.prisma.financeProduct.update({ where: { id: existing.id }, data: evidence, select: { id: true } }) : await tx.prisma.financeProduct.create({ data: evidence, select: { id: true } });
    return saved.id;
  });
  return context.db.FinanceProduct.findOne({ where: { id } });
}
async function presentFinanceMenu(_r, { data }, context) {
  return artifactCommand(context, data, "menu-present", async (tx, scoped, deal) => {
    const productCodes = codes(data.productCodes, "Product codes");
    const products = await scoped.query.FinanceProduct.findMany({ where: { rooftop: { id: { equals: deal.rooftopId } }, code: { in: productCodes }, active: { equals: true } }, take: 50, query: "id code name category providerKey retailPriceCents" });
    if (products.length !== productCodes.length) throw new Error("Every menu product must be active at this rooftop");
    const quotes = await tx.prisma.financeProductQuote.findMany({ where: { dealId: deal.id, rooftopId: deal.rooftopId, productId: { in: products.map((p) => p.id) }, status: "quoted" }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 101 });
    if (quotes.length > 100) throw new Error("Quote review exceeds bounded projection");
    const latest = /* @__PURE__ */ new Map();
    for (const quote of quotes) if (!latest.has(quote.productId)) latest.set(quote.productId, quote);
    const snapshot2 = products.map((p) => {
      const quote = latest.get(p.id);
      if (!quote || !quote.evidenceReference) throw new Error("Every menu product requires current operator/provider quote evidence");
      return { code: p.code, name: p.name, category: p.category, providerKey: p.providerKey, retailPriceCents: quote.retailPriceCents, quoteId: quote.id, quoteEvidenceReference: quote.evidenceReference };
    });
    const previous = await tx.prisma.financeMenuVersion.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId }, orderBy: { version: "desc" } });
    const version = (previous?.version || 0) + 1;
    await tx.prisma.financeMenuVersion.updateMany({ where: { dealId: deal.id, rooftopId: deal.rooftopId }, data: { status: "superseded" } });
    const saved = await tx.prisma.financeMenuVersion.create({ data: { rooftopId: deal.rooftopId, dealId: deal.id, version, status: "presented", optionsSnapshot: snapshot2, presentedAt: /* @__PURE__ */ new Date(), idempotencyKey: key4(data.idempotencyKey) } });
    const result2 = await scoped.query.FinanceMenuVersion.findOne({ where: { id: saved.id }, query: "id version status optionsSnapshot presentedAt" });
    if (!result2) throw new Error("Menu readback denied");
    return { result: result2, detail: { options: snapshot2, version } };
  });
}
async function decideFinanceMenu(_r, { data }, context) {
  return artifactCommand(context, data, "menu-decide", async (tx, scoped, deal) => {
    const menu = await tx.prisma.financeMenuVersion.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId }, orderBy: { version: "desc" } });
    if (!menu || menu.id !== data.menuId || menu.status !== "presented") throw new Error("Current presented menu not found for this deal");
    const selected = codes(data.selectedProductCodes || [], "Selected products"), declined = codes(data.declinedProductCodes || [], "Declined products");
    const options = Array.isArray(menu.optionsSnapshot) ? menu.optionsSnapshot : [];
    const available = new Set(options.map((x) => x.code));
    if (available.size !== options.length || [...selected, ...declined].some((c) => !available.has(c)) || selected.some((c) => declined.includes(c)) || selected.length + declined.length !== available.size) throw new Error("Every distinct presented product requires accept or decline evidence");
    const acknowledgment = required6(data.disclosureAcknowledgment, "Disclosure acknowledgment", 1e3);
    const status = selected.length ? "accepted" : "declined";
    const changed = await tx.prisma.financeMenuVersion.updateMany({
      where: { id: menu.id, dealId: deal.id, rooftopId: deal.rooftopId, status: "presented", updatedAt: menu.updatedAt },
      data: { status, selectedProductCodes: selected, declinedProductCodes: declined, disclosureAcknowledgment: acknowledgment, decidedAt: /* @__PURE__ */ new Date() }
    });
    if (changed.count !== 1) throw new Error("Finance menu changed concurrently");
    const result2 = await scoped.query.FinanceMenuVersion.findOne({ where: { id: menu.id }, query: "id version status selectedProductCodes declinedProductCodes disclosureAcknowledgment decidedAt" });
    if (!result2) throw new Error("Menu decision readback denied");
    return { result: result2, detail: { menuId: menu.id, selected, declined, acknowledgment } };
  });
}
async function recordFinanceComplianceCheck(_r, { data }, context) {
  return artifactCommand(context, data, "compliance-record", async (tx, scoped, deal) => {
    const checkType = required6(data.checkType, "Check type", 40), status = required6(data.status, "Status", 40);
    if (!["identity", "ofac", "red-flag", "privacy"].includes(checkType) || !["requested", "completed", "failed", "manual-review"].includes(status)) throw new Error("Invalid compliance check evidence");
    const providerKey = required6(data.providerKey, "Provider key", 80);
    financingPrerequisiteCapability(providerKey);
    const evidenceReference = String(data.evidenceReference || "").trim();
    if (status === "completed") required6(evidenceReference, "Completed check evidence reference", 200);
    const now = /* @__PURE__ */ new Date();
    const binding = await fundingBinding(tx, await tx.prisma.deal.findUnique({ where: { id: deal.id } }));
    const saved = await tx.prisma.financeComplianceCheck.create({ data: {
      rooftopId: deal.rooftopId,
      dealId: deal.id,
      checkType,
      providerKey,
      status,
      resultCode: String(data.resultCode || "").trim(),
      requestSnapshot: { providerKey, externalRequestSent: false, binding },
      resultSnapshot: { evidenceReference, externalCheckGuaranteed: false },
      requestedAt: now,
      completedAt: status === "requested" ? null : now,
      idempotencyKey: key4(data.idempotencyKey)
    } });
    const result2 = await scoped.query.FinanceComplianceCheck.findOne({ where: { id: saved.id }, query: "id checkType providerKey status resultCode requestedAt completedAt" });
    if (!result2) throw new Error("Compliance readback denied");
    return { result: result2, detail: { checkType, status, evidenceReference, externalCheckGuaranteed: false } };
  });
}
async function manageFinanceContractPackage(_r, { data }, context) {
  return artifactCommand(context, data, "contract-update", async (tx, scoped, deal) => {
    const action = required6(data.action, "Contract action", 50);
    if (!["prepare", "mark-ready", "request-handoff", "record-provider-status"].includes(action)) throw new Error("Invalid contract action");
    const existing = await tx.prisma.financeContractPackage.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId } });
    const requiredDocuments = codes(data.requiredDocuments || existing?.requiredDocuments || [], "Required documents");
    const documentChecklist = Array.isArray(data.documentChecklist) ? data.documentChecklist.map((x) => ({ code: required6(x.code, "Document code", 80), status: required6(x.status, "Document status", 30) })) : existing?.documentChecklist || [];
    if (!Array.isArray(documentChecklist) || documentChecklist.length > 100 || documentChecklist.some((x) => !["missing", "received", "reviewed", "complete"].includes(x.status))) throw new Error("Invalid document checklist");
    const providerKey = String(data.providerKey || existing?.providerKey || "operator-recorded");
    financingPrerequisiteCapability(providerKey);
    let status = existing?.status || "preparing";
    const envelopeReference = String(data.envelopeReference || existing?.envelopeReference || "").trim();
    let sentAt = existing?.sentAt || null, signedAt = existing?.signedAt || null;
    if (action === "prepare") {
      status = "preparing";
      sentAt = null;
      signedAt = null;
    }
    if (action === "mark-ready") {
      if (!requiredDocuments.length || requiredDocuments.some((code) => !documentChecklist.some((x) => x.code === code && x.status === "complete"))) throw new Error("Every required document must be complete");
      status = "ready";
      signedAt = null;
    }
    if (action === "request-handoff") {
      if (existing?.status !== "ready") throw new Error("Ready contract package is required");
      status = "awaiting-external-handoff";
    }
    if (action === "record-provider-status") {
      status = required6(data.providerStatus, "Provider status", 40);
      if (!["sent", "viewed", "signed", "declined", "void"].includes(status) || !envelopeReference) throw new Error("Provider status requires envelope reference");
      required6(data.evidenceReference, "Provider evidence reference", 200);
      if (data.evidenceSource !== "operator-recorded" || data.webhookEventId) throw new Error("Verified webhook evidence requires a configured signature-verification adapter");
      if (status === "sent") sentAt = /* @__PURE__ */ new Date();
      signedAt = status === "signed" ? /* @__PURE__ */ new Date() : null;
    }
    const binding = await fundingBinding(tx, await tx.prisma.deal.findUnique({ where: { id: deal.id } }));
    const immutableStatusEvidence = { version: 2, action, status, providerKey, binding, evidenceReference: String(data.evidenceReference || "").trim(), evidenceSource: "operator-recorded", externalHandoffSent: false };
    const values = { status, providerKey, envelopeReference, requiredDocuments, documentChecklist, immutableStatusEvidence, sentAt, signedAt };
    let id;
    if (existing) {
      const changed = await tx.prisma.financeContractPackage.updateMany({ where: { id: existing.id, dealId: deal.id, rooftopId: deal.rooftopId, updatedAt: existing.updatedAt }, data: values });
      if (changed.count !== 1) throw new Error("Contract changed concurrently");
      id = existing.id;
    } else id = (await tx.prisma.financeContractPackage.create({ data: { ...values, rooftopId: deal.rooftopId, dealId: deal.id, idempotencyKey: key4(data.idempotencyKey) } })).id;
    const result2 = await scoped.query.FinanceContractPackage.findOne({ where: { id }, query: "id status providerKey envelopeReference requiredDocuments documentChecklist sentAt signedAt lastWebhookAt updatedAt" });
    if (!result2) throw new Error("Contract readback denied");
    return { result: result2, detail: { contractId: id, immutableStatusEvidence } };
  });
}
async function manageFinanceFundingCase(_root, { data }, context) {
  const visible = await dealForFinance(context, data.dealId);
  const status = required6(data.status, "Funding status", 40);
  if (!["pending", "exception", "clear-to-fund", "funded", "cancelled"].includes(status)) throw new Error("Invalid funding status");
  if (!Array.isArray(data.checklist) || !Array.isArray(data.exceptions) || data.checklist.length > 100 || data.exceptions.length > 100) throw new Error("Bounded funding checklist and exceptions are required");
  const checklist = data.checklist.map((x) => ({ code: required6(x.code, "Checklist code", 80), status: required6(x.status, "Checklist status", 30) }));
  const exceptions = data.exceptions.map((x) => ({ code: required6(x.code, "Exception code", 80), status: required6(x.status, "Exception status", 30), owner: String(x.owner || "").trim() || null, notes: String(x.notes || "").trim() || null }));
  if (checklist.some((x) => !["open", "complete", "waived"].includes(x.status)) || exceptions.some((x) => !["open", "resolved", "waived"].includes(x.status))) throw new Error("Invalid funding checklist evidence");
  if (["clear-to-fund", "funded"].includes(status) && (!checklist.length || checklist.some((x) => x.status === "open") || exceptions.some((x) => x.status === "open"))) throw new Error("Funding cannot clear with open checklist items or exceptions");
  const fundingReference = String(data.fundingReference || "").trim();
  if (status === "funded") required6(fundingReference, "Funding/reconfirmation reference for the current worksheet", 200);
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt);
  const expectedFundingUpdatedAt = data.expectedFundingUpdatedAt == null ? null : commandDate(data.expectedFundingUpdatedAt);
  if (!Number.isInteger(data.worksheetVersion) || data.worksheetVersion < 1) throw new Error("Current worksheet version is required");
  const eventKey = `finance-funding:${key4(data.idempotencyKey)}`;
  const request = {
    dealId: visible.id,
    status,
    checklist,
    exceptions,
    fundingReference,
    worksheetVersion: data.worksheetVersion,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    expectedFundingUpdatedAt: expectedFundingUpdatedAt?.toISOString() ?? null
  };
  return context.transaction(async (tx) => {
    await lockDeal(tx, visible.id);
    const authority = await currentDealAuthority(tx, context.session, visible.id, ["canManageFinancing"]);
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id } });
    const needsCurrentEvidence = ["clear-to-fund", "funded"].includes(status);
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error("Deal authority changed");
    const existing = await readLockedFunding(tx, deal.id);
    if (existing && existing.rooftopId !== deal.rooftopId) throw new Error("Funding case rooftop authority changed");
    const currentBinding = () => needsCurrentEvidence ? fundingBinding(tx, deal) : Promise.resolve({ ...worksheetBinding(deal), acceptedHash: domainEventRequestHash(deal.acceptedSnapshot) });
    const header = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { actorId: true, rooftopId: true, aggregateType: true, aggregateId: true, action: true } });
    if (header && (header.actorId !== context.session.itemId || header.rooftopId !== deal.rooftopId || header.aggregateType !== "FinanceFundingCase" || header.aggregateId !== deal.id || header.action !== `status:${status}`)) throw new Error("Funding receipt is outside original actor/purpose scope");
    const prior = header ? await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } }) : null;
    if (prior) {
      const vehicle = await tx.prisma.vehicle.findUnique({ where: { id: deal.vehicleId }, select: { id: true, rooftopId: true } });
      const lead = await tx.prisma.lead.findUnique({ where: { id: deal.leadId }, select: { id: true, rooftopId: true } });
      if (!vehicle || !lead || vehicle.rooftopId !== deal.rooftopId || lead.rooftopId !== deal.rooftopId || prior.afterSnapshot?.binding?.leadId !== deal.leadId) throw new Error("Committed funding related identity is unavailable in current scope");
      if (prior.actorId !== context.session.itemId || prior.rooftopId !== deal.rooftopId || prior.afterSnapshot?.dealId !== deal.id || stableJson(prior.afterSnapshot?.request) !== stableJson(request) || !existing || prior.afterSnapshot?.version !== 2 || prior.afterSnapshot?.binding?.dealId !== deal.id || prior.afterSnapshot?.binding?.rooftopId !== deal.rooftopId || prior.afterSnapshot?.binding?.vehicleId !== deal.vehicleId) throw new Error("Funding retry is changed or superseded; reload and reconfirm");
      const current = await authority.context.db.FinanceFundingCase.findOne({ where: { id: existing.id } });
      if (!current) throw new Error("Committed funding readback unavailable in current scope; reconcile the original receipt");
      return current;
    }
    if (deal.status === "delivered" || needsCurrentEvidence && !["approved", "financed"].includes(deal.status)) throw new Error("Approved or financed deal is required for funding; delivered funding cannot be changed");
    if (deal.worksheetVersion !== data.worksheetVersion || deal.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error("Deal worksheet changed; reload and review funding");
    if ((existing?.updatedAt?.getTime() ?? null) !== (expectedFundingUpdatedAt?.getTime() ?? null)) throw new Error("Funding case changed; reload and review before updating");
    const binding = await currentBinding();
    let prerequisites = null;
    if (needsCurrentEvidence) {
      prerequisites = await assertReviewedPrerequisites(tx, deal);
    }
    const now = /* @__PURE__ */ new Date();
    const evidence = {
      version: 2,
      request,
      dealId: deal.id,
      binding,
      status,
      checklist,
      exceptions,
      fundingReference,
      evidenceSource: "operator-recorded",
      prerequisites,
      fundedAt: status === "funded" ? now.toISOString() : null,
      previousEvidenceHash: existing ? domainEventRequestHash(existing.immutableEvidence) : null
    };
    const values = { status, checklist, exceptions, fundingReference, fundedAt: status === "funded" ? now : null, immutableEvidence: evidence };
    let id;
    if (existing) {
      const changed = await tx.prisma.financeFundingCase.updateMany({ where: { id: existing.id, dealId: deal.id, rooftopId: deal.rooftopId, updatedAt: expectedFundingUpdatedAt }, data: values });
      if (changed.count !== 1) throw new Error("Funding case changed concurrently");
      id = existing.id;
    } else {
      id = (await tx.prisma.financeFundingCase.create({ data: { ...values, rooftopId: deal.rooftopId, dealId: deal.id, idempotencyKey: key4(data.idempotencyKey) }, select: { id: true } })).id;
    }
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: "FinanceFundingCase", aggregateId: deal.id, action: `status:${status}`, topic: "finance-funding.updated", actorId: context.session.itemId, beforeSnapshot: void 0, afterSnapshot: evidence, payload: { rooftopId: deal.rooftopId, dealId: deal.id, status } });
    return authority.context.db.FinanceFundingCase.findOne({ where: { id } });
  }, { timeout: 3e4, isolationLevel: "Serializable" });
}
async function recordFinanceProductQuote(_r, { data }, context) {
  const deal = await dealForFinance(context, data.dealId);
  const product = await context.query.FinanceProduct.findOne({ where: { id: String(data.productId || "") }, query: "id code providerKey rooftop { id }" });
  if (!product || product.rooftop?.id !== deal.rooftop.id) throw new Error("Finance product not found at this rooftop");
  const status = required6(data.status, "Quote status", 30);
  if (!["requested", "quoted", "failed"].includes(status)) throw new Error("Invalid quote status");
  const providerKey = product.providerKey;
  if (!financingProviderKeys().includes(providerKey)) throw new Error("Unsupported product provider");
  const retailPriceCents = data.retailPriceCents == null ? null : Number(data.retailPriceCents), costCents = data.costCents == null ? null : Number(data.costCents), evidenceReference = String(data.evidenceReference || "").trim();
  if (status === "quoted" && (!Number.isInteger(retailPriceCents) || Number(retailPriceCents) < 0 || !Number.isInteger(costCents) || Number(costCents) < 0 || !evidenceReference)) throw new Error("Quoted products require integer prices and provider/operator evidence");
  const now = /* @__PURE__ */ new Date(), eventKey = `finance-product-quote:${key4(data.idempotencyKey)}`, evidence = { dealId: deal.id, productId: product.id, productCode: product.code, providerKey, status, retailPriceCents, costCents, evidenceReference: evidenceReference || null, externalRateGuaranteed: false, recordedAt: now.toISOString() };
  const id = await eventTx(context, { eventKey, rooftopId: deal.rooftop.id, aggregateType: "FinanceProductQuote", aggregateId: deal.id, action: `recorded:${status}`, topic: "finance-product-quote.recorded", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, productId: product.id, status } }, async (tx, reused) => {
    if (reused) {
      const found = await tx.prisma.financeProductQuote.findUnique({ where: { idempotencyKey: key4(data.idempotencyKey) }, select: { id: true } });
      if (!found) throw new Error("Quote replay record missing");
      return found.id;
    }
    return (await tx.prisma.financeProductQuote.create({ data: { rooftopId: deal.rooftop.id, dealId: deal.id, productId: product.id, providerKey, status, retailPriceCents, costCents, evidenceReference, requestSnapshot: { externalRequestSent: false }, resultSnapshot: { evidenceReference: evidenceReference || null, externalRateGuaranteed: false }, requestedAt: now, completedAt: status === "requested" ? null : now, idempotencyKey: key4(data.idempotencyKey) }, select: { id: true } })).id;
  });
  return context.db.FinanceProductQuote.findOne({ where: { id } });
}
async function recordFinanceProductCancellation(_r, { data }, context) {
  const deal = await dealForFinance(context, data.dealId);
  const menu = await context.query.FinanceMenuVersion.findOne({ where: { id: String(data.menuId || "") }, query: "id status selectedProductCodes deal { id } rooftop { id }" });
  const productCode = required6(data.productCode, "Product code", 80);
  if (!menu || menu.deal?.id !== deal.id || menu.status !== "accepted" || !Array.isArray(menu.selectedProductCodes) || !menu.selectedProductCodes.includes(productCode)) throw new Error("Cancellation must reference an accepted menu product");
  const status = required6(data.status, "Cancellation status", 30);
  if (!["requested", "completed", "denied"].includes(status)) throw new Error("Invalid cancellation status");
  const reason = required6(data.reason, "Cancellation reason", 1e3), refundCents = data.refundCents == null ? 0 : Number(data.refundCents);
  if (!Number.isInteger(refundCents) || refundCents < 0 || status === "completed" && !required6(data.evidenceReference, "Cancellation evidence reference", 200)) throw new Error("Invalid cancellation evidence");
  const now = /* @__PURE__ */ new Date(), eventKey = `finance-product-cancellation:${key4(data.idempotencyKey)}`, evidence = { dealId: deal.id, menuId: menu.id, productCode, status, reason, refundCents, evidenceReference: String(data.evidenceReference || "").trim() || null, recordedAt: now.toISOString() };
  const id = await eventTx(context, { eventKey, rooftopId: deal.rooftop.id, aggregateType: "FinanceProductCancellation", aggregateId: deal.id, action: `recorded:${status}`, topic: "finance-product-cancellation.recorded", actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, productCode, status, refundCents } }, async (tx, reused) => {
    if (reused) {
      const found = await tx.prisma.financeProductCancellation.findUnique({ where: { idempotencyKey: key4(data.idempotencyKey) }, select: { id: true } });
      if (!found) throw new Error("Cancellation replay record missing");
      return found.id;
    }
    return (await tx.prisma.financeProductCancellation.create({ data: { rooftopId: deal.rooftop.id, dealId: deal.id, menuId: menu.id, productCode, status, reason, refundCents, evidence: { evidenceReference: evidence.evidenceReference }, requestedAt: now, completedAt: status === "requested" ? null : now, idempotencyKey: key4(data.idempotencyKey) }, select: { id: true } })).id;
  });
  return context.db.FinanceProductCancellation.findOne({ where: { id } });
}

// features/keystone/integrations/inventory/publicStorefrontInventory.ts
var MAX_CANDIDATES = 5e3;
var PUBLIC_INVENTORY_UNAVAILABLE = "Public inventory is currently unavailable.";
function readWhere(where) {
  const filters = {};
  const clauses = Array.isArray(where?.AND) ? where.AND : where ? [where] : [];
  for (const clause of clauses) {
    if (!clause || typeof clause !== "object" || Array.isArray(clause)) throw new Error("Invalid public inventory filter");
    for (const [key5, rawValue] of Object.entries(clause)) {
      const value = rawValue;
      if (key5 === "status") {
        if (value?.equals !== "available") filters.status = "unavailable";
      } else if (key5 === "make" || key5 === "model") {
        const search = String(value?.contains || "").trim().toLocaleLowerCase();
        if (search) filters[key5] = search;
      } else if (key5 === "condition") {
        const condition = String(value?.equals || "").trim().toLocaleLowerCase();
        if (condition) filters.condition = condition;
      } else if (key5 === "year" || key5 === "priceCents" || key5 === "mileage") {
        const range = {};
        for (const [operator, raw] of Object.entries(value || {})) {
          if (!["gte", "lte"].includes(operator)) throw new Error("Invalid public inventory range filter");
          const number = Number(raw);
          if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid public inventory range value");
          range[operator] = number;
        }
        if (Object.keys(range).length) filters[key5] = range;
      }
    }
  }
  return filters;
}
function inRange(value, range) {
  if (!range) return true;
  const number = Number(value);
  return Number.isFinite(number) && (range.gte == null || number >= range.gte) && (range.lte == null || number <= range.lte);
}
function matches(vehicle, filters) {
  if (filters.status === "unavailable") return false;
  if (filters.make && !String(vehicle.make || "").toLocaleLowerCase().includes(filters.make)) return false;
  if (filters.model && !String(vehicle.model || "").toLocaleLowerCase().includes(filters.model)) return false;
  if (filters.condition && String(vehicle.condition || "").toLocaleLowerCase() !== filters.condition) return false;
  return inRange(vehicle.year, filters.year) && inRange(vehicle.priceCents, filters.priceCents) && inRange(vehicle.mileage, filters.mileage);
}
function compare(a, b, orderBy) {
  const order2 = Array.isArray(orderBy) ? orderBy.find((item) => item && typeof item === "object" && Object.keys(item).length) : void 0;
  const [requestedField, requestedDirection] = order2 ? Object.entries(order2)[0] : ["year", "desc"];
  const field = requestedField === "priceCents" ? "priceCents" : requestedField === "mileage" ? "mileage" : "year";
  const direction = requestedDirection === "asc" ? 1 : -1;
  const left = a[field] == null ? direction > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER : Number(a[field]);
  const right = b[field] == null ? direction > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER : Number(b[field]);
  return (left - right) * direction || String(a.id).localeCompare(String(b.id));
}
async function lockPublicInventoryRows(tx, rooftopId, dealerGroupId, candidates) {
  await tx.$queryRaw`SELECT "id" FROM "Rooftop" WHERE "id" = ${rooftopId} FOR SHARE`;
  if (dealerGroupId) await tx.$queryRaw`SELECT "id" FROM "DealerGroup" WHERE "id" = ${dealerGroupId} FOR SHARE`;
  const stockIds = candidates.map((stock) => String(stock.id)).sort();
  const vehicleIds = candidates.map((stock) => String(stock.vehicleId || stock.vehicle?.id || "")).filter(Boolean).sort();
  if (!stockIds.length) return;
  await tx.$queryRaw`SELECT "id" FROM "InventoryStock" WHERE "id" = ANY(${stockIds}::text[]) FOR SHARE`;
  if (vehicleIds.length) {
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ANY(${vehicleIds}::text[]) FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "VehicleImage" WHERE "vehicle" = ANY(${vehicleIds}::text[]) FOR SHARE`;
  }
}
async function loadPublicInventoryImageUrls(sudo, imageIds) {
  const ids = [...new Set(imageIds.filter(Boolean))];
  if (!ids.length) return /* @__PURE__ */ new Map();
  const images = await sudo.query.VehicleImage.findMany({ where: { id: { in: ids } }, query: "id image { url }" });
  return new Map(images.map((image5) => [image5.id, image5.image?.url || null]));
}
async function queryPublicInventory(context, options = {}) {
  const slug = configuredStorefrontRooftopSlug();
  if (!slug) throw new Error(PUBLIC_INVENTORY_UNAVAILABLE);
  const sudo = context.sudo();
  return sudo.prisma.$transaction(async (tx) => {
    const rooftops = await tx.rooftop.findMany({
      where: { publicSlug: slug, status: "active", dealerGroup: { is: { status: "active" } } },
      select: { id: true, dealerGroupId: true },
      take: 2
    });
    if (rooftops.length !== 1 || !rooftops[0].dealerGroupId) {
      throw new Error(PUBLIC_INVENTORY_UNAVAILABLE);
    }
    const rooftopId = rooftops[0].id;
    const candidates = await tx.inventoryStock.findMany({
      where: {
        rooftopId,
        ...options.id ? { vehicleId: options.id } : {},
        reconStatus: "completed",
        merchandisingStatus: "approved",
        approvedRevisionHash: { not: "" },
        frontlineAt: { not: null },
        vehicle: { is: { status: "available" } }
      },
      include: {
        rooftop: { include: { dealerGroup: true } },
        vehicle: { include: { images: true } },
        merchandisingVersions: { orderBy: { version: "desc" }, take: 1 }
      },
      take: MAX_CANDIDATES + 1
    });
    if (candidates.length > MAX_CANDIDATES) throw new Error("Public inventory validation capacity exceeded; refusing to emit an incomplete storefront projection.");
    await lockPublicInventoryRows(tx, rooftopId, rooftops[0].dealerGroupId, candidates);
    const approved = candidates.flatMap((stock) => {
      if (stock.rooftop?.status !== "active" || stock.rooftop?.dealerGroup?.status !== "active") return [];
      try {
        assertPublishableInventory(stock);
        return [{ stock, vehicle: stock.vehicle }];
      } catch {
        return [];
      }
    });
    const filters = readWhere(options.where);
    const matching = approved.map(({ vehicle }) => vehicle).filter((vehicle) => matches(vehicle, filters)).sort((a, b) => compare(a, b, options.orderBy));
    const skip = Math.max(0, Math.min(1e4, Number.isSafeInteger(options.skip) ? Number(options.skip) : 0));
    const take = Math.max(0, Math.min(100, Number.isSafeInteger(options.take) ? Number(options.take) : 50));
    const page2 = matching.slice(skip, skip + take);
    if (!page2.length) return { items: [], totalCount: matching.length };
    const imageIds = page2.flatMap((vehicle) => (vehicle.images || []).map((image5) => image5.id));
    const imageUrlById = await loadPublicInventoryImageUrls(sudo, imageIds);
    return {
      totalCount: matching.length,
      items: page2.map((vehicle) => ({
        id: vehicle.id,
        vin: vehicle.vin,
        stockNumber: vehicle.stockNumber,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        exteriorColor: vehicle.exteriorColor,
        mileage: vehicle.mileage,
        price: vehicle.priceCents == null ? null : vehicle.priceCents / 100,
        status: vehicle.status,
        condition: vehicle.condition,
        features: vehicle.features,
        description: vehicle.description,
        images: (vehicle.images || []).map((image5) => ({
          id: image5.id,
          imagePath: image5.imagePath,
          image: image5.image_id ? { url: imageUrlById.get(image5.id) || null } : null,
          isPrimary: image5.isPrimary,
          sortOrder: image5.sortOrder
        })).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      }))
    };
  }, { isolationLevel: "RepeatableRead", timeout: 3e4 });
}
async function publicInventoryVehicles(_root, options, context) {
  return queryPublicInventory(context, options);
}
async function publicInventoryVehicle(_root, { id }, context) {
  const result2 = await queryPublicInventory(context, { id, take: 1 });
  return result2.items[0] || null;
}
async function publicInventoryCount(_root, { where }, context) {
  const result2 = await queryPublicInventory(context, { where, take: 0 });
  return result2.totalCount;
}

// features/keystone/mutations/index.ts
var graphql9 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema9.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql9`
      input UserUpdateProfileInput {
        onboardingStatus: String
      }

      type ActiveUserProfile {
        id: ID!
        onboardingStatus: String
      }

      type PublicSubmissionVehicle {
        id: ID!
        vin: String
        stockNumber: String
        year: Int
        make: String
        model: String
        price: Float
        status: String
      }

      type PublicInventoryStoredImage { url: String }
      type PublicInventoryImage {
        id: ID!
        imagePath: String
        image: PublicInventoryStoredImage
        isPrimary: Boolean!
        sortOrder: Int!
      }
      type PublicInventoryVehicle {
        id: ID!
        vin: String
        stockNumber: String
        year: Int
        make: String
        model: String
        trim: String
        exteriorColor: String
        mileage: Int
        price: Float
        status: String
        condition: String
        description: String
        features: JSON
        images: [PublicInventoryImage!]!
      }
      type PublicInventoryResult { items: [PublicInventoryVehicle!]!, totalCount: Int! }

      input SubmitInquiryInput {
        firstName: String!
        lastName: String!
        email: String!
        phone: String
        preferredContact: String!
        intent: String!
        message: String
        vehicleId: ID
        rooftopSlug: String!
        idempotencyKey: String!
        requestToken: String!
        website: String
      }

      type SubmitInquiryPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        leadId: ID
        intent: String
        intentLabel: String
        preferredContact: String
        selectedVehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitTestDriveInput {
        customerName: String!
        customerEmail: String!
        customerPhone: String!
        preferredDate: String!
        preferredTime: String!
        vehicleId: ID
        message: String
        rooftopSlug: String!
        idempotencyKey: String!
        requestToken: String!
        website: String
      }

      type SubmitTestDrivePayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        testDriveId: ID
        leadId: ID
        scheduledTime: DateTime
        vehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitTradeInInput {
        firstName: String!
        lastName: String!
        email: String!
        phone: String!
        year: Int!
        make: String!
        model: String!
        trim: String
        vin: String
        mileage: Int!
        condition: String!
        ownership: String!
        payoffAmount: Float
        interestedVehicleId: ID
        rooftopSlug: String!
        idempotencyKey: String!
        requestToken: String!
        website: String
      }

      type SubmitTradeInPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        tradeInId: ID
        leadId: ID
        estimatedMin: Float
        estimatedMax: Float
        estimateMode: String
        providerRequestSent: Boolean
        vehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitFinancingInput {
        fullName: String!
        email: String!
        phone: String!
        employmentStatus: String!
        annualIncome: Float!
        creditTier: String!
        requestedAmount: Float
        monthlyPayment: Float
        downPayment: Float
        tradeInValue: Float
        apr: Float
        loanTerm: Int
        vehicleId: ID
        consent: Boolean!
        privacyAcknowledged: Boolean!
        rooftopSlug: String!
        idempotencyKey: String!
        requestToken: String!
        website: String
      }

      type SubmitFinancingPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        applicationId: ID
        applicationReference: String
        leadId: ID
        taskId: ID
        followUpDueAt: DateTime
        vehicle: PublicSubmissionVehicle
        applicationStatus: String
        providerMode: String
        providerRequestSent: Boolean
        reused: Boolean
      }

      input SubmitServiceBookingInput {
        customerName: String!
        customerEmail: String!
        customerPhone: String!
        appointmentDate: String!
        appointmentTime: String!
        serviceType: String!
        vehicleYear: Int!
        vehicleMake: String!
        vehicleModel: String!
        vehicleVin: String
        description: String
        rooftopSlug: String!
        idempotencyKey: String!
        requestToken: String!
        website: String
      }

      type SubmitServiceBookingPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        serviceAppointmentId: ID
        leadId: ID
        appointmentDate: DateTime
        serviceType: String
        status: String
        requestedServiceLabel: String
        reused: Boolean
      }

      type LeadInteractionResult {
        id: ID!
        leadId: ID!
      }

      input CreateLeadTaskInput {
        leadId: ID!
        title: String!
        description: String
        priority: String = "medium"
        dueDate: DateTime
        assignedToId: ID
        communicationChannel: String = "internal"
        idempotencyKey: String!
      }

      input RecordLeadInteractionInput {
        leadId: ID!
        interactionType: String!
        outcome: String
        notes: String!
        date: DateTime
        followUpDate: DateTime
        idempotencyKey: String!
      }

      input TestDriveWorkflowInput {
        id: ID!
        action: String!
        interestedLevel: String
        feedback: String
        idempotencyKey: String!
      }

      input RecordTradeInAppraisalInput {
        id: ID!
        referenceValueCents: Int!
        offerAmountCents: Int!
        idempotencyKey: String!
      }

      input CreateDealPencilInput {
        rooftopId: ID!
        vehicleId: ID!
        leadId: ID
        salespersonId: ID
        tradeInId: ID
        vehiclePriceCents: Int!
        tradeInValueCents: Int
        downPaymentCents: Int
        idempotencyKey: String!
      }

      input OpenServiceOrderInput {
        appointmentId: ID!
        diagnosis: String
        laborTotalCents: Int
        partsTotalCents: Int
        taxCents: Int
        grandTotalCents: Int
        idempotencyKey: String!
      }

      input StartInventoryAcquisitionInput {
        rooftopId: ID!
        idempotencyKey: String!
        reason: String!
        acquisitionSource: String!
        sourceReference: String
        vin: String!
        year: Int!
        make: String!
        model: String!
        odometer: Int
        appraisalCents: Int!
        reconEstimateCents: Int
        vehicleId: ID
      }

      input ChangeDealerMembershipInput {
        scopeType: String!
        scopeId: ID!
        targetUserId: ID!
        roleId: ID!
        status: String!
        accessAllRooftops: Boolean = false
        reason: String!
        expectedUpdatedAt: DateTime
      }

      type DealerMembershipChangePayload {
        id: ID!
        scopeType: String!
        scopeId: ID!
        status: String!
        accessAllRooftops: Boolean!
        roleId: ID!
        updatedAt: DateTime!
      }

      input RecordLenderDecisionInput {
        applicationId: ID!
        submissionId: ID
        providerKey: String!
        idempotencyKey: String!
        externalReference: String
        decision: String!
        approvedAmountCents: Int
        aprBasisPoints: Int
        termMonths: Int
        monthlyPaymentCents: Int
        reasonCodes: [String!]
      }

      type DealershipOnboardingPayload {
        completed: Boolean!
        profile: String!
        dealerGroup: String!
        rooftop: String!
        membership: String!
        makesCreated: Int!
        makesReused: Int!
        servicesCreated: Int!
        servicesReused: Int!
        rolesCreated: Int!
        rolesReused: Int!
        vehiclesCreated: Int!
        vehiclesReused: Int!
        imagesCreated: Int!
        imagesReused: Int!
        acquisitionsCreated: Int!
        acquisitionsReused: Int!
        stocksCreated: Int!
        stocksReused: Int!
        publicationEvidenceCreated: Int!
        publicationEvidenceReused: Int!
      }

      type OperatorPersonResult { id: ID!, name: String }
      type OperatorPageInfo { limit: Int!, offset: Int!, hasMore: Boolean! }
      type CRMLeadResult { id: ID!, customerId: ID, firstName: String!, lastName: String!, email: String, phone: String, source: String, status: String, temperature: String, interestedVehicle: DealVehicleResult, assignedSalesperson: OperatorPersonResult, assignedAt: DateTime, firstResponseDueAt: DateTime, firstResponseAt: DateTime, lastContact: DateTime, createdAt: DateTime, updatedAt: DateTime }
      type CRMWorkspaceSummary { visibleCount: Int!, newCount: Int!, overdueCount: Int! }
      type CRMWorkspaceResult { leads: [CRMLeadResult!]!, summary: CRMWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type CustomerDuplicateCandidate { id: ID!, firstName: String!, lastName: String!, primaryEmail: String, primaryPhone: String, status: String!, createdAt: DateTime!, updatedAt: DateTime!, leadsCount: Int! }
      type CustomerMergeResult { id: ID!, duplicateId: ID!, movedLeadCount: Int!, movedSalesVisitCount: Int!, reused: Boolean! }
      input MergeCustomersInput { survivorId: ID!, duplicateId: ID!, survivorExpectedUpdatedAt: DateTime!, duplicateExpectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input ConfigureLeadRoutingRuleInput { rooftopId: ID!, name: String!, source: String = "any", assigneeId: ID!, priority: Int = 100, firstResponseMinutes: Int = 30, active: Boolean = true, idempotencyKey: String! }
      input RouteLeadInput { leadId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input UpdateCustomerCommunicationPreferencesInput { customerId: ID!, expectedUpdatedAt: DateTime!, emailConsent: Boolean!, smsConsent: Boolean!, phoneConsent: Boolean!, emailSuppressed: Boolean!, smsSuppressed: Boolean!, phoneSuppressed: Boolean!, preferredChannel: String!, source: String!, reason: String!, idempotencyKey: String! }
      input EnrollLeadCadenceInput { leadId: ID!, expectedUpdatedAt: DateTime!, cadenceKey: String!, campaignKey: String!, idempotencyKey: String! }
      input AdvanceLeadCadenceInput { leadId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input LinkCustomerHouseholdInput { primaryCustomerId: ID!, memberCustomerId: ID!, primaryExpectedUpdatedAt: DateTime!, memberExpectedUpdatedAt: DateTime!, displayName: String!, idempotencyKey: String! }
      input ManageSalesVisitInput { action: String!, visitId: ID, leadId: ID, kind: String, vehicleId: ID, managerId: ID, scheduledAt: DateTime, expectedUpdatedAt: DateTime, outcome: String, notes: String, idempotencyKey: String! }
      type DealVehicleResult { id: ID!, vin: String, stockNumber: String, year: Int, make: String, model: String, trim: String, status: String, priceCents: Int }
      type DealLeadResult { id: ID!, firstName: String!, lastName: String!, status: String }
      type DealApprovalResult { id: ID!, decision: String, notes: String, approvalDate: DateTime, approver: OperatorPersonResult }
      type DealWorkspaceRecord { id: ID!, financeEvidence: JSON, status: String, structureType: String, worksheetVersion: Int, vehiclePriceCents: Int, tradeInValueCents: Int, downPaymentCents: Int, financingAmountCents: Int, monthlyPaymentCents: Int, taxAmountCents: Int, totalPriceCents: Int!, loanTerm: Int, apr: Float, residualValueCents: Int, moneyFactorBasisPoints: Int, grossCents: Int, fees: JSON, rebates: JSON, products: JSON, taxLines: JSON, presentedSnapshot: JSON, presentedAt: DateTime, acceptedSnapshot: JSON, acceptedAt: DateTime, evidenceSnapshot: JSON, lockedAt: DateTime, saleDate: DateTime, createdAt: DateTime!, updatedAt: DateTime!, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult, approvals: [DealApprovalResult!]! }
      type DealWorksheetVersionResult { id: ID!, snapshot: JSON, occurredAt: DateTime!, actor: OperatorPersonResult }
      type DealWorkspaceResult { deal: DealWorkspaceRecord!, worksheetVersions: [DealWorksheetVersionResult!]! }
      type DealDeskRecord { id: ID!, status: String, vehiclePriceCents: Int, totalPriceCents: Int!, saleDate: DateTime, createdAt: DateTime!, updatedAt: DateTime!, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult }
      type DealDeskSummary { visibleCount: Int!, pendingCount: Int!, deliveredCount: Int!, totalRevenueCents: Int! }
      type DealDeskWorkspaceResult { deals: [DealDeskRecord!]!, summary: DealDeskSummary!, pageInfo: OperatorPageInfo! }
      type FinanceSubmissionResult { id: ID!, providerKey: String!, providerMode: String!, externalRequestSent: Boolean!, status: String!, externalReference: String, queuedAt: DateTime!, submittedAt: DateTime }
      type FinanceDecisionResult { id: ID!, providerKey: String!, decision: String!, approvedAmountCents: Int, aprBasisPoints: Int, termMonths: Int, monthlyPaymentCents: Int, reasonCodes: JSON, decidedAt: DateTime! }
      type FinanceTaskResult { id: ID!, title: String, dueDate: DateTime, completed: Boolean, priority: String }
      type FinanceLeadResult { id: ID!, rooftop: InventoryRooftopResult, firstName: String, lastName: String, email: String, phone: String, status: String, createdAt: DateTime, interestedVehicle: DealVehicleResult, tasks: [FinanceTaskResult!]! }
      type FinanceApplicationResult { id: ID!, reference: String, status: String, applicantName: String, applicantEmail: String, applicantPhone: String, employmentStatus: String, annualIncomeCents: Int, selfReportedCreditTier: String, requestedAmountCents: Int, plannedMonthlyPaymentCents: Int, plannedDownPaymentCents: Int, tradeInValueCents: Int, aprBasisPoints: Int, loanTermMonths: Int, consentAt: DateTime, submittedAt: DateTime, updatedAt: DateTime, vehicle: DealVehicleResult, lead: FinanceLeadResult, submissions: [FinanceSubmissionResult!]!, decisions: [FinanceDecisionResult!]! }
      type FinanceDealLeadResult { id: ID!, firstName: String, lastName: String }
      type FinanceDealVehicleResult { id: ID!, year: Int, make: String, model: String, stockNumber: String, vin: String, purchasePrice: Float }
      type FinanceDealApprovalResult { id: ID!, decision: String, approvalDate: DateTime, notes: String, approver: OperatorPersonResult }
      type FinanceDealResult { id: ID!, worksheetVersion: Int, financeEvidence: JSON, rooftop: InventoryRooftopResult, vehiclePrice: Float, tradeInValue: Float, downPayment: Float, financingAmount: Float, monthlyPayment: Float, loanTerm: Int, apr: Float, taxAmount: Float, status: String, totalPrice: Float, profit: Float, createdAt: DateTime, updatedAt: DateTime, salesperson: OperatorPersonResult, lead: FinanceDealLeadResult, vehicle: FinanceDealVehicleResult, approvals: [FinanceDealApprovalResult!]! }
      type FinanceWorkspaceSummary { visibleCount: Int!, submittedCount: Int!, reviewCount: Int!, approvedCount: Int! }
      type FinanceProductResult { id: ID!, rooftop: InventoryRooftopResult!, code: String!, name: String!, category: String!, providerKey: String!, active: Boolean!, retailPriceCents: Int!, costCents: Int, updatedAt: DateTime! }
      type FinanceProductQuoteResult { id: ID!, deal: FinanceDealResult, product: FinanceProductResult, providerKey: String!, status: String!, retailPriceCents: Int, evidenceReference: String, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceProductCancellationResult { id: ID!, deal: FinanceDealResult, menu: FinanceMenuResult, productCode: String!, status: String!, reason: String!, refundCents: Int, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceMenuResult { id: ID!, deal: FinanceDealResult, version: Int!, status: String!, optionsSnapshot: JSON, selectedProductCodes: JSON, declinedProductCodes: JSON, disclosureAcknowledgment: String, presentedAt: DateTime!, decidedAt: DateTime }
      type FinanceComplianceResult { id: ID!, deal: FinanceDealResult, checkType: String!, providerKey: String!, status: String!, resultCode: String, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceContractResult { id: ID!, deal: FinanceDealResult, status: String!, providerKey: String!, envelopeReference: String, requiredDocuments: JSON, documentChecklist: JSON, sentAt: DateTime, signedAt: DateTime, lastWebhookAt: DateTime, updatedAt: DateTime! }
      type FinanceFundingResult { id: ID!, immutableEvidence: JSON, deal: FinanceDealResult, status: String!, checklist: JSON, exceptions: JSON, fundingReference: String, fundedAt: DateTime, updatedAt: DateTime! }
      type FinanceWorkspaceResult { applications: [FinanceApplicationResult!]!, deals: [FinanceDealResult!]!, products: [FinanceProductResult!]!, productQuotes: [FinanceProductQuoteResult!]!, productCancellations: [FinanceProductCancellationResult!]!, menus: [FinanceMenuResult!]!, complianceChecks: [FinanceComplianceResult!]!, contractPackages: [FinanceContractResult!]!, fundingCases: [FinanceFundingResult!]!, summary: FinanceWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type DeliveryDealResult { id: ID!, financeEvidence: JSON, status: String, saleDate: DateTime, lockedAt: DateTime, updatedAt: DateTime, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult }
      type DeliveryCaseResult { id: ID!, deliverySnapshot: JSON, deal: DeliveryDealResult, status: String!, appointmentAt: DateTime, arrivedAt: DateTime, checklist: JSON, customerAcknowledgment: String, acknowledgedAt: DateTime, updatedAt: DateTime!, weOweItems: [WeOweResult!]! }
      type WeOweResult { id: ID!, description: String!, status: String!, promisedAt: DateTime!, owner: OperatorPersonResult, estimatedCostCents: Int, fulfillmentEvidence: String, customerAcknowledgment: String, fulfilledAt: DateTime, updatedAt: DateTime! }
      type DeliveryWorkspaceSummary { readyCount: Int!, deliveredCount: Int! }
      type DeliveryWorkspaceResult { deliveries: [DeliveryDealResult!]!, cases: [DeliveryCaseResult!]!, summary: DeliveryWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type FixedOpsLineResult { id: ID!, itemType: String!, description: String!, partNumber: String, quantity: Float!, unitPriceCents: Int!, priceCents: Int! }
      type FixedOpsLeadResult { id: ID!, firstName: String!, lastName: String!, email: String, phone: String }
      type FixedOpsAppointmentOrderResult { id: ID!, status: String, grandTotalCents: Int }
      type FixedOpsAppointmentResult { id: ID!, appointmentDate: DateTime, serviceType: String, status: String, vehicleVin: String, transportationNeed: String, capacitySlot: String, customerVehicleDescription: String, description: String, estimatedDuration: Int, mileageIn: Int, advisorNotes: String, rooftop: InventoryRooftopResult, lead: FixedOpsLeadResult, assignedTech: OperatorPersonResult, serviceOrder: FixedOpsAppointmentOrderResult }
      type FixedOpsLaborResult { id: ID!, operationCode: String!, description: String!, status: String!, technician: OperatorPersonResult, soldHours: Float, actualMinutes: Int, timePunches: JSON, startedAt: DateTime, completedAt: DateTime }
      type FixedOpsOrderResult { id: ID!, rooftop: InventoryRooftopResult, status: String, concern: String!, cause: String!, correction: String!, payType: String!, authorizationStatus: String!, authorizationEvidence: JSON, inspectionEvidence: JSON, declinedWork: JSON, invoiceNumber: String, diagnosis: String!, workPerformed: String!, recommendations: String!, laborTotalCents: Int!, partsTotalCents: Int!, taxCents: Int!, grandTotalCents: Int!, completedAt: DateTime, settledAt: DateTime, updatedAt: DateTime, appointment: FixedOpsAppointmentResult, laborOperations: [FixedOpsLaborResult!]!, lineItems: [FixedOpsLineResult!]! }
      type FixedOpsWorkspaceSummary { openOrderCount: Int!, awaitingOrderCount: Int! }
      type FixedOpsPartResult { id: ID!, partNumber: String, description: String, binLocation: String, quantity: Int, committedQuantity: Int, onOrderQuantity: Int, minimumQuantity: Int, priceCents: Int, supplier: String }
      type PartsMovementResult { id: ID!, part: FixedOpsPartResult, serviceOrder: FixedOpsOrderResult, movementType: String!, quantityDelta: Int!, onHandAfter: Int!, committedAfter: Int!, onOrderAfter: Int!, reference: String!, reason: String!, occurredAt: DateTime! }
      type PartsPurchaseOrderResult { id: ID!, reference: String!, supplier: String!, status: String!, lines: JSON, orderedAt: DateTime, receivedAt: DateTime, updatedAt: DateTime! }
      type FixedOpsWorkspaceResult { serviceRooftops: [InventoryRooftopResult!]!, orders: [FixedOpsOrderResult!]!, appointments: [FixedOpsAppointmentResult!]!, parts: [FixedOpsPartResult!]!, partsMovements: [PartsMovementResult!]!, purchaseOrders: [PartsPurchaseOrderResult!]!, summary: FixedOpsWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type OperatorCommandResult { id: ID!, status: String, updatedAt: DateTime!, reused: Boolean! }
      type DealLenderOfferResult { id: ID!, providerKey: String!, decision: String!, approvedAmountCents: Int, aprBasisPoints: Int, termMonths: Int, monthlyPaymentCents: Int, reasonCodes: JSON, decidedAt: DateTime!, selected: Boolean! }

      input TransferLeadOwnershipInput { leadId: ID!, assignedToId: ID!, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input SaveDealWorksheetInput { dealId: ID!, structureType: String, vehiclePriceCents: Int!, tradeInValueCents: Int, downPaymentCents: Int, monthlyPaymentCents: Int, loanTerm: Int, apr: Float, residualValueCents: Int, moneyFactorBasisPoints: Int, fees: JSON, rebates: JSON, products: JSON, taxLines: JSON, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input PresentDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input AcceptDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, acknowledgment: String!, idempotencyKey: String! }
      input SelectDealLenderOfferInput { dealId: ID!, lenderDecisionId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ReopenDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input CompleteDealDeliveryInput { dealId: ID!, expectedFundingUpdatedAt: DateTime!, expectedDeliveryCaseUpdatedAt: DateTime!, identityVerified: Boolean, insuranceVerified: Boolean, fundingVerified: Boolean, vehicleReleased: Boolean, notes: String, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ManageDeliveryCaseInput { dealId: ID!, action: String!, appointmentAt: DateTime, checklist: JSON, customerAcknowledgment: String, idempotencyKey: String! }
      input ManageWeOweItemInput { dealId: ID!, itemId: ID, action: String!, description: String, promisedAt: DateTime, ownerId: ID, estimatedCostCents: Int, fulfillmentEvidence: String, customerAcknowledgment: String, idempotencyKey: String! }
      input RecordServiceOrderEvidenceInput { serviceOrderId: ID!, concern: String!, cause: String!, correction: String!, payType: String!, authorizationStatus: String!, authorizationEvidence: JSON!, inspectionEvidence: JSON!, declinedWork: JSON!, invoiceNumber: String, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ManageLaborOperationInput { serviceOrderId: ID!, operationId: ID, action: String!, operationCode: String, description: String, soldHours: Float, technicianId: ID, actualMinutes: Int, idempotencyKey: String! }
      input ConfigurePartInput { rooftopId: ID!, partNumber: String!, description: String!, binLocation: String, minimumQuantity: Int, costCents: Int!, priceCents: Int!, supplier: String, idempotencyKey: String! }
      input RecordPartsMovementInput { partId: ID!, serviceOrderId: ID, movementType: String!, quantity: Int!, quantityDelta: Int, reference: String!, reason: String!, idempotencyKey: String! }
      input ManagePartsPurchaseOrderInput { purchaseOrderId: ID, rooftopId: ID, action: String!, reference: String, supplier: String, lines: JSON, idempotencyKey: String! }
      input ConfigureAccountingMappingInput { rooftopId: ID!, sourceType: String!, sourceCode: String!, debitAccount: String!, creditAccount: String!, providerKey: String!, idempotencyKey: String! }
      input StageAccountingBatchInput { sourceType: String!, sourceId: ID!, providerKey: String!, idempotencyKey: String! }
      input ManageAccountingBatchInput { batchId: ID!, action: String!, externalReference: String, errorCode: String, reconciliationReference: String, idempotencyKey: String! }
      input CreatePaymentCheckoutInput { sourceType: String!, sourceId: ID!, amountCents: Int!, providerKey: String!, idempotencyKey: String! }
      input RequestPaymentRefundInput { transactionId: ID!, amountCents: Int!, reason: String!, idempotencyKey: String! }
      input ReconcilePaymentInput { transactionId: ID!, reconciliationReference: String!, idempotencyKey: String! }
      input SaveOperationalReportInput { rooftopId: ID!, name: String!, reportType: String!, filters: JSON, exportFormat: String!, schedule: String!, idempotencyKey: String! }
      input RunSavedReportInput { reportId: ID!, idempotencyKey: String! }
      input ConfigureRetentionPolicyInput { rooftopId: ID!, category: String!, retentionDays: Int!, legalHold: Boolean, rationale: String!, idempotencyKey: String! }
      input SweepReportRetentionInput { rooftopId: ID!, dryRun: Boolean = true, idempotencyKey: String! }
      input AddServiceOrderLineInput { serviceOrderId: ID!, itemType: String!, description: String!, partNumber: String, quantity: Float!, unitPriceCents: Int!, costCents: Int, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input OpenFinanceFollowUpInput { leadId: ID!, reason: String!, idempotencyKey: String! }
      input ConfigureFinanceProductInput { rooftopId: ID!, code: String!, name: String!, category: String!, providerKey: String!, retailPriceCents: Int!, costCents: Int!, active: Boolean, idempotencyKey: String! }
      input RecordFinanceProductQuoteInput { dealId: ID!, productId: ID!, status: String!, retailPriceCents: Int, costCents: Int, evidenceReference: String, idempotencyKey: String! }
      input PresentFinanceMenuInput { dealId: ID!, expectedUpdatedAt: DateTime!, productCodes: JSON!, idempotencyKey: String! }
      input DecideFinanceMenuInput { dealId: ID!, expectedUpdatedAt: DateTime!, menuId: ID!, selectedProductCodes: JSON!, declinedProductCodes: JSON!, disclosureAcknowledgment: String!, idempotencyKey: String! }
      input RecordFinanceComplianceInput { dealId: ID!, expectedUpdatedAt: DateTime!, checkType: String!, providerKey: String!, status: String!, resultCode: String, evidenceReference: String, idempotencyKey: String! }
      input ManageFinanceContractInput { dealId: ID!, expectedUpdatedAt: DateTime!, action: String!, providerKey: String, requiredDocuments: JSON, documentChecklist: JSON, providerStatus: String, envelopeReference: String, evidenceSource: String, evidenceReference: String, webhookEventId: String, idempotencyKey: String! }
      input ReviewFinancePrerequisitesInput { dealId: ID!, worksheetVersion: Int!, expectedUpdatedAt: DateTime!, expectedPrerequisiteDigest: String!, providerKey: String!, reviewReference: String!, policyReference: String!, policyVersion: String!, reviewerAuthorityReference: String!, idempotencyKey: String! }
      input ManageFinanceFundingInput { dealId: ID!, worksheetVersion: Int!, expectedUpdatedAt: DateTime!, expectedFundingUpdatedAt: DateTime, status: String!, checklist: JSON!, exceptions: JSON!, fundingReference: String, idempotencyKey: String! }
      input RecordFinanceProductCancellationInput { dealId: ID!, menuId: ID!, productCode: String!, status: String!, reason: String!, refundCents: Int, evidenceReference: String, idempotencyKey: String! }

      type AccountingWorkspaceResult { mappings: [AccountingMapping!]!, batches: [AccountingBatch!]!, payments: [PaymentTransaction!]!, refunds: [PaymentRefund!]! }
      type OperationalReportResult { generatedAt: String!, metrics: JSON!, exceptions: JSON! }
      type RetentionSweepResult { rooftopId: ID!, dryRun: Boolean!, expiredCount: Int! }
      type ScheduledReportDispatchResult { queuedCount: Int!, runIds: [ID!]! }
      type InventoryRooftopResult { id: ID!, name: String! }
      type InventoryVehicleResult { id: ID!, vin: String!, stockNumber: String!, year: Int, make: String!, model: String!, trim: String, mileage: Int, status: String, priceCents: Int, description: String, primaryImagePath: String }
      type InventoryCostSummary { purchaseCostCents: Int!, reconCostCents: Int!, otherCostCents: Int!, totalCostCents: Int! }
      type InventoryReconWorkResult { id: ID!, title: String!, category: String!, status: String!, estimatedCostCents: Int, actualCostCents: Int, dueAt: DateTime, updatedAt: DateTime! }
      type InventoryMerchandisingResult { id: ID!, version: Int!, status: String!, submittedAt: DateTime!, decidedAt: DateTime, decisionReason: String, updatedAt: DateTime! }
      type InventoryStockResult { id: ID!, rooftop: InventoryRooftopResult!, vehicle: InventoryVehicleResult!, acquisition: InventoryAcquisitionResult, stockNumber: String!, locationCode: String!, locationLabel: String, stockedAt: DateTime!, updatedAt: DateTime!, frontlineAt: DateTime, daysInStock: Int!, isAged: Boolean!, reconStatus: String!, merchandisingStatus: String!, feedStatus: String!, cost: InventoryCostSummary, reconWorkItems: [InventoryReconWorkResult!]!, latestMerchandisingVersion: InventoryMerchandisingResult }
      type InventoryAcquisitionResult { id: ID!, reference: String!, status: String!, vin: String!, year: Int!, make: String!, model: String!, acquisitionSource: String!, appraisalCents: Int!, purchaseCents: Int, reconEstimateCents: Int, updatedAt: DateTime!, vehicleId: ID }
      type InventoryFeedRunResult { id: ID!, channelKey: String!, status: String!, attemptedCount: Int!, succeededCount: Int!, failedCount: Int!, errorCount: Int!, completedAt: DateTime! }
      type InventoryWorkspaceSummary { visibleCount: Int!, availableCount: Int!, agedCount: Int!, reconOpenCount: Int!, totalRetailValueCents: Int!, totalCostCents: Int }
      type InventoryPageInfo { limit: Int!, offset: Int!, hasMore: Boolean! }
      type InventoryWorkspaceResult { items: [InventoryStockResult!]!, acquisitions: [InventoryAcquisitionResult!]!, feedRuns: [InventoryFeedRunResult!]!, channels: [String!]!, intakeRooftops: [InventoryRooftopResult!]!, summary: InventoryWorkspaceSummary!, pageInfo: InventoryPageInfo! }
      type InventoryCommandResult { id: ID!, stockId: ID!, status: String, merchandisingStatus: String!, feedStatus: String!, updatedAt: DateTime!, reused: Boolean! }
      type InventoryIntakeResult { id: ID!, vehicleId: ID!, acquisitionId: ID!, stockId: ID!, status: String, merchandisingStatus: String!, feedStatus: String!, updatedAt: DateTime!, reused: Boolean! }
      type InventoryFeedCommandResult { id: ID!, rooftopId: ID!, channelKey: String!, status: String!, attemptedCount: Int!, succeededCount: Int!, failedCount: Int!, errorCount: Int!, completedAt: DateTime!, reused: Boolean! }

      input IntakeInventoryVehicleInput { rooftopId: ID!, idempotencyKey: String!, reason: String!, acquisitionSource: String!, sourceReference: String, vin: String!, stockNumber: String!, year: Int!, make: String!, model: String!, trim: String, exteriorColor: String, interiorColor: String, mileage: Int, purchasePriceCents: Int!, listPriceCents: Int!, priceCents: Int!, condition: String!, description: String, features: JSON, imagePath: String, locationCode: String!, locationLabel: String }
      input EstablishInventoryStockInput { vehicleId: ID!, acquisitionId: ID, stockNumber: String!, locationCode: String!, locationLabel: String, purchaseCostCents: Int, reason: String!, idempotencyKey: String! }
      input MoveInventoryStockInput { stockId: ID!, locationCode: String!, locationLabel: String, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input RecordInventoryCostInput { stockId: ID!, costType: String!, amountCents: Int!, reference: String, reason: String!, idempotencyKey: String! }
      input CreateInventoryReconWorkInput { stockId: ID!, title: String!, category: String!, estimatedCostCents: Int, assignedToId: ID, dueAt: DateTime, reason: String!, idempotencyKey: String! }
      input TransitionInventoryReconWorkInput { id: ID!, toStatus: String!, actualCostCents: Int, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input UpdateInventoryMerchandisingDraftInput { stockId: ID!, priceCents: Int!, listPriceCents: Int, mileage: Int, description: String!, imagePath: String!, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input SubmitInventoryMerchandisingInput { stockId: ID!, reason: String!, idempotencyKey: String! }
      input DecideInventoryMerchandisingInput { id: ID!, decision: String!, reason: String!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input InventoryFeedErrorInput { stockId: ID, errorCode: String!, message: String!, rowReference: String }
      input RecordInventoryFeedRunInput { channelKey: String!, stockIds: [ID!]!, errors: [InventoryFeedErrorInput!], startedAt: DateTime, completedAt: DateTime, idempotencyKey: String! }

      type StorefrontProfilePayload {
        configured: Boolean!
        rooftopId: ID!
        rooftopSlug: String!
        fullName: String!
        shortName: String!
        salesEmail: String!
        serviceEmail: String!
        phoneDisplay: String!
        phoneHref: String!
        addressLine1: String!
        addressLine2: String!
        hoursMonFri: String!
        hoursSaturday: String!
        hoursSunday: String!
        websiteUrl: String!
        currencyCode: String!
        homepageTitle: String!
        homepageDescription: String!
        logoIcon: String!
        logoColor: String!
      }

      type CustomerAccountResult { id: ID! }
      type CustomerRequest { id: ID!, kind: String!, scheduledAt: DateTime!, status: String! }
      type Query {
        customerRequestHistory: [CustomerRequest!]!
        redirectToInit: Boolean
        publicInventoryVehicles(where: JSON, orderBy: JSON, take: Int, skip: Int): PublicInventoryResult!
        publicInventoryVehicle(id: ID!): PublicInventoryVehicle
        publicInventoryCount(where: JSON): Int!
        storefrontProfile(rooftopSlug: String!): StorefrontProfilePayload!
        domainTimeline(aggregateType: String!, aggregateId: ID!, limit: Int = 50): [DomainAuditEvent!]!
        inventoryWorkspace(status: String, search: String, limit: Int = 50, offset: Int = 0): InventoryWorkspaceResult!
        crmWorkspace(status: String, search: String, limit: Int = 50, offset: Int = 0): CRMWorkspaceResult!
        dealDeskWorkspace(status: String, limit: Int = 50, offset: Int = 0): DealDeskWorkspaceResult!
        dealWorkspace(id: ID!): DealWorkspaceResult!
        dealLenderOffers(dealId: ID!): [DealLenderOfferResult!]!
        financeWorkspace(status: String, limit: Int = 25, offset: Int = 0): FinanceWorkspaceResult!
        deliveryWorkspace(limit: Int = 50, offset: Int = 0): DeliveryWorkspaceResult!
        fixedOpsWorkspace(limit: Int = 50, offset: Int = 0): FixedOpsWorkspaceResult!
        accountingWorkspace(limit: Int = 50): AccountingWorkspaceResult!
        operationalReport: OperationalReportResult!
        auditSearch(aggregateType: String, aggregateId: ID, action: String, limit: Int = 50): [DomainAuditEvent!]!
        customerDuplicateCandidates(customerId: ID!, limit: Int = 20): [CustomerDuplicateCandidate!]!
      }

      type Mutation {
        registerCustomerAccount(name: String!, email: String!, password: String!): CustomerAccountResult!
        updateActiveUser(data: UserUpdateProfileInput!): ActiveUserProfile
        submitInquiry(data: SubmitInquiryInput!): SubmitInquiryPayload!
        submitTestDrive(data: SubmitTestDriveInput!): SubmitTestDrivePayload!
        submitTradeIn(data: SubmitTradeInInput!): SubmitTradeInPayload!
        submitFinancing(data: SubmitFinancingInput!): SubmitFinancingPayload!
        submitServiceBooking(data: SubmitServiceBookingInput!): SubmitServiceBookingPayload!
        transitionDeal(id: ID!, toStatus: String!, notes: String, idempotencyKey: String!): Deal
        transitionServiceOrder(id: ID!, toStatus: String!, idempotencyKey: String!): ServiceOrder
        queueFinancingApplication(applicationId: ID!, providerKey: String!, idempotencyKey: String!): LenderSubmission
        recordLenderDecision(data: RecordLenderDecisionInput!): LenderDecision
        changeDealerMembership(data: ChangeDealerMembershipInput!): DealerMembershipChangePayload!
        createDealPencil(data: CreateDealPencilInput!): Deal
        openServiceOrder(data: OpenServiceOrderInput!): ServiceOrder
        transitionLead(id: ID!, toStatus: String!, lostReasonCode: String, lostReasonDetails: String, idempotencyKey: String!): Lead
        recordLeadInteraction(data: RecordLeadInteractionInput!): LeadInteractionResult!
        updateTestDriveWorkflow(data: TestDriveWorkflowInput!): TestDrive
        transitionServiceAppointment(id: ID!, toStatus: String!, idempotencyKey: String!): ServiceAppointment
        recordTradeInAppraisal(data: RecordTradeInAppraisalInput!): TradeIn
        createLeadTask(data: CreateLeadTaskInput!): Task
        completeTask(id: ID!, idempotencyKey: String!): Task
        startInventoryAcquisition(data: StartInventoryAcquisitionInput!): InventoryAcquisition
        transitionInventoryAcquisition(
          id: ID!
          toStatus: String!
          expectedUpdatedAt: DateTime!
          reason: String!
          purchaseCents: Int
          reconEstimateCents: Int
          vehicleId: ID
          idempotencyKey: String!
        ): InventoryAcquisition
        transferLeadOwnership(data: TransferLeadOwnershipInput!): OperatorCommandResult!
        saveDealWorksheet(data: SaveDealWorksheetInput!): OperatorCommandResult!
        presentDealWorksheet(data: PresentDealWorksheetInput!): OperatorCommandResult!
        acceptDealWorksheet(data: AcceptDealWorksheetInput!): OperatorCommandResult!
        selectDealLenderOffer(data: SelectDealLenderOfferInput!): OperatorCommandResult!
        reopenDealWorksheet(data: ReopenDealWorksheetInput!): OperatorCommandResult!
        manageDeliveryCase(data: ManageDeliveryCaseInput!): DeliveryCase!
        manageWeOweItem(data: ManageWeOweItemInput!): WeOweItem!
        completeDealDelivery(data: CompleteDealDeliveryInput!): OperatorCommandResult!
        recordServiceOrderEvidence(data: RecordServiceOrderEvidenceInput!): ServiceOrder!
        manageLaborOperation(data: ManageLaborOperationInput!): ServiceLaborOperation!
        configurePart(data: ConfigurePartInput!): PartsInventory!
        recordPartsMovement(data: RecordPartsMovementInput!): PartsMovement!
        managePartsPurchaseOrder(data: ManagePartsPurchaseOrderInput!): PartsPurchaseOrder!
        configureAccountingMapping(data: ConfigureAccountingMappingInput!): AccountingMapping!
        stageAccountingBatch(data: StageAccountingBatchInput!): AccountingBatch!
        manageAccountingBatch(data: ManageAccountingBatchInput!): AccountingBatch!
        createPaymentCheckout(data: CreatePaymentCheckoutInput!): PaymentTransaction!
        requestPaymentRefund(data: RequestPaymentRefundInput!): PaymentRefund!
        reconcilePaymentTransaction(data: ReconcilePaymentInput!): PaymentTransaction!
        saveOperationalReport(data: SaveOperationalReportInput!): SavedReport!
        runSavedReport(data: RunSavedReportInput!): ReportRun!
        configureRetentionPolicy(data: ConfigureRetentionPolicyInput!): RetentionPolicy!
        sweepExpiredReportExports(data: SweepReportRetentionInput!): RetentionSweepResult!
        queueDueSavedReports: ScheduledReportDispatchResult!
        addServiceOrderLineItem(data: AddServiceOrderLineInput!): OperatorCommandResult!
        openFinanceFollowUp(data: OpenFinanceFollowUpInput!): OperatorCommandResult!
        configureFinanceProduct(data: ConfigureFinanceProductInput!): FinanceProduct!
        recordFinanceProductQuote(data: RecordFinanceProductQuoteInput!): FinanceProductQuote!
        presentFinanceMenu(data: PresentFinanceMenuInput!): FinanceMenuVersion!
        decideFinanceMenu(data: DecideFinanceMenuInput!): FinanceMenuVersion!
        recordFinanceComplianceCheck(data: RecordFinanceComplianceInput!): FinanceComplianceCheck!
        manageFinanceContractPackage(data: ManageFinanceContractInput!): FinanceContractPackage!
        reviewFinancePrerequisites(data: ReviewFinancePrerequisitesInput!): OperatorCommandResult!
        manageFinanceFundingCase(data: ManageFinanceFundingInput!): FinanceFundingCase!
        recordFinanceProductCancellation(data: RecordFinanceProductCancellationInput!): FinanceProductCancellation!
        intakeInventoryVehicle(data: IntakeInventoryVehicleInput!): InventoryIntakeResult!
        establishInventoryStock(data: EstablishInventoryStockInput!): InventoryCommandResult!
        moveInventoryStock(data: MoveInventoryStockInput!): InventoryCommandResult!
        recordInventoryCost(data: RecordInventoryCostInput!): InventoryCommandResult!
        openInventoryReconWorkItem(data: CreateInventoryReconWorkInput!): InventoryCommandResult!
        transitionInventoryReconWorkItem(data: TransitionInventoryReconWorkInput!): InventoryCommandResult!
        updateInventoryMerchandisingDraft(data: UpdateInventoryMerchandisingDraftInput!): InventoryCommandResult!
        submitInventoryMerchandising(data: SubmitInventoryMerchandisingInput!): InventoryCommandResult!
        decideInventoryMerchandising(data: DecideInventoryMerchandisingInput!): InventoryCommandResult!
        recordInventoryFeedRun(data: RecordInventoryFeedRunInput!): InventoryFeedCommandResult!
        mergeCustomers(data: MergeCustomersInput!): CustomerMergeResult!
        configureLeadRoutingRule(data: ConfigureLeadRoutingRuleInput!): OperatorCommandResult!
        routeLead(data: RouteLeadInput!): OperatorCommandResult!
        updateCustomerCommunicationPreferences(data: UpdateCustomerCommunicationPreferencesInput!): OperatorCommandResult!
        enrollLeadCadence(data: EnrollLeadCadenceInput!): OperatorCommandResult!
        advanceLeadCadence(data: AdvanceLeadCadenceInput!): OperatorCommandResult!
        linkCustomerHousehold(data: LinkCustomerHouseholdInput!): OperatorCommandResult!
        manageSalesVisit(data: ManageSalesVisitInput!): OperatorCommandResult!
        runDealershipOnboarding(data: JSON!): DealershipOnboardingPayload!
      }
    `,
    resolvers: {
      OperatorCommandResult: {
        // context.query returns ISO text; Keystone's DateTime scalar expects Date.
        updatedAt: (result2) => new Date(result2.updatedAt)
      },
      Query: {
        customerRequestHistory,
        redirectToInit: redirectToInit_default,
        publicInventoryVehicles,
        publicInventoryVehicle,
        publicInventoryCount,
        storefrontProfile,
        domainTimeline,
        inventoryWorkspace,
        crmWorkspace,
        dealDeskWorkspace,
        dealWorkspace,
        dealLenderOffers,
        financeWorkspace,
        deliveryWorkspace,
        fixedOpsWorkspace,
        accountingWorkspace,
        operationalReport,
        auditSearch,
        customerDuplicateCandidates
      },
      Mutation: {
        registerCustomerAccount,
        updateActiveUser,
        submitInquiry: publicSubmissionResolver(submitInquiry),
        submitTestDrive: publicSubmissionResolver(submitTestDrive),
        submitTradeIn: publicSubmissionResolver(submitTradeIn),
        submitFinancing: publicSubmissionResolver(submitFinancing),
        submitServiceBooking: publicSubmissionResolver(submitServiceBooking),
        transitionDeal,
        transitionServiceOrder,
        queueFinancingApplication,
        recordLenderDecision,
        changeDealerMembership,
        startInventoryAcquisition,
        transitionInventoryAcquisition,
        createDealPencil,
        openServiceOrder,
        transitionLead,
        recordLeadInteraction,
        updateTestDriveWorkflow,
        transitionServiceAppointment,
        recordTradeInAppraisal,
        createLeadTask,
        completeTask,
        transferLeadOwnership,
        saveDealWorksheet,
        presentDealWorksheet,
        acceptDealWorksheet,
        selectDealLenderOffer,
        reopenDealWorksheet,
        manageDeliveryCase,
        manageWeOweItem,
        completeDealDelivery,
        recordServiceOrderEvidence,
        manageLaborOperation,
        configurePart,
        recordPartsMovement,
        managePartsPurchaseOrder,
        configureAccountingMapping,
        stageAccountingBatch,
        manageAccountingBatch,
        createPaymentCheckout,
        requestPaymentRefund,
        reconcilePaymentTransaction,
        saveOperationalReport,
        runSavedReport,
        configureRetentionPolicy,
        sweepExpiredReportExports,
        queueDueSavedReports,
        addServiceOrderLineItem,
        openFinanceFollowUp,
        configureFinanceProduct,
        recordFinanceProductQuote,
        presentFinanceMenu: keystoneItemResult("FinanceMenuVersion", presentFinanceMenu),
        decideFinanceMenu: keystoneItemResult("FinanceMenuVersion", decideFinanceMenu),
        recordFinanceComplianceCheck: keystoneItemResult("FinanceComplianceCheck", recordFinanceComplianceCheck),
        manageFinanceContractPackage: keystoneItemResult("FinanceContractPackage", manageFinanceContractPackage),
        reviewFinancePrerequisites,
        manageFinanceFundingCase,
        recordFinanceProductCancellation,
        intakeInventoryVehicle,
        establishInventoryStock,
        moveInventoryStock,
        recordInventoryCost,
        openInventoryReconWorkItem,
        transitionInventoryReconWorkItem,
        updateInventoryMerchandisingDraft,
        submitInventoryMerchandising,
        decideInventoryMerchandising,
        recordInventoryFeedRun,
        mergeCustomers,
        configureLeadRoutingRule,
        routeLead,
        updateCustomerCommunicationPreferences,
        enrollLeadCadence,
        advanceLeadCadence,
        linkCustomerHousehold,
        manageSalesVisit,
        runDealershipOnboarding
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");

// features/keystone/lib/passwordResetOrigin.ts
function configuredOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP or HTTPS URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be a credential-free HTTP or HTTPS origin`);
  }
  return url.origin;
}
function resolvePasswordResetOrigin(env = process.env) {
  for (const [label, value] of [
    ["SMTP_STORE_LINK", env.SMTP_STORE_LINK],
    ["NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL],
    ["PORTLESS_URL", env.PORTLESS_URL]
  ]) {
    if (value?.trim()) return configuredOrigin(value.trim(), label);
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SMTP_STORE_LINK or NEXT_PUBLIC_SITE_URL is required in production");
  }
  const port = env.PORT?.trim();
  if (port) {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error("PORT must be an integer from 1 to 65535");
    }
    return `http://127.0.0.1:${port}`;
  }
  return "http://127.0.0.1:3000";
}

// features/keystone/lib/mail.ts
var transport = (0, import_nodemailer.createTransport)({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || void 0,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl ? resolvePasswordResetOrigin({ SMTP_STORE_LINK: baseUrl }) : resolvePasswordResetOrigin();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${encodeURIComponent(resetToken)}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/index.ts
var isProduction = process.env.NODE_ENV === "production";
var productionValue = (name, fallback) => {
  const value = process.env[name]?.trim();
  if (isProduction && !value) throw new Error(`${name} is required in production`);
  return value || fallback;
};
var databaseURL = productionValue("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/openfront_dealership_dev");
var sessionSecret = productionValue("SESSION_SECRET", "local-testing-only-session-secret-change-me");
if (isProduction && (sessionSecret.length < 32 || /^(secret|changeme|development|test)/i.test(sessionSecret))) {
  throw new Error("SESSION_SECRET must be a non-placeholder value with at least 32 characters");
}
var sessionConfig = {
  maxAge: 60 * 60 * 8,
  secret: sessionSecret
};
var rolePermissionFields = `
  id
  name
  canSeeOtherPeople
  canEditOtherPeople
  canManagePeople
  canManageRoles
  canAccessDashboard
  canManageOnboarding
  canManageDealerships
  canManageInventory
  canViewInventory
  canManageLeads
  canViewAllLeads
  canManageDeals
  canApproveDeals
  canManageService
  canViewReports
  canManageFinancing
  canManageTradeIns
`;
var sessionDataFields = `
  name
  email
  role { ${rolePermissionFields} }
  dealerGroupMemberships {
    status
    accessAllRooftops
    dealerGroup { id }
    role { ${rolePermissionFields} }
  }
  rooftopMemberships {
    status
    rooftop { id dealerGroup { id } }
    role { ${rolePermissionFields} }
  }
`;
var sealedSessionStrategy = (0, import_session.statelessSessions)(sessionConfig);
var sessionStrategy = {
  ...sealedSessionStrategy,
  async get({ context }) {
    const sealed = await sealedSessionStrategy.get({ context });
    if (!sealed?.itemId || sealed.listKey !== "User") return void 0;
    const data = await context.sudo().query.User.findOne({ where: { id: sealed.itemId }, query: sessionDataFields });
    return data ? { itemId: sealed.itemId, listKey: "User", data } : void 0;
  }
};
var bucketName = productionValue("S3_BUCKET_NAME", "keystone-test");
var region = productionValue("S3_REGION", "ap-southeast-2");
var accessKeyId = productionValue("S3_ACCESS_KEY_ID", "keystone");
var secretAccessKey = productionValue("S3_SECRET_ACCESS_KEY", "keystone");
var endpoint = productionValue("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
          canManageOnboarding: true,
          canManageDealerships: true,
          canManageInventory: true,
          canViewInventory: true,
          canManageLeads: true,
          canViewAllLeads: true,
          canManageDeals: true,
          canApproveDeals: true,
          canManageService: true,
          canViewReports: true,
          canManageFinancing: true,
          canManageTradeIns: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: sessionDataFields
});
var keystone_default = withAuth(
  (0, import_core70.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session })
    },
    session: sessionStrategy,
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
