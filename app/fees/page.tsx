"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  Plus,
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

type FeeFilters = {
  type: string;
  scope: string;
  userId: string;
};

type BillPricingFilters = {
  serviceType: string;
  providerType: string;
  serviceID: string;
  variationCode: string;
  meterType: string;
};

type FeeState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type BillPricingState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type UserState = {
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type FeeModalPreset = {
  scope: "default" | "user";
  type: "payin" | "payout";
  title: string;
  description: string;
  initialValues?: {
    userId?: string;
    feeType?: "percentage" | "flat";
    value?: string;
    minFee?: string;
    maxFee?: string;
    providerFeeType?: "percentage" | "flat";
    providerFeeValue?: string;
    providerMinFee?: string;
    providerMaxFee?: string;
    description?: string;
  };
};

type BillPricingModalState = {
  mode: "create" | "edit";
  title: string;
  description: string;
  submitLabel: string;
  rowId?: string;
  initialValues?: {
    serviceType?: string;
    providerType?: string;
    serviceID?: string;
    variationCode?: string;
    meterType?: string;
    productLabel?: string;
    providerCommissionModel?: "commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat";
    providerCommissionValue?: string;
    providerCommissionCap?: string;
    customerChargeType?: "flat" | "percentage";
    customerChargeValue?: string;
    customerMinFee?: string;
    customerMaxFee?: string;
  };
};

type BillPricingPreviewState = {
  open: boolean;
  amount: string;
  serviceType: string;
  providerType: string;
  serviceID: string;
  variationCode: string;
  meterType: string;
  submitting: boolean;
  error: string;
  result: unknown;
};

type FeeResolveState = {
  open: boolean;
  type: "payin" | "payout";
  amount: string;
  userId: string;
  submitting: boolean;
  error: string;
  result: unknown;
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

const getId = (record: Record<string, unknown>) => String(getRecordValue(record, ["_id", "id", "feeId"]) ?? "");

const getBillPricingId = (record: Record<string, unknown>) =>
  String(getRecordValue(record, ["_id", "id", "pricingId", "reference"]) ?? "");

const getPersonName = (record: Record<string, unknown>) => {
  const joined = [record.firstName, record.lastName].filter((value) => typeof value === "string" && value.trim()).join(" ");
  return String((getRecordValue(record, ["name"]) ?? joined) || record.email || "Unknown user");
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

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getProviderCommissionModel = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["providerCommissionModel", "providerPricingModel"]) ?? "commission_percentage");

const getProviderCommissionValue = (row: Record<string, unknown>) =>
  getRecordValue(row, ["providerCommissionValue", "providerPricingValue"]);

const getProviderCommissionCap = (row: Record<string, unknown>) =>
  getRecordValue(row, ["providerCommissionCap", "providerPricingCap"]);

const getProviderFeeType = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["providerFeeType"]) ?? "flat").toLowerCase();

const getProviderFeeValue = (row: Record<string, unknown>) =>
  getRecordValue(row, ["providerFeeValue"]);

const getProviderMinFee = (row: Record<string, unknown>) =>
  getRecordValue(row, ["providerMinFee"]);

const getProviderMaxFee = (row: Record<string, unknown>) =>
  getRecordValue(row, ["providerMaxFee"]);

const formatRuleExpression = (value: unknown, feeType: string) =>
  feeType === "percentage" ? `${formatValue(value)}%` : formatCurrency(value);

const formatProfitRule = (customerType: string, customerValue: unknown, providerType: string, providerValue: unknown) => {
  const customerNumeric = Number(customerValue);
  const providerNumeric = Number(providerValue);

  if (Number.isNaN(customerNumeric) || Number.isNaN(providerNumeric)) {
    return "Use resolver";
  }

  if (customerType === providerType) {
    const delta = customerNumeric - providerNumeric;
    return customerType === "percentage" ? `${formatValue(delta)}%` : formatCurrency(delta);
  }

  return "Amount-dependent";
};

const billCommissionReference = {
  airtimeData: [
    { product: "MTN - Airtime VTU & DATA", commission: "3.00%" },
    { product: "GLO - Airtime VTU, DATA & SME", commission: "4.00%" },
    { product: "9mobile - Airtime VTU & DATA", commission: "4.00%" },
    { product: "Airtel - Airtime VTU & DATA", commission: "3.40%" },
    { product: "International Airtime", commission: "3.00%" },
    { product: "Spectranet Internet Data", commission: "3.00%" },
    { product: "Smile Network Payment", commission: "5.00%" },
  ],
  electricity: [
    { product: "Aba Electricity Payment - ABEDC", commission: "1.70%" },
    { product: "Abuja Electricity Distribution Company - AEDC", commission: "1.20% capped at NGN 1,500" },
    { product: "Benin Electricity - BEDC", commission: "1.50%" },
    { product: "Eko Electric Payment - EKEDC", commission: "1.00%" },
    { product: "Enugu Electric - EEDC", commission: "1.40% capped at NGN 1,600" },
    { product: "IBEDC - Ibadan Electricity Distribution Company", commission: "1.10%" },
    { product: "Ikeja Electric Payment - IKEDC (NMD)", commission: "1.00% capped at NGN 1,500" },
    { product: "Ikeja Electric Payment - IKEDC (MD)", commission: "No commission shown" },
    { product: "Jos Electric - JED", commission: "0.90%" },
    { product: "Kaduna Electric - KAEDCO", commission: "1.50%" },
    { product: "Kano Electric - KEDCO", commission: "1.00%" },
    { product: "PHED - Port Harcourt Electric (NMD)", commission: "1.10% capped at NGN 2,000" },
    { product: "PHED - Port Harcourt Electric (MD)", commission: "No commission shown" },
    { product: "Yola Electric - YEDC", commission: "1.20%" },
  ],
  tvAndPins: [
    { product: "DSTV Subscription", commission: "1.50%" },
    { product: "Gotv Payment", commission: "1.50%" },
    { product: "Startimes Subscription", commission: "2.00%" },
    { product: "Showmax", commission: "1.50%" },
    { product: "JAMB PIN VENDING (UTME & Direct Entry)", commission: "NGN 150.00" },
    { product: "WAEC (Result Checker PIN & Registration)", commission: "NGN 250.00" },
  ],
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

const buildFeeParams = (filters: FeeFilters) => {
  const params: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = value;
  });

  return params;
};

