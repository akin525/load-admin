"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  X,
  XCircle,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import { TablePagination, paginateItems } from "@/components/TablePagination";
import { OtpInput } from "@/components/OtpInput";

type QueueFilters = {
  search: string;
  status: string;
};

type QueueState = {
  payload: unknown;
  rows: Record<string, unknown>[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

type ActionNotice = {
  tone: "success" | "error" | "warning";
  message: string;
};

type OtpChallenge = {
  challengeId: string;
  channel?: string;
  email?: string;
  expiresAt?: string;
};

type PendingApproval = {
  title: string;
  description: string;
  challenge: OtpChallenge;
  onConfirm: (otpCode: string) => Promise<void>;
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
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
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
  if (typeof error === "object" && error !== null && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;

    if (isRecord(payload) && typeof payload.message === "string") {
      return payload.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  const foundKey = keys.find((key) => key in record);
  return foundKey ? record[foundKey] : undefined;
};

const getOtpChallenge = (payload: unknown): OtpChallenge | null => {
  if (!isRecord(payload) || payload.requiresOtp !== true || !isRecord(payload.data)) {
    return null;
  }

  if (typeof payload.data.challengeId !== "string" || !payload.data.challengeId.trim()) {
    return null;
  }

  return {
    challengeId: payload.data.challengeId,
    channel: typeof payload.data.channel === "string" ? payload.data.channel : undefined,
    email: typeof payload.data.email === "string" ? payload.data.email : undefined,
    expiresAt: typeof payload.data.expiresAt === "string" ? payload.data.expiresAt : undefined,
  };
};

const getPendingRequestId = (payload: unknown) => {
  if (!isRecord(payload)) {
    return "";
  }

  const direct = [payload.requestId, payload.request_id]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (direct) {
    return direct;
  }

  if (isRecord(payload.data)) {
    const nested = [payload.data.requestId, payload.data.request_id]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (nested) {
      return nested;
    }
  }

  return "";
};

const fetchQueue = async (): Promise<QueueState> => {
  try {
    const payload = await adminService.getActionRequests();

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

const findNestedValue = (value: unknown, keys: string[], depth = 0): unknown => {
  if (depth > 3 || !value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findNestedValue(entry, keys, depth + 1);
      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  const record = value as Record<string, unknown>;
  const direct = keys.find((key) => key in record);

  if (direct) {
    return record[direct];
  }

  for (const entry of Object.values(record)) {
    const found = findNestedValue(entry, keys, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
};

const getActionSignature = (record: Record<string, unknown>) =>
  [
    findNestedValue(record, ["action", "actionType", "type", "requestType", "operation", "event", "route", "path", "name"]),
    findNestedValue(record, ["resource", "entityType", "targetType", "module"]),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

const getRequestStatus = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["status", "approvalStatus", "state"]) ?? "pending");

const getRequestDisplayId = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["requestId", "request_id", "_id", "id"]) ?? "Unknown request");

const getRequestedAt = (record: Record<string, unknown>) =>
  findNestedValue(record, ["createdAt", "requestedAt", "date", "updatedAt"]);

const getRequestedBy = (record: Record<string, unknown>) =>
  String(
    findNestedValue(record, ["requestedByName", "requestedByEmail", "requestedBy", "createdByName", "createdByEmail", "adminName", "adminEmail"]) ??
      "Not available",
  );

const getTargetSummary = (record: Record<string, unknown>) =>
  String(
    findNestedValue(record, [
      "targetName",
      "userName",
      "customerName",
      "accountName",
      "loanTypeName",
      "resourceLabel",
      "title",
      "email",
      "userId",
      "loanId",
      "transferId",
      "walletTransactionId",
    ]) ?? "Not available",
  );

const getActionType = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["actionType", "action", "type", "requestType"]) ?? "Not available");

const getActionLabel = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["actionLabel", "label", "actionName"]) ?? getActionTitle(record));

const getSubjectType = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["subjectType", "targetType", "entityType", "resource"]) ?? "Not available");

const getSubjectId = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["subjectId", "userId", "user_id", "loanId", "appLoanId", "transferId", "walletTransactionId"]) ?? "Not available");

