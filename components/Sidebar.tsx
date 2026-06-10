"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
  FileSearch,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/loans", label: "Loans", icon: CreditCard },
  { href: "/admin", label: "Admin Center", icon: ShieldCheck },
  { href: "/fees", label: "Fees", icon: Landmark },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/wallet-transactions", label: "Wallet Ledger", icon: WalletCards },
  { href: "/audit-logs", label: "Audit Logs", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Don't show sidebar on login page
  if (pathname === "/auth/login" || pathname === "/") {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  return (
    <aside className="sticky top-0 h-screen flex w-[280px] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.08] dark:bg-[#07111f]/95">
      <div className="flex h-[72px] items-center border-b border-slate-100 px-6 dark:border-white/[0.05]">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#069AFF] to-[#007add] shadow-md shadow-[#069AFF]/20">
            <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <Image
            src="/eazy-logo.svg"
            alt="EazyCredit"
            width={112}
            height={22}
            className="h-auto w-[112px] dark:invert"
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-hide">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Navigation
        </p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15 dark:text-sky-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.03] dark:hover:text-white"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-1/2 w-1 -translate-y-1/2 rounded-r-full bg-[#069AFF]" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? "text-[#069AFF] dark:text-sky-300" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-100 p-4 dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(isDarkMode ? "light" : "dark")}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 dark:hover:border-white/20 dark:hover:bg-white/5 dark:hover:text-white"
            title="Toggle Theme"
          >
            <Sun className="hidden h-[18px] w-[18px] dark:block" />
            <Moon className="h-[18px] w-[18px] dark:hidden" />
            <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            title="Logout"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
        
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-[#0b1727] dark:ring-white/[0.05]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">System Admin</p>
            <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">Authenticated</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
