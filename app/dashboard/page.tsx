"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";

type DashboardKey =
  | "stats"
  | "loansStats"
  | "recentLoans"
  | "recentBills"
  | "billsStats"
  | "billHistory"
  | "deposits";

type DashboardData = Record<DashboardKey, unknown> & {
  errors: Partial<Record<DashboardKey, string>>;
};

type Metric = {
  label: string;
  value: string;
};

type TrendPoint = {
  label: string;
  bills: number;
  deposits: number;
};

type StatusPoint = {
  label: string;
  value: number;
  className: string;
  stroke: string;
};

type ActiveSection = "overview" | "bills" | "deposits";

const endpoints: Array<[DashboardKey, () => Promise<unknown>]> = [
  ["stats", adminService.getDashboardStats],
  ["loansStats", adminService.getLoansStats],
  ["recentLoans", adminService.getRecentLoans],
  ["recentBills", adminService.getRecentBills],
  ["billsStats", adminService.getBillsStats],
  ["billHistory", adminService.getBillHistory],
  ["deposits", adminService.getDeposits],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
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

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
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

const collectMetrics = (payload: unknown, prefix = "", depth = 0): Metric[] => {
  const value = unwrapPayload(payload);

  if (!isRecord(value) || depth > 2) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    const label = prefix ? `${prefix} ${formatLabel(key)}` : formatLabel(key);

    if (typeof entry === "number" || typeof entry === "string") {
      const numericValue = typeof entry === "string" ? Number(entry) : entry;

      if (typeof entry === "number" || (!Number.isNaN(numericValue) && entry.trim().length <= 16)) {
        return [{ label, value: formatValue(entry) }];
      }
    }

    if (isRecord(entry)) {
      return collectMetrics(entry, label, depth + 1);
    }

    return [];
  });
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

const sumRows = (rows: Record<string, unknown>[], keys: string[]) =>
  rows.reduce((total, row) => {
    const value = getRecordValue(row, keys);
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isNaN(numeric) ? total : total + numeric;
  }, 0);

const getRowAmount = (row: Record<string, unknown>) =>
  Number(getRecordValue(row, ["amount", "billAmount", "creditAmount", "total", "totalAmount"]) ?? 0);

const getRowDate = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["createdAt", "date", "transactionDate", "updatedAt"]);
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getShortDateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);

const buildTrend = (
  bills: Record<string, unknown>[],
  deposits: Record<string, unknown>[],
): TrendPoint[] => {
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  return days.map((date) => {
    const key = getDateKey(date);
    const billTotal = bills.reduce((total, row) => {
      const rowDate = getRowDate(row);
      return rowDate && getDateKey(rowDate) === key ? total + getRowAmount(row) : total;
    }, 0);
    const depositTotal = deposits.reduce((total, row) => {
      const rowDate = getRowDate(row);
      return rowDate && getDateKey(rowDate) === key ? total + getRowAmount(row) : total;
    }, 0);

    return {
      label: getShortDateLabel(date),
      bills: billTotal,
      deposits: depositTotal,
    };
  });
};

const buildStatusMix = (rows: Record<string, unknown>[]): StatusPoint[] => {
  const groups = rows.reduce(
    (result: { success: number; failed: number; pending: number }, row) => {
      const status = String(getRecordValue(row, ["status", "paymentStatus", "billStatus"]) ?? "pending").toLowerCase();

      if (["success", "successful", "paid", "completed", "active"].includes(status)) {
        result.success += 1;
      } else if (["failed", "reversed", "declined", "cancelled"].includes(status)) {
        result.failed += 1;
      } else {
        result.pending += 1;
      }

      return result;
    },
    { success: 0, failed: 0, pending: 0 },
  );

  return [
    { label: "Successful", value: groups.success, className: "bg-emerald-500", stroke: "#10b981" },
    { label: "Pending", value: groups.pending, className: "bg-amber-500", stroke: "#f59e0b" },
    { label: "Failed", value: groups.failed, className: "bg-red-500", stroke: "#ef4444" },
  ];
};

