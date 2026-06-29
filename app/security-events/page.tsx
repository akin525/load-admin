"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserX,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type SecurityEventFilters = {
  eventType: string;
  subjectType: string;
  email: string;
  ipAddress: string;
  riskLevel: string;
  success: string;
  limit: string;
};

type SecurityEventsState = {
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

  if (typeof value === "boolean") {
    return value ? "True" : "False";
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

const getDefaultFilters = (): SecurityEventFilters => ({
  eventType: "",
  subjectType: "",
  email: "",
  ipAddress: "",
  riskLevel: "",
  success: "",
  limit: "100",
});

const buildRequestParams = (filters: SecurityEventFilters) => {
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

const fetchSecurityEvents = async (filters: SecurityEventFilters): Promise<SecurityEventsState> => {
  try {
    const payload = await adminService.getSecurityEvents(buildRequestParams(filters));

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
  icon: typeof ShieldAlert;
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
  const normalized =
    typeof success === "boolean" ? success : String(success ?? "").toLowerCase() === "true";

  const tone = normalized
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
    : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone}`}>
      {normalized ? "Success" : "Failed"}
    </span>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: unknown }) {
  const normalized = String(riskLevel ?? "unknown").toLowerCase();
  const tone =
    normalized === "high"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
      : normalized === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
        : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone}`}>
      {String(riskLevel ?? "unknown")}
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
  const payload = getRecordValue(row, ["payload", "data", "request"]);
  const metadata = getRecordValue(row, ["metadata", "meta"]);

  const identityItems = [
    { label: "Event type", value: String(getRecordValue(row, ["eventType", "type"]) ?? "Not available") },
    { label: "Subject type", value: String(getRecordValue(row, ["subjectType"]) ?? "Not available") },
    { label: "Subject ID", value: String(getRecordValue(row, ["subjectId", "userId", "adminId"]) ?? "Not available") },
    { label: "Success", value: typeof getRecordValue(row, ["success"]) === "boolean" ? String(getRecordValue(row, ["success"])) : "Not available" },
    { label: "Risk level", value: String(getRecordValue(row, ["riskLevel"]) ?? "Not available") },
    { label: "Reference", value: String(getRecordValue(row, ["_id", "id", "reference"]) ?? "Not available") },
  ];

  const contextItems = [
    { label: "Email", value: String(getRecordValue(row, ["email"]) ?? "Not available") },
    { label: "IP address", value: String(getRecordValue(row, ["ipAddress", "ip"]) ?? "Not available") },
    { label: "User agent", value: String(getRecordValue(row, ["userAgent"]) ?? "Not available") },
    { label: "Created", value: formatDate(getRecordValue(row, ["createdAt", "timestamp"])) },
    { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
  ];

  const extraEntries = Object.entries(row).filter(([key, value]) => {
    if (
      [
        "_id",
        "id",
        "reference",
        "eventType",
        "type",
        "subjectType",
        "subjectId",
        "userId",
        "adminId",
        "success",
        "riskLevel",
        "email",
        "ipAddress",
        "ip",
        "userAgent",
        "createdAt",
        "updatedAt",
        "timestamp",
        "payload",
        "data",
        "request",
        "metadata",
        "meta",
      ].includes(key)
    ) {
      return false;
    }

    return !isRecord(value) && !Array.isArray(value);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Security event detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(getRecordValue(row, ["eventType", "type"]) ?? "Security event")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review actor identity, network source, event outcome, and raw payload from one incident record.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close security event detail"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Identity</h3>
              </div>
              <div className="grid gap-3 p-4">
                {identityItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Context</h3>
              </div>
              <div className="grid gap-3 p-4">
                {contextItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Additional fields</h3>
              </div>
              <div className="grid gap-3 p-4">
                {extraEntries.length ? (
                  extraEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{String(value ?? "Not available")}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                    No extra flat fields returned.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {[
              { title: "Payload", value: payload },
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
                        {typeof section.value === "string" ? section.value : JSON.stringify(section.value, null, 2)}
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

export default function SecurityEventsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SecurityEventFilters>(() => getDefaultFilters());
  const [eventsState, setEventsState] = useState<SecurityEventsState>({
    payload: null,
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    void fetchSecurityEvents(getDefaultFilters()).then((result) => {
      if (!cancelled) {
        setEventsState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const refreshEvents = async (nextFilters = filters) => {
    setRefreshing(true);
    setEventsState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchSecurityEvents(nextFilters);
    setEventsState(result);
    setRefreshing(false);
  };

  const rows = eventsState.rows;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const summaryCards = useMemo(() => {
    const successCount = rows.filter((row) => getRecordValue(row, ["success"]) === true).length;
    const failedCount = rows.filter((row) => getRecordValue(row, ["success"]) === false).length;
    const highRiskCount = rows.filter((row) => String(getRecordValue(row, ["riskLevel"]) ?? "").toLowerCase() === "high").length;
    const adminCount = rows.filter((row) => String(getRecordValue(row, ["subjectType"]) ?? "").toLowerCase() === "admin").length;

    return [
      { label: "Security events", value: formatValue(rows.length), icon: ShieldAlert },
      { label: "Successful", value: formatValue(successCount), icon: ShieldCheck },
      { label: "Failed", value: formatValue(failedCount), icon: AlertCircle },
      { label: "High risk", value: formatValue(highRiskCount), icon: UserX },
      { label: "Admin subjects", value: formatValue(adminCount), icon: ShieldCheck },
    ];
  }, [rows]);

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        {!eventsState.loaded ? (
          <div className="grid gap-5">
            <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
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
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Security telemetry
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Trace failed logins, admin-facing risks, OTP abuse signals, and session anomalies from one security event registry.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by event type, subject, email, IP, risk level, result, and limit. Use the system settings workspace to maintain the admin IP allowlist.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:max-w-2xl">
                    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">Default login protections</p>
                      <div className="mt-3 space-y-1 text-sm font-semibold text-white">
                        <p>User login: 5 attempts / 15 min</p>
                        <p>Admin login: 3 attempts / 15 min</p>
                        <p>OTP verify: 5 attempts / 15 min</p>
                        <p>Temporary lockout: 30 min</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">Admin IP allowlist</p>
                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        Configure `admin_ip_allowlist` in system settings with comma-separated IPs or CIDR ranges, for example `102.88.114.242,197.210.0.0/16`.
                      </p>
                      <a
                        href="/system-settings"
                        className="mt-3 inline-flex h-9 items-center rounded-md border border-white/20 px-3 text-xs font-bold text-white transition hover:bg-white/10"
                      >
                        Open system settings
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Event type</span>
                      <input
                        type="text"
                        value={filters.eventType}
                        onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))}
                        placeholder="failed_login"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Subject type</span>
                      <select
                        value={filters.subjectType}
                        onChange={(event) => setFilters((current) => ({ ...current, subjectType: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                      >
                        <option value="">All subjects</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Email</span>
                      <input
                        type="email"
                        value={filters.email}
                        onChange={(event) => setFilters((current) => ({ ...current, email: event.target.value }))}
                        placeholder="admin@eazycredit.com"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">IP address</span>
                      <input
                        type="text"
                        value={filters.ipAddress}
                        onChange={(event) => setFilters((current) => ({ ...current, ipAddress: event.target.value }))}
                        placeholder="102.88.114.242"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Risk level</span>
                      <select
                        value={filters.riskLevel}
                        onChange={(event) => setFilters((current) => ({ ...current, riskLevel: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                      >
                        <option value="">All levels</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Success</span>
                      <select
                        value={filters.success}
                        onChange={(event) => setFilters((current) => ({ ...current, success: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                      >
                        <option value="">All outcomes</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
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
                      onClick={() => void refreshEvents()}
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
                        void refreshEvents(defaults);
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {eventsState.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {eventsState.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Security event registry</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Inspect login controls, OTP-related incidents, risk scoring, and admin/user subject traces.
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
                      {["Event", "Subject", "Network", "Risk", "Outcome", "Action"].map((column) => (
                        <th key={column} className="px-5 py-3 font-bold">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const eventType = String(getRecordValue(row, ["eventType", "type"]) ?? "Not available");
                      const subjectType = String(getRecordValue(row, ["subjectType"]) ?? "Not available");
                      const subjectId = String(getRecordValue(row, ["subjectId", "userId", "adminId"]) ?? "Not available");
                      const email = String(getRecordValue(row, ["email"]) ?? "Not available");
                      const ip = String(getRecordValue(row, ["ipAddress", "ip"]) ?? "Not available");
                      const riskLevel = getRecordValue(row, ["riskLevel"]) ?? "unknown";
                      const success = getRecordValue(row, ["success"]);
                      const key = String(getRecordValue(row, ["_id", "id", "reference"]) ?? `security-event-${index}`);

                      return (
                        <tr key={`${key}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{eventType}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {formatDate(getRecordValue(row, ["createdAt", "timestamp"]))}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">{subjectType}</p>
                            <p className="mt-1 max-w-[14rem] break-all text-xs font-medium text-slate-500 dark:text-slate-400">{subjectId}</p>
                            <p className="mt-1 max-w-[14rem] break-all text-xs font-medium text-slate-500 dark:text-slate-400">{email}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">{ip}</p>
                            <p className="mt-1 max-w-[18rem] break-words text-xs font-medium text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["userAgent"]) ?? "No user agent")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <RiskBadge riskLevel={riskLevel} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge success={success} />
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
                          No security events matched the current filters.
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
