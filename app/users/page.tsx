"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Swal from "sweetalert2";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3, CalendarDays,
  CheckCircle2, Clock3, Copy,
  CreditCard, Database,
  Eye,
  FileText, Fingerprint, Globe2, KeyRound,
  Landmark,
  Loader2,
  LogOut, Mail, MapPin,
  Moon, Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck, Smartphone,
  Sun, UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";

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

type UserControlsTarget = {
  userId: string;
  userName: string;
  status: string;
};

type OtpChallenge = {
  challengeId: string;
  channel?: string;
  email?: string;
  expiresAt?: string;
};

type UsersState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type FormField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "email" | "tel" | "text" | "textarea";
  required?: boolean;
  helper?: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumericLike = (value: unknown) =>
  typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));

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

const getId = (record: Record<string, unknown>) => String(getRecordValue(record, ["_id", "id", "userId"]) ?? "");

const getPersonName = (record: Record<string, unknown>) => {
  const firstName = String(getRecordValue(record, ["first_name", "firstName"]) ?? "").trim();
  const lastName = String(getRecordValue(record, ["last_name", "lastName"]) ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return String(
      getRecordValue(record, ["name", "fullName"]) ??
      fullName ??
      record.email ??
      "Unknown user"
  );
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

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;

    if (isRecord(payload) && typeof payload.message === "string") {
      return payload.message;
    }
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Request failed";
};

const getResponseMessage = (payload: unknown, fallback: string) => {
  if (isRecord(payload) && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const buildAlertHtml = (payload: unknown) => {
  const source = unwrapPayload(payload);

  if (source === null || source === undefined) {
    return "";
  }

  const serialized = typeof source === "string" ? source : JSON.stringify(source, null, 2);

  if (!serialized || serialized === "{}" || serialized === "[]") {
    return "";
  }

  const preview = serialized.length > 2200 ? `${serialized.slice(0, 2200)}\n...` : serialized;

  return `
    <div style="text-align:left;margin-top:8px;">
      <div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">
        Server response
      </div>
      <div style="max-height:320px;overflow:auto;border:1px solid #cbd5e1;border-radius:14px;background:#0f172a;padding:14px;">
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.55;color:#e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(preview)}</pre>
      </div>
    </div>
  `;
};

const showServerResponseAlert = async (
  payload: unknown,
  fallbackTitle: string,
  icon: "success" | "error" = "success",
) => {
  const title = getResponseMessage(payload, fallbackTitle);
  const html = buildAlertHtml(payload);

  await Swal.fire({
    icon,
    title,
    html: html || undefined,
    text: html ? undefined : title,
    confirmButtonColor: "#069AFF",
    width: 760,
  });
};

const showServerErrorAlert = async (error: unknown, fallbackTitle: string) => {
  const payload =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { data?: unknown } }).response?.data
      : null;

  if (payload) {
    await showServerResponseAlert(payload, fallbackTitle, "error");
    return;
  }

  await Swal.fire({
    icon: "error",
    title: fallbackTitle,
    text: getErrorMessage(error),
    confirmButtonColor: "#069AFF",
    width: 640,
  });
};

const getOtpChallenge = (payload: unknown): OtpChallenge | null => {
  if (!isRecord(payload) || payload.requiresOtp !== true || !isRecord(payload.data)) {
    return null;
  }

  if (typeof payload.data.challengeId !== "string" || !payload.data.challengeId.trim()) {
    return null;
  }

  return {
    challengeId: payload.data.challengeId,
    channel: typeof payload.data.channel === "string" ? payload.data.channel : undefined,
    email: typeof payload.data.email === "string" ? payload.data.email : undefined,
    expiresAt: typeof payload.data.expiresAt === "string" ? payload.data.expiresAt : undefined,
  };
};

const getCollectionRows = (payload: unknown, key: string) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data) || !isRecord(data[key])) {
    return [] as Record<string, unknown>[];
  }

  const rows = data[key].data;
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
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

const getDefaultUserTransactionFilters = (): UserTransactionFilters => ({
  fromDate: "",
  toDate: "",
  status: "",
  limit: "50",
});

