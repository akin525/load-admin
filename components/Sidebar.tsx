"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileSearch,
  FileText,
  HelpCircle,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { clearAdminSession } from "@/lib/admin-access";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/loans", label: "Loans", icon: CreditCard },
      { href: "/users", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Finance Operations",
    items: [
      { href: "/deposits", label: "Deposits", icon: Landmark },
      { href: "/fees", label: "Fees", icon: Landmark },
      { href: "/wallet-transactions", label: "Wallet Ledger", icon: WalletCards },
      { href: "/transfers", label: "Transfers", icon: Send },
      { href: "/xpress-webhook-logs", label: "Webhook Logs", icon: Activity },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Control Center",
    items: [
      { href: "/admin", label: "Admin Center", icon: ShieldCheck },
      { href: "/action-requests", label: "Action Requests", icon: FileText, badge: "New" },
      { href: "/system-settings", label: "System Settings", icon: Settings2 },
      { href: "/faqs", label: "FAQs", icon: HelpCircle },
      { href: "/email-logs", label: "Email Logs", icon: FileText },
      { href: "/audit-logs", label: "Audit Logs", icon: FileText },
      { href: "/reconciliation", label: "Reconciliation", icon: FileSearch, badge: "New" },
    ],
  },
];

const hiddenRoutes = ["/", "/auth/login"];

const cn = (...classes: Array<string | false | null | undefined>) => {
  return classes.filter(Boolean).join(" ");
};

const subscribe = () => () => {};

type PasswordMessageTone = "success" | "error";

type PasswordMessage = {
  tone: PasswordMessageTone;
  text: string;
};

const getResponseMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;

    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }

  return fallback;
};

