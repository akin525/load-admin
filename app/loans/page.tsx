"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";

type DataKey = "loans" | "loanPackages" | "loanTypes" | "appLoans";

type LoansWorkspaceData = Record<DataKey, unknown> & {
  errors: Partial<Record<DataKey, string>>;
};

type DetailState = {
  title: string;
  loading: boolean;
  data: unknown;
  error: string;
};

type AppLoanDetailState = DetailState;
type CoreLoanDetailState = DetailState;
type BankoneSyncResultState = DetailState;
type CreditScoreResultState = DetailState;
type ToastTone = "success" | "error" | "warning" | "info";

type ToastNotice = {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
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

const endpoints: Array<[DataKey, () => Promise<unknown>]> = [
  ["loans", () => adminService.getLoansList()],
  ["loanPackages", adminService.getLoanPackages],
  ["loanTypes", adminService.getLoanTypes],
  ["appLoans", () => adminService.getAppLoans()],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const getId = (record: Record<string, unknown>) => String(getRecordValue(record, ["_id", "id", "loanId"]) ?? "");

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

const getInitials = (value: unknown) => {
  const text = String(value ?? "").trim();

  if (!text) {
    return "NA";
  }

  const parts = text.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || text.slice(0, 2).toUpperCase();
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

const fetchLoansWorkspace = async (): Promise<LoansWorkspaceData> => {
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
    loans: data.loans,
    loanPackages: data.loanPackages,
    loanTypes: data.loanTypes,
    appLoans: data.appLoans,
    errors,
  };
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

function LoanMetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function LoanActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone = "neutral",
  busy = false,
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "success" | "danger";
  busy?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "border-[#069AFF]/30 bg-[#069AFF]/10 text-[#069AFF] hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      <span>{label}</span>
    </button>
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

        const Icon = toast.tone === "success" ? CheckCircle2 : AlertCircle;

        return (
          <div key={toast.id} className={`rounded-2xl border shadow-xl shadow-slate-950/10 ${toneClass}`}>
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{toast.title}</p>
                {toast.detail ? (
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{toast.detail}</p>
                ) : null}
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
            <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
          </div>
        ))}
        {!items.length && <EmptyPanel label="No snapshot data returned." />}
      </div>
    </section>
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

  const overview = [
    { label: "Loan type", value: String(record.loanTypeName ?? "Not available") },
    { label: "Purpose", value: String(record.purposeText ?? "Not available") },
    { label: "Duration", value: String(record.durationLabel ?? "Not available") },
    { label: "Installments", value: formatValue(record.installmentCount) },
    { label: "Interest rate", value: `${formatValue(record.interestRate)}%` },
    { label: "Interest amount", value: formatCurrency(record.interestAmount) },
    { label: "Received amount", value: formatCurrency(record.receivedAmount) },
    { label: "Paid amount", value: formatCurrency(record.paidAmount) },
    { label: "App loan ID", value: String(record._id ?? "Not available") },
    { label: "Core loan ID", value: String(record.coreLoanId ?? "Not available") },
    { label: "Source provider", value: String(record.sourceProvider ?? "Not available") },
    { label: "Status", value: String(record.status ?? "Not available") },
    { label: "Reviewed by", value: describeActor(record.reviewedByUser) },
    { label: "Approved by", value: describeActor(record.approvedByUser) },
    { label: "Rejected by", value: describeActor(record.rejectedByUser) },
    { label: "Closed by", value: describeActor(record.closedByUser) },
    { label: "Reviewed at", value: formatDate(record.reviewedAt) },
    { label: "Approved at", value: formatDate(record.approvedAt) },
    { label: "Rejected at", value: formatDate(record.rejectedAt) },
    { label: "Closed at", value: formatDate(record.closedAt) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Loan application details</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(record.loanTypeName ?? "Application loan")} / {String(record.purposeText ?? "No purpose")}
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
            aria-label="Close application loan details"
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
                {summary.map((item) => (
                  <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
                ))}
              </section>

              <DetailGrid title="Application overview" items={overview} />

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Repayment schedule</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Installment</th>
                          <th className="px-5 py-3">Due date</th>
                          <th className="px-5 py-3">Principal</th>
                          <th className="px-5 py-3">Interest</th>
                          <th className="px-5 py-3">Total</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {repaymentSchedule.map((item, index) => (
                          <tr key={`${String(item.installmentNumber ?? index)}-${index}`} className="text-slate-700 dark:text-slate-300">
                            <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{String(item.installmentNumber ?? index + 1)}</td>
                            <td className="px-5 py-4">{formatDate(item.dueDate)}</td>
                            <td className="px-5 py-4">{formatCurrency(item.principalAmount)}</td>
                            <td className="px-5 py-4">{formatCurrency(item.interestAmount)}</td>
                            <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(item.totalAmount)}</td>
                            <td className="px-5 py-4"><StatusBadge status={item.status ?? "pending"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!repaymentSchedule.length && <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">No repayment schedule returned.</div>}
                </section>

                <section className="grid gap-5">
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">Lifecycle activity</h3>
                    </div>
                    <div className="grid gap-3 p-4">
                      {activityLog.map((item, index) => (
                        <div key={`${String(item.type ?? index)}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-950 dark:text-white">{String(item.title ?? item.type ?? `Event ${index + 1}`)}</p>
                              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</p>
                            </div>
                            {item.amount !== undefined && <p className="font-bold text-slate-950 dark:text-white">{formatCurrency(item.amount)}</p>}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{String(item.note ?? "No note recorded")}</p>
                        </div>
                      ))}
                      {!activityLog.length && <EmptyPanel label="No activity log returned." />}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">Top-up history</h3>
                    </div>
                    <div className="grid gap-3 p-4">
                      {topUpHistory.map((item, index) => (
                        <div key={`${String(item.requestId ?? index)}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
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
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoreLoanDetailsModal({ loan, onClose }: { loan: CoreLoanDetailState; onClose: () => void }) {
  const data = unwrapPayload(loan.data);
  const record = isRecord(data) ? data : {};
  const user = isRecord(record.user) ? record.user : {};
  const bankoneResponse = isRecord(record.bankoneResponse) ? record.bankoneResponse : {};
  const bankoneMessage = isRecord(bankoneResponse.Message) ? bankoneResponse.Message : {};
  const bankoneStatusResponse = isRecord(record.bankoneStatusResponse) ? record.bankoneStatusResponse : {};
  const repaymentSchedule = Array.isArray(record.repaymentSchedule) ? record.repaymentSchedule.filter(isRecord) : [];

  const summary = [
    { label: "Loan amount", value: formatCurrency(record.amount), icon: CreditCard },
    { label: "Outstanding", value: formatCurrency(record.outstandingAmount), icon: WalletCards },
    { label: "BankOne status", value: String(record.bankoneStatus ?? "Not available"), icon: Landmark },
    { label: "Last synced", value: formatDate(record.bankoneLastSyncedAt), icon: CheckCircle2 },
  ];

  const borrowerDetails = [
    { label: "Customer name", value: String(getRecordValue(user, ["name"]) ?? record.userName ?? "Not available") },
    { label: "Email", value: String(getRecordValue(user, ["email"]) ?? record.userEmail ?? "Not available") },
    { label: "Phone", value: String(getRecordValue(user, ["phone"]) ?? record.userPhone ?? "Not available") },
    { label: "User ID", value: String(record.userId ?? "Not available") },
    { label: "BankOne customer ID", value: String(record.bankoneCustomerId ?? "Not available") },
    { label: "Linked account", value: String(record.bankoneLinkedAccountNumber ?? "Not available") },
  ];

  const facilityDetails = [
    { label: "Status", value: String(record.status ?? "Not available") },
    { label: "Purpose", value: String(record.purpose ?? "Not available") },
    { label: "Term", value: `${formatValue(record.term)} month(s)` },
    { label: "Interest rate", value: `${formatValue(record.interestRate)}%` },
    { label: "Paid amount", value: formatCurrency(record.paidAmount) },
    { label: "App loan ID", value: String(record.appLoanId ?? "Not available") },
    { label: "Tracking ref", value: String(record.bankoneLoanTrackingRef ?? "Not available") },
    { label: "Loan account number", value: String(record.bankoneLoanAccountNumber ?? "Not available") },
    { label: "Application date", value: formatDate(record.applicationDate) },
  ];

  const bankoneCreationDetails = [
    { label: "Gateway success", value: String(bankoneResponse.IsSuccessful ?? "Not available") },
    { label: "Tracking ref", value: String(bankoneResponse.TransactionTrackingRef ?? "Not available") },
    { label: "Customer ID", value: String(bankoneMessage.CustomerID ?? "Not available") },
    { label: "BankOne account", value: String(bankoneMessage.BankoneAccountNumber ?? "Not available") },
    { label: "Full name", value: String(bankoneMessage.FullName ?? "Not available") },
    { label: "Creation message", value: String(bankoneMessage.CreationMessage ?? "Not available") },
  ];

  const bankoneStatusHighlights = [
    { label: "Real loan status", value: String(bankoneStatusResponse.RealLoanStatus ?? "Not available") },
    { label: "Account number", value: String(bankoneStatusResponse.Number ?? "Not available") },
    { label: "Account officer", value: String(bankoneStatusResponse.AccountOfficer ?? "Not available") },
    { label: "Customer name", value: String(bankoneStatusResponse.Name ?? "Not available") },
    { label: "Balance", value: String(bankoneStatusResponse.BalanceInNaira ?? "Not available") },
    { label: "Ledger balance", value: String(bankoneStatusResponse.LedgerBalanceWithAccessLevelInNaira ?? "Not available") },
    { label: "Available balance", value: String(bankoneStatusResponse.AvailableBalanceInNaira ?? "Not available") },
    { label: "Loan cycle", value: formatValue(bankoneStatusResponse.LoanCycle) },
    { label: "Status sync ref", value: String(bankoneStatusResponse.AccountOpenningTrackingRef ?? "Not available") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Core loan details</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {formatCurrency(record.amount)} / {String(record.purpose ?? "No purpose")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Dedicated operational view for the legacy loan record, BankOne identifiers, borrower profile, repayment schedule, and live status payload.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={record.status ?? "pending"} />
              <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                BankOne {String(record.bankoneStatus ?? "pending")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close core loan details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {loan.loading && (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading core loan details
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
                {summary.map((item) => (
                  <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
                ))}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <DetailGrid title="Borrower and account identity" items={borrowerDetails} />
                <DetailGrid title="Facility and control markers" items={facilityDetails} />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Repayment schedule</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Due date</th>
                          <th className="px-5 py-3">Amount due</th>
                          <th className="px-5 py-3">Amount paid</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {repaymentSchedule.map((item, index) => (
                          <tr key={`${String(item.dueDate ?? index)}-${index}`} className="text-slate-700 dark:text-slate-300">
                            <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{formatDate(item.dueDate)}</td>
                            <td className="px-5 py-4">{formatCurrency(item.amountDue)}</td>
                            <td className="px-5 py-4">{formatCurrency(item.amountPaid)}</td>
                            <td className="px-5 py-4"><StatusBadge status={item.status ?? "pending"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!repaymentSchedule.length && <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">No repayment schedule returned.</div>}
                </section>

                <section className="grid gap-5">
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">BankOne creation record</h3>
                    </div>
                    <div className="grid gap-3 p-4">
                      {bankoneCreationDetails.map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                          <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                      <h3 className="font-bold text-slate-950 dark:text-white">Live BankOne status</h3>
                    </div>
                    <div className="grid gap-3 p-4">
                      {bankoneStatusHighlights.map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                          <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </section>

              <details className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-950 dark:text-white">
                  Raw BankOne status payload
                </summary>
                <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
                    {JSON.stringify(bankoneStatusResponse, null, 2)}
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

const safeText = (value: unknown, fallback = "Not available") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const describeActor = (value: unknown) => {
  if (!isRecord(value)) {
    return safeText(value);
  }

  return safeText(getRecordValue(value, ["name", "fullName", "email", "phone", "userId", "_id"]));
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
};

const formatBankoneMoney = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    const numeric = Number(cleaned);

    if (!Number.isNaN(numeric)) {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      }).format(numeric);
    }

    return value;
  }

  if (typeof value === "number") {
    /**
     * BankOne numeric values like 1000000 represent ₦10,000.00.
     */
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2,
    }).format(value / 100);
  }

  return String(value);
};

const isSuccessfulValue = (value: unknown) =>
    value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "success";

function MiniInfoCard({
                        label,
                        value,
                        tone = "default",
                      }: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
      tone === "success"
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10"
          : tone === "danger"
              ? "border-red-200 bg-red-50 dark:border-red-400/20 dark:bg-red-400/10"
              : tone === "warning"
                  ? "border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10"
                  : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40";

  return (
      <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">
          {value}
        </div>
      </div>
  );
}

function SectionCard({
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
          <h3 className="text-base font-bold text-slate-950 dark:text-white">{title}</h3>
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

function CreditScoreResultModal({
  result,
  onClose,
}: {
  result: CreditScoreResultState;
  onClose: () => void;
}) {
  const payload = unwrapPayload(result.data);
  const record = isRecord(payload) ? payload : {};
  const scoreRecord = isRecord(record.record) ? record.record : {};
  const loanRecord = isRecord(record.loan) ? record.loan : {};
  const providerResponse = isRecord(scoreRecord.providerResponse) ? scoreRecord.providerResponse : {};
  const providerData = isRecord(providerResponse.data) ? providerResponse.data : {};
  const bureauProfile = isRecord(providerData.score) ? providerData.score : {};
  const billingInfo = isRecord(providerResponse.billing_info) ? providerResponse.billing_info : {};
  const verification = isRecord(providerResponse.verification) ? providerResponse.verification : {};
  const linkedUser = isRecord(loanRecord.user) ? loanRecord.user : {};

  const resolvedScore =
    record.score ??
    scoreRecord.score ??
    loanRecord.premblyScore ??
    getRecordValue(bureauProfile, ["creditScore", "score", "totalScore"]);

  const summaryCards: Array<{
    label: string;
    value: string;
    tone?: "default" | "success" | "warning" | "danger";
  }> = [
    { label: "Credit score", value: safeText(resolvedScore, "Not returned"), tone: resolvedScore ? "success" : "warning" as const },
    { label: "CRB provider", value: safeText(scoreRecord.crbProvider), tone: "default" as const },
    { label: "Verification", value: safeText(providerResponse.verification_status ?? verification.status), tone: String(providerResponse.verification_status ?? verification.status).toLowerCase() === "verified" ? "success" as const : "warning" as const },
    { label: "Charge", value: safeText(billingInfo.amount ? `${billingInfo.amount} ${safeText(billingInfo.currency, "")}`.trim() : null, "Not billed"), tone: "default" as const },
  ];

  const bureauDetails = [
    { label: "Customer name", value: safeText(scoreRecord.customerName ?? providerData.name) },
    { label: "BVN", value: safeText(scoreRecord.bvn ?? providerData.bvn) },
    { label: "Date of birth", value: safeText(scoreRecord.dob ?? providerData.dateOfBirth) },
    { label: "Mode", value: safeText(scoreRecord.mode) },
    { label: "Provider", value: safeText(scoreRecord.provider) },
    { label: "Record status", value: safeText(scoreRecord.status) },
    { label: "Message", value: safeText(providerResponse.message ?? providerResponse.detail) },
    { label: "Reference ID", value: safeText(providerResponse.reference_id) },
  ];

  const scoreMetrics = [
    { label: "Delinquent facilities", value: safeText(bureauProfile.totalNoOfDelinquentFacilities, "0") },
    { label: "Total loans", value: safeText(bureauProfile.totalNoOfLoans, "0") },
    { label: "Active loans", value: safeText(bureauProfile.totalNoOfActiveLoans, "0") },
    { label: "Closed loans", value: safeText(bureauProfile.totalNoOfClosedLoans, "0") },
    { label: "Total borrowed", value: safeText(bureauProfile.totalBorrowed) },
    { label: "Outstanding", value: safeText(bureauProfile.totalOutstanding) },
    { label: "Overdue", value: safeText(bureauProfile.totalOverdue) },
    { label: "Last reported", value: safeText(bureauProfile.lastReportedDate) },
  ];

  const verificationDetails = [
    { label: "Verification status", value: safeText(verification.status) },
    { label: "Verification reference", value: safeText(verification.reference) },
    { label: "Verification ID", value: safeText(verification.verification_id) },
    { label: "Response code", value: safeText(providerResponse.response_code) },
    { label: "Transaction ID", value: safeText(providerResponse.transaction_id) },
    { label: "Searched date", value: safeText(providerData.searchedDate ? formatDate(providerData.searchedDate) : null) },
  ];

  const loanDetails = [
    { label: "App loan ID", value: safeText(loanRecord._id ?? scoreRecord.appLoanId) },
    { label: "Loan type", value: safeText(loanRecord.loanTypeName) },
    { label: "Purpose", value: safeText(loanRecord.purposeText) },
    { label: "Requested amount", value: formatCurrency(loanRecord.amount) },
    { label: "Total payable", value: formatCurrency(loanRecord.totalPayable) },
    { label: "Outstanding", value: formatCurrency(loanRecord.outstandingAmount) },
    { label: "Loan status", value: safeText(loanRecord.status) },
    { label: "Due date", value: formatDate(loanRecord.dueDate) },
    { label: "Customer email", value: safeText(loanRecord.userEmail ?? linkedUser.email) },
    { label: "Customer phone", value: safeText(loanRecord.userPhone ?? linkedUser.phone) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="relative overflow-hidden border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] px-6 py-6 text-white">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/2 h-56 w-56 rounded-full bg-[#069AFF]/30 blur-3xl" />

          <div className="relative flex items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-100">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                Credit score result
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight md:text-3xl">
                {safeText(scoreRecord.customerName ?? providerData.name, "Credit bureau assessment")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                {safeText(record.message ?? providerResponse.message, "Credit score response returned from the bureau provider.")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  App Loan: {safeText(loanRecord._id ?? scoreRecord.appLoanId)}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  Bureau: {safeText(scoreRecord.crbProvider)}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  Provider: {safeText(scoreRecord.provider)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close credit score result"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="max-h-[78vh] overflow-y-auto bg-slate-50 p-5 dark:bg-[#07111f]">
          {result.loading && (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading credit score
            </div>
          )}

          {result.error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {result.error}
            </div>
          )}

          {!result.loading && !result.error && (
            <div className="grid gap-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((item) => (
                  <MiniInfoCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
                ))}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <SectionCard
                  title="Bureau profile"
                  description="Primary customer identity and provider response context returned for this credit lookup."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {bureauDetails.map((item) => (
                      <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Verification and billing"
                  description="Verification reference, provider transaction identifiers, and bureau billing information."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {verificationDetails.map((item) => (
                      <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                    ))}
                    <MiniInfoCard label="Billing note" value={safeText(billingInfo.note)} />
                    <MiniInfoCard label="Was charged" value={safeText(billingInfo.was_charged)} tone={billingInfo.was_charged ? "success" : "warning"} />
                  </div>
                </SectionCard>
              </section>

              <SectionCard
                title="Credit bureau score breakdown"
                description="Detailed bureau scoring indicators returned under the provider score payload."
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {scoreMetrics.map((item) => (
                    <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Linked application loan"
                description="Operational context for the application loan tied to this bureau score request."
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {loanDetails.map((item) => (
                    <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </SectionCard>

              <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-950 dark:text-white">
                  View raw credit score payload
                </summary>
                <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                  <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(record, null, 2)}
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

function BankoneSyncResultModal({
                                  result,
                                  onClose,
                                }: {
  result: BankoneSyncResultState;
  onClose: () => void;
}) {
  const payload = unwrapPayload(result.data);
  const record = isRecord(payload) ? payload : {};

  const bankOneResponse = isRecord(record.bankOneResponse) ? record.bankOneResponse : {};
  const gatewayRecords = toRecordList(bankOneResponse.Message);

  const loan = isRecord(record.loan) ? record.loan : {};
  const appLoan = isRecord(record.appLoan) ? record.appLoan : {};
  const matchedRecord = isRecord(record.matchedRecord) ? record.matchedRecord : {};

  const creationResponse = isRecord(loan.bankoneResponse) ? loan.bankoneResponse : {};
  const creationMessage = isRecord(creationResponse.Message) ? creationResponse.Message : {};

  const gatewaySuccess = isSuccessfulValue(bankOneResponse.IsSuccessful);
  const matchedAvailable = Object.keys(matchedRecord).length > 0;

  const matchedTrackingRef = safeText(
      matchedRecord.AccountOpenningTrackingRef ??
      loan.bankoneLoanTrackingRef ??
      appLoan.bankoneLoanTrackingRef
  );

  const matchedAccountNumber = safeText(
      matchedRecord.Number ??
      loan.bankoneLoanAccountNumber ??
      loan.bankoneLinkedAccountNumber ??
      appLoan.bankoneLoanAccountNumber ??
      appLoan.bankoneLinkedAccountNumber
  );

  const customerName = safeText(
      matchedRecord.Name ??
      creationMessage.FullName ??
      appLoan.userName ??
      loan.userName
  );

  const customerId = safeText(
      matchedRecord.CustomerID ??
      bankOneResponse.CustomerIDInString ??
      loan.bankoneCustomerId ??
      appLoan.bankoneCustomerId
  );

  const topSummary = [
    {
      label: "Gateway",
      value: gatewaySuccess ? "Successful" : "Failed",
      icon: ShieldCheck,
      tone: gatewaySuccess ? "success" : "danger",
    },
    {
      label: "BankOne status",
      value: safeText(record.bankOneStatus),
      icon: Landmark,
      tone: String(record.bankOneStatus).toLowerCase() === "failed" ? "danger" : "warning",
    },
    {
      label: "Real loan status",
      value: safeText(matchedRecord.RealLoanStatus),
      icon: BarChart3,
      tone: String(matchedRecord.RealLoanStatus).toLowerCase() === "active" ? "success" : "warning",
    },
    {
      label: "Matched record",
      value: matchedAvailable ? "Found" : "Not found",
      icon: FileText,
      tone: matchedAvailable ? "success" : "warning",
    },
  ];

  const syncSnapshot = [
    { label: "Tracking reference", value: matchedTrackingRef },
    { label: "Loan account number", value: matchedAccountNumber },
    { label: "Customer ID", value: customerId },
    { label: "Customer name", value: customerName },
    { label: "Account officer", value: safeText(matchedRecord.AccountOfficer) },
    { label: "Last synced", value: formatDate(loan.bankoneLastSyncedAt ?? appLoan.bankoneLastSyncedAt) },
  ];

  const bankoneLoanDetails = [
    { label: "BankOne account", value: safeText(matchedRecord.Number) },
    { label: "Name and number", value: safeText(matchedRecord.NameAndNumber) },
    { label: "Opening tracking ref", value: safeText(matchedRecord.AccountOpenningTrackingRef) },
    { label: "Loan amount", value: formatBankoneMoney(matchedRecord.LoanAmount) },
    { label: "Ledger balance", value: formatBankoneMoney(matchedRecord.LedgerBalanceWithAccessLevelInNaira ?? matchedRecord.LedgerBalance) },
    { label: "Available balance", value: formatBankoneMoney(matchedRecord.AvailableBalanceInNaira ?? matchedRecord.AvailableBalance) },
    { label: "Interest rate", value: `${safeText(matchedRecord.InterestRate, "0")}%` },
    { label: "Loan cycle", value: safeText(matchedRecord.LoanCycle) },
    { label: "Security pledged", value: safeText(matchedRecord.SecurityPledged) },
    { label: "Date created", value: formatDate(matchedRecord.DateCreated) },
  ];

  const localCoreDetails = [
    { label: "Core loan ID", value: safeText(loan._id) },
    { label: "Core status", value: <StatusBadge status={record.coreStatus ?? loan.status} /> },
    { label: "Local amount", value: formatCurrency(loan.amount) },
    { label: "Outstanding", value: formatCurrency(loan.outstandingAmount) },
    { label: "Paid amount", value: formatCurrency(loan.paidAmount) },
    { label: "Purpose", value: safeText(loan.purpose) },
    { label: "Term", value: `${safeText(loan.term, "0")} month(s)` },
    { label: "Application date", value: formatDate(loan.applicationDate) },
  ];

  const localAppDetails = [
    { label: "App loan ID", value: safeText(appLoan._id) },
    { label: "App status", value: <StatusBadge status={record.appStatus ?? appLoan.status} /> },
    { label: "Loan type", value: safeText(appLoan.loanTypeName) },
    { label: "Duration", value: safeText(appLoan.durationLabel) },
    { label: "Requested amount", value: formatCurrency(appLoan.amount) },
    { label: "Interest amount", value: formatCurrency(appLoan.interestAmount) },
    { label: "Total payable", value: formatCurrency(appLoan.totalPayable) },
    { label: "Source provider", value: safeText(appLoan.sourceProvider) },
  ];

  const creationDetails = [
    { label: "Creation success", value: safeText(creationResponse.IsSuccessful) },
    { label: "Creation tracking ref", value: safeText(creationResponse.TransactionTrackingRef) },
    { label: "Created customer ID", value: safeText(creationMessage.CustomerID) },
    { label: "Created account number", value: safeText(creationMessage.BankoneAccountNumber) },
    { label: "Created full name", value: safeText(creationMessage.FullName) },
    { label: "Creation message", value: safeText(creationMessage.CreationMessage) },
  ];

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
          <div className="relative overflow-hidden border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] px-6 py-6 text-white">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/2 h-56 w-56 rounded-full bg-[#069AFF]/30 blur-3xl" />

            <div className="relative flex items-start justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-100">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  BankOne sync result
                </div>

                <h2 className="mt-4 text-2xl font-black tracking-tight md:text-3xl">
                  {safeText(result.title || record.message || "Loan status synchronization")}
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                  {safeText(
                      record.message,
                      "BankOne response has been received and compared with the local core loan and app loan records."
                  )}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  Tracking Ref: {matchedTrackingRef}
                </span>

                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  Account: {matchedAccountNumber}
                </span>

                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  Records returned: {gatewayRecords.length}
                </span>
                </div>
              </div>

              <button
                  type="button"
                  onClick={onClose}
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close BankOne sync result"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-slate-50 p-5 dark:bg-[#07111f]">
            {result.loading && (
                <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Syncing BankOne status
                </div>
            )}

            {result.error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {result.error}
                </div>
            )}

            {!result.loading && !result.error && (
                <div className="grid gap-5">
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {topSummary.map((item) => {
                      const Icon = item.icon;

                      return (
                          <div
                              key={item.label}
                              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
                                <Icon className="h-5 w-5" aria-hidden="true" />
                              </div>

                              <StatusBadge status={item.value} />
                            </div>

                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                              {item.label}
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                              {item.value}
                            </p>
                          </div>
                      );
                    })}
                  </section>

                  <SectionCard
                      title="Sync snapshot"
                      description="Clean summary of the exact BankOne loan matched to the local loan record."
                  >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {syncSnapshot.map((item) => (
                          <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                      ))}
                    </div>
                  </SectionCard>

                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                    <SectionCard
                        title="Matched BankOne loan"
                        description="This is the BankOne record selected as the match from the gateway response."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {bankoneLoanDetails.map((item) => (
                            <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                        ))}
                      </div>
                    </SectionCard>

                    <div className="grid gap-5">
                      <SectionCard title="Core loan status">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {localCoreDetails.map((item) => (
                              <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                          ))}
                        </div>
                      </SectionCard>

                      <SectionCard title="App loan status">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {localAppDetails.map((item) => (
                              <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                          ))}
                        </div>
                      </SectionCard>
                    </div>
                  </section>

                  <SectionCard
                      title="BankOne loan creation response"
                      description="Formatted creation response previously returned when the BankOne loan account was created."
                  >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {creationDetails.map((item) => (
                          <MiniInfoCard key={item.label} label={item.label} value={item.value} />
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                      title="Gateway response from BankOne"
                      description="Formatted records returned inside bankOneResponse.Message. The matched record is highlighted."
                  >
                    <div className="mb-4 grid gap-3 md:grid-cols-3">
                      <MiniInfoCard
                          label="Gateway success"
                          value={gatewaySuccess ? "Successful" : "Failed"}
                          tone={gatewaySuccess ? "success" : "danger"}
                      />
                      <MiniInfoCard
                          label="Customer ID string"
                          value={safeText(bankOneResponse.CustomerIDInString)}
                      />
                      <MiniInfoCard
                          label="Records returned"
                          value={gatewayRecords.length}
                      />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-left text-sm">
                          <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                          <tr>
                            <th className="px-5 py-3">Match</th>
                            <th className="px-5 py-3">Tracking ref</th>
                            <th className="px-5 py-3">Account number</th>
                            <th className="px-5 py-3">Customer</th>
                            <th className="px-5 py-3">Loan amount</th>
                            <th className="px-5 py-3">Balance</th>
                            <th className="px-5 py-3">Interest</th>
                            <th className="px-5 py-3">Cycle</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Created</th>
                          </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                          {gatewayRecords.map((item, index) => {
                            const isMatched =
                                safeText(item.AccountOpenningTrackingRef, "") === matchedTrackingRef ||
                                safeText(item.Number, "") === matchedAccountNumber ||
                                safeText(item.ID, "") === safeText(matchedRecord.ID, "");

                            return (
                                <tr
                                    key={`${safeText(item.ID, String(index))}-${index}`}
                                    className={
                                      isMatched
                                          ? "bg-emerald-50/70 text-slate-800 dark:bg-emerald-400/10 dark:text-slate-200"
                                          : "text-slate-700 dark:text-slate-300"
                                    }
                                >
                                  <td className="px-5 py-4">
                                    {isMatched ? (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                                    Matched
                                  </span>
                                    ) : (
                                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                    Other
                                  </span>
                                    )}
                                  </td>

                                  <td className="px-5 py-4 font-semibold">
                                    {safeText(item.AccountOpenningTrackingRef)}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {safeText(item.Number)}
                                  </td>
                                  <td className="px-5 py-4">
                                    <p className="font-bold text-slate-950 dark:text-white">
                                      {safeText(item.Name)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      Customer ID: {safeText(item.CustomerID)}
                                    </p>
                                  </td>
                                  <td className="px-5 py-4 font-bold">
                                    {formatBankoneMoney(item.LoanAmount)}
                                  </td>
                                  <td className="px-5 py-4">
                                    {formatBankoneMoney(item.BalanceInNaira ?? item.LedgerBalance)}
                                  </td>
                                  <td className="px-5 py-4">{safeText(item.InterestRate, "0")}%</td>
                                  <td className="px-5 py-4">{safeText(item.LoanCycle)}</td>
                                  <td className="px-5 py-4">
                                    <StatusBadge status={item.RealLoanStatus ?? "pending"} />
                                  </td>
                                  <td className="px-5 py-4">{formatDate(item.DateCreated)}</td>
                                </tr>
                            );
                          })}
                          </tbody>
                        </table>
                      </div>

                      {!gatewayRecords.length && (
                          <div className="px-5 py-10 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            No BankOne gateway records returned.
                          </div>
                      )}
                    </div>
                  </SectionCard>

                  <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-950 dark:text-white">
                      View raw sync payload
                    </summary>

                    <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                  <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(record, null, 2)}
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

export default function LoansPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenLoans } = useRouteAccess("/loans");
  const toastIdRef = useRef(0);
  const [workspaceData, setWorkspaceData] = useState<LoansWorkspaceData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [formAction, setFormAction] = useState<FormAction | null>(null);
  const [appLoanDetail, setAppLoanDetail] = useState<AppLoanDetailState | null>(null);
  const [coreLoanDetail, setCoreLoanDetail] = useState<CoreLoanDetailState | null>(null);
  const [bankoneSyncResult, setBankoneSyncResult] = useState<BankoneSyncResultState | null>(null);
  const [creditScoreResult, setCreditScoreResult] = useState<CreditScoreResultState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenLoans) {
      return;
    }

    void fetchLoansWorkspace().then((result) => {
      if (!cancelled) {
        setWorkspaceData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenLoans, router]);

  const loans = useMemo(() => extractRows(workspaceData?.loans), [workspaceData]);
  const loanPackages = useMemo(() => extractRows(workspaceData?.loanPackages), [workspaceData]);
  const loanTypes = useMemo(() => extractRows(workspaceData?.loanTypes), [workspaceData]);
  const appLoans = useMemo(() => extractRows(workspaceData?.appLoans), [workspaceData]);
  const endpointErrors = workspaceData ? Object.entries(workspaceData.errors) : [];

  const refreshData = async () => {
    setRefreshing(true);
    setWorkspaceData(await fetchLoansWorkspace());
    setRefreshing(false);
  };

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

  const submitAndRefresh = async (request: () => Promise<unknown>) => {
    try {
      const response = await request();
      await refreshData();
      setFormAction(null);
      showServerToast(response, "Action completed successfully", "success");
    } catch (error) {
      showServerToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Request failed", "error");
      throw error;
    }
  };

  const summaryCards = [
    { label: "BankOne loans", value: formatValue(loans.length), icon: CreditCard },
    { label: "App Loans", value: formatValue(appLoans.length), icon: WalletCards },
    { label: "Loan types", value: formatValue(loanTypes.length), icon: BriefcaseBusiness },
    { label: "Loan packages", value: formatValue(loanPackages.length), icon: CheckCircle2 },
  ];

  const runLoanMaintenanceAction = async (id: string, action: string, request: () => Promise<unknown>) => {
    setBusyAction(`loan-${id}-${action}`);

    try {
      const response = await request();
      await refreshData();
      showServerToast(response, "Loan action completed successfully", "success");
    } catch (error) {
      showServerToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Loan action failed", "error");
      throw error;
    } finally {
      setBusyAction(null);
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

  const openAppLoanDetail = (id: string) => {
    setAppLoanDetail({
      title: "Application loan details",
      loading: true,
      data: null,
      error: "",
    });

    void adminService
      .getAppLoanById(id)
      .then((data) =>
        setAppLoanDetail({
          title: "Application loan details",
          loading: false,
          data,
          error: "",
        }),
      )
      .catch((error) =>
        setAppLoanDetail({
          title: "Application loan details",
          loading: false,
          data: null,
          error: getErrorMessage(error),
        }),
      );
  };

  const openCoreLoanDetail = (id: string) => {
    setCoreLoanDetail({
      title: "Core loan details",
      loading: true,
      data: null,
      error: "",
    });

    void adminService
      .getLoanDetails(id)
      .then((data) =>
        setCoreLoanDetail({
          title: "Core loan details",
          loading: false,
          data,
          error: "",
        }),
      )
      .catch((error) =>
        setCoreLoanDetail({
          title: "Core loan details",
          loading: false,
          data: null,
          error: getErrorMessage(error),
        }),
      );
  };

  const runAppLoanAction = async (id: string, action: string, request: () => Promise<unknown>) => {
    setBusyAction(`app-loan-${id}-${action}`);
    try {
      const response = await request();
      await refreshData();
      if (action === "score") {
        setCreditScoreResult({
          title: "Loan score fetched successfully",
          loading: false,
          data: response,
          error: "",
        });
      } else {
        showServerToast(response, "Application loan action completed successfully", "success");
      }
    } catch (error) {
      showServerToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "Application loan action failed", "error");
      throw error;
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
      initialValues: { reason: "Incomplete information" },
      fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.rejectAppLoan(id, { reason: values.reason })),
    });
  };

  const openReviewAppLoan = (id: string) => {
    setFormAction({
      eyebrow: "App loan",
      title: "Review application loan",
      description: "Record the review note before approval or rejection.",
      submitLabel: "Submit review",
      initialValues: { note: "Documents checked" },
      fields: [{ name: "note", label: "Review note", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.reviewAppLoan(id, { note: values.note })),
    });
  };

  const openApproveManualRepayment = (id: string) => {
    setFormAction({
      eyebrow: "Manual repayment",
      title: "Approve manual repayment",
      description: "Confirm the manual repayment request after verifying the transfer evidence.",
      submitLabel: "Approve repayment",
      initialValues: {
        requestId: "MRQ-XXXXXXXXXXXX",
        reference: "TRF123456",
        note: "Bank statement confirmed",
      },
      fields: [
        { name: "requestId", label: "Request ID", required: true, placeholder: "MRQ-XXXXXXXXXXXX" },
        { name: "reference", label: "Reference", required: true, placeholder: "TRF123456" },
        { name: "note", label: "Approval note", type: "textarea", required: true, placeholder: "Bank statement confirmed" },
      ],
      onSubmit: (values) =>
        submitAndRefresh(() =>
          adminService.approveAppLoanManualRepayment(id, {
            requestId: values.requestId,
            reference: values.reference,
            note: values.note,
          }),
        ),
    });
  };

  const openRejectManualRepayment = (id: string) => {
    setFormAction({
      eyebrow: "Manual repayment",
      title: "Reject manual repayment",
      description: "Reject the manual repayment request when the payment cannot be verified.",
      submitLabel: "Reject repayment",
      initialValues: {
        requestId: "MRQ-XXXXXXXXXXXX",
        reason: "Payment not found",
      },
      fields: [
        { name: "requestId", label: "Request ID", required: true, placeholder: "MRQ-XXXXXXXXXXXX" },
        { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "Payment not found" },
      ],
      onSubmit: (values) =>
        submitAndRefresh(() =>
          adminService.rejectAppLoanManualRepayment(id, {
            requestId: values.requestId,
            reason: values.reason,
          }),
        ),
    });
  };

  const openCloseAppLoan = (id: string) => {
    setFormAction({
      eyebrow: "App loan",
      title: "Close application loan",
      description: "Close this loan only after it is fully settled.",
      submitLabel: "Close loan",
      initialValues: { reason: "Fully settled" },
      fields: [{ name: "reason", label: "Closure reason", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.closeAppLoan(id, { reason: values.reason })),
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
          try {
          const response = await adminService.syncLoanBankoneStatus(id, {
              institutionCode: values.institutionCode,
          });

          await refreshData();
          setFormAction(null);
          showServerToast(response, "BankOne loan status synced successfully", "success");
          setBankoneSyncResult({
            title: "BankOne loan status synced successfully",
            loading: false,
            data: response,
            error: "",
          });
        } catch (error) {
          showServerToast(getErrorPayload(error) ?? { message: getErrorMessage(error) }, "BankOne sync failed", "error");
          throw error;
        }
      })(),
    });
  };

  const openReviewCoreLoan = (id: string) => {
    setFormAction({
      eyebrow: "Core loan",
      title: "Review core loan",
      description: "Record the review note before attempting approval.",
      submitLabel: "Submit review",
      initialValues: { note: "Documents checked" },
      fields: [{ name: "note", label: "Review note", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.reviewLoan(id, { note: values.note })),
    });
  };

  const openRejectCoreLoan = (id: string) => {
    setFormAction({
      eyebrow: "Core loan",
      title: "Reject core loan",
      description: "Provide the official rejection reason for this legacy loan record.",
      submitLabel: "Reject loan",
      initialValues: { reason: "Incomplete information" },
      fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.rejectLoan(id, { reason: values.reason })),
    });
  };

  const openCloseCoreLoan = (id: string) => {
    setFormAction({
      eyebrow: "Core loan",
      title: "Close core loan",
      description: "Close this legacy loan only after confirming it is fully settled.",
      submitLabel: "Close loan",
      initialValues: { reason: "Fully settled" },
      fields: [{ name: "reason", label: "Closure reason", type: "textarea", required: true }],
      onSubmit: (values) => submitAndRefresh(() => adminService.closeLoan(id, { reason: values.reason })),
    });
  };

  if (!canOpenLoans) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8">
        <AccessDeniedState
          title="Loans workspace access denied"
          description="Your current admin role does not include permission to work with loans and underwriting records."
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
              Loan Management
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Comprehensive view of all loan applications, portfolios, and packages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshData()}
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
        {!workspaceData ? (
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
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Lending control
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Dedicated workspace for core loans, app loans, product setup, and BankOne maintenance.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Review legacy loans, App Loans, repayment schedules, product types, and synchronization flows without crowding the Admin Center.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  {[
                    ["BankOne loans", loans.length],
                    ["App Loans", appLoans.length],
                    ["Loan types", loanTypes.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-white/10 bg-white/[0.08] p-4 text-center">
                      <p className="text-2xl font-bold">{formatValue(value)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-100">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {endpointErrors.length > 0 && (
              <div className="grid gap-3">
                {endpointErrors.map(([key, message]) => (
                  <div key={key} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                    {formatLabel(key)}: {message}
                  </div>
                ))}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
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

            <ManagementTable title="App Loans" rows={appLoans} columns={["Applicant", "Loan", "Exposure", "Status", "Action"]}>
              {(row, index) => {
                const id = getId(row);
                const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
                const applicantName = String(getRecordValue(row, ["customerName", "userName", "userId"]) ?? `Application ${index + 1}`);
                const loanTitle = String(getRecordValue(row, ["loanTypeName"]) ?? "Application loan");
                const purposeText = String(getRecordValue(row, ["purposeText", "purposeId"]) ?? "Purpose not stated");
                const durationLabel = String(getRecordValue(row, ["durationLabel"]) ?? "No duration");
                const installments = formatValue(getRecordValue(row, ["installmentCount"]) ?? 0);
                const outstandingAmount = Number(getRecordValue(row, ["outstandingAmount"]) ?? NaN);
                const totalPayable = Number(getRecordValue(row, ["totalPayable"]) ?? NaN);
                const paidAmount = Number(getRecordValue(row, ["paidAmount"]) ?? NaN);
                const isClosed = ["closed"].includes(status);
                const isRejected = ["rejected"].includes(status);
                const isApproved = ["approved", "active"].includes(status);
                const isReviewed = Boolean(getRecordValue(row, ["reviewedAt", "reviewedBy", "reviewedByUser"]));
                const progressRatio =
                  Number.isFinite(totalPayable) && totalPayable > 0 && Number.isFinite(paidAmount)
                    ? Math.min(100, Math.max(0, Math.round((paidAmount / totalPayable) * 100)))
                    : 0;
                const canClose =
                  !isClosed &&
                  !isRejected &&
                  ((Number.isFinite(outstandingAmount) && outstandingAmount <= 0) ||
                    status === "fully_repaid" ||
                    status === "settled" ||
                    (Number.isFinite(totalPayable) && Number.isFinite(paidAmount) && paidAmount >= totalPayable));
                const nextStep = !isReviewed
                  ? "Review required"
                  : isApproved
                    ? "Loan approved"
                    : isRejected
                      ? "Rejected record"
                      : canClose
                        ? "Eligible for closure"
                        : "Awaiting decision";
                return (
                  <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#069AFF]/12 text-sm font-black text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
                          {getInitials(applicantName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold leading-6 text-slate-950 dark:text-white">{applicantName}</p>
                          <p className="mt-1 break-all text-xs font-medium text-slate-500 dark:text-slate-400">{id || "No loan id"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">{loanTitle}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          {purposeText}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          {durationLabel}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          {installments} installment{installments === "1" ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="grid min-w-[210px] gap-2 sm:grid-cols-2">
                        <LoanMetricTile label="Requested" value={formatCurrency(getRecordValue(row, ["amount"]))} />
                        <LoanMetricTile label="Outstanding" value={formatCurrency(getRecordValue(row, ["outstandingAmount"]))} />
                        <LoanMetricTile label="Paid" value={formatCurrency(getRecordValue(row, ["paidAmount"]))} />
                        <LoanMetricTile label="Payable" value={formatCurrency(getRecordValue(row, ["totalPayable"]))} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} />
                          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{progressRatio}% paid</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div className="h-full rounded-full bg-[#069AFF]" style={{ width: `${progressRatio}%` }} />
                        </div>
                        <div className="mt-3 space-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <p>{isReviewed ? "Review completed" : "Pending review"}</p>
                          <p>{nextStep}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[580px] rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Operations desk</p>
                            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{nextStep}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-[#069AFF]/20 bg-[#069AFF]/8 px-2.5 py-1 text-[11px] font-bold text-[#069AFF] dark:text-sky-200">
                              {durationLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                              {formatCurrency(getRecordValue(row, ["amount"]))}
                            </span>
                          </div>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Primary workflow</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <LoanActionButton
                                label="View details"
                                icon={Eye}
                                disabled={!id}
                                onClick={() => openAppLoanDetail(id)}
                              />
                              <LoanActionButton
                                label="Review"
                                icon={FileText}
                                disabled={!id}
                                onClick={() => openReviewAppLoan(id)}
                              />
                              <LoanActionButton
                                label="Score"
                                icon={BarChart3}
                                tone="primary"
                                busy={busyAction === `app-loan-${id}-score`}
                                disabled={!id}
                                onClick={() => runAppLoanAction(id, "score", () => adminService.scoreAppLoan(id))}
                              />
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <LoanActionButton
                                label="Approve"
                                icon={CheckCircle2}
                                tone="success"
                                busy={busyAction === `app-loan-${id}-approve`}
                                disabled={!id || !isReviewed || isApproved || isRejected || isClosed}
                                onClick={() => runAppLoanAction(id, "approve", () => adminService.approveAppLoan(id))}
                              />
                              <LoanActionButton
                                label="Reject"
                                icon={X}
                                tone="danger"
                                disabled={!id}
                                onClick={() => openRejectAppLoan(id)}
                              />
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {isReviewed ? "Review recorded. Approval can proceed when status allows." : "Review is required before approval."}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Manual repayment</p>
                            <div className="mt-3 grid gap-2">
                              <LoanActionButton
                                label="Approve repayment"
                                icon={CheckCircle2}
                                tone="success"
                                disabled={!id}
                                onClick={() => openApproveManualRepayment(id)}
                              />
                              <LoanActionButton
                                label="Reject repayment"
                                icon={X}
                                tone="danger"
                                disabled={!id}
                                onClick={() => openRejectManualRepayment(id)}
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Ancillary actions</p>
                            <div className="mt-3 grid gap-2">
                              <LoanActionButton
                                label="Top-up approve"
                                icon={CheckCircle2}
                                tone="primary"
                                disabled={!id}
                                onClick={() => openApproveTopUp(id)}
                              />
                              <LoanActionButton
                                label="Top-up reject"
                                icon={X}
                                tone="danger"
                                disabled={!id}
                                onClick={() => openRejectTopUp(id)}
                              />
                              <LoanActionButton
                                label="Close loan"
                                icon={ShieldCheck}
                                disabled={!id || !canClose}
                                onClick={() => openCloseAppLoan(id)}
                              />
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {canClose ? "This loan is eligible for closure." : "Closure unlocks only after full settlement."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }}
            </ManagementTable>

            <ManagementTable title="BankOne loans" rows={loans} columns={["Customer", "Amount", "Status", "Created", "Action"]}>
              {(row, index) => {
                const id = getId(row);
                const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
                const canReview = !["approved", "active", "rejected", "closed"].includes(status);
                const reviewed = Boolean(getRecordValue(row, ["reviewedAt", "reviewedBy", "reviewedByUser"]));
                const outstandingAmount = Number(getRecordValue(row, ["outstandingAmount"]) ?? NaN);
                const isClosed = status === "closed";
                const canClose =
                  !isClosed &&
                  ((Number.isFinite(outstandingAmount) && outstandingAmount <= 0) ||
                    status === "fully_repaid" ||
                    status === "settled");
                const trackingRef = String(getRecordValue(row, ["bankoneLoanTrackingRef"]) ?? "");
                const accountNumber = String(getRecordValue(row, ["bankoneLoanAccountNumber"]) ?? "");
                return (
                  <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userName", "userId", "email"]) ?? `Loan ${index + 1}`)}</p>
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
                          onClick={() => openCoreLoanDetail(id)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={!id || !canReview}
                          onClick={() => openReviewCoreLoan(id)}
                          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={!id || !reviewed || status === "approved" || status === "active" || status === "rejected" || status === "closed" || busyAction === `loan-${id}-approve`}
                          onClick={() => void runLoanMaintenanceAction(id, "approve", () => adminService.approveLoan(id, { disburseToWallet: false }))}
                          className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!id || !canReview}
                          onClick={() => openRejectCoreLoan(id)}
                          className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={!id || busyAction === `loan-${id}-create-app-loan`}
                          onClick={() => void runLoanMaintenanceAction(id, "create-app-loan", () => adminService.createAppLoanFromLoan(id))}
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
                        <button
                          type="button"
                          disabled={!id || !canClose}
                          onClick={() => openCloseCoreLoan(id)}
                          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          Close
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

      {formAction && <ActionModal action={formAction} onClose={() => setFormAction(null)} />}
      {appLoanDetail && <AppLoanDetailsModal loan={appLoanDetail} onClose={() => setAppLoanDetail(null)} />}
      {coreLoanDetail && <CoreLoanDetailsModal loan={coreLoanDetail} onClose={() => setCoreLoanDetail(null)} />}
      {creditScoreResult && <CreditScoreResultModal result={creditScoreResult} onClose={() => setCreditScoreResult(null)} />}
      {bankoneSyncResult && <BankoneSyncResultModal result={bankoneSyncResult} onClose={() => setBankoneSyncResult(null)} />}
    </main>
  );
}
