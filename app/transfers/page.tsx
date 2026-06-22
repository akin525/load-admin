"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Send,
  X,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type TransferFilters = {
  search: string;
  status: string;
  userId: string;
  fromDate: string;
  toDate: string;
  limit: number;
};

type TransfersState = {
  rows: any[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type ActionNotice = {
  tone: "success" | "error" | "warning";
  message: string;
};

type UserLabelMap = Record<string, { name: string; email: string }>;

const STATUS_VARIANTS: Record<string, { label: string; icon: any; className: string }> = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  },
};

const formatAmount = (value: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;

    if (payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string") {
      return (payload as { message: string }).message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
};

const isPendingApprovalResponse = (payload: unknown) =>
  Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (((payload as Record<string, unknown>).pending_approval === true ||
        (payload as Record<string, unknown>).pendingApproval === true ||
        String((payload as Record<string, unknown>).status ?? "").toLowerCase() === "pending_approval")),
  );

const getPendingRequestId = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const direct = [record.requestId, record.request_id]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (direct) {
    return direct;
  }

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const nested = [(record.data as Record<string, unknown>).requestId, (record.data as Record<string, unknown>).request_id]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (nested) {
      return nested;
    }
  }

  return "";
};

const getUserDisplayNameFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { name: "", email: "" };
  }

  const detail =
    "data" in payload && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  const directName = [detail.fullName, detail.name, detail.userName, detail.displayName]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
  const directEmail = typeof detail.email === "string" ? detail.email : "";

  if (directName) {
    return { name: directName, email: directEmail };
  }

  const firstName = typeof detail.firstName === "string" ? detail.firstName : typeof detail.firstname === "string" ? detail.firstname : "";
  const lastName = typeof detail.lastName === "string" ? detail.lastName : typeof detail.lastname === "string" ? detail.lastname : "";

  return {
    name: [firstName, lastName].filter(Boolean).join(" ").trim(),
    email: directEmail,
  };
};