const fetchDashboard = async (): Promise<DashboardData> => {
  const results = await Promise.allSettled(endpoints.map(([, request]) => request()));
  const data = {} as Record<DashboardKey, unknown>;
  const errors: Partial<Record<DashboardKey, string>> = {};

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
    stats: data.stats,
    loansStats: data.loansStats,
    recentLoans: data.recentLoans,
    recentBills: data.recentBills,
    billsStats: data.billsStats,
    billHistory: data.billHistory,
    deposits: data.deposits,
    errors,
  };
};

function ExecutiveCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#069AFF]/40 hover:shadow-lg hover:shadow-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/40">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#069AFF]" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function MetricsPanel({ title, metrics }: { title: string; metrics: Metric[] }) {
  return (
    <section className="rounded-lg border border-[#069AFF]/20 bg-white p-5 shadow-sm shadow-[#069AFF]/5 dark:border-[#069AFF]/20 dark:bg-white/[0.045]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        <BarChart3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(metrics.length ? metrics.slice(0, 6) : [{ label: "No data yet", value: "0" }]).map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinancialTrendChart({ data }: { data: TrendPoint[] }) {
  const maxValue = Math.max(...data.map((point) => point.bills + point.deposits), 1);
  const totalBills = data.reduce((total, point) => total + point.bills, 0);
  const totalDeposits = data.reduce((total, point) => total + point.deposits, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Financial movement
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">7-day bills and deposits trend</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bills</p>
            <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(totalBills)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deposits</p>
            <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(totalDeposits)}</p>
          </div>
        </div>
      </div>

      <div className="flex h-72 items-end gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
        {data.map((point) => {
          const billHeight = Math.max((point.bills / maxValue) * 100, point.bills > 0 ? 8 : 2);
          const depositHeight = Math.max((point.deposits / maxValue) * 100, point.deposits > 0 ? 8 : 2);

          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex h-56 w-full items-end justify-center gap-1.5">
                <div
                  className="w-full max-w-[18px] rounded-t-md bg-[#069AFF] shadow-sm shadow-[#069AFF]/30"
                  style={{ height: `${billHeight}%` }}
                  title={`Bills: ${formatCurrency(point.bills)}`}
                />
                <div
                  className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-[#069AFF] to-emerald-400 shadow-sm shadow-[#069AFF]/20"
                  style={{ height: `${depositHeight}%` }}
                  title={`Deposits: ${formatCurrency(point.deposits)}`}
                />
              </div>
              <p className="truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">{point.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#069AFF]" />
          Bills
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#069AFF] to-emerald-400" />
          Deposits
        </span>
      </div>
    </section>
  );
}

function StatusDonutChart({ data }: { data: StatusPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Control status
        </p>
        <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">Bill status distribution</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-center">
        <div className="relative mx-auto h-44 w-44">
          <svg className="h-44 w-44 -rotate-90" viewBox="0 0 120 120" role="img" aria-label="Bill status distribution chart">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-slate-100 dark:text-white/10"
            />
            {total > 0 && data.map((point) => {
              const segment = (point.value / total) * circumference;
              const strokeDasharray = `${segment} ${circumference - segment}`;
              const strokeDashoffset = -offset;
              offset += segment;

              return (
                <circle
                  key={point.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={point.stroke}
                  strokeWidth="14"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{formatValue(total)}</p>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Bills</p>
          </div>
        </div>

        <div className="grid gap-3">
          {data.map((point) => {
            const percentage = total > 0 ? Math.round((point.value / total) * 100) : 0;

            return (
              <div key={point.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <span className={`h-2.5 w-2.5 rounded-full ${point.className}`} />
                    {point.label}
                  </span>
                  <span className="text-sm font-bold text-slate-950 dark:text-white">{percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className={`h-2 rounded-full ${point.className}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {formatValue(point.value)} records
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const isSuccess = ["success", "successful", "paid", "completed", "active"].includes(normalized);
  const isFailed = ["failed", "reversed", "declined", "cancelled"].includes(normalized);

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

function BillHistoryTable({
  rows,
  onView,
  onReverse,
  reversingId,
}: {
  rows: Record<string, unknown>[];
  onView: (id: string) => void;
  onReverse: (id: string) => void;
  reversingId: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Bill transaction history</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administrative billing records and reversal control.</p>
        </div>
        <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3">Customer / Recipient</th>
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {rows.map((row, index) => {
              const id = String(getRecordValue(row, ["_id", "id"]) ?? "");
              const name = getRecordValue(row, ["customerName", "name", "fullName", "userName", "recipient", "email"]) ?? `Bill ${index + 1}`;
              const reference = getRecordValue(row, ["reference", "requestId", "transactionId", "billId"]) ?? "No reference";
              const service = getRecordValue(row, ["serviceType", "providerType", "service", "type"]) ?? "Bill";
              const amount = getRecordValue(row, ["amount", "billAmount", "total", "totalAmount"]);
              const status = getRecordValue(row, ["status", "paymentStatus", "billStatus"]);
              const createdAt = getRecordValue(row, ["createdAt", "date", "transactionDate", "updatedAt"]);
              const failed = String(status ?? "").toLowerCase() === "failed";

              return (
                <tr key={`${id || reference}-${index}`} className="text-slate-700 dark:text-slate-300">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950 dark:text-white">{String(name)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(reference)}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold">{String(service)}</td>
                  <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(amount)}</td>
                  <td className="px-5 py-4"><StatusBadge status={status} /></td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={!id}
                        onClick={() => onView(id)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View
                      </button>
                      <button
                        type="button"
                        disabled={!id || failed || reversingId === id}
                        onClick={() => onReverse(id)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                      >
                        {reversingId === id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        )}
                        Reverse
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
          No bill records returned.
        </div>
      )}
    </section>
  );
}

function DepositsTable({
  rows,
  onView,
}: {
  rows: Record<string, unknown>[];
  onView: (row: Record<string, unknown>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Deposit records</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Incoming deposits across customer wallets and payment channels.</p>
        </div>
        <WalletCards className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3">Account / Customer</th>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {rows.map((row, index) => {
              const name = getRecordValue(row, ["customerName", "name", "accountName", "userName", "email"]) ?? `Deposit ${index + 1}`;
              const reference = getRecordValue(row, ["reference", "sessionId", "transactionId", "_id", "id"]) ?? "No reference";
              const amount = getRecordValue(row, ["amount", "creditAmount", "totalAmount"]);
              const status = getRecordValue(row, ["status", "paymentStatus"]) ?? "Completed";
              const createdAt = getRecordValue(row, ["createdAt", "date", "transactionDate", "updatedAt"]);

              return (
                <tr key={`${String(reference)}-${index}`} className="text-slate-700 dark:text-slate-300">
                  <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(name)}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{String(reference)}</td>
                  <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(amount)}</td>
                  <td className="px-5 py-4"><StatusBadge status={status} /></td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
          No deposit records returned.
        </div>
      )}
    </section>
  );
}

function DetailModal({
  title,
  data,
  loading,
  error,
  onClose,
}: {
  title: string;
  data: unknown;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const detail = unwrapPayload(data);
  const record = isRecord(detail) ? detail : {};
  const providerResponse = getRecordValue(record, ["providerResponse", "response", "metadata"]);
  const summaryAmount = getRecordValue(record, ["amount", "billAmount", "creditAmount", "total", "totalAmount"]);
  const summaryReference = getRecordValue(record, ["reference", "requestId", "transactionId", "_id", "id"]);
  const summaryStatus = getRecordValue(record, ["status", "paymentStatus", "billStatus"]);
  const summaryDate = getRecordValue(record, ["createdAt", "date", "transactionDate", "updatedAt"]);
  const primaryFields = [
    "reference",
    "accountNumber",
    "amount",
    "status",
    "provider",
    "source",
    "userId",
    "customerId",
    "walletId",
    "virtualAccountId",
    "walletTransactionId",
    "createdAt",
    "updatedAt",
  ];
  const primaryEntries = primaryFields
    .filter((key) => key in record)
    .map((key) => [key, record[key]] as [string, unknown]);
  const otherEntries = Object.entries(record)
    .filter(([key]) => !primaryFields.includes(key) && key !== "providerResponse" && key !== "response" && key !== "metadata")
    .slice(0, 12);
  const providerEntries = isRecord(providerResponse) ? Object.entries(providerResponse) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Transaction record
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>
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
          {loading && (
            <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading details
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="grid gap-5">
              <section className="rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_55%,#069AFF_145%)] p-5 text-white shadow-lg shadow-[#069AFF]/10 dark:border-[#069AFF]/25">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Reference</p>
                    <p className="mt-2 break-words text-lg font-bold">{String(summaryReference ?? "No reference")}</p>
                    <p className="mt-2 text-sm text-slate-300">{formatDate(summaryDate)}</p>
                  </div>
                  <div className="rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight">{formatCurrency(summaryAmount)}</p>
                    <div className="mt-3">
                      <StatusBadge status={summaryStatus} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Primary information</h3>
                  </div>
                  <div className="grid gap-0 divide-y divide-slate-100 dark:divide-white/10">
                    {primaryEntries.map(([key, value]) => (
                      <div key={key} className="grid gap-2 px-5 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {formatLabel(key)}
                        </p>
                        <p className="break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Provider response</h3>
                  </div>
                  <div className="grid gap-0 divide-y divide-slate-100 dark:divide-white/10">
                    {(providerEntries.length ? providerEntries : [["Response", "No provider response"]]).map(([key, value]) => (
                      <div key={key} className="px-5 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {formatLabel(key)}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {otherEntries.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.035]">
                  <h3 className="mb-4 font-bold text-slate-950 dark:text-white">Additional fields</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {otherEntries.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/50">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {formatLabel(key)}
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid gap-5">
      <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [billServiceType, setBillServiceType] = useState("all");
  const [selectedBill, setSelectedBill] = useState<{ loading: boolean; data: unknown; error: string } | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<Record<string, unknown> | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    void fetchDashboard().then((result) => {
      if (!cancelled) {
        setDashboardData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const recentLoans = useMemo(() => extractRows(dashboardData?.recentLoans), [dashboardData]);
  const recentBills = useMemo(() => extractRows(dashboardData?.recentBills), [dashboardData]);
  const billRows = useMemo(() => extractRows(dashboardData?.billHistory), [dashboardData]);
  const depositRows = useMemo(() => extractRows(dashboardData?.deposits), [dashboardData]);
  const loansMetrics = useMemo(() => collectMetrics(dashboardData?.loansStats), [dashboardData]);
  const billsMetrics = useMemo(() => collectMetrics(dashboardData?.billsStats), [dashboardData]);
  const trendData = useMemo(() => buildTrend(billRows, depositRows), [billRows, depositRows]);
  const statusMix = useMemo(() => buildStatusMix(billRows), [billRows]);
  const endpointErrors = dashboardData ? Object.entries(dashboardData.errors) : [];

  const overviewMetrics = useMemo(() => {
    if (!dashboardData) {
      return [];
    }

    const metrics = [
      ...collectMetrics(dashboardData.stats),
      ...collectMetrics(dashboardData.loansStats),
      ...collectMetrics(dashboardData.billsStats),
    ];

    const unique = new Map<string, Metric>();
    metrics.forEach((metric) => {
      if (!unique.has(metric.label)) {
        unique.set(metric.label, metric);
      }
    });

    return Array.from(unique.values()).slice(0, 4);
  }, [dashboardData]);

  const serviceTypes = useMemo(() => {
    const types = billRows
      .map((row) => getRecordValue(row, ["serviceType", "providerType", "service", "type"]))
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    return Array.from(new Set(types)).slice(0, 8);
  }, [billRows]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await fetchDashboard();
    setDashboardData(result);
    setBillServiceType("all");
    setRefreshing(false);
  };

  const handleServiceFilter = async (serviceType: string) => {
    setBillServiceType(serviceType);

    if (!dashboardData) {
      return;
    }

    const result = serviceType === "all"
      ? await adminService.getBillHistory()
      : await adminService.getBillHistoryByServiceType(serviceType);

    setDashboardData({
      ...dashboardData,
      billHistory: result,
      errors: {
        ...dashboardData.errors,
        billHistory: undefined,
      },
    });
  };

  const handleViewBill = async (id: string) => {
    setSelectedBill({ loading: true, data: null, error: "" });

    try {
      const data = await adminService.getBillDetails(id);
      setSelectedBill({ loading: false, data, error: "" });
    } catch (error) {
      setSelectedBill({ loading: false, data: null, error: getErrorMessage(error) });
    }
  };

  const handleReverseBill = async (id: string) => {
    setReversingId(id);

    try {
      await adminService.failReverseBill(id);
      const billHistory = billServiceType === "all"
        ? await adminService.getBillHistory()
        : await adminService.getBillHistoryByServiceType(billServiceType);

      if (dashboardData) {
        setDashboardData({ ...dashboardData, billHistory });
      }
    } finally {
      setReversingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const billVolume = sumRows(billRows, ["amount", "billAmount", "total", "totalAmount"]);
  const depositVolume = sumRows(depositRows, ["amount", "creditAmount", "totalAmount"]);
  const executiveCards = [
    { label: "Bill transaction value", value: formatCurrency(billVolume), detail: `${billRows.length} records loaded`, icon: FileText },
    { label: "Deposit inflow", value: formatCurrency(depositVolume), detail: `${depositRows.length} deposits loaded`, icon: WalletCards },
    { label: "Recent loans", value: formatValue(recentLoans.length), detail: "Latest loan activity", icon: CreditCard },
    { label: "Recent bill activity", value: formatValue(recentBills.length), detail: "Latest bill events", icon: Activity },
  ];

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Operations Dashboard
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Real-time monitoring of financial flows and system health.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-slate-950/40">
              {[
                { key: "overview", label: "Overview", icon: Activity },
                { key: "bills", label: "Bills", icon: CreditCard },
                { key: "deposits", label: "Deposits", icon: WalletCards },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key as ActiveSection)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-all ${
                    activeSection === key
                      ? "bg-[#069AFF] text-white shadow-sm shadow-[#069AFF]/30"
                      : "text-slate-600 hover:bg-white hover:text-[#069AFF] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-sky-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
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
        {!dashboardData ? (
          <LoadingDashboard />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    System online
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Official command view for bills, deposits, loans, and customer finance operations.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Monitor financial movement, review transaction history, and act on failed bill reversals from one controlled administrative workspace.
                  </p>
                </div>
                <div className="rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-5 shadow-lg shadow-[#069AFF]/10">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Loaded records</p>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      ["Bills", billRows.length],
                      ["Deposits", depositRows.length],
                      ["Loans", recentLoans.length],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-white/10 bg-white/[0.08] p-4 text-center">
                        <p className="text-2xl font-bold">{formatValue(value)}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {endpointErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Some endpoints did not respond.</p>
                    <p className="mt-1">{endpointErrors.map(([key]) => formatLabel(key)).join(", ")}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "overview" && (
              <div className="grid gap-6">
                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {executiveCards.map((card) => (
                    <ExecutiveCard key={card.label} {...card} />
                  ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <MetricsPanel title="Loans statistics" metrics={loansMetrics.length ? loansMetrics : overviewMetrics} />
                  <MetricsPanel title="Bills statistics" metrics={billsMetrics} />
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
                  <FinancialTrendChart data={trendData} />
                  <StatusDonutChart data={statusMix} />
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <BillHistoryTable
                    rows={billRows.slice(0, 8)}
                    onView={handleViewBill}
                    onReverse={handleReverseBill}
                    reversingId={reversingId}
                  />
                  <DepositsTable rows={depositRows.slice(0, 8)} onView={setSelectedDeposit} />
                </section>
              </div>
            )}

            {activeSection === "bills" && (
              <div className="grid gap-4">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">Service type filter</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Uses `/admin/bill/history/:serviceType` when selected.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["all", ...serviceTypes].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleServiceFilter(type)}
                          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
                            billServiceType === type
                              ? "bg-[#069AFF] text-white shadow-sm shadow-[#069AFF]/25 dark:bg-[#069AFF] dark:text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          }`}
                        >
                          {type === "all" ? "All services" : type}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
                <BillHistoryTable
                  rows={billRows}
                  onView={handleViewBill}
                  onReverse={handleReverseBill}
                  reversingId={reversingId}
                />
              </div>
            )}

            {activeSection === "deposits" && <DepositsTable rows={depositRows} onView={setSelectedDeposit} />}
          </>
        )}
      </div>

      {selectedBill && (
        <DetailModal
          title="Bill details"
          data={selectedBill.data}
          loading={selectedBill.loading}
          error={selectedBill.error}
          onClose={() => setSelectedBill(null)}
        />
      )}

      {selectedDeposit && (
        <DetailModal
          title="Deposit details"
          data={selectedDeposit}
          loading={false}
          error=""
          onClose={() => setSelectedDeposit(null)}
        />
      )}
    </main>
  );
}
