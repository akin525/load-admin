"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  ChevronRight,
  CreditCard,
  FileSearch,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  WalletCards,
  X,
} from "lucide-react";

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
      { href: "/fees", label: "Fees", icon: Landmark },
      { href: "/wallet-transactions", label: "Wallet Ledger", icon: WalletCards },
      { href: "/xpress-webhook-logs", label: "Webhook Logs", icon: Activity },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Control Center",
    items: [
      { href: "/admin", label: "Admin Center", icon: ShieldCheck },
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

function SidebarContent({
                          pathname,
                          activeLabel,
                          isDarkMode,
                          onToggleTheme,
                          onLogout,
                          onNavigate,
                          onClose,
                          mobile = false,
                        }: {
  pathname: string;
  activeLabel: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  mobile?: boolean;
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

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  const isDarkMode = mounted && resolvedTheme === "dark";

  const activeLabel = useMemo(() => {
    for (const group of navGroups) {
      const activeItem = group.items.find((item) => {
        if (item.exact) return pathname === item.href;
        return pathname === item.href || pathname.startsWith(`${item.href}/`);
      });

      if (activeItem) return activeItem.label;
    }

    return "Workspace";
  }, [pathname]);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
    }

    router.replace("/auth/login");
  };

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark");
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
                onLogout={handleLogout}
                onNavigate={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
                mobile
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
              onLogout={handleLogout}
          />
        </aside>
      </>
  );
}
