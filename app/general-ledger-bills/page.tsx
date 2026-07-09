"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  Database,
  Eye,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type LedgerFilters = {
  serviceType: string;
  status: string;
  fromDate: string;
  toDate: string;
  reference: string;
};

type LedgerState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type SummaryState = {
  payload: unknown;
  loading: boolean;
  error: string;
};

type BackfillState = {
  open: boolean;
  fromDate: string;
  toDate: string;
  serviceType: string;
  submitting: boolean;
  error: string;
};

type NoticeState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

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

const getRecordValue = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) {
    return undefined;
  }

  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

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

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response?.data;

    if (isRecord(response) && typeof response.message === "string") {
      return response.message;
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

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): LedgerFilters => {
  const now = new Date();

  return {
    serviceType: "",
    status: "",
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
    reference: "",
  };
};

const getSummaryTotals = (payload: unknown) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return null;
  }

  const totals = getRecordValue(data, ["totals"]);
  return isRecord(totals) ? totals : null;
};

const getSummaryByServiceType = (payload: unknown) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [] as Record<string, unknown>[];
  }

  const rows = getRecordValue(data, ["byServiceType"]);
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
};

const mapMetricValue = (key: string, value: unknown) =>
  /(amount|revenue|profit|margin|cost|fee|balance)/i.test(key) ? formatCurrency(value) : formatValue(value);

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function BackfillModal({
  state,
  onChange,
  onClose,
  onSubmit,
}: {
  state: BackfillState;
  onChange: (field: "fromDate" | "toDate" | "serviceType", value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bill general ledger</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Backfill GL from bills</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Recreate historical bill GL entries for the selected range and product scope.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            aria-label="Close backfill modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">From date</span>
              <input
                type="date"
                value={state.fromDate}
                onChange={(event) => onChange("fromDate", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">To date</span>
              <input
                type="date"
                value={state.toDate}
                onChange={(event) => onChange("toDate", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Service type</span>
            <select
              value={state.serviceType}
              onChange={(event) => onChange("serviceType", event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
            >
              <option value="">All bill products</option>
              <option value="airtime">Airtime</option>
              <option value="data">Data</option>
              <option value="tv">TV</option>
              <option value="electricity">Electricity</option>
            </select>
          </label>

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={state.submitting}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#069AFF] px-4 text-sm font-bold text-white transition hover:bg-[#0583d8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Database className="h-4 w-4" aria-hidden="true" />}
              Start backfill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneralLedgerBillsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed } = useRouteAccess("/general-ledger-bills");
  const [filters, setFilters] = useState<LedgerFilters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<LedgerFilters>(() => getDefaultFilters());
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    payload: null,
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });
  const [summaryState, setSummaryState] = useState<SummaryState>({
    payload: null,
    loading: true,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [backfill, setBackfill] = useState<BackfillState>({
    open: false,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    serviceType: "",
    submitting: false,
    error: "",
  });
  const isDarkMode = resolvedTheme === "dark";

  const queryParams = useMemo(
    () =>
      Object.entries(appliedFilters).reduce<Record<string, string>>((accumulator, [key, value]) => {
        const normalized = value.trim();
        if (normalized) {
          accumulator[key] = normalized;
        }
        return accumulator;
      }, {}),
    [appliedFilters],
  );

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

    void Promise.all([
      adminService.getGeneralLedgerBills(queryParams),
      adminService.getGeneralLedgerBillsSummary(queryParams),
    ])
      .then(([payload, summary]) => {
        if (cancelled) {
          return;
        }

        setLedgerState({
          payload,
          rows: extractRows(payload),
          loading: false,
          loaded: true,
          error: "",
        });
        setSummaryState({
          payload: summary,
          loading: false,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLedgerState({
          payload: null,
          rows: [],
          loading: false,
          loaded: true,
          error: getErrorMessage(error),
        });
        setSummaryState({
          payload: null,
          loading: false,
          error: getErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, queryParams, router]);

  const refresh = async (nextFilters = appliedFilters) => {
    const params = Object.entries(nextFilters).reduce<Record<string, string>>((accumulator, [key, value]) => {
      const normalized = value.trim();
      if (normalized) {
        accumulator[key] = normalized;
      }
      return accumulator;
    }, {});

    setRefreshing(true);
    setLedgerState((current) => ({ ...current, loading: true, error: "" }));
    setSummaryState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [payload, summary] = await Promise.all([
        adminService.getGeneralLedgerBills(params),
        adminService.getGeneralLedgerBillsSummary(params),
      ]);

      setLedgerState({
        payload,
        rows: extractRows(payload),
        loading: false,
        loaded: true,
        error: "",
      });
      setSummaryState({
        payload: summary,
        loading: false,
        error: "",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setLedgerState({
        payload: null,
        rows: [],
        loading: false,
        loaded: true,
        error: message,
      });
      setSummaryState({
        payload: null,
        loading: false,
        error: message,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfill((current) => ({ ...current, submitting: true, error: "" }));
    setNotice(null);

    const payload = Object.entries({
      fromDate: backfill.fromDate.trim(),
      toDate: backfill.toDate.trim(),
      serviceType: backfill.serviceType.trim(),
    }).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});

    try {
      const response = await adminService.backfillGeneralLedgerBills(payload);
      setBackfill((current) => ({ ...current, open: false, submitting: false, error: "" }));
      setNotice({
        tone: "success",
        message: isRecord(response) && typeof response.message === "string" ? response.message : "Bill general-ledger backfill started successfully.",
      });
      await refresh();
    } catch (error) {
      setBackfill((current) => ({ ...current, submitting: false, error: getErrorMessage(error) }));
    }
  };

  const summaryTotals = useMemo(() => getSummaryTotals(summaryState.payload), [summaryState.payload]);
  const summaryMetrics = useMemo(
    () =>
      summaryTotals
        ? Object.entries(summaryTotals).map(([key, value]) => ({
            label: formatLabel(key),
            value: mapMetricValue(key, value),
          }))
        : [],
    [summaryTotals],
  );
  const summaryByServiceType = useMemo(() => getSummaryByServiceType(summaryState.payload), [summaryState.payload]);
  const rows = ledgerState.rows;

  const topCards = useMemo(
    () => [
      { label: "Ledger rows", value: formatValue(rows.length), icon: Database },
      { label: "Summary metrics", value: formatValue(summaryMetrics.length), icon: Landmark },
      { label: "Current product", value: appliedFilters.serviceType ? appliedFilters.serviceType.toUpperCase() : "ALL", icon: FileText },
      { label: "Current status", value: appliedFilters.status ? appliedFilters.status.toUpperCase() : "ALL", icon: WalletCards },
    ],
    [appliedFilters.serviceType, appliedFilters.status, rows.length, summaryMetrics.length],
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  if (!allowed) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8">
        <AccessDeniedState
          title="Bill ledger access denied"
          description="Your current admin role does not include permission to view bill ledger records."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Bill General Ledger</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Product-level bill revenue, margin, provider cost, and realized profit tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reports
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Sync
            </button>
            <button
              type="button"
              onClick={() =>
                setBackfill({
                  open: true,
                  fromDate: appliedFilters.fromDate,
                  toDate: appliedFilters.toDate,
                  serviceType: appliedFilters.serviceType,
                  submitting: false,
                  error: "",
                })
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#069AFF] px-5 text-sm font-bold text-white transition hover:bg-[#0583d8]"
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              Backfill GL
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:border-red-400/20 dark:bg-white/5 dark:text-red-200 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                <Database className="h-4 w-4" aria-hidden="true" />
                Bill product ledger
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Track realized bill revenue, provider cost, and margin by product and reference.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                This workspace surfaces ledger rows created from airtime, data, TV, and electricity bill activity and keeps them aligned with later VTpass outcomes.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
              <div className="grid gap-3 sm:grid-cols-2">
                {summaryMetrics.slice(0, 4).map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4 text-center">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-100">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Ledger filters</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Filter bill GL records</h2>
            </div>
          </div>

          <form
            className="grid items-end gap-3 p-4 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters(filters);
              void refresh(filters);
            }}
          >
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Service type</span>
              <select
                value={filters.serviceType}
                onChange={(event) => setFilters((current) => ({ ...current, serviceType: event.target.value }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              >
                <option value="">All products</option>
                <option value="airtime">Airtime</option>
                <option value="data">Data</option>
                <option value="tv">TV</option>
                <option value="electricity">Electricity</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="reversed">Reversed</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">From date</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">To date</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Reference</span>
              <input
                type="text"
                value={filters.reference}
                onChange={(event) => setFilters((current) => ({ ...current, reference: event.target.value }))}
                placeholder="202606221256HH85wRBIAAu4"
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-2 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const defaults = getDefaultFilters();
                setFilters(defaults);
                setAppliedFilters(defaults);
                void refresh(defaults);
              }}
              className="h-11 self-end rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={refreshing}
              className="inline-flex h-11 self-end items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/20 transition hover:bg-[#0588e0] disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              Apply filters
            </button>
          </form>
        </section>

        {notice && (
          <div className={`rounded-lg border p-4 text-sm font-semibold ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
          }`}>
            {notice.message}
          </div>
        )}

        {ledgerState.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {ledgerState.error}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {topCards.map((item) => (
            <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
          ))}
        </section>

        {summaryMetrics.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Ledger summary</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryMetrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{metric.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {summaryByServiceType.length > 0 && (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Summary by service type</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    {[
                      "Service Type",
                      "Entries",
                      "Successful",
                      "Pending",
                      "Failed",
                      "Bill Amount",
                      "Fee Revenue",
                      "Provider Cost",
                      "Provider Margin",
                      "Revenue",
                      "Profit",
                    ].map((column) => (
                      <th key={column} className="px-5 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {summaryByServiceType.map((row, index) => (
                    <tr key={`${String(getRecordValue(row, ["serviceType"]) ?? "row")}-${index}`}>
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">
                        {String(getRecordValue(row, ["serviceType"]) ?? "Not available")}
                      </td>
                      <td className="px-5 py-4">{formatValue(getRecordValue(row, ["totalEntries"]))}</td>
                      <td className="px-5 py-4">{formatValue(getRecordValue(row, ["successfulEntries"]))}</td>
                      <td className="px-5 py-4">{formatValue(getRecordValue(row, ["pendingEntries"]))}</td>
                      <td className="px-5 py-4">{formatValue(getRecordValue(row, ["failedEntries"]))}</td>
                      <td className="px-5 py-4">{formatCurrency(getRecordValue(row, ["totalBillAmount"]))}</td>
                      <td className="px-5 py-4">{formatCurrency(getRecordValue(row, ["totalFeeRevenue"]))}</td>
                      <td className="px-5 py-4">{formatCurrency(getRecordValue(row, ["totalProviderCost"]))}</td>
                      <td className="px-5 py-4">{formatCurrency(getRecordValue(row, ["totalProviderMargin"]))}</td>
                      <td className="px-5 py-4">{formatCurrency(getRecordValue(row, ["totalRevenue"]))}</td>
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["totalProfit"]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <LedgerTable rows={rows} loading={ledgerState.loading} onView={setDetail} />
      </div>

      {detail && <LedgerDetailsModal row={detail} onClose={() => setDetail(null)} />}
      {backfill.open && (
        <BackfillModal
          state={backfill}
          onChange={(field, value) => setBackfill((current) => ({ ...current, [field]: value }))}
          onClose={() => setBackfill((current) => ({ ...current, open: false, error: "", submitting: false }))}
          onSubmit={() => void handleBackfill()}
        />
      )}
    </main>
  );
}

function LedgerTable({
  rows,
  loading,
  onView,
}: {
  rows: Record<string, unknown>[];
  loading: boolean;
  onView: (row: Record<string, unknown>) => void;
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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Bill ledger rows</h2>
        <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              {["Reference", "Product", "Status", "Bill Amount", "Provider Cost", "Margin", "Realized Profit", "Created", "Action"].map((column) => (
                <th key={column} className="px-5 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {loading && !rows.length ? (
              <tr>
                <td colSpan={9} className="px-5 py-16">
                  <div className="flex items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Loading bill ledger
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr key={String(getRecordValue(row, ["_id", "id", "reference"]) ?? index)} className="align-top">
                  <td className="px-5 py-4">
                    <div className="max-w-[240px]">
                      <p className="break-words font-bold text-slate-950 dark:text-white">
                        {String(getRecordValue(row, ["reference"]) ?? "Not available")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {String(getRecordValue(row, ["billId", "ledgerId", "_id"]) ?? "No identifier")}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                    {String(getRecordValue(row, ["serviceType", "product", "billProduct"]) ?? "Not available")}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                    {String(getRecordValue(row, ["status"]) ?? "Not available")}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(getRecordValue(row, ["amount", "billAmount", "grossAmount"]))}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                    {formatCurrency(getRecordValue(row, ["providerCostAmount", "providerCost"]))}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                    {formatCurrency(getRecordValue(row, ["providerMarginAmount", "marginAmount"]))}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">
                    {formatCurrency(getRecordValue(row, ["realizedProfitAmount", "realizedRevenueAmount"]))}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                    {formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
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
      {!loading && !rows.length && (
        <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
          No bill ledger rows returned.
        </div>
      )}
    </section>
  );
}

function LedgerDetailsModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const metadata = getRecordValue(row, ["metadata"]);
  const metadataRecord = isRecord(metadata) ? metadata : null;

  const summaryFields: Array<[string, unknown]> = [
    ["Reference", getRecordValue(row, ["reference"])],
    ["Source Type", getRecordValue(row, ["sourceType"])],
    ["Source ID", getRecordValue(row, ["sourceId"])],
    ["Status", getRecordValue(row, ["status"])],
    ["Settlement Status", getRecordValue(row, ["settlementStatus"])],
    ["Service Type", getRecordValue(row, ["serviceType"])],
    ["Provider Type", getRecordValue(row, ["providerType"])],
    ["User ID", getRecordValue(row, ["userId"])],
    ["Recipient", getRecordValue(row, ["recipient"])],
    ["Customer Account No", getRecordValue(row, ["customerAccountNo"])],
    ["VTpass Transaction ID", getRecordValue(row, ["vtpassTransactionId"])],
    ["Created At", formatDate(getRecordValue(row, ["createdAt"]))],
    ["Updated At", formatDate(getRecordValue(row, ["updatedAt"]))],
  ];

  const amountFields: Array<[string, unknown]> = [
    ["Bill Amount", getRecordValue(row, ["billAmount"])],
    ["Gross Amount", getRecordValue(row, ["grossAmount"])],
    ["Fee Amount", getRecordValue(row, ["feeAmount"])],
    ["Total Debit Amount", getRecordValue(row, ["totalDebitAmount"])],
    ["Provider Cost Amount", getRecordValue(row, ["providerCostAmount"])],
    ["Provider Commission Amount", getRecordValue(row, ["providerCommissionAmount"])],
    ["Provider Margin Amount", getRecordValue(row, ["providerMarginAmount"])],
    ["Realized Revenue Amount", getRecordValue(row, ["realizedRevenueAmount"])],
    ["Realized Profit Amount", getRecordValue(row, ["realizedProfitAmount"])],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_55%,#069AFF_145%)] px-5 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Bill ledger details</p>
            <h2 className="mt-2 break-words text-2xl font-bold tracking-tight">
              {String(getRecordValue(row, ["reference"]) ?? "Ledger record")}
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-slate-300">
              Product: {String(getRecordValue(row, ["serviceType", "product", "billProduct"]) ?? "Not available")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close ledger details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">
          <div className="grid gap-5">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Record overview</h3>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryFields.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{String(value ?? "Not available")}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Financial breakdown</h3>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {amountFields.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(value)}</p>
                  </div>
                ))}
              </div>
            </section>

            {metadataRecord && (
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="font-bold text-slate-950 dark:text-white">Metadata</h3>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(metadataRecord).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{String(value ?? "Not available")}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Raw ledger JSON</p>
              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                {JSON.stringify(row, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
