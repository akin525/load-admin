"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { TablePagination, paginateItems } from "@/components/TablePagination";
import { AccessDeniedState } from "@/components/AccessDeniedState";

type ReportKey = "billProfit" | "financial" | "loanPerformance" | "payinPayoutProfit" | "profitLoss" | "revenue";

type ReportFilters = {
  fromDate: string;
  toDate: string;
  groupBy: "daily" | "weekly" | "monthly";
};

type ReportState = {
  data: Partial<Record<ReportKey, unknown>>;
  errors: Partial<Record<ReportKey, string>>;
  loaded: boolean;
  loading: boolean;
};

type ReportCenterState = {
  payload: unknown;
  metrics: Array<{ label: string; value: string }>;
  error: string;
};

type ReportExportType =
  | "dashboard-summary"
  | "bill-profit"
  | "reconciliation-overview"
  | "financial"
  | "loan-performance"
  | "payin-payout-profit"
  | "profit-loss"
  | "revenue";

const reportRequests: Array<[ReportKey, (params: Record<string, string>) => Promise<unknown>]> = [
  ["billProfit", adminService.getBillProfitReport],
  ["financial", adminService.getFinancialReport],
  ["loanPerformance", adminService.getLoanPerformanceReport],
  ["payinPayoutProfit", adminService.getPayinPayoutProfitReport],
  ["profitLoss", adminService.getProfitLossReport],
  ["revenue", adminService.getRevenueReport],
];

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

const getRecordValue = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) {
    return undefined;
  }

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
    groupBy: "daily",
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

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

const fetchReports = async (filters: ReportFilters): Promise<ReportState> => {
  const params: Record<string, string> = {};

  if (filters.fromDate) {
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    params.toDate = filters.toDate;
  }

  if (filters.groupBy) {
    params.groupBy = filters.groupBy;
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

const fetchReportCenter = async (filters: ReportFilters): Promise<ReportCenterState> => {
  const params: Record<string, string> = {};

  if (filters.fromDate) {
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    params.toDate = filters.toDate;
  }

  if (filters.groupBy) {
    params.groupBy = filters.groupBy;
  }

  try {
    const payload = await adminService.getReportCenter(params);

    return {
      payload,
      metrics: extractReportMetrics(payload).slice(0, 6),
      error: "",
    };
  } catch (error) {
    return {
      payload: null,
      metrics: [],
      error: getErrorMessage(error),
    };
  }
};

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#069AFF]/40 hover:shadow-lg hover:shadow-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/40">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      {detail && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{detail}</p>}
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
  icon: typeof ShieldCheck;
}) {
  const metrics = extractReportMetrics(payload);
  const details = extractReportDetails(payload);
  const rows = extractRows(payload);
  const columns = getReportColumns(rows);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

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
                  {paginatedRows.map((row, index) => (
                    <tr key={`${index}-${columns.join("-")}`} className="text-slate-700 dark:text-slate-300">
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
            <TablePagination
              totalItems={rows.length}
              currentPage={safeCurrentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setCurrentPage(1);
              }}
              label="rows"
            />
          </div>
        )}

        {!error && !metrics.length && !details.length && !rows.length && <EmptyPanel label="No report data returned for this period." />}
      </div>
    </section>
  );
}

function getPayinPayoutProfitSection(
  payload: unknown,
  sectionKey: "payin" | "payout" | "combined",
): { summary: Record<string, unknown> | null; timeline: Record<string, unknown>[] } {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return { summary: null, timeline: [] };
  }

  const section = getRecordValue(data, [sectionKey]);
  if (!isRecord(section)) {
    return { summary: null, timeline: [] };
  }

  const summary = getRecordValue(section, ["summary"]);
  const timeline = getRecordValue(section, ["timeline"]);

  return {
    summary: isRecord(summary) ? summary : null,
    timeline: Array.isArray(timeline) ? timeline.filter(isRecord) : [],
  };
}

function getPayinPayoutPeriod(payload: unknown) {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return null;
  }

  const period = getRecordValue(data, ["period"]);
  return isRecord(period) ? period : null;
}