const fetchUsers = async (): Promise<UsersState> => {
  try {
    const payload = await adminService.getUsers();

    return {
      payload,
      rows: extractRows(payload),
      loading: false,
      loaded: true,
      error: "",
    };
  } catch (error) {
    return {
      payload: null,
      rows: [],
      loading: false,
      loaded: true,
      error: getErrorMessage(error),
    };
  }
};

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const tone =
    normalized === "success" || normalized === "approved" || normalized === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : normalized === "failed" || normalized === "rejected" || normalized === "disabled"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone}`}>
      {String(status ?? "pending")}
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

function TransactionTimeline({ rows }: { rows: Record<string, unknown>[] }) {
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
                .join(" / ");

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
const safeText = (value: unknown, fallback = "Not available") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const getBooleanStatus = (value: unknown) =>
    value === true || String(value).toLowerCase() === "true";

const maskMiddle = (value: unknown, visibleStart = 3, visibleEnd = 3) => {
  const text = safeText(value, "");

  if (!text) return "Not available";
  if (text.length <= visibleStart + visibleEnd) return "••••";

  return `${text.slice(0, visibleStart)}${"•".repeat(Math.min(8, text.length - visibleStart - visibleEnd))}${text.slice(-visibleEnd)}`;
};

const getUserInitials = (record: Record<string, unknown>) => {
  const firstName = safeText(getRecordValue(record, ["first_name", "firstName"]), "");
  const lastName = safeText(getRecordValue(record, ["last_name", "lastName"]), "");
  const email = safeText(record.email, "");

  const initials = [firstName, lastName]
      .filter(Boolean)
      .map((name) => name.charAt(0))
      .join("");

  return (initials || email.slice(0, 2) || "US").toUpperCase();
};

const sanitizeProfileRecord = (record: Record<string, unknown>) => {
  const hiddenKeys = ["password", "pin", "verificationCode"];
  const maskedKeys = ["bvn", "nin"];

  return Object.entries(record).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (hiddenKeys.includes(key)) {
      accumulator[key] = "********";
      return accumulator;
    }

    if (maskedKeys.includes(key)) {
      accumulator[key] = maskMiddle(value);
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
};

const getProfileCompletion = (record: Record<string, unknown>) => {
  const requiredFields = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "dob",
    "gender",
    "bvn",
    "nin",
    "bankone_customerid",
    "bankone_account_number",
  ];

  const completed = requiredFields.filter((field) => {
    const value = record[field];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length;

  return Math.round((completed / requiredFields.length) * 100);
};

function VerificationPill({ verified, label }: { verified: boolean; label: string }) {
  return (
      <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
              verified
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
          }`}
      >
      {verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {label}
    </span>
  );
}

function ProfileMetricCard({
                             label,
                             value,
                             icon: Icon,
                             tone = "blue",
                           }: {
  label: string;
  value: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const toneClass =
      tone === "green"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20"
          : tone === "amber"
              ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/20"
              : tone === "slate"
                  ? "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
                  : "bg-[#069AFF]/10 text-[#069AFF] ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200 dark:ring-[#069AFF]/25";

  return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
  );
}

function ProfileSection({
                          title,
                          description,
                          children,
                        }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
          {description && (
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                {description}
              </p>
          )}
        </div>

        <div className="p-5">{children}</div>
      </section>
  );
}

