"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;

    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }

  return "Unable to connect to the server. Please try again.";
};

const accessModules = [
  {
    title: "Customer approvals",
    description: "Review applications, documents, and verification states.",
    icon: UserCheck,
  },
  {
    title: "Loan portfolio",
    description: "Track active facilities, repayments, and overdue accounts.",
    icon: CreditCard,
  },
  {
    title: "Team activity",
    description: "Monitor staff actions and field-agent productivity.",
    icon: Users,
  },
];

const assuranceItems = [
  "Role-based access control",
  "Encrypted session handling",
  "Audit-ready activity trail",
];

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isDarkMode = resolvedTheme === "dark";

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await adminService.login({ email, password });

      if (response.success) {
        const token = response.token ?? response.data?.token;

        if (token) {
          localStorage.setItem("token", token);
        }

        router.push("/dashboard");
      } else {
        setError(response.message || "Invalid credentials provided.");
      }
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950 transition-colors dark:bg-[#07111f] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.88fr)]">
        <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(148,163,184,0.055)_1px,transparent_1px)]" />

          <div className="relative w-full max-w-[520px]">
            <header className="mb-9 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-white/10 dark:bg-white">
                  <Image
                    src="/eazy-logo.svg"
                    alt="EazyCredit"
                    width={140}
                    height={29}
                    priority
                    className="h-auto w-[140px]"
                  />
                </div>
                <span className="hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-400 sm:inline-flex">
                  Admin
                </span>
              </div>

              <button
                type="button"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200 dark:focus:ring-sky-400/20"
                aria-label="Toggle color theme"
              >
                <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
                <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
              </button>
            </header>

            <div className="mb-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Secure administration
              </div>
              {/*<h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl">*/}
              {/*  Sign in to the EazyCredit control center.*/}
              {/*</h1>*/}
              <p className="mt-4 max-w-[440px] text-sm leading-6 text-slate-600 dark:text-slate-300">
                A focused workspace for loan approvals, portfolio supervision, customer verification, and internal operations.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/25 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                    Administrator login
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter your assigned credentials to continue.
                  </p>
                </div>
                <div className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Staff only
                </div>
              </div>

              {error && (
                <div
                  className="mb-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="email">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/20"
                      placeholder="admin@eazycredit.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="password">
                      Password
                    </label>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Protected account</span>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/20"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0089ff] px-4 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-sky-950/40 dark:focus:ring-sky-400/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      Signing in
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Access is monitored and limited to approved EazyCredit administrators.
              </p>
            </div>
          </div>
        </section>

        <aside className="hidden bg-[#0b1728] p-8 text-white dark:bg-black lg:block">
          <div className="flex h-full min-h-[720px] flex-col rounded-lg border border-white/10 bg-[#101d31] shadow-2xl dark:bg-[#07111f]">
            <div className="border-b border-white/10 p-7">
              <div className="mb-7 flex items-center justify-between">
                <div className="rounded-lg bg-white px-3 py-2">
                  <Image
                    src="/eazy-logo.svg"
                    alt="EazyCredit"
                    width={140}
                    height={29}
                    className="h-auto w-[140px]"
                  />
                </div>
                <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  Online
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
                Operations console
              </p>
              <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight tracking-tight">
                Built for controlled credit administration.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                Keep approvals, repayments, customer records, and staff actions organized through one secure admin layer.
              </p>
            </div>

            <div className="grid gap-3 p-7">
              {accessModules.map((module) => {
                const Icon = module.icon;

                return (
                  <div key={module.title} className="flex gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{module.title}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-400">{module.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto border-t border-white/10 p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sky-200">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Daily administration summary</p>
                  <p className="text-xs text-slate-400">Prepared for management review</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-b border-white/10 pb-6">
                {[
                  ["98%", "Uptime"],
                  ["24/7", "Monitoring"],
                  ["ISO", "Aligned"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-white/[0.045] px-3 py-4 text-center">
                    <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3">
                {assuranceItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
