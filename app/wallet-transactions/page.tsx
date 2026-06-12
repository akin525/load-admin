"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Search,
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

type WalletTransactionFilters = {
  search: string;
  status: string;
  type: string;
  userId: string;
  source: string;
  category: string;
  provider: string;
  fromDate: string;
  toDate: string;
  limit: string;
};

type WalletTransactionsState = {
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

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const getTransactionId = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["_id", "id", "reference", "transactionId"]) ?? "");

const getAmount = (row: Record<string, unknown>) => {
  const value = getRecordValue(row, ["amount", "creditAmount", "debitAmount", "totalAmount"]);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const getDirection = (row: Record<string, unknown>) => {
  const joined = [
    getRecordValue(row, ["type"]),
    getRecordValue(row, ["category"]),
    getRecordValue(row, ["source"]),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (/(credit|deposit|funding|topup|top-up|inflow|wallet_funding)/.test(joined)) {
    return "inflow";
  }

  if (/(debit|withdraw|disburse|repayment|bill|charge|outflow)/.test(joined)) {
    return "outflow";
  }

  return "neutral";
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

const getDirectionTone = (direction: string) => {
  if (direction === "inflow") {
    return {
      icon: ArrowDownLeft,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    };
  }

  if (direction === "outflow") {
    return {
      icon: ArrowUpRight,
      className: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
    };
  }

  return {
    icon: CreditCard,
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
  };
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): WalletTransactionFilters => {
  const now = new Date();
  return {
    search: "",
    status: "",
    type: "",
    userId: "",
    source: "",
    category: "",
    provider: "",
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(now),
    limit: "100",
  };
};

const buildRequestParams = (filters: WalletTransactionFilters) => {
  const params: Record<string, string | number> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = key === "limit" ? Number(value) : value;
  });

  return params;
};

const fetchWalletTransactions = async (filters: WalletTransactionFilters): Promise<WalletTransactionsState> => {
  try {
    const payload = await adminService.getWalletTransactions(buildRequestParams(filters));

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

function TransactionDetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const detailRecord = isRecord(row.details) ? row.details : null;
  const direction = getDirection(row);
  const directionTone = getDirectionTone(direction);
  const DirectionIcon = directionTone.icon;
  const amount = getAmount(row);
  const balanceBefore = Number(getRecordValue(row, ["bal_before"]) ?? 0);
  const balanceAfter = Number(getRecordValue(row, ["bal_after"]) ?? 0);
  const balanceDelta = Number.isNaN(balanceAfter - balanceBefore) ? amount : balanceAfter - balanceBefore;
  const note = String(getRecordValue(row, ["note"]) ?? "No transaction note provided.");
  const reference = String(getRecordValue(row, ["reference", "_id", "id"]) ?? "Not available");
  const transactionType = String(getRecordValue(row, ["transactionType"]) ?? "Not available");
  const category = String(getRecordValue(row, ["category"]) ?? "Not available");
  const billType = String(getRecordValue(row, ["billType"]) ?? "Not available");
  const provider = String(getRecordValue(row, ["provider"]) ?? "Not available");
  const source = String(getRecordValue(row, ["source"]) ?? "Not available");
  const userId = String(getRecordValue(row, ["user_id", "userId"]) ?? "Not available");
  const walletId = String(getRecordValue(row, ["wallet_id", "walletId"]) ?? "Not available");
  const accountName = String(getRecordValue(detailRecord ?? {}, ["accountName"]) ?? "");
  const accountNumber = String(getRecordValue(detailRecord ?? {}, ["accountNumber", "recipient", "customerAccountNo"]) ?? "");
  const bankName = String(getRecordValue(detailRecord ?? {}, ["bankName"]) ?? "");
  const sortCode = String(getRecordValue(detailRecord ?? {}, ["sortCode"]) ?? "");
  const serviceId = String(getRecordValue(detailRecord ?? {}, ["serviceID", "billId"]) ?? "");
  const phone = String(getRecordValue(detailRecord ?? {}, ["phone"]) ?? "");
  const narration = String(getRecordValue(detailRecord ?? {}, ["narration"]) ?? "");
  const originalReference = String(getRecordValue(detailRecord ?? {}, ["originalReference"]) ?? "");
  const customerId = String(getRecordValue(detailRecord ?? {}, ["customerId"]) ?? "");
  const sessionId = String(getRecordValue(detailRecord ?? {}, ["sessionID"]) ?? "");
  const variationCode = String(getRecordValue(detailRecord ?? {}, ["variation_code"]) ?? "");
  const meterType = String(getRecordValue(detailRecord ?? {}, ["meterType"]) ?? "");
  const virtualAccountId = String(getRecordValue(detailRecord ?? {}, ["virtualAccountId"]) ?? "");
  const eventName = String(getRecordValue(detailRecord ?? {}, ["event"]) ?? "");
  const token = String(getRecordValue(detailRecord ?? {}, ["token"]) ?? "");
  const timingItems = [
    { label: "Created", value: formatDate(getRecordValue(row, ["createdAt"])) },
    { label: "Updated", value: formatDate(getRecordValue(row, ["updatedAt"])) },
  ];
  const identityItems = [
    { label: "Transaction ID", value: String(getRecordValue(row, ["_id", "id"]) ?? "Not available") },
    { label: "Reference", value: reference },
    { label: "User ID", value: userId },
    { label: "Wallet ID", value: walletId },
  ];
  const classificationItems = [
    { label: "Type", value: String(getRecordValue(row, ["type"]) ?? "Not available") },
    { label: "Transaction Type", value: transactionType },
    { label: "Category", value: category },
    { label: "Source", value: source },
    { label: "Provider", value: provider },
    { label: "Bill Type", value: billType || "Not available" },
  ];
  const counterpartyItems = [
    { label: "Account Name", value: accountName || "Not available" },
    { label: "Account Number", value: accountNumber || "Not available" },
    { label: "Bank Name", value: bankName || "Not available" },
    { label: "Sort Code", value: sortCode || "Not available" },
    { label: "Service ID", value: serviceId || "Not available" },
    { label: "Phone", value: phone || "Not available" },
    { label: "Narration", value: narration || "Not available" },
    { label: "Original Reference", value: originalReference || "Not available" },
  ].filter((item) => item.value && item.value !== "Not available");
  const extraDetailEntries = detailRecord
    ? Object.entries(detailRecord).filter(([key]) => ![
      "accountName",
      "accountNumber",
      "recipient",
      "customerAccountNo",
      "bankName",
      "sortCode",
      "serviceID",
      "billId",
      "phone",
      "narration",
      "originalReference",
      "customerId",
      "sessionID",
      "variation_code",
      "meterType",
      "virtualAccountId",
      "event",
      "token",
    ].includes(key))
    : [];
  const operationTitle = (() => {
    const joined = `${transactionType} ${category} ${source}`.toLowerCase();

    if (joined.includes("loan_disbursement")) return "Loan disbursement";
    if (joined.includes("wallet_funding") || joined.includes("deposit")) return "Wallet funding";
    if (joined.includes("reversal")) return "Transaction reversal";
    if (joined.includes("bill_payment")) return "Bill payment";
    if (joined.includes("transfer") || joined.includes("payout")) return "Transfer payout";

    return direction === "inflow" ? "Credit received" : direction === "outflow" ? "Debit processed" : "Wallet transaction";
  })();
  const counterpartyTitle = accountName || bankName || provider || "Transaction destination";
  const channelSummary = [source, provider, billType].filter((value) => value && value !== "Not available").join(" / ");
  const serviceSummary = [serviceId, variationCode, meterType].filter(Boolean).join(" / ");
  const storyItems = [
    { label: "Counterparty", value: counterpartyTitle },
    { label: "Channel", value: channelSummary || "Not available" },
    { label: "Customer Wallet", value: walletId },
    { label: "Original Reference", value: originalReference || "Not applicable" },
  ];
  const evidenceItems = [
    { label: "Virtual Account ID", value: virtualAccountId || "Not available" },
    { label: "Customer ID", value: customerId || "Not available" },
    { label: "Session ID", value: sessionId || "Not available" },
    { label: "Service Setup", value: serviceSummary || "Not available" },
    { label: "Event", value: eventName || "Not available" },
    { label: "Utility Token", value: token || "Not available" },
  ].filter((item) => item.value !== "Not available");
  const balanceImpactTone =
    balanceDelta >= 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-[1240px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-white/10 bg-[linear-gradient(135deg,#03111f_0%,#0a2e55_45%,#069AFF_135%)] px-7 py-6 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Wallet transaction</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">{operationTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{note}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${directionTone.className} bg-white/95`}>
                <DirectionIcon className="h-4 w-4" aria-hidden="true" />
                {formatLabel(direction)}
              </span>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {String(getRecordValue(row, ["status"]) ?? "Pending")}
              </span>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {provider}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close transaction details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto bg-slate-50/70 p-6 dark:bg-[#07111f]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
            <section className="grid gap-6">
              <div className="rounded-[24px] border border-[#069AFF]/20 bg-white p-6 shadow-sm dark:border-[#069AFF]/20 dark:bg-white/[0.045]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Balance movement</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{formatCurrency(amount)}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {operationTitle} against customer wallet <span className="font-semibold text-slate-700 dark:text-slate-200">{walletId}</span>.
                    </p>
                  </div>
                  <div className={`inline-flex w-fit rounded-2xl border px-4 py-3 text-sm font-bold ${balanceImpactTone}`}>
                    {balanceDelta >= 0 ? "Balance increased" : "Balance reduced"} by {formatCurrency(Math.abs(balanceDelta))}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Before</p>
                    <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{formatCurrency(balanceBefore)}</p>
                  </div>
                  <div className="hidden h-px bg-slate-200 lg:block dark:bg-white/10" />
                  <div className={`rounded-2xl border p-4 ${balanceImpactTone}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Impact</p>
                    <p className="mt-2 text-2xl font-bold">{balanceDelta >= 0 ? "+" : ""}{formatCurrency(balanceDelta)}</p>
                  </div>
                  <div className="hidden h-px bg-slate-200 lg:block dark:bg-white/10" />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">After</p>
                    <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{formatCurrency(balanceAfter)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">What Happened</p>
                  <div className="mt-5 grid gap-3">
                    {storyItems.map((item) => (
                      <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="max-w-[65%] text-right text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Counterparty And Service</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {(counterpartyItems.length ? counterpartyItems : [{ label: "Details", value: "No structured counterparty details available" }]).map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Transaction Note</p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/40">
                  <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{note}</p>
                </div>
              </div>
            </section>

            <aside className="grid gap-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Transaction Profile</p>
                <div className="mt-5 grid gap-3">
                  {[...identityItems, ...classificationItems].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value || "Not available"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Timing And Evidence</p>
                <div className="mt-5 grid gap-3">
                  {[...timingItems, ...evidenceItems].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {extraDetailEntries.length > 0 && (
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">Additional Fields</p>
                  <div className="mt-5 grid gap-3">
                    {extraDetailEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                          {isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailRecord && (
                <details className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <summary className="cursor-pointer list-none px-6 py-5 text-xs font-bold uppercase tracking-[0.14em] text-[#069AFF]">
                    Raw Provider Payload
                  </summary>
                  <div className="border-t border-slate-100 px-6 py-5 dark:border-white/10">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-300">
                      {JSON.stringify(detailRecord, null, 2)}
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

function LoadingWalletTransactions() {
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

export default function WalletTransactionsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenWalletLedger } = useRouteAccess("/wallet-transactions");
  const [filters, setFilters] = useState<WalletTransactionFilters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<WalletTransactionFilters>(() => getDefaultFilters());
  const [transactions, setTransactions] = useState<WalletTransactionsState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Record<string, unknown> | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenWalletLedger) {
      return;
    }

    void fetchWalletTransactions(appliedFilters).then((result) => {
      if (!cancelled) {
        setTransactions(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, canOpenWalletLedger, router]);

  const refreshTransactions = async (nextFilters = appliedFilters) => {
    setTransactions((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchWalletTransactions(nextFilters);
    setTransactions(result);
  };

  const rows = transactions.rows;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const totals = useMemo(() => {
    const successCount = rows.filter((row) => String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "success").length;
    const inflow = rows
      .filter((row) => getDirection(row) === "inflow")
      .reduce((sum, row) => sum + getAmount(row), 0);
    const outflow = rows
      .filter((row) => getDirection(row) === "outflow")
      .reduce((sum, row) => sum + getAmount(row), 0);
    const uniqueUsers = new Set(
      rows
        .map((row) => String(getRecordValue(row, ["userId", "user_id", "customerId"]) ?? ""))
        .filter(Boolean),
    ).size;

    return {
      successCount,
      inflow,
      outflow,
      uniqueUsers,
    };
  }, [rows]);

  const availableValues = useMemo(() => {
    const build = (keys: string[]) =>
      Array.from(
        new Set(
          rows
            .map((row) => String(getRecordValue(row, keys) ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right));

    return {
      statuses: build(["status"]),
      types: build(["type"]),
      categories: build(["category"]),
      sources: build(["source"]),
      providers: build(["provider"]),
    };
  }, [rows]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  if (!canOpenWalletLedger) {
    return (
      <AccessDeniedState
        title="Wallet ledger access denied"
        description="Your current admin role does not include permission to inspect wallet transactions."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Wallet Transactions
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Full ledger of all wallet-related movements and credit entries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshTransactions()}
              disabled={transactions.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {transactions.loading ? (
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
        {!transactions.loaded ? (
          <LoadingWalletTransactions />
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <WalletCards className="h-4 w-4" aria-hidden="true" />
                    Cash movement workspace
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Inspect wallet funding, disbursements, repayments, and provider transaction flow from one ledger view.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Filter by user, type, category, source, provider, and reporting window to isolate transaction streams quickly without leaving the admin environment.
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
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">User ID</span>
                      <input
                        value={filters.userId}
                        onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
                        placeholder="Paste user id"
                        className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-300 focus:border-white/40"
                      />
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

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { key: "status", label: "Status", options: availableValues.statuses },
                      { key: "type", label: "Type", options: availableValues.types },
                      { key: "category", label: "Category", options: availableValues.categories },
                      { key: "source", label: "Source", options: availableValues.sources },
                      { key: "provider", label: "Provider", options: availableValues.providers },
                    ].map((field) => (
                      <label key={field.key}>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">{field.label}</span>
                        <select
                          value={filters[field.key as keyof WalletTransactionFilters]}
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
                      onClick={() => {
                        setAppliedFilters(filters);
                        void refreshTransactions(filters);
                      }}
                      disabled={transactions.loading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-70"
                    >
                      {transactions.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getDefaultFilters();
                        setFilters(defaults);
                        setAppliedFilters(defaults);
                        void refreshTransactions(defaults);
                      }}
                      disabled={transactions.loading}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {transactions.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{transactions.error}</span>
                </div>
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Returned records" value={formatValue(rows.length)} icon={WalletCards} />
              <SummaryCard label="Successful transactions" value={formatValue(totals.successCount)} icon={Landmark} />
              <SummaryCard label="Inflow volume" value={formatCurrency(totals.inflow)} icon={ArrowDownLeft} />
              <SummaryCard label="Outflow volume" value={formatCurrency(totals.outflow)} icon={ArrowUpRight} />
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#069AFF]">Transaction ledger</p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Wallet movement history</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
                    Unique users: {formatValue(totals.uniqueUsers)}
                  </span>
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
                    Range: {appliedFilters.fromDate || "N/A"} to {appliedFilters.toDate || "N/A"}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Movement</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {paginatedRows.map((row, index) => {
                      const direction = getDirection(row);
                      const directionTone = getDirectionTone(direction);
                      const DirectionIcon = directionTone.icon;

                      return (
                        <tr key={`${getTransactionId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-950 dark:text-white">
                              {String(getRecordValue(row, ["reference", "_id", "id"]) ?? `Transaction ${index + 1}`)}
                            </p>
                            <p className="mt-1 break-all text-xs font-medium text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["walletId", "accountNumber", "customerId"]) ?? "No secondary identifier")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">
                              {String(getRecordValue(row, ["userName", "customerName", "userId", "user_id"]) ?? "Unknown customer")}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["userId", "user_id", "customerId"]) ?? "Not available")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-bold ${directionTone.className}`}>
                              <DirectionIcon className="h-4 w-4" aria-hidden="true" />
                              {formatLabel(direction)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-white">
                              {String(getRecordValue(row, ["category", "type"]) ?? "Not available")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["type", "provider"]) ?? "No type")}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(getAmount(row))}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${getStatusTone(getRecordValue(row, ["status"]))}`}>
                              {String(getRecordValue(row, ["status"]) ?? "Pending")}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p>{String(getRecordValue(row, ["source", "provider"]) ?? "Not available")}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {String(getRecordValue(row, ["provider"]) ?? "No provider")}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                            {formatDate(getRecordValue(row, ["createdAt", "updatedAt", "date", "transactionDate"]))}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(row)}
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
                  No wallet transactions returned for the current filter set.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          row={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </main>
  );
}
