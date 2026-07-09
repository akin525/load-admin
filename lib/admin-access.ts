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

export type RouteKey =
    | "/dashboard"
    | "/admin"
    | "/action-requests"
    | "/bills"
    | "/general-ledger-bills"
    | "/deposits"
    | "/xpress-merchant-wallet"
    | "/users"
  | "/loans"
  | "/reconciliation"
  | "/reports"
  | "/fees"
  | "/system-settings"
  | "/wallet-transactions"
  | "/transfers"
  | "/audit-logs"
    | "/email-logs"
    | "/push-notification-logs"
    | "/security-events"
    | "/prembly-logs"
    | "/mixpanel-logs"
    | "/recent-kycs"
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

  const directKeys = [
    "data",
    "result",
    "results",
    "items",
    "payload",
    "permission",
    "permissions",
    "name",
    "title",
    "slug",
    "code",
    "key",
    "action",
    "resource",
    "module",
  ];
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

export type PermissionRequirement = string | string[];

const toKeywords = (requirement: PermissionRequirement): string[] =>
  Array.isArray(requirement)
    ? requirement.map((entry) => normalize(entry)).filter(Boolean)
    : normalize(requirement)
        .split(" ")
        .filter(Boolean);

const scopeMatchers: Record<string, string[][]> = {
  dashboard: [
    ["view", "dashboard", "d", "stat"],
    ["view", "dashboard", "d", "loans", "stat"],
    ["view", "dashboard", "d", "recent", "loan"],
    ["view", "dashboard", "d", "recent", "bill"],
    ["view", "dashboard", "d", "bills", "stat"],
  ],
  admin: [
    ["view", "admin"],
    ["create", "admin"],
    ["update", "admin"],
    ["view", "role"],
    ["create", "role"],
    ["update", "role"],
    ["view", "permission"],
    ["view", "kyc"],
    ["create", "kyc"],
    ["approval", "kyc"],
    ["view", "account", "tier"],
    ["create", "account", "tier"],
    ["update", "account", "tier"],
    ["view", "complaint"],
    ["reply", "complaint"],
    ["status", "complaint"],
    ["view", "livechat"],
    ["view", "contact"],
    ["create", "contact"],
    ["update", "contact"],
    ["view", "faq"],
    ["create", "faq"],
    ["update", "faq"],
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
  actionRequests: [["view", "action", "request"], ["reject", "action", "request"], ["approve"]],
  bills: [["view", "bill", "history"], ["view", "bill", "detail"], ["update", "bill", "fail", "reverse"], ["create", "bills", "apply", "vtpass", "webhook"]],
  generalLedgerBills: [["view", "general", "ledger", "bill"], ["view", "general", "ledger", "bills", "summary"], ["create", "general", "ledger", "bills", "backfill"]],
  deposits: [["view", "deposit"], ["view", "reconciliation", "deposit"]],
  xpressMerchant: [["view", "xpress", "wallet", "merchant"]],
  loans: [
    ["view", "other", "loan"],
    ["view", "loans", "list"],
    ["view", "loans", "package"],
    ["view", "loans", "detail"],
    ["view", "loans", "stat"],
    ["view", "loans", "recent"],
    ["view", "loan", "type"],
    ["create", "loan", "type"],
    ["update", "loan", "type"],
    ["view", "app", "loan"],
    ["create", "app", "loans", "score"],
    ["create", "app", "loans", "approve"],
    ["create", "app", "loans", "reject"],
    ["create", "app", "loans", "review"],
    ["create", "app", "loans", "close"],
    ["create", "app", "loans", "manual", "repayment", "approve"],
    ["create", "app", "loans", "manual", "repayment", "reject"],
    ["create", "app", "loans", "top", "up", "approve"],
    ["create", "app", "loans", "top", "up", "reject"],
    ["create", "loans", "approve"],
    ["create", "loans", "reject"],
    ["create", "loans", "review"],
    ["create", "loans", "close"],
    ["create", "loans", "create", "app", "loan"],
    ["create", "loans", "backfill", "app", "loan"],
    ["create", "loans", "sync", "bankone", "statu"],
    ["view", "bankone", "account", "officers", "sync"],
    ["create", "bankone", "configure"],
    ["create", "bankone", "institution", "code"],
    ["approve", "loan"],
    ["reject", "loan"],
    ["close", "loan"],
    ["approve", "loans", "close"],
    ["mark", "overdue", "loan"],
    ["approve", "app", "loan"],
    ["reject", "app", "loan"],
    ["approve", "app", "loans", "manual", "repayment"],
    ["reject", "app", "loans", "manual", "repayment"],
    ["close", "app", "loan"],
    ["approve", "app", "loans", "close"],
    ["mark", "overdue", "app", "loan"],
    ["reschedule", "app", "loan"],
    ["approve", "app", "loans", "reschedule"],
    ["approve", "app", "loans", "top", "up"],
    ["reject", "app", "loans", "top", "up"],
  ],
  reconciliation: [["view", "reconciliation", "overview"], ["view", "reconciliation", "deposit"], ["view", "reconciliation", "transfer"], ["view", "reconciliation", "webhook"]],
  reports: [
    ["view", "reports", "center"],
    ["view", "reports", "export"],
    ["view", "reports", "financial"],
    ["view", "reports", "loan", "performance"],
    ["view", "reports", "profit", "los"],
    ["view", "reports", "revenue"],
    ["view", "reports", "bill", "profit"],
    ["view", "reports", "payin", "payout", "profit"],
  ],
  fees: [
    ["view", "fee"],
    ["create", "fees", "default"],
    ["create", "users", "fee"],
    ["view", "users", "fee"],
    ["view", "fees", "resolve"],
    ["update", "fee"],
    ["remove", "fee"],
    ["view", "fees", "bill", "pricing"],
    ["create", "fees", "bill", "pricing"],
    ["update", "fees", "bill", "pricing"],
    ["create", "fees", "bill", "pricing", "calculate"],
  ],
  systemSettings: [
    ["view", "system", "setting"],
    ["create", "system", "settings", "bulk", "upsert"],
    ["create", "system", "settings", "upsert"],
    ["create", "system", "setting"],
    ["update", "system", "setting"],
    ["remove", "system", "setting"],
    ["create", "mixpanel", "test", "event"],
  ],
  walletTransactions: [["view", "wallet", "transaction"], ["reverse", "wallet", "transaction"], ["approve", "wallet", "transactions", "reverse"]],
  transfers: [["view", "transfer"], ["reverse", "transfer"], ["approve", "transfers", "reverse"]],
  auditLogs: [["view", "audit", "log"], ["view", "admins", "audit", "log"]],
  emailLogs: [["view", "email", "log"]],
  pushNotificationLogs: [["view", "push", "notification", "log"]],
  securityEvents: [["view", "security", "event"]],
  premblyLogs: [["view", "prembly", "log"]],
  mixpanelLogs: [["view", "mixpanel", "log"]],
  webhookLogs: [["view", "xpress", "webhook", "log"], ["view", "vtpass", "webhook", "log"], ["create", "vtpass", "webhook", "logs", "reproces"]],
};

const routeScopeMap: Record<RouteKey, string> = {
  "/dashboard": "dashboard",
  "/admin": "admin",
  "/action-requests": "actionRequests",
  "/bills": "bills",
  "/general-ledger-bills": "generalLedgerBills",
  "/deposits": "deposits",
  "/xpress-merchant-wallet": "xpressMerchant",
  "/users": "users",
  "/loans": "loans",
  "/reconciliation": "reconciliation",
  "/reports": "reports",
  "/fees": "fees",
  "/system-settings": "systemSettings",
  "/wallet-transactions": "walletTransactions",
  "/transfers": "transfers",
    "/audit-logs": "auditLogs",
  "/email-logs": "emailLogs",
  "/push-notification-logs": "pushNotificationLogs",
  "/security-events": "securityEvents",
  "/prembly-logs": "premblyLogs",
  "/mixpanel-logs": "mixpanelLogs",
  "/recent-kycs": "kyc",
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

export const canAccessPermission = (
  session: AdminSession | null,
  ...requirements: PermissionRequirement[]
) => {
  if (!session || !requirements.length) {
    return false;
  }

  return hasMatcher(
    session,
    requirements.map(toKeywords).filter((keywords) => keywords.length > 0),
  );
};

export const canAccessEveryPermission = (
  session: AdminSession | null,
  ...requirements: PermissionRequirement[]
) => {
  if (!session || !requirements.length) {
    return false;
  }

  return requirements.every((requirement) => canAccessPermission(session, requirement));
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

export const usePermissionAccess = (...requirements: PermissionRequirement[]) => {
  const session = useAdminSession();

  return useMemo(
    () => ({
      session,
      allowed: canAccessPermission(session, ...requirements),
    }),
    [session, ...requirements.map((requirement) =>
      Array.isArray(requirement) ? requirement.join("|") : requirement,
    )],
  );
};