const getSubjectName = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["subjectName", "targetName", "userName", "customerName", "accountName"]) ?? getTargetSummary(record));

const getPermissionName = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["permissionName", "permission", "requiredPermission"]) ?? "Not available");

const getInitiatedByName = (record: Record<string, unknown>) =>
  String(
    findNestedValue(record, [
      "initiatedByAdminName",
      "requestedByName",
      "createdByName",
      "adminName",
      "requestedByEmail",
      "createdByEmail",
    ]) ?? "Not available",
  );

const getInitiatedByRoleName = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["initiatedByRoleName", "roleName", "adminRoleName"]) ?? "Not available");

const getDecisionByName = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["approvedByAdminName", "rejectedByAdminName", "reviewedByAdminName"]) ?? "Not available");

const getDecisionAt = (record: Record<string, unknown>) =>
  findNestedValue(record, ["approvedAt", "rejectedAt", "reviewedAt"]);

const getDecisionReason = (record: Record<string, unknown>) =>
  String(findNestedValue(record, ["rejectionReason", "approvalReason", "reviewReason", "reason"]) ?? "Not available");

const getActionTitle = (record: Record<string, unknown>) => {
  const signature = getActionSignature(record);

  if (signature.includes("reset") && signature.includes("password")) return "Reset password";
  if (signature.includes("fund") && signature.includes("wallet")) return "Fund wallet";
  if (signature.includes("unlock")) return "Unlock user";
  if (signature.includes("lock")) return "Lock user";
  if (signature.includes("disable")) return "Disable user";
  if (signature.includes("enable")) return "Enable user";
  if (signature.includes("wallet") && signature.includes("reverse")) return "Reverse wallet transaction";
  if (signature.includes("transfer") && signature.includes("reverse")) return "Reverse transfer";
  if (signature.includes("reschedule")) return "Reschedule app loan";
  if (signature.includes("app") && signature.includes("loan") && signature.includes("close")) return "Close app loan";
  if (signature.includes("loan") && signature.includes("close")) return "Close loan";

  return formatLabel(String(findNestedValue(record, ["action", "actionType", "type", "requestType"]) ?? "Action request"));
};