const buildBillPricingParams = (filters: BillPricingFilters) => {
  const params: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) {
      return;
    }

    params[key] = value;
  });

  return params;
};

const fetchFees = async (filters: FeeFilters): Promise<FeeState> => {
  try {
    const payload = await adminService.getFees(buildFeeParams(filters));

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

const fetchUsers = async (): Promise<UserState> => {
  try {
    const payload = await adminService.getUsers();

    return {
      rows: extractRows(payload),
      loading: false,
      loaded: true,
      error: "",
    };
  } catch (error) {
    return {
      rows: [],
      loading: false,
      loaded: true,
      error: getErrorMessage(error),
    };
  }
};

const fetchBillPricing = async (filters: BillPricingFilters): Promise<BillPricingState> => {
  try {
    const payload = await adminService.getBillPricingFees(buildBillPricingParams(filters));

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
  icon: typeof Users;
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

function ManagementTable({
  title,
  rows,
  columns,
  action,
  children,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  action?: ReactNode;
  children: (row: Record<string, unknown>, index: number) => ReactNode;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const paginatedRows = useMemo(() => paginateItems(rows, currentPage, pageSize), [rows, currentPage, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, pageSize, rows.length]);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        {action ?? <Landmark className="h-5 w-5 text-slate-400" aria-hidden="true" />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {paginatedRows.map((row, index) => children(row, index))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={rows.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setCurrentPage(1);
        }}
      />
      {!rows.length && (
        <div className="px-5 py-10 text-sm font-medium text-slate-500 dark:text-slate-400">
          No fee configurations returned.
        </div>
      )}
    </section>
  );
}

function ScopeBadge({ scope }: { scope: unknown }) {
  const normalized = String(scope ?? "default").toLowerCase();
  const tone =
    normalized === "default"
      ? "border-[#069AFF]/20 bg-[#069AFF]/10 text-[#069AFF] dark:text-sky-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";

  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tone}`}>{normalized}</span>;
}

function TypeBadge({ type }: { type: unknown }) {
  const normalized = String(type ?? "payin").toLowerCase();
  const tone =
    normalized === "payin"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tone}`}>{normalized}</span>;
}

function FeeConfigModal({
  preset,
  users,
  onClose,
  onSubmit,
}: {
  preset: FeeModalPreset;
  users: Record<string, unknown>[];
  onClose: () => void;
  onSubmit: (values: {
    userId?: string;
    type: "payin" | "payout";
    feeType: "percentage" | "flat";
    value: number;
    minFee: number;
    maxFee: number | null;
    providerFeeType: "percentage" | "flat";
    providerFeeValue: number;
    providerMinFee: number;
    providerMaxFee: number | null;
    description: string;
  }) => Promise<void>;
}) {
  const [userId, setUserId] = useState(preset.initialValues?.userId ?? "");
  const [feeType, setFeeType] = useState<"percentage" | "flat">(preset.initialValues?.feeType ?? "percentage");
  const [value, setValue] = useState(preset.initialValues?.value ?? "");
  const [minFee, setMinFee] = useState(preset.initialValues?.minFee ?? "");
  const [maxFee, setMaxFee] = useState(preset.initialValues?.maxFee ?? "");
  const [providerFeeType, setProviderFeeType] = useState<"percentage" | "flat">(preset.initialValues?.providerFeeType ?? "flat");
  const [providerFeeValue, setProviderFeeValue] = useState(preset.initialValues?.providerFeeValue ?? "");
  const [providerMinFee, setProviderMinFee] = useState(preset.initialValues?.providerMinFee ?? "0");
  const [providerMaxFee, setProviderMaxFee] = useState(preset.initialValues?.providerMaxFee ?? "");
  const [description, setDescription] = useState(preset.initialValues?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (preset.scope === "user" && !userId) {
      setError("Select a user.");
      return;
    }

    if (!value.trim()) {
      setError("Fee value is required.");
      return;
    }

    if (!minFee.trim()) {
      setError("Minimum fee is required.");
      return;
    }

    if (!providerFeeValue.trim()) {
      setError("Provider fee value is required.");
      return;
    }

    if (!providerMinFee.trim()) {
      setError("Provider minimum fee is required.");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        userId: preset.scope === "user" ? userId : undefined,
        type: preset.type,
        feeType,
        value: Number(value),
        minFee: Number(minFee),
        maxFee: maxFee.trim() ? Number(maxFee) : null,
        providerFeeType,
        providerFeeValue: Number(providerFeeValue),
        providerMinFee: Number(providerMinFee),
        providerMaxFee: providerMaxFee.trim() ? Number(providerMaxFee) : null,
        description,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Fee configuration
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{preset.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{preset.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close fee modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {preset.scope === "user" && (
              <label className="sm:col-span-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">User</span>
                <select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Select customer</option>
                  {users.map((user) => (
                    <option key={getId(user)} value={getId(user)}>
                      {getPersonName(user)} / {String(getRecordValue(user, ["email", "phone"]) ?? getId(user))}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Fee type</span>
              <select
                value={feeType}
                onChange={(event) => setFeeType(event.target.value as "percentage" | "flat")}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Scope</span>
              <input
                value={`${preset.scope} / ${preset.type}`}
                readOnly
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Value</span>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={feeType === "percentage" ? "1" : "50"}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Minimum fee</span>
              <input
                type="number"
                step="0.01"
                value={minFee}
                onChange={(event) => setMinFee(event.target.value)}
                placeholder="10"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Maximum fee</span>
              <input
                type="number"
                step="0.01"
                value={maxFee}
                onChange={(event) => setMaxFee(event.target.value)}
                placeholder="Leave blank for no cap"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider fee type</span>
              <select
                value={providerFeeType}
                onChange={(event) => setProviderFeeType(event.target.value as "percentage" | "flat")}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider fee value</span>
              <input
                type="number"
                step="0.01"
                value={providerFeeValue}
                onChange={(event) => setProviderFeeValue(event.target.value)}
                placeholder={providerFeeType === "percentage" ? "0.5" : "35"}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider minimum fee</span>
              <input
                type="number"
                step="0.01"
                value={providerMinFee}
                onChange={(event) => setProviderMinFee(event.target.value)}
                placeholder="0"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider maximum fee</span>
              <input
                type="number"
                step="0.01"
                value={providerMaxFee}
                onChange={(event) => setProviderMaxFee(event.target.value)}
                placeholder="Leave blank for no cap"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe the fee policy"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              Save fee rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BillPricingModal({
  state,
  onClose,
  onSubmit,
}: {
  state: BillPricingModalState;
  onClose: () => void;
  onSubmit: (values: {
    serviceType: string;
    providerType: string;
    serviceID: string;
    variationCode?: string;
    meterType?: string;
    productLabel: string;
    providerCommissionModel: "commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat";
    providerCommissionValue: number;
    providerCommissionCap: number | null;
    customerChargeType: "flat" | "percentage";
    customerChargeValue: number;
    customerMinFee: number;
    customerMaxFee: number | null;
  }) => Promise<void>;
}) {
  const [serviceType, setServiceType] = useState(state.initialValues?.serviceType ?? "");
  const [providerType, setProviderType] = useState(state.initialValues?.providerType ?? "");
  const [serviceID, setServiceID] = useState(state.initialValues?.serviceID ?? "");
  const [variationCode, setVariationCode] = useState(state.initialValues?.variationCode ?? "");
  const [meterType, setMeterType] = useState(state.initialValues?.meterType ?? "");
  const [productLabel, setProductLabel] = useState(state.initialValues?.productLabel ?? "");
  const [providerCommissionModel, setProviderCommissionModel] = useState<"commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat">(
    state.initialValues?.providerCommissionModel ?? "commission_percentage",
  );
  const [providerCommissionValue, setProviderCommissionValue] = useState(state.initialValues?.providerCommissionValue ?? "");
  const [providerCommissionCap, setProviderCommissionCap] = useState(state.initialValues?.providerCommissionCap ?? "");
  const [customerChargeType, setCustomerChargeType] = useState<"flat" | "percentage">(state.initialValues?.customerChargeType ?? "flat");
  const [customerChargeValue, setCustomerChargeValue] = useState(state.initialValues?.customerChargeValue ?? "");
  const [customerMinFee, setCustomerMinFee] = useState(state.initialValues?.customerMinFee ?? "0");
  const [customerMaxFee, setCustomerMaxFee] = useState(state.initialValues?.customerMaxFee ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!serviceType.trim() || !providerType.trim() || !serviceID.trim() || !productLabel.trim()) {
      setError("Service type, provider type, service ID, and product label are required.");
      return;
    }

    if (!providerCommissionValue.trim() || !customerChargeValue.trim() || !customerMinFee.trim()) {
      setError("Provider commission value, customer charge value, and customer minimum fee are required.");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        serviceType: serviceType.trim(),
        providerType: providerType.trim(),
        serviceID: serviceID.trim(),
        variationCode: variationCode.trim() || undefined,
        meterType: meterType.trim() || undefined,
        productLabel: productLabel.trim(),
        providerCommissionModel,
        providerCommissionValue: Number(providerCommissionValue),
        providerCommissionCap: providerCommissionCap.trim() ? Number(providerCommissionCap) : null,
        customerChargeType,
        customerChargeValue: Number(customerChargeValue),
        customerMinFee: Number(customerMinFee),
        customerMaxFee: customerMaxFee.trim() ? Number(customerMaxFee) : null,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bill pricing</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{state.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{state.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close bill pricing modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Service type</span>
              <select value={serviceType} onChange={(event) => setServiceType(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="">Select service type</option>
                <option value="airtime">Airtime</option>
                <option value="data">Data</option>
                <option value="tv">TV</option>
                <option value="electricity">Electricity</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider type</span>
              <input value={providerType} onChange={(event) => setProviderType(event.target.value)} placeholder="AIRTEL" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Service ID</span>
              <input value={serviceID} onChange={(event) => setServiceID(event.target.value)} placeholder="airtel" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Variation code</span>
              <input value={variationCode} onChange={(event) => setVariationCode(event.target.value)} placeholder="airtel-data-plan" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Meter type</span>
              <input value={meterType} onChange={(event) => setMeterType(event.target.value)} placeholder="prepaid" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Product label</span>
              <input value={productLabel} onChange={(event) => setProductLabel(event.target.value)} placeholder="Airtel - Airtime VTU & DATA" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider commission model</span>
              <select value={providerCommissionModel} onChange={(event) => setProviderCommissionModel(event.target.value as "commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat")} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="commission_percentage">Commission percentage</option>
                <option value="commission_flat">Commission flat</option>
                <option value="cost_percentage">Cost percentage</option>
                <option value="cost_flat">Cost flat</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider commission value</span>
              <input type="number" step="0.01" value={providerCommissionValue} onChange={(event) => setProviderCommissionValue(event.target.value)} placeholder="3.4" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider commission cap</span>
              <input type="number" step="0.01" value={providerCommissionCap} onChange={(event) => setProviderCommissionCap(event.target.value)} placeholder="1500" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer charge type</span>
              <select value={customerChargeType} onChange={(event) => setCustomerChargeType(event.target.value as "flat" | "percentage")} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="flat">Flat</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer charge value</span>
              <input type="number" step="0.01" value={customerChargeValue} onChange={(event) => setCustomerChargeValue(event.target.value)} placeholder="20" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer minimum fee</span>
              <input type="number" step="0.01" value={customerMinFee} onChange={(event) => setCustomerMinFee(event.target.value)} placeholder="0" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer maximum fee</span>
              <input type="number" step="0.01" value={customerMaxFee} onChange={(event) => setCustomerMaxFee(event.target.value)} placeholder="Leave blank for no cap" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {state.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BillPricingPreviewModal({
  state,
  onChange,
  onClose,
  onSubmit,
}: {
  state: BillPricingPreviewState;
  onChange: (field: "amount" | "serviceType" | "providerType" | "serviceID" | "variationCode" | "meterType", value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const result = unwrapPayload(state.result);
  const resultRecord = isRecord(result) ? result : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bill pricing preview</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Calculate product profit</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Run the backend pricing calculator before saving or changing bill pricing rules.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close preview modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Amount</span>
              <input type="number" step="0.01" value={state.amount} onChange={(event) => onChange("amount", event.target.value)} placeholder="1000" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Service type</span>
              <select value={state.serviceType} onChange={(event) => onChange("serviceType", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="">Select service type</option>
                <option value="airtime">Airtime</option>
                <option value="data">Data</option>
                <option value="tv">TV</option>
                <option value="electricity">Electricity</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Provider type</span>
              <input value={state.providerType} onChange={(event) => onChange("providerType", event.target.value)} placeholder="IKEJA ELECTRIC" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Service ID</span>
              <input value={state.serviceID} onChange={(event) => onChange("serviceID", event.target.value)} placeholder="ikeja-electric" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Variation code</span>
              <input value={state.variationCode} onChange={(event) => onChange("variationCode", event.target.value)} placeholder="dstv-padi" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Meter type</span>
              <input value={state.meterType} onChange={(event) => onChange("meterType", event.target.value)} placeholder="prepaid" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
          </div>

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Close
            </button>
            <button type="button" onClick={onSubmit} disabled={state.submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70">
              {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BarChart3 className="h-4 w-4" aria-hidden="true" />}
              Calculate preview
            </button>
          </div>

          {resultRecord && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-slate-950 dark:text-white">Profit preview result</h3>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(resultRecord).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {/(amount|revenue|profit|margin|fee|cost)/i.test(key) ? formatCurrency(value) : String(value ?? "Not available")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function FeeResolveModal({
  state,
  users,
  onChange,
  onClose,
  onSubmit,
}: {
  state: FeeResolveState;
  users: Record<string, unknown>[];
  onChange: (field: "type" | "amount" | "userId", value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const result = unwrapPayload(state.result);
  const resultRecord = isRecord(result) ? result : null;
  const feeConfig = resultRecord && isRecord(getRecordValue(resultRecord, ["feeConfig"])) ? (getRecordValue(resultRecord, ["feeConfig"]) as Record<string, unknown>) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Fee resolve</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Resolve payin / payout fee</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Calls the admin resolver and shows customer fee, provider fee, and expected profit for the selected amount.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close fee resolve modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Type</span>
              <select value={state.type} onChange={(event) => onChange("type", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="payin">Payin</option>
                <option value="payout">Payout</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Amount</span>
              <input type="number" step="0.01" value={state.amount} onChange={(event) => onChange("amount", event.target.value)} placeholder="1000" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">User override</span>
              <select value={state.userId} onChange={(event) => onChange("userId", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <option value="">Default fee policy</option>
                {users.map((user) => (
                  <option key={getId(user)} value={getId(user)}>
                    {getPersonName(user)} / {String(getRecordValue(user, ["email", "phone"]) ?? getId(user))}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Close
            </button>
            <button type="button" onClick={onSubmit} disabled={state.submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:cursor-not-allowed disabled:opacity-70">
              {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BarChart3 className="h-4 w-4" aria-hidden="true" />}
              Resolve fee
            </button>
          </div>

          {resultRecord && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                  <h3 className="font-bold text-slate-950 dark:text-white">Resolve result</h3>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(resultRecord)
                    .filter(([key]) => key !== "feeConfig")
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {/(amount|revenue|profit|margin|fee|cost|debit|net)/i.test(key) ? formatCurrency(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                </div>
              </section>

              {feeConfig && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <h3 className="font-bold text-slate-950 dark:text-white">Resolved fee config</h3>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(feeConfig).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {/(amount|revenue|profit|margin|fee|cost|value)/i.test(key) && typeof value !== "string" ? formatCurrency(value) : String(value ?? "Not available")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFeeExpression(row: Record<string, unknown>) {
  const feeType = String(getRecordValue(row, ["feeType"]) ?? "flat").toLowerCase();
  const value = getRecordValue(row, ["value"]);
  return feeType === "percentage" ? `${formatValue(value)}%` : formatCurrency(value);
}

export default function FeesPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed: canOpenFees } = useRouteAccess("/fees");
  const [filters, setFilters] = useState<FeeFilters>({ type: "", scope: "", userId: "" });
  const [appliedFilters, setAppliedFilters] = useState<FeeFilters>({ type: "", scope: "", userId: "" });
  const [billPricingFilters, setBillPricingFilters] = useState<BillPricingFilters>({
    serviceType: "",
    providerType: "",
    serviceID: "",
    variationCode: "",
    meterType: "",
  });
  const [appliedBillPricingFilters, setAppliedBillPricingFilters] = useState<BillPricingFilters>({
    serviceType: "",
    providerType: "",
    serviceID: "",
    variationCode: "",
    meterType: "",
  });
  const [fees, setFees] = useState<FeeState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [billPricing, setBillPricing] = useState<BillPricingState>({
    payload: null,
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [users, setUsers] = useState<UserState>({
    rows: [],
    loading: false,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [modalPreset, setModalPreset] = useState<FeeModalPreset | null>(null);
  const [billPricingModal, setBillPricingModal] = useState<BillPricingModalState | null>(null);
  const [billPricingPreview, setBillPricingPreview] = useState<BillPricingPreviewState>({
    open: false,
    amount: "1000",
    serviceType: "",
    providerType: "",
    serviceID: "",
    variationCode: "",
    meterType: "",
    submitting: false,
    error: "",
    result: null,
  });
  const [feeResolve, setFeeResolve] = useState<FeeResolveState>({
    open: false,
    type: "payout",
    amount: "1000",
    userId: "",
    submitting: false,
    error: "",
    result: null,
  });
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenFees) {
      return;
    }

    void Promise.all([fetchFees(appliedFilters), fetchUsers(), fetchBillPricing(appliedBillPricingFilters)]).then(([feeResult, userResult, billPricingResult]) => {
      if (!cancelled) {
        setFees(feeResult);
        setUsers(userResult);
        setBillPricing(billPricingResult);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedBillPricingFilters, appliedFilters, canOpenFees, router]);

  const refreshData = async (
    nextFilters = appliedFilters,
    nextBillPricingFilters = appliedBillPricingFilters,
  ) => {
    setRefreshing(true);
    setFees((current) => ({ ...current, loading: true, error: "" }));
    setBillPricing((current) => ({ ...current, loading: true, error: "" }));
    const [feeResult, userResult, billPricingResult] = await Promise.all([
      fetchFees(nextFilters),
      fetchUsers(),
      fetchBillPricing(nextBillPricingFilters),
    ]);
    setFees(feeResult);
    setUsers(userResult);
    setBillPricing(billPricingResult);
    setRefreshing(false);
  };

  const userLookup = useMemo(
    () =>
      users.rows.reduce<Record<string, string>>((accumulator, user) => {
        accumulator[getId(user)] = getPersonName(user);
        return accumulator;
      }, {}),
    [users.rows],
  );

  const rows = fees.rows;
  const billPricingRows = billPricing.rows;

  const summaryCards = useMemo(() => {
    const defaults = rows.filter((row) => String(getRecordValue(row, ["scope"]) ?? "default").toLowerCase() === "default");
    const userScoped = rows.filter((row) => String(getRecordValue(row, ["scope"]) ?? "").toLowerCase() === "user");
    const payins = rows.filter((row) => String(getRecordValue(row, ["type"]) ?? "").toLowerCase() === "payin");
    const payouts = rows.filter((row) => String(getRecordValue(row, ["type"]) ?? "").toLowerCase() === "payout");

    return [
      { label: "Default fee rules", value: formatValue(defaults.length), icon: Landmark },
      { label: "User fee rules", value: formatValue(userScoped.length), icon: Users },
      { label: "Payin rules", value: formatValue(payins.length), icon: WalletCards },
      { label: "Payout rules", value: formatValue(payouts.length), icon: CreditCard },
    ];
  }, [rows]);

  const billPricingSummaryCards = useMemo(() => {
    const airtime = billPricingRows.filter((row) => String(getRecordValue(row, ["serviceType"]) ?? "").toLowerCase() === "airtime");
    const data = billPricingRows.filter((row) => String(getRecordValue(row, ["serviceType"]) ?? "").toLowerCase() === "data");
    const tv = billPricingRows.filter((row) => String(getRecordValue(row, ["serviceType"]) ?? "").toLowerCase() === "tv");
    const electricity = billPricingRows.filter((row) => String(getRecordValue(row, ["serviceType"]) ?? "").toLowerCase() === "electricity");

    return [
      { label: "Airtime pricing", value: formatValue(airtime.length), icon: WalletCards },
      { label: "Data pricing", value: formatValue(data.length), icon: BarChart3 },
      { label: "TV pricing", value: formatValue(tv.length), icon: FileText },
      { label: "Electricity pricing", value: formatValue(electricity.length), icon: Landmark },
    ];
  }, [billPricingRows]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const openPreset = (preset: FeeModalPreset) => {
    setModalPreset(preset);
  };

  const openBillPricingCreate = () => {
    setBillPricingModal({
      mode: "create",
      title: "Create bill pricing row",
      description: "Define provider commission and customer charge rules for a specific bill product.",
      submitLabel: "Save bill pricing",
      initialValues: {
        customerChargeType: "flat",
        customerMinFee: "0",
        providerCommissionModel: "commission_percentage",
      },
    });
  };

  const openBillPricingEdit = (row: Record<string, unknown>) => {
    setBillPricingModal({
      mode: "edit",
      rowId: getBillPricingId(row),
      title: "Update bill pricing row",
      description: "Edit an existing bill pricing configuration and keep the backend pricing table aligned with operations.",
      submitLabel: "Update bill pricing",
      initialValues: {
        serviceType: String(getRecordValue(row, ["serviceType"]) ?? ""),
        providerType: String(getRecordValue(row, ["providerType"]) ?? ""),
        serviceID: String(getRecordValue(row, ["serviceID", "serviceId"]) ?? ""),
        variationCode: String(getRecordValue(row, ["variationCode"]) ?? ""),
        meterType: String(getRecordValue(row, ["meterType"]) ?? ""),
        productLabel: String(getRecordValue(row, ["productLabel"]) ?? ""),
        providerCommissionModel: (getProviderCommissionModel(row) as "commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat"),
        providerCommissionValue: String(getProviderCommissionValue(row) ?? ""),
        providerCommissionCap: getProviderCommissionCap(row) === null || getProviderCommissionCap(row) === undefined ? "" : String(getProviderCommissionCap(row)),
        customerChargeType: (String(getRecordValue(row, ["customerChargeType"]) ?? "flat") as "flat" | "percentage"),
        customerChargeValue: String(getRecordValue(row, ["customerChargeValue"]) ?? ""),
        customerMinFee: String(getRecordValue(row, ["customerMinFee"]) ?? "0"),
        customerMaxFee: getRecordValue(row, ["customerMaxFee"]) === null || getRecordValue(row, ["customerMaxFee"]) === undefined ? "" : String(getRecordValue(row, ["customerMaxFee"])),
      },
    });
  };

  const submitFeeRule = async (values: {
    userId?: string;
    type: "payin" | "payout";
    feeType: "percentage" | "flat";
    value: number;
    minFee: number;
    maxFee: number | null;
    providerFeeType: "percentage" | "flat";
    providerFeeValue: number;
    providerMinFee: number;
    providerMaxFee: number | null;
    description: string;
  }) => {
    const payload = {
      type: values.type,
      feeType: values.feeType,
      value: values.value,
      minFee: values.minFee,
      maxFee: values.maxFee,
      providerFeeType: values.providerFeeType,
      providerFeeValue: values.providerFeeValue,
      providerMinFee: values.providerMinFee,
      providerMaxFee: values.providerMaxFee,
      description: values.description,
    };

    if (modalPreset?.scope === "user" && values.userId) {
      await adminService.setUserFee(values.userId, payload);
    } else {
      await adminService.setDefaultFee(payload);
    }

    await refreshData();
    setModalPreset(null);
  };

  const submitBillPricingRule = async (values: {
    serviceType: string;
    providerType: string;
    serviceID: string;
    variationCode?: string;
    meterType?: string;
    productLabel: string;
    providerCommissionModel: "commission_percentage" | "commission_flat" | "cost_percentage" | "cost_flat";
    providerCommissionValue: number;
    providerCommissionCap: number | null;
    customerChargeType: "flat" | "percentage";
    customerChargeValue: number;
    customerMinFee: number;
    customerMaxFee: number | null;
  }) => {
    const payload = {
      serviceType: values.serviceType,
      providerType: values.providerType,
      serviceID: values.serviceID,
      variationCode: values.variationCode,
      meterType: values.meterType,
      productLabel: values.productLabel,
      providerCommissionModel: values.providerCommissionModel,
      providerCommissionValue: values.providerCommissionValue,
      providerCommissionCap: values.providerCommissionCap,
      customerChargeType: values.customerChargeType,
      customerChargeValue: values.customerChargeValue,
      customerMinFee: values.customerMinFee,
      customerMaxFee: values.customerMaxFee,
    };

    if (billPricingModal?.mode === "edit" && billPricingModal.rowId) {
      await adminService.updateBillPricingFee(billPricingModal.rowId, payload);
    } else {
      await adminService.createBillPricingFee(payload);
    }

    await refreshData(appliedFilters, appliedBillPricingFilters);
    setBillPricingModal(null);
  };

  const submitBillPricingPreview = async () => {
    if (!billPricingPreview.amount.trim() || !billPricingPreview.serviceType.trim()) {
      setBillPricingPreview((current) => ({
        ...current,
        error: "Amount and service type are required.",
      }));
      return;
    }

    setBillPricingPreview((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const result = await adminService.calculateBillPricingFee({
        amount: Number(billPricingPreview.amount),
        serviceType: billPricingPreview.serviceType.trim(),
        providerType: billPricingPreview.providerType.trim(),
        serviceID: billPricingPreview.serviceID.trim(),
        variationCode: billPricingPreview.variationCode.trim(),
        meterType: billPricingPreview.meterType.trim(),
      });

      setBillPricingPreview((current) => ({
        ...current,
        submitting: false,
        result,
      }));
    } catch (error) {
      setBillPricingPreview((current) => ({
        ...current,
        submitting: false,
        error: getErrorMessage(error),
      }));
    }
  };

  const submitFeeResolve = async () => {
    if (!feeResolve.amount.trim()) {
      setFeeResolve((current) => ({
        ...current,
        error: "Amount is required.",
      }));
      return;
    }

    setFeeResolve((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const result = await adminService.resolveFee({
        type: feeResolve.type,
        amount: Number(feeResolve.amount),
        userId: feeResolve.userId || undefined,
      });

      setFeeResolve((current) => ({
        ...current,
        submitting: false,
        result,
      }));
    } catch (error) {
      setFeeResolve((current) => ({
        ...current,
        submitting: false,
        error: getErrorMessage(error),
      }));
    }
  };

  if (!canOpenFees) {
    return (
      <AccessDeniedState
        title="Fees access denied"
        description="Your current admin role does not include permission to manage fee configuration."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Fee Configuration
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Manage transaction fees, service charges, and financial rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/general-ledger-bills"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Bill ledger
            </Link>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              {refreshing ? (
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
        {!fees.loaded || !billPricing.loaded ? (
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
                    <Landmark className="h-4 w-4" aria-hidden="true" />
                    Fee policy control
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Configure default and user-specific payin and payout fees from one finance workspace.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Set customer fees, track provider fees, and keep the margin visible on every payin and payout rule before it reaches production.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => openPreset({ scope: "default", type: "payin", title: "Set default payin fee", description: "Configure the standard wallet funding fee policy.", initialValues: { feeType: "percentage", value: "1", minFee: "10", maxFee: "500", providerFeeType: "percentage", providerFeeValue: "0.5", providerMinFee: "0", providerMaxFee: "", description: "Default wallet funding fee" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Default payin
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "default", type: "payout", title: "Set default payout fee", description: "Configure the standard bank transfer payout fee policy.", initialValues: { feeType: "flat", value: "50", minFee: "0", maxFee: "", providerFeeType: "flat", providerFeeValue: "35", providerMinFee: "0", providerMaxFee: "", description: "Default bank transfer payout fee" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Default payout
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "user", type: "payin", title: "Set user payin fee", description: "Configure a special wallet funding fee for a selected customer.", initialValues: { feeType: "percentage", value: "0.5", minFee: "5", maxFee: "250", providerFeeType: "percentage", providerFeeValue: "0.25", providerMinFee: "0", providerMaxFee: "", description: "Special funding fee for this user" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      User payin
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "user", type: "payout", title: "Set user payout fee", description: "Configure a special payout fee for a selected customer.", initialValues: { feeType: "flat", value: "25", minFee: "0", maxFee: "", providerFeeType: "flat", providerFeeValue: "15", providerMinFee: "0", providerMaxFee: "", description: "Special payout fee for this user" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      User payout
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {(fees.error || users.error || billPricing.error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {fees.error || users.error || billPricing.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25 dark:bg-[linear-gradient(135deg,#030712_0%,#06294b_55%,#069AFF_150%)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    Bill pricing control
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Configure provider commission and customer charges for airtime, data, TV, and electricity products.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Save the VTpass provider commission for each product, add the customer charge on top, and monitor the resulting bill profit from the general ledger and bill-profit reports.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={openBillPricingCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New bill pricing
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillPricingPreview((current) => ({ ...current, open: true, error: "", result: null }))}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <BarChart3 className="h-4 w-4" aria-hidden="true" />
                      Profit preview
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {billPricingSummaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">VTpass Reference</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">Provider commission reference tables</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  These are the provider commission rates from your operational screenshots. Use them as the source when creating bill pricing rows. Profit for bill products is now customer fee plus provider commission.
                </p>
              </div>
              <div className="grid gap-5 xl:grid-cols-3">
                {[
                  { title: "Airtime / Data", rows: billCommissionReference.airtimeData },
                  { title: "Electricity", rows: billCommissionReference.electricity },
                  { title: "TV / Exam Pins", rows: billCommissionReference.tvAndPins },
                ].map((group) => (
                  <div key={group.title} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                      <h4 className="font-bold text-slate-950 dark:text-white">{group.title}</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                          {group.rows.map((entry) => (
                            <tr key={entry.product} className="align-top text-slate-700 dark:text-slate-300">
                              <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{entry.product}</td>
                              <td className="px-4 py-3">{entry.commission}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Service type</span>
                  <select
                    value={billPricingFilters.serviceType}
                    onChange={(event) => setBillPricingFilters((current) => ({ ...current, serviceType: event.target.value }))}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  >
                    <option value="">All products</option>
                    <option value="airtime">Airtime</option>
                    <option value="data">Data</option>
                    <option value="tv">TV</option>
                    <option value="electricity">Electricity</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Provider type</span>
                  <input
                    value={billPricingFilters.providerType}
                    onChange={(event) => setBillPricingFilters((current) => ({ ...current, providerType: event.target.value }))}
                    placeholder="AIRTEL"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Service ID</span>
                  <input
                    value={billPricingFilters.serviceID}
                    onChange={(event) => setBillPricingFilters((current) => ({ ...current, serviceID: event.target.value }))}
                    placeholder="airtel"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Variation code</span>
                  <input
                    value={billPricingFilters.variationCode}
                    onChange={(event) => setBillPricingFilters((current) => ({ ...current, variationCode: event.target.value }))}
                    placeholder="dstv-padi"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Meter type</span>
                  <input
                    value={billPricingFilters.meterType}
                    onChange={(event) => setBillPricingFilters((current) => ({ ...current, meterType: event.target.value }))}
                    placeholder="prepaid"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setAppliedBillPricingFilters(billPricingFilters);
                    void refreshData(appliedFilters, billPricingFilters);
                  }}
                  disabled={refreshing}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-4 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:opacity-70"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = { serviceType: "", providerType: "", serviceID: "", variationCode: "", meterType: "" };
                    setBillPricingFilters(defaults);
                    setAppliedBillPricingFilters(defaults);
                    void refreshData(appliedFilters, defaults);
                  }}
                  className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                >
                  Reset
                </button>
              </div>
            </section>

            <ManagementTable title="Bill pricing registry" rows={billPricingRows} columns={["Product", "Provider Commission", "Customer Charge", "Profit Model", "Routing", "Action"]}>
              {(row, index) => {
                const providerCommissionModel = getProviderCommissionModel(row);
                const customerChargeType = String(getRecordValue(row, ["customerChargeType"]) ?? "flat");
                const providerCommissionCap = getProviderCommissionCap(row);
                const customerMaxFee = getRecordValue(row, ["customerMaxFee"]);

                return (
                  <tr key={`${getBillPricingId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["productLabel"]) ?? "Not available")}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {String(getRecordValue(row, ["serviceType"]) ?? "").toUpperCase()} / {String(getRecordValue(row, ["providerType"]) ?? "Not available")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{formatLabel(providerCommissionModel)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {/(percentage)/i.test(providerCommissionModel)
                          ? `${formatValue(getProviderCommissionValue(row))}%`
                          : formatCurrency(getProviderCommissionValue(row))}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{formatLabel(customerChargeType)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {customerChargeType === "percentage"
                          ? `${formatValue(getRecordValue(row, ["customerChargeValue"]))}%`
                          : formatCurrency(getRecordValue(row, ["customerChargeValue"]))}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">
                        Profit = customer fee + provider commission
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Provider cap: {providerCommissionCap === null || providerCommissionCap === undefined || providerCommissionCap === "" ? "No cap" : formatCurrency(providerCommissionCap)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Customer min/max: {formatCurrency(getRecordValue(row, ["customerMinFee"]))} / {customerMaxFee === null || customerMaxFee === undefined || customerMaxFee === "" ? "No cap" : formatCurrency(customerMaxFee)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">{String(getRecordValue(row, ["serviceID", "serviceId"]) ?? "Not available")}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {String(getRecordValue(row, ["variationCode"]) ?? "No variation")} / {String(getRecordValue(row, ["meterType"]) ?? "No meter type")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openBillPricingEdit(row)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              }}
            </ManagementTable>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Type</span>
                  <select
                    value={filters.type}
                    onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  >
                    <option value="">All types</option>
                    <option value="payin">Payin</option>
                    <option value="payout">Payout</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Scope</span>
                  <select
                    value={filters.scope}
                    onChange={(event) => setFilters((current) => ({ ...current, scope: event.target.value, userId: event.target.value === "user" ? current.userId : "" }))}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  >
                    <option value="">All scopes</option>
                    <option value="default">Default</option>
                    <option value="user">User</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">User</span>
                  <select
                    value={filters.userId}
                    onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value, scope: event.target.value ? "user" : current.scope }))}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  >
                    <option value="">All users</option>
                    {users.rows.map((user) => (
                      <option key={getId(user)} value={getId(user)}>
                        {getPersonName(user)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setAppliedFilters(filters);
                    void refreshData(filters);
                  }}
                  disabled={refreshing}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-4 text-sm font-bold text-white shadow-sm shadow-[#069AFF]/25 transition hover:bg-[#0588e0] disabled:opacity-70"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = { type: "", scope: "", userId: "" };
                    setFilters(defaults);
                    setAppliedFilters(defaults);
                    void refreshData(defaults);
                  }}
                  className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                >
                  Reset
                </button>
              </div>
            </section>

            <ManagementTable title="Fee configuration registry" rows={rows} columns={["Scope", "Type", "Customer Fee", "Provider Fee", "Profit Rule", "Assignment", "Action"]}>
              {(row, index) => {
                const scope = String(getRecordValue(row, ["scope"]) ?? "default");
                const type = String(getRecordValue(row, ["type"]) ?? "payin");
                const userId = String(getRecordValue(row, ["userId", "user_id"]) ?? "");
                const userName = userId ? userLookup[userId] ?? userId : "System default";
                const feeType = String(getRecordValue(row, ["feeType"]) ?? "flat");
                const minFee = getRecordValue(row, ["minFee"]);
                const maxFee = getRecordValue(row, ["maxFee"]);
                const providerFeeType = getProviderFeeType(row);
                const providerFeeValue = getProviderFeeValue(row);
                const providerMinFee = getProviderMinFee(row);
                const providerMaxFee = getProviderMaxFee(row);
                const preset: FeeModalPreset = {
                  scope: scope === "user" ? "user" : "default",
                  type: type === "payout" ? "payout" : "payin",
                  title: scope === "user" ? `Reuse ${type} user rule` : `Reuse ${type} default rule`,
                  description: "Open this rule as a template and submit a new configuration.",
                  initialValues: {
                    userId: scope === "user" ? userId : "",
                    feeType: feeType === "percentage" ? "percentage" : "flat",
                    value: String(getRecordValue(row, ["value"]) ?? ""),
                    minFee: String(minFee ?? ""),
                    maxFee: maxFee === null || maxFee === undefined ? "" : String(maxFee),
                    providerFeeType: providerFeeType === "percentage" ? "percentage" : "flat",
                    providerFeeValue: String(providerFeeValue ?? ""),
                    providerMinFee: String(providerMinFee ?? "0"),
                    providerMaxFee: providerMaxFee === null || providerMaxFee === undefined ? "" : String(providerMaxFee),
                    description: String(getRecordValue(row, ["description"]) ?? ""),
                  },
                };

                return (
                  <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <ScopeBadge scope={scope} />
                        <TypeBadge type={type} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{type}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{feeType}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{formatFeeExpression(row)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(getRecordValue(row, ["description"]) ?? "No description")}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">{formatRuleExpression(providerFeeValue, providerFeeType)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Min: {formatCurrency(providerMinFee)} / Max: {providerMaxFee === null || providerMaxFee === undefined || providerMaxFee === "" ? "No cap" : formatCurrency(providerMaxFee)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">{formatProfitRule(feeType, getRecordValue(row, ["value"]), providerFeeType, providerFeeValue)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Customer min/max: {formatCurrency(minFee)} / {maxFee === null || maxFee === undefined || maxFee === "" ? "No cap" : formatCurrency(maxFee)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">{userName}</p>
                      <p className="mt-1 text-xs break-all text-slate-500 dark:text-slate-400">{scope === "user" ? userId : "Default system policy"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openPreset(preset)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Reuse
                      </button>
                    </td>
                  </tr>
                );
              }}
            </ManagementTable>
          </>
        )}
      </div>

      {modalPreset && <FeeConfigModal preset={modalPreset} users={users.rows} onClose={() => setModalPreset(null)} onSubmit={submitFeeRule} />}
      {billPricingModal && <BillPricingModal state={billPricingModal} onClose={() => setBillPricingModal(null)} onSubmit={submitBillPricingRule} />}
      {billPricingPreview.open && (
        <BillPricingPreviewModal
          state={billPricingPreview}
          onChange={(field, value) => setBillPricingPreview((current) => ({ ...current, [field]: value }))}
          onClose={() => setBillPricingPreview((current) => ({ ...current, open: false, error: "", result: null, submitting: false }))}
          onSubmit={() => void submitBillPricingPreview()}
        />
      )}
      {feeResolve.open && (
        <FeeResolveModal
          state={feeResolve}
          users={users.rows}
          onChange={(field, value) => setFeeResolve((current) => ({ ...current, [field]: value }))}
          onClose={() => setFeeResolve((current) => ({ ...current, open: false, error: "", result: null, submitting: false }))}
          onSubmit={() => void submitFeeResolve()}
        />
      )}
    </main>
  );
}
