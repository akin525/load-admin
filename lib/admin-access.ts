"use client";

import { useMemo, useSyncExternalStore } from "react";

export const ADMIN_SESSION_KEY = "admin_session";
const ADMIN_SESSION_EVENT = "admin-session-changed";
let cachedSessionRaw: string | null | undefined;
let cachedSessionValue: AdminSession | null = null;

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

type AuthResponseLike = {
  data?: {
    admin?: unknown;
    user?: unknown;
    permissions?: unknown;
    role?: unknown;
  };
  admin?: unknown;
  user?: unknown;
  permissions?: unknown;
  role?: unknown;
};

type RouteKey =
  | "/dashboard"
  | "/admin"
  | "/action-requests"
  | "/bills"
  | "/deposits"
  | "/users"
  | "/loans"
  | "/reconciliation"
  | "/reports"
  | "/fees"
  | "/system-settings"
  | "/wallet-transactions"
  | "/transfers"
  | "/audit-logs"
  | "/security-events"
  | "/email-logs"
  | "/push-notification-logs"
  | "/faqs"
  | "/xpress-webhook-logs"
  | "/vtpass-webhook-logs";

export type AdminSectionKey = "admins" | "roles" | "kyc" | "tiers" | "support" | "content";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collectPermissionLabels = (value: unknown, collector: Set<string>) => {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    const normalized = normalize(value);
    if (normalized) {
      collector.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPermissionLabels(entry, collector));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directKeys = ["permission", "permissions", "name", "title", "slug", "code", "key", "action", "resource", "module"];
  directKeys.forEach((key) => {
    if (key in value) {
      collectPermissionLabels(value[key], collector);
    }
  });

  const moduleName = safeString(value.module);
  const actionName = safeString(value.action);
  const resourceName = safeString(value.resource);

  [[moduleName, actionName], [resourceName, actionName], [moduleName, resourceName]]
    .map((pair) => pair.filter(Boolean).join(" "))
    .forEach((entry) => {
      const normalized = normalize(entry);
      if (normalized) {
        collector.add(normalized);
      }
    });
};

const getRoleName = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  return safeString(value.name) || safeString(value.title) || safeString(value.role) || safeString(value.role_name);
};

const getRoleId = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  return safeString(value._id) || safeString(value.id) || safeString(value.roleId) || safeString(value.role_id);
};

export const extractAdminSession = (response: AuthResponseLike): AdminSession | null => {
  const adminRecord = response.data?.admin ?? response.admin;
  const userRecord = response.data?.user ?? response.user;
  const identityRecord = isRecord(userRecord) ? userRecord : adminRecord;

  if (!isRecord(adminRecord) && !isRecord(identityRecord)) {
    return null;
  }

  const adminSource = isRecord(adminRecord) ? adminRecord : {};
  const identitySource = isRecord(identityRecord) ? identityRecord : adminSource;

  const permissionSet = new Set<string>();
  collectPermissionLabels(adminSource.permissions, permissionSet);
  collectPermissionLabels(adminSource.role, permissionSet);
  collectPermissionLabels(identitySource.permissions, permissionSet);
  collectPermissionLabels(identitySource.role, permissionSet);
  collectPermissionLabels(response.data?.permissions, permissionSet);
  collectPermissionLabels(response.permissions, permissionSet);
  collectPermissionLabels(response.data?.role, permissionSet);
  collectPermissionLabels(response.role, permissionSet);

  return {
    id: safeString(adminSource._id) || safeString(adminSource.id) || safeString(adminSource.adminId) || safeString(identitySource._id) || safeString(identitySource.id),
    name:
      safeString(identitySource.name) ||
      [safeString(identitySource.first_name), safeString(identitySource.last_name)].filter(Boolean).join(" ") ||
      [safeString(identitySource.firstName), safeString(identitySource.lastName)].filter(Boolean).join(" ") ||
      safeString(identitySource.email) ||
      "Administrator",
    email: safeString(identitySource.email) || safeString(adminSource.email),
    roleId:
      getRoleId(adminSource.role) ||
      getRoleId(identitySource.role) ||
      getRoleId(response.data?.role) ||
      getRoleId(response.role) ||
      safeString(adminSource.roleId) ||
      safeString(adminSource.role_id) ||
      safeString(identitySource.roleId) ||
      safeString(identitySource.role_id),
    roleName:
      getRoleName(adminSource.role) ||
      getRoleName(identitySource.role) ||
      safeString(adminSource.roleName) ||
      safeString(adminSource.role_name) ||
      safeString(adminSource.role) ||
      safeString(identitySource.roleName) ||
      safeString(identitySource.role_name) ||
      safeString(identitySource.role) ||
      "Administrator",
    permissions: Array.from(permissionSet),
  };
};