function ProfileInfoTile({
                           label,
                           value,
                           icon: Icon,
                           copyValue,
                           copied,
                           onCopy,
                         }: {
  label: string;
  value: ReactNode;
  icon: typeof Users;
  copyValue?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
      <div className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#069AFF]/35 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-[#069AFF]/35 dark:hover:bg-white/[0.045]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#069AFF] ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <div className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">
              {value}
            </div>
          </div>

          {copyValue && copyValue !== "Not available" && (
              <button
                  type="button"
                  onClick={onCopy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 opacity-100 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-sky-200 md:opacity-0 md:group-hover:opacity-100"
                  title="Copy"
              >
                {copied ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
          )}
        </div>
      </div>
  );
}
function DetailModal({ detail, onClose }: { detail: DetailState; onClose: () => void }) {
  const [copiedKey, setCopiedKey] = useState("");

  const data = unwrapPayload(detail.data);
  const record = isRecord(data) ? data : {};

  const fullName = getPersonName(record);
  const email = safeText(record.email);
  const phone = safeText(record.phone);
  const userId = safeText(record._id);
  const profileCompletion = getProfileCompletion(record);

  const emailVerified = getBooleanStatus(record.emailVerified);
  const phoneVerified = getBooleanStatus(record.phoneVerified);

  const loginLocation = isRecord(record.lastLoginLocation) ? record.lastLoginLocation : {};

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);

      window.setTimeout(() => {
        setCopiedKey("");
      }, 1200);
    } catch {
      setCopiedKey("");
    }
  };

  const identityItems = [
    {
      label: "First name",
      value: safeText(getRecordValue(record, ["first_name", "firstName"])),
      icon: UserRound,
    },
    {
      label: "Last name",
      value: safeText(getRecordValue(record, ["last_name", "lastName"])),
      icon: UserRound,
    },
    {
      label: "Gender",
      value: safeText(record.gender),
      icon: Users,
    },
    {
      label: "Date of birth",
      value: formatDate(record.dob),
      icon: CalendarDays,
    },
    {
      label: "Nationality",
      value: safeText(record.nationality),
      icon: Globe2,
    },
    {
      label: "Tier",
      value: `Tier ${safeText(record.tier, "0")}`,
      icon: ShieldCheck,
    },
  ];

  const contactItems = [
    {
      label: "Email address",
      value: email,
      icon: Mail,
      copyKey: "email",
      copyValue: email,
    },
    {
      label: "Phone number",
      value: phone,
      icon: Phone,
      copyKey: "phone",
      copyValue: phone,
    },
    {
      label: "Email status",
      value: <VerificationPill verified={emailVerified} label={emailVerified ? "Verified" : "Unverified"} />,
      icon: BadgeCheck,
    },
    {
      label: "Phone status",
      value: <VerificationPill verified={phoneVerified} label={phoneVerified ? "Verified" : "Unverified"} />,
      icon: BadgeCheck,
    },
  ];

  const kycItems = [
    {
      label: "BVN",
      value: maskMiddle(record.bvn),
      icon: Fingerprint,
      copyKey: "bvn",
      copyValue: safeText(record.bvn),
    },
    {
      label: "NIN",
      value: maskMiddle(record.nin),
      icon: Fingerprint,
      copyKey: "nin",
      copyValue: safeText(record.nin),
    },
    {
      label: "Xpress customer ID",
      value: safeText(record.xpressCustomerId),
      icon: Database,
      copyKey: "xpressCustomerId",
      copyValue: safeText(record.xpressCustomerId),
    },
    {
      label: "Xpress wallet ID",
      value: safeText(record.xpressWalletId),
      icon: WalletCards,
      copyKey: "xpressWalletId",
      copyValue: safeText(record.xpressWalletId),
    },
    {
      label: "BankOne customer ID",
      value: safeText(record.bankone_customerid),
      icon: Landmark,
      copyKey: "bankone_customerid",
      copyValue: safeText(record.bankone_customerid),
    },
    {
      label: "BankOne account number",
      value: safeText(record.bankone_account_number),
      icon: CreditCard,
      copyKey: "bankone_account_number",
      copyValue: safeText(record.bankone_account_number),
    },
  ];

  const securityItems = [
    {
      label: "Last login",
      value: formatDate(record.lastLoginAt),
      icon: Clock3,
    },
    {
      label: "Login count",
      value: safeText(record.loginCount, "0"),
      icon: BarChart3,
    },
    {
      label: "Last login IP",
      value: safeText(record.lastLoginIp),
      icon: KeyRound,
      copyKey: "lastLoginIp",
      copyValue: safeText(record.lastLoginIp),
    },
    {
      label: "Device / User agent",
      value: safeText(record.lastLoginUserAgent),
      icon: Smartphone,
    },
    {
      label: "Location",
      value: [loginLocation.city, loginLocation.region, loginLocation.country].filter(Boolean).join(", ") || "Not available",
      icon: MapPin,
    },
    {
      label: "Timezone",
      value: safeText(loginLocation.timezone),
      icon: Globe2,
    },
  ];

  const sanitizedRecord = sanitizeProfileRecord(record);

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
          <div className="relative overflow-hidden border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_52%,#069AFF_145%)] px-6 py-6 text-white">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 left-1/2 h-64 w-64 rounded-full bg-[#069AFF]/25 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/15 text-2xl font-black text-white shadow-lg shadow-black/10">
                  {getUserInitials(record)}
                </div>

                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-sky-100">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Customer profile
                  </div>

                  <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                    {detail.loading ? "Loading profile..." : fullName}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                    <span>{email}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-flex" />
                    <span>{phone}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <VerificationPill verified={emailVerified} label={emailVerified ? "Email verified" : "Email pending"} />
                    <VerificationPill verified={phoneVerified} label={phoneVerified ? "Phone verified" : "Phone pending"} />

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Tier {safeText(record.tier, "0")}
                  </span>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => void copyText("userId", userId)}
                    disabled={userId === "Not available"}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copiedKey === "userId" ? <BadgeCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy ID
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Close details"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-slate-50 p-5 dark:bg-[#07111f]">
            {detail.loading && (
                <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Loading customer profile
                </div>
            )}

            {detail.error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {detail.error}
                </div>
            )}

            {!detail.loading && !detail.error && (
                <div className="grid gap-5">
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ProfileMetricCard
                        label="Profile completion"
                        value={`${profileCompletion}%`}
                        icon={BarChart3}
                        tone={profileCompletion >= 80 ? "green" : "amber"}
                    />
                    <ProfileMetricCard
                        label="Verification"
                        value={emailVerified && phoneVerified ? "Verified" : "Pending"}
                        icon={BadgeCheck}
                        tone={emailVerified && phoneVerified ? "green" : "amber"}
                    />
                    <ProfileMetricCard
                        label="Login count"
                        value={safeText(record.loginCount, "0")}
                        icon={Activity}
                        tone="blue"
                    />
                    <ProfileMetricCard
                        label="Account tier"
                        value={`Tier ${safeText(record.tier, "0")}`}
                        icon={ShieldCheck}
                        tone="slate"
                    />
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="grid gap-5">
                      <ProfileSection
                          title="Personal information"
                          description="Core customer identity information returned from the user profile endpoint."
                      >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {identityItems.map((item) => (
                              <ProfileInfoTile
                                  key={item.label}
                                  label={item.label}
                                  value={item.value}
                                  icon={item.icon}
                              />
                          ))}
                        </div>
                      </ProfileSection>

                      <ProfileSection
                          title="KYC, wallet and BankOne identifiers"
                          description="Sensitive values are masked in the UI. Use copy only when operationally required."
                      >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {kycItems.map((item) => (
                              <ProfileInfoTile
                                  key={item.label}
                                  label={item.label}
                                  value={item.value}
                                  icon={item.icon}
                                  copyValue={item.copyValue}
                                  copied={copiedKey === item.copyKey}
                                  onCopy={() => void copyText(item.copyKey, item.copyValue)}
                              />
                          ))}
                        </div>
                      </ProfileSection>
                    </div>

                    <div className="grid gap-5">
                      <ProfileSection title="Contact verification">
                        <div className="grid gap-3">
                          {contactItems.map((item) => (
                              <ProfileInfoTile
                                  key={item.label}
                                  label={item.label}
                                  value={item.value}
                                  icon={item.icon}
                                  copyValue={item.copyValue}
                                  copied={copiedKey === item.copyKey}
                                  onCopy={() => void copyText(item.copyKey ?? item.label, item.copyValue ?? "")}
                              />
                          ))}
                        </div>
                      </ProfileSection>

                      <ProfileSection title="Audit timestamps">
                        <div className="grid gap-3">
                          <ProfileInfoTile
                              label="Created at"
                              value={formatDate(record.createdAt)}
                              icon={CalendarDays}
                          />
                          <ProfileInfoTile
                              label="Updated at"
                              value={formatDate(record.updatedAt)}
                              icon={Clock3}
                          />
                          <ProfileInfoTile
                              label="User ID"
                              value={userId}
                              icon={Database}
                              copyValue={userId}
                              copied={copiedKey === "profileUserId"}
                              onCopy={() => void copyText("profileUserId", userId)}
                          />
                        </div>
                      </ProfileSection>
                    </div>
                  </section>

                  <ProfileSection
                      title="Login and security intelligence"
                      description="Last known sign-in metadata for monitoring account access."
                  >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {securityItems.map((item) => (
                          <ProfileInfoTile
                              key={item.label}
                              label={item.label}
                              value={item.value}
                              icon={item.icon}
                              copyValue={item.copyValue}
                              copied={copiedKey === item.copyKey}
                              onCopy={() => void copyText(item.copyKey ?? item.label, item.copyValue ?? "")}
                          />
                      ))}
                    </div>
                  </ProfileSection>

                  <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-950 dark:text-white">
                      View sanitized raw profile payload
                    </summary>

                    <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                  <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(sanitizedRecord, null, 2)}
                  </pre>
                    </div>
                  </details>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}

