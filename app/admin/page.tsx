"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck2,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";

type AdminSection = "admins" | "roles" | "users" | "kyc" | "loans";
type DataKey = "admins" | "roles" | "permissions" | "users" | "kycs" | "loans" | "loanPackages" | "loanStats" | "recentLoans";

type AdminCenterData = Record<DataKey, unknown> & {
  errors: Partial<Record<DataKey, string>>;
};

type DetailState = {
  title: string;
  loading: boolean;
  data: unknown;
  error: string;
};

const endpoints: Array<[DataKey, () => Promise<unknown>]> = [
  ["admins", adminService.getAdmins],
  ["roles", adminService.getRoles],
  ["permissions", adminService.getPermissions],
  ["users", () => adminService.getUsers()],
  ["kycs", adminService.getKycs],
  ["loans", () => adminService.getLoansList()],
  ["loanPackages", adminService.getLoanPackages],
  ["loanStats", adminService.getAdminLoansStats],
  ["recentLoans", adminService.getAdminRecentLoans],
];

const sections: Array<{ key: AdminSection; label: string; icon: typeof Users }> = [
  { key: "admins", label: "Admins", icon: ShieldCheck },
  { key: "roles", label: "Roles", icon: UserCog },
  { key: "users", label: "Users", icon: Users },
  { key: "kyc", label: "KYC", icon: FileCheck2 },
  { key: "loans", label: "Loans", icon: CreditCard },
];

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

const getId = (row: Record<string, unknown>) => String(getRecordValue(row, ["_id", "id", "userId", "loanId"]) ?? "");

const getPersonName = (row: Record<string, unknown>) => {
  const combined = [row.first_name, row.last_name].filter((item) => typeof item === "string").join(" ");
  return combined || String(getRecordValue(row, ["name", "fullName", "email", "phone"]) ?? "Unnamed record");
};

const fetchAdminCenter = async (): Promise<AdminCenterData> => {
  const results = await Promise.allSettled(endpoints.map(([, request]) => request()));
  const data = {} as Record<DataKey, unknown>;
  const errors: Partial<Record<DataKey, string>> = {};

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
    admins: data.admins,
    roles: data.roles,
    permissions: data.permissions,
    users: data.users,
    kycs: data.kycs,
    loans: data.loans,
    loanPackages: data.loanPackages,
    loanStats: data.loanStats,
    recentLoans: data.recentLoans,
    errors,
  };
};

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? "pending").toLowerCase();
  const isSuccess = ["active", "approved", "success", "successful", "completed"].includes(normalized);
  const isFailed = ["inactive", "failed", "rejected", "declined", "disabled"].includes(normalized);
  const classes = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
    : isFailed
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {String(status ?? "Pending")}
    </span>
  );
}

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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function DetailModal({ detail, onClose }: { detail: DetailState; onClose: () => void }) {
  const data = unwrapPayload(detail.data);
  const entries = isRecord(data) ? Object.entries(data).slice(0, 36) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Admin center record
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{detail.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[76vh] overflow-y-auto p-5">
          {detail.loading && (
            <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading details
            </div>
          )}
          {detail.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {detail.error}
            </div>
          )}
          {!detail.loading && !detail.error && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {formatLabel(key)}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">
                    {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "Not available")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagementTable({
  title,
  rows,
  columns,
  children,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  children: (row: Record<string, unknown>, index: number) => React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        <BriefcaseBusiness className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
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
          No records returned.
        </div>
      )}
    </section>
  );
}

