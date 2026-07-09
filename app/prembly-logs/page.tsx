"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserSearch,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type PremblyLogFilters = {
  category: string;
  userId: string;
  signupId: string;
  appLoanId: string;
  loanId: string;
  success: string;
  fromDate: string;
  toDate: string;
  limit: string;
};

type PremblyLogsState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
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

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
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
    second: "2-digit",
  }).format(date);
};

const getDefaultFilters = (): PremblyLogFilters => ({
  category: "",
  userId: "",
  signupId: "",
  appLoanId: "",
  loanId: "",
  success: "",
  fromDate: "",
  toDate: "",
  limit: "100",
});

const buildRequestParams = (filters: PremblyLogFilters) => {
  const params: Record<string, string | number | boolean> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    if (key === "limit") {
      params[key] = Number(value);
      return;
    }

    if (key === "success") {
      params[key] = value === "true";
      return;
    }

    params[key] = value;
  });

  return params;
};

const fetchPremblyLogs = async (filters: PremblyLogFilters): Promise<PremblyLogsState> => {
  try {
    const payload = await adminService.getPremblyLogs(buildRequestParams(filters));

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

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Search;
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

function StatusBadge({ success }: { success: unknown }) {
  const normalized = String(success ?? "").toLowerCase();
  const isSuccess = normalized === "true" || normalized === "success" || normalized === "1";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
      }`}
    >
      {isSuccess ? "SUCCESS" : "FAILED"}
    </span>
  );
}

function DetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const payload = isRecord(getRecordValue(row, ["payload", "request", "data"])) ? getRecordValue(row, ["payload", "request", "data"]) : null;
  const response = isRecord(getRecordValue(row, ["response", "providerResponse", "result"])) ? getRecordValue(row, ["response", "providerResponse", "result"]) : null;
  const metadata = isRecord(getRecordValue(row, ["metadata"])) ? getRecordValue(row, ["metadata"]) : null;

  const sections = [
    {
      title: "Verification identity",
      items: [
        { label: "Category", value: String(getRecordValue(row, ["category"]) ?? "Not available") },
        { label: "Success", value: String(getRecordValue(row, ["success"]) ?? "Not available") },
        { label: "User ID", value: String(getRecordValue(row, ["userId"]) ?? "Not available") },
        { label: "Reference", value: String(getRecordValue(row, ["reference", "_id", "id"]) ?? "Not available") },
      ],
    },
    {
      title: "Linked entities",
      items: [
        { label: "Signup ID", value: String(getRecordValue(row, ["signupId"]) ?? "Not available") },
        { label: "App Loan ID", value: String(getRecordValue(row, ["appLoanId"]) ?? "Not available") },
        { label: "Loan ID", value: String(getRecordValue(row, ["loanId"]) ?? "Not available") },
        { label: "Provider", value: String(getRecordValue(row, ["provider", "source"]) ?? "Not available") },
      ],
    },
    {
      title: "Timing",
      items: [
        { label: "Created", value: formatDate(getRecordValue(row, ["createdAt"])) },
        { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
        { label: "Processed", value: formatDate(getRecordValue(row, ["processedAt"])) },
        { label: "Resolved", value: formatDate(getRecordValue(row, ["resolvedAt"])) },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Prembly detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(getRecordValue(row, ["category"]) ?? "Prembly log")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review one verification request, its linked user context, and the stored provider payloads without leaving the monitoring workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close Prembly detail"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[76vh] overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-3">
            {sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="font-bold text-slate-950 dark:text-white">{section.title}</h3>
                </div>
                <div className="grid gap-3 p-4">
                  {section.items.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            {[
              { title: "Request payload", value: payload },
              { title: "Provider response", value: response },
              { title: "Metadata", value: metadata },
            ].map((section) => (
              <section key={section.title} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="font-bold text-slate-950 dark:text-white">{section.title}</h3>
                </div>
                <div className="p-4">
                  {section.value ? (
                    <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                        {JSON.stringify(section.value, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                      No {section.title.toLowerCase()} returned.
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <h3 className="font-bold text-slate-950 dark:text-white">Raw Prembly record</h3>
            </div>
            <div className="p-4">
              <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
                <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function PremblyLogsPage() {
  const router = useRouter();
  const { allowed } = useRouteAccess("/prembly-logs");
  const [filters, setFilters] = useState<PremblyLogFilters>(() => getDefaultFilters());
  const [logsState, setLogsState] = useState<PremblyLogsState>({
    payload: null,
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

    void fetchPremblyLogs(getDefaultFilters()).then((result) => {
      if (!cancelled) {
        setLogsState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [allowed, router]);

  const refreshLogs = async (nextFilters = filters) => {
    setRefreshing(true);
    setLogsState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchPremblyLogs(nextFilters);
    setLogsState(result);
    setRefreshing(false);
  };

  const rows = logsState.rows;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const summaryCards = useMemo(() => {
    const successCount = rows.filter((row) => {
      const value = String(getRecordValue(row, ["success"]) ?? "").toLowerCase();
      return value === "true" || value === "success" || value === "1";
    }).length;
    const failureCount = rows.length - successCount;
    const categories = new Set(rows.map((row) => String(getRecordValue(row, ["category"]) ?? "")).filter(Boolean)).size;

    return [
      { label: "Prembly logs", value: formatValue(rows.length), icon: Search },
      { label: "Successful", value: formatValue(successCount), icon: ShieldCheck },
      { label: "Failed", value: formatValue(failureCount), icon: AlertCircle },
      { label: "Categories", value: formatValue(categories), icon: UserSearch },
    ];
  }, [rows]);

  if (!allowed) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8">
        <AccessDeniedState
          title="Prembly logs access denied"
          description="Your current admin role does not include permission to inspect Prembly logs."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Monitoring</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Prembly Logs</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Monitor identity verification traffic, inspect provider payloads, and trace each request back to the linked user, signup, or loan context.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refreshLogs()}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Refresh logs
            </button>
          </div>
        </section>

        {!logsState.loaded ? (
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
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Identity verification monitoring
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review Prembly validations, isolate failed verification attempts, and trace the user or loan context tied to each request.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by category, linked entities, success state, and date range to inspect what the verification layer attempted and what came back from the provider.
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-sky-100">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Search
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { key: "category", label: "Category", placeholder: "nin_validation" },
                      { key: "userId", label: "User ID", placeholder: "6a42..." },
                      { key: "signupId", label: "Signup ID", placeholder: "signup..." },
                      { key: "appLoanId", label: "App loan ID", placeholder: "app loan..." },
                      { key: "loanId", label: "Loan ID", placeholder: "loan..." },
                    ].map((field) => (
                      <label key={field.key} className="grid gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">{field.label}</span>
                        <input
                          value={filters[field.key as keyof PremblyLogFilters]}
                          onChange={(event) => setFilters((current) => ({ ...current, [field.key]: event.target.value }))}
                          placeholder={field.placeholder}
                          className="h-11 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/30 focus:bg-white/15"
                        />
                      </label>
                    ))}
                    <label className="grid gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">Success</span>
                      <select
                        value={filters.success}
                        onChange={(event) => setFilters((current) => ({ ...current, success: event.target.value }))}
                        className="h-11 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/30 focus:bg-white/15"
                      >
                        <option value="" className="text-slate-900">All</option>
                        <option value="true" className="text-slate-900">True</option>
                        <option value="false" className="text-slate-900">False</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">Limit</span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={filters.limit}
                        onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                        className="h-11 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/30 focus:bg-white/15"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">From date</span>
                      <input
                        type="date"
                        value={filters.fromDate}
                        onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                        className="h-11 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/30 focus:bg-white/15"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">To date</span>
                      <input
                        type="date"
                        value={filters.toDate}
                        onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                        className="h-11 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/30 focus:bg-white/15"
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage(1);
                        void refreshLogs(filters);
                      }}
                      disabled={refreshing}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#083d70] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getDefaultFilters();
                        setFilters(defaults);
                        setCurrentPage(1);
                        void refreshLogs(defaults);
                      }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <SummaryCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
              ))}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Prembly registry</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Provider verification logs</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Inspect stored identity verification events and open each row for the full provider payload.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshLogs()}
                  disabled={refreshing}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  Refresh
                </button>
              </div>

              {logsState.error ? (
                <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {logsState.error}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
                  <thead className="bg-slate-50 dark:bg-white/[0.035]">
                    <tr>
                      {["Category", "User / Links", "Success", "Created", "Actions"].map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-16 text-center">
                          <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-500">
                              <Search className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="text-base font-bold text-slate-900 dark:text-white">No Prembly logs found</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Adjust the filters or refresh the workspace after new verification activity arrives.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, index) => (
                        <tr key={`${String(getRecordValue(row, ["_id", "id", "reference"]) ?? "prembly")}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["category"]) ?? "Not available")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["reference", "_id", "id"]) ?? "No reference")}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["userId"]) ?? "No user")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Signup: {String(getRecordValue(row, ["signupId"]) ?? "N/A")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              App loan: {String(getRecordValue(row, ["appLoanId"]) ?? "N/A")} | Loan: {String(getRecordValue(row, ["loanId"]) ?? "N/A")}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge success={getRecordValue(row, ["success"])} />
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-slate-950 dark:text-white">{formatDate(getRecordValue(row, ["createdAt"]))}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Updated {formatDate(getRecordValue(row, ["updatedAt"]))}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setDetail(row)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
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
                currentPage={safeCurrentPage}
                pageSize={pageSize}
                totalItems={rows.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(value) => {
                  setPageSize(value);
                  setCurrentPage(1);
                }}
              />
            </section>
          </>
        )}
      </div>

      {detail ? <DetailModal row={detail} onClose={() => setDetail(null)} /> : null}
    </main>
  );
}