export const withRolePermissions = (session: AdminSession, payload: unknown): AdminSession => {
  const permissionSet = new Set<string>();
  collectPermissionLabels(payload, permissionSet);
  const payloadData = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const nextRoleId = payloadData ? safeString(payloadData.roleId) : "";
  const nextRoleName = payloadData ? safeString(payloadData.roleName) : "";

  return {
    ...session,
    roleId: nextRoleId || session.roleId,
    roleName: nextRoleName || session.roleName,
    permissions: permissionSet.size ? Array.from(permissionSet) : session.permissions,
  };
};

const emitSessionChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_SESSION_EVENT));
  }
};

export const persistAdminSession = (session: AdminSession | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    cachedSessionRaw = null;
    cachedSessionValue = null;
  } else {
    const serialized = JSON.stringify(session);
    localStorage.setItem(ADMIN_SESSION_KEY, serialized);
    cachedSessionRaw = serialized;
    cachedSessionValue = session;
  }

  emitSessionChange();
};

export const clearAdminSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ADMIN_SESSION_KEY);
  cachedSessionRaw = null;
  cachedSessionValue = null;
  emitSessionChange();
};

export const getStoredAdminSession = (): AdminSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(ADMIN_SESSION_KEY);

  if (!raw) {
    cachedSessionRaw = null;
    cachedSessionValue = null;
    return null;
  }

  if (raw === cachedSessionRaw) {
    return cachedSessionValue;
  }

  try {
    const parsed = JSON.parse(raw) as AdminSession;
    cachedSessionRaw = raw;
    cachedSessionValue = parsed && Array.isArray(parsed.permissions) ? parsed : null;
    return cachedSessionValue;
  } catch {
    cachedSessionRaw = raw;
    cachedSessionValue = null;
    return null;
  }
};

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === ADMIN_SESSION_KEY) {
      callback();
    }
  };

  const onCustom = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(ADMIN_SESSION_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ADMIN_SESSION_EVENT, onCustom);
  };
};

const getSnapshot = () => getStoredAdminSession();

export const useAdminSession = () => useSyncExternalStore(subscribe, getSnapshot, () => null);

