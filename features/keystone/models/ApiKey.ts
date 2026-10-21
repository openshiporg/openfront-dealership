import {
  text,
  password,
  relationship,
  select,
  timestamp,
  json,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";

import { isSignedIn } from "../access";
import { normalizeIp, validApiKeyScopes } from "../utils/apiKeyPolicy";
import { trackingFields } from "./trackingFields";

// Dealership API key scopes
export const API_KEY_SCOPES = {
  read_inventory: "View vehicle inventory",
  write_inventory: "Manage vehicle inventory",
  write_leads: "Manage leads and customers",
  write_deals: "Manage deals",
  write_service: "Manage service appointments and repair orders",
  read_reports: "View reports",
} as const;

export type ApiKeyScope = keyof typeof API_KEY_SCOPES;

// API keys are managed by signed-in people, never by another API key.
const isHumanSession = ({ session }: { session?: any }) =>
  isSignedIn({ session }) && !session?.apiKeyId && !session?.apiKeyScopes;

export const ApiKey = list({
  access: {
    operation: {
      query: isHumanSession,
      create: isHumanSession,
      update: isHumanSession,
      delete: isHumanSession,
    },
    filter: {
      query: ({ session }) => ({ user: { id: { equals: session?.itemId } } }),
      update: ({ session }) => ({ user: { id: { equals: session?.itemId } } }),
      delete: ({ session }) => ({ user: { id: { equals: session?.itemId } } }),
    },
  },
  hooks: {
    validate: async ({ operation, resolvedData, item, context, addValidationError }) => {
      if (operation === "delete") return;
      const current = item as any;
      const scopes = resolvedData.scopes ?? current?.scopes;
      if (!validApiKeyScopes(scopes, context.session)) addValidationError("Scopes must be known capabilities currently granted to the key owner");
      if (current?.status === "revoked" && resolvedData.status && resolvedData.status !== "revoked") addValidationError("Revoked keys cannot be reactivated");
      const ips = resolvedData.restrictedToIPs;
      if (ips != null && (!Array.isArray(ips) || ips.some((ip: unknown) => !normalizeIp(ip)))) addValidationError("IP restrictions must contain valid IP addresses");
    },
    resolveInput: ({ operation, inputData, resolvedData, context }) => {
      const result = { ...resolvedData };
      if (operation === "create") result.user = context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined;
      if (typeof inputData.tokenSecret === "string") {
        if (!/^of_[A-Za-z0-9_-]{32,128}$/.test(inputData.tokenSecret)) throw new Error("API token must be an of_ token with at least 32 random characters");
        result.tokenPreview = `${inputData.tokenSecret.slice(0, 12)}...`;
      }
      return result;
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description:
          "A descriptive name for this API key (e.g. 'Inventory syndication')",
      },
    }),
    tokenSecret: password({
      access: { read: () => false },
      validation: { isRequired: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Secure API key token (hashed and never displayed)",
      },
    }),
    tokenPreview: text({
      access: { update: () => false },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        listView: { fieldMode: "read" },
        description: "Preview of the API key (actual key is hidden)",
      },
    }),
    scopes: json({
      defaultValue: [],
      ui: {
        description: "Array of scopes for this API key",
      },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
      ui: {
        description: "Current status of this API key",
      },
    }),
    expiresAt: timestamp({
      ui: {
        description:
          "When this API key expires (optional - leave blank for no expiration)",
      },
    }),
    lastUsedAt: timestamp({
      access: { create: () => false, update: () => false },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Last time this API key was used",
      },
    }),
    usageCount: json({
      access: { create: () => false, update: () => false },
      defaultValue: { total: 0, daily: {} },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Usage statistics for this API key",
      },
    }),
    restrictedToIPs: json({
      defaultValue: [],
      ui: {
        description:
          "Optional: Restrict this key to specific IP addresses (array of IPs)",
      },
    }),
    ...trackingFields,
    user: relationship({
      access: { create: () => false, update: () => false },
      ref: "User.apiKeys",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "tokenPreview", "scopes", "status", "lastUsedAt"],
    },
    description: "Secure API keys for programmatic access",
  },
});
