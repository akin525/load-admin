"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type ReconciliationFilters = {
  fromDate: string;
  toDate: string;
};

type ReconciliationState = {
  overview: unknown;
  deposits: unknown;
  transfers: unknown;
  webhooks: unknown;
  errors: Partial<Record<"overview" | "deposits" | "transfers" | "webhooks", string>>;
  loaded: boolean;
  loading: boolean;
};

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

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim().length <= 16) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
    }
    return value;
  }

  return String(value);
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

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;

    if (isRecord(payload) && typeof payload.message === "string") {
      return payload.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): ReconciliationFilters => {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
  };
};

const buildParams = (filters: ReconciliationFilters) => {
  const params: Record<string, string> = {};

  if (filters.fromDate) {
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    params.toDate = filters.toDate;
  }

  return params;
};

const collectMetrics = (payload: unknown, prefix = "", depth = 0): Array<{ label: string; value: string }> => {
  const value = unwrapPayload(payload);

  if (!isRecord(value) || depth > 2) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    const label = prefix ? `${prefix} ${formatLabel(key)}` : formatLabel(key);

    if (typeof entry === "number" || typeof entry === "string") {
      const numeric = typeof entry === "string" ? Number(entry) : entry;

      if (typeof entry === "number" || (!Number.isNaN(numeric) && entry.trim().length <= 16)) {
        return [{ label, value: formatValue(entry) }];
      }
    }

    if (isRecord(entry)) {
      return collectMetrics(entry, label, depth + 1);
    }

    return [];
  });
};

const fetchReconciliation = async (filters: ReconciliationFilters): Promise<ReconciliationState> => {
  const params = buildParams(filters);
  const [overview, deposits, transfers, webhooks] = await Promise.allSettled([
    adminService.getReconciliationOverview(params),
    adminService.getReconciliationDeposits(params),
    adminService.getReconciliationTransfers(params),
    adminService.getReconciliationWebhooks(params),
  ]);

  return {
    overview: overview.status === "fulfilled" ? overview.value : null,
    deposits: deposits.status === "fulfilled" ? deposits.value : null,
    transfers: transfers.status === "fulfilled" ? transfers.value : null,
    webhooks: webhooks.status === "fulfilled" ? webhooks.value : null,
    errors: {
      overview: overview.status === "rejected" ? getErrorMessage(overview.reason) : undefined,
      deposits: deposits.status === "rejected" ? getErrorMessage(deposits.reason) : undefined,
      transfers: transfers.status === "rejected" ? getErrorMessage(transfers.reason) : undefined,
      webhooks: webhooks.status === "rejected" ? getErrorMessage(webhooks.reason) : undefined,
    },
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function DataTable({
  title,
  description,
  rows,
  error,
  onView,
}: {
  title: string;
  description: string;
  rows: Record<string, unknown>[];
  error?: string;
  onView: (row: Record<string, unknown>) => void;
}) {
  const columns = useMemo(() => {
    const firstRow = rows[0];

    if (!firstRow) {
      return [] as string[];
    }

    return Object.keys(firstRow).filter((key) => !isRecord(firstRow[key]) && !Array.isArray(firstRow[key])).slice(0, 6);
  }, [rows]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">{title}</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{description}</h3>
        </div>
      </div>
      <div className="grid gap-4 p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}
        {!error && rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3">{formatLabel(column)}</th>
                    ))}
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {paginatedRows.map((row, index) => (
                    <tr key={`${index}-${title}`} className="text-slate-700 dark:text-slate-300">
                      {columns.map((column) => (
                        <td key={`${column}-${index}`} className="px-4 py-3 font-medium">
                          {/date|at/i.test(column) ? formatDate(row[column]) : formatValue(row[column])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onView(row)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View
                        </button>
                      </td>
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
            />
          </div>
        )}
        {!error && !rows.length && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
            No records returned for this dataset.
          </div>
        )}
      </div>
    </section>
  );
}

function DetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Reconciliation record</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {String(row.reference ?? row.requestId ?? row._id ?? "Selected record")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed } = useRouteAccess("/reconciliation");
  const [filters, setFilters] = useState<ReconciliationFilters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<ReconciliationFilters>(() => getDefaultFilters());
  const [state, setState] = useState<ReconciliationState>({
    overview: null,
    deposits: null,
    transfers: null,
    webhooks: null,
    errors: {},
    loaded: false,
    loading: false,
  });
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!allowed) {
      return;
    }

    void fetchReconciliation(appliedFilters).then((result) => {
      if (!cancelled) {
        setState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [allowed, appliedFilters, router]);

  const refresh = async (nextFilters = appliedFilters) => {
    setState((current) => ({ ...current, loading: true }));
    const result = await fetchReconciliation(nextFilters);
    setState(result);
  };

  const overviewMetrics = useMemo(() => collectMetrics(state.overview).slice(0, 8), [state.overview]);
  const depositRows = useMemo(() => extractRows(state.deposits), [state.deposits]);
  const transferRows = useMemo(() => extractRows(state.transfers), [state.transfers]);
  const webhookRows = useMemo(() => extractRows(state.webhooks), [state.webhooks]);

  if (!allowed) {
    return (
      <AccessDeniedState
        title="Reconciliation access denied"
        description="Your current admin role does not include reconciliation visibility."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Reconciliation</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Deposits, transfers, webhooks, and operational gaps from the new reconciliation endpoints.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/action-requests"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Action requests
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={state.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {state.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Sync
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] p-6 text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                <Landmark className="h-4 w-4" aria-hidden="true" />
                Reconciliation workspace
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight">Validate cash movement against provider and webhook records.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Use this workspace to compare deposits, transfers, and webhook streams without leaving the admin surface.
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4">
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">From date</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">To date</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppliedFilters(filters);
                    void refresh(filters);
                  }}
                  disabled={state.loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-70"
                >
                  {state.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  Apply range
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = getDefaultFilters();
                    setFilters(defaults);
                    setAppliedFilters(defaults);
                    void refresh(defaults);
                  }}
                  disabled={state.loading}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Overview metrics" value={formatValue(overviewMetrics.length)} icon={ShieldCheck} />
          <SummaryCard label="Deposit rows" value={formatValue(depositRows.length)} icon={WalletCards} />
          <SummaryCard label="Transfer rows" value={formatValue(transferRows.length)} icon={Landmark} />
          <SummaryCard label="Webhook rows" value={formatValue(webhookRows.length)} icon={FileText} />
        </section>

        {state.errors.overview && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{state.errors.overview}</span>
            </div>
          </div>
        )}

        {overviewMetrics.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{metric.value}</p>
              </div>
            ))}
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <DataTable title="Deposits" description="Reconciliation deposit stream" rows={depositRows} error={state.errors.deposits} onView={setSelectedRow} />
          <DataTable title="Transfers" description="Reconciliation transfer stream" rows={transferRows} error={state.errors.transfers} onView={setSelectedRow} />
        </div>

        <DataTable title="Webhooks" description="Webhook reconciliation stream" rows={webhookRows} error={state.errors.webhooks} onView={setSelectedRow} />
      </div>

      {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </main>
  );
}
