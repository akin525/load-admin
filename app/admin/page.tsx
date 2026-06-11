"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { canAccessAdminSection, canAccessRoute, useAdminSession } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";

type AdminSection = "admins" | "roles" | "users" | "kyc" | "loans" | "tiers" | "support" | "content" | "reports";
type DataKey =
  | "admins"
  | "roles"
  | "permissions"
  | "users"
  | "kycs"
  | "loans"
  | "loanPackages"
  | "loanStats"
  | "recentLoans"
  | "accountTiers"
  | "complaints"
  | "complaintCategories"
  | "contactUs"
  | "faqs"
  | "liveChat"
  | "loanTypes"
  | "appLoans";

type ReportKey = "financial" | "loanPerformance" | "profitLoss" | "revenue";

type AdminCenterData = Record<DataKey, unknown> & {
  errors: Partial<Record<DataKey, string>>;
};

type ReportFilters = {
  fromDate: string;
  toDate: string;
};

type ReportState = {
  data: Partial<Record<ReportKey, unknown>>;
  errors: Partial<Record<ReportKey, string>>;
  loaded: boolean;
  loading: boolean;
};

type DetailState = {
  title: string;
  loading: boolean;
  data: unknown;
  error: string;
};

type UserDashboardTab = "overview" | "transactions";

type UserTransactionFilters = {
  fromDate: string;
  toDate: string;
  status: string;
  limit: string;
};

type UserDashboardState = DetailState & {
  userId: string;
  userName: string;
};

type UserTransactionsState = DetailState & {
  loaded: boolean;
};

type AppLoanDetailState = DetailState;
type BankoneSyncResultState = DetailState;

type FormField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "email" | "tel" | "text" | "textarea" | "select";
  required?: boolean;
  helper?: string;
  options?: Array<{ label: string; value: string; description?: string }>;
};

type FormAction = {
  title: string;
  eyebrow: string;
  description: string;
  submitLabel: string;
  fields: FormField[];
  initialValues?: Record<string, string>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
};

const endpoints: Array<[DataKey, () => Promise<unknown>]> = [
  ["admins", adminService.getAdmins],
  ["roles", adminService.getRoles],
  ["permissions", adminService.getPermissions],
  ["users", () => adminService.getUsers()],
  ["kycs", adminService.getKycs],
  ["loans", () => adminService.getLoansList()],
  ["loanPackages", adminService.getLoanPackages],
  ["loanStats", adminService.getAdminLoansStats],
  ["recentLoans", adminService.getAdminRecentLoans],
  ["accountTiers", adminService.getAccountTiers],
  ["complaints", adminService.getComplaints],
  ["complaintCategories", adminService.getComplaintCategories],
  ["contactUs", adminService.getContactUs],
  ["faqs", adminService.getFaqs],
  ["liveChat", adminService.getLiveChat],
  ["loanTypes", adminService.getLoanTypes],
  ["appLoans", () => adminService.getAppLoans()],
];

const sections: Array<{ key: AdminSection; label: string; icon: typeof Users }> = [
  { key: "admins", label: "Admins", icon: ShieldCheck },
  { key: "roles", label: "Roles", icon: UserCog },
  { key: "kyc", label: "KYC", icon: FileCheck2 },
  { key: "tiers", label: "Tiers", icon: BadgeCheck },
  { key: "support", label: "Support", icon: Send },
  { key: "content", label: "Content", icon: BriefcaseBusiness },
];

const reportRequests: Array<[ReportKey, (params: Record<string, string>) => Promise<unknown>]> = [
  ["financial", adminService.getFinancialReport],
  ["loanPerformance", adminService.getLoanPerformanceReport],
  ["profitLoss", adminService.getProfitLossReport],
  ["revenue", adminService.getRevenueReport],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumericLike = (value: unknown) =>
  typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultReportFilters = (): ReportFilters => {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
  };
};

const getDefaultUserTransactionFilters = (): UserTransactionFilters => ({
  fromDate: "",
  toDate: "",
  status: "",
  limit: "50",
});

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

const extractRows = (payload: unknown): Record<string, unknown>[] => {
  const value = unwrapPayload(payload);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.data)) {
    return value.data.filter(isRecord);
  }

  const list = Object.values(value).find(Array.isArray);
  return Array.isArray(list) ? list.filter(isRecord) : [];
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);

    if (!Number.isNaN(numeric) && value.trim().length <= 16) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
    }

    return value;
  }

  return "0";
};

const formatCurrency = (value: unknown): string => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numeric)) {
    return formatValue(value);
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatDate = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number") {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatFieldValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (isRecord(value)) {
    return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  }

  if (/(date|at)$/i.test(key) || /date/i.test(key)) {
    return formatDate(value);
  }

  if (isNumericLike(value)) {
    return /(amount|revenue|profit|loss|income|expense|interest|balance|payable|paid|outstanding|disbursed|collection|fee|earning)/i.test(key)
      ? formatCurrency(value)
      : formatValue(value);
  }

  return String(value);
};

const extractReportMetrics = (payload: unknown) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [] as Array<{ label: string; value: string }>;
  }

  const metrics: Array<{ label: string; value: string }> = [];

  Object.entries(data).forEach(([key, value]) => {
    if (metrics.length >= 6) {
      return;
    }

    if (isNumericLike(value)) {
      metrics.push({ label: formatLabel(key), value: formatFieldValue(key, value) });
      return;
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, childValue]) => {
        if (metrics.length >= 6 || !isNumericLike(childValue)) {
          return;
        }

        metrics.push({
          label: `${formatLabel(key)} ${formatLabel(childKey)}`,
          value: formatFieldValue(childKey, childValue),
        });
      });
    }
  });

  return metrics;
};

const extractReportDetails = (payload: unknown) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [] as Array<{ label: string; value: string }>;
  }

  const details: Array<{ label: string; value: string }> = [];

  Object.entries(data).forEach(([key, value]) => {
    if (details.length >= 8) {
      return;
    }

    if (Array.isArray(value) || isRecord(value) || isNumericLike(value)) {
      return;
    }

    details.push({ label: formatLabel(key), value: formatFieldValue(key, value) });
  });

  return details;
};

const getReportColumns = (rows: Record<string, unknown>[]) => {
  const firstRow = rows[0];
  if (!firstRow) {
    return [] as string[];
  }

  return Object.keys(firstRow).filter((key) => !isRecord(firstRow[key]) && !Array.isArray(firstRow[key])).slice(0, 6);
};

const getReportLead = (payload: unknown) => {
  const metrics = extractReportMetrics(payload);
  if (metrics.length) {
    return metrics[0];
  }

  const rows = extractRows(payload);
  return {
    label: "Records",
    value: formatValue(rows.length),
  };
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Request failed";
};

const getId = (row: Record<string, unknown>) => String(getRecordValue(row, ["_id", "id", "userId", "loanId"]) ?? "");

const getPersonName = (row: Record<string, unknown>) => {
  const combined = [row.first_name, row.last_name].filter((item) => typeof item === "string").join(" ");
  return combined || String(getRecordValue(row, ["name", "fullName", "email", "phone"]) ?? "Unnamed record");
};

const getCollectionRows = (payload: unknown, key: string) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [];
  }

  return extractRows(data[key]);
};

const getCollectionTotal = (payload: unknown, key: string) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data) || !isRecord(data[key])) {
    return getCollectionRows(payload, key).length;
  }

  const total = data[key].total;
  return typeof total === "number" ? total : getCollectionRows(payload, key).length;
};

const getDashboardCollection = (payload: unknown, key: "virtualAccounts" | "wallets" | "loans") => getCollectionRows(payload, key);

const getDashboardTotal = (payload: unknown, key: "virtualAccounts" | "wallets" | "loans") => getCollectionTotal(payload, key);

const sumCurrencyRows = (rows: Record<string, unknown>[], keys: string[]) =>
  rows.reduce((total, row) => {
    const value = getRecordValue(row, keys);
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isNaN(numeric) ? total : total + numeric;
  }, 0);

const fetchAdminCenter = async (): Promise<AdminCenterData> => {
  const results = await Promise.allSettled(endpoints.map(([, request]) => request()));
  const data = {} as Record<DataKey, unknown>;
  const errors: Partial<Record<DataKey, string>> = {};

  results.forEach((result, index) => {
    const key = endpoints[index][0];

    if (result.status === "fulfilled") {
      data[key] = result.value;
    } else {
      data[key] = null;
      errors[key] = getErrorMessage(result.reason);
    }
  });

  return {
    admins: data.admins,
    roles: data.roles,
    permissions: data.permissions,
    users: data.users,
    kycs: data.kycs,
    loans: data.loans,
    loanPackages: data.loanPackages,
    loanStats: data.loanStats,
    recentLoans: data.recentLoans,
    accountTiers: data.accountTiers,
    complaints: data.complaints,
    complaintCategories: data.complaintCategories,
    contactUs: data.contactUs,
    faqs: data.faqs,
    liveChat: data.liveChat,
    loanTypes: data.loanTypes,
    appLoans: data.appLoans,
    errors,
  };
};

const fetchReports = async (filters: ReportFilters): Promise<ReportState> => {
  const params: Record<string, string> = {};

  if (filters.fromDate) {
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    params.toDate = filters.toDate;
  }

  const results = await Promise.allSettled(reportRequests.map(([, request]) => request(params)));
  const data: Partial<Record<ReportKey, unknown>> = {};
  const errors: Partial<Record<ReportKey, string>> = {};

  results.forEach((result, index) => {
    const key = reportRequests[index][0];

    if (result.status === "fulfilled") {
      data[key] = result.value;
      return;
    }

    data[key] = null;
    errors[key] = getErrorMessage(result.reason);
  });

  return {
    data,
    errors,
    loaded: true,
    loading: false,
  };
};

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const isSuccess = ["active", "approved", "success", "successful", "completed"].includes(normalized);
  const isFailed = ["inactive", "failed", "rejected", "declined", "disabled"].includes(normalized);
  const classes = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
    : isFailed
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {String(status ?? "Pending")}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#069AFF]/40 hover:shadow-lg hover:shadow-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/40">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
      {label}
    </div>
  );
}

function DetailGrid({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
          </div>
        ))}
        {!items.length && <EmptyPanel label="No snapshot data returned." />}
      </div>
    </section>
  );
}

