"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Users,
  WalletCards,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";

type DashboardKey = "stats" | "loansStats" | "recentLoans" | "recentBills" | "billsStats";

type DashboardData = Record<DashboardKey, unknown> & {
  errors: Partial<Record<DashboardKey, string>>;
};

type Metric = {
  label: string;
  value: string;
};

const endpoints: Array<[DashboardKey, () => Promise<unknown>]> = [
  ["stats", adminService.getDashboardStats],
  ["loansStats", adminService.getLoansStats],
  ["recentLoans", adminService.getRecentLoans],
  ["recentBills", adminService.getRecentBills],
  ["billsStats", adminService.getBillsStats],
];

const navItems = [
  { label: "Overview", icon: Home, active: true },
  { label: "Loans", icon: CreditCard },
  { label: "Bills", icon: WalletCards },
  { label: "Customers", icon: Users },
  { label: "Reports", icon: BarChart3 },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
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

const collectMetrics = (payload: unknown, prefix = "", depth = 0): Metric[] => {
  const value = unwrapPayload(payload);

  if (!isRecord(value) || depth > 2) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    const label = prefix ? `${prefix} ${formatLabel(key)}` : formatLabel(key);

    if (typeof entry === "number" || typeof entry === "string") {
      const numericValue = typeof entry === "string" ? Number(entry) : entry;

      if (typeof entry === "number" || (!Number.isNaN(numericValue) && entry.trim().length <= 16)) {
        return [{ label, value: formatValue(entry) }];
      }
    }

    if (isRecord(entry)) {
      return collectMetrics(entry, label, depth + 1);
    }

    return [];
  });
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const extractRows = (payload: unknown): Record<string, unknown>[] => {
  const value = unwrapPayload(payload);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const list = Object.values(value).find(Array.isArray);
  return Array.isArray(list) ? list.filter(isRecord) : [];
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

const fetchDashboard = async (): Promise<DashboardData> => {
  const results = await Promise.allSettled(endpoints.map(([, request]) => request()));
  const data = {} as Record<DashboardKey, unknown>;
  const errors: Partial<Record<DashboardKey, string>> = {};

  results.forEach((result, index) => {
    const key = endpoints[index][0];

    if (result.status === "fulfilled") {
      data[key] = result.value;
    } else {
      data[key] = null;
      errors[key] = getErrorMessage(result.reason);
    }
  });

  return {
    stats: data.stats,
    loansStats: data.loansStats,
    recentLoans: data.recentLoans,
    recentBills: data.recentBills,
    billsStats: data.billsStats,
    errors,
  };
};

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  );
}

function MetricsPanel({ title, metrics }: { title: string; metrics: Metric[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        <BarChart3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(metrics.length ? metrics.slice(0, 6) : [{ label: "No data yet", value: "0" }]).map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: Record<string, unknown>[];
  kind: "loan" | "bill";
}) {
  const amountKeys = kind === "loan"
    ? ["amount", "loanAmount", "principal", "totalAmount"]
    : ["amount", "billAmount", "total", "totalAmount"];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/10">
        {(rows.length ? rows.slice(0, 6) : []).map((row, index) => {
          const name = getRecordValue(row, ["customerName", "name", "fullName", "borrower", "userName", "email"]) ?? `Record ${index + 1}`;
          const reference = getRecordValue(row, ["id", "_id", "loanId", "billId", "reference", "accountNumber"]) ?? "No reference";
          const amount = getRecordValue(row, amountKeys);
          const status = getRecordValue(row, ["status", "paymentStatus", "loanStatus", "billStatus"]) ?? "Pending";

          return (
            <div key={`${String(reference)}-${index}`} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{String(name)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(reference)}</p>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{formatValue(amount)}</p>
              <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                {String(status)}
              </span>
            </div>
          );
        })}

        {!rows.length && (
          <div className="px-5 py-8 text-sm font-medium text-slate-500 dark:text-slate-400">
            No recent records returned.
          </div>
        )}
      </div>
    </section>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid gap-5">
      <div className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    void fetchDashboard().then((result) => {
      if (!cancelled) {
        setDashboardData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const overviewMetrics = useMemo(() => {
    if (!dashboardData) {
      return [];
    }

    const metrics = [
      ...collectMetrics(dashboardData.stats),
      ...collectMetrics(dashboardData.loansStats),
      ...collectMetrics(dashboardData.billsStats),
    ];

    const unique = new Map<string, Metric>();
    metrics.forEach((metric) => {
      if (!unique.has(metric.label)) {
        unique.set(metric.label, metric);
      }
    });

    return Array.from(unique.values()).slice(0, 4);
  }, [dashboardData]);

  const loansMetrics = useMemo(() => collectMetrics(dashboardData?.loansStats), [dashboardData]);
  const billsMetrics = useMemo(() => collectMetrics(dashboardData?.billsStats), [dashboardData]);
  const recentLoans = useMemo(() => extractRows(dashboardData?.recentLoans), [dashboardData]);
  const recentBills = useMemo(() => extractRows(dashboardData?.recentBills), [dashboardData]);
  const endpointErrors = dashboardData ? Object.entries(dashboardData.errors) : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await fetchDashboard();
    setDashboardData(result);
    setRefreshing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const cardIcons = [Activity, CreditCard, WalletCards, Users];

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950 dark:bg-[#07111f] dark:text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 dark:border-white/10 dark:bg-[#0b1626] lg:block">
          <div className="mb-8 flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-white/10">
            <Image
              src="/eazy-logo.svg"
              alt="EazyCredit"
              width={140}
              height={29}
              priority
              className="h-auto w-[140px]"
            />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                    item.active
                      ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.045]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Session
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
              Administrator workspace
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              API requests use the stored admin token.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f4f7fb]/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#07111f]/90 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Dashboard
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Admin overview
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
                  aria-label="Toggle color theme"
                >
                  <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
                  <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
                  aria-label="Log out"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-6 sm:px-8">
            {!dashboardData ? (
              <LoadingDashboard />
            ) : (
              <div className="grid gap-6">
                {endpointErrors.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                    <div className="flex gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-bold">Some dashboard endpoints did not respond.</p>
                        <p className="mt-1">
                          {endpointErrors.map(([key]) => formatLabel(key)).join(", ")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {(overviewMetrics.length ? overviewMetrics : [
                    { label: "Dashboard Stats", value: "0" },
                    { label: "Loans Stats", value: "0" },
                    { label: "Bills Stats", value: "0" },
                    { label: "Recent Activity", value: "0" },
                  ]).map((metric, index) => (
                    <MetricCard
                      key={`${metric.label}-${index}`}
                      title={metric.label}
                      value={metric.value}
                      icon={cardIcons[index] ?? Activity}
                    />
                  ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <MetricsPanel title="Loans statistics" metrics={loansMetrics} />
                  <MetricsPanel title="Bills statistics" metrics={billsMetrics} />
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <RecentTable title="Recent loans" rows={recentLoans} kind="loan" />
                  <RecentTable title="Recent bills" rows={recentBills} kind="bill" />
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