const scopeMatchers: Record<string, string[][]> = {
  dashboard: [[]],
  admin: [
    ["admin"],
    ["role"],
    ["permission"],
    ["kyc"],
    ["tier"],
    ["account", "tier"],
    ["complaint"],
    ["livechat"],
    ["contact"],
    ["faq"],
  ],
  admins: [["view", "admin"], ["create", "admin"], ["update", "admin"], ["admin"]],
  roles: [["view", "role"], ["create", "role"], ["update", "role"], ["view", "permission"], ["role"], ["permission"]],
  kyc: [["view", "kyc"], ["create", "kyc"], ["approval", "kyc"], ["kyc"]],
  tiers: [["view", "account", "tier"], ["create", "account", "tier"], ["update", "account", "tier"], ["tier"]],
  support: [
    ["view", "complaint"],
    ["reply", "complaint"],
    ["status", "complaint"],
    ["view", "livechat"],
    ["complaint"],
    ["support"],
    ["livechat"],
  ],
  content: [
    ["view", "contact"],
    ["create", "contact"],
    ["update", "contact"],
    ["view", "faq"],
    ["create", "faq"],
    ["update", "faq"],
    ["view", "complaint", "category"],
    ["create", "complaint", "category"],
    ["faq"],
    ["contact"],
    ["complaint", "category"],
  ],
  users: [
    ["view", "user", "list"],
    ["create", "user", "create"],
    ["view", "user", "detail"],
    ["view", "users", "virtual", "account"],
    ["view", "users", "loan"],
    ["view", "users", "wallet"],
    ["view", "users", "bill"],
    ["view", "users", "kyc"],
    ["broadcast", "user"],
    ["view", "users", "dashboard"],
    ["user"],
    ["customer"],
  ],
  actionRequests: [["action", "request"], ["approval"], ["approve"], ["maker"], ["checker"], ["admin"]],
  bills: [["view", "bill"], ["bill"], ["billing"], ["vtpass"]],
  deposits: [["view", "deposit"], ["deposit"], ["funding"], ["payin"], ["wallet"]],
  loans: [
    ["view", "loan"],
    ["view", "loans"],
    ["create", "loan"],
    ["create", "loans"],
    ["approve", "loan"],
    ["reject", "loan"],
    ["bankone"],
    ["app", "loan"],
    ["other", "loan"],
    ["loan"],
  ],
  reconciliation: [["reconciliation"], ["reconcile"], ["deposit"], ["transfer"], ["webhook"], ["settlement"]],
  reports: [["report"], ["financial"], ["revenue"], ["profit"], ["audit", "report"]],
  fees: [["fee"]],
  systemSettings: [
    ["system", "setting"],
    ["view", "setting"],
    ["create", "setting"],
    ["update", "setting"],
    ["delete", "setting"],
    ["bankone", "setting"],
    ["payment", "setting"],
    ["security", "setting"],
    ["email", "setting"],
    ["loan", "setting"],
    ["general", "setting"],
  ],
  walletTransactions: [["wallet", "transaction"], ["wallet"], ["transaction"], ["ledger"]],
  transfers: [["transfer"], ["payout"], ["disbursement"]],
  auditLogs: [["audit", "log"], ["audit"], ["log"]],
  securityEvents: [["security", "event"], ["security"], ["session"], ["login"], ["otp"], ["auth"], ["allowlist"], ["ip"]],
  emailLogs: [["email", "log"], ["mail", "log"], ["email"], ["mail"], ["template"]],
  pushNotificationLogs: [["push", "notification"], ["notification", "log"], ["push"], ["firebase"], ["notification"]],
  webhookLogs: [["webhook", "log"], ["webhook"], ["xpress"]],
};

const routeScopeMap: Record<RouteKey, string> = {
  "/dashboard": "dashboard",
  "/admin": "admin",
  "/action-requests": "actionRequests",
  "/bills": "bills",
  "/deposits": "deposits",
  "/users": "users",
  "/loans": "loans",
  "/reconciliation": "reconciliation",
  "/reports": "reports",
  "/fees": "fees",
  "/system-settings": "systemSettings",
  "/wallet-transactions": "walletTransactions",
  "/transfers": "transfers",
  "/audit-logs": "auditLogs",
  "/security-events": "securityEvents",
  "/email-logs": "emailLogs",
  "/push-notification-logs": "pushNotificationLogs",
  "/faqs": "content",
  "/xpress-webhook-logs": "webhookLogs",
  "/vtpass-webhook-logs": "webhookLogs",
};

const sectionScopeMap: Record<AdminSectionKey, string> = {
  admins: "admins",
  roles: "roles",
  kyc: "kyc",
  tiers: "tiers",
  support: "support",
  content: "content",
};

const hasMatcher = (session: AdminSession, matchers: string[][]) => {
  const role = normalize(session.roleName);

  if (/(super admin|superuser|owner|root)/.test(role)) {
    return true;
  }

  if (session.permissions.some((permission) => permission === "*" || permission === "all" || permission === "full access")) {
    return true;
  }

  return matchers.some((keywords) => {
    if (!keywords.length) {
      return true;
    }

    return session.permissions.some((permission) => keywords.every((keyword) => permission.includes(keyword)));
  });
};

export const canAccessScope = (session: AdminSession | null, scope: string) => {
  if (!session) {
    return false;
  }

  const matchers = scopeMatchers[scope];

  if (!matchers) {
    return false;
  }

  return hasMatcher(session, matchers);
};

export const canAccessRoute = (session: AdminSession | null, route: RouteKey) =>
  canAccessScope(session, routeScopeMap[route]);

export const canAccessAdminSection = (session: AdminSession | null, section: AdminSectionKey) =>
  canAccessScope(session, sectionScopeMap[section]);

export const useRouteAccess = (route: RouteKey) => {
  const session = useAdminSession();

  return useMemo(
    () => ({
      session,
      allowed: canAccessRoute(session, route),
    }),
    [session, route],
  );
};
