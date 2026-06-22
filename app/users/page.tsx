"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
  ShieldAlert, ShieldCheck, Smartphone,
  Sun, UserRound,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";
import { OtpInput } from "@/components/OtpInput";

type DetailState = {
  title: string;
  loading: boolean;
  data: unknown;
  error: string;
};

type UserDashboardTab = "overview" | "transactions" | "kyc";

type UserTransactionFilters = {
  fromDate: string;
  toDate: string;
  status: string;
  limit: string;
};

type UserDashboardState = DetailState & {
  userId: string;
  userName: string;
  userEmail: string;
};

type UserTransactionsState = DetailState & {
  loaded: boolean;
};

type UserKycState = DetailState & {
  loaded: boolean;
};

type WalletStatementFilters = {
  walletType: string;
  fromDate: string;
  toDate: string;
  status: string;
  transactionType: string;
  category: string;
  format: "csv" | "pdf";
  email: string;
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
type ToastTone = "success" | "error" | "warning" | "info";
type ToastNotice = {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
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

const extractRowsOrRecord = (payload: unknown): Record<string, unknown>[] => {
  const rows = extractRows(payload);

  if (rows.length) {
    return rows;
  }

  const value = unwrapPayload(payload);

  if (isRecord(value)) {
    return [value];
  }

  return [];
};

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const parseJsonObjectInput = (value: string, fallback: Record<string, unknown> = {}) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!isRecord(parsed)) {
      throw new Error("Notification data must be a JSON object.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "Notification data must be a JSON object.") {
      throw error;
    }

    throw new Error("Notification data must be valid JSON.");
  }
};

const getPrimitiveRecordItems = (record: Record<string, unknown>) =>
  Object.entries(record)
    .filter(([, value]) => !isRecord(value) && !Array.isArray(value))
    .map(([key, value]) => ({
      label: formatLabel(key),
      value,
    }));

const getImageFieldEntries = (record: Record<string, unknown>) =>
  Object.entries(record).filter(
    ([key, value]) =>
      isHttpUrl(value) &&
      /(image|photo|selfie|passport|address|document|id)/i.test(key),
  );

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

const getErrorPayload = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as { response?: { data?: unknown } }).response?.data;
  }

  return null;
};

const getResponseDetail = (payload: unknown) => {
  if (!isRecord(payload)) {
    return "";
  }

  const parts = [payload.code, payload.name, payload.className]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String);

  return parts.join(" • ");
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

const isPendingApprovalResponse = (payload: unknown) =>
  isRecord(payload) &&
  (payload.pending_approval === true ||
    payload.pendingApproval === true ||
    String(payload.status ?? "").toLowerCase() === "pending_approval");

const getPendingRequestId = (payload: unknown) => {
  if (!isRecord(payload)) {
    return "";
  }

  const direct = [payload.requestId, payload.request_id]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (direct) {
    return direct;
  }

  if (isRecord(payload.data)) {
    const nested = [payload.data.requestId, payload.data.request_id]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (nested) {
      return nested;
    }
  }

  return "";
};

const toIsoDateTime = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

const getCollectionRows = (payload: unknown, key: string) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data) || !(key in data)) {
    return [] as Record<string, unknown>[];
  }

  const collection = data[key];

  if (Array.isArray(collection)) {
    return collection.filter(isRecord);
  }

  if (!isRecord(collection)) {
    return [];
  }

  if (Array.isArray(collection.data)) {
    return collection.data.filter(isRecord);
  }

  const nestedList = Object.values(collection).find(Array.isArray);
  return Array.isArray(nestedList) ? nestedList.filter(isRecord) : [];
};

const getCollectionTotal = (payload: unknown, key: string) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data) || !(key in data)) {
    return getCollectionRows(payload, key).length;
  }

  const collection = data[key];

  if (Array.isArray(collection)) {
    return collection.length;
  }

  if (!isRecord(collection)) {
    return getCollectionRows(payload, key).length;
  }

  const total = collection.total;
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

const getDefaultWalletStatementFilters = (): WalletStatementFilters => ({
  walletType: "wallet",
  fromDate: "",
  toDate: "",
  status: "",
  transactionType: "",
  category: "",
  format: "pdf",
  email: "",
});

