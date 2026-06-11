"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
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

type AuditLogFilters = {
  adminUserId: string;
  adminId: string;
  method: string;
  path: string;
  statusCode: string;
  fromDate: string;
  toDate: string;
  limit: string;
};

type AuditLogsState = {
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

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): AuditLogFilters => {
  const now = new Date();
  return {
    adminUserId: "",
    adminId: "",
    method: "",
    path: "",
    statusCode: "",
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
    limit: "100",
  };
};

const getAuditId = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["_id", "id", "logId"]) ?? "");

const getAuditMethod = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["method"]) ?? "UNKNOWN").toUpperCase();

const getAuditPath = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["path", "route", "url"]) ?? "Not available");

const getAuditActor = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["adminUserId", "adminId", "userId"]) ?? "Not available");

const getAuditStatusCode = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["statusCode", "status", "code"]);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const getMethodTone = (method: string) => {
  const normalized = method.toUpperCase();

  if (normalized === "GET") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200";
  }

  if (["POST", "PUT", "PATCH"].includes(normalized)) {
    return "border-[#069AFF]/25 bg-[#069AFF]/10 text-[#069AFF] dark:border-[#069AFF]/30 dark:bg-[#069AFF]/15 dark:text-sky-200";
  }

  if (normalized === "DELETE") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
};

const getStatusTone = (statusCode: number | null) => {
  if (statusCode === null) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
  }

  if (statusCode >= 200 && statusCode < 400) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (statusCode >= 400) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";
};

const buildRequestParams = (filters: AuditLogFilters) => {
  const params: Record<string, string | number> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim() || key === "adminId") {
      return;
    }

    params[key] = ["limit", "statusCode"].includes(key) ? Number(value) : value;
  });

  return params;
};

