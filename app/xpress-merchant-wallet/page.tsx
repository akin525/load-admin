"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";

type MerchantWalletState = {
  loading: boolean;
  loaded: boolean;
  error: string;
  payload: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

const getRecordValue = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) {
    return undefined;
  }

  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const safeText = (value: unknown, fallback = "Not available") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
};

const formatCurrency = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return safeText(value);
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatDate = (value: unknown) => {
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
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unable to fetch merchant wallet.";
};

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
          {detail ? <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{detail}</p> : null}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: string; copyable?: boolean }>;
}) {
  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/30">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{item.label}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-slate-950 dark:text-white break-all">{item.value}</p>
            {item.copyable && item.value !== "Not available" ? (
              <button
                type="button"
                onClick={() => void copyValue(item.value)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#069AFF]/35 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                aria-label={`Copy ${item.label}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function XpressMerchantWalletPage() {
  const router = useRouter();
  const { allowed } = useRouteAccess("/xpress-merchant-wallet");
  const [state, setState] = useState<MerchantWalletState>({
    loading: true,
    loaded: false,
    error: "",
    payload: null,
  });

  const loadMerchantWallet = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const payload = await adminService.getXpressMerchantWallet();
      setState({
        loading: false,
        loaded: true,
        error: "",
        payload,
      });
    } catch (error) {
      setState({
        loading: false,
        loaded: true,
        error: getErrorMessage(error),
        payload: null,
      });
    }
  }, []);

  useEffect(() => {
    if (!allowed) {
      router.replace("/dashboard");
      return;
    }

    void loadMerchantWallet();
  }, [allowed, loadMerchantWallet, router]);

  const response = useMemo(() => (isRecord(state.payload) ? state.payload : null), [state.payload]);
  const payload = useMemo(() => unwrapPayload(state.payload), [state.payload]);
  const record = useMemo(() => (isRecord(payload) ? payload : null), [payload]);
  const wallet = useMemo(() => (isRecord(record?.wallet) ? record.wallet : null), [record]);
  const providerResponse = useMemo(() => (isRecord(record?.providerResponse) ? record.providerResponse : null), [record]);

  const walletItems = useMemo(
    () => [
      { label: "Wallet ID", value: safeText(getRecordValue(wallet, ["id"])), copyable: true },
      { label: "Account name", value: safeText(getRecordValue(wallet, ["accountName"])) },
      { label: "Business name", value: safeText(getRecordValue(wallet, ["businessName"])) },
      { label: "Email", value: safeText(getRecordValue(wallet, ["email"])), copyable: true },
      { label: "Account number", value: safeText(getRecordValue(wallet, ["accountNumber"])), copyable: true },
      { label: "Bank name", value: safeText(getRecordValue(wallet, ["bankName"])) },
      { label: "Bank code", value: safeText(getRecordValue(wallet, ["bankCode"])), copyable: true },
      { label: "Account reference", value: safeText(getRecordValue(wallet, ["accountReference"])), copyable: true },
      { label: "Created at", value: formatDate(getRecordValue(wallet, ["createdAt"])) },
      { label: "Updated at", value: formatDate(getRecordValue(wallet, ["updatedAt"])) },
    ],
    [wallet],
  );

  if (!allowed) {
    return (
      <AccessDeniedState
        title="Xpress merchant wallet access denied"
        description="Your current admin role does not include permission to inspect the Xpress merchant wallet."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 dark:bg-[#07111f] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_58%,#069AFF_145%)] text-white shadow-2xl shadow-[#069AFF]/10">
          <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-100">Xpress merchant wallet</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Inspect the provider merchant balance and account snapshot.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-sky-100/90">
                This page pulls the Xpress merchant wallet directly from the provider so operations can reconcile available balance,
                booked balance, and the current receiving account in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadMerchantWallet()}
                disabled={state.loading}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {state.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {state.error}
          </div>
        ) : null}

        {state.loading && !state.payload ? (
          <div className="flex min-h-[22rem] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
            <div className="flex flex-col items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin text-[#069AFF]" />
              Loading Xpress merchant wallet
            </div>
          </div>
        ) : wallet ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Available balance"
                value={formatCurrency(getRecordValue(wallet, ["availableBalance"]))}
                icon={WalletCards}
                detail={`Account ${safeText(getRecordValue(wallet, ["accountNumber"]))}`}
              />
              <MetricCard
                label="Booked balance"
                value={formatCurrency(getRecordValue(wallet, ["bookedBalance"]))}
                icon={Banknote}
                detail={safeText(getRecordValue(wallet, ["accountName"]))}
              />
              <MetricCard
                label="Business name"
                value={safeText(getRecordValue(wallet, ["businessName", "accountName"]))}
                icon={Building2}
                detail={safeText(getRecordValue(wallet, ["bankName"]))}
              />
              <MetricCard
                label="Provider status"
                value={String(getRecordValue(providerResponse, ["status"]) === true ? "Connected" : "Unknown")}
                icon={getRecordValue(providerResponse, ["status"]) === true ? CheckCircle2 : AlertCircle}
                detail={`Updated ${formatDate(getRecordValue(wallet, ["updatedAt"]))}`}
              />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-6 py-5 dark:border-white/10">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">Merchant wallet details</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Provider-facing identity, receiving account, and reconciliation fields.</p>
              </div>
              <div className="p-6">
                <DetailGrid items={walletItems} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-slate-100 px-6 py-5 dark:border-white/10">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">Raw provider response</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Full upstream payload for audit and troubleshooting.</p>
              </div>
              <div className="p-6">
                <pre className="max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-sky-100">
                  {JSON.stringify(providerResponse ?? response ?? record, null, 2)}
                </pre>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">No merchant wallet returned</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {safeText(getRecordValue(response, ["message"]))}
            </p>
            {record ? (
              <pre className="mt-5 max-h-[24rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-sky-100">
                {JSON.stringify(record, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
