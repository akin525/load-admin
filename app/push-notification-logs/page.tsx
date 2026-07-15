"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Eye,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type PushNotificationLogFilters = {
  userId: string;
  status: string;
  type: string;
  channel: string;
  provider: string;
  limit: string;
};

type PushNotificationLogsState = {
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

const getUserRecord = (record: Record<string, unknown>) => {
  const user = getRecordValue(record, ["user"]);
  return isRecord(user) ? user : null;
};

const getRecipientIdentity = (record: Record<string, unknown>) => {
  const user = getUserRecord(record);
  const userName = typeof user?.name === "string" && user.name.trim() ? user.name.trim() : "";
  const userEmail = typeof user?.email === "string" && user.email.trim() ? user.email.trim() : "";
  const fallbackRecipient = String(getRecordValue(record, ["recipient", "email", "to", "userId"]) ?? "").trim();
  const fallbackUserId = String(getRecordValue(record, ["userId"]) ?? "").trim();

  if (userName) {
    return {
      primary: userName,
      secondary: userEmail && userEmail.toLowerCase() !== userName.toLowerCase() ? userEmail : "",
    };
  }

  if (userEmail) {
    return {
      primary: userEmail,
      secondary: "",
    };
  }

  if (fallbackRecipient) {
    return {
      primary: fallbackRecipient,
      secondary: "",
    };
  }

  if (fallbackUserId) {
    return {
      primary: fallbackUserId,
      secondary: "",
    };
  }

  return {
    primary: "Not available",
    secondary: "",
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

const getDefaultFilters = (): PushNotificationLogFilters => ({
  userId: "",
  status: "",
  type: "",
  channel: "",
  provider: "",
  limit: "100",
});

const buildRequestParams = (filters: PushNotificationLogFilters) => {
  const params: Record<string, string | number> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = key === "limit" ? Number(value) : value;
  });

  return params;
};

const fetchPushNotificationLogs = async (filters: PushNotificationLogFilters): Promise<PushNotificationLogsState> => {
  try {
    const payload = await adminService.getPushNotificationLogs(buildRequestParams(filters));

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
  icon: typeof Bell;
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
    normalized === "sent" || normalized === "success" || normalized === "delivered" || normalized === "stored"
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
  const recipientIdentity = getRecipientIdentity(row);
  const user = getUserRecord(row);
  const payload = isRecord(getRecordValue(row, ["payload", "data", "request"])) ? getRecordValue(row, ["payload", "data", "request"]) : null;
  const response = isRecord(getRecordValue(row, ["response", "result", "providerResponse"])) ? getRecordValue(row, ["response", "result", "providerResponse"]) : null;
  const metadata = isRecord(getRecordValue(row, ["metadata"])) ? getRecordValue(row, ["metadata"]) : null;

  const sections = [
    {
      title: "Notification identity",
      items: [
        { label: "Type", value: String(getRecordValue(row, ["type"]) ?? "Not available") },
        { label: "Status", value: String(getRecordValue(row, ["status"]) ?? "Not available") },
        { label: "Channel", value: String(getRecordValue(row, ["channel"]) ?? "Not available") },
        { label: "Provider", value: String(getRecordValue(row, ["provider"]) ?? "Not available") },
      ],
    },
    {
      title: "Recipient context",
      items: [
        { label: "User ID", value: String(getRecordValue(row, ["userId"]) ?? "Not available") },
        { label: "Recipient", value: recipientIdentity.primary },
        { label: "Email", value: typeof user?.email === "string" && user.email.trim() ? user.email : "Not available" },
        { label: "Title", value: String(getRecordValue(row, ["title", "subject"]) ?? "Not available") },
        { label: "Body", value: String(getRecordValue(row, ["body", "message"]) ?? "Not available") },
      ],
    },
    {
      title: "Delivery context",
      items: [
        { label: "Reference", value: String(getRecordValue(row, ["reference", "messageId", "_id", "id"]) ?? "Not available") },
        { label: "Created", value: formatDate(getRecordValue(row, ["createdAt"])) },
        { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
        { label: "Stored at", value: formatDate(getRecordValue(row, ["storedAt"])) },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Push notification detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {String(getRecordValue(row, ["title", "type"]) ?? "Push notification")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review recipient targeting, delivery state, and the stored provider response from one notification audit surface.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close push notification detail"
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
              { title: "Payload", value: payload },
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
        </div>
      </div>
    </div>
  );
}

export default function PushNotificationLogsPage() {
  const router = useRouter();
  const { allowed: canOpenPushNotificationLogs } = useRouteAccess("/push-notification-logs");
  const [filters, setFilters] = useState<PushNotificationLogFilters>(() => getDefaultFilters());
  const [logsState, setLogsState] = useState<PushNotificationLogsState>({
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

    if (!canOpenPushNotificationLogs) {
      return;
    }

    void fetchPushNotificationLogs(getDefaultFilters()).then((result) => {
      if (!cancelled) {
        setLogsState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenPushNotificationLogs, router]);

  const refreshLogs = async (nextFilters = filters) => {
    setRefreshing(true);
    setLogsState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchPushNotificationLogs(nextFilters);
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
    const sent = rows.filter((row) => ["sent", "success", "delivered"].includes(String(getRecordValue(row, ["status"]) ?? "").toLowerCase())).length;
    const stored = rows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "stored").length;
    const broadcast = rows.filter((row) => String(getRecordValue(row, ["type"]) ?? "").toLowerCase() === "broadcast").length;

    return [
      { label: "Push logs", value: formatValue(rows.length), icon: Bell },
      { label: "Sent", value: formatValue(sent), icon: ShieldCheck },
      { label: "Stored", value: formatValue(stored), icon: AlertCircle },
      { label: "Broadcast", value: formatValue(broadcast), icon: Send },
    ];
  }, [rows]);

  if (!canOpenPushNotificationLogs) {
    return (
      <AccessDeniedState
        title="Push notification logs access denied"
        description="Your current admin role does not include permission to inspect push notification logs."
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
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    Push operations
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review outbound push delivery, isolate stored versus sent notifications, and trace broadcast activity from one notification log registry.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by user ID, status, type, channel, provider, and volume limit to validate what the platform attempted to send to mobile clients.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">User ID</span>
                      <input
                        type="text"
                        value={filters.userId}
                        onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
                        placeholder="6a3454785dc345494dff050"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Status</span>
                      <select
                        value={filters.status}
                        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                      >
                        <option value="">All statuses</option>
                        <option value="stored">Stored</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Type</span>
                      <input
                        type="text"
                        value={filters.type}
                        onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                        placeholder="broadcast"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Channel</span>
                      <input
                        type="text"
                        value={filters.channel}
                        onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
                        placeholder="general"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Provider</span>
                      <input
                        type="text"
                        value={filters.provider}
                        onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}
                        placeholder="firebase"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                    </label>
                    <label>
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
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Push delivery registry</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Inspect push notification targets, message types, and provider outcomes across outbound admin push events.
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
                      {["Type", "Recipient", "Title", "Status", "Created", "Action"].map((column) => (
                        <th key={column} className="px-5 py-3 font-bold">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const type = String(getRecordValue(row, ["type"]) ?? "Not available");
                      const recipientIdentity = getRecipientIdentity(row);
                      const title = String(getRecordValue(row, ["title", "subject"]) ?? "Not available");
                      const status = getRecordValue(row, ["status"]) ?? "pending";
                      const key = String(getRecordValue(row, ["_id", "id", "reference", "messageId"]) ?? `push-log-${index}`);

                      return (
                        <tr key={`${key}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{type}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["provider", "channel"]) ?? "Push provider")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="max-w-[16rem] break-words font-semibold text-slate-950 dark:text-white">
                              {recipientIdentity.primary}
                            </p>
                            {recipientIdentity.secondary ? (
                              <p className="mt-1 max-w-[16rem] break-all text-xs font-medium text-slate-500 dark:text-slate-400">
                                {recipientIdentity.secondary}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4">
                            <p className="max-w-[20rem] break-words text-slate-600 dark:text-slate-300">{title}</p>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={status} />
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
                          No push notification logs matched the current filters.
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