const fetchAuditLogs = async (filters: AuditLogFilters): Promise<AuditLogsState> => {
  try {
    const params = buildRequestParams(filters);
    const payload = filters.adminId.trim()
      ? await adminService.getAdminAuditLogs(filters.adminId.trim(), params)
      : await adminService.getAuditLogs(params);

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
  icon: typeof WalletCards;
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

function DetailJsonBlock({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">{title}</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function AuditLogDetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const method = getAuditMethod(row);
  const path = getAuditPath(row);
  const statusCode = getAuditStatusCode(row);
  const actor = getAuditActor(row);
  const requestParams = getRecordValue(row, ["params", "requestParams"]);
  const query = getRecordValue(row, ["query"]);
  const body = getRecordValue(row, ["body", "requestBody", "payload"]);
  const response = getRecordValue(row, ["response", "responseBody", "result"]);
  const error = getRecordValue(row, ["error", "exception"]);
  const meta = getRecordValue(row, ["meta", "metadata"]);
  const headers = getRecordValue(row, ["headers", "requestHeaders"]);
  const statusTone = getStatusTone(statusCode);
  const methodTone = getMethodTone(method);
  const primaryDetails = [
    { label: "Log ID", value: getAuditId(row) || "Not available" },
    { label: "Admin User ID", value: String(getRecordValue(row, ["adminUserId"]) ?? "Not available") },
    { label: "Admin ID", value: String(getRecordValue(row, ["adminId"]) ?? "Not available") },
    { label: "Method", value: method },
    { label: "Path", value: path },
    { label: "Status Code", value: statusCode === null ? "Not available" : String(statusCode) },
    { label: "IP Address", value: String(getRecordValue(row, ["ip", "ipAddress"]) ?? "Not available") },
    { label: "User Agent", value: String(getRecordValue(row, ["userAgent"]) ?? "Not available") },
  ];
  const timingDetails = [
    { label: "Created", value: formatDate(getRecordValue(row, ["createdAt", "timestamp"])) },
    { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
  ];
  const extraEntries = Object.entries(row).filter(([key, value]) => {
    if ([
      "_id",
      "id",
      "logId",
      "adminUserId",
      "adminId",
      "method",
      "path",
      "route",
      "url",
      "statusCode",
      "status",
      "code",
      "ip",
      "ipAddress",
      "userAgent",
      "createdAt",
      "updatedAt",
      "timestamp",
      "params",
      "requestParams",
      "query",
      "body",
      "requestBody",
      "payload",
      "response",
      "responseBody",
      "result",
      "error",
      "exception",
      "meta",
      "metadata",
      "headers",
      "requestHeaders",
    ].includes(key)) {
      return false;
    }

    return !isRecord(value) && !Array.isArray(value);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-[1240px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-white/10 bg-[linear-gradient(135deg,#03111f_0%,#0a2e55_45%,#069AFF_135%)] px-7 py-6 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Admin audit record</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">
              {method} {path}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Recorded admin action for actor <span className="font-semibold text-white">{actor}</span>.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${methodTone}`}>
                {method}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone}`}>
                {statusCode === null ? "Unknown status" : `HTTP ${statusCode}`}
              </span>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {formatDate(getRecordValue(row, ["createdAt", "timestamp"]))}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close audit log details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto bg-slate-50/70 p-6 dark:bg-[#07111f]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <section className="grid gap-6">
              <div className="rounded-[24px] border border-[#069AFF]/20 bg-white p-6 shadow-sm dark:border-[#069AFF]/20 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Request summary</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Admin actor</p>
                    <p className="mt-2 break-words text-xl font-bold text-slate-950 dark:text-white">{actor}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Status code</p>
                    <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{statusCode === null ? "Unknown" : statusCode}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Captured at</p>
                    <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{formatDate(getRecordValue(row, ["createdAt", "timestamp"]))}</p>
                  </div>
                </div>
              </div>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Identity And Context</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[...primaryDetails, ...timingDetails].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                  {extraEntries.map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{String(value ?? "Not available")}</p>
                    </div>
                  ))}
                </div>
              </section>

              <DetailJsonBlock title="Route Params" value={requestParams} />
              <DetailJsonBlock title="Query" value={query} />
              <DetailJsonBlock title="Request Body" value={body} />
              <DetailJsonBlock title="Response" value={response} />
              <DetailJsonBlock title="Error" value={error} />
            </section>

            <aside className="grid gap-6">
              <DetailJsonBlock title="Request Headers" value={headers} />
              <DetailJsonBlock title="Metadata" value={meta} />

              <details className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <summary className="cursor-pointer list-none px-6 py-5 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">
                  Raw Audit Record
                </summary>
                <div className="border-t border-slate-100 px-6 py-5 dark:border-white/10">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              </details>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingAuditLogs() {
  return (
    <div className="grid gap-5">
      <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
      <div className="h-[560px] animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenAuditLogs } = useRouteAccess("/audit-logs");
  const [filters, setFilters] = useState<AuditLogFilters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(() => getDefaultFilters());
  const [auditLogs, setAuditLogs] = useState<AuditLogsState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenAuditLogs) {
      return;
    }

    void fetchAuditLogs(appliedFilters).then((result) => {
      if (!cancelled) {
        setAuditLogs(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, canOpenAuditLogs, router]);

  const refreshAuditLogs = async (nextFilters = appliedFilters) => {
    setAuditLogs((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchAuditLogs(nextFilters);
    setAuditLogs(result);
  };

  const rows = auditLogs.rows;

  const totals = useMemo(() => {
    const successCount = rows.filter((row) => {
      const statusCode = getAuditStatusCode(row);
      return statusCode !== null && statusCode >= 200 && statusCode < 400;
    }).length;
    const failureCount = rows.filter((row) => {
      const statusCode = getAuditStatusCode(row);
      return statusCode !== null && statusCode >= 400;
    }).length;
    const uniqueAdmins = new Set(rows.map((row) => getAuditActor(row)).filter((value) => value !== "Not available")).size;
    const uniquePaths = new Set(rows.map((row) => getAuditPath(row)).filter((value) => value !== "Not available")).size;

    return {
      successCount,
      failureCount,
      uniqueAdmins,
      uniquePaths,
    };
  }, [rows]);

  const availableValues = useMemo(() => {
    const methods = Array.from(new Set(rows.map((row) => getAuditMethod(row)).filter(Boolean))).sort((left, right) => left.localeCompare(right));
    const statuses = Array.from(
      new Set(
        rows
          .map((row) => getAuditStatusCode(row))
          .filter((value): value is number => value !== null),
      ),
    )
      .sort((left, right) => left - right)
      .map(String);

    return {
      methods,
      statuses,
    };
  }, [rows]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  if (!canOpenAuditLogs) {
    return (
      <AccessDeniedState
        title="Audit logs access denied"
        description="Your current admin role does not include permission to review audit logs."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Audit Logs
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Chronological record of all administrative actions and system events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAppliedFilters(filters);
              }}
              disabled={auditLogs.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {auditLogs.loading ? (
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
        {!auditLogs.loaded ? (
          <LoadingAuditLogs />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Trace and accountability workspace
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review who changed what, which admin route was called, and how the system responded.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter across all admin actions or isolate one administrator with the dedicated audit route. This view is built for operational review, incident tracing, and compliance checks.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">From date</span>
                      <input
                        type="date"
                        value={filters.fromDate}
                        onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">To date</span>
                      <input
                        type="date"
                        value={filters.toDate}
                        onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Admin user ID</span>
                      <input
                        value={filters.adminUserId}
                        onChange={(event) => setFilters((current) => ({ ...current, adminUserId: event.target.value }))}
                        placeholder="Filter by acting admin user"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Admin ID</span>
                      <input
                        value={filters.adminId}
                        onChange={(event) => setFilters((current) => ({ ...current, adminId: event.target.value }))}
                        placeholder="Uses /admin/admins/:id/audit-logs"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Path contains</span>
                      <input
                        value={filters.path}
                        onChange={(event) => setFilters((current) => ({ ...current, path: event.target.value }))}
                        placeholder="/admin/loans or /admin/users"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Method</span>
                      <select
                        value={filters.method}
                        onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      >
                        <option value="">All methods</option>
                        {availableValues.methods.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Status code</span>
                      <select
                        value={filters.statusCode}
                        onChange={(event) => setFilters((current) => ({ ...current, statusCode: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      >
                        <option value="">All statuses</option>
                        {availableValues.statuses.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Limit</span>
                      <input
                        value={filters.limit}
                        onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                        placeholder="100"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedFilters(filters);
                      }}
                      disabled={auditLogs.loading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-70"
                    >
                      {auditLogs.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getDefaultFilters();
                        setFilters(defaults);
                        setAppliedFilters(defaults);
                      }}
                      disabled={auditLogs.loading}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Log entries" value={formatValue(rows.length)} icon={FileText} />
              <SummaryCard label="Successful calls" value={formatValue(totals.successCount)} icon={ShieldCheck} />
              <SummaryCard label="Error calls" value={formatValue(totals.failureCount)} icon={AlertCircle} />
              <SummaryCard label="Unique routes" value={formatValue(totals.uniquePaths)} icon={BarChart3} />
            </section>

            {appliedFilters.adminId && (
              <section className="rounded-lg border border-[#069AFF]/20 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-[#069AFF]/20 dark:bg-white/[0.045] dark:text-slate-200">
                Using admin-specific route: <span className="font-bold text-[#069AFF]">GET /admin/admins/{appliedFilters.adminId}/audit-logs</span>
              </section>
            )}

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">Audit timeline</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Every row reflects one recorded admin route execution.
                  </p>
                </div>
                <div className="rounded-md bg-[#069AFF]/10 px-3 py-1.5 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                  {formatValue(rows.length)} records
                </div>
              </div>

              {auditLogs.error ? (
                <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {auditLogs.error}
                </div>
              ) : rows.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-white/10">
                    <thead className="bg-slate-50 dark:bg-white/[0.035]">
                      <tr className="text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <th className="px-5 py-3">Admin Actor</th>
                        <th className="px-5 py-3">Request</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Captured</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                      {rows.map((row, index) => {
                        const actor = getAuditActor(row);
                        const method = getAuditMethod(row);
                        const path = getAuditPath(row);
                        const statusCode = getAuditStatusCode(row);
                        const statusTone = getStatusTone(statusCode);
                        const methodTone = getMethodTone(method);

                        return (
                          <tr key={getAuditId(row) || `${actor}-${index}`} className="align-top">
                            <td className="px-5 py-4">
                              <div className="grid gap-1">
                                <p className="font-semibold text-slate-950 dark:text-white">{actor}</p>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {String(getRecordValue(row, ["adminId"]) ?? "No admin id")}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="grid gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold ${methodTone}`}>
                                    {method}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{path}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {getAuditId(row) || "No log id"}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="grid gap-2">
                                <span className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
                                  {statusCode === null ? "Unknown" : `HTTP ${statusCode}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                              {formatDate(getRecordValue(row, ["createdAt", "timestamp"]))}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLog(row)}
                                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
                                >
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                  No audit records matched the selected filter set.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedLog && <AuditLogDetailModal row={selectedLog} onClose={() => setSelectedLog(null)} />}
    </main>
  );
}