const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase();

  if (["approved", "success", "completed"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (["rejected", "failed", "declined"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";
};

type ApprovalTarget = {
  label: string;
  submit: (payload?: Record<string, unknown>) => Promise<unknown>;
};

const deriveApprovalTarget = (record: Record<string, unknown>): ApprovalTarget | null => {
  const signature = getActionSignature(record);
  const requestId = getRequestDisplayId(record);
  const withRequestId = (payload?: Record<string, unknown>) => ({ requestId, ...(payload ?? {}) });

  const userId = String(findNestedValue(record, ["userId", "user_id", "targetUserId", "subjectUserId"]) ?? "");
  const appLoanId = String(findNestedValue(record, ["appLoanId", "app_loan_id", "applicationLoanId"]) ?? "");
  const loanId = String(findNestedValue(record, ["loanId", "loan_id", "targetLoanId"]) ?? "");
  const walletTransactionId = String(findNestedValue(record, ["walletTransactionId", "wallet_transaction_id", "transactionId"]) ?? "");
  const transferId = String(findNestedValue(record, ["transferId", "transfer_id"]) ?? "");

  if (signature.includes("reset") && signature.includes("password") && userId) {
    return { label: "Approve password reset", submit: (payload) => adminService.approveResetUserPassword(userId, withRequestId(payload)) };
  }

  if (signature.includes("fund") && signature.includes("wallet") && userId) {
    return { label: "Approve wallet funding", submit: (payload) => adminService.approveFundUserWallet(userId, withRequestId(payload)) };
  }

  if (signature.includes("unlock") && userId) {
    return { label: "Approve unlock", submit: (payload) => adminService.approveUnlockUser(userId, withRequestId(payload)) };
  }

  if (signature.includes("lock") && userId) {
    return { label: "Approve lock", submit: (payload) => adminService.approveLockUser(userId, withRequestId(payload)) };
  }

  if (signature.includes("disable") && userId) {
    return { label: "Approve disable", submit: (payload) => adminService.approveDisableUser(userId, withRequestId(payload)) };
  }

  if (signature.includes("enable") && userId) {
    return { label: "Approve enable", submit: (payload) => adminService.approveEnableUser(userId, withRequestId(payload)) };
  }

  if (signature.includes("wallet") && signature.includes("reverse") && walletTransactionId) {
    return {
      label: "Approve wallet reversal",
      submit: (payload) => adminService.approveReverseWalletTransaction(walletTransactionId, withRequestId(payload)),
    };
  }

  if (signature.includes("transfer") && signature.includes("reverse") && transferId) {
    return { label: "Approve transfer reversal", submit: (payload) => adminService.approveReverseTransfer(transferId, withRequestId(payload)) };
  }

  if (signature.includes("reschedule") && appLoanId) {
    return { label: "Approve reschedule", submit: (payload) => adminService.approveRescheduleAppLoan(appLoanId, withRequestId(payload)) };
  }

  if (signature.includes("app") && signature.includes("loan") && signature.includes("close") && appLoanId) {
    return { label: "Approve app-loan close", submit: (payload) => adminService.approveCloseAppLoan(appLoanId, withRequestId(payload)) };
  }

  if (signature.includes("loan") && signature.includes("close") && loanId) {
    return { label: "Approve loan close", submit: (payload) => adminService.approveCloseLoan(loanId, withRequestId(payload)) };
  }

  return null;
};

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#069AFF]/10 text-[#069AFF] ring-1 ring-[#069AFF]/15 dark:bg-[#069AFF]/15 dark:text-sky-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function DetailField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.035] ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function JsonPanel({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-white/10">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">{label}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function DetailModal({
  row,
  loading,
  error,
  onClose,
}: {
  row: Record<string, unknown> | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const status = row ? getRequestStatus(row) : "pending";
  const normalizedStatus = status.toLowerCase();
  const hasDecision = ["approved", "rejected"].includes(normalizedStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Action request</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {row ? getActionTitle(row) : "Loading request"}
            </h2>
            {row ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
                  {status}
                </span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {getRequestDisplayId(row)}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading action request details...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          ) : row ? (
            <div className="grid gap-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <div className="grid gap-5">
                  <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Request overview</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{getActionLabel(row)}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Request ID" value={getRequestDisplayId(row)} />
                      <DetailField label="Action Type" value={getActionType(row)} />
                      <DetailField label="Action Label" value={getActionLabel(row)} />
                      <DetailField label="Permission" value={getPermissionName(row)} />
                      <DetailField label="Created At" value={formatDate(getRequestedAt(row))} />
                      <DetailField label="Updated At" value={formatDate(findNestedValue(row, ["updatedAt"]))} />
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Subject</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{getSubjectName(row)}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Subject Type" value={getSubjectType(row)} />
                      <DetailField label="Subject ID" value={getSubjectId(row)} />
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Initiated By</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{getInitiatedByName(row)}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Admin Name" value={getInitiatedByName(row)} />
                      <DetailField label="Role" value={getInitiatedByRoleName(row)} />
                      <DetailField label="Admin ID" value={formatValue(findNestedValue(row, ["initiatedByAdminId"]))} />
                      <DetailField label="Admin User ID" value={formatValue(findNestedValue(row, ["initiatedByAdminUserId"]))} />
                    </div>
                  </section>

                  {hasDecision ? (
                    <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">Decision</p>
                        <h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                          {normalizedStatus === "rejected" ? "Rejected request" : "Approved request"}
                        </h3>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <DetailField label="Decision By" value={getDecisionByName(row)} />
                        <DetailField label="Decision At" value={formatDate(getDecisionAt(row))} />
                        <DetailField
                          label={normalizedStatus === "rejected" ? "Rejection Reason" : "Decision Reason"}
                          value={getDecisionReason(row)}
                          className="sm:col-span-2"
                        />
                      </div>
                    </section>
                  ) : null}
                </div>

                <div className="grid gap-5">
                  <JsonPanel label="Payload" value={findNestedValue(row, ["payload"])} />
                  <JsonPanel label="Metadata" value={findNestedValue(row, ["metadata"])} />
                  <JsonPanel label="Raw Request JSON" value={row} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OtpModal({
  pending,
  otpCode,
  onChange,
  onClose,
  onSubmit,
  submitting,
}: {
  pending: PendingApproval;
  otpCode: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07111f]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#069AFF]">OTP confirmation</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{pending.title}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{pending.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">OTP code</label>
            <OtpInput value={otpCode} onChange={onChange} disabled={submitting} />
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || otpCode.trim().length < 6}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#069AFF] px-5 text-sm font-bold text-white disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            Confirm approval
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActionRequestsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { allowed } = useRouteAccess("/action-requests");
  const [queue, setQueue] = useState<QueueState>({ payload: null, rows: [], loading: false, loaded: false, error: "" });
  const [filters, setFilters] = useState<QueueFilters>({ search: "", status: "" });
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [submittingId, setSubmittingId] = useState("");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    if (!allowed) {
      return;
    }

    void fetchQueue().then((result) => {
      if (!cancelled) {
        setQueue(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [allowed, router]);

  const refreshQueue = async () => {
    setQueue((current) => ({ ...current, loading: true, error: "" }));
    const result = await fetchQueue();
    setQueue(result);
  };

  const rows = useMemo(() => {
    return queue.rows.filter((row) => {
      const search = filters.search.trim().toLowerCase();
      const status = filters.status.trim().toLowerCase();
      const haystack = [
        getRequestDisplayId(row),
        getActionTitle(row),
        getRequestedBy(row),
        getTargetSummary(row),
      ]
        .join(" ")
        .toLowerCase();

      if (search && !haystack.includes(search)) {
        return false;
      }

      if (status && getRequestStatus(row).toLowerCase() !== status) {
        return false;
      }

      return true;
    });
  }, [filters, queue.rows]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginateItems(rows, safeCurrentPage, pageSize);

  const summary = useMemo(() => {
    const pending = rows.filter((row) => getRequestStatus(row).toLowerCase().includes("pending")).length;
    const approved = rows.filter((row) => getRequestStatus(row).toLowerCase() === "approved").length;
    const rejected = rows.filter((row) => getRequestStatus(row).toLowerCase() === "rejected").length;
    return { pending, approved, rejected };
  }, [rows]);

  const handleView = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError("");

    try {
      const payload = await adminService.getActionRequestById(id);
      const detail = isRecord(unwrapPayload(payload)) ? (unwrapPayload(payload) as Record<string, unknown>) : null;
      setSelectedRow(detail);
    } catch (error) {
      setDetailError(getErrorMessage(error));
      setSelectedRow(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReject = async (row: Record<string, unknown>) => {
    const id = getRequestDisplayId(row);
    setRejectingId(id);
    setNotice(null);

    try {
      const response = await adminService.rejectActionRequest(id, { reason: "Rejected from action request queue" });
      setNotice({ tone: "success", message: String((isRecord(response) && response.message) || "Action request rejected.") });
      await refreshQueue();
      if (selectedId === id) {
        setSelectedId("");
        setSelectedRow(null);
      }
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setRejectingId("");
    }
  };

  const handleApprove = async (row: Record<string, unknown>) => {
    const id = getRequestDisplayId(row);
    const target = deriveApprovalTarget(selectedRow ?? row);

    if (!target) {
      setNotice({ tone: "error", message: "No approval route could be derived for this request." });
      return;
    }

    setSubmittingId(id);
    setNotice(null);

    try {
      const response = await target.submit();
      const challenge = getOtpChallenge(response);

      if (challenge) {
        setPendingApproval({
          title: target.label,
          description: "Approval requires an admin OTP confirmation.",
          challenge,
          onConfirm: async (code) => {
            setSubmittingId(id);

            try {
              await target.submit({
                otpChallengeId: challenge.challengeId,
                otpCode: code,
              });
              setPendingApproval(null);
              setOtpCode("");
              setNotice({ tone: "success", message: `${target.label} completed.` });
              await refreshQueue();
            } catch (error) {
              setNotice({ tone: "error", message: getErrorMessage(error) });
            } finally {
              setSubmittingId("");
            }
          },
        });
        setNotice({ tone: "warning", message: "OTP confirmation required to finish this approval." });
        return;
      }

      setNotice({ tone: "success", message: `${target.label} completed.` });
      await refreshQueue();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setSubmittingId("");
    }
  };

  if (!allowed) {
    return (
      <AccessDeniedState
        title="Action requests access denied"
        description="Your current admin role does not include maker-checker queue access."
      />
    );
  }

  return (
    <main className="min-h-screen pb-20 text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/80">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Action Requests</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Second-admin approval queue for sensitive operational changes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/reconciliation"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reconciliation
            </Link>
            <button
              type="button"
              onClick={() => void refreshQueue()}
              disabled={queue.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {queue.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Sync
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-6 py-8 sm:px-8">
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Pending approvals" value={formatValue(summary.pending)} icon={Clock3} />
          <SummaryCard label="Approved" value={formatValue(summary.approved)} icon={CheckCircle2} />
          <SummaryCard label="Rejected" value={formatValue(summary.rejected)} icon={XCircle} />
          <SummaryCard label="Visible queue items" value={formatValue(rows.length)} icon={ShieldCheck} />
        </section>

        <section className="overflow-hidden rounded-lg border border-[#069AFF]/20 bg-[linear-gradient(135deg,#06172b_0%,#083d70_50%,#069AFF_140%)] p-6 text-white shadow-xl shadow-[#069AFF]/15 dark:border-[#069AFF]/25">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#069AFF]/40 bg-[#069AFF]/15 px-3 py-1.5 text-xs font-bold text-sky-100">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Maker-checker queue
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight">Review sensitive admin actions before execution.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Sensitive user controls, reversals, and loan close requests now stop here first. A different admin approves them with OTP.
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-[#069AFF]/30 bg-[#069AFF]/10 p-4">
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Search</span>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" aria-hidden="true" />
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Request id, action, admin, target"
                    className="h-11 w-full rounded-lg border border-white/15 bg-white/10 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300"
                  />
                </div>
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-sky-100">Status</span>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {queue.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {queue.error}
          </div>
        )}

        {notice && (
          <div
            className={`rounded-lg border p-4 text-sm font-semibold ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                : notice.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
            }`}
          >
            {notice.message}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Request</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Requested by</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {paginatedRows.map((row, index) => {
                  const requestId = getRequestDisplayId(row);
                  const status = getRequestStatus(row);
                  const canApprove = status.toLowerCase().includes("pending");

                  return (
                    <tr key={`${requestId}-${index}`} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950 dark:text-white">{requestId}</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{getActionTitle(row)}</td>
                      <td className="px-5 py-4">{getRequestedBy(row)}</td>
                      <td className="px-5 py-4">{getTargetSummary(row)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(getRequestedAt(row))}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleView(requestId)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#069AFF]/40 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={!canApprove || submittingId === requestId}
                            onClick={() => void handleApprove(row)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                          >
                            {submittingId === requestId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={!canApprove || rejectingId === requestId}
                            onClick={() => void handleReject(row)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                          >
                            {rejectingId === requestId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                            Reject
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
              No action requests matched the current filter set.
            </div>
          )}
        </section>
      </div>

      {selectedId && (
        <DetailModal
          row={selectedRow}
          loading={detailLoading}
          error={detailError}
          onClose={() => {
            setSelectedId("");
            setSelectedRow(null);
            setDetailError("");
          }}
        />
      )}
      {pendingApproval && (
        <OtpModal
          pending={pendingApproval}
          otpCode={otpCode}
          onChange={setOtpCode}
          onClose={() => {
            if (submittingId) {
              return;
            }

            setPendingApproval(null);
            setOtpCode("");
          }}
          onSubmit={() => void pendingApproval.onConfirm(otpCode.trim())}
          submitting={submittingId.length > 0}
        />
      )}
    </main>
  );
}