function ChangePasswordModal({
  oldPassword,
  newPassword,
  confirmPassword,
  onChange,
  onClose,
  onSubmit,
  submitting,
  message,
}: {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  onChange: (field: "oldPassword" | "newPassword" | "confirmPassword", value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  message: PasswordMessage | null;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1728]">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/[0.08]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15">
              <KeyRound className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Account security
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Change password</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Confirm the current password, then set a new one for this admin session.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Current password
              </span>
              <input
                type="password"
                value={oldPassword}
                onChange={(event) => onChange("oldPassword", event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                placeholder="Enter current password"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                New password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => onChange("newPassword", event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                placeholder="Enter new password"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Confirm new password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => onChange("confirmPassword", event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          {message && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold",
                message.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
              )}
            >
              {message.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#069AFF] px-5 text-sm font-black text-white shadow-lg shadow-[#069AFF]/20 transition hover:bg-[#0587df] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SidebarContent({
                          pathname,
                          activeLabel,
                          isDarkMode,
                          onToggleTheme,
                          onChangePassword,
                          onLogout,
                          onNavigate,
                          onClose,
                          mobile = false,
                          navGroups,
                          adminName,
                          adminRole,
                        }: {
  pathname: string;
  activeLabel: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  mobile?: boolean;
  navGroups: NavGroup[];
  adminName?: string;
  adminRole?: string;
}) {
  return (
      <div className="flex h-full flex-col">
        <div className="flex h-[78px] items-center border-b border-slate-100 px-5 dark:border-white/[0.06]">
          <Link
              href="/dashboard"
              onClick={onNavigate}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <Image
                  src="/eazy-logo.svg"
                  alt="EazyCredit"
                  width={118}
                  height={24}
                  priority
                  className="h-auto w-[118px] dark:brightness-0 dark:invert"
              />
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Admin Operations Suite
              </p>
            </div>

            {!mobile && (
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#069AFF] dark:text-slate-600" />
            )}
          </Link>

          {mobile && (
              <button
                  type="button"
                  onClick={onClose}
                  className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
          )}
        </div>

        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]">
          <div className="rounded-2xl border border-[#069AFF]/15 bg-gradient-to-br from-[#069AFF]/10 to-transparent p-4 dark:border-[#069AFF]/20 dark:from-[#069AFF]/15">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#069AFF] text-white shadow-md shadow-[#069AFF]/25">
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                  {activeLabel}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Real-time control enabled
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-300">
                  Online
                </p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Role
                </p>
                <p className="mt-1 text-xs font-black text-slate-800 dark:text-white">
                  Admin
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <nav className="space-y-6">
            {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {group.title}
                  </p>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.exact
                          ? pathname === item.href
                          : pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                          <Link
                              key={item.href}
                              href={item.href}
                              onClick={onNavigate}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                  "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all duration-200",
                                  isActive
                                      ? "bg-[#069AFF] text-white shadow-lg shadow-[#069AFF]/25"
                                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                              )}
                          >
                      <span
                          className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                              isActive
                                  ? "bg-white/15 text-white"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#069AFF] dark:bg-white/[0.04] dark:text-slate-400 dark:group-hover:bg-white/[0.08] dark:group-hover:text-sky-300"
                          )}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.7 : 2.2} />
                      </span>

                            <span className="min-w-0 flex-1 truncate">{item.label}</span>

                            {item.badge && (
                                <span
                                    className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em]",
                                        isActive
                                            ? "bg-white/15 text-white"
                                            : "bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15 dark:text-sky-300"
                                    )}
                                >
                          {item.badge}
                        </span>
                            )}

                            {isActive && (
                                <span className="absolute -right-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-l-full bg-white/90" />
                            )}
                          </Link>
                      );
                    })}
                  </div>
                </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4 dark:border-white/[0.06]">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                  System Admin
                </p>
                <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Authenticated session
                </p>
              </div>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onToggleTheme}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-[#069AFF]/30 hover:bg-[#069AFF]/5 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-[#069AFF]/30 dark:hover:bg-[#069AFF]/10 dark:hover:text-sky-300"
                title="Toggle theme"
            >
              {isDarkMode ? (
                  <>
                    <Sun className="h-[18px] w-[18px]" />
                    Light Mode
                  </>
              ) : (
                  <>
                    <Moon className="h-[18px] w-[18px]" />
                    Dark Mode
                  </>
              )}
            </button>

            <button
                type="button"
                onClick={onChangePassword}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#069AFF]/30 hover:bg-[#069AFF]/5 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:hover:border-[#069AFF]/30 dark:hover:bg-[#069AFF]/10 dark:hover:text-sky-300"
                title="Change password"
            >
              <KeyRound className="h-[18px] w-[18px]" />
            </button>

            <button
                type="button"
                onClick={onLogout}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                title="Logout"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<PasswordMessage | null>(null);
  const [passwordValues, setPasswordValues] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  const isDarkMode = mounted && resolvedTheme === "dark";

  const visibleNavGroups = navGroups;

  const activeLabel = useMemo(() => {
    for (const group of visibleNavGroups) {
      const activeItem = group.items.find((item) => {
        if (item.exact) return pathname === item.href;
        return pathname === item.href || pathname.startsWith(`${item.href}/`);
      });

      if (activeItem) return activeItem.label;
    }

    return "Workspace";
  }, [pathname, visibleNavGroups]);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }

    clearAdminSession();
    router.replace("/auth/login");
  };

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  const openChangePassword = () => {
    setPasswordMessage(null);
    setChangePasswordOpen(true);
  };

  const closeChangePassword = () => {
    if (submittingPassword) {
      return;
    }

    setChangePasswordOpen(false);
    setPasswordMessage(null);
    setPasswordValues({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handlePasswordFieldChange = (field: "oldPassword" | "newPassword" | "confirmPassword", value: string) => {
    setPasswordValues((current) => ({ ...current, [field]: value }));
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (!passwordValues.oldPassword || !passwordValues.newPassword || !passwordValues.confirmPassword) {
      setPasswordMessage({ tone: "error", text: "All password fields are required." });
      return;
    }

    if (passwordValues.newPassword !== passwordValues.confirmPassword) {
      setPasswordMessage({ tone: "error", text: "New password confirmation does not match." });
      return;
    }

    if (passwordValues.oldPassword === passwordValues.newPassword) {
      setPasswordMessage({ tone: "error", text: "New password must be different from the current password." });
      return;
    }

    setSubmittingPassword(true);

    try {
      const response = await adminService.changePassword({
        oldPassword: passwordValues.oldPassword,
        newPassword: passwordValues.newPassword,
      });

      setPasswordMessage({
        tone: "success",
        text: getResponseMessage(response, "Password changed successfully."),
      });

      setPasswordValues({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordMessage({
        tone: "error",
        text: getErrorMessage(error, "Unable to change password."),
      });
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
      <>
        {/* Mobile Top Bar */}
        <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#07111f]/95 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <Image
                    src="/eazy-logo.svg"
                    alt="EazyCredit"
                    width={110}
                    height={22}
                    priority
                    className="h-auto w-[110px] dark:brightness-0 dark:invert"
                />
                <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {activeLabel}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-[#069AFF]/30 hover:text-[#069AFF] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-sky-300"
                  aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#069AFF] text-white shadow-lg shadow-[#069AFF]/25"
                  aria-label="Open navigation menu"
                  aria-expanded={mobileOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Drawer */}
        <div
            className={cn(
                "fixed inset-0 z-50 lg:hidden",
                mobileOpen ? "pointer-events-auto" : "pointer-events-none"
            )}
        >
          <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation overlay"
              className={cn(
                  "absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300",
                  mobileOpen ? "opacity-100" : "opacity-0"
              )}
          />

          <aside
              className={cn(
                  "absolute left-0 top-0 flex h-screen h-dvh w-[88vw] max-w-[350px] flex-col border-r border-slate-200/80 bg-white shadow-2xl transition-transform duration-300 dark:border-white/[0.08] dark:bg-[#07111f]",
                  mobileOpen ? "translate-x-0" : "-translate-x-full"
              )}
          >
            <SidebarContent
                pathname={pathname}
                activeLabel={activeLabel}
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
                onChangePassword={openChangePassword}
                onLogout={handleLogout}
                onNavigate={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
                mobile
                navGroups={visibleNavGroups}
            />
          </aside>
        </div>

        {/* Desktop Sidebar */}
        <aside className="sticky top-0 z-40 hidden h-screen w-[292px] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 shadow-[12px_0_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.08] dark:bg-[#07111f]/95 dark:shadow-none lg:flex">
          <SidebarContent
              pathname={pathname}
              activeLabel={activeLabel}
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
              onChangePassword={openChangePassword}
              onLogout={handleLogout}
              navGroups={visibleNavGroups}
          />
        </aside>

        {changePasswordOpen && (
          <ChangePasswordModal
            oldPassword={passwordValues.oldPassword}
            newPassword={passwordValues.newPassword}
            confirmPassword={passwordValues.confirmPassword}
            onChange={handlePasswordFieldChange}
            onClose={closeChangePassword}
            onSubmit={(event) => void handleChangePassword(event)}
            submitting={submittingPassword}
            message={passwordMessage}
          />
        )}
      </>
  );
}