const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

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

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastNotice[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map((toast) => {
        const toneClass =
          toast.tone === "success"
            ? "border-emerald-200 bg-white dark:border-emerald-400/30 dark:bg-slate-950"
            : toast.tone === "error"
              ? "border-red-200 bg-white dark:border-red-400/30 dark:bg-slate-950"
              : toast.tone === "warning"
                ? "border-amber-200 bg-white dark:border-amber-400/30 dark:bg-slate-950"
                : "border-[#069AFF]/30 bg-white dark:border-[#069AFF]/40 dark:bg-slate-950";

        const iconClass =
          toast.tone === "success"
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200"
            : toast.tone === "error"
              ? "bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-200"
              : toast.tone === "warning"
                ? "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200"
                : "bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15 dark:text-sky-200";

        const Icon = toast.tone === "success" ? CheckCircle2 : AlertTriangle;

        return (
          <div key={toast.id} className={`rounded-2xl border shadow-xl shadow-slate-950/10 ${toneClass}`}>
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{toast.title}</p>
                {toast.detail ? <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{toast.detail}</p> : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionDetailGrid({
  items,
  columns = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{ label: string; value: unknown }>;
  columns?: string;
}) {
  const visibleItems = items.filter(({ value }) => value !== null && value !== undefined && value !== "");

  if (!visibleItems.length) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${columns}`}>
      {visibleItems.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/50">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white">{formatFieldValue(item.label, item.value)}</p>
        </div>
      ))}
    </div>
  );
}

function JsonInspector({
  label,
  value,
  defaultOpen = false,
}: {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return null;
  }

  return (
    <details
      open={defaultOpen}
      className="rounded-lg border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-slate-950/45"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100">
        {label}
      </summary>
      <div className="border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    </details>
  );
}

function TransactionSectionShell({
  title,
  subtitle,
  rows,
  icon: Icon,
  amountKeys,
  emptyLabel,
  children,
}: {
  title: string;
  subtitle: string;
  rows: Record<string, unknown>[];
  icon: typeof Users;
  amountKeys?: string[];
  emptyLabel: string;
  children: (row: Record<string, unknown>, index: number) => ReactNode;
}) {
  const totalAmount = amountKeys?.length ? sumCurrencyRows(rows, amountKeys) : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{formatValue(rows.length)} records</p>
          {amountKeys?.length ? <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{formatCurrency(totalAmount)}</p> : null}
        </div>
      </div>
      <div className="max-h-[34rem] space-y-4 overflow-y-auto p-4">
        {rows.length ? rows.map((row, index) => children(row, index)) : <EmptyPanel label={emptyLabel} />}
      </div>
    </section>
  );
}

function TransactionTimeline({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <TransactionSectionShell
      title="Timeline"
      subtitle="Chronological events returned for this customer."
      rows={rows}
      icon={Activity}
      amountKeys={["amount", "totalAmount", "paidAmount"]}
      emptyLabel="No timeline events returned."
    >
      {(row, index) => {
        const entry = isRecord(row.data) ? row.data : row;
        const type = safeText(getRecordValue(row, ["type", "event", "title"]), `Event ${index + 1}`);
        const title = safeText(
          getRecordValue(entry, ["note", "narration", "description", "reference", "transactionType", "serviceType", "type"]),
          `${formatLabel(type)} event`,
        );
        const amount = getRecordValue(entry, ["amount", "totalAmount", "paidAmount"]);

        return (
          <div key={getId(entry) || getId(row) || `${type}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
                  <span className="rounded-md border border-[#069AFF]/20 bg-[#069AFF]/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#069AFF] dark:text-sky-200">
                    {formatLabel(type)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt", "date"]) ?? getRecordValue(entry, ["createdAt", "updatedAt"]))}</p>
              </div>
              <div className="text-right">
                {amount !== undefined ? <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(amount)}</p> : null}
                <StatusBadge status={getRecordValue(entry, ["status"]) ?? getRecordValue(row, ["status"]) ?? "success"} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <TransactionDetailGrid
                columns="sm:grid-cols-2 xl:grid-cols-3"
                items={[
                  { label: "Reference", value: getRecordValue(entry, ["reference"]) },
                  { label: "Transaction type", value: getRecordValue(entry, ["transactionType", "type"]) },
                  { label: "Category", value: getRecordValue(entry, ["category", "serviceType", "billType"]) },
                  { label: "Provider", value: getRecordValue(entry, ["provider", "providerType", "source"]) },
                  { label: "Account / Recipient", value: getRecordValue(entry, ["accountName", "recipient", "customerAccountNo"]) },
                  { label: "Wallet type", value: getRecordValue(entry, ["walletType"]) ?? getRecordValue(isRecord(entry.details) ? entry.details : {}, ["walletType"]) },
                ]}
              />
              <JsonInspector label="Timeline payload" value={row} />
            </div>
          </div>
        );
      }}
    </TransactionSectionShell>
  );
}

function WalletTransactionSection({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <TransactionSectionShell
      title="Wallet transactions"
      subtitle="Wallet credits, debits, reversals, transfers, and balance movement."
      rows={rows}
      icon={WalletCards}
      amountKeys={["amount", "totalDebitAmount", "grossAmount"]}
      emptyLabel="No wallet transactions returned."
    >
      {(row, index) => {
        const details = isRecord(row.details) ? row.details : null;
        const title = safeText(getRecordValue(row, ["note", "reference", "transactionType"]), `Wallet transaction ${index + 1}`);

        return (
          <div key={getId(row) || `${title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount"]))}</p>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <StatusBadge status={getRecordValue(row, ["status"]) ?? "success"} />
                  <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    {safeText(getRecordValue(row, ["type"]), "unknown")}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <TransactionDetailGrid
                items={[
                  { label: "Reference", value: getRecordValue(row, ["reference"]) },
                  { label: "Transaction type", value: getRecordValue(row, ["transactionType"]) },
                  { label: "Category", value: getRecordValue(row, ["category"]) },
                  { label: "Bill type", value: getRecordValue(row, ["billType"]) },
                  { label: "Provider", value: getRecordValue(row, ["provider"]) },
                  { label: "Source", value: getRecordValue(row, ["source"]) },
                  { label: "Wallet ID", value: getRecordValue(row, ["wallet_id", "walletId"]) },
                  { label: "Balance before", value: getRecordValue(row, ["bal_before"]) },
                  { label: "Balance after", value: getRecordValue(row, ["bal_after"]) },
                ]}
              />
              <TransactionDetailGrid
                columns="sm:grid-cols-2 xl:grid-cols-3"
                items={[
                  { label: "Wallet type", value: getRecordValue(details ?? {}, ["walletType"]) },
                  { label: "Account name", value: getRecordValue(details ?? {}, ["accountName"]) },
                  { label: "Bank name", value: getRecordValue(details ?? {}, ["bankName"]) },
                  { label: "Account number", value: getRecordValue(details ?? {}, ["accountNumber"]) },
                  { label: "Recipient", value: getRecordValue(details ?? {}, ["recipient", "customerAccountNo"]) },
                  { label: "Narration", value: getRecordValue(details ?? {}, ["narration"]) },
                  { label: "Fee amount", value: getRecordValue(details ?? {}, ["feeAmount"]) },
                  { label: "Total debit", value: getRecordValue(details ?? {}, ["totalDebitAmount"]) },
                  { label: "Loan type", value: getRecordValue(details ?? {}, ["loanTypeName"]) },
                ]}
              />
              <JsonInspector label="Transaction details" value={details} />
              <JsonInspector label="Full wallet transaction payload" value={row} />
            </div>
          </div>
        );
      }}
    </TransactionSectionShell>
  );
}

function DepositTransactionSection({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <TransactionSectionShell
      title="Deposits"
      subtitle="Inbound funding records and provider confirmations."
      rows={rows}
      icon={Landmark}
      amountKeys={["netAmount", "grossAmount", "amount"]}
      emptyLabel="No deposits returned."
    >
      {(row, index) => {
        const providerResponse = isRecord(row.providerResponse) ? row.providerResponse : null;
        const responseData = providerResponse && isRecord(providerResponse.data) ? providerResponse.data : null;
        const title = safeText(getRecordValue(row, ["accountName", "reference", "event"]), `Deposit ${index + 1}`);

        return (
          <div key={getId(row) || safeText(row.reference, `${title}-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["netAmount", "grossAmount", "amount"]))}</p>
                <StatusBadge status={getRecordValue(row, ["status"]) ?? "success"} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <TransactionDetailGrid
                items={[
                  { label: "Reference", value: getRecordValue(row, ["reference"]) },
                  { label: "Event", value: getRecordValue(row, ["event"]) },
                  { label: "Session ID", value: getRecordValue(row, ["sessionID"]) },
                  { label: "Channel code", value: getRecordValue(row, ["channelCode"]) },
                  { label: "Source", value: getRecordValue(row, ["source"]) },
                  { label: "Provider", value: getRecordValue(row, ["provider"]) },
                  { label: "Gross amount", value: getRecordValue(row, ["grossAmount", "amount"]) },
                  { label: "Fee amount", value: getRecordValue(row, ["feeAmount"]) },
                  { label: "Net amount", value: getRecordValue(row, ["netAmount"]) },
                  { label: "Account name", value: getRecordValue(row, ["accountName"]) },
                  { label: "Account number", value: getRecordValue(row, ["accountNumber"]) },
                  { label: "Bank verification", value: getRecordValue(row, ["bankVerificationCode"]) },
                  { label: "Wallet ID", value: getRecordValue(row, ["walletId"]) },
                  { label: "Customer ID", value: getRecordValue(row, ["customerId"]) },
                  { label: "Wallet transaction ID", value: getRecordValue(row, ["walletTransactionId"]) },
                ]}
              />
              <TransactionDetailGrid
                columns="sm:grid-cols-2 xl:grid-cols-3"
                items={[
                  { label: "Originator name", value: getRecordValue(responseData ?? {}, ["originatorAccountName"]) },
                  { label: "Originator account", value: getRecordValue(responseData ?? {}, ["originatorAccountNumber"]) },
                  { label: "Originator BVN", value: getRecordValue(responseData ?? {}, ["originatorBankVerificationNumber"]) },
                  { label: "Narration", value: getRecordValue(responseData ?? {}, ["narration"]) },
                  { label: "Paid at", value: getRecordValue(responseData ?? {}, ["paidAt"]) },
                  { label: "Destination institution", value: getRecordValue(responseData ?? {}, ["destinationInstitutionCode"]) },
                ]}
              />
              <JsonInspector label="Provider response" value={providerResponse} />
              <JsonInspector label="Full deposit payload" value={row} />
            </div>
          </div>
        );
      }}
    </TransactionSectionShell>
  );
}

