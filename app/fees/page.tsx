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

type FeeFilters = {
  type: string;
  scope: string;
  userId: string;
};

type FeeState = {
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
    description?: string;
  };
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
            {rows.map((row, index) => children(row, index))}
          </tbody>
        </table>
      </div>
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
    description: string;
  }) => Promise<void>;
}) {
  const [userId, setUserId] = useState(preset.initialValues?.userId ?? "");
  const [feeType, setFeeType] = useState<"percentage" | "flat">(preset.initialValues?.feeType ?? "percentage");
  const [value, setValue] = useState(preset.initialValues?.value ?? "");
  const [minFee, setMinFee] = useState(preset.initialValues?.minFee ?? "");
  const [maxFee, setMaxFee] = useState(preset.initialValues?.maxFee ?? "");
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

    setSubmitting(true);

    try {
      await onSubmit({
        userId: preset.scope === "user" ? userId : undefined,
        type: preset.type,
        feeType,
        value: Number(value),
        minFee: Number(minFee),
        maxFee: maxFee.trim() ? Number(maxFee) : null,
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
  const [fees, setFees] = useState<FeeState>({
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

    void Promise.all([fetchFees(appliedFilters), fetchUsers()]).then(([feeResult, userResult]) => {
      if (!cancelled) {
        setFees(feeResult);
        setUsers(userResult);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, canOpenFees, router]);

  const refreshData = async (nextFilters = appliedFilters) => {
    setRefreshing(true);
    setFees((current) => ({ ...current, loading: true, error: "" }));
    const [feeResult, userResult] = await Promise.all([fetchFees(nextFilters), fetchUsers()]);
    setFees(feeResult);
    setUsers(userResult);
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const openPreset = (preset: FeeModalPreset) => {
    setModalPreset(preset);
  };

  const submitFeeRule = async (values: {
    userId?: string;
    type: "payin" | "payout";
    feeType: "percentage" | "flat";
    value: number;
    minFee: number;
    maxFee: number | null;
    description: string;
  }) => {
    const payload = {
      type: values.type,
      feeType: values.feeType,
      value: values.value,
      minFee: values.minFee,
      maxFee: values.maxFee,
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
        {!fees.loaded ? (
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
                    Set baseline wallet funding and payout charges, then override them for selected customers when operational or commercial exceptions apply.
                  </p>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => openPreset({ scope: "default", type: "payin", title: "Set default payin fee", description: "Configure the standard wallet funding fee policy.", initialValues: { feeType: "percentage", value: "1", minFee: "10", maxFee: "500", description: "Default wallet funding fee" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Default payin
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "default", type: "payout", title: "Set default payout fee", description: "Configure the standard bank transfer payout fee policy.", initialValues: { feeType: "flat", value: "50", minFee: "0", maxFee: "", description: "Default bank transfer payout fee" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Default payout
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "user", type: "payin", title: "Set user payin fee", description: "Configure a special wallet funding fee for a selected customer.", initialValues: { feeType: "percentage", value: "0.5", minFee: "5", maxFee: "250", description: "Special funding fee for this user" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      User payin
                    </button>
                    <button type="button" onClick={() => openPreset({ scope: "user", type: "payout", title: "Set user payout fee", description: "Configure a special payout fee for a selected customer.", initialValues: { feeType: "flat", value: "25", minFee: "0", maxFee: "", description: "Special payout fee for this user" } })} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      User payout
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {(fees.error || users.error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {fees.error || users.error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

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

            <ManagementTable title="Fee configuration registry" rows={rows} columns={["Scope", "Type", "Rule", "Caps", "Assignment", "Action"]}>
              {(row, index) => {
                const scope = String(getRecordValue(row, ["scope"]) ?? "default");
                const type = String(getRecordValue(row, ["type"]) ?? "payin");
                const userId = String(getRecordValue(row, ["userId", "user_id"]) ?? "");
                const userName = userId ? userLookup[userId] ?? userId : "System default";
                const feeType = String(getRecordValue(row, ["feeType"]) ?? "flat");
                const minFee = getRecordValue(row, ["minFee"]);
                const maxFee = getRecordValue(row, ["maxFee"]);
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
                      <p className="font-semibold text-slate-950 dark:text-white">Min: {formatCurrency(minFee)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max: {maxFee === null || maxFee === undefined || maxFee === "" ? "No cap" : formatCurrency(maxFee)}</p>
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
    </main>
  );
}
