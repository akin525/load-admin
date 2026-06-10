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
  FileSpreadsheet,
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
import { exportReportsToExcel, exportReportsToPdf } from "@/lib/reports/export";

type ReportKey = "financial" | "loanPerformance" | "profitLoss" | "revenue";

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

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
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
          </div>
        )}

        {!error && !metrics.length && !details.length && !rows.length && <EmptyPanel label="No report data returned for this period." />}
      </div>
    </section>
  );
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
  const [reportFilters, setReportFilters] = useState<ReportFilters>(() => getDefaultReportFilters());
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => getDefaultReportFilters());
  const [reports, setReports] = useState<ReportState>({
    data: {},
    errors: {},
    loaded: false,
    loading: false,
  });
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [exportError, setExportError] = useState("");
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    void fetchReports(appliedFilters).then((result) => {
      if (!cancelled) {
        setReports(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, router]);

  const refreshReports = async (filters = appliedFilters) => {
    setReports((current) => ({ ...current, loading: true }));
    const result = await fetchReports(filters);
    setReports(result);
  };

  const financialLead = useMemo(() => getReportLead(reports.data.financial), [reports.data.financial]);
  const loanPerformanceLead = useMemo(() => getReportLead(reports.data.loanPerformance), [reports.data.loanPerformance]);
  const profitLossLead = useMemo(() => getReportLead(reports.data.profitLoss), [reports.data.profitLoss]);
  const revenueLead = useMemo(() => getReportLead(reports.data.revenue), [reports.data.revenue]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(type);
    setExportError("");

    try {
      if (type === "pdf") {
        await exportReportsToPdf(reports.data, appliedFilters);
      } else {
        await exportReportsToExcel(reports.data, appliedFilters);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

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
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-100">Export pack</p>
                      <p className="mt-1 text-sm font-medium text-slate-200">
                        Branded management report for {appliedFilters.fromDate || "N/A"} to {appliedFilters.toDate || "N/A"}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void handleExport("pdf")}
                        disabled={!reports.loaded || reports.loading || exporting !== null}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExport("excel")}
                        disabled={!reports.loaded || reports.loading || exporting !== null}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                        Export Excel
                      </button>
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
              <SummaryCard label={`Financial - ${financialLead.label}`} value={financialLead.value} icon={Landmark} />
              <SummaryCard label={`Loan Performance - ${loanPerformanceLead.label}`} value={loanPerformanceLead.value} icon={CreditCard} />
              <SummaryCard label={`Profit & Loss - ${profitLossLead.label}`} value={profitLossLead.value} icon={BriefcaseBusiness} />
              <SummaryCard label={`Revenue - ${revenueLead.label}`} value={revenueLead.value} icon={WalletCards} />
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
          </>
        )}
      </div>
    </main>
  );
}