function UserControlsModal({
  target,
  onClose,
  onRefresh,
}: {
  target: UserControlsTarget;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState("");
  const [walletValues, setWalletValues] = useState({
    amount: "",
    walletType: "wallet",
    sourceLedger: "operations",
    narration: "",
    proofOfPayment: "",
    paymentDate: "",
  });
  const [fundWalletChallenge, setFundWalletChallenge] = useState<OtpChallenge | null>(null);
  const [fundWalletOtpCode, setFundWalletOtpCode] = useState("");

  const runAction = async (actionKey: string, request: () => Promise<unknown>, fallbackMessage: string) => {
    setLoadingAction(actionKey);

    try {
      const response = await request();
      await onRefresh();
      await showServerResponseAlert(response, fallbackMessage);
    } catch (error) {
      await showServerErrorAlert(error, "User control request failed");
    } finally {
      setLoadingAction("");
    }
  };

  const submitFundWallet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoadingAction("fund-wallet");

    const basePayload = Object.entries({
      amount: Number(walletValues.amount),
      walletType: walletValues.walletType.trim(),
      sourceLedger: walletValues.sourceLedger.trim(),
      narration: walletValues.narration.trim(),
      proofOfPayment: walletValues.proofOfPayment.trim(),
      paymentDate: walletValues.paymentDate.trim(),
    }).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
      if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});

    const payload = fundWalletChallenge
      ? {
          ...basePayload,
          otpChallengeId: fundWalletChallenge.challengeId,
          otpCode: fundWalletOtpCode.trim(),
        }
      : basePayload;

    try {
      const response = await adminService.fundUserWallet(target.userId, payload);
      const challenge = getOtpChallenge(response);

      if (challenge) {
        setFundWalletChallenge(challenge);
        await showServerResponseAlert(response, "OTP verification required to fund wallet");
        return;
      }

      await onRefresh();
      setFundWalletChallenge(null);
      setFundWalletOtpCode("");
      setWalletValues({
        amount: "",
        walletType: "wallet",
        sourceLedger: "operations",
        narration: "",
        proofOfPayment: "",
        paymentDate: "",
      });
      await showServerResponseAlert(response, `Wallet funded for ${target.userName}`);
    } catch (error) {
      await showServerErrorAlert(error, "Wallet funding request failed");
    } finally {
      setLoadingAction("");
    }
  };

  const actionCards = [
    {
      key: "reset-password",
      eyebrow: "Security",
      title: "Reset password",
      description: "Invalidate the current password and trigger the backend password reset flow for this customer.",
      actionLabel: "Reset password",
      icon: KeyRound,
      tone: "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100",
      onClick: () =>
        runAction(
          "reset-password",
          () => adminService.resetUserPassword(target.userId),
          `Password reset completed for ${target.userName}`,
        ),
    },
    {
      key: "lock-user",
      eyebrow: "Security",
      title: "Lock account",
      description: "Block access immediately when fraud review, compromise, or manual intervention is required.",
      actionLabel: "Lock user",
      icon: Fingerprint,
      tone: "border-red-200 bg-red-50/80 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
      onClick: () =>
        runAction(
          "lock-user",
          () => adminService.lockUser(target.userId),
          `${target.userName} has been locked`,
        ),
    },
    {
      key: "unlock-user",
      eyebrow: "Security",
      title: "Unlock account",
      description: "Restore access after internal review confirms the customer should be able to sign in again.",
      actionLabel: "Unlock user",
      icon: BadgeCheck,
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      onClick: () =>
        runAction(
          "unlock-user",
          () => adminService.unlockUser(target.userId),
          `${target.userName} has been unlocked`,
        ),
    },
    {
      key: "disable-user",
      eyebrow: "Access",
      title: "Disable profile",
      description: "Turn off the customer profile at application level without removing the record from operations.",
      actionLabel: "Disable user",
      icon: AlertTriangle,
      tone: "border-red-200 bg-red-50/80 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
      onClick: () =>
        runAction(
          "disable-user",
          () => adminService.disableUser(target.userId),
          `${target.userName} has been disabled`,
        ),
    },
    {
      key: "enable-user",
      eyebrow: "Access",
      title: "Enable profile",
      description: "Reinstate this customer profile for normal application use after support or compliance review.",
      actionLabel: "Enable user",
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      onClick: () =>
        runAction(
          "enable-user",
          () => adminService.enableUser(target.userId),
          `${target.userName} has been enabled`,
        ),
    },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">User controls</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{target.userName}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Perform security, access, and balance interventions for this customer without leaving the specialist workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-sky-100">
                {target.userId}
              </span>
              <span className="inline-flex rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-sky-100">
                {target.status}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close user controls"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Security and access actions</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Use the relevant control for the customer’s current situation. These actions post directly to the new user control endpoints.
                </p>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {actionCards.map((item) => {
                  const Icon = item.icon;
                  const busy = loadingAction === item.key;

                  return (
                    <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${item.tone}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.eyebrow}</p>
                      <h4 className="mt-2 text-base font-bold text-slate-950 dark:text-white">{item.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                      <button
                        type="button"
                        onClick={() => void item.onClick()}
                        disabled={Boolean(loadingAction)}
                        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                        {item.actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Wallet intervention</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Credit this customer’s wallet directly when support or financial operations require a manual balance adjustment.
                </p>
              </div>
              <form onSubmit={(event) => void submitFundWallet(event)} className="grid gap-4 p-5">
                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Amount</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={walletValues.amount}
                    onChange={(event) => setWalletValues((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="10000"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Wallet type</span>
                  <input
                    type="text"
                    value={walletValues.walletType}
                    onChange={(event) => setWalletValues((current) => ({ ...current, walletType: event.target.value }))}
                    placeholder="wallet"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Source ledger</span>
                  <input
                    type="text"
                    value={walletValues.sourceLedger}
                    onChange={(event) => setWalletValues((current) => ({ ...current, sourceLedger: event.target.value }))}
                    placeholder="operations"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Narration</span>
                  <textarea
                    rows={4}
                    value={walletValues.narration}
                    onChange={(event) => setWalletValues((current) => ({ ...current, narration: event.target.value }))}
                    placeholder="Manual funding"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Proof of payment URL</span>
                  <input
                    type="text"
                    value={walletValues.proofOfPayment}
                    onChange={(event) => setWalletValues((current) => ({ ...current, proofOfPayment: event.target.value }))}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Payment date</span>
                  <input
                    type="text"
                    value={walletValues.paymentDate}
                    onChange={(event) => setWalletValues((current) => ({ ...current, paymentDate: event.target.value }))}
                    placeholder="2026-06-11T10:30:00.000Z"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 px-4 py-3 text-xs font-medium leading-6 text-slate-600 dark:border-[#069AFF]/25 dark:bg-[#069AFF]/10 dark:text-slate-300">
                  Submit only the fields the backend expects. `amount` is required. Funding proof and payment timestamp are sent only when provided.
                </div>

                {fundWalletChallenge && (
                  <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-100">OTP confirmation required</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-amber-800 dark:text-amber-100">
                        Confirm this wallet funding with the OTP sent via {fundWalletChallenge.channel ?? "email"}.
                      </p>
                      <div className="mt-2 space-y-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                        {fundWalletChallenge.email ? <p>Recipient: {fundWalletChallenge.email}</p> : null}
                        {fundWalletChallenge.expiresAt ? <p>Expires: {formatDate(fundWalletChallenge.expiresAt)}</p> : null}
                        <p>Challenge ID: {fundWalletChallenge.challengeId}</p>
                      </div>
                    </div>

                    <label>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">OTP code</span>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={fundWalletOtpCode}
                        onChange={(event) => setFundWalletOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="482193"
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold tracking-[0.2em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </label>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(loadingAction) || Boolean(fundWalletChallenge && fundWalletOtpCode.trim().length < 6)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loadingAction === "fund-wallet" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WalletCards className="h-4 w-4" aria-hidden="true" />}
                    {fundWalletChallenge ? "Confirm funding" : "Fund wallet"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionModal({ action, onClose }: { action: FormAction; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(action.initialValues ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await action.onSubmit(values);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      await showServerErrorAlert(submitError, "User action failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {action.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{action.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{action.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close form"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {action.fields.map((field) => {
              const fieldValue = values[field.name] ?? "";
              const sharedClassName =
                "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-[#069AFF] dark:focus:ring-[#069AFF]/15";

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
                  {field.helper && <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{field.helper}</span>}
                </label>
              );
            })}
          </div>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
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
        {action ?? <Users className="h-5 w-5 text-slate-400" aria-hidden="true" />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
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

export default function UsersPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenUsers } = useRouteAccess("/users");
  const [usersState, setUsersState] = useState<UsersState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [userDashboard, setUserDashboard] = useState<UserDashboardState | null>(null);
  const [userControls, setUserControls] = useState<UserControlsTarget | null>(null);
  const [formAction, setFormAction] = useState<FormAction | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenUsers) {
      return;
    }

    void fetchUsers().then((result) => {
      if (!cancelled) {
        setUsersState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenUsers, router]);

  const refreshUsers = async () => {
    setRefreshing(true);
    setUsersState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchUsers();
    setUsersState(result);
    setRefreshing(false);
  };

  const rows = usersState.rows;

  const summaryCards = useMemo(
    () => [
      { label: "Customer records", value: formatValue(rows.length), icon: Users },
      {
        label: "Active profiles",
        value: formatValue(rows.filter((user) => String(getRecordValue(user, ["status"]) ?? "active").toLowerCase() === "active").length),
        icon: CheckCircle2,
      },
      {
        label: "Reachable by email",
        value: formatValue(rows.filter((user) => Boolean(getRecordValue(user, ["email"]))).length),
        icon: Send,
      },
      {
        label: "Phone contacts",
        value: formatValue(rows.filter((user) => Boolean(getRecordValue(user, ["phone", "phone_number"]))).length),
        icon: WalletCards,
      },
    ],
    [rows],
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const submitAndRefresh = async (request: () => Promise<unknown>, fallbackMessage: string) => {
    const response = await request();
    await refreshUsers();
    setFormAction(null);
    await showServerResponseAlert(response, fallbackMessage);
  };

  const openDetail = (title: string, request: () => Promise<unknown>) => {
    setDetail({
      title,
      loading: true,
      data: null,
      error: "",
    });

    void request()
      .then((data) =>
        setDetail({
          title,
          loading: false,
          data,
          error: "",
        }),
      )
      .catch((error) =>
        setDetail({
          title,
          loading: false,
          data: null,
          error: getErrorMessage(error),
        }),
      );
  };

  const openCreateUser = () => {
    setFormAction({
      eyebrow: "Customer onboarding",
      title: "Create customer profile",
      description: "Create a new platform user record with the profile fields required by the backend.",
      submitLabel: "Create user",
      fields: [
        { name: "first_name", label: "First name", required: true, placeholder: "Iyanu" },
        { name: "last_name", label: "Last name", required: true, placeholder: "Akinlabi" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "customer@eazycredit.com" },
        { name: "phone", label: "Phone", type: "tel", required: true, placeholder: "+2348012345678" },
        { name: "bankone_customerid", label: "BankOne customer ID", placeholder: "000131" },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.createUser(values), "Customer profile created"),
    });
  };

  const openBroadcast = (userId: string, userName: string) => {
    setFormAction({
      eyebrow: "Customer communication",
      title: `Broadcast to ${userName}`,
      description: "Send a direct broadcast message to this customer.",
      submitLabel: "Send broadcast",
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "Account update" },
        { name: "content", label: "Message", type: "textarea", required: true, placeholder: "Your account has been updated successfully." },
      ],
      onSubmit: (values) => submitAndRefresh(() => adminService.broadcastToUser(userId, values), `Broadcast delivered to ${userName}`),
    });
  };

  const openUserDashboard = (userId: string, userName: string) => {
    setUserDashboard({
      title: "Customer dashboard",
      loading: true,
      data: null,
      error: "",
      userId,
      userName,
    });

    void adminService
      .getUserDashboard(userId)
      .then((data) =>
        setUserDashboard({
          title: "Customer dashboard",
          loading: false,
          data,
          error: "",
          userId,
          userName,
        }),
      )
      .catch((error) =>
        setUserDashboard({
          title: "Customer dashboard",
          loading: false,
          data: null,
          error: getErrorMessage(error),
          userId,
          userName,
        }),
      );
  };

  const openUserControls = (userId: string, userName: string, status: string) => {
    setUserControls({
      userId,
      userName,
      status,
    });
  };

  if (!canOpenUsers) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8">
        <AccessDeniedState
          title="Customer workspace access denied"
          description="Your current admin role does not include permission to manage customer records."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Customer Directory
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Detailed management of customer profiles, accounts, and activities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshUsers()}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Sync
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        {!usersState.loaded ? (
          <div className="grid gap-5">
            <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
              ))}
            </div>
            <div className="h-[520px] animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Customer operations
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Full customer directory and finance visibility in one dedicated workspace.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Review profiles, open customer dashboards, inspect transaction intelligence, and push direct broadcasts without mixing this work into governance tabs.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  {[
                    ["Profiles loaded", rows.length],
                    ["Active customers", rows.filter((user) => String(getRecordValue(user, ["status"]) ?? "active").toLowerCase() === "active").length],
                    ["Email contacts", rows.filter((user) => Boolean(getRecordValue(user, ["email"]))).length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-white/10 bg-white/[0.08] p-4 text-center">
                      <p className="text-2xl font-bold">{formatValue(value)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-100">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {usersState.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {usersState.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <ManagementTable
              title="Customer directory"
              rows={rows}
              columns={["Customer", "Contact", "Status", "Created", "Action"]}
              action={
                <button type="button" onClick={openCreateUser} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#069AFF] px-3 text-xs font-bold text-white">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create user
                </button>
              }
            >
              {(row, index) => {
                const id = getId(row);
                const name = getPersonName(row);
                const email = String(getRecordValue(row, ["email"]) ?? "Not available");
                const phone = String(getRecordValue(row, ["phone", "phone_number"]) ?? "Not available");
                const status = String(getRecordValue(row, ["status"]) ?? "active");

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
                          onClick={() => openDetail(`${name} profile`, () => adminService.getUserDetails(id))}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                        >
                          <FileText className="h-4 w-4" aria-hidden="true" />
                          Profile
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
                        <button
                          type="button"
                          disabled={!id}
                          onClick={() => openUserControls(id, name, status)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                        >
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          Controls
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }}
            </ManagementTable>
          </>
        )}
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
      {userDashboard && <UserDashboardModal key={userDashboard.userId} dashboard={userDashboard} onClose={() => setUserDashboard(null)} />}
      {userControls && <UserControlsModal target={userControls} onClose={() => setUserControls(null)} onRefresh={refreshUsers} />}
      {formAction && <ActionModal action={formAction} onClose={() => setFormAction(null)} />}
    </main>
  );
}