function TransactionTimeline({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <h3 className="font-bold text-slate-950 dark:text-white">Timeline</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Operational events returned for this customer.</p>
        </div>
        <span className="rounded-md bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
          {formatValue(rows.length)}
        </span>
      </div>
      <div className="max-h-[24rem] overflow-y-auto p-4">
        {rows.length ? (
          <div className="space-y-4">
            {rows.map((row, index) => {
              const title = String(getRecordValue(row, ["title", "event", "type", "status"]) ?? `Timeline event ${index + 1}`);
              const note = String(getRecordValue(row, ["note", "description", "message"]) ?? "No note available");
              const amount = getRecordValue(row, ["amount", "paidAmount", "totalAmount"]);

              return (
                <div key={getId(row) || `${title}-${index}`} className="relative pl-7">
                  <span className="absolute left-0 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#069AFF]/30 bg-[#069AFF]/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#069AFF]" />
                  </span>
                  {index < rows.length - 1 && <span className="absolute left-[6px] top-5 h-[calc(100%-0.25rem)] w-px bg-slate-200 dark:bg-white/10" />}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{formatLabel(title)}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt", "date"]))}</p>
                      </div>
                      {amount !== undefined && <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(amount)}</p>}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel label="No timeline events returned." />
        )}
      </div>
    </section>
  );
}

function TransactionStreamCard({
  title,
  subtitle,
  rows,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  rows: Record<string, unknown>[];
  icon: typeof Users;
}) {
  const totalAmount = sumCurrencyRows(rows, ["amount", "totalAmount", "paidAmount"]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-950 dark:text-white">{formatCurrency(totalAmount)}</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{formatValue(rows.length)} records</p>
        </div>
      </div>
      <div className="max-h-[24rem] overflow-y-auto p-4">
        {rows.length ? (
          <div className="space-y-3">
            {rows.map((row, index) => {
              const details = isRecord(row.details) ? row.details : null;
              const typeValue = getRecordValue(row, ["type"]);
              const categoryValue = getRecordValue(row, ["category", "billType", "transactionType"]);
              const titleValue = String(
                getRecordValue(row, ["note", "reference", "transactionType", "category"]) ??
                  getRecordValue(details ?? {}, ["accountName", "recipient", "serviceID"]) ??
                  `Record ${index + 1}`,
              );
              const contextValues = [
                getRecordValue(row, ["reference"]),
                getRecordValue(row, ["provider", "source"]),
                getRecordValue(details ?? {}, ["accountName", "bankName", "recipient", "customerAccountNo", "serviceID"]),
              ]
                .filter((value) => typeof value === "string" && value.trim())
                .slice(0, 3)
                .join(" • ");

              return (
                <div key={getId(row) || `${titleValue}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{titleValue}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{contextValues || "No additional context"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount", "totalAmount", "paidAmount"]))}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={getRecordValue(row, ["status"]) ?? "success"} />
                    {typeValue !== null && typeValue !== undefined && String(typeValue).trim() !== "" && (
                      <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {String(typeValue)}
                      </span>
                    )}
                    {categoryValue !== null && categoryValue !== undefined && String(categoryValue).trim() !== "" && (
                      <span className="rounded-md border border-[#069AFF]/20 bg-[#069AFF]/6 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#069AFF] dark:text-sky-200">
                        {String(categoryValue)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel label={`No ${title.toLowerCase()} returned.`} />
        )}
      </div>
    </section>
  );
}

function ReportPanel({
  title,
  description,
  payload,
  error,
  icon: Icon,
}: {
  title: string;
  description: string;
  payload: unknown;
  error?: string;
  icon: typeof Users;
}) {
  const metrics = extractReportMetrics(payload);
  const details = extractReportDetails(payload);
  const rows = extractRows(payload);
  const columns = getReportColumns(rows);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">{title}</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">{description}</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-5 p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}

        {!error && metrics.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        )}

        {!error && details.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{detail.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{detail.value}</p>
              </div>
            ))}
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3">{formatLabel(column)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rows.slice(0, 8).map((row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      {columns.map((column) => (
                        <td key={`${column}-${index}`} className="px-4 py-3 font-medium">
                          {formatFieldValue(column, row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!error && !metrics.length && !details.length && !rows.length && <EmptyPanel label="No report data returned for this period." />}
      </div>
    </section>
  );
}

function DetailModal({ detail, onClose }: { detail: DetailState; onClose: () => void }) {
  const data = unwrapPayload(detail.data);
  const entries = isRecord(data) ? Object.entries(data).slice(0, 36) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Admin center record
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{detail.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[76vh] overflow-y-auto p-5">
          {detail.loading && (
            <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading details
            </div>
          )}
          {detail.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {detail.error}
            </div>
          )}
          {!detail.loading && !detail.error && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {formatLabel(key)}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                    {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "Not available")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionModal({ action, onClose }: { action: FormAction; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(action.initialValues ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const featuredFields = action.fields.slice(0, 2);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await action.onSubmit(values);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="border-b border-[#069AFF]/15 bg-[linear-gradient(135deg,#f8fbff_0%,#edf6ff_60%,#ffffff_100%)] px-6 py-6 dark:border-white/10 dark:bg-[linear-gradient(135deg,#08111f_0%,#0b2039_60%,#07111f_100%)]">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF] dark:text-sky-300">
                {action.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{action.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
              aria-label="Close form"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {featuredFields.map((field) => {
              const value = values[field.name] ?? "";
              const selectedOption = field.options?.find((option) => option.value === value);
              return (
                <div key={field.name} className="rounded-2xl border border-[#069AFF]/10 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{field.label}</p>
                  <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">
                    {selectedOption?.label || value || field.placeholder || "Not set"}
                  </p>
                  {(selectedOption?.description || field.helper) && (
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {selectedOption?.description || field.helper}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15 dark:text-sky-300">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">Provisioning details</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Assign identity and access in one step.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {action.fields.map((field) => {
                const fieldValue = values[field.name] ?? "";
                const sharedClassName =
                  "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-[#069AFF] dark:focus:ring-[#069AFF]/15";

                return (
                  <label key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{field.label}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        required={field.required}
                        value={fieldValue}
                        placeholder={field.placeholder}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        rows={4}
                        className={`${sharedClassName} resize-none`}
                      />
                    ) : field.type === "select" ? (
                      <select
                        required={field.required}
                        value={fieldValue}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        className={sharedClassName}
                      >
                        <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required={field.required}
                        type={field.type ?? "text"}
                        value={fieldValue}
                        placeholder={field.placeholder}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        className={sharedClassName}
                      />
                    )}
                    {field.helper && <span className="mt-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{field.helper}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-1 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#069AFF] px-6 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#069AFF] dark:text-white dark:hover:bg-[#27a7ff]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {action.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserDashboardModal({ dashboard, onClose }: { dashboard: UserDashboardState; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<UserDashboardTab>("overview");
  const [transactionFilters, setTransactionFilters] = useState<UserTransactionFilters>(() => getDefaultUserTransactionFilters());
  const [transactions, setTransactions] = useState<UserTransactionsState>({
    title: "User transactions",
    loading: false,
    data: null,
    error: "",
    loaded: false,
  });

  const virtualAccounts = getDashboardCollection(dashboard.data, "virtualAccounts");
  const wallets = getDashboardCollection(dashboard.data, "wallets");
  const loans = getDashboardCollection(dashboard.data, "loans");
  const walletBalance = sumCurrencyRows(wallets, ["balance", "availableBalance", "amount"]);

  const summary = [
    { label: "Virtual accounts", value: formatValue(getDashboardTotal(dashboard.data, "virtualAccounts")), icon: Landmark },
    { label: "Wallet balance", value: formatCurrency(walletBalance), icon: WalletCards },
    { label: "Loan records", value: formatValue(getDashboardTotal(dashboard.data, "loans")), icon: CreditCard },
  ];

  const loadUserTransactions = async (filters: UserTransactionFilters) => {
    setTransactions((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const params = Object.entries(filters).reduce<Record<string, string | number>>((accumulator, [key, value]) => {
        if (!value.trim()) {
          return accumulator;
        }

        accumulator[key] = key === "limit" ? Number(value) : value;
        return accumulator;
      }, {});

      const data = await adminService.getUserTransactions(dashboard.userId, params);
      setTransactions({
        title: "User transactions",
        loading: false,
        data,
        error: "",
        loaded: true,
      });
    } catch (error) {
      setTransactions({
        title: "User transactions",
        loading: false,
        data: null,
        error: getErrorMessage(error),
        loaded: true,
      });
    }
  };

  const handleTabChange = (nextTab: UserDashboardTab) => {
    setActiveTab(nextTab);

    if (nextTab === "transactions" && !transactions.loaded && !transactions.loading) {
      void loadUserTransactions(transactionFilters);
    }
  };

  const transactionSnapshot = useMemo(() => {
    const payload = unwrapPayload(transactions.data);
    const record = isRecord(payload) ? payload : null;
    const summaryRecord = record && isRecord(record.summary) ? record.summary : null;
    const walletTransactions = record ? getCollectionRows(record, "walletTransactions") : [];
    const deposits = record ? getCollectionRows(record, "deposits") : [];
    const bills = record ? getCollectionRows(record, "bills") : [];
    const payouts = record ? [...getCollectionRows(record, "payouts"), ...getCollectionRows(record, "transfers")] : [];
    const timeline = record ? getCollectionRows(record, "timeline") : [];
    const summaryItems = summaryRecord
      ? Object.entries(summaryRecord)
          .filter(([, value]) => !Array.isArray(value) && !isRecord(value))
          .slice(0, 8)
          .map(([key, value]) => ({
            label: formatLabel(key),
            value: formatFieldValue(key, value),
          }))
      : [];

    const cards = [
      { label: "Wallet transactions", value: formatValue(getCollectionTotal(record, "walletTransactions")), icon: WalletCards },
      { label: "Deposits", value: formatValue(getCollectionTotal(record, "deposits")), icon: Landmark },
      { label: "Bills", value: formatValue(getCollectionTotal(record, "bills")), icon: CreditCard },
      {
        label: "Payouts & transfers",
        value: formatValue(payouts.length),
        icon: Send,
      },
    ];

    return {
      cards,
      summaryItems,
      timeline,
      walletTransactions,
      deposits,
      bills,
      payouts,
    };
  }, [transactions.data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Customer finance dashboard</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{dashboard.userName}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Full customer operations view covering core balances, lending position, and account transaction history.
            </p>
            <div className="mt-3 inline-flex rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-sky-100">
              {dashboard.userId}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close user dashboard"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex flex-wrap gap-2">
            {[
              {
                key: "overview" as const,
                label: "Overview",
                description: "Accounts, wallets, and loans",
              },
              {
                key: "transactions" as const,
                label: "Transactions",
                description: "Wallet, deposits, bills, and transfers",
              },
            ].map((tab) => {
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#069AFF]/25 bg-white text-slate-950 shadow-sm shadow-[#069AFF]/10 dark:border-[#069AFF]/35 dark:bg-[#069AFF]/10 dark:text-white"
                      : "border-slate-200 bg-transparent text-slate-600 hover:border-[#069AFF]/25 hover:bg-white hover:text-[#069AFF] dark:border-white/10 dark:text-slate-300 dark:hover:border-[#069AFF]/35 dark:hover:bg-white/[0.045] dark:hover:text-sky-200"
                  }`}
                >
                  <p className="text-sm font-bold">{tab.label}</p>
                  <p className={`mt-1 text-xs font-medium ${active ? "text-slate-500 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                    {tab.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[76vh] overflow-y-auto p-5">
          {activeTab === "overview" ? (
            <>
              {dashboard.loading && (
                <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Loading customer dashboard
                </div>
              )}

              {dashboard.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {dashboard.error}
                </div>
              )}

              {!dashboard.loading && !dashboard.error && (
                <div className="grid gap-5">
                  <section className="grid gap-4 md:grid-cols-3">
                    {summary.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:text-sky-200">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <p className="text-2xl font-bold text-slate-950 dark:text-white">{item.value}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        </div>
                      );
                    })}
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                        <h3 className="font-bold text-slate-950 dark:text-white">Virtual accounts</h3>
                      </div>
                      <div className="grid gap-3 p-4">
                        {virtualAccounts.map((account, index) => (
                          <div key={getId(account) || index} className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-950 dark:text-white">{String(getRecordValue(account, ["accountName", "name"]) ?? `Account ${index + 1}`)}</p>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-[#069AFF]">{String(getRecordValue(account, ["accountNumber"]) ?? "No account number")}</p>
                              </div>
                              <StatusBadge status={getRecordValue(account, ["status"]) ?? "ACTIVE"} />
                            </div>
                            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Bank</p>
                                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{String(getRecordValue(account, ["bankName"]) ?? "Not available")}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Currency</p>
                                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{String(getRecordValue(account, ["currency"]) ?? "NGN")}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Provider</p>
                                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{String(getRecordValue(account, ["provider", "bankCode"]) ?? "Not available")}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!virtualAccounts.length && <EmptyPanel label="No virtual accounts returned." />}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                        <h3 className="font-bold text-slate-950 dark:text-white">Wallets</h3>
                      </div>
                      <div className="grid gap-3 p-4">
                        {wallets.map((wallet, index) => (
                          <div key={getId(wallet) || index} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-950 dark:text-white">{formatLabel(String(getRecordValue(wallet, ["type"]) ?? `Wallet ${index + 1}`))}</p>
                                <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(wallet, ["balance"]))}</p>
                              </div>
                              <span className="rounded-md bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                                {String(getRecordValue(wallet, ["currency"]) ?? "NGN")}
                              </span>
                            </div>
                            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(wallet, ["updatedAt", "createdAt"]))}</p>
                          </div>
                        ))}
                        {!wallets.length && <EmptyPanel label="No wallets returned." />}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">Loans</h3>
                    </div>
                    <div className="grid gap-3 p-4">
                      {loans.map((loan, index) => (
                        <div key={getId(loan) || index} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div>
                            <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(loan, ["purpose", "packageName", "loanId"]) ?? `Loan ${index + 1}`)}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(loan, ["createdAt", "applicationDate", "updatedAt"]))}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(loan, ["amount", "loanAmount", "principal"]))}</p>
                            <StatusBadge status={getRecordValue(loan, ["status"]) ?? "pending"} />
                          </div>
                        </div>
                      ))}
                      {!loans.length && <EmptyPanel label="No loan records returned." />}
                    </div>
                  </section>
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-5">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Transactions intelligence</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Customer transaction monitor</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Wallet movements, funding, bill activity, payouts, and timeline events for this customer.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadUserTransactions(transactionFilters)}
                      disabled={transactions.loading}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                    >
                      <RefreshCw className={`h-4 w-4 ${transactions.loading ? "animate-spin" : ""}`} aria-hidden="true" />
                      Refresh
                    </button>
                  </div>
                </div>
                <form
                  className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadUserTransactions(transactionFilters);
                  }}
                >
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">From date</span>
                    <input
                      type="date"
                      value={transactionFilters.fromDate}
                      onChange={(event) => setTransactionFilters((current) => ({ ...current, fromDate: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">To date</span>
                    <input
                      type="date"
                      value={transactionFilters.toDate}
                      onChange={(event) => setTransactionFilters((current) => ({ ...current, toDate: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Status</span>
                    <select
                      value={transactionFilters.status}
                      onChange={(event) => setTransactionFilters((current) => ({ ...current, status: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    >
                      <option value="">All statuses</option>
                      <option value="success">Success</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Limit</span>
                    <select
                      value={transactionFilters.limit}
                      onChange={(event) => setTransactionFilters((current) => ({ ...current, limit: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = getDefaultUserTransactionFilters();
                      setTransactionFilters(defaults);
                      void loadUserTransactions(defaults);
                    }}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={transactions.loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/20 transition hover:bg-[#0588e0] disabled:opacity-60"
                  >
                    {transactions.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BarChart3 className="h-4 w-4" aria-hidden="true" />}
                    Apply filters
                  </button>
                </form>
              </section>

              {transactions.loading && !transactions.data && (
                <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Loading customer transactions
                </div>
              )}

              {transactions.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {transactions.error}
                </div>
              )}

              {!transactions.loading && !transactions.error && (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {transactionSnapshot.cards.map((item) => (
                      <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
                    ))}
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <TransactionTimeline rows={transactionSnapshot.timeline} />
                    <DetailGrid title="Summary snapshot" items={transactionSnapshot.summaryItems} />
                  </section>

                  <section className="grid gap-5 xl:grid-cols-2">
                    <TransactionStreamCard
                      title="Wallet transactions"
                      subtitle="Full wallet movement stream for this customer."
                      rows={transactionSnapshot.walletTransactions}
                      icon={WalletCards}
                    />
                    <TransactionStreamCard
                      title="Deposits"
                      subtitle="Funding records captured for this customer."
                      rows={transactionSnapshot.deposits}
                      icon={Landmark}
                    />
                    <TransactionStreamCard
                      title="Bills"
                      subtitle="Bill payment activity and reversals."
                      rows={transactionSnapshot.bills}
                      icon={CreditCard}
                    />
                    <TransactionStreamCard
                      title="Payouts & transfers"
                      subtitle="Outbound payouts and transfer-related records."
                      rows={transactionSnapshot.payouts}
                      icon={Send}
                    />
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppLoanDetailsModal({ loan, onClose }: { loan: AppLoanDetailState; onClose: () => void }) {
  const data = unwrapPayload(loan.data);
  const record = isRecord(data) ? data : {};
  const repaymentSchedule = Array.isArray(record.repaymentSchedule) ? record.repaymentSchedule.filter(isRecord) : [];
  const topUpHistory = Array.isArray(record.topUpHistory) ? record.topUpHistory.filter(isRecord) : [];
  const activityLog = Array.isArray(record.activityLog) ? record.activityLog.filter(isRecord) : [];

  const summary = [
    { label: "Requested amount", value: formatCurrency(record.amount), icon: CreditCard },
    { label: "Total payable", value: formatCurrency(record.totalPayable), icon: WalletCards },
    { label: "Outstanding", value: formatCurrency(record.outstandingAmount), icon: AlertCircle },
    { label: "Due date", value: formatDate(record.dueDate), icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Loan application details</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(record.loanTypeName ?? "Application loan")} · {String(record.purposeText ?? "No purpose")}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={record.status ?? "pending"} />
              <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                {String(record.durationLabel ?? `${String(record.durationDays ?? "0")} days`)}
              </span>
              <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                {String(record.installmentCount ?? "0")} installments
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close app loan details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {loan.loading && (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading application loan
            </div>
          )}

          {loan.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {loan.error}
            </div>
          )}

          {!loan.loading && !loan.error && (
            <div className="grid gap-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:text-sky-200">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="text-xl font-bold text-slate-950 dark:text-white">{item.value}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                    </div>
                  );
                })}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Repayment schedule</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                        <tr>
                          {["#", "Due date", "Principal", "Interest", "Total", "Paid", "Status"].map((header) => (
                            <th key={header} className="px-4 py-3">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {repaymentSchedule.map((item, index) => (
                          <tr key={`${String(item.installmentNumber ?? index)}-${index}`}>
                            <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{String(item.installmentNumber ?? index + 1)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(item.dueDate)}</td>
                            <td className="px-4 py-3">{formatCurrency(item.principalAmount)}</td>
                            <td className="px-4 py-3">{formatCurrency(item.interestAmount)}</td>
                            <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{formatCurrency(item.totalAmount)}</td>
                            <td className="px-4 py-3">{formatCurrency(item.amountPaid)}</td>
                            <td className="px-4 py-3"><StatusBadge status={item.status ?? "pending"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!repaymentSchedule.length && <div className="p-4"><EmptyPanel label="No repayment schedule returned." /></div>}
                </div>

                <div className="grid gap-5">
                  <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">Application metadata</h3>
                    </div>
                    <div className="grid gap-0 divide-y divide-slate-100 dark:divide-white/10">
                      {[
                        ["User ID", record.userId],
                        ["Loan type ID", record.loanTypeId],
                        ["Interest rate", `${String(record.interestRate ?? "0")}%`],
                        ["Received amount", formatCurrency(record.receivedAmount)],
                        ["Paid amount", formatCurrency(record.paidAmount)],
                        ["Approved at", formatDate(record.approvedAt)],
                        ["Disbursed at", formatDate(record.disbursedAt)],
                        ["Disbursement reference", record.disbursementReference],
                        ["Loan wallet ID", record.loanWalletId],
                        ["Reviewed by", record.reviewedBy],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="grid gap-2 px-5 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{String(label)}</p>
                          <p className="break-words text-sm font-semibold text-slate-950 dark:text-white">{String(value ?? "Not available")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Activity log</h3>
                  </div>
                  <div className="grid gap-3 p-4">
                    {activityLog.map((item, index) => (
                      <div key={`${String(item.type ?? "activity")}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-950 dark:text-white">{String(item.title ?? formatLabel(String(item.type ?? "Activity")))}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{String(item.note ?? "No note")}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(item.amount)}</p>
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</p>
                      </div>
                    ))}
                    {!activityLog.length && <EmptyPanel label="No activity log returned." />}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Top-up history</h3>
                  </div>
                  <div className="grid gap-3 p-4">
                    {topUpHistory.map((item, index) => (
                      <div key={`${String(item.requestId ?? "topup")}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-bold text-slate-950 dark:text-white">{String(item.requestId ?? `Top-up ${index + 1}`)}</p>
                          <StatusBadge status={item.status ?? "pending"} />
                        </div>
                        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                          <p><span className="font-bold">Amount:</span> {formatCurrency(item.amount)}</p>
                          <p><span className="font-bold">Payable:</span> {formatCurrency(item.totalPayable)}</p>
                          <p><span className="font-bold">Duration:</span> {String(item.durationLabel ?? "Not available")}</p>
                        </div>
                      </div>
                    ))}
                    {!topUpHistory.length && <EmptyPanel label="No top-up history returned." />}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BankoneSyncResultModal({ result, onClose }: { result: BankoneSyncResultState; onClose: () => void }) {
  const payload = unwrapPayload(result.data);
  const record = isRecord(payload) ? payload : {};
  const bankOneResponse = isRecord(record.bankOneResponse) ? record.bankOneResponse : {};
  const loan = isRecord(record.loan) ? record.loan : {};
  const appLoan = isRecord(record.appLoan) ? record.appLoan : {};
  const bankoneStatusResponse = isRecord(loan.bankoneStatusResponse) ? loan.bankoneStatusResponse : {};
  const appBankoneStatusResponse = isRecord(appLoan.bankoneStatusResponse) ? appLoan.bankoneStatusResponse : {};
  const matchedRecord = record.matchedRecord;

  const summary = [
    { label: "BankOne status", value: String(record.bankOneStatus ?? "Not available"), icon: Landmark },
    { label: "Core status", value: String(record.coreStatus ?? "Not available"), icon: CreditCard },
    { label: "App status", value: String(record.appStatus ?? "Not available"), icon: CheckCircle2 },
    { label: "Matched record", value: matchedRecord ? "Available" : "None", icon: AlertCircle },
  ];

  const primaryDetails = [
    { label: "Tracking ref", value: String(getRecordValue(loan, ["bankoneLoanTrackingRef"]) ?? getRecordValue(appLoan, ["bankoneLoanTrackingRef"]) ?? "Not available") },
    { label: "Loan account number", value: String(getRecordValue(loan, ["bankoneLoanAccountNumber", "bankoneLinkedAccountNumber"]) ?? "Not available") },
    { label: "Customer ID", value: String(getRecordValue(loan, ["bankoneCustomerId"]) ?? getRecordValue(appLoan, ["bankoneCustomerId"]) ?? "Not available") },
    { label: "Last synced", value: formatDate(getRecordValue(loan, ["bankoneLastSyncedAt"]) ?? getRecordValue(appLoan, ["bankoneLastSyncedAt"])) },
  ];

  const bankoneMessage = getRecordValue(bankOneResponse, ["Message"]);
  const bankoneSuccess = getRecordValue(bankOneResponse, ["IsSuccessful"]);
  const coreResponseMessage = getRecordValue(bankoneStatusResponse, ["Message"]);
  const appResponseMessage = getRecordValue(appBankoneStatusResponse, ["Message"]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">BankOne sync result</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{String(result.title || "Loan status synchronization")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {String(getRecordValue(record, ["message"]) ?? "BankOne loan status synced successfully")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={record.bankOneStatus ?? "pending"} />
              <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${bankoneSuccess === true ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"}`}>
                BankOne response: {String(bankoneSuccess === true ? "Successful" : "Attention required")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close BankOne sync result"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {result.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {result.error}
            </div>
          )}

          {!result.error && (
            <div className="grid gap-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:text-sky-200">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="text-xl font-bold text-slate-950 dark:text-white">{item.value}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                    </div>
                  );
                })}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">BankOne response alert</h3>
                  </div>
                  <div className="grid gap-4 p-4">
                    <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#069AFF]">Gateway message</p>
                      <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                        {typeof bankoneMessage === "string" ? bankoneMessage : JSON.stringify(bankoneMessage ?? "Not available")}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {primaryDetails.map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                          <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Status alignment</h3>
                  </div>
                  <div className="grid gap-3 p-4">
                    {[
                      { label: "BankOne", value: String(record.bankOneStatus ?? "Not available") },
                      { label: "Core loan", value: String(record.coreStatus ?? "Not available") },
                      { label: "App loan", value: String(record.appStatus ?? "Not available") },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.label}</p>
                        <StatusBadge status={item.value} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Core loan record</h3>
                  </div>
                  <div className="grid gap-3 p-4">
                    {[
                      { label: "Loan ID", value: String(getRecordValue(loan, ["_id"]) ?? "Not available") },
                      { label: "Amount", value: formatCurrency(getRecordValue(loan, ["amount"])) },
                      { label: "Status", value: String(getRecordValue(loan, ["status"]) ?? "Not available") },
                      { label: "Outstanding", value: formatCurrency(getRecordValue(loan, ["outstandingAmount"])) },
                      { label: "Application date", value: formatDate(getRecordValue(loan, ["applicationDate"])) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                    {coreResponseMessage !== null && coreResponseMessage !== undefined && (
                      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Core BankOne response</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {typeof coreResponseMessage === "string" ? coreResponseMessage : JSON.stringify(coreResponseMessage)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Application loan record</h3>
                  </div>
                  <div className="grid gap-3 p-4">
                    {[
                      { label: "App loan ID", value: String(getRecordValue(appLoan, ["_id"]) ?? "Not available") },
                      { label: "Loan type", value: String(getRecordValue(appLoan, ["loanTypeName"]) ?? "Not available") },
                      { label: "Status", value: String(getRecordValue(appLoan, ["status"]) ?? "Not available") },
                      { label: "Total payable", value: formatCurrency(getRecordValue(appLoan, ["totalPayable"])) },
                      { label: "Due date", value: formatDate(getRecordValue(appLoan, ["dueDate"])) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                    {appResponseMessage !== null && appResponseMessage !== undefined && (
                      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">App BankOne response</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {typeof appResponseMessage === "string" ? appResponseMessage : JSON.stringify(appResponseMessage)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionLibrary({ permissions }: { permissions: Record<string, unknown>[] }) {
  const groupedPermissions = permissions.reduce<Record<string, Record<string, unknown>[]>>((groups, permission) => {
    const group = String(getRecordValue(permission, ["module", "group", "category", "resource"]) ?? "General");
    groups[group] = [...(groups[group] ?? []), permission];
    return groups;
  }, {});

  return (
    <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-white shadow-sm dark:border-[#069AFF]/25 dark:bg-white/[0.045]">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#06172b_0%,#083d70_65%,#069AFF_150%)] px-5 py-4 text-white dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-100">Permission library</p>
        <h2 className="mt-1 text-lg font-bold">Available access controls</h2>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          Use these permissions when creating roles. Permissions are grouped so administrators can review access by module.
        </p>
      </div>
      <div className="max-h-[620px] overflow-y-auto p-4">
        {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
          <div key={group} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">{formatLabel(group)}</h3>
              <span className="rounded-md bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                {groupPermissions.length}
              </span>
            </div>
            <div className="grid gap-2 p-3">
              {groupPermissions.slice(0, 12).map((permission, index) => {
                const id = getId(permission) || `${group}-${index}`;
                const name = String(getRecordValue(permission, ["name", "title", "permission", "action"]) ?? `Permission ${index + 1}`);

                return (
                  <div key={id} className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatLabel(name)}</p>
                    <p className="mt-1 break-all text-[11px] font-medium text-slate-500 dark:text-slate-400">{id}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!permissions.length && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
            No permissions returned.
          </div>
        )}
      </div>
    </section>
  );
}

function RoleCreateModal({
  permissions,
  onClose,
  onCreate,
}: {
  permissions: Record<string, unknown>[];
  onClose: () => void;
  onCreate: (name: string, permissionIds: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredPermissions = permissions.filter((permission) => {
    const label = String(getRecordValue(permission, ["name", "title", "permission", "action"]) ?? "");
    const group = String(getRecordValue(permission, ["module", "group", "category", "resource"]) ?? "General");
    return `${label} ${group}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  const groupedPermissions = filteredPermissions.reduce<Record<string, Record<string, unknown>[]>>((groups, permission) => {
    const group = String(getRecordValue(permission, ["module", "group", "category", "resource"]) ?? "General");
    groups[group] = [...(groups[group] ?? []), permission];
    return groups;
  }, {});

  const selectedSet = new Set(selectedIds);

  const togglePermission = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleGroup = (groupPermissions: Record<string, unknown>[]) => {
    const ids = groupPermissions.map(getId).filter(Boolean);
    const allSelected = ids.every((id) => selectedSet.has(id));

    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      }

      return Array.from(new Set([...current, ...ids]));
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }

    if (!selectedIds.length) {
      setError("Select at least one permission.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate(name.trim(), selectedIds);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="grid max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">Role control</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Create role with permissions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Select one or more permissions. The selected permission IDs are submitted as an array to the role endpoint.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            aria-label="Close role creator"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid min-h-0 gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-100 p-5 dark:border-white/10 lg:border-b-0 lg:border-r">
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Role name</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Operations Manager"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <div className="mt-5 rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/10 p-4">
              <p className="text-3xl font-bold text-slate-950 dark:text-white">{selectedIds.length}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF] dark:text-sky-200">Selected permissions</p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setSelectedIds(filteredPermissions.map(getId).filter(Boolean))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                Select visible
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                Clear selected
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                Create role
              </button>
            </div>
          </aside>

          <section className="min-h-0 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="w-full sm:max-w-md">
                <span className="sr-only">Search permissions</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search permissions or modules"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </label>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{filteredPermissions.length} visible</p>
            </div>

            <div className="max-h-[58vh] overflow-y-auto pr-1">
              {Object.entries(groupedPermissions).map(([group, groupPermissions]) => {
                const groupIds = groupPermissions.map(getId).filter(Boolean);
                const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedSet.has(id));

                return (
                  <div key={group} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">{formatLabel(group)}</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{groupPermissions.length} permissions</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupPermissions)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                      >
                        {allSelected ? "Clear group" : "Select group"}
                      </button>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                      {groupPermissions.map((permission, index) => {
                        const id = getId(permission);
                        const label = String(getRecordValue(permission, ["name", "title", "permission", "action"]) ?? `Permission ${index + 1}`);
                        const checked = selectedSet.has(id);

                        return (
                          <label
                            key={id || `${group}-${index}`}
                            className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                              checked
                                ? "border-[#069AFF]/40 bg-[#069AFF]/10"
                                : "border-slate-200 bg-white hover:border-[#069AFF]/30 dark:border-white/10 dark:bg-white/[0.035]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => id && togglePermission(id)}
                              className="mt-1 h-4 w-4 accent-[#069AFF]"
                            />
                            <span>
                              <span className="block text-sm font-bold text-slate-900 dark:text-white">{formatLabel(label)}</span>
                              <span className="mt-1 block break-all text-[11px] font-medium text-slate-500 dark:text-slate-400">{id || "Missing id"}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

function ManagementTable({
  title,
  rows,
  columns,
  action,
  children,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  action?: ReactNode;
  children: (row: Record<string, unknown>, index: number) => ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        {action ?? <BriefcaseBusiness className="h-5 w-5 text-slate-400" aria-hidden="true" />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {rows.map((row, index) => children(row, index))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
          No records returned.
        </div>
      )}
    </section>
  );
}

export default function AdminCenterPage() {
  const router = useRouter();
  const adminSession = useAdminSession();
  const [reportFilters, setReportFilters] = useState<ReportFilters>(() => getDefaultReportFilters());
  const [reports, setReports] = useState<ReportState>({
    data: {},
    errors: {},
    loaded: false,
    loading: false,
  });
  const [activeSection, setActiveSection] = useState<AdminSection>("admins");
  const [adminData, setAdminData] = useState<AdminCenterData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [userDashboard, setUserDashboard] = useState<UserDashboardState | null>(null);
  const [appLoanDetail, setAppLoanDetail] = useState<AppLoanDetailState | null>(null);
  const [bankoneSyncResult, setBankoneSyncResult] = useState<BankoneSyncResultState | null>(null);
  const [formAction, setFormAction] = useState<FormAction | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canOpenAdminCenter = canAccessRoute(adminSession, "/admin");
  const visibleSections = sections.filter((section) => canAccessAdminSection(adminSession, section.key as "admins" | "roles" | "kyc" | "tiers" | "support" | "content"));
  const currentSection = visibleSections.some((section) => section.key === activeSection)
    ? activeSection
    : (visibleSections[0]?.key ?? "admins");

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenAdminCenter) {
      return;
    }

    void fetchAdminCenter().then((result) => {
      if (!cancelled) {
        setAdminData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenAdminCenter, router]);

  useEffect(() => {
    if (currentSection !== "reports" || reports.loaded || reports.loading) {
      return;
    }

    void (async () => {
      setReports((current) => ({ ...current, loading: true }));
      const result = await fetchReports(reportFilters);
      setReports(result);
    })();
  }, [currentSection, reportFilters, reports.loaded, reports.loading]);

  const admins = useMemo(() => extractRows(adminData?.admins), [adminData]);
  const roles = useMemo(() => extractRows(adminData?.roles), [adminData]);
  const adminRoleOptions = useMemo(
    () =>
      roles
        .map((role): { value: string; label: string; description?: string } | null => {
          const value = String(getRecordValue(role, ["_id", "id", "roleId"]) ?? "").trim();
          if (!value) {
            return null;
          }

          return {
            value,
            label: String(getRecordValue(role, ["name", "title", "slug"]) ?? "Unnamed role"),
            description: String(getRecordValue(role, ["description"]) ?? "").trim() || undefined,
          };
        })
        .filter((option): option is NonNullable<typeof option> => option !== null),
    [roles],
  );
  const permissions = useMemo(() => extractRows(adminData?.permissions), [adminData]);
  const users = useMemo(() => extractRows(adminData?.users), [adminData]);
  const kycs = useMemo(() => extractRows(adminData?.kycs), [adminData]);
  const loans = useMemo(() => extractRows(adminData?.loans), [adminData]);
  const loanPackages = useMemo(() => extractRows(adminData?.loanPackages), [adminData]);
  const accountTiers = useMemo(() => extractRows(adminData?.accountTiers), [adminData]);
  const complaints = useMemo(() => extractRows(adminData?.complaints), [adminData]);
  const complaintCategories = useMemo(() => extractRows(adminData?.complaintCategories), [adminData]);
  const contactUs = useMemo(() => extractRows(adminData?.contactUs), [adminData]);
  const faqs = useMemo(() => extractRows(adminData?.faqs), [adminData]);
  const liveChat = useMemo(() => extractRows(adminData?.liveChat), [adminData]);
  const loanTypes = useMemo(() => extractRows(adminData?.loanTypes), [adminData]);
  const appLoans = useMemo(() => extractRows(adminData?.appLoans), [adminData]);
  const financialLead = useMemo(() => getReportLead(reports.data.financial), [reports.data.financial]);
  const loanPerformanceLead = useMemo(() => getReportLead(reports.data.loanPerformance), [reports.data.loanPerformance]);
  const profitLossLead = useMemo(() => getReportLead(reports.data.profitLoss), [reports.data.profitLoss]);
  const revenueLead = useMemo(() => getReportLead(reports.data.revenue), [reports.data.revenue]);
  const endpointErrors = adminData ? Object.entries(adminData.errors) : [];

  const refreshData = async () => {
    setRefreshing(true);
    setAdminData(await fetchAdminCenter());
    setRefreshing(false);
  };

  const refreshReports = async (filters = reportFilters) => {
    setReports((current) => ({ ...current, loading: true }));
    const result = await fetchReports(filters);
    setReports(result);
  };

  const submitAndRefresh = async (request: () => Promise<unknown>) => {
    await request();
    await refreshData();
    setFormAction(null);
  };

  const openCreateAdmin = () => {
    setFormAction({
      eyebrow: "Administrator",
      title: "Create administrator",
      description: "Provision a new admin account, assign the correct role, and let the backend issue the access credentials.",
      submitLabel: "Create admin",
      initialValues: {
        role_id: adminRoleOptions[0]?.value ?? "",
      },
      fields: [
        { name: "first_name", label: "First name", required: true, placeholder: "Amina" },
        { name: "last_name", label: "Last name", required: true, placeholder: "Okafor" },
        { name: "email", label: "Email address", type: "email", required: true, placeholder: "admin@eazycredit.com" },
        { name: "phone", label: "Phone number", type: "tel", required: true, placeholder: "08000000000" },
        {
          name: "role_id",
          label: "Assigned role",
          type: "select",
          required: true,
          placeholder: adminRoleOptions.length ? "Select a role" : "No roles available",
          helper: adminRoleOptions.length
            ? "The selected role determines workspace access and permissions."
            : "Load roles first or create a role before provisioning an administrator.",
          options: adminRoleOptions,
        },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createAdmin(values)),
    });
  };

  const openCreateRole = () => {
    setRoleModalOpen(true);
  };

  const createRole = async (name: string, permissionIds: string[]) => {
    await adminService.createRole({ name, permissions: permissionIds });
    await refreshData();
    setRoleModalOpen(false);
  };

  const openCreateUser = () => {
    setFormAction({
      eyebrow: "Customer account",
      title: "Create user",
      description: "Create a customer profile. The backend generates the password and stores the account as active.",
      submitLabel: "Create user",
      fields: [
        { name: "first_name", label: "First name", required: true, placeholder: "Daniel" },
        { name: "last_name", label: "Last name", required: true, placeholder: "Ibrahim" },
        { name: "email", label: "Email address", type: "email", required: true, placeholder: "customer@example.com" },
        { name: "phone", label: "Phone number", type: "tel", required: true, placeholder: "08000000000" },
        { name: "bankone_customerid", label: "BankOne customer ID", placeholder: "Optional" },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createUser(values)),
    });
  };

  const openCreateKycNotice = () => {
    setFormAction({
      eyebrow: "KYC notice",
      title: "Create KYC record",
      description: "Submit a KYC notice through the admin KYC endpoint using the authenticated administrator.",
      submitLabel: "Create record",
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "Document review request" },
        { name: "content", label: "Content", type: "textarea", required: true, placeholder: "Explain what needs review." },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createKyc(values)),
    });
  };

  const openCreateAccountTier = () => {
    setFormAction({
      eyebrow: "Account tier",
      title: "Create account tier",
      description: "Create deposit and withdrawal limits for a customer tier.",
      submitLabel: "Create tier",
      fields: [
        { name: "tier", label: "Tier", required: true, placeholder: "Tier 1" },
        { name: "description", label: "Description", required: true, placeholder: "Basic customer account" },
        { name: "deposit", label: "Deposit limit", required: true, placeholder: "50000" },
        { name: "withdrawal", label: "Withdrawal limit", required: true, placeholder: "20000" },
        { name: "benefits", label: "Benefits", type: "textarea", required: true, placeholder: "List the benefits for this tier." },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createAccountTier(values)),
    });
  };

  const openEditAccountTier = (row: Record<string, unknown>) => {
    const id = getId(row);
    setFormAction({
      eyebrow: "Account tier",
      title: "Update account tier",
      description: "Update tier limits and benefits.",
      submitLabel: "Update tier",
      initialValues: {
        tier: String(getRecordValue(row, ["tier"]) ?? ""),
        description: String(getRecordValue(row, ["description"]) ?? ""),
        deposit: String(getRecordValue(row, ["deposit"]) ?? ""),
        withdrawal: String(getRecordValue(row, ["withdrawal"]) ?? ""),
        benefits: String(getRecordValue(row, ["benefits"]) ?? ""),
      },
      fields: [
        { name: "tier", label: "Tier", required: true },
        { name: "description", label: "Description", required: true },
        { name: "deposit", label: "Deposit limit", required: true },
        { name: "withdrawal", label: "Withdrawal limit", required: true },
        { name: "benefits", label: "Benefits", type: "textarea", required: true },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.updateAccountTier(id, values)),
    });
  };

  const openReplyComplaint = (id: string) => {
    setFormAction({
      eyebrow: "Complaint reply",
      title: "Reply to complaint",
      description: "Send an official response to the customer complaint.",
      submitLabel: "Send reply",
      fields: [{ name: "message", label: "Reply message", type: "textarea", required: true, placeholder: "Write the reply here." }],
      onSubmit: (values) => submitAndRefresh(() => adminService.replyComplaint(id, { message: values.message })),
    });
  };

  const updateComplaintStatus = async (id: string, status: string) => {
    setBusyAction(`complaint-${id}-${status}`);
    try {
      await adminService.updateComplaintStatus(id, { status });
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const openCreateComplaintCategory = () => {
    setFormAction({
      eyebrow: "Complaint category",
      title: "Create complaint category",
      description: "Add a complaint category customers can select.",
      submitLabel: "Create category",
      fields: [{ name: "text", label: "Category", required: true, placeholder: "Loan repayment" }],
      onSubmit: (values) => submitAndRefresh(() => adminService.createComplaintCategory(values)),
    });
  };

  const openCreateContact = () => {
    setFormAction({
      eyebrow: "Contact setting",
      title: "Create contact entry",
      description: "Add a public contact record.",
      submitLabel: "Create contact",
      fields: [
        { name: "name", label: "Name", required: true, placeholder: "Support email" },
        { name: "value", label: "Value", required: true, placeholder: "support@example.com" },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createContactUs(values)),
    });
  };

  const openEditContact = (row: Record<string, unknown>) => {
    const id = getId(row);
    setFormAction({
      eyebrow: "Contact setting",
      title: "Update contact entry",
      description: "Update the value for this contact record.",
      submitLabel: "Update contact",
      initialValues: { value: String(getRecordValue(row, ["value"]) ?? "") },
      fields: [{ name: "value", label: "Value", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.updateContactUs(id, values)),
    });
  };

  const openCreateFaq = () => {
    setFormAction({
      eyebrow: "FAQ",
      title: "Create FAQ",
      description: "Add a frequently asked question.",
      submitLabel: "Create FAQ",
      fields: [
        { name: "title", label: "Question", required: true, placeholder: "How do repayments work?" },
        { name: "content", label: "Answer", type: "textarea", required: true, placeholder: "Write the answer here." },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createFaq(values)),
    });
  };

  const openEditFaq = (row: Record<string, unknown>) => {
    const id = getId(row);
    setFormAction({
      eyebrow: "FAQ",
      title: "Update FAQ",
      description: "Update this question and answer.",
      submitLabel: "Update FAQ",
      initialValues: {
        title: String(getRecordValue(row, ["title"]) ?? ""),
        content: String(getRecordValue(row, ["content"]) ?? ""),
      },
      fields: [
        { name: "title", label: "Question", required: true },
        { name: "content", label: "Answer", type: "textarea", required: true },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.updateFaq(id, values)),
    });
  };

  const openBroadcast = (userId: string, name: string) => {
    setFormAction({
      eyebrow: "Customer broadcast",
      title: `Broadcast to ${name}`,
      description: "Schedule a direct message for this customer.",
      submitLabel: "Send broadcast",
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "Account update" },
        { name: "content", label: "Message", type: "textarea", required: true, placeholder: "Write the message here." },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.broadcastToUser(userId, values)),
    });
  };

  const openUserDashboard = async (userId: string, userName: string) => {
    setUserDashboard({ title: "User dashboard", userId, userName, loading: true, data: null, error: "" });

    try {
      const data = await adminService.getUserDashboard(userId);
      setUserDashboard({ title: "User dashboard", userId, userName, loading: false, data, error: "" });
    } catch (error) {
      setUserDashboard({ title: "User dashboard", userId, userName, loading: false, data: null, error: getErrorMessage(error) });
    }
  };

  const openAppLoanDetail = async (id: string) => {
    setAppLoanDetail({ title: "Application loan details", loading: true, data: null, error: "" });

    try {
      const data = await adminService.getAppLoanById(id);
      setAppLoanDetail({ title: "Application loan details", loading: false, data, error: "" });
    } catch (error) {
      setAppLoanDetail({ title: "Application loan details", loading: false, data: null, error: getErrorMessage(error) });
    }
  };

  const openDetail = async (title: string, request: () => Promise<unknown>) => {
    setDetail({ title, loading: true, data: null, error: "" });

    try {
      const data = await request();
      setDetail({ title, loading: false, data, error: "" });
    } catch (error) {
      setDetail({ title, loading: false, data: null, error: getErrorMessage(error) });
    }
  };

  const toggleAdmin = async (id: string) => {
    setBusyAction(`admin-${id}`);
    try {
      await adminService.toggleAdminStatus(id);
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const disableRole = async (id: string) => {
    setBusyAction(`role-${id}`);
    try {
      await adminService.updateRole(id, {});
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const reviewKyc = async (id: string, action: "approve" | "reject") => {
    setBusyAction(`kyc-${id}-${action}`);
    try {
      await adminService.approveKyc(id, {
        action,
        reason: action === "approve" ? "Approved from admin center" : "Rejected from admin center",
      });
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const reviewLoan = async (id: string, action: "approve" | "reject") => {
    setBusyAction(`loan-${id}-${action}`);

    try {
      if (action === "approve") {
        await adminService.approveLoan(id, { disburseToWallet: false });
      } else {
        await adminService.rejectLoan(id, { reason: "Rejected from admin center" });
      }

      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const runLoanMaintenanceAction = async (id: string, action: string, request: () => Promise<unknown>) => {
    setBusyAction(`loan-${id}-${action}`);

    try {
      await request();
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const parseCsvList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const parseDurations = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const openCreateLoanType = () => {
    setFormAction({
      eyebrow: "Loan type",
      title: "Create loan type",
      description: "Create a loan product type. Durations must be a JSON array matching the backend schema.",
      submitLabel: "Create loan type",
      fields: [
        { name: "name", label: "Name", required: true, placeholder: "Salary Loan" },
        { name: "slug", label: "Slug", required: true, placeholder: "salary-loan" },
        { name: "description", label: "Description", required: true, placeholder: "Short term salary-backed loan" },
        { name: "badgeText", label: "Badge text", placeholder: "Popular" },
        { name: "minAmount", label: "Minimum amount", required: true, placeholder: "10000" },
        { name: "maxAmount", label: "Maximum amount", required: true, placeholder: "500000" },
        { name: "currency", label: "Currency", required: true, placeholder: "NGN" },
        { name: "requirements", label: "Requirements", placeholder: "BVN, Employment letter" },
        {
          name: "durations",
          label: "Durations JSON",
          type: "textarea",
          required: true,
          placeholder: `[{"days":30,"label":"30 days","interestRate":5,"installmentCount":1,"topUpAllowed":true}]`,
        },
      ],
      onSubmit: (values) =>
        submitAndRefresh(() =>
          adminService.createLoanType({
            ...values,
            minAmount: Number(values.minAmount),
            maxAmount: Number(values.maxAmount),
            requirements: parseCsvList(values.requirements ?? ""),
            durations: parseDurations(values.durations ?? "[]"),
          }),
        ),
    });
  };

  const openEditLoanType = (row: Record<string, unknown>) => {
    const id = getId(row);
    setFormAction({
      eyebrow: "Loan type",
      title: "Update loan type",
      description: "Update loan product settings.",
      submitLabel: "Update loan type",
      initialValues: {
        name: String(getRecordValue(row, ["name"]) ?? ""),
        slug: String(getRecordValue(row, ["slug"]) ?? ""),
        description: String(getRecordValue(row, ["description"]) ?? ""),
        badgeText: String(getRecordValue(row, ["badgeText"]) ?? ""),
        minAmount: String(getRecordValue(row, ["minAmount"]) ?? ""),
        maxAmount: String(getRecordValue(row, ["maxAmount"]) ?? ""),
        currency: String(getRecordValue(row, ["currency"]) ?? "NGN"),
        requirements: Array.isArray(row.requirements) ? row.requirements.join(", ") : "",
        durations: JSON.stringify(Array.isArray(row.durations) ? row.durations : [], null, 2),
      },
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "slug", label: "Slug", required: true },
        { name: "description", label: "Description", required: true },
        { name: "badgeText", label: "Badge text" },
        { name: "minAmount", label: "Minimum amount", required: true },
        { name: "maxAmount", label: "Maximum amount", required: true },
        { name: "currency", label: "Currency", required: true },
        { name: "requirements", label: "Requirements" },
        { name: "durations", label: "Durations JSON", type: "textarea", required: true },
      ],
      onSubmit: (values) =>
        submitAndRefresh(() =>
          adminService.updateLoanType(id, {
            ...values,
            minAmount: Number(values.minAmount),
            maxAmount: Number(values.maxAmount),
            requirements: parseCsvList(values.requirements ?? ""),
            durations: parseDurations(values.durations ?? "[]"),
          }),
        ),
    });
  };

  const runAppLoanAction = async (id: string, action: string, request: () => Promise<unknown>) => {
    setBusyAction(`app-loan-${id}-${action}`);
    try {
      await request();
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const openRejectAppLoan = (id: string) => {
    setFormAction({
      eyebrow: "App loan",
      title: "Reject application loan",
      description: "Provide the official rejection reason.",
      submitLabel: "Reject loan",
      initialValues: { reason: "Insufficient score" },
      fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.rejectAppLoan(id, { reason: values.reason })),
    });
  };

  const openApproveTopUp = (id: string) => {
    setFormAction({
      eyebrow: "Top up",
      title: "Approve top-up request",
      description: "Enter the top-up request ID to approve.",
      submitLabel: "Approve top-up",
      fields: [{ name: "requestId", label: "Request ID", required: true, placeholder: "TPU-xxxxxxxxxxxx" }],
      onSubmit: (values) => submitAndRefresh(() => adminService.approveAppLoanTopUp(id, { requestId: values.requestId })),
    });
  };

  const openRejectTopUp = (id: string) => {
    setFormAction({
      eyebrow: "Top up",
      title: "Reject top-up request",
      description: "Enter the top-up request ID and reason.",
      submitLabel: "Reject top-up",
      initialValues: { reason: "Top up not approved" },
      fields: [
        { name: "requestId", label: "Request ID", required: true, placeholder: "TPU-xxxxxxxxxxxx" },
        { name: "reason", label: "Reason", type: "textarea", required: true },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.rejectAppLoanTopUp(id, { requestId: values.requestId, reason: values.reason })),
    });
  };

  const openSyncBankoneStatus = (id: string) => {
    setFormAction({
      eyebrow: "BankOne sync",
      title: "Sync BankOne loan status",
      description: "Push a status sync request for this legacy loan using the institution code required by BankOne.",
      submitLabel: "Sync status",
      initialValues: { institutionCode: "101080" },
      fields: [
        {
          name: "institutionCode",
          label: "Institution code",
          required: true,
          placeholder: "101080",
          helper: "Defaults to institution code 101080.",
        },
      ],
      onSubmit: (values) =>
        (async () => {
          const response = await adminService.syncLoanBankoneStatus(id, {
            institutionCode: values.institutionCode,
          });

          await refreshData();
          setFormAction(null);
          setBankoneSyncResult({
            title: "BankOne loan status synced successfully",
            loading: false,
            data: response,
            error: "",
          });
        })(),
    });
  };

  const summaryCards = [
    { label: "Admins", value: formatValue(admins.length), icon: ShieldCheck },
    { label: "Roles", value: formatValue(roles.length), icon: UserCog },
    { label: "Customers", value: formatValue(users.length), icon: Users },
    { label: "KYC reviews", value: formatValue(kycs.length), icon: FileCheck2 },
    { label: "Loans", value: formatValue(loans.length), icon: CreditCard },
    { label: "App loans", value: formatValue(appLoans.length), icon: CreditCard },
    { label: "Tiers", value: formatValue(accountTiers.length), icon: BadgeCheck },
    { label: "Complaints", value: formatValue(complaints.length), icon: Send },
    { label: "FAQs", value: formatValue(faqs.length), icon: BriefcaseBusiness },
  ];

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.045] lg:w-auto">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key as AdminSection)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  currentSection === key
                    ? "bg-[#069AFF] text-white shadow-sm shadow-[#069AFF]/30"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#069AFF] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-sky-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentSection === "reports") {
                void refreshReports();
                return;
              }
              void refreshData();
            }}
            disabled={currentSection === "reports" ? reports.loading : refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
          >
            {(currentSection === "reports" ? reports.loading : refreshing) ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Sync
          </button>
        </div>

        <section className="rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] p-6 text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Management workspace
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Governance, KYC, support, and content controls from one administrative surface.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Keep staff access, approvals, support queues, and platform content under one control plane while customer and loan operations move into their own specialist workspaces.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
              {summaryCards.slice(0, 4).map((card) => (
                <div key={card.label} className="rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{card.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {endpointErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Some admin endpoints did not respond.</p>
                <p className="mt-1">{endpointErrors.map(([key]) => formatLabel(key)).join(", ")}</p>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold transition ${
                  currentSection === section.key
                    ? "bg-[#069AFF] text-white shadow-sm shadow-[#069AFF]/25 dark:bg-[#069AFF] dark:text-white"
                    : "text-slate-600 hover:bg-[#069AFF]/10 hover:text-[#069AFF] dark:text-slate-300 dark:hover:bg-[#069AFF]/10 dark:hover:text-sky-200"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </section>

        {!canOpenAdminCenter ? (
          <AccessDeniedState
            title="Admin Center access denied"
            description="Your current admin role does not include access to the administration workspace."
          />
        ) : !adminData ? (
          <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ) : (
          <>
            {currentSection === "admins" && (
              <ManagementTable
                title="Administrators"
                rows={admins}
                columns={["Admin", "Email", "Role", "Status", "Created", "Action"]}
                action={
                  <button
                    type="button"
                    onClick={openCreateAdmin}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] dark:bg-[#069AFF] dark:text-white dark:hover:bg-[#27a7ff]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New admin
                  </button>
                }
              >
                {(row, index) => {
                  const id = getId(row);
                  const user = getRecordValue(row, ["user"]);
                  const userRecord = isRecord(user) ? user : row;
                  return (
                    <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{getPersonName(userRecord)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(userRecord, ["email"]) ?? "Not available")}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["role", "role_id", "roleId"]) ?? "Admin")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!id || busyAction === `admin-${id}`}
                          onClick={() => toggleAdmin(id)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                        >
                          {busyAction === `admin-${id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                          Toggle
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </ManagementTable>
            )}

            {currentSection === "roles" && (
              <div className="grid gap-6">
                <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-white shadow-sm dark:border-[#069AFF]/25 dark:bg-white/[0.045]">
                  <div className="grid gap-5 bg-[linear-gradient(135deg,#06172b_0%,#083d70_60%,#069AFF_150%)] p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Access governance</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight">Roles and permission assignment</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Create official admin roles by selecting multiple permissions from the library. This keeps permission IDs visible but removes manual copy-paste mistakes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateRole}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create role
                    </button>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-5 dark:border-white/10 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">{formatValue(roles.length)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Active role records</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">{formatValue(permissions.length)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Permission controls</p>
                    </div>
                    <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/10 p-4">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">
                        {formatValue(roles.reduce((total, role) => total + (Array.isArray(role.permissions) ? role.permissions.length : 0), 0))}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF] dark:text-sky-200">Assigned links</p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
                  <ManagementTable
                    title="Role directory"
                    rows={roles}
                    columns={["Role", "Status", "Created", "Permissions", "Action"]}
                  >
                    {(row, index) => {
                      const id = getId(row);
                      const permissionCount = Array.isArray(row.permissions) ? row.permissions.length : Number(getRecordValue(row, ["permissionCount"]) ?? 0);

                      return (
                        <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["name", "title", "role"]) ?? `Role ${index + 1}`)}</p>
                            <p className="mt-1 break-all text-xs font-medium text-slate-500 dark:text-slate-400">{id || "No role id"}</p>
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-md border border-[#069AFF]/20 bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                              {formatValue(permissionCount)} selected
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              disabled={!id || busyAction === `role-${id}`}
                              onClick={() => disableRole(id)}
                              className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              Disable
                            </button>
                          </td>
                        </tr>
                      );
                    }}
                  </ManagementTable>

                  <PermissionLibrary permissions={permissions} />
                </div>
              </div>
            )}

            {currentSection === "users" && (
              <div className="grid gap-6">
                <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-white shadow-sm dark:border-[#069AFF]/25 dark:bg-white/[0.045]">
                  <div className="grid gap-5 bg-[linear-gradient(135deg,#06172b_0%,#083d70_60%,#069AFF_150%)] p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Customer operations</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight">User profiles and financial visibility</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Open a customer dashboard to review virtual accounts, wallets, and loan exposure without leaving the admin workspace.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateUser}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create user
                    </button>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-5 dark:border-white/10 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">{formatValue(users.length)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Loaded customers</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">
                        {formatValue(users.filter((user) => String(getRecordValue(user, ["status"]) ?? "active").toLowerCase() === "active").length)}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Active profiles</p>
                    </div>
                    <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/10 p-4">
                      <p className="text-2xl font-bold text-slate-950 dark:text-white">
                        {formatValue(users.filter((user) => Boolean(getRecordValue(user, ["email"]))).length)}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF] dark:text-sky-200">Reachable by email</p>
                    </div>
                  </div>
                </section>

                <ManagementTable
                  title="Customer directory"
                  rows={users}
                  columns={["Customer", "Contact", "Status", "Created", "Action"]}
                >
                  {(row, index) => {
                    const id = getId(row);
                    const name = getPersonName(row);
                    const email = String(getRecordValue(row, ["email"]) ?? "Not available");
                    const phone = String(getRecordValue(row, ["phone", "phone_number"]) ?? "Not available");

                    return (
                      <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#069AFF]/10 text-sm font-bold text-[#069AFF] ring-1 ring-[#069AFF]/15">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-950 dark:text-white">{name}</p>
                              <p className="mt-1 break-all text-xs font-medium text-slate-500 dark:text-slate-400">{id || `User ${index + 1}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{email}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{phone}</p>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openUserDashboard(id, name)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              Dashboard
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openBroadcast(id, name)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                            >
                              <Send className="h-4 w-4" aria-hidden="true" />
                              Broadcast
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </ManagementTable>
              </div>
            )}

            {currentSection === "tiers" && (
              <div className="grid gap-6">
                <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-white shadow-sm dark:border-[#069AFF]/25 dark:bg-white/[0.045]">
                  <div className="grid gap-5 bg-[linear-gradient(135deg,#06172b_0%,#083d70_60%,#069AFF_150%)] p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Account limits</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight">Account tier management</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Manage customer tier descriptions, deposit limits, withdrawal limits, and tier benefits.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateAccountTier}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create tier
                    </button>
                  </div>
                </section>

                <ManagementTable title="Account tiers" rows={accountTiers} columns={["Tier", "Description", "Limits", "Benefits", "Action"]}>
                  {(row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["tier", "name"]) ?? `Tier ${index + 1}`)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["description"]) ?? "Not available")}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950 dark:text-white">Deposit: {formatCurrency(getRecordValue(row, ["deposit"]))}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Withdrawal: {formatCurrency(getRecordValue(row, ["withdrawal"]))}</p>
                      </td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["benefits"]) ?? "Not available")}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!getId(row)}
                          onClick={() => openEditAccountTier(row)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  )}
                </ManagementTable>
              </div>
            )}

            {currentSection === "support" && (
              <div className="grid gap-6">
                <section className="grid gap-5 md:grid-cols-3">
                  <SummaryCard label="Complaints" value={formatValue(complaints.length)} icon={Send} />
                  <SummaryCard label="Live chats" value={formatValue(liveChat.length)} icon={Users} />
                  <SummaryCard label="Open complaints" value={formatValue(complaints.filter((item) => String(getRecordValue(item, ["status"]) ?? "open").toLowerCase() === "open").length)} icon={AlertCircle} />
                </section>

                <ManagementTable title="Complaints" rows={complaints} columns={["Customer", "Complaint", "Status", "Updated", "Action"]}>
                  {(row, index) => {
                    const id = getId(row);
                    return (
                      <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userName", "email", "userId"]) ?? `Complaint ${index + 1}`)}</td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["title", "subject", "category"]) ?? "Complaint")}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["message", "content", "description"]) ?? "No message")}</p>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "open"} /></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["updatedAt", "createdAt"]))}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openReplyComplaint(id)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                            >
                              <Send className="h-4 w-4" aria-hidden="true" />
                              Reply
                            </button>
                            {["in-progress", "resolved", "closed"].map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={!id || busyAction === `complaint-${id}-${status}`}
                                onClick={() => updateComplaintStatus(id, status)}
                                className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                              >
                                {formatLabel(status)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </ManagementTable>

                <ManagementTable title="Live chat inbox" rows={liveChat} columns={["Customer", "Last message", "Status", "Updated"]}>
                  {(row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userName", "email", "userId"]) ?? `Chat ${index + 1}`)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["lastMessage", "message", "content", "text"]) ?? "No message")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "open"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["updatedAt", "createdAt"]))}</td>
                    </tr>
                  )}
                </ManagementTable>
              </div>
            )}

            {currentSection === "content" && (
              <div className="grid gap-6">
                <section className="grid gap-5 md:grid-cols-3">
                  <SummaryCard label="Complaint categories" value={formatValue(complaintCategories.length)} icon={BriefcaseBusiness} />
                  <SummaryCard label="Contact entries" value={formatValue(contactUs.length)} icon={Users} />
                  <SummaryCard label="FAQs" value={formatValue(faqs.length)} icon={FileCheck2} />
                </section>

                <div className="grid gap-6 xl:grid-cols-3">
                  <ManagementTable
                    title="Complaint categories"
                    rows={complaintCategories}
                    columns={["Category", "Created"]}
                    action={<button type="button" onClick={openCreateComplaintCategory} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" aria-hidden="true" />New</button>}
                  >
                    {(row, index) => (
                      <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["text", "name", "title"]) ?? `Category ${index + 1}`)}</td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      </tr>
                    )}
                  </ManagementTable>

                  <ManagementTable
                    title="Contact us"
                    rows={contactUs}
                    columns={["Name", "Value", "Action"]}
                    action={<button type="button" onClick={openCreateContact} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" aria-hidden="true" />New</button>}
                  >
                    {(row, index) => (
                      <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["name"]) ?? `Contact ${index + 1}`)}</td>
                        <td className="px-5 py-4">{String(getRecordValue(row, ["value"]) ?? "Not available")}</td>
                        <td className="px-5 py-4"><button type="button" onClick={() => openEditContact(row)} className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF]">Edit</button></td>
                      </tr>
                    )}
                  </ManagementTable>

                  <ManagementTable
                    title="FAQs"
                    rows={faqs}
                    columns={["Question", "Answer", "Action"]}
                    action={<button type="button" onClick={openCreateFaq} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" aria-hidden="true" />New</button>}
                  >
                    {(row, index) => (
                      <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["title"]) ?? `FAQ ${index + 1}`)}</td>
                        <td className="px-5 py-4"><span className="line-clamp-2">{String(getRecordValue(row, ["content"]) ?? "Not available")}</span></td>
                        <td className="px-5 py-4"><button type="button" onClick={() => openEditFaq(row)} className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF]">Edit</button></td>
                      </tr>
                    )}
                  </ManagementTable>
                </div>
              </div>
            )}

            {currentSection === "reports" && (
              <div className="grid gap-6">
                <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-white shadow-sm dark:border-[#069AFF]/25 dark:bg-white/[0.045]">
                  <div className="grid gap-5 bg-[linear-gradient(135deg,#06172b_0%,#083d70_60%,#069AFF_150%)] p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Financial intelligence</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight">Executive reports for finance, revenue, and loan quality</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Pull live management reports with a controlled date window. Each report card reads the API response directly and surfaces the most useful figures first.
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-2">
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">From date</span>
                        <input
                          type="date"
                          value={reportFilters.fromDate}
                          onChange={(event) => setReportFilters((current) => ({ ...current, fromDate: event.target.value }))}
                          className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">To date</span>
                        <input
                          type="date"
                          value={reportFilters.toDate}
                          onChange={(event) => setReportFilters((current) => ({ ...current, toDate: event.target.value }))}
                          className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void refreshReports()}
                        disabled={reports.loading}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-70"
                      >
                        {reports.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                        Apply range
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const defaults = getDefaultReportFilters();
                          setReportFilters(defaults);
                          void refreshReports(defaults);
                        }}
                        disabled={reports.loading}
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label={`Financial · ${financialLead.label}`} value={financialLead.value} icon={Landmark} />
                  <SummaryCard label={`Loan performance · ${loanPerformanceLead.label}`} value={loanPerformanceLead.value} icon={CreditCard} />
                  <SummaryCard label={`Profit & loss · ${profitLossLead.label}`} value={profitLossLead.value} icon={BriefcaseBusiness} />
                  <SummaryCard label={`Revenue · ${revenueLead.label}`} value={revenueLead.value} icon={WalletCards} />
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <ReportPanel
                    title="Financial report"
                    description="Balance, movement, and operating figures"
                    payload={reports.data.financial}
                    error={reports.errors.financial}
                    icon={Landmark}
                  />
                  <ReportPanel
                    title="Loan performance"
                    description="Portfolio quality, repayments, and exposure"
                    payload={reports.data.loanPerformance}
                    error={reports.errors.loanPerformance}
                    icon={CreditCard}
                  />
                  <ReportPanel
                    title="Profit and loss"
                    description="Income, expenses, and operating result"
                    payload={reports.data.profitLoss}
                    error={reports.errors.profitLoss}
                    icon={BriefcaseBusiness}
                  />
                  <ReportPanel
                    title="Revenue report"
                    description="Collections, fees, and earnings summary"
                    payload={reports.data.revenue}
                    error={reports.errors.revenue}
                    icon={WalletCards}
                  />
                </div>
              </div>
            )}

            {currentSection === "kyc" && (
              <ManagementTable
                title="KYC reviews"
                rows={kycs}
                columns={["User", "Tier", "Status", "Created", "Action"]}
                action={
                  <button
                    type="button"
                    onClick={openCreateKycNotice}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] dark:bg-[#069AFF] dark:text-white dark:hover:bg-[#27a7ff]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New KYC
                  </button>
                }
              >
                {(row, index) => {
                  const id = getId(row);
                  const pending = String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "pending";
                  return (
                    <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["userId", "user_id", "email"]) ?? `KYC ${index + 1}`)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["tier", "level"]) ?? "Not available")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!id}
                            onClick={() => openDetail("KYC details", () => adminService.getKycById(id))}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={!id || !pending || busyAction === `kyc-${id}-approve`}
                            onClick={() => reviewKyc(id, "approve")}
                            className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={!id || !pending || busyAction === `kyc-${id}-reject`}
                            onClick={() => reviewKyc(id, "reject")}
                            className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </ManagementTable>
            )}

            {currentSection === "loans" && (
              <div className="grid gap-6">
                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Loan records" value={formatValue(loans.length)} icon={CreditCard} />
                  <SummaryCard label="App loans" value={formatValue(appLoans.length)} icon={CreditCard} />
                  <SummaryCard label="Loan types" value={formatValue(loanTypes.length)} icon={BriefcaseBusiness} />
                  <SummaryCard label="Loan packages" value={formatValue(loanPackages.length)} icon={CheckCircle2} />
                </section>

                <ManagementTable
                  title="Loan types"
                  rows={loanTypes}
                  columns={["Type", "Amount range", "Status", "Durations", "Action"]}
                  action={
                    <button type="button" onClick={openCreateLoanType} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New type
                    </button>
                  }
                >
                  {(row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["name"]) ?? `Loan type ${index + 1}`)}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["slug", "description"]) ?? "No slug")}</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">
                        {formatCurrency(getRecordValue(row, ["minAmount"]))} - {formatCurrency(getRecordValue(row, ["maxAmount"]))}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                      <td className="px-5 py-4">{formatValue(Array.isArray(row.durations) ? row.durations.length : 0)}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!getId(row)}
                          onClick={() => openEditLoanType(row)}
                          className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )}
                </ManagementTable>

                <ManagementTable title="Application loans" rows={appLoans} columns={["Applicant", "Loan", "Exposure", "Status", "Action"]}>
                  {(row, index) => {
                    const id = getId(row);
                    return (
                      <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userName", "userId"]) ?? `Application ${index + 1}`)}</p>
                          <p className="mt-1 break-all text-xs font-medium text-slate-500 dark:text-slate-400">{id || "No loan id"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["loanTypeName", "purposeText"]) ?? "Application loan")}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["durationLabel"]) ?? "No duration")}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount"]))}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Outstanding: {formatCurrency(getRecordValue(row, ["outstandingAmount"]))}</p>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} /></td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openAppLoanDetail(id)}
                              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              disabled={!id || busyAction === `app-loan-${id}-score`}
                              onClick={() => runAppLoanAction(id, "score", () => adminService.scoreAppLoan(id, { crb_provider: "crc" }))}
                              className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                            >
                              Score
                            </button>
                            <button
                              type="button"
                              disabled={!id || busyAction === `app-loan-${id}-approve`}
                              onClick={() => runAppLoanAction(id, "approve", () => adminService.approveAppLoan(id))}
                              className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openRejectAppLoan(id)}
                              className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openApproveTopUp(id)}
                              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              Top-up approve
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openRejectTopUp(id)}
                              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              Top-up reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </ManagementTable>

                <ManagementTable title="Loans" rows={loans} columns={["Customer", "Amount", "Status", "Created", "Action"]}>
                  {(row, index) => {
                    const id = getId(row);
                    const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
                    const canReview = !["approved", "active", "rejected"].includes(status);
                    const trackingRef = String(getRecordValue(row, ["bankoneLoanTrackingRef"]) ?? "");
                    const accountNumber = String(getRecordValue(row, ["bankoneLoanAccountNumber"]) ?? "");
                    return (
                      <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userId", "email"]) ?? `Loan ${index + 1}`)}</p>
                          <div className="mt-2 grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {trackingRef && <p className="break-all">Tracking ref: {trackingRef}</p>}
                            {accountNumber && <p className="break-all">Account no: {accountNumber}</p>}
                            {!trackingRef && !accountNumber && <p>No BankOne identifiers on this record.</p>}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount", "loanAmount", "principal"]))}</td>
                        <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} /></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openDetail("Loan details", () => adminService.getLoanDetails(id))}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={!id || !canReview || busyAction === `loan-${id}-approve`}
                              onClick={() => reviewLoan(id, "approve")}
                              className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!id || !canReview || busyAction === `loan-${id}-reject`}
                              onClick={() => reviewLoan(id, "reject")}
                              className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={!id || busyAction === `loan-${id}-create-app-loan`}
                              onClick={() => runLoanMaintenanceAction(id, "create-app-loan", () => adminService.createAppLoanFromLoan(id))}
                              className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white disabled:opacity-60 dark:text-sky-200"
                            >
                              Create app loan
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openSyncBankoneStatus(id)}
                              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              Sync BankOne
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </ManagementTable>
              </div>
            )}
          </>
        )}
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
      {userDashboard && <UserDashboardModal key={userDashboard.userId} dashboard={userDashboard} onClose={() => setUserDashboard(null)} />}
      {appLoanDetail && <AppLoanDetailsModal loan={appLoanDetail} onClose={() => setAppLoanDetail(null)} />}
      {bankoneSyncResult && <BankoneSyncResultModal result={bankoneSyncResult} onClose={() => setBankoneSyncResult(null)} />}
      {formAction && <ActionModal action={formAction} onClose={() => setFormAction(null)} />}
      {roleModalOpen && (
        <RoleCreateModal
          permissions={permissions}
          onClose={() => setRoleModalOpen(false)}
          onCreate={createRole}
        />
      )}
    </main>
  );
}
