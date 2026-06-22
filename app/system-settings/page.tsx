"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";

type SettingsState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  groups: Array<{ category: string; rows: Record<string, unknown>[] }>;
  loading: boolean;
  loaded: boolean;
  error: string;
};

type SettingValues = {
  name: string;
  value: string;
  description: string;
};

type FeedbackTone = "success" | "error";

type FeedbackState = {
  tone: FeedbackTone;
  text: string;
} | null;

type SettingModalConfig = {
  mode: "create" | "upsert" | "update";
  title: string;
  description: string;
  values: SettingValues;
  nameReadOnly?: boolean;
};

type BulkSettingRow = {
  id: number;
  name: string;
  value: string;
  description: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
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

  return "Request failed";
};

const getResponseMessage = (payload: unknown, fallback: string) => {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const getSettingName = (row: Record<string, unknown>) =>
  String(getRecordValue(row, ["name", "key", "slug"]) ?? "");

const formatValue = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim() || "Not set";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || typeof value === "undefined") {
    return "Not set";
  }

  return JSON.stringify(value);
};

const normalizeCategoryLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const deriveCategory = (name: string) => {
  const normalized = name.toLowerCase();

  if (normalized.includes("bankone")) return "bankone";
  if (normalized.includes("payment") || normalized.includes("gateway") || normalized.includes("payin") || normalized.includes("payout")) return "payments";
  if (normalized.includes("security") || normalized.includes("password") || normalized.includes("otp") || normalized.includes("2fa") || normalized.includes("auth") || normalized.includes("jwt")) return "security";
  if (normalized.includes("email") || normalized.includes("smtp") || normalized.includes("mailer")) return "email";
  if (normalized.includes("loan") || normalized.includes("core")) return "loan";
  return "general";
};

const extractSettingsRows = (payload: unknown): Record<string, unknown>[] => {
  const value = unwrapPayload(payload);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const directKeys = ["settings", "items", "rows", "data"];
  for (const key of directKeys) {
    if (Array.isArray(value[key])) {
      return value[key].filter(isRecord);
    }
  }

  const nestedArray = Object.values(value).find(Array.isArray);
  return Array.isArray(nestedArray) ? nestedArray.filter(isRecord) : [];
};

const extractCategoryGroups = (payload: unknown, rows: Record<string, unknown>[]) => {
  const value = unwrapPayload(payload);
  const candidate = isRecord(value)
    ? (isRecord(value.categories)
        ? value.categories
        : isRecord(value.grouped)
          ? value.grouped
          : isRecord(value.groupedCategories)
            ? value.groupedCategories
            : null)
    : null;

  if (candidate) {
    const groups = Object.entries(candidate)
      .map(([category, list]) => ({
        category,
        rows: Array.isArray(list) ? list.filter(isRecord) : [],
      }))
      .filter((group) => group.rows.length > 0);

    if (groups.length) {
      return groups;
    }
  }

  const grouped = rows.reduce<Record<string, Record<string, unknown>[]>>((accumulator, row) => {
    const category = deriveCategory(getSettingName(row));
    accumulator[category] ??= [];
    accumulator[category].push(row);
    return accumulator;
  }, {});

  return Object.entries(grouped).map(([category, categoryRows]) => ({
    category,
    rows: categoryRows,
  }));
};

const defaultBulkRows = (): BulkSettingRow[] => [
  {
    id: 1,
    name: "app_core_loan_code",
    value: "300",
    description: "BankOne loan product code",
  },
  {
    id: 2,
    name: "app_core_account_code",
    value: "200",
    description: "BankOne account product code",
  },
  {
    id: 3,
    name: "bankone_account_officer_code",
    value: "EC001",
    description: "BankOne account officer code",
  },
  {
    id: 4,
    name: "bankone_institution_code",
    value: "101080",
    description: "BankOne institution code",
  },
  {
    id: 5,
    name: "active_payment_gateway",
    value: "xpress",
    description: "Active payment gateway",
  },
];