function TransferDetailModal({
  transferId,
  onClose,
}: {
  transferId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await adminService.getTransferById(transferId);
        const payload = (response as any).data || response;
        setTransfer(payload);
      } catch (err) {
        setError("Unable to load transfer details.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDetails();
  }, [transferId]);

  const providerTransfer = transfer?.providerResponse?.transfer;
  const providerMetadata = providerTransfer?.metadata;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1728]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-white/[0.08]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Full Transfer Record</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Detailed audit trail for {transfer?.reference || "..."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#069AFF]" />
              <p className="mt-4 text-sm font-semibold text-slate-500">Retrieving full record...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Status and Primary Amount */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-50 p-6 dark:bg-white/5">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Principal Amount</p>
                    <p className="text-3xl font-black text-[#069AFF]">{formatAmount(transfer.amount)}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-200 dark:bg-white/10" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Debit</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{formatAmount(transfer.totalDebitAmount)}</p>
                  </div>
                </div>
                {transfer.status && (
                  <div className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black shadow-sm ${STATUS_VARIANTS[transfer.status]?.className || ""}`}>
                    {(() => {
                      const VariantIcon = STATUS_VARIANTS[transfer.status]?.icon || AlertCircle;
                      return <VariantIcon className="h-5 w-5" />;
                    })()}
                    {STATUS_VARIANTS[transfer.status]?.label || transfer.status}
                  </div>
                )}
              </div>

              {/* Error Message if Failed */}
              {transfer.status === "failed" && transfer.providerResponse?.message && (
                <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-black uppercase tracking-wider text-[10px] mb-1">Provider Error Message</p>
                    <p className="text-base">{transfer.providerResponse.message}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Core Transfer Info */}
                <div className="space-y-6 lg:col-span-1">
                  <SectionTitle title="Core Information" />
                  <div className="space-y-4 rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                    <DetailItem label="Internal Reference" value={transfer.reference} copyable />
                    <DetailItem label="Wallet Type" value={transfer.walletType} />
                    <DetailItem label="Provider" value={transfer.provider} />
                    <DetailItem label="Date Created" value={formatDate(transfer.createdAt)} />
                    <DetailItem label="Last Updated" value={formatDate(transfer.updatedAt)} />
                  </div>

                  <SectionTitle title="Customer Details" />
                  <div className="space-y-4 rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                    {transfer.user ? (
                      <>
                        <DetailItem label="Name" value={transfer.user.name} />
                        <DetailItem label="Email" value={transfer.user.email} copyable />
                        <DetailItem label="Phone" value={transfer.user.phone} copyable />
                        <DetailItem label="Mongo ID" value={transfer.user._id} copyable />
                      </>
                    ) : (
                      <p className="text-sm italic text-slate-400">User data unavailable.</p>
                    )}
                  </div>
                </div>

                {/* Recipient & Provider Info */}
                <div className="space-y-6 lg:col-span-2">
                  <SectionTitle title="Recipient & Bank Details" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                    <DetailItem label="Account Name" value={transfer.accountName} />
                    <DetailItem label="Account Number" value={transfer.accountNumber} copyable />
                    <DetailItem label="Bank Name" value={transfer.bankName} />
                    <DetailItem label="Sort Code" value={transfer.sortCode} />
                  </div>

                  {providerTransfer && (
                    <>
                      <SectionTitle title="Provider Transaction Data" />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-2xl border border-[#069AFF]/10 bg-[#069AFF]/5 p-5 dark:border-[#069AFF]/20">
                        <DetailItem label="Session ID" value={providerTransfer.sessionID} copyable />
                        <DetailItem label="Provider Ref" value={providerTransfer.reference} copyable />
                        <DetailItem label="Transaction ID" value={providerTransfer.transactionId} copyable />
                        <DetailItem label="Destination" value={providerTransfer.destination} />
                        <DetailItem label="Route" value={providerMetadata?.transferRoute} />
                        <DetailItem label="Name Enquiry Ref" value={providerMetadata?.nameEnquiryRef} copyable />
                        <DetailItem label="Paid At" value={formatDate(providerTransfer.paidAt)} />
                      </div>

                      <SectionTitle title="Provider Wallet Link" />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                        <DetailItem label="Wallet ID" value={providerTransfer.walletId} copyable />
                        <DetailItem label="Wallet Acc Name" value={providerMetadata?.walletAccountName} />
                        <DetailItem label="Wallet Acc Number" value={providerMetadata?.walletAccountNumber} copyable />
                        <DetailItem label="Merchant ID" value={providerTransfer.merchantId} copyable />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Description & Narration */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <SectionTitle title="Internal Narration" />
                  <div className="rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {transfer.narration || "No narration provided."}
                    </p>
                  </div>
                </div>
                {providerTransfer?.description && (
                  <div className="space-y-3">
                    <SectionTitle title="Provider Description" />
                    <div className="rounded-2xl border border-slate-100 p-5 dark:border-white/10">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {providerTransfer.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Breakdown Grid */}
              <SectionTitle title="Detailed Financial Breakdown" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <FinancialCard label="Principal" value={transfer.amount} />
                <FinancialCard label="Internal Fee" value={transfer.feeAmount} />
                <FinancialCard label="Total Debit" value={transfer.totalDebitAmount} highlight />
                {providerTransfer && (
                  <>
                    <FinancialCard label="Provider Charges" value={providerTransfer.charges} />
                    <FinancialCard label="Provider VAT" value={providerTransfer.vat} />
                    <FinancialCard label="Provider Total" value={providerTransfer.total} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
      {title}
    </h4>
  );
}

function FinancialCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 transition ${
      highlight 
        ? "border-[#069AFF]/20 bg-[#069AFF]/5 dark:bg-[#069AFF]/10" 
        : "border-slate-100 bg-white dark:border-white/5 dark:bg-white/[0.02]"
    }`}>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-sm font-black ${highlight ? "text-[#069AFF]" : "text-slate-900 dark:text-white"}`}>
        {formatAmount(value || 0)}
      </p>
    </div>
  );
}

function DetailItem({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  const handleCopy = () => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
  };

  return (
    <div className="group flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{value || "-"}</span>
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="opacity-0 transition group-hover:opacity-100 text-[#069AFF] hover:underline text-[10px] font-black uppercase"
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const { allowed } = useRouteAccess("/transfers");
  const [filters, setFilters] = useState<TransferFilters>({
    search: "",
    status: "",
    userId: "",
    fromDate: "",
    toDate: "",
    limit: 1000,
  });

  const [state, setState] = useState<TransfersState>({
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState("");
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [userLabels, setUserLabels] = useState<UserLabelMap>({});

  const fetchTransfers = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const response = await adminService.getTransfers(filters as any);
      const payload = (response as any).data || response;
      
      // Handle nested data structure: { success: true, data: { total: 31, data: [...] } }
      const rows = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      
      setState({
        rows,
        loading: false,
        loaded: true,
        error: "",
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || "Failed to fetch transfers.",
      }));
    }
  }, [filters]);

  useEffect(() => {
    if (allowed) {
      void fetchTransfers();
    }
  }, [allowed, fetchTransfers]);

  const filteredRows = useMemo(() => {
    return state.rows;
  }, [state.rows]);

  const paginatedRows = useMemo(() => {
    return paginateItems(filteredRows, currentPage, pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    const visibleUserIds = Array.from(
      new Set(
        paginatedRows
          .map((row) => String(row.user_id || row.userId || row.metadata?.userId || "").trim())
          .filter(Boolean),
      ),
    ).filter((userId) => !userLabels[userId]);

    if (!visibleUserIds.length) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      visibleUserIds.map(async (userId) => {
        try {
          const payload = await adminService.getUserDetails(userId);
          return [userId, getUserDisplayNameFromPayload(payload)] as const;
        } catch {
          return [userId, { name: userId, email: "" }] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setUserLabels((current) => {
        const next = { ...current };
        entries.forEach(([userId, detail]) => {
          next[userId] = detail;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [paginatedRows, userLabels]);

  const handleReverseTransfer = async (id: string) => {
    if (!id) {
      setNotice({ tone: "error", message: "This transfer has no identifier for reversal." });
      return;
    }

    setReversingId(id);
    setNotice(null);

    try {
      const response = await adminService.reverseTransfer(id);
      const requestId = getPendingRequestId(response);
      setNotice({
        tone: isPendingApprovalResponse(response) ? "warning" : "success",
        message: requestId ? `Transfer reversal submitted. Request ID: ${requestId}` : "Transfer reversal submitted.",
      });
      await fetchTransfers();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setReversingId("");
    }
  };

  if (!allowed) {
    return <AccessDeniedState />;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#070C14] lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#069AFF] text-white shadow-lg shadow-[#069AFF]/20">
                <Send className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Bank Transfers</h1>
            </div>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Manage and monitor all outgoing bank transfers across the platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchTransfers()}
              disabled={state.loading}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0d1728] lg:grid-cols-4 lg:items-end">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Reference, name, account..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">To Date</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1728]">
          {notice && (
            <div
              className={`border-b px-6 py-4 text-sm font-semibold ${
                notice.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                  : notice.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{notice.message}</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-white/[0.04] dark:bg-white/[0.02]">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Initiated By</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {state.loading ? (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-[#069AFF]" />
                        <p className="text-sm font-bold text-slate-500">Retrieving transfers...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRows.length > 0 ? (
                  paginatedRows.map((row) => {
                    const canReverse = String(row.status ?? "").toLowerCase() === "success";
                    const userId = String(row.user_id || row.userId || row.metadata?.userId || "").trim();
                    const embeddedName = typeof row.user?.name === "string" && row.user.name.trim() ? row.user.name : "";
                    const embeddedEmail = typeof row.user?.email === "string" ? row.user.email : "";
                    const resolvedUser = userId ? userLabels[userId] : undefined;
                    const initiatorName = embeddedName || resolvedUser?.name || userId || "N/A";
                    const initiatorEmail = embeddedEmail || resolvedUser?.email || userId || "-";

                    return (
                    <tr key={row._id} className="group transition hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{row.reference}</span>
                          <span className="text-[10px] font-bold text-slate-400">{row.bankName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{row.accountName}</span>
                          <span className="text-[10px] font-bold text-slate-400">{row.accountNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{initiatorName}</span>
                          <span className="text-[10px] font-bold text-slate-400">{initiatorEmail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-black text-[#069AFF]">{formatAmount(row.amount)}</span>
                      </td>
                      <td className="px-6 py-5">
                        {row.status && (
                          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_VARIANTS[row.status]?.className || ""}`}>
                            {(() => {
                              const VariantIcon = STATUS_VARIANTS[row.status]?.icon || AlertCircle;
                              return <VariantIcon className="h-3 w-3" />;
                            })()}
                            {STATUS_VARIANTS[row.status]?.label || row.status}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(row.createdAt)}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedTransferId(row._id)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-[#069AFF] group-hover:text-white dark:bg-white/5 dark:text-slate-400"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void handleReverseTransfer(row._id)}
                            disabled={!canReverse || reversingId === row._id}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-wider text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                          >
                            {reversingId === row._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Reverse
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                          <Send className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">No transfers found matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            totalItems={filteredRows.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            label="transfers"
          />
        </div>
      </div>

      {selectedTransferId && (
        <TransferDetailModal
          transferId={selectedTransferId}
          onClose={() => setSelectedTransferId(null)}
        />
      )}
    </main>
  );
}
