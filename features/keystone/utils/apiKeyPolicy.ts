import { hasAnyMembershipPermission, type DealershipTenancySession } from "../tenancy";
import { normalizeIp, requestClientIp } from "./requestClientIp";
export { normalizeIp } from "./requestClientIp";

export const API_SCOPE_PERMISSIONS: Record<string, readonly string[]> = {
  read_inventory: ["canViewInventory"], write_inventory: ["canViewInventory", "canManageInventory"],
  write_leads: ["canManageLeads"],
  write_deals: ["canManageDeals"],
  write_service: ["canManageService"],
  read_reports: ["canViewReports"],
};
export function scopeAllowsPermission(scopes: unknown, permission: string) {
  return Array.isArray(scopes) && scopes.some(scope => typeof scope === "string" && API_SCOPE_PERMISSIONS[scope]?.includes(permission));
}
export function validApiKeyScopes(scopes: unknown, session: DealershipTenancySession | undefined) {
  return Array.isArray(scopes) && scopes.length > 0 && scopes.every(scope => {
    const required = typeof scope === "string" && API_SCOPE_PERMISSIONS[scope];
    return required && required.every(permission => hasAnyMembershipPermission(session, permission));
  });
}
export function apiKeyIsUsable(key: any, request: any, now = Date.now()) {
  if (key.status !== "active" || !key.userId) return false;
  if (key.expiresAt && (!Number.isFinite(Date.parse(String(key.expiresAt))) || Date.parse(String(key.expiresAt)) <= now)) return false;
  if (!Array.isArray(key.scopes) || !key.scopes.length || key.scopes.some((s: unknown) => typeof s !== "string" || !Object.hasOwn(API_SCOPE_PERMISSIONS, s))) return false;
  const allowed = key.restrictedToIPs;
  if (allowed != null && !Array.isArray(allowed)) return false;
  const actual = requestClientIp(request);
  return !allowed?.length || Boolean(actual && allowed.some((ip: unknown) => normalizeIp(ip) === actual));
}
