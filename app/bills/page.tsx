"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type BillFilters = {
  search: string;
  serviceType: string;
  providerType: string;
  status: string;
  fromDate: string;
  toDate: string;
};

type BillsState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type SelectedBillState = {
  id: string;
  data: unknown;
  loading: boolean;
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

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): BillFilters => {
  const now = new Date();

  return {
    search: "",
    serviceType: "",
    providerType: "",
    status: "",
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
  };
};

const getBillId = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["_id", "id", "reference"]) ?? "");

const getAmount = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["amount", "billAmount", "total", "totalAmount"]);
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

const getStatusTone = (status: unknown) => {
  const normalized = String(status ?? "pending").toLowerCase();

  if (["success", "successful", "completed", "approved", "active", "delivered"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (["failed", "rejected", "reversed", "declined", "error"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";
};

const fetchBills = async (): Promise<BillsState> => {
  try {
    const payload = await adminService.getBillHistory();

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

function StatusBadge({ status }: { status: unknown }) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
      {String(status ?? "Pending")}
    </span>
  );
}

function BillDetailSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h3 className="font-bold text-slate-950 dark:text-white">{title}</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BillDetailsModal({
  state,
  onClose,
}: {
  state: SelectedBillState;
  onClose: () => void;
}) {
  const detail = unwrapPayload(state.data);
  const record = isRecord(detail) ? detail : {};
  const providerResponse = isRecord(getRecordValue(record, ["providerResponse"])) ? (getRecordValue(record, ["providerResponse"]) as Record<string, unknown>) : null;
  const providerContent = providerResponse && isRecord(providerResponse.content) ? providerResponse.content : null;
  const providerTransaction = providerContent && isRecord(providerContent.transactions) ? providerContent.transactions : null;
  const commissionDetails = providerTransaction && isRecord(providerTransaction.commission_details) ? providerTransaction.commission_details : null;

  const summaryCards = [
    { label: "Recipient", value: String(getRecordValue(record, ["recipient"]) ?? "Not available"), icon: Send },
    { label: "Customer account", value: String(getRecordValue(record, ["customerAccountNo"]) ?? "Not available"), icon: FileText },
    { label: "Bill amount", value: formatCurrency(getRecordValue(record, ["amount"])), icon: WalletCards },
    { label: "Created", value: formatDate(getRecordValue(record, ["createdAt"])), icon: Landmark },
  ];

  const transactionItems = [
    { label: "Bill ID", value: String(getRecordValue(record, ["billId"]) ?? "Not available") },
    { label: "Service type", value: String(getRecordValue(record, ["serviceType"]) ?? "Not available") },
    { label: "Provider type", value: String(getRecordValue(record, ["providerType"]) ?? "Not available") },
    { label: "Reference", value: String(getRecordValue(record, ["reference"]) ?? "Not available") },
    { label: "User ID", value: String(getRecordValue(record, ["userId"]) ?? "Not available") },
    {
      label: "Token / purchased code",
      value: String(getRecordValue(record, ["token"]) || getRecordValue(providerResponse ?? {}, ["purchased_code"]) || "Not available"),
    },
  ];

  const customerItems = [
    { label: "Recipient", value: String(getRecordValue(record, ["recipient"]) ?? "Not available") },
    { label: "Customer account no", value: String(getRecordValue(record, ["customerAccountNo"]) ?? "Not available") },
    { label: "Provider email", value: String(getRecordValue(providerTransaction ?? {}, ["email"]) ?? "Not available") },
    { label: "Provider phone", value: String(getRecordValue(providerTransaction ?? {}, ["phone"]) ?? "Not available") },
    { label: "Unique element", value: String(getRecordValue(providerTransaction ?? {}, ["unique_element"]) ?? "Not available") },
    { label: "Product name", value: String(getRecordValue(providerTransaction ?? {}, ["product_name"]) ?? "Not available") },
  ];

  const settlementItems = [
    { label: "Unit price", value: formatCurrency(getRecordValue(providerTransaction ?? {}, ["unit_price"])) },
    { label: "Quantity", value: formatValue(getRecordValue(providerTransaction ?? {}, ["quantity"])) },
    { label: "Commission", value: formatCurrency(getRecordValue(providerTransaction ?? {}, ["commission"])) },
    { label: "Net total", value: formatCurrency(getRecordValue(providerTransaction ?? {}, ["total_amount"])) },
    { label: "Convenience fee", value: formatCurrency(getRecordValue(providerTransaction ?? {}, ["convinience_fee"])) },
    { label: "Discount", value: String(getRecordValue(providerTransaction ?? {}, ["discount"]) ?? "Not available") },
  ];

  const deliveryItems = [
    { label: "Response code", value: String(getRecordValue(providerResponse ?? {}, ["code"]) ?? "Not available") },
    { label: "Response description", value: String(getRecordValue(providerResponse ?? {}, ["response_description"]) ?? "Not available") },
    { label: "Provider request ID", value: String(getRecordValue(providerResponse ?? {}, ["requestId"]) ?? "Not available") },
    { label: "Transaction status", value: String(getRecordValue(providerTransaction ?? {}, ["status"]) ?? "Not available") },
    { label: "Transaction ID", value: String(getRecordValue(providerTransaction ?? {}, ["transactionId"]) ?? "Not available") },
    { label: "Transaction date", value: formatDate(getRecordValue(providerResponse ?? {}, ["transaction_date"])) },
    { label: "Channel", value: String(getRecordValue(providerTransaction ?? {}, ["channel"]) ?? "Not available") },
    { label: "Platform", value: String(getRecordValue(providerTransaction ?? {}, ["platform"]) ?? "Not available") },
    { label: "Method", value: String(getRecordValue(providerTransaction ?? {}, ["method"]) ?? "Not available") },
  ];

  const commissionItems = commissionDetails
    ? [
        { label: "Commission amount", value: formatCurrency(getRecordValue(commissionDetails, ["amount"])) },
        { label: "Rate", value: String(getRecordValue(commissionDetails, ["rate"]) ?? "Not available") },
        { label: "Rate type", value: String(getRecordValue(commissionDetails, ["rate_type"]) ?? "Not available") },
        { label: "Computation type", value: String(getRecordValue(commissionDetails, ["computation_type"]) ?? "Not available") },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_55%,#069AFF_145%)] px-5 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Bill transaction details</p>
            <h2 className="mt-2 break-words text-2xl font-bold tracking-tight">
              {String(getRecordValue(record, ["serviceType", "providerType"]) ?? "Bill transaction")}
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-slate-300">
              Provider: {String(getRecordValue(record, ["providerType"]) ?? "Not available")} · Reference: {String(getRecordValue(record, ["reference"]) ?? "No reference")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close bill details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          {state.loading && (
            <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading bill details
            </div>
          )}

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && (
            <div className="grid gap-5">
              <section className="rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_55%,#069AFF_145%)] p-5 text-white shadow-lg shadow-[#069AFF]/10 dark:border-[#069AFF]/25">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Primary reference</p>
                    <p className="mt-2 break-words text-lg font-bold">{String(getRecordValue(record, ["reference"]) ?? "No reference")}</p>
                    <p className="mt-2 text-sm text-slate-300">{formatDate(getRecordValue(record, ["updatedAt", "createdAt"]))}</p>
                  </div>
                  <div className="rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Bill amount</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight">{formatCurrency(getRecordValue(record, ["amount"]))}</p>
                    <div className="mt-3">
                      <StatusBadge status={getRecordValue(record, ["status"])} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:text-sky-200">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-bold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  );
                })}
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <BillDetailSection title="Transaction profile" items={transactionItems} />
                <BillDetailSection title="Customer and service routing" items={customerItems} />
                <BillDetailSection title="Settlement and charges" items={settlementItems} />
                <BillDetailSection title="Provider delivery response" items={deliveryItems} />
              </div>

              {commissionItems.length > 0 && <BillDetailSection title="Commission details" items={commissionItems} />}

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Provider response payload</h3>
                  </div>
                  <div className="p-4">
                    {providerResponse ? (
                      <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
                        <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                          {JSON.stringify(providerResponse, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                        No provider response returned.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Core bill record</h3>
                  </div>
                  <div className="p-4">
                    <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                        {JSON.stringify(record, null, 2)}
                      </pre>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingBillsPage() {
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

export default function BillsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenBills } = useRouteAccess("/bills");
  const [filters, setFilters] = useState<BillFilters>(() => getDefaultFilters());
  const [bills, setBills] = useState<BillsState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [selectedBill, setSelectedBill] = useState<SelectedBillState | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenBills) {
      return;
    }

    void fetchBills().then((result) => {
      if (!cancelled) {
        setBills(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenBills, router]);

  const refreshBills = async () => {
    setBills((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchBills();
    setBills(result);
  };

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return bills.rows.filter((row) => {
      const searchable = [
        getRecordValue(row, ["reference"]),
        getRecordValue(row, ["recipient"]),
        getRecordValue(row, ["customerAccountNo"]),
        getRecordValue(row, ["providerType"]),
        getRecordValue(row, ["serviceType"]),
        getRecordValue(row, ["userId"]),
        getRecordValue(row, ["billId"]),
        getRecordValue(row, ["token"]),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
      const serviceType = String(getRecordValue(row, ["serviceType"]) ?? "").trim().toLowerCase();
      const providerType = String(getRecordValue(row, ["providerType"]) ?? "").trim().toLowerCase();

      if (search && !searchable.includes(search)) {
        return false;
      }

      if (filters.status && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (filters.serviceType && serviceType !== filters.serviceType.toLowerCase()) {
        return false;
      }

      if (filters.providerType && providerType !== filters.providerType.toLowerCase()) {
        return false;
      }

      return matchesDateRange(row, filters.fromDate, filters.toDate);
    });
  }, [bills.rows, filters]);

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
    const failedCount = filteredRows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "failed").length;
    const totalAmount = filteredRows.reduce((sum, row) => sum + getAmount(row), 0);
    const uniqueCustomers = new Set(
      filteredRows
        .map((row) => String(getRecordValue(row, ["customerAccountNo", "recipient", "userId"]) ?? ""))
        .filter(Boolean),
    ).size;

    return {
      successCount,
      failedCount,
      totalAmount,
      uniqueCustomers,
    };
  }, [filteredRows]);

  const availableValues = useMemo(() => {
    const build = (keys: string[]) =>
      Array.from(
        new Set(
          bills.rows
            .map((row) => String(getRecordValue(row, keys) ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right));

    return {
      statuses: build(["status"]),
      serviceTypes: build(["serviceType"]),
      providerTypes: build(["providerType"]),
    };
  }, [bills.rows]);

  const handleViewBill = async (id: string) => {
    setSelectedBill({ id, data: null, loading: true, error: "" });

    try {
      const data = await adminService.getBillDetails(id);
      setSelectedBill({ id, data, loading: false, error: "" });
    } catch (error) {
      setSelectedBill({ id, data: null, loading: false, error: getErrorMessage(error) });
    }
  };

  const handleReverseBill = async (id: string) => {
    setReversingId(id);

    try {
      await adminService.failReverseBill(id);
      await refreshBills();

      if (selectedBill?.id === id) {
        await handleViewBill(id);
      }
    } catch (error) {
      setBills((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    } finally {
      setReversingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  if (!canOpenBills) {
    return (
      <AccessDeniedState
        title="Bills workspace access denied"
        description="Your current admin role does not include permission to inspect bill records."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Bills</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Standalone workspace for bill payments, delivery responses, and reversal control.
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
              href="/vtpass-webhook-logs"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              VTPass Webhooks
            </Link>
            <button
              type="button"
              onClick={() => void refreshBills()}
              disabled={bills.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {bills.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
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
        {!bills.loaded ? (
          <LoadingBillsPage />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Bill operations workspace
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Review bill payments, provider delivery responses, and failed-to-success reconciliation from one standalone page.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Search by reference, recipient, account number, or bill ID, filter by service and status, and inspect provider payloads without returning to the dashboard.
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
                          placeholder="Reference, recipient, account number, bill id"
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

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { key: "serviceType", label: "Service", options: availableValues.serviceTypes },
                      { key: "providerType", label: "Provider", options: availableValues.providerTypes },
                      { key: "status", label: "Status", options: availableValues.statuses },
                    ].map((field) => (
                      <label key={field.key}>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">{field.label}</span>
                        <select
                          value={filters[field.key as keyof BillFilters]}
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
                      Filters apply instantly to the bill records already loaded from the backend.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {bills.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {bills.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Filtered bills" value={formatValue(filteredRows.length)} icon={FileText} />
              <SummaryCard label="Successful bills" value={formatValue(totals.successCount)} icon={CheckCircle2} />
              <SummaryCard label="Failed bills" value={formatValue(totals.failedCount)} icon={AlertCircle} />
              <SummaryCard label="Bill volume" value={formatCurrency(totals.totalAmount)} icon={WalletCards} />
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">Bill transaction history</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administrative billing records and provider delivery responses.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <Landmark className="h-4 w-4" aria-hidden="true" />
                    Unique accounts: {formatValue(totals.uniqueCustomers)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Showing {formatValue(paginatedRows.length)} of {formatValue(filteredRows.length)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Customer / Recipient</th>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Provider</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const id = getBillId(row);
                      const name = getRecordValue(row, ["customerName", "name", "fullName", "userName", "recipient", "email"]) ?? `Bill ${index + 1}`;
                      const reference = getRecordValue(row, ["reference", "requestId", "transactionId", "billId"]) ?? "No reference";
                      const service = getRecordValue(row, ["serviceType", "providerType", "service", "type"]) ?? "Bill";
                      const amount = getRecordValue(row, ["amount", "billAmount", "total", "totalAmount"]);
                      const status = getRecordValue(row, ["status", "paymentStatus", "billStatus"]);
                      const createdAt = getRecordValue(row, ["createdAt", "date", "transactionDate", "updatedAt"]);
                      const failed = String(status ?? "").toLowerCase() === "failed";

                      return (
                        <tr key={`${id || reference}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">{String(name)}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(reference)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">{String(service)}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["customerAccountNo", "recipient"]) ?? "No account context")}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(amount)}</td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["providerType"]) ?? "Not available")}</td>
                          <td className="px-5 py-4"><StatusBadge status={status} /></td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(createdAt)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={!id}
                                onClick={() => void handleViewBill(id)}
                                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                                View
                              </button>
                              <button
                                type="button"
                                disabled={!id || failed || reversingId === id}
                                onClick={() => void handleReverseBill(id)}
                                className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                              >
                                {reversingId === id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                )}
                                Reverse
                              </button>
                            </div>
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
                  No bill records matched the current filters.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedBill && <BillDetailsModal state={selectedBill} onClose={() => setSelectedBill(null)} />}
    </main>
  );
}
