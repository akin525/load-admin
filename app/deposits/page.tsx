"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  Landmark,
  Loader2,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";
import { exportTableRows } from "@/lib/export/table";

type DepositFilters = {
  search: string;
  status: string;
  provider: string;
  source: string;
  channelCode: string;
  fromDate: string;
  toDate: string;
};

type DepositsState = {
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

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Request failed";
};

const getDefaultFilters = (): DepositFilters => ({
  search: "",
  status: "",
  provider: "",
  source: "",
  channelCode: "",
  fromDate: "",
  toDate: "",
});

const getDepositId = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["_id", "id", "reference", "walletTransactionId"]) ?? "");

const getAmount = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["netAmount", "grossAmount", "amount", "creditAmount", "totalAmount"]);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const getRowDate = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["createdAt", "transactionDate", "date", "updatedAt"]);

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getStatusTone = (status: unknown) => {
  const normalized = String(status ?? "pending").toLowerCase();

  if (["success", "successful", "completed", "approved", "active"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (["failed", "rejected", "reversed", "declined", "error"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";
};

const matchesDateRange = (row: Record<string, unknown>, fromDate: string, toDate: string) => {
  const rowDate = getRowDate(row);

  if (!rowDate) {
    return !fromDate && !toDate;
  }

  if (fromDate) {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    if (rowDate < start) {
      return false;
    }
  }

  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (rowDate > end) {
      return false;
    }
  }

  return true;
};

const fetchDeposits = async (): Promise<DepositsState> => {
  try {
    const payload = await adminService.getDeposits();

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

function DepositDetailsModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const providerResponse = isRecord(row.providerResponse) ? row.providerResponse : null;
  const providerData = providerResponse && isRecord(providerResponse.data) ? providerResponse.data : null;
  const amount = getAmount(row);
  const summaryItems = [
    { label: "Reference", value: getRecordValue(row, ["reference"]) },
    { label: "Status", value: getRecordValue(row, ["status"]) },
    { label: "Created", value: formatDate(getRecordValue(row, ["createdAt"])) },
    { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
    { label: "Account name", value: getRecordValue(row, ["accountName"]) },
    { label: "Account number", value: getRecordValue(row, ["accountNumber"]) },
    { label: "Bank verification", value: getRecordValue(row, ["bankVerificationCode"]) },
    { label: "Source", value: getRecordValue(row, ["source"]) },
    { label: "Provider", value: getRecordValue(row, ["provider"]) },
    { label: "Event", value: getRecordValue(row, ["event"]) },
    { label: "Session ID", value: getRecordValue(row, ["sessionID"]) },
    { label: "Channel code", value: getRecordValue(row, ["channelCode"]) },
    { label: "Gross amount", value: getRecordValue(row, ["grossAmount", "amount"]) },
    { label: "Fee amount", value: getRecordValue(row, ["feeAmount"]) },
    { label: "Net amount", value: getRecordValue(row, ["netAmount"]) },
    { label: "User ID", value: getRecordValue(row, ["userId"]) },
    { label: "Virtual account ID", value: getRecordValue(row, ["virtualAccountId"]) },
    { label: "Wallet ID", value: getRecordValue(row, ["walletId"]) },
    { label: "Customer ID", value: getRecordValue(row, ["customerId"]) },
    { label: "Wallet transaction ID", value: getRecordValue(row, ["walletTransactionId"]) },
  ].filter((item) => item.value !== undefined && item.value !== null && item.value !== "");

  const providerItems = [
    { label: "Originator name", value: getRecordValue(providerData ?? {}, ["originatorAccountName"]) },
    { label: "Originator account", value: getRecordValue(providerData ?? {}, ["originatorAccountNumber"]) },
    { label: "Originator BVN", value: getRecordValue(providerData ?? {}, ["originatorBankVerificationNumber"]) },
    { label: "Narration", value: getRecordValue(providerData ?? {}, ["narration"]) },
    { label: "Paid at", value: getRecordValue(providerData ?? {}, ["paidAt"]) },
    { label: "Destination institution", value: getRecordValue(providerData ?? {}, ["destinationInstitutionCode"]) },
    { label: "Beneficiary account", value: getRecordValue(providerData ?? {}, ["beneficiaryAccountNumber"]) },
    { label: "Beneficiary name", value: getRecordValue(providerData ?? {}, ["beneficiaryAccountName"]) },
  ].filter((item) => item.value !== undefined && item.value !== null && item.value !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-white/10 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Deposit record</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Deposit details</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {String(getRecordValue(row, ["accountName", "reference", "event"]) ?? "Selected deposit record")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close deposit details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto bg-slate-50/70 p-6 dark:bg-[#07111f]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="grid gap-6">
              <div className="rounded-2xl border border-[#069AFF]/20 bg-white p-6 shadow-sm dark:border-[#069AFF]/20 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Deposit amount</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{formatCurrency(amount)}</h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusTone(getRecordValue(row, ["status"]))}`}>
                    {String(getRecordValue(row, ["status"]) ?? "Pending")}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {String(getRecordValue(row, ["provider"]) ?? "No provider")}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Core record</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                        {typeof item.value === "number" ? formatValue(item.value) : String(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <summary className="cursor-pointer list-none px-6 py-5 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">
                  Full deposit payload
                </summary>
                <div className="border-t border-slate-100 px-6 py-5 dark:border-white/10">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              </details>
            </section>

            <aside className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Provider response</p>
                {providerItems.length ? (
                  <div className="mt-5 grid gap-3">
                    {providerItems.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{String(item.value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
                    No structured provider response fields returned.
                  </div>
                )}
              </div>

              {providerResponse && (
                <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <summary className="cursor-pointer list-none px-6 py-5 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">
                    Raw provider response
                  </summary>
                  <div className="border-t border-slate-100 px-6 py-5 dark:border-white/10">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
                      {JSON.stringify(providerResponse, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingDepositsPage() {
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

export default function DepositsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenDeposits } = useRouteAccess("/deposits");
  const [filters, setFilters] = useState<DepositFilters>(() => getDefaultFilters());
  const [deposits, setDeposits] = useState<DepositsState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [selectedDeposit, setSelectedDeposit] = useState<Record<string, unknown> | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"" | "csv" | "xlsx">("");
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenDeposits) {
      return;
    }

    void fetchDeposits().then((result) => {
      if (!cancelled) {
        setDeposits(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenDeposits, router]);

  const refreshDeposits = async () => {
    setDeposits((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchDeposits();
    setDeposits(result);
  };

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return deposits.rows.filter((row) => {
      const searchable = [
        getRecordValue(row, ["reference"]),
        getRecordValue(row, ["accountName"]),
        getRecordValue(row, ["accountNumber"]),
        getRecordValue(row, ["userId"]),
        getRecordValue(row, ["customerId"]),
        getRecordValue(row, ["walletId"]),
        getRecordValue(row, ["sessionID"]),
        getRecordValue(row, ["provider"]),
        getRecordValue(row, ["source"]),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
      const provider = String(getRecordValue(row, ["provider"]) ?? "").trim().toLowerCase();
      const source = String(getRecordValue(row, ["source"]) ?? "").trim().toLowerCase();
      const channelCode = String(getRecordValue(row, ["channelCode"]) ?? "").trim().toLowerCase();

      if (search && !searchable.includes(search)) {
        return false;
      }

      if (filters.status && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (filters.provider && provider !== filters.provider.toLowerCase()) {
        return false;
      }

      if (filters.source && source !== filters.source.toLowerCase()) {
        return false;
      }

      if (filters.channelCode && channelCode !== filters.channelCode.toLowerCase()) {
        return false;
      }

      return matchesDateRange(row, filters.fromDate, filters.toDate);
    });
  }, [deposits.rows, filters]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(filteredRows, safeCurrentPage, pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totals = useMemo(() => {
    const successCount = filteredRows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "success").length;
    const totalAmount = filteredRows.reduce((sum, row) => sum + getAmount(row), 0);
    const uniqueCustomers = new Set(
      filteredRows
        .map((row) => String(getRecordValue(row, ["userId", "customerId", "accountNumber"]) ?? ""))
        .filter(Boolean),
    ).size;
    const reachableContacts = filteredRows.filter((row) => Boolean(getRecordValue(row, ["accountName", "email"]))).length;

    return {
      successCount,
      totalAmount,
      uniqueCustomers,
      reachableContacts,
    };
  }, [filteredRows]);

  const availableValues = useMemo(() => {
    const build = (keys: string[]) =>
      Array.from(
        new Set(
          deposits.rows
            .map((row) => String(getRecordValue(row, keys) ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right));

    return {
      statuses: build(["status"]),
      providers: build(["provider"]),
      sources: build(["source"]),
      channelCodes: build(["channelCode"]),
    };
  }, [deposits.rows]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!filteredRows.length) {
      return;
    }

    setExportingFormat(format);

    try {
      await exportTableRows({
        filenameBase: `deposits-${new Date().toISOString().slice(0, 10)}`,
        format,
        sheetName: "Deposits",
        rows: filteredRows,
        columns: [
          { key: "reference", label: "Reference", value: (row) => getRecordValue(row, ["reference"]) },
          { key: "userId", label: "User ID", value: (row) => getRecordValue(row, ["userId"]) },
          { key: "customerId", label: "Customer ID", value: (row) => getRecordValue(row, ["customerId"]) },
          { key: "walletId", label: "Wallet ID", value: (row) => getRecordValue(row, ["walletId"]) },
          { key: "accountName", label: "Originator Account Name", value: (row) => getRecordValue(row, ["accountName"]) },
          { key: "accountNumber", label: "Originator Account Number", value: (row) => getRecordValue(row, ["accountNumber"]) },
          { key: "amount", label: "Amount", value: (row) => getRecordValue(row, ["amount"]) },
          { key: "grossAmount", label: "Gross Amount", value: (row) => getRecordValue(row, ["grossAmount"]) },
          { key: "feeAmount", label: "Fee Amount", value: (row) => getRecordValue(row, ["feeAmount"]) },
          { key: "netAmount", label: "Net Amount", value: (row) => getRecordValue(row, ["netAmount"]) },
          { key: "event", label: "Event", value: (row) => getRecordValue(row, ["event"]) },
          { key: "sessionID", label: "Session ID", value: (row) => getRecordValue(row, ["sessionID"]) },
          { key: "channelCode", label: "Channel Code", value: (row) => getRecordValue(row, ["channelCode"]) },
          { key: "status", label: "Status", value: (row) => getRecordValue(row, ["status"]) },
          { key: "source", label: "Source", value: (row) => getRecordValue(row, ["source"]) },
          { key: "provider", label: "Provider", value: (row) => getRecordValue(row, ["provider"]) },
          { key: "error", label: "Error", value: (row) => getRecordValue(row, ["error"]) },
          { key: "createdAt", label: "Created At", value: (row) => formatDate(getRecordValue(row, ["createdAt"])) },
          { key: "updatedAt", label: "Updated At", value: (row) => formatDate(getRecordValue(row, ["updatedAt"])) },
        ],
      });
    } finally {
      setExportingFormat("");
    }
  };

  if (!canOpenDeposits) {
    return (
      <AccessDeniedState
        title="Deposits workspace access denied"
        description="Your current admin role does not include permission to inspect deposit records."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Deposits
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Standalone workspace for inbound funding records across customer wallets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              <Landmark className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/wallet-transactions"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              Wallet Ledger
            </Link>
            <button
              type="button"
              onClick={() => void refreshDeposits()}
              disabled={deposits.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {deposits.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Sync
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-bold text-red-700 transition hover:bg-red-100 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/20"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        {!deposits.loaded ? (
          <LoadingDepositsPage />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Landmark className="h-4 w-4" aria-hidden="true" />
                    Deposit operations workspace
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review inbound funding, payment channel activity, and account funding events from one standalone deposits page.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Search by reference or account details, narrow by provider and status, and inspect provider payloads without switching back to the dashboard.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Search</span>
                      <div className="relative mt-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" aria-hidden="true" />
                        <input
                          value={filters.search}
                          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                          placeholder="Reference, account number, wallet id"
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
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { key: "status", label: "Status", options: availableValues.statuses },
                      { key: "provider", label: "Provider", options: availableValues.providers },
                      { key: "source", label: "Source", options: availableValues.sources },
                      { key: "channelCode", label: "Channel", options: availableValues.channelCodes },
                    ].map((field) => (
                      <label key={field.key}>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">{field.label}</span>
                        <select
                          value={filters[field.key as keyof DepositFilters]}
                          onChange={(event) =>
                            setFilters((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition focus:border-white/40"
                        >
                          <option value="">All</option>
                          {field.options.map((option) => (
                            <option key={option} value={option} className="text-slate-950">
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setFilters(getDefaultFilters())}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Reset filters
                    </button>
                    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-xs font-medium leading-6 text-slate-200">
                      Filters apply instantly to the deposits already loaded from the backend.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {deposits.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {deposits.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Filtered deposits" value={formatValue(filteredRows.length)} icon={Landmark} />
              <SummaryCard label="Successful deposits" value={formatValue(totals.successCount)} icon={CheckCircle2} />
              <SummaryCard label="Deposit inflow" value={formatCurrency(totals.totalAmount)} icon={WalletCards} />
              <SummaryCard label="Unique customers" value={formatValue(totals.uniqueCustomers)} icon={Users} />
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">Deposit records</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Incoming deposits across customer wallets and payment channels.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => void handleExport("csv")}
                    disabled={!filteredRows.length || exportingFormat !== ""}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                  >
                    {exportingFormat === "csv" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport("xlsx")}
                    disabled={!filteredRows.length || exportingFormat !== ""}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                  >
                    {exportingFormat === "xlsx" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    )}
                    Export Excel
                  </button>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Reachable records: {formatValue(totals.reachableContacts)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Showing {formatValue(paginatedRows.length)} of {formatValue(filteredRows.length)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Account / Customer</th>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Fee</th>
                      <th className="px-5 py-3">Provider / Source</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const name = getRecordValue(row, ["accountName", "customerName", "name", "email"]) ?? `Deposit ${index + 1}`;
                      const reference = getRecordValue(row, ["reference", "sessionID", "_id", "id"]) ?? "No reference";
                      const status = getRecordValue(row, ["status"]) ?? "Pending";
                      const provider = String(getRecordValue(row, ["provider"]) ?? "Not available");
                      const source = String(getRecordValue(row, ["source"]) ?? "Not available");

                      return (
                        <tr key={`${String(reference)}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{String(name)}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["accountNumber", "walletId", "customerId"]) ?? "No account context")}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{String(reference)}</td>
                          <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(getAmount(row))}</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-950 dark:text-white">{formatCurrency(Number(getRecordValue(row, ["feeAmount"]) ?? 0))}</span>
                              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Gross {formatCurrency(Number(getRecordValue(row, ["grossAmount", "amount"]) ?? getAmount(row)))}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{provider}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{source}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
                              {String(status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedDeposit(row)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
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
                totalItems={filteredRows.length}
                currentPage={safeCurrentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setCurrentPage(1);
                }}
              />

              {!filteredRows.length && (
                <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
                  No deposit records matched the current filters.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedDeposit && <DepositDetailsModal row={selectedDeposit} onClose={() => setSelectedDeposit(null)} />}
    </main>
  );
}
