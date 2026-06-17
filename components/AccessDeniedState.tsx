"use client";

import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";

export function AccessDeniedState({
  title = "Access restricted",
  description = "You do not have the necessary permissions to view this section of the EazyCredit administration center.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="min-h-screen px-6 py-10 text-slate-950 dark:text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-200">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Access is restricted by your assigned admin role and permissions.
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#069AFF] px-5 text-sm font-bold text-white transition hover:bg-[#0588e0]"
            >
              Go to dashboard
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Switch account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
