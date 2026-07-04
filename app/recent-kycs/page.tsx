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
  UserRound,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type RecentKycFilters = {
  status: string;
  tier: string;
  userId: string;
  fromDate: string;
  toDate: string;
  limit: string;
};

type RecentKycState = {
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

const formatValue = (value: unknown): string => {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "0";
};

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

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

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const isPdfUrl = (value: unknown): value is string =>
  isHttpUrl(value) && /\.pdf(?:\?|#|$)/i.test(value);

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Request failed";
};

const getDefaultFilters = (): RecentKycFilters => ({
  status: "",
  tier: "",
  userId: "",
  fromDate: "",
  toDate: "",
  limit: "100",
});

const buildRequestParams = (filters: RecentKycFilters) => {
  const params: Record<string, string | number> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = key === "limit" ? Number(value) : value;
  });

  return params;
};

const fetchRecentKycs = async (filters: RecentKycFilters): Promise<RecentKycState> => {
  try {
    const payload = await adminService.getRecentKycs(buildRequestParams(filters));

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

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const tone =
    ["approved", "success", "verified"].includes(normalized)
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : ["failed", "rejected", "declined"].includes(normalized)
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone}`}>
      {String(status ?? "pending")}
    </span>
  );
}

function JsonInspector({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <pre className="max-h-80 overflow-auto px-4 py-4 text-xs leading-6 text-slate-700 dark:text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function DetailInfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-words">{value}</p>
    </div>
  );
}

function DocumentCard({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  const pdf = isPdfUrl(url);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{pdf ? "PDF document" : "Image upload"}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
        >
          Open
        </a>
      </div>

      <div className="bg-slate-100 dark:bg-slate-900">
        {pdf ? (
          <iframe
            src={url}
            title={label}
            className="h-[26rem] w-full border-0"
          />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="block">
            <img
              src={url}
              alt={label}
              className="h-[26rem] w-full object-cover"
            />
          </a>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-3 dark:border-white/10">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-xs font-semibold text-[#069AFF] hover:underline dark:text-sky-200"
        >
          {url}
        </a>
      </div>
    </div>
  );
}

function DetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const user = isRecord(getRecordValue(row, ["user"])) ? (getRecordValue(row, ["user"]) as Record<string, unknown>) : null;
  const userName = user
    ? `${String(getRecordValue(user, ["first_name"]) ?? "")} ${String(getRecordValue(user, ["last_name"]) ?? "")}`.trim() || "Unknown user"
    : String(getRecordValue(row, ["userId"]) ?? "Unknown user");
  const status = String(getRecordValue(row, ["status"]) ?? "Not available");
  const verificationStatus = String(getRecordValue(row, ["verificationStatus"]) ?? "Not available");
  const createdAt = formatDate(getRecordValue(row, ["createdAt"]));
  const updatedAt = formatDate(getRecordValue(row, ["updatedAt"]));
  const approvedAt = formatDate(getRecordValue(row, ["approvedAt"]));
  const submittedTier = String(getRecordValue(row, ["tier"]) ?? "Not available");
  const requiresManualReview = Boolean(getRecordValue(row, ["requiresManualReview"]));

  const overviewItems = [
    { label: "KYC ID", value: String(getRecordValue(row, ["_id", "id"]) ?? "Not available") },
    { label: "User ID", value: String(getRecordValue(row, ["userId"]) ?? "Not available") },
    { label: "Submitted tier", value: submittedTier },
    { label: "ID type", value: String(getRecordValue(row, ["idType"]) ?? "Not available") },
    { label: "Created at", value: createdAt },
    { label: "Updated at", value: updatedAt },
    { label: "Approved at", value: approvedAt },
    { label: "Approved by", value: String(getRecordValue(row, ["approvedBy"]) ?? "Not available") },
    { label: "Reason", value: String(getRecordValue(row, ["reason"]) ?? "Not available") },
  ];

  const providerItems = [
    { label: "Verification provider", value: String(getRecordValue(row, ["verificationProvider"]) ?? "Not available") },
    { label: "Verification status", value: verificationStatus },
    { label: "Manual review", value: requiresManualReview ? "Required" : "No" },
    { label: "Verification reference", value: String(getRecordValue(row, ["verificationReference"]) ?? "Not available") },
    { label: "Verification message", value: String(getRecordValue(row, ["verificationMessage"]) ?? "Not available") },
    { label: "NIN", value: String(getRecordValue(row, ["nin"]) ?? "Not available") },
  ];

  const userItems = user
    ? [
        { label: "Name", value: userName },
        { label: "Email", value: String(getRecordValue(user, ["email"]) ?? "Not available") },
        { label: "Phone", value: String(getRecordValue(user, ["phone"]) ?? "Not available") },
        { label: "Current tier", value: String(getRecordValue(user, ["tier"]) ?? "Not available") },
        { label: "User status", value: String(getRecordValue(user, ["status"]) ?? "Not available") },
        { label: "Phone verified", value: String(getRecordValue(user, ["phoneVerified"]) ?? "Not available") },
        { label: "Email verified", value: String(getRecordValue(user, ["emailVerified"]) ?? "Not available") },
        { label: "User created", value: formatDate(getRecordValue(user, ["createdAt"])) },
      ]
    : [];

  const fileEntries = [
    ["Government ID", getRecordValue(row, ["idImagePath"])],
    ["Selfie", getRecordValue(row, ["selfieImagePath"])],
    ["Address Proof", getRecordValue(row, ["addressImagePath"])],
  ].filter(([, value]) => isHttpUrl(value)) as Array<[string, string]>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-[92rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-5 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Recent KYC detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{userName}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review the submission record, provider verification outcome, linked user profile, and uploaded documents from one inspection modal.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={status} />
              <StatusBadge status={verificationStatus} />
              {requiresManualReview ? (
                <span className="inline-flex items-center rounded-md border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-100">
                  Manual review
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-sky-100">
                Tier {submittedTier}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close KYC detail"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(94vh-9rem)] overflow-y-auto p-5">
          <div className="grid gap-5">
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Submission overview</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Core record identifiers, timestamps, and submission metadata.</p>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {overviewItems.map((item) => (
                    <DetailInfoCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Verification outcome</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Provider-side checks and the manual review signal for this submission.</p>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  {providerItems.map((item) => (
                    <DetailInfoCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
            </section>

            {Boolean(userItems.length) && (
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Linked user</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The current customer profile attached to this KYC submission.</p>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                  {userItems.map((item) => (
                    <DetailInfoCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </section>
            )}

            {Boolean(fileEntries.length) ? (
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Uploaded documents</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Preview the actual files submitted for identity and address verification.</p>
                </div>
                <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {fileEntries.map(([label, url]) => (
                    <DocumentCard key={label} label={label} url={url} />
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
                No uploaded document URLs were returned for this KYC submission.
              </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Raw payload</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Backend response retained for exact inspection and debugging.</p>
              </div>
              <div className="p-5">
                <JsonInspector label="Raw KYC payload" value={row} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecentKycsPage() {
  const router = useRouter();
  const { allowed: canOpenRecentKycs } = useRouteAccess("/recent-kycs");
  const [filters, setFilters] = useState<RecentKycFilters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<RecentKycFilters>(() => getDefaultFilters());
  const [kycs, setKycs] = useState<RecentKycState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenRecentKycs) {
      return;
    }

    void fetchRecentKycs(appliedFilters).then((result) => {
      if (!cancelled) {
        setKycs(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, canOpenRecentKycs, router]);

  const refreshRecentKycs = async (nextFilters = appliedFilters) => {
    setKycs((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchRecentKycs(nextFilters);
    setKycs(result);
  };

  const rows = kycs.rows;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const summary = useMemo(() => {
    const pendingCount = rows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "pending").length;
    const approvedCount = rows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "approved").length;
    const manualReviewCount = rows.filter((row) => Boolean(getRecordValue(row, ["requiresManualReview"]))).length;
    const uniqueUsers = new Set(rows.map((row) => String(getRecordValue(row, ["userId"]) ?? "")).filter(Boolean)).size;

    return {
      pendingCount,
      approvedCount,
      manualReviewCount,
      uniqueUsers,
    };
  }, [rows]);

  if (!canOpenRecentKycs) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8">
        <AccessDeniedState
          title="Recent KYC access denied"
          description="Your current admin role does not include permission to inspect recent KYC submissions."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Recent KYC Submissions</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Latest KYC records sorted by submission time with linked user details for review operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshRecentKycs()}
              disabled={kycs.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {kycs.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Sync
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        {!kycs.loaded ? (
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
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    KYC monitoring
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Monitor the latest KYC submissions with direct user context and provider verification outcomes.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by status, tier, user, and submission window to isolate records that need operational review.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Status</span>
                      <select
                        value={filters.status}
                        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      >
                        <option value="">All</option>
                        <option value="pending" className="text-slate-950">Pending</option>
                        <option value="approved" className="text-slate-950">Approved</option>
                        <option value="rejected" className="text-slate-950">Rejected</option>
                        <option value="failed" className="text-slate-950">Failed</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Tier</span>
                      <select
                        value={filters.tier}
                        onChange={(event) => setFilters((current) => ({ ...current, tier: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                      >
                        <option value="">All</option>
                        <option value="1" className="text-slate-950">Tier 1</option>
                        <option value="2" className="text-slate-950">Tier 2</option>
                        <option value="3" className="text-slate-950">Tier 3</option>
                      </select>
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">User ID</span>
                      <div className="relative mt-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" aria-hidden="true" />
                        <input
                          value={filters.userId}
                          onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
                          placeholder="Paste user id"
                          className="h-11 w-full rounded-lg border border-white/15 bg-white/10 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                        />
                      </div>
                    </label>
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
                    <label className="sm:col-span-2">
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
                        void refreshRecentKycs(filters);
                      }}
                      disabled={kycs.loading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-70"
                    >
                      {kycs.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getDefaultFilters();
                        setFilters(defaults);
                        setAppliedFilters(defaults);
                        void refreshRecentKycs(defaults);
                      }}
                      disabled={kycs.loading}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {kycs.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{kycs.error}</span>
                </div>
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Returned submissions" value={formatValue(rows.length)} icon={ShieldCheck} />
              <SummaryCard label="Pending review" value={formatValue(summary.pendingCount)} icon={AlertCircle} />
              <SummaryCard label="Manual review" value={formatValue(summary.manualReviewCount)} icon={Eye} />
              <SummaryCard label="Unique users" value={formatValue(summary.uniqueUsers)} icon={UserRound} />
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Recent submissions</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">KYC queue</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
                    Approved: {formatValue(summary.approvedCount)}
                  </span>
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
                    Date range: {appliedFilters.fromDate || "N/A"} to {appliedFilters.toDate || "N/A"}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Submission</th>
                      <th className="px-5 py-3">Verification</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const user = isRecord(getRecordValue(row, ["user"])) ? (getRecordValue(row, ["user"]) as Record<string, unknown>) : null;
                      const fullName = user
                        ? `${String(getRecordValue(user, ["first_name"]) ?? "")} ${String(getRecordValue(user, ["last_name"]) ?? "")}`.trim()
                        : "";

                      return (
                        <tr key={`${String(getRecordValue(row, ["_id", "id"]) ?? `kyc-${index}`)}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{fullName || String(getRecordValue(row, ["userId"]) ?? `Submission ${index + 1}`)}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{String(getRecordValue(user ?? row, ["email", "userId"]) ?? "Not available")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(user ?? row, ["phone"]) ?? "No phone")}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["idType"]) ?? "KYC submission")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tier {String(getRecordValue(row, ["tier"]) ?? "N/A")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["_id"]) ?? "No reference")}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["verificationProvider"]) ?? "Not available")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["verificationStatus"]) ?? "No verification status")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["verificationMessage"]) ?? "No verification message")}</p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-2">
                              <StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} />
                              {Boolean(getRecordValue(row, ["requiresManualReview"])) && (
                                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                                  Manual review
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                            {formatDate(getRecordValue(row, ["createdAt"]))}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setSelectedRow(row)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
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

              {!rows.length && (
                <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
                  No recent KYC submissions returned for the current filter set.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </main>
  );
}
