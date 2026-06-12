"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CreditCard,
  Eye,
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
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type XpressWebhookFilters = {
  event: string;
  reference: string;
  processingStatus: string;
  requestId: string;
  limit: string;
};

type XpressWebhookLogsState = {
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

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Request failed";
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const getWebhookId = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["_id", "id", "requestId", "reference"]) ?? "");

const getDefaultFilters = (): XpressWebhookFilters => ({
  event: "",
  reference: "",
  processingStatus: "",
  requestId: "",
  limit: "100",
});

const buildRequestParams = (filters: XpressWebhookFilters) => {
  const params: Record<string, string | number> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = key === "limit" ? Number(value) : value;
  });

  return params;
};

const fetchXpressWebhookLogs = async (filters: XpressWebhookFilters): Promise<XpressWebhookLogsState> => {
  try {
    const payload = await adminService.getXpressWebhookLogs(buildRequestParams(filters));

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
  icon: typeof Activity;
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

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const tone =
    normalized === "success" || normalized === "processed" || normalized === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : normalized === "failed" || normalized === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone}`}>
      {String(status ?? "pending")}
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
  const payload = isRecord(row.payload) ? row.payload : null;
  const response = isRecord(row.response) ? row.response : null;
  const metadata = isRecord(row.metadata) ? row.metadata : null;

  const sections = [
    {
      title: "Webhook identity",
      items: [
        { label: "Request ID", value: String(getRecordValue(row, ["requestId"]) ?? "Not available") },
        { label: "Reference", value: String(getRecordValue(row, ["reference"]) ?? "Not available") },
        { label: "Event", value: String(getRecordValue(row, ["event"]) ?? "Not available") },
        { label: "Processing status", value: String(getRecordValue(row, ["processingStatus", "status"]) ?? "Not available") },
      ],
    },
    {
      title: "Timing",
      items: [
        { label: "Created", value: formatDate(getRecordValue(row, ["createdAt"])) },
        { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
        { label: "Processed at", value: formatDate(getRecordValue(row, ["processedAt"])) },
        { label: "Source", value: String(getRecordValue(row, ["source", "provider"]) ?? "Not available") },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Xpress webhook detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(getRecordValue(row, ["event", "reference"]) ?? "Webhook event")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review the incoming webhook record, payload, and processing response without leaving the operations workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close webhook detail"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[76vh] overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="font-bold text-slate-950 dark:text-white">{section.title}</h3>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold break-words text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            {[
              { title: "Payload", value: payload },
              { title: "Processing response", value: response },
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
        </div>
      </div>
    </div>
  );
}

export default function XpressWebhookLogsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenWebhookLogs } = useRouteAccess("/xpress-webhook-logs");

  const [filters, setFilters] = useState<XpressWebhookFilters>(() => getDefaultFilters());
  const [logsState, setLogsState] = useState<XpressWebhookLogsState>({
    payload: null,
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenWebhookLogs) {
      return;
    }

    void fetchXpressWebhookLogs(getDefaultFilters()).then((result) => {
      if (!cancelled) {
        setLogsState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenWebhookLogs, router]);

  const refreshLogs = async (nextFilters = filters) => {
    setRefreshing(true);
    setLogsState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchXpressWebhookLogs(nextFilters);
    setLogsState(result);
    setRefreshing(false);
  };

  const rows = logsState.rows;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const summaryCards = useMemo(() => {
    const failed = rows.filter((row) => String(getRecordValue(row, ["processingStatus", "status"]) ?? "").toLowerCase() === "failed").length;
    const processed = rows.filter((row) => ["success", "processed", "completed"].includes(String(getRecordValue(row, ["processingStatus", "status"]) ?? "").toLowerCase())).length;
    const accountFunded = rows.filter((row) => String(getRecordValue(row, ["event"]) ?? "").toLowerCase() === "account_funded").length;

    return [
      { label: "Webhook logs", value: formatValue(rows.length), icon: Activity },
      { label: "Processed", value: formatValue(processed), icon: ShieldCheck },
      { label: "Failed", value: formatValue(failed), icon: AlertCircle },
      { label: "Account funded", value: formatValue(accountFunded), icon: WalletCards },
    ];
  }, [rows]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  if (!canOpenWebhookLogs) {
    return (
      <AccessDeniedState
        title="Webhook logs access denied"
        description="Your current admin role does not include permission to inspect Xpress webhook logs."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
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
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    Xpress integration operations
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review inbound Xpress webhooks, match references, and isolate failed processing from one operations log.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by event, reference, processing status, request ID, and volume limit to verify webhook ingestion and investigate provider-to-platform flow.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Event</span>
                      <input
                        type="text"
                        value={filters.event}
                        onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value }))}
                        placeholder="account_funded"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Reference</span>
                      <input
                        type="text"
                        value={filters.reference}
                        onChange={(event) => setFilters((current) => ({ ...current, reference: event.target.value }))}
                        placeholder="d38fh3jf93jf39f1"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Processing status</span>
                      <select
                        value={filters.processingStatus}
                        onChange={(event) => setFilters((current) => ({ ...current, processingStatus: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                      >
                        <option value="">All statuses</option>
                        <option value="success">Success</option>
                        <option value="processed">Processed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Request ID</span>
                      <input
                        type="text"
                        value={filters.requestId}
                        onChange={(event) => setFilters((current) => ({ ...current, requestId: event.target.value }))}
                        placeholder="xpress-webhook-123456"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Limit</span>
                      <input
                        type="number"
                        min="1"
                        value={filters.limit}
                        onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                        placeholder="200"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshLogs()}
                      disabled={refreshing}
                      className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
                    >
                      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getDefaultFilters();
                        setFilters(defaults);
                        void refreshLogs(defaults);
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {logsState.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {logsState.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Xpress webhook registry</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Inspect each webhook request, its event metadata, and the processing outcome inside the platform.
                  </p>
                </div>
                <span className="rounded-md bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                  {formatValue(rows.length)} records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                    <tr>
                      {["Event", "Reference", "Request ID", "Processing", "Created", "Action"].map((column) => (
                        <th key={column} className="px-5 py-3 font-bold">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const event = String(getRecordValue(row, ["event"]) ?? "Not available");
                      const reference = String(getRecordValue(row, ["reference"]) ?? "Not available");
                      const requestId = String(getRecordValue(row, ["requestId"]) ?? "Not available");
                      const processingStatus = getRecordValue(row, ["processingStatus", "status"]) ?? "pending";

                      return (
                        <tr key={`${getWebhookId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{event}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["provider", "source"]) ?? "Xpress")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="max-w-[15rem] break-all font-semibold text-slate-950 dark:text-white">{reference}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="max-w-[15rem] break-all text-slate-600 dark:text-slate-300">{requestId}</p>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={processingStatus} />
                          </td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                            {formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setDetail(row)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                          No webhook logs matched the current filters.
                        </td>
                      </tr>
                    )}
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
            </section>
          </>
        )}
      </div>

      {detail && <DetailModal row={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