const fetchSystemSettings = async (): Promise<SettingsState> => {
  try {
    const payload = await adminService.getSystemSettings();
    const rows = extractSettingsRows(payload);

    return {
      payload,
      rows,
      groups: extractCategoryGroups(payload, rows),
      loading: false,
      loaded: true,
      error: "",
    };
  } catch (error) {
    return {
      payload: null,
      rows: [],
      groups: [],
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
  icon: typeof Settings2;
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

function SettingModal({
  config,
  onClose,
  onSubmit,
}: {
  config: SettingModalConfig;
  onClose: () => void;
  onSubmit: (values: SettingValues) => Promise<void>;
}) {
  const [values, setValues] = useState(config.values);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!values.name.trim()) {
      setError("Setting name is required.");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        name: values.name.trim(),
        value: values.value,
        description: values.description.trim(),
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">System setting</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{config.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{config.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close system setting modal"
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
            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Setting name</span>
              <input
                value={values.name}
                readOnly={config.nameReadOnly}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="active_payment_gateway"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 read-only:bg-slate-50 read-only:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:read-only:bg-slate-950/40 dark:read-only:text-slate-300"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Value</span>
              <input
                value={values.value}
                onChange={(event) => setValues((current) => ({ ...current, value: event.target.value }))}
                placeholder="xpress"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Description</span>
              <textarea
                value={values.description}
                onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                placeholder="Describe what this setting controls"
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              Save setting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkUpsertModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (rows: Array<{ name: string; value: string; description: string }>) => Promise<void>;
}) {
  const [rows, setRows] = useState<BulkSettingRow[]>(defaultBulkRows());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const updateRow = (id: number, field: keyof Omit<BulkSettingRow, "id">, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        id: Date.now(),
        name: "",
        value: "",
        description: "",
      },
    ]);
  };

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const sanitized = rows
      .map((row) => ({
        name: row.name.trim(),
        value: row.value,
        description: row.description.trim(),
      }))
      .filter((row) => row.name);

    if (!sanitized.length) {
      setError("Add at least one setting row.");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(sanitized);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bulk update</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Bulk upsert system settings</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Save multiple settings in one operation for BankOne, gateway, email, security, or general platform configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-200"
            aria-label="Close bulk system settings modal"
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

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                <tr>
                  {["Setting name", "Value", "Description", "Action"].map((column) => (
                    <th key={column} className="px-4 py-3 font-bold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <input
                        value={row.name}
                        onChange={(event) => updateRow(row.id, "name", event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        placeholder="bankone_institution_code"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.value}
                        onChange={(event) => updateRow(row.id, "value", event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        placeholder="101080"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.description}
                        onChange={(event) => updateRow(row.id, "description", event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        placeholder="Describe this system setting"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
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
            label="bulk rows"
          />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/50 dark:hover:text-sky-200"
            >
              <Plus className="h-4 w-4" />
              Add row
            </button>

            <div className="flex items-center gap-3">
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
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                Save settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SystemSettingsPage() {
  const router = useRouter();
  const { allowed: canOpenSystemSettings } = useRouteAccess("/system-settings");
  const [settingsState, setSettingsState] = useState<SettingsState>({
    payload: null,
    rows: [],
    groups: [],
    loading: true,
    loaded: false,
    error: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lookupName, setLookupName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [modalConfig, setModalConfig] = useState<SettingModalConfig | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!canOpenSystemSettings) {
      return;
    }

    void fetchSystemSettings().then((result) => {
      if (!cancelled) {
        setSettingsState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canOpenSystemSettings, router]);

  const refreshSettings = async () => {
    setRefreshing(true);
    setSettingsState((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchSystemSettings();
    setSettingsState(result);
    setRefreshing(false);
  };

  const rows = settingsState.rows;
  const visibleGroups = useMemo(
    () =>
      activeCategory === "all"
        ? settingsState.groups
        : settingsState.groups.filter((group) => group.category.toLowerCase() === activeCategory),
    [activeCategory, settingsState.groups],
  );

  const summaryCards = useMemo(() => {
    const byCategory = (category: string) => rows.filter((row) => deriveCategory(getSettingName(row)) === category).length;

    return [
      { label: "Settings loaded", value: String(rows.length), icon: Settings2 },
      { label: "BankOne settings", value: String(byCategory("bankone")), icon: ShieldCheck },
      { label: "Payment settings", value: String(byCategory("payments")), icon: Save },
      { label: "Security settings", value: String(byCategory("security")), icon: AlertCircle },
    ];
  }, [rows]);

  const categoryOptions = useMemo(() => {
    const categories = settingsState.groups.map((group) => group.category.toLowerCase());
    return ["all", ...Array.from(new Set(categories))];
  }, [settingsState.groups]);

  const flattenedVisibleRows = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.rows.map((row) => ({
          category: group.category,
          row,
        })),
      ),
    [visibleGroups],
  );

  const totalPages = Math.max(1, Math.ceil(flattenedVisibleRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedVisibleRowsSafe = paginateItems(flattenedVisibleRows, safeCurrentPage, pageSize);

  const openCreateModal = () => {
    setModalConfig({
      mode: "create",
      title: "Create system setting",
      description: "Register a new configuration key with its current value and operational meaning.",
      values: {
        name: "",
        value: "",
        description: "",
      },
    });
  };

  const openUpsertModal = () => {
    setModalConfig({
      mode: "upsert",
      title: "Upsert system setting",
      description: "Create a new setting or update an existing one by name from one action surface.",
      values: {
        name: "",
        value: "",
        description: "",
      },
    });
  };

  const openAdminIpAllowlistModal = () => {
    setModalConfig({
      mode: "upsert",
      title: "Configure admin IP allowlist",
      description: "Set the comma-separated IP addresses or CIDR ranges permitted for admin access.",
      values: {
        name: "admin_ip_allowlist",
        value: "102.88.114.242,102.89.33.86,197.210.0.0/16",
        description: "Allowed admin IPs or CIDR ranges",
      },
      nameReadOnly: true,
    });
  };

  const openUpdateModal = (row: Record<string, unknown>) => {
    setModalConfig({
      mode: "update",
      title: `Update ${getSettingName(row)}`,
      description: "Adjust the current value or operational description for this setting.",
      nameReadOnly: true,
      values: {
        name: getSettingName(row),
        value: String(getRecordValue(row, ["value"]) ?? ""),
        description: String(getRecordValue(row, ["description"]) ?? ""),
      },
    });
  };

  const handleSettingSubmit = async (values: SettingValues) => {
    let response: unknown;

    if (!modalConfig) {
      return;
    }

    if (modalConfig.mode === "create") {
      response = await adminService.createSystemSetting(values);
    } else if (modalConfig.mode === "upsert") {
      response = await adminService.upsertSystemSetting(values);
    } else {
      response = await adminService.updateSystemSetting(values.name, {
        value: values.value,
        description: values.description,
      });
    }

    setFeedback({
      tone: "success",
      text: getResponseMessage(response, "System setting saved successfully."),
    });
    setModalConfig(null);
    await refreshSettings();
  };

  const handleBulkSubmit = async (bulkRows: Array<{ name: string; value: string; description: string }>) => {
    const response = await adminService.bulkUpsertSystemSettings({ settings: bulkRows });
    setFeedback({
      tone: "success",
      text: getResponseMessage(response, "System settings saved successfully."),
    });
    setBulkOpen(false);
    await refreshSettings();
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete setting "${name}"?`)) {
      return;
    }

    try {
      const response = await adminService.deleteSystemSetting(name);
      setFeedback({
        tone: "success",
        text: getResponseMessage(response, "System setting deleted successfully."),
      });
      await refreshSettings();
      if (lookupResult && getSettingName(lookupResult) === name) {
        setLookupResult(null);
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        text: getErrorMessage(error),
      });
    }
  };

  const handleLookup = async () => {
    if (!lookupName.trim()) {
      setLookupError("Enter a setting name.");
      setLookupResult(null);
      return;
    }

    setLookupLoading(true);
    setLookupError("");

    try {
      const response = await adminService.getSystemSettingByName(lookupName.trim());
      const value = unwrapPayload(response);

      if (isRecord(value)) {
        setLookupResult(value);
      } else if (Array.isArray(value) && value.length && isRecord(value[0])) {
        setLookupResult(value[0]);
      } else {
        setLookupResult(null);
        setLookupError("No setting record returned for that name.");
      }
    } catch (error) {
      setLookupResult(null);
      setLookupError(getErrorMessage(error));
    } finally {
      setLookupLoading(false);
    }
  };

  if (!canOpenSystemSettings) {
    return (
      <AccessDeniedState
        title="System settings access denied"
        description="Your current admin role does not include permission to manage platform system settings."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        {!settingsState.loaded ? (
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
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                    <Settings2 className="h-4 w-4" aria-hidden="true" />
                    System configuration
                  </div>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Govern platform configuration, gateway routing, and BankOne operating values from one settings registry.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Review grouped categories, update individual keys, and push coordinated bulk changes for payments, security, email, and loan operations.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50"
                    >
                      <Plus className="h-4 w-4" />
                      Create setting
                    </button>
                    <button
                      type="button"
                      onClick={openUpsertModal}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <Save className="h-4 w-4" />
                      Upsert one
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <Upload className="h-4 w-4" />
                      Bulk upsert
                    </button>
                    <button
                      type="button"
                      onClick={openAdminIpAllowlistModal}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Admin IP Allowlist
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4 shadow-lg shadow-[#069AFF]/10">
                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Lookup by name</span>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={lookupName}
                        onChange={(event) => setLookupName(event.target.value)}
                        placeholder="active_payment_gateway"
                        className="h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300 focus:border-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => void handleLookup()}
                        disabled={lookupLoading}
                        className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
                      >
                        {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Find
                      </button>
                    </div>
                  </label>

                  {lookupError ? (
                    <div className="rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                      {lookupError}
                    </div>
                  ) : lookupResult ? (
                    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">Lookup result</p>
                      <p className="mt-2 text-base font-bold text-white">{getSettingName(lookupResult)}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{formatValue(getRecordValue(lookupResult, ["value"]))}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        {String(getRecordValue(lookupResult, ["description"]) ?? "No description provided.")}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
                      Use the exact setting name to fetch one record directly.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {settingsState.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                {settingsState.error}
              </div>
            )}

            {feedback && (
              <div
                className={`rounded-lg border p-4 text-sm font-semibold ${
                  feedback.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                }`}
              >
                {feedback.text}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Category filters</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Focus the registry on one operational category or review the full grouped setting inventory.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm font-bold transition ${
                          isActive
                            ? "border-[#069AFF] bg-[#069AFF] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                        }`}
                      >
                        {category === "all" ? "All categories" : normalizeCategoryLabel(category)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => void refreshSettings()}
                    disabled={refreshing}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#069AFF]/40 dark:hover:text-sky-200"
                  >
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-6">
              {visibleGroups.length ? (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-[#069AFF]/25 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-[#069AFF]/30">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <div>
                      <h2 className="text-lg font-bold text-slate-950 dark:text-white">System settings registry</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {flattenedVisibleRows.length} setting{flattenedVisibleRows.length === 1 ? "" : "s"} in the active category scope.
                      </p>
                    </div>
                    <span className="rounded-md bg-[#069AFF]/10 px-2.5 py-1 text-xs font-bold text-[#069AFF] dark:text-sky-200">
                      {flattenedVisibleRows.length} records
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                        <tr>
                          {["Category", "Name", "Value", "Description", "Action"].map((column) => (
                            <th key={column} className="px-5 py-3 font-bold">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {paginatedVisibleRowsSafe.map(({ category, row }, index) => {
                          const name = getSettingName(row);
                          const key = String(getRecordValue(row, ["_id", "id", "name"]) ?? `${category}-${index}`);

                          return (
                            <tr key={`${key}-${index}`} className="text-slate-700 dark:text-slate-300">
                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-md border border-[#069AFF]/20 bg-[#069AFF]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#069AFF] dark:text-sky-200">
                                  {normalizeCategoryLabel(category)}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-bold text-slate-950 dark:text-white">{name}</p>
                              </td>
                              <td className="px-5 py-4">
                                <div className="max-w-[18rem] break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100">
                                  {formatValue(getRecordValue(row, ["value"]))}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <p className="max-w-[28rem] break-words text-slate-600 dark:text-slate-300">
                                  {String(getRecordValue(row, ["description"]) ?? "No description provided.")}
                                </p>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openUpdateModal(row)}
                                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#069AFF]/30 bg-[#069AFF]/10 px-3 text-xs font-bold text-[#069AFF] transition hover:bg-[#069AFF] hover:text-white dark:text-sky-200"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(name)}
                                    className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
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
                    totalItems={flattenedVisibleRows.length}
                    currentPage={safeCurrentPage}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(next) => {
                      setPageSize(next);
                      setCurrentPage(1);
                    }}
                    label="settings"
                  />
                </section>
              ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    No system settings matched the current category filter.
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </div>

      {modalConfig && (
        <SettingModal
          config={modalConfig}
          onClose={() => setModalConfig(null)}
          onSubmit={handleSettingSubmit}
        />
      )}

      {bulkOpen && (
        <BulkUpsertModal
          onClose={() => setBulkOpen(false)}
          onSubmit={handleBulkSubmit}
        />
      )}
    </main>
  );
}