export default function AdminCenterPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<AdminSection>("admins");
  const [adminData, setAdminData] = useState<AdminCenterData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    void fetchAdminCenter().then((result) => {
      if (!cancelled) {
        setAdminData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const admins = useMemo(() => extractRows(adminData?.admins), [adminData]);
  const roles = useMemo(() => extractRows(adminData?.roles), [adminData]);
  const permissions = useMemo(() => extractRows(adminData?.permissions), [adminData]);
  const users = useMemo(() => extractRows(adminData?.users), [adminData]);
  const kycs = useMemo(() => extractRows(adminData?.kycs), [adminData]);
  const loans = useMemo(() => extractRows(adminData?.loans), [adminData]);
  const loanPackages = useMemo(() => extractRows(adminData?.loanPackages), [adminData]);
  const endpointErrors = adminData ? Object.entries(adminData.errors) : [];

  const refreshData = async () => {
    setRefreshing(true);
    setAdminData(await fetchAdminCenter());
    setRefreshing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  const openDetail = async (title: string, request: () => Promise<unknown>) => {
    setDetail({ title, loading: true, data: null, error: "" });

    try {
      const data = await request();
      setDetail({ title, loading: false, data, error: "" });
    } catch (error) {
      setDetail({ title, loading: false, data: null, error: getErrorMessage(error) });
    }
  };

  const toggleAdmin = async (id: string) => {
    setBusyAction(`admin-${id}`);
    await adminService.toggleAdminStatus(id);
    await refreshData();
    setBusyAction(null);
  };

  const reviewKyc = async (id: string, action: "approve" | "reject") => {
    setBusyAction(`kyc-${id}-${action}`);
    await adminService.approveKyc(id, {
      action,
      reason: action === "approve" ? "Approved from admin center" : "Rejected from admin center",
    });
    await refreshData();
    setBusyAction(null);
  };

  const reviewLoan = async (id: string, action: "approve" | "reject") => {
    setBusyAction(`loan-${id}-${action}`);

    if (action === "approve") {
      await adminService.approveLoan(id, { disburseToWallet: false });
    } else {
      await adminService.rejectLoan(id, { reason: "Rejected from admin center" });
    }

    await refreshData();
    setBusyAction(null);
  };

  const summaryCards = [
    { label: "Admins", value: formatValue(admins.length), icon: ShieldCheck },
    { label: "Roles", value: formatValue(roles.length), icon: UserCog },
    { label: "Users", value: formatValue(users.length), icon: Users },
    { label: "KYC reviews", value: formatValue(kycs.length), icon: FileCheck2 },
    { label: "Loans", value: formatValue(loans.length), icon: CreditCard },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950 dark:bg-[#07111f] dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#07111f]/95">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-5 py-4 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-white/10">
              <Image src="/eazy-logo.svg" alt="EazyCredit" width={140} height={29} priority className="h-auto w-[140px]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Official administration
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                Admin Center
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={refreshData}
              disabled={refreshing}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              aria-label="Toggle color theme"
            >
              <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
              <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-6 sm:px-8">
        <section className="rounded-lg border border-slate-200 bg-[#0b1728] p-6 text-white shadow-xl dark:border-white/10 dark:bg-black">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Management workspace
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Central control for staff, roles, users, KYC, and loan operations.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Review operational records, inspect customer profiles, and perform controlled approvals from one administrative page.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
              {summaryCards.slice(0, 4).map((card) => (
                <div key={card.label} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{card.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {endpointErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Some admin endpoints did not respond.</p>
                <p className="mt-1">{endpointErrors.map(([key]) => formatLabel(key)).join(", ")}</p>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold transition ${
                  activeSection === section.key
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </section>

        {!adminData ? (
          <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ) : (
          <>
            {activeSection === "admins" && (
              <ManagementTable title="Administrators" rows={admins} columns={["Admin", "Email", "Role", "Status", "Created", "Action"]}>
                {(row, index) => {
                  const id = getId(row);
                  const user = getRecordValue(row, ["user"]);
                  const userRecord = isRecord(user) ? user : row;
                  return (
                    <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{getPersonName(userRecord)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(userRecord, ["email"]) ?? "Not available")}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["role", "role_id", "roleId"]) ?? "Admin")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!id || busyAction === `admin-${id}`}
                          onClick={() => toggleAdmin(id)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          {busyAction === `admin-${id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                          Toggle
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </ManagementTable>
            )}

            {activeSection === "roles" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <ManagementTable title="Roles" rows={roles} columns={["Role", "Status", "Created", "Permissions"]}>
                  {(row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["name", "title", "role"]) ?? `Role ${index + 1}`)}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">{formatValue(getRecordValue(row, ["permissions", "permissionCount"]) ?? 0)}</td>
                    </tr>
                  )}
                </ManagementTable>
                <ManagementTable title="Permissions" rows={permissions} columns={["Permission", "Module"]}>
                  {(row, index) => (
                    <tr key={`${getId(row)}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["name", "title", "permission"]) ?? `Permission ${index + 1}`)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["module", "group", "category"]) ?? "General")}</td>
                    </tr>
                  )}
                </ManagementTable>
              </div>
            )}

            {activeSection === "users" && (
              <ManagementTable title="Users" rows={users} columns={["Customer", "Email", "Phone", "Status", "Created", "Action"]}>
                {(row, index) => {
                  const id = getId(row);
                  return (
                    <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{getPersonName(row)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["email"]) ?? "Not available")}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["phone", "phone_number"]) ?? "Not available")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "active"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!id}
                          onClick={() => openDetail("User dashboard", () => adminService.getUserDashboard(id))}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </ManagementTable>
            )}

            {activeSection === "kyc" && (
              <ManagementTable title="KYC reviews" rows={kycs} columns={["User", "Tier", "Status", "Created", "Action"]}>
                {(row, index) => {
                  const id = getId(row);
                  const pending = String(getRecordValue(row, ["status"]) ?? "").toLowerCase() === "pending";
                  return (
                    <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["userId", "user_id", "email"]) ?? `KYC ${index + 1}`)}</td>
                      <td className="px-5 py-4">{String(getRecordValue(row, ["tier", "level"]) ?? "Not available")}</td>
                      <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} /></td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!id}
                            onClick={() => openDetail("KYC details", () => adminService.getKycById(id))}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={!id || !pending || busyAction === `kyc-${id}-approve`}
                            onClick={() => reviewKyc(id, "approve")}
                            className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={!id || !pending || busyAction === `kyc-${id}-reject`}
                            onClick={() => reviewKyc(id, "reject")}
                            className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </ManagementTable>
            )}

            {activeSection === "loans" && (
              <div className="grid gap-6">
                <section className="grid gap-5 md:grid-cols-3">
                  <SummaryCard label="Loan records" value={formatValue(loans.length)} icon={CreditCard} />
                  <SummaryCard label="Loan packages" value={formatValue(loanPackages.length)} icon={BriefcaseBusiness} />
                  <SummaryCard label="Recent loans" value={formatValue(extractRows(adminData.recentLoans).length)} icon={CheckCircle2} />
                </section>
                <ManagementTable title="Loans" rows={loans} columns={["Customer", "Amount", "Status", "Created", "Action"]}>
                  {(row, index) => {
                    const id = getId(row);
                    const status = String(getRecordValue(row, ["status"]) ?? "").toLowerCase();
                    const canReview = !["approved", "active", "rejected"].includes(status);
                    return (
                      <tr key={`${id}-${index}`} className="text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{String(getRecordValue(row, ["customerName", "userId", "email"]) ?? `Loan ${index + 1}`)}</td>
                        <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">{formatCurrency(getRecordValue(row, ["amount", "loanAmount", "principal"]))}</td>
                        <td className="px-5 py-4"><StatusBadge status={getRecordValue(row, ["status"]) ?? "pending"} /></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRecordValue(row, ["createdAt", "updatedAt"]))}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!id}
                              onClick={() => openDetail("Loan details", () => adminService.getLoanDetails(id))}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={!id || !canReview || busyAction === `loan-${id}-approve`}
                              onClick={() => reviewLoan(id, "approve")}
                              className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!id || !canReview || busyAction === `loan-${id}-reject`}
                              onClick={() => reviewLoan(id, "reject")}
                              className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </ManagementTable>
              </div>
            )}
          </>
        )}
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