function PayinPayoutProfitPanel({
  payload,
  error,
}: {
  payload: unknown;
  error?: string;
}) {
  const period = getPayinPayoutPeriod(payload);
  const payin = getPayinPayoutProfitSection(payload, "payin");
  const payout = getPayinPayoutProfitSection(payload, "payout");
  const combined = getPayinPayoutProfitSection(payload, "combined");

  const sections = [
    { key: "payin", title: "Payin", data: payin, icon: WalletCards },
    { key: "payout", title: "Payout", data: payout, icon: CreditCard },
    { key: "combined", title: "Combined", data: combined, icon: BarChart3 },
  ] as const;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30 xl:col-span-2">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">Payin / Payout Profit</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Customer fee, provider fee, and profit by flow</h3>
          {period && (
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {String(getRecordValue(period, ["fromDate"]) ?? "N/A")} to {String(getRecordValue(period, ["toDate"]) ?? "N/A")} / {String(getRecordValue(period, ["groupBy"]) ?? "daily")}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-5 p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}

        {!error && sections.map((section) => (
          <div key={section.key} className="rounded-lg border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
                <section.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h4 className="font-bold text-slate-950 dark:text-white">{section.title}</h4>
            </div>

            <div className="grid gap-4 p-4">
              {section.data.summary ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {(["count", "totalAmount", "totalCustomerFee", "totalProviderFee", "totalProfit"] as const).map((key) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                        {/(amount|fee|profit)/i.test(key)
                          ? formatCurrency(getRecordValue(section.data.summary, [key]))
                          : formatValue(getRecordValue(section.data.summary, [key]))}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel label={`No ${section.title.toLowerCase()} summary returned for this period.`} />
              )}

              {section.data.timeline.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                        <tr>
                          {["Period", "Count", "Amount", "Customer Fee", "Provider Fee", "Profit"].map((column) => (
                            <th key={column} className="px-4 py-3">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {section.data.timeline.map((row, index) => (
                          <tr key={`${section.key}-${index}`} className="text-slate-700 dark:text-slate-300">
                            <td className="px-4 py-3 font-medium">
                              {String(getRecordValue(row, ["period", "date", "label", "bucket"]) ?? "Not available")}
                            </td>
                            <td className="px-4 py-3">{formatValue(getRecordValue(row, ["count"]))}</td>
                            <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalAmount", "amount"]))}</td>
                            <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalCustomerFee", "customerFeeAmount"]))}</td>
                            <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalProviderFee", "providerFeeAmount"]))}</td>
                            <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["totalProfit", "expectedProfitAmount", "profitAmount"]))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyPanel label={`No ${section.title.toLowerCase()} timeline returned for this period.`} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getBillProfitData(payload: unknown) {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return {
      period: null as Record<string, unknown> | null,
      totals: null as Record<string, unknown> | null,
      byServiceType: [] as Record<string, unknown>[],
      entries: [] as Record<string, unknown>[],
    };
  }

  return {
    period: isRecord(getRecordValue(data, ["period"])) ? (getRecordValue(data, ["period"]) as Record<string, unknown>) : null,
    totals: isRecord(getRecordValue(data, ["totals"])) ? (getRecordValue(data, ["totals"]) as Record<string, unknown>) : null,
    byServiceType: Array.isArray(getRecordValue(data, ["byServiceType"])) ? (getRecordValue(data, ["byServiceType"]) as unknown[]).filter(isRecord) : [],
    entries: Array.isArray(getRecordValue(data, ["entries"])) ? (getRecordValue(data, ["entries"]) as unknown[]).filter(isRecord) : [],
  };
}

function getFinancialReportData(payload: unknown) {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return {
      period: null as Record<string, unknown> | null,
      appLoans: null as Record<string, unknown> | null,
      walletTransactions: [] as Record<string, unknown>[],
      bills: [] as Record<string, unknown>[],
      walletBalances: [] as Record<string, unknown>[],
      billLedger: null as Record<string, unknown> | null,
    };
  }

  return {
    period: isRecord(getRecordValue(data, ["period"])) ? (getRecordValue(data, ["period"]) as Record<string, unknown>) : null,
    appLoans: isRecord(getRecordValue(data, ["appLoans"])) ? (getRecordValue(data, ["appLoans"]) as Record<string, unknown>) : null,
    walletTransactions: Array.isArray(getRecordValue(data, ["walletTransactions"])) ? (getRecordValue(data, ["walletTransactions"]) as unknown[]).filter(isRecord) : [],
    bills: Array.isArray(getRecordValue(data, ["bills"])) ? (getRecordValue(data, ["bills"]) as unknown[]).filter(isRecord) : [],
    walletBalances: Array.isArray(getRecordValue(data, ["walletBalances"])) ? (getRecordValue(data, ["walletBalances"]) as unknown[]).filter(isRecord) : [],
    billLedger: isRecord(getRecordValue(data, ["billLedger"])) ? (getRecordValue(data, ["billLedger"]) as Record<string, unknown>) : null,
  };
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function BillProfitPanel({
  payload,
  error,
}: {
  payload: unknown;
  error?: string;
}) {
  const report = getBillProfitData(payload);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const paginatedEntries = paginateItems(report.entries, currentPage, pageSize);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30 xl:col-span-2">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">Bill profit</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Provider commission, realized revenue, and bill-level profit</h3>
          {report.period && (
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {String(getRecordValue(report.period, ["fromDate"]) ?? "N/A")} to {String(getRecordValue(report.period, ["toDate"]) ?? "N/A")}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-5 p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}

        {!error && report.totals && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CompactMetric label="Entries" value={formatValue(getRecordValue(report.totals, ["totalEntries"]))} />
            <CompactMetric label="Successful" value={formatValue(getRecordValue(report.totals, ["successfulEntries"]))} />
            <CompactMetric label="Bill Amount" value={formatCurrency(getRecordValue(report.totals, ["totalBillAmount"]))} />
            <CompactMetric label="Provider Margin" value={formatCurrency(getRecordValue(report.totals, ["totalProviderMargin"]))} />
            <CompactMetric label="Total Profit" value={formatCurrency(getRecordValue(report.totals, ["totalProfit"]))} />
          </div>
        )}

        {!error && report.byServiceType.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <h4 className="font-bold text-slate-950 dark:text-white">By service type</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {["Service", "Entries", "Success", "Failed", "Bill Amount", "Provider Cost", "Provider Margin", "Revenue", "Profit"].map((column) => (
                      <th key={column} className="px-4 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {report.byServiceType.map((row, index) => (
                    <tr key={`${String(getRecordValue(row, ["serviceType"]) ?? "service")}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["serviceType"]) ?? "Not available")}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["totalEntries"]))}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["successfulEntries"]))}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["failedEntries"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalBillAmount"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalProviderCost"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalProviderMargin"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalRevenue"]))}</td>
                      <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["totalProfit"]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!error && report.entries.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <h4 className="font-bold text-slate-950 dark:text-white">Ledger entries</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {["Reference", "Service", "Status", "Bill Amount", "Provider Commission", "Provider Cost", "Profit", "Created"].map((column) => (
                      <th key={column} className="px-4 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {paginatedEntries.map((row, index) => (
                    <tr key={`${String(getRecordValue(row, ["_id", "reference"]) ?? "entry")}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["reference"]) ?? "Not available")}</td>
                      <td className="px-4 py-3">{String(getRecordValue(row, ["serviceType"]) ?? "Not available")}</td>
                      <td className="px-4 py-3">{String(getRecordValue(row, ["status"]) ?? "Not available")}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["billAmount", "grossAmount"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["providerCommissionAmount"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["providerCostAmount"]))}</td>
                      <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["realizedProfitAmount"]))}</td>
                      <td className="px-4 py-3">{formatDate(getRecordValue(row, ["createdAt"]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={report.entries.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setCurrentPage(1);
              }}
              label="entries"
            />
          </div>
        )}

        {!error && !report.totals && !report.byServiceType.length && !report.entries.length && (
          <EmptyPanel label="No bill-profit data returned for this period." />
        )}
      </div>
    </section>
  );
}

function FinancialReportPanel({
  payload,
  error,
}: {
  payload: unknown;
  error?: string;
}) {
  const report = getFinancialReportData(payload);
  const billLedgerTotals = report.billLedger && isRecord(getRecordValue(report.billLedger, ["totals"])) ? (getRecordValue(report.billLedger, ["totals"]) as Record<string, unknown>) : null;
  const billLedgerByServiceType = report.billLedger && Array.isArray(getRecordValue(report.billLedger, ["byServiceType"]))
    ? (getRecordValue(report.billLedger, ["byServiceType"]) as unknown[]).filter(isRecord)
    : [];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30 xl:col-span-2">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">Financial report</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Loans, balances, bill outcomes, and embedded bill-ledger profit</h3>
          {report.period && (
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {String(getRecordValue(report.period, ["fromDate"]) ?? "N/A")} to {String(getRecordValue(report.period, ["toDate"]) ?? "N/A")}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-5 p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}

        {!error && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CompactMetric label="App Loans" value={formatValue(getRecordValue(report.appLoans, ["totalAppLoans"]))} />
            <CompactMetric label="App Loan Amount" value={formatCurrency(getRecordValue(report.appLoans, ["totalAppLoanAmount"]))} />
            <CompactMetric label="App Loan Repaid" value={formatCurrency(getRecordValue(report.appLoans, ["totalAppLoanRepaid"]))} />
            <CompactMetric label="Outstanding" value={formatCurrency(getRecordValue(report.appLoans, ["totalAppLoanOutstanding"]))} />
            <CompactMetric label="Bill Ledger Profit" value={formatCurrency(getRecordValue(billLedgerTotals, ["totalProfit"]))} />
          </div>
        )}

        {!error && (
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <h4 className="font-bold text-slate-950 dark:text-white">Wallet transactions</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {report.walletTransactions.map((row, index) => (
                      <tr key={`${String(getRecordValue(row, ["_id"]) ?? "txn")}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["_id"]) ?? "Not available")}</td>
                        <td className="px-4 py-3">{formatValue(getRecordValue(row, ["count"]))}</td>
                        <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalAmount"]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <h4 className="font-bold text-slate-950 dark:text-white">Bills by status</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {report.bills.map((row, index) => (
                      <tr key={`${String(getRecordValue(row, ["_id"]) ?? "bill")}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["_id"]) ?? "unspecified")}</td>
                        <td className="px-4 py-3">{formatValue(getRecordValue(row, ["count"]))}</td>
                        <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalAmount"]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <h4 className="font-bold text-slate-950 dark:text-white">Wallet balances</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Wallet</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {report.walletBalances.map((row, index) => (
                      <tr key={`${String(getRecordValue(row, ["_id"]) ?? "wallet")}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["_id"]) ?? "Not available")}</td>
                        <td className="px-4 py-3">{formatValue(getRecordValue(row, ["count"]))}</td>
                        <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalBalance"]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!error && billLedgerByServiceType.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <h4 className="font-bold text-slate-950 dark:text-white">Embedded bill-ledger profit</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {["Service", "Entries", "Success", "Failed", "Bill Amount", "Provider Cost", "Provider Margin", "Profit"].map((column) => (
                      <th key={column} className="px-4 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {billLedgerByServiceType.map((row, index) => (
                    <tr key={`${String(getRecordValue(row, ["serviceType"]) ?? "embedded")}-${index}`}>
                      <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["serviceType"]) ?? "Not available")}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["totalEntries"]))}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["successfulEntries"]))}</td>
                      <td className="px-4 py-3">{formatValue(getRecordValue(row, ["failedEntries"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalBillAmount"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalProviderCost"]))}</td>
                      <td className="px-4 py-3">{formatCurrency(getRecordValue(row, ["totalProviderMargin"]))}</td>
                      <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["totalProfit"]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!error &&
          !report.appLoans &&
          !report.walletTransactions.length &&
          !report.bills.length &&
          !report.walletBalances.length &&
          !billLedgerByServiceType.length && <EmptyPanel label="No financial report data returned for this period." />}
      </div>
    </section>
  );
}

function buildCardDetail(count: unknown, amount: unknown, countLabel = "entries") {
  const hasCount = isNumericLike(count);
  const hasAmount = isNumericLike(amount);

  if (hasCount && hasAmount) {
    return `${formatValue(count)} ${countLabel} / ${formatCurrency(amount)} total value`;
  }

  if (hasCount) {
    return `${formatValue(count)} ${countLabel}`;
  }

  if (hasAmount) {
    return `${formatCurrency(amount)} total value`;
  }

  return undefined;
}

function LoadingReports() {
  return (
    <div className="grid gap-5">
      <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenReports } = useRouteAccess("/reports");
  const [reportFilters, setReportFilters] = useState<ReportFilters>(() => getDefaultReportFilters());
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => getDefaultReportFilters());
  const [reports, setReports] = useState<ReportState>({
    data: {},
    errors: {},
    loaded: false,
    loading: false,
  });
  const [reportCenter, setReportCenter] = useState<ReportCenterState>({
    payload: null,
    metrics: [],
    error: "",
  });
  const [exporting, setExporting] = useState<ReportExportType | null>(null);
  const [exportError, setExportError] = useState("");
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenReports) {
      return;
    }

    void Promise.all([fetchReports(appliedFilters), fetchReportCenter(appliedFilters)]).then(([reportResult, centerResult]) => {
      if (!cancelled) {
        setReports(reportResult);
        setReportCenter(centerResult);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, canOpenReports, router]);

  const refreshReports = async (filters = appliedFilters) => {
    setReports((current) => ({ ...current, loading: true }));
    const [reportResult, centerResult] = await Promise.all([fetchReports(filters), fetchReportCenter(filters)]);
    setReports(reportResult);
    setReportCenter(centerResult);
  };

  const financialLead = useMemo(() => getReportLead(reports.data.financial), [reports.data.financial]);
  const billProfitTotals = useMemo(() => getBillProfitData(reports.data.billProfit).totals, [reports.data.billProfit]);
  const billProfitLead = useMemo(() => {
    if (billProfitTotals) {
      return {
        label: "Total Profit",
        value: formatCurrency(getRecordValue(billProfitTotals, ["totalProfit"])),
      };
    }

    return getReportLead(reports.data.billProfit);
  }, [billProfitTotals, reports.data.billProfit]);
  const loanPerformanceLead = useMemo(() => getReportLead(reports.data.loanPerformance), [reports.data.loanPerformance]);
  const payinPayoutLead = useMemo(() => {
    const combined = getPayinPayoutProfitSection(reports.data.payinPayoutProfit, "combined").summary;
    if (combined) {
      return {
        label: "Combined Total Profit",
        value: formatCurrency(getRecordValue(combined, ["totalProfit"])),
      };
    }

    return getReportLead(reports.data.payinPayoutProfit);
  }, [reports.data.payinPayoutProfit]);
  const payinPayoutCombined = useMemo(() => getPayinPayoutProfitSection(reports.data.payinPayoutProfit, "combined").summary, [reports.data.payinPayoutProfit]);
  const financialData = useMemo(() => getFinancialReportData(reports.data.financial), [reports.data.financial]);
  const combinedOperationalProfit = useMemo(() => {
    const billProfitValue = Number(getRecordValue(billProfitTotals, ["totalProfit"]) ?? 0);
    const payinPayoutValue = Number(getRecordValue(payinPayoutCombined, ["totalProfit"]) ?? 0);
    return formatCurrency((Number.isNaN(billProfitValue) ? 0 : billProfitValue) + (Number.isNaN(payinPayoutValue) ? 0 : payinPayoutValue));
  }, [billProfitTotals, payinPayoutCombined]);
  const profitLossLead = useMemo(() => getReportLead(reports.data.profitLoss), [reports.data.profitLoss]);
  const revenueLead = useMemo(() => getReportLead(reports.data.revenue), [reports.data.revenue]);
  const combinedOperationalDetail = useMemo(() => {
    const totalCount =
      Number(getRecordValue(billProfitTotals, ["totalEntries"]) ?? 0) +
      Number(getRecordValue(payinPayoutCombined, ["count"]) ?? 0);
    const totalAmount =
      Number(getRecordValue(billProfitTotals, ["totalBillAmount"]) ?? 0) +
      Number(getRecordValue(payinPayoutCombined, ["totalAmount"]) ?? 0);
    return buildCardDetail(totalCount, totalAmount, "entries");
  }, [billProfitTotals, payinPayoutCombined]);
  const billProfitDetail = useMemo(
    () => buildCardDetail(getRecordValue(billProfitTotals, ["totalEntries"]), getRecordValue(billProfitTotals, ["totalBillAmount"]), "entries"),
    [billProfitTotals],
  );
  const payinPayoutDetail = useMemo(
    () => buildCardDetail(getRecordValue(payinPayoutCombined, ["count"]), getRecordValue(payinPayoutCombined, ["totalAmount"]), "transactions"),
    [payinPayoutCombined],
  );
  const financialDetail = useMemo(
    () =>
      buildCardDetail(
        getRecordValue(financialData.appLoans, ["totalAppLoans"]),
        getRecordValue(financialData.appLoans, ["totalAppLoanAmount"]),
        "loans",
      ),
    [financialData],
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const handleExport = async (type: ReportExportType) => {
    setExporting(type);
    setExportError("");

    try {
      const result = await adminService.downloadReportExport(type, appliedFilters);
      downloadBlob(result.blob, result.filename);
    } catch (error) {
      setExportError(getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  if (!canOpenReports) {
    return (
      <AccessDeniedState
        title="Reports access denied"
        description="Your current admin role does not include permission to view management reports."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Strategic Reports
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Detailed analysis and exportable records for financial and operational performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAppliedFilters(reportFilters);
                void refreshReports(reportFilters);
              }}
              disabled={reports.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {reports.loading ? (
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
        {!reports.loaded ? (
          <LoadingReports />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    Executive reporting workspace
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Standalone financial reporting for management review, audit visibility, and portfolio control.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Review financial, revenue, loan performance, and profit-and-loss reports from a dedicated workspace instead of loading them inside the admin operations page.
                    Review financial, revenue, loan performance, bill-profit, and profit-and-loss reports from a dedicated workspace instead of loading them inside the admin operations page.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Group by</span>
                      <select
                        value={reportFilters.groupBy}
                        onChange={(event) => setReportFilters((current) => ({ ...current, groupBy: event.target.value as "daily" | "weekly" | "monthly" }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedFilters(reportFilters);
                        void refreshReports(reportFilters);
                      }}
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
                        setAppliedFilters(defaults);
                        void refreshReports(defaults);
                      }}
                      disabled={reports.loading}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-[#041628]/55 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-100">Report center</p>
                      <p className="mt-1 text-sm font-medium text-slate-200">
                        Backend summary and export center for {appliedFilters.fromDate || "N/A"} to {appliedFilters.toDate || "N/A"}
                      </p>
                    </div>
                    {reportCenter.metrics.length > 0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {reportCenter.metrics.map((metric) => (
                          <div key={metric.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-100">{metric.label}</p>
                            <p className="mt-2 text-lg font-bold text-white">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {reportCenter.error && (
                      <div className="mt-4 flex gap-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{reportCenter.error}</span>
                      </div>
                    )}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          { key: "dashboard-summary", label: "Dashboard summary" },
                          { key: "bill-profit", label: "Bill profit" },
                          { key: "reconciliation-overview", label: "Reconciliation overview" },
                          { key: "financial", label: "Financial" },
                          { key: "loan-performance", label: "Loan performance" },
                          { key: "payin-payout-profit", label: "Payin / payout profit" },
                          { key: "profit-loss", label: "Profit & loss" },
                          { key: "revenue", label: "Revenue" },
                        ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => void handleExport(item.key as ReportExportType)}
                          disabled={!reports.loaded || reports.loading || exporting !== null}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {exporting === item.key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                          Export {item.label}
                        </button>
                      ))}
                    </div>
                    {exportError && (
                      <div className="mt-4 flex gap-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{exportError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Combined Operational Profit" value={combinedOperationalProfit} detail={combinedOperationalDetail} icon={BarChart3} />
              <SummaryCard label={`Bill Profit - ${billProfitLead.label}`} value={billProfitLead.value} detail={billProfitDetail} icon={FileText} />
              <SummaryCard label={`Payin / Payout - ${payinPayoutLead.label}`} value={payinPayoutLead.value} detail={payinPayoutDetail} icon={BarChart3} />
              <SummaryCard label={`Financial - ${financialLead.label}`} value={financialLead.value} detail={financialDetail} icon={Landmark} />
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <PayinPayoutProfitPanel
                payload={reports.data.payinPayoutProfit}
                error={reports.errors.payinPayoutProfit}
              />
              <BillProfitPanel payload={reports.data.billProfit} error={reports.errors.billProfit} />
              <FinancialReportPanel payload={reports.data.financial} error={reports.errors.financial} />
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
          </>
        )}
      </div>
    </main>
  );
}