function BillTransactionSection({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <TransactionSectionShell
      title="Bills"
      subtitle="Bill payment records, token delivery, and provider outcome."
      rows={rows}
      icon={CreditCard}
      amountKeys={["amount"]}
      emptyLabel="No bills returned."
    >
      {(row, index) => {
        const providerResponse = isRecord(row.providerResponse) ? row.providerResponse : null;
        const responseContent = providerResponse && isRecord(providerResponse.content) ? providerResponse.content : null;
        const title = safeText(getRecordValue(row, ["providerType", "serviceType", "billId"]), `Bill ${index + 1}`);

        return (
          <div key={getId(row) || safeText(row.reference, `${title}-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount"]))}</p>
                <StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <TransactionDetailGrid
                items={[
                  { label: "Reference", value: getRecordValue(row, ["reference"]) },
                  { label: "Bill ID", value: getRecordValue(row, ["billId"]) },
                  { label: "Provider", value: getRecordValue(row, ["providerType"]) },
                  { label: "Service type", value: getRecordValue(row, ["serviceType"]) },
                  { label: "Customer account", value: getRecordValue(row, ["customerAccountNo"]) },
                  { label: "Recipient", value: getRecordValue(row, ["recipient"]) },
                  { label: "Token", value: getRecordValue(row, ["token"]) },
                  { label: "Provider code", value: getRecordValue(providerResponse ?? {}, ["code"]) },
                  { label: "Response description", value: getRecordValue(providerResponse ?? {}, ["response_description"]) },
                  { label: "Transaction date", value: getRecordValue(providerResponse ?? {}, ["transaction_date"]) },
                  { label: "Customer name", value: getRecordValue(providerResponse ?? {}, ["customerName"]) },
                  { label: "Meter number", value: getRecordValue(providerResponse ?? {}, ["meterNumber"]) },
                  { label: "Units", value: getRecordValue(providerResponse ?? {}, ["units"]) },
                  { label: "Tariff", value: getRecordValue(providerResponse ?? {}, ["tariff"]) },
                ]}
              />
              <TransactionDetailGrid
                columns="sm:grid-cols-2 xl:grid-cols-3"
                items={[
                  { label: "Purchased code", value: getRecordValue(providerResponse ?? {}, ["purchased_code"]) },
                  { label: "Exchange reference", value: getRecordValue(providerResponse ?? {}, ["exchangeReference"]) },
                  { label: "VAT", value: getRecordValue(providerResponse ?? {}, ["vat"]) },
                  { label: "Tax amount", value: getRecordValue(providerResponse ?? {}, ["taxAmount"]) },
                  { label: "Debt amount", value: getRecordValue(providerResponse ?? {}, ["debtAmount"]) },
                  { label: "Response content fields", value: responseContent ? Object.keys(responseContent).length : null },
                ]}
              />
              <JsonInspector label="Provider response" value={providerResponse} />
              <JsonInspector label="Full bill payload" value={row} />
            </div>
          </div>
        );
      }}
    </TransactionSectionShell>
  );
}

function PayoutTransactionSection({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <TransactionSectionShell
      title="Payouts & transfers"
      subtitle="Outbound transfer instructions, fees, and provider settlement details."
      rows={rows}
      icon={Send}
      amountKeys={["totalDebitAmount", "amount"]}
      emptyLabel="No payouts returned."
    >
      {(row, index) => {
        const details = isRecord(row.details) ? row.details : null;
        const providerResponse = isRecord(row.providerResponse) ? row.providerResponse : null;
        const transfer = providerResponse && isRecord(providerResponse.transfer) ? providerResponse.transfer : null;
        const title = safeText(
          getRecordValue(row, ["accountName", "note", "narration", "reference"]) ??
            getRecordValue(details ?? {}, ["accountName", "narration"]),
          `Payout ${index + 1}`,
        );

        return (
          <div key={getId(row) || safeText(row.reference, `${title}-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["totalDebitAmount", "amount"]))}</p>
                <StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <TransactionDetailGrid
                items={[
                  { label: "Reference", value: getRecordValue(row, ["reference"]) },
                  { label: "Wallet type", value: getRecordValue(row, ["walletType"]) ?? getRecordValue(details ?? {}, ["walletType"]) },
                  { label: "Provider", value: getRecordValue(row, ["provider"]) },
                  { label: "Bank name", value: getRecordValue(row, ["bankName"]) ?? getRecordValue(details ?? {}, ["bankName"]) },
                  { label: "Sort code", value: getRecordValue(row, ["sortCode"]) ?? getRecordValue(details ?? {}, ["sortCode"]) },
                  { label: "Account number", value: getRecordValue(row, ["accountNumber"]) ?? getRecordValue(details ?? {}, ["accountNumber"]) },
                  { label: "Account name", value: getRecordValue(row, ["accountName"]) ?? getRecordValue(details ?? {}, ["accountName"]) },
                  { label: "Narration", value: getRecordValue(row, ["narration"]) ?? getRecordValue(details ?? {}, ["narration"]) },
                  { label: "Base amount", value: getRecordValue(row, ["amount"]) ?? getRecordValue(details ?? {}, ["amount"]) },
                  { label: "Fee amount", value: getRecordValue(row, ["feeAmount"]) ?? getRecordValue(details ?? {}, ["feeAmount"]) },
                  { label: "Total debit", value: getRecordValue(row, ["totalDebitAmount"]) ?? getRecordValue(details ?? {}, ["totalDebitAmount"]) },
                ]}
              />
              <TransactionDetailGrid
                columns="sm:grid-cols-2 xl:grid-cols-3"
                items={[
                  { label: "Provider session", value: getRecordValue(transfer ?? {}, ["sessionID"]) },
                  { label: "Provider reference", value: getRecordValue(transfer ?? {}, ["reference", "transactionReference"]) },
                  { label: "Provider transaction ID", value: getRecordValue(transfer ?? {}, ["transactionId"]) },
                  { label: "Paid at", value: getRecordValue(transfer ?? {}, ["paidAt"]) },
                  { label: "Destination", value: getRecordValue(transfer ?? {}, ["destination"]) },
                  { label: "Description", value: getRecordValue(transfer ?? {}, ["description"]) },
                ]}
              />
              <JsonInspector label="Transfer details" value={details} />
              <JsonInspector label="Provider response" value={providerResponse} />
              <JsonInspector label="Full payout payload" value={row} />
            </div>
          </div>
        );
      }}
    </TransactionSectionShell>
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
  showToast,
}: {
  target: UserControlsTarget;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  showToast: (payload: unknown, fallback: string, tone: ToastTone) => void;
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
  const [pendingFundingPayload, setPendingFundingPayload] = useState<Record<string, unknown> | null>(null);
  const [fundWalletChallenge, setFundWalletChallenge] = useState<OtpChallenge | null>(null);
  const [fundWalletOtpCode, setFundWalletOtpCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const runAction = async (actionKey: string, request: () => Promise<unknown>, fallbackMessage: string) => {
    setLoadingAction(actionKey);

    try {
      const response = await request();

      if (isPendingApprovalResponse(response)) {
        const requestId = getPendingRequestId(response);
        showToast(
          response,
          requestId ? `${fallbackMessage}. Request ID: ${requestId}` : fallbackMessage,
          "warning",
        );
        return;
      }

      await onRefresh();
      showToast(response, fallbackMessage, "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "User control request failed", "error");
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
      paymentDate: toIsoDateTime(walletValues.paymentDate),
    }).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
      if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});

    try {
      const response = await adminService.fundUserWallet(target.userId, basePayload);

      if (isPendingApprovalResponse(response)) {
        const requestId = getPendingRequestId(response);
        setPendingFundingPayload(null);
        setFundWalletChallenge(null);
        setFundWalletOtpCode("");
        setProofFile(null);
        setWalletValues({
          amount: "",
          walletType: "wallet",
          sourceLedger: "operations",
          narration: "",
          proofOfPayment: "",
          paymentDate: "",
        });
        showToast(
          response,
          requestId ? `Wallet funding submitted for approval. Request ID: ${requestId}` : "Wallet funding submitted for approval",
          "warning",
        );
        return;
      }

      await onRefresh();
      setPendingFundingPayload(null);
      setFundWalletChallenge(null);
      setFundWalletOtpCode("");
      setProofFile(null);
      setWalletValues({
        amount: "",
        walletType: "wallet",
        sourceLedger: "operations",
        narration: "",
        proofOfPayment: "",
        paymentDate: "",
      });
      showToast(response, `Wallet funded for ${target.userName}`, "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Wallet funding request failed", "error");
    } finally {
      setLoadingAction("");
    }
  };

  const uploadProofOfPayment = async () => {
    if (!proofFile) {
      showToast({ message: "Select a proof file before uploading" }, "Select a proof file before uploading", "warning");
      return;
    }

    setUploadingProof(true);

    try {
      const response = await adminService.uploadFile(proofFile);
      const uploadedUrl = typeof unwrapPayload(response) === "string" ? String(unwrapPayload(response)) : "";

      if (uploadedUrl) {
        setWalletValues((current) => ({ ...current, proofOfPayment: uploadedUrl }));
      }

      showToast(response, "Proof uploaded successfully", "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Proof upload failed", "error");
    } finally {
      setUploadingProof(false);
    }
  };

  const confirmFundWalletOtp = async () => {
    if (!fundWalletChallenge || !pendingFundingPayload) {
      showToast({ message: "Funding challenge is missing. Start the funding request again." }, "Funding challenge is missing", "error");
      return;
    }

    setLoadingAction("fund-wallet-otp");

    try {
      const response = await adminService.fundUserWallet(target.userId, {
        ...pendingFundingPayload,
        otpChallengeId: fundWalletChallenge.challengeId,
        otpCode: fundWalletOtpCode.trim(),
      });

      await onRefresh();
      setPendingFundingPayload(null);
      setFundWalletChallenge(null);
      setFundWalletOtpCode("");
      setProofFile(null);
      setWalletValues({
        amount: "",
        walletType: "wallet",
        sourceLedger: "operations",
        narration: "",
        proofOfPayment: "",
        paymentDate: "",
      });
      showToast(response, `Wallet funded for ${target.userName}`, "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Wallet funding confirmation failed", "error");
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
          `Password reset submitted for approval for ${target.userName}`,
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
          `${target.userName} lock request submitted for approval`,
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
          `${target.userName} unlock request submitted for approval`,
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
          `${target.userName} disable request submitted for approval`,
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
          `${target.userName} enable request submitted for approval`,
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

                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload proof manually</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Select the receipt or transfer proof, upload it, then use the returned URL for this funding request.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm font-medium text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[#069AFF] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-[#0588e0] dark:text-slate-200"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {proofFile ? `Selected: ${proofFile.name}` : "No proof file selected"}
                    </p>
                    <button
                      type="button"
                      onClick={() => void uploadProofOfPayment()}
                      disabled={uploadingProof || !proofFile}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                      Upload proof
                    </button>
                  </div>
                </div>

                <label>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Payment date</span>
                  <input
                    type="datetime-local"
                    value={walletValues.paymentDate}
                    onChange={(event) => setWalletValues((current) => ({ ...current, paymentDate: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 px-4 py-3 text-xs font-medium leading-6 text-slate-600 dark:border-[#069AFF]/25 dark:bg-[#069AFF]/10 dark:text-slate-300">
                  Submit only the fields the backend expects. `amount` is required. Funding proof and payment timestamp are sent only when provided.
                </div>

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
                    disabled={Boolean(loadingAction) || uploadingProof}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loadingAction === "fund-wallet" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WalletCards className="h-4 w-4" aria-hidden="true" />}
                    Fund wallet
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>

      {fundWalletChallenge && (
        <OtpChallengeModal
          title="Confirm wallet funding"
          description="Enter the OTP sent for this manual funding request."
          challenge={fundWalletChallenge}
          otpCode={fundWalletOtpCode}
          onChange={setFundWalletOtpCode}
          onClose={() => {
            if (loadingAction === "fund-wallet-otp") {
              return;
            }
            setFundWalletChallenge(null);
            setFundWalletOtpCode("");
            setPendingFundingPayload(null);
          }}
          onSubmit={() => void confirmFundWalletOtp()}
          submitting={loadingAction === "fund-wallet-otp"}
        />
      )}
    </div>
  );
}

function OtpChallengeModal({
  title,
  description,
  challenge,
  otpCode,
  onChange,
  onClose,
  onSubmit,
  submitting,
}: {
  title: string;
  description: string;
  challenge: OtpChallenge;
  otpCode: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">OTP confirmation</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              aria-label="Close OTP confirmation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              OTP sent via {challenge.channel ?? "email"}.
            </p>
            <div className="mt-2 space-y-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
              {challenge.email ? <p>Recipient: {challenge.email}</p> : null}
              {challenge.expiresAt ? <p>Expires: {formatDate(challenge.expiresAt)}</p> : null}
              <p>Challenge ID: {challenge.challengeId}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">OTP code</label>
            <OtpInput
              value={otpCode}
              onChange={onChange}
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || otpCode.trim().length < 6}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              Confirm funding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionModal({
  action,
  onClose,
  showToast,
}: {
  action: FormAction;
  onClose: () => void;
  showToast: (payload: unknown, fallback: string, tone: ToastTone) => void;
}) {
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
      showToast(getErrorPayload(submitError) ?? { message: getErrorMessage(submitError) }, "User action failed", "error");
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

function UserDashboardModal({
  dashboard,
  onClose,
  showToast,
}: {
  dashboard: UserDashboardState;
  onClose: () => void;
  showToast: (payload: unknown, fallback: string, tone: ToastTone) => void;
}) {
  const [activeTab, setActiveTab] = useState<UserDashboardTab>("overview");
  const [transactionFilters, setTransactionFilters] = useState<UserTransactionFilters>(() => getDefaultUserTransactionFilters());
  const [statementFilters, setStatementFilters] = useState<WalletStatementFilters>(() => getDefaultWalletStatementFilters());
  const [kycAction, setKycAction] = useState("");
  const [kyc, setKyc] = useState<UserKycState>({
    title: "User KYC",
    loading: true,
    data: null,
    error: "",
    loaded: false,
  });
  const [transactions, setTransactions] = useState<UserTransactionsState>({
    title: "User transactions",
    loading: false,
    data: null,
    error: "",
    loaded: false,
  });
  const [statementAction, setStatementAction] = useState<"" | "download" | "email">("");

  const virtualAccounts = getDashboardCollection(dashboard.data, "virtualAccounts");
  const wallets = getDashboardCollection(dashboard.data, "wallets");
  const loans = getDashboardCollection(dashboard.data, "loans");
  const walletBalance = sumCurrencyRows(wallets, ["balance", "availableBalance", "amount"]);
  const kycRows = useMemo(() => extractRowsOrRecord(kyc.data), [kyc.data]);
  const kycPayload = useMemo(() => unwrapPayload(kyc.data), [kyc.data]);
  const kycSummaryItems = useMemo(() => {
    if (!isRecord(kycPayload)) {
      return [];
    }

    return [
      { label: "Total", value: getRecordValue(kycPayload, ["total"]) },
      { label: "Returned", value: kycRows.length },
      { label: "Limit", value: getRecordValue(kycPayload, ["limit"]) },
      { label: "Skip", value: getRecordValue(kycPayload, ["skip"]) },
    ];
  }, [kycPayload, kycRows.length]);

  const summary = [
    { label: "Virtual accounts", value: formatValue(getDashboardTotal(dashboard.data, "virtualAccounts")), icon: Landmark },
    { label: "Wallet balance", value: formatCurrency(walletBalance), icon: WalletCards },
    { label: "Loan records", value: formatValue(getDashboardTotal(dashboard.data, "loans")), icon: CreditCard },
  ];

  const loadUserKyc = async () => {
    setKyc((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const data = await adminService.getUserKyc(dashboard.userId);
      setKyc({
        title: "User KYC",
        loading: false,
        data,
        error: "",
        loaded: true,
      });
    } catch (error) {
      setKyc({
        title: "User KYC",
        loading: false,
        data: null,
        error: getErrorMessage(error),
        loaded: true,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    setKyc({
      title: "User KYC",
      loading: true,
      data: null,
      error: "",
      loaded: false,
    });

    void adminService
      .getUserKyc(dashboard.userId)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setKyc({
          title: "User KYC",
          loading: false,
          data,
          error: "",
          loaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setKyc({
          title: "User KYC",
          loading: false,
          data: null,
          error: getErrorMessage(error),
          loaded: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [dashboard.userId]);

  const handleReviewKyc = async (kycId: string, action: "approve" | "reject") => {
    const actionKey = `${kycId}-${action}`;
    setKycAction(actionKey);

    try {
      const response = await adminService.approveKyc(kycId, {
        action,
        reason: action === "approve" ? "Approved from customer dashboard" : "Rejected from customer dashboard",
      });
      showToast(
        response,
        action === "approve" ? "KYC approved successfully" : "KYC rejected successfully",
        "success",
      );
      await loadUserKyc();
    } catch (error) {
      showToast(
        getErrorPayload(error) ?? { message: getErrorMessage(error) },
        action === "approve" ? "KYC approval failed" : "KYC rejection failed",
        "error",
      );
    } finally {
      setKycAction("");
    }
  };

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

  const buildStatementParams = () =>
    Object.entries({
      walletType: statementFilters.walletType.trim(),
      fromDate: statementFilters.fromDate,
      toDate: statementFilters.toDate,
      status: statementFilters.status.trim(),
      transactionType: statementFilters.transactionType.trim(),
      category: statementFilters.category.trim(),
      format: statementFilters.format,
    }).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (!value) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});

  const handleStatementDownload = async () => {
    setStatementAction("download");

    try {
      const result = await adminService.downloadUserWalletStatement(dashboard.userId, buildStatementParams());
      downloadBlob(result.blob, result.filename);
      showToast({ message: `Statement download started for ${dashboard.userName}` }, "Statement download started", "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Wallet statement download failed", "error");
    } finally {
      setStatementAction("");
    }
  };

  const handleStatementEmail = async () => {
    setStatementAction("email");

    try {
      const payload = Object.entries({
        ...buildStatementParams(),
        email: statementFilters.email.trim(),
      }).reduce<Record<string, string>>((accumulator, [key, value]) => {
        if (!value) {
          return accumulator;
        }

        accumulator[key] = value;
        return accumulator;
      }, {});

      const response = await adminService.emailUserWalletStatement(dashboard.userId, payload);
      showToast(response, `Wallet statement email queued for ${dashboard.userName}`, "success");
    } catch (error) {
      showToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Wallet statement email failed", "error");
    } finally {
      setStatementAction("");
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
      ? [{ label: "User ID", value: safeText(record?.userId) }, ...Object.entries(summaryRecord)
          .filter(([, value]) => !Array.isArray(value) && !isRecord(value))
          .slice(0, 8)
          .map(([key, value]) => ({
            label: formatLabel(key),
            value: formatFieldValue(key, value),
          }))]
      : [];

    const cards = [
      { label: "Total records", value: formatValue(summaryRecord?.total ?? timeline.length), icon: BarChart3 },
      { label: "Wallet transactions", value: formatValue(summaryRecord?.walletTransactions ?? getCollectionTotal(record, "walletTransactions")), icon: WalletCards },
      { label: "Deposits", value: formatValue(summaryRecord?.deposits ?? getCollectionTotal(record, "deposits")), icon: Landmark },
      { label: "Bills", value: formatValue(summaryRecord?.bills ?? getCollectionTotal(record, "bills")), icon: CreditCard },
      {
        label: "Payouts & transfers",
        value: formatValue(summaryRecord?.payouts ?? payouts.length),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="h-[92vh] w-full max-w-[92rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
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
              {
                key: "kyc" as const,
                label: "KYC",
                description: "Verification records and identity data",
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

        <div className="h-[calc(92vh-10.5rem)] overflow-y-auto p-5">
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
          ) : activeTab === "transactions" ? (
            <div className="grid gap-5">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Wallet statements</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Download or email statement</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Generate statement files for the customer&apos;s main wallet or loan wallet. Leave the email blank to send to the customer&apos;s default address.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-[#069AFF]/25 dark:bg-[#069AFF]/10 dark:text-slate-300">
                    <p>Customer: {dashboard.userName}</p>
                    <p className="mt-1">Default email: {dashboard.userEmail || "Uses backend default"}</p>
                  </div>
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Wallet type</span>
                    <select
                      value={statementFilters.walletType}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, walletType: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    >
                      <option value="wallet">Wallet</option>
                      <option value="loan">Loan</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">From date</span>
                    <input
                      type="date"
                      value={statementFilters.fromDate}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, fromDate: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">To date</span>
                    <input
                      type="date"
                      value={statementFilters.toDate}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, toDate: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Format</span>
                    <select
                      value={statementFilters.format}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, format: event.target.value as "csv" | "pdf" }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    >
                      <option value="pdf">PDF</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Status</span>
                    <select
                      value={statementFilters.status}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, status: event.target.value }))}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    >
                      <option value="">All statuses</option>
                      <option value="success">Success</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Transaction type</span>
                    <input
                      type="text"
                      value={statementFilters.transactionType}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, transactionType: event.target.value }))}
                      placeholder="loan_repayment"
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Category</span>
                    <input
                      type="text"
                      value={statementFilters.category}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, category: event.target.value }))}
                      placeholder="loan"
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2 xl:col-span-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Override email</span>
                    <input
                      type="email"
                      value={statementFilters.email}
                      onChange={(event) => setStatementFilters((current) => ({ ...current, email: event.target.value }))}
                      placeholder={dashboard.userEmail || "ops@example.com"}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Download sends the file to the admin browser. Email uses the customer&apos;s email unless you set an override address.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStatementFilters(getDefaultWalletStatementFilters())}
                      disabled={Boolean(statementAction)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                    >
                      Reset statement filters
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatementDownload()}
                      disabled={Boolean(statementAction)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                    >
                      {statementAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                      Download statement
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatementEmail()}
                      disabled={Boolean(statementAction)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/20 transition hover:bg-[#0588e0] disabled:opacity-60"
                    >
                      {statementAction === "email" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                      Email statement
                    </button>
                  </div>
                </div>
              </section>

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
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {transactionSnapshot.cards.map((item) => (
                      <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
                    ))}
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <TransactionTimeline rows={transactionSnapshot.timeline} />
                    <DetailGrid title="Summary snapshot" items={transactionSnapshot.summaryItems} />
                  </section>

                  <WalletTransactionSection rows={transactionSnapshot.walletTransactions} />
                  <DepositTransactionSection rows={transactionSnapshot.deposits} />
                  <BillTransactionSection rows={transactionSnapshot.bills} />
                  <PayoutTransactionSection rows={transactionSnapshot.payouts} />
                </>
              )}
            </div>
          ) : (
            <section className="grid gap-5">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">KYC records</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Customer KYC</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Verification records returned from the KYC service for this customer.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-lg border border-[#069AFF]/20 bg-[#069AFF]/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#069AFF] dark:border-[#069AFF]/30 dark:bg-[#069AFF]/10 dark:text-sky-200">
                      {kyc.loading ? "Loading" : `${kycRows.length} record${kycRows.length === 1 ? "" : "s"}`}
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadUserKyc()}
                      disabled={kyc.loading || Boolean(kycAction)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                    >
                      <RefreshCw className={`h-4 w-4 ${kyc.loading ? "animate-spin" : ""}`} aria-hidden="true" />
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 p-4">
                  {kyc.loading && (
                    <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading customer KYC
                    </div>
                  )}

                  {!kyc.loading && kyc.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                      {kyc.error}
                    </div>
                  )}

                  {!kyc.loading && !kyc.error && !kycRows.length && (
                    <EmptyPanel label="No KYC records returned for this customer." />
                  )}

                  {!kyc.loading && !kyc.error && Boolean(kycSummaryItems.length) && (
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {kycSummaryItems.map((item) => (
                        <SummaryCard
                          key={item.label}
                          label={item.label}
                          value={formatFieldValue(item.label, item.value)}
                          icon={ShieldCheck}
                        />
                      ))}
                    </section>
                  )}

                  {!kyc.loading && !kyc.error && kycRows.map((record, index) => {
                    const recordId = getId(record) || `kyc-${index + 1}`;
                    const statusValue =
                      getRecordValue(record, ["status", "verificationStatus", "approvalStatus"]) ??
                      getRecordValue(record, ["state"]);
                    const normalizedStatus = String(statusValue ?? "pending").toLowerCase();
                    const pending = normalizedStatus === "pending";
                    const title =
                      String(getRecordValue(record, ["documentType", "idType", "type", "tier", "level"]) ?? "").trim() ||
                      `KYC record ${index + 1}`;
                    const imageEntries = getImageFieldEntries(record);
                    const primitiveItems = getPrimitiveRecordItems(record);

                    return (
                      <div key={recordId} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-slate-950 dark:text-white">{formatLabel(title)}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{recordId}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={statusValue ?? "unknown"} />
                            <button
                              type="button"
                              disabled={!pending || kycAction === `${recordId}-approve`}
                              onClick={() => void handleReviewKyc(recordId, "approve")}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                            >
                              {kycAction === `${recordId}-approve` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!pending || kycAction === `${recordId}-reject`}
                              onClick={() => void handleReviewKyc(recordId, "reject")}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              {kycAction === `${recordId}-reject` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                              Reject
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <TransactionDetailGrid items={primitiveItems} columns="sm:grid-cols-2 xl:grid-cols-4" />

                          {Boolean(imageEntries.length) && (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {imageEntries.map(([key, value]) => (
                                <div key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/50">
                                  <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                      {formatLabel(key)}
                                    </p>
                                  </div>
                                  <div className="p-4">
                                    <a
                                      href={String(value)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-900"
                                    >
                                      <img
                                        src={String(value)}
                                        alt={formatLabel(key)}
                                        className="h-48 w-full object-cover"
                                      />
                                    </a>
                                    <a
                                      href={String(value)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-3 block break-all text-xs font-semibold text-[#069AFF] hover:underline dark:text-sky-200"
                                    >
                                      {String(value)}
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <JsonInspector label="Raw KYC record" value={record} />
                        </div>
                      </div>
                    );
                  })}

                  {!kyc.loading && !kyc.error && (
                    <JsonInspector label="Full KYC response payload" value={kycPayload} />
                  )}
                </div>
              </div>
            </section>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const paginatedRows = useMemo(() => paginateItems(rows, currentPage, pageSize), [rows, currentPage, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, pageSize, rows.length]);

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
            {paginatedRows.map((row, index) => children(row, index))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={rows.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setCurrentPage(1);
        }}
      />
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
  const toastIdRef = useRef(0);
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
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
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

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showServerToast = (payload: unknown, fallback: string, tone: ToastTone) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;

    setToasts((current) => [
      {
        id,
        tone,
        title: getResponseMessage(payload, fallback),
        detail: getResponseDetail(payload) || undefined,
      },
      ...current,
    ].slice(0, 4));

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  };

  const submitAndRefresh = async (request: () => Promise<unknown>, fallbackMessage: string) => {
    try {
      const response = await request();
      await refreshUsers();
      setFormAction(null);
      showServerToast(response, fallbackMessage, "success");
    } catch (error) {
      showServerToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "User action failed", "error");
      throw error;
    }
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
      title: `Notify ${userName}`,
      description: "Send a direct push notification to this customer.",
      submitLabel: "Send notification",
      initialValues: {
        type: "general",
        channel: "general",
        data: "{}",
      },
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "Account update" },
        { name: "body", label: "Message", type: "textarea", required: true, placeholder: "Your account has been updated successfully." },
        { name: "type", label: "Type", required: true, placeholder: "loan_update", helper: "Examples: loan_update, account_update, reminder, general." },
        { name: "channel", label: "Channel", required: true, placeholder: "general", helper: "Use the app delivery channel expected by the mobile client." },
        { name: "data", label: "Data JSON", type: "textarea", placeholder: "{\"loanId\":\"6a27ff932a6deb87e2dc2426\"}", helper: "Provide a JSON object. Use {} when no extra metadata is needed." },
      ],
      onSubmit: (values) =>
        submitAndRefresh(
          () =>
            adminService.sendUserNotification(userId, {
              title: values.title.trim(),
              body: values.body.trim(),
              type: values.type.trim(),
              channel: values.channel.trim(),
              data: parseJsonObjectInput(values.data, {}),
            }),
          `Notification sent to ${userName}`,
        ),
    });
  };

  const openBroadcastAllActive = () => {
    setFormAction({
      eyebrow: "Customer communication",
      title: "Broadcast to all active users",
      description: "Send a push notification to every active user through the admin broadcast endpoint.",
      submitLabel: "Broadcast notification",
      initialValues: {
        type: "broadcast",
        channel: "general",
        data: "{\"scope\":\"all_users\"}",
      },
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "System Notice" },
        { name: "body", label: "Message", type: "textarea", required: true, placeholder: "Scheduled maintenance starts at 11PM." },
        { name: "type", label: "Type", required: true, placeholder: "broadcast" },
        { name: "channel", label: "Channel", required: true, placeholder: "general" },
        { name: "data", label: "Data JSON", type: "textarea", placeholder: "{\"scope\":\"all_users\"}", helper: "Provide a JSON object. Default scope is all active users." },
      ],
      onSubmit: (values) =>
        submitAndRefresh(
          () =>
            adminService.broadcastNotification({
              title: values.title.trim(),
              body: values.body.trim(),
              type: values.type.trim(),
              channel: values.channel.trim(),
              data: parseJsonObjectInput(values.data, { scope: "all_users" }),
            }),
          "Broadcast sent to active users",
        ),
    });
  };

  const openRevokeUserSessions = (userId: string, userName: string) => {
    setFormAction({
      eyebrow: "Security response",
      title: `Revoke sessions for ${userName}`,
      description: "Terminate all active sessions for this customer. Use this when suspicious activity or token compromise is detected.",
      submitLabel: "Revoke sessions",
      initialValues: {
        reason: "Suspicious activity detected",
      },
      fields: [
        {
          name: "reason",
          label: "Reason",
          type: "textarea",
          required: true,
          placeholder: "Suspicious activity detected",
          helper: "This reason is submitted with the session revocation request.",
        },
      ],
      onSubmit: (values) =>
        submitAndRefresh(
          () =>
            adminService.revokeUserSessions(userId, {
              reason: values.reason.trim(),
            }),
          `Sessions revoked for ${userName}`,
        ),
    });
  };

  const openUserDashboard = (userId: string, userName: string, userEmail: string) => {
    setUserDashboard({
      title: "Customer dashboard",
      loading: true,
      data: null,
      error: "",
      userId,
      userName,
      userEmail,
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
          userEmail,
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
          userEmail,
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
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
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
              onClick={openBroadcastAllActive}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Broadcast active users
            </button>
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
                          onClick={() => openUserDashboard(id, name, email === "Not available" ? "" : email)}
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
                              Notify
                            </button>
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openRevokeUserSessions(id, name)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                              Revoke Sessions
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
      {userDashboard && (
        <UserDashboardModal
          key={userDashboard.userId}
          dashboard={userDashboard}
          onClose={() => setUserDashboard(null)}
          showToast={showServerToast}
        />
      )}
      {userControls && <UserControlsModal target={userControls} onClose={() => setUserControls(null)} onRefresh={refreshUsers} showToast={showServerToast} />}
      {formAction && <ActionModal action={formAction} onClose={() => setFormAction(null)} showToast={showServerToast} />}
    </main>
  );
}
