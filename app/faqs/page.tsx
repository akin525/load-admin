"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertCircle,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit2,
  ChevronRight,
  FileText,
} from "lucide-react";
import { adminService } from "@/lib/services/adminService";
import { useRouteAccess } from "@/lib/admin-access";
import { AccessDeniedState } from "@/components/AccessDeniedState";
import Swal from "sweetalert2";

type FAQ = {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type FAQsState = {
  rows: FAQ[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

function FAQModal({
  faq,
  onClose,
  onRefresh,
}: {
  faq?: FAQ;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    title: faq?.title || "",
    content: faq?.content || "",
  });

  const isEdit = !!faq;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title || !values.content) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await adminService.updateFaq(faq._id, values);
      } else {
        await adminService.createFaq(values);
      }
      
      await Swal.fire({
        icon: "success",
        title: isEdit ? "Updated!" : "Created!",
        text: `FAQ has been ${isEdit ? "updated" : "created"} successfully.`,
        timer: 1500,
        showConfirmButton: false,
      });
      
      onRefresh();
      onClose();
    } catch (err: any) {
      void Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err.response?.data?.message || "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1728]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-white/[0.08]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#069AFF]/10 text-[#069AFF] dark:bg-[#069AFF]/15">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                {isEdit ? "Update FAQ" : "Create New FAQ"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isEdit ? "Modify existing question and answer." : "Add a frequently asked question to the platform."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Question</label>
            <input
              type="text"
              required
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="e.g., How do I apply for a loan?"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Answer</label>
            <textarea
              required
              rows={5}
              value={values.content}
              onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
              placeholder="Provide a detailed answer..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-2xl border border-slate-200 px-6 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#069AFF] px-8 text-sm font-black text-white shadow-lg shadow-[#069AFF]/20 transition hover:bg-[#0587df] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {isEdit ? "Update FAQ" : "Create FAQ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FAQsPage() {
  const { allowed } = useRouteAccess("/faqs");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<FAQsState>({
    rows: [],
    loading: true,
    loaded: false,
    error: "",
  });

  const [modalMode, setModalMode] = useState<{ open: boolean; faq?: FAQ }>({ open: false });

  const fetchFAQs = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const response = await adminService.getFaqs();
      const payload = (response as any).data || response;
      const rows = Array.isArray(payload) ? payload : (payload.data || []);
      
      setState({
        rows,
        loading: false,
        loaded: true,
        error: "",
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || "Failed to fetch FAQs.",
      }));
    }
  }, []);

  useEffect(() => {
    if (allowed) {
      void fetchFAQs();
    }
  }, [allowed, fetchFAQs]);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery) return state.rows;
    const query = searchQuery.toLowerCase();
    return state.rows.filter(
      (f) => f.title.toLowerCase().includes(query) || f.content.toLowerCase().includes(query)
    );
  }, [state.rows, searchQuery]);

  if (!allowed) {
    return <AccessDeniedState />;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#070C14] lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#069AFF] text-white shadow-lg shadow-[#069AFF]/20">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Knowledge Base</h1>
            </div>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Manage frequently asked questions to help your customers help themselves.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchFAQs()}
              disabled={state.loading}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setModalMode({ open: true })}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#069AFF] px-6 text-sm font-black text-white shadow-lg shadow-[#069AFF]/20 transition hover:bg-[#0587df]"
            >
              <Plus className="h-5 w-5" />
              New FAQ
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-14 w-full rounded-3xl border border-slate-200 bg-white pl-12 pr-4 text-base font-semibold outline-none transition focus:border-[#069AFF] focus:ring-4 focus:ring-[#069AFF]/10 dark:border-white/10 dark:bg-[#0d1728] dark:text-white shadow-sm"
          />
        </div>

        {/* List Section */}
        <div className="space-y-4">
          {state.loading ? (
            <div className="py-24 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin text-[#069AFF]" />
                <p className="text-sm font-bold text-slate-500">Retrieving FAQs...</p>
              </div>
            </div>
          ) : filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => (
              <div
                key={faq._id}
                className="group relative flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#069AFF]/30 dark:border-white/10 dark:bg-[#0d1728]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {faq.title}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {faq.content}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setModalMode({ open: true, faq })}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-[#069AFF] group-hover:text-white dark:bg-white/5 dark:text-slate-400"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50 dark:border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Last updated {new Date(faq.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-24 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/5">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-white/5">
                  <HelpCircle className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">No FAQs found</h3>
                <p className="text-sm font-medium text-slate-500">
                  {searchQuery ? "Try adjusting your search query." : "Start by creating your first frequently asked question."}
                </p>
                {!searchQuery && (
                   <button
                   onClick={() => setModalMode({ open: true })}
                   className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#069AFF] px-6 text-sm font-black text-white shadow-lg shadow-[#069AFF]/20 transition hover:bg-[#0587df]"
                 >
                   <Plus className="h-5 w-5" />
                   Create FAQ
                 </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalMode.open && (
        <FAQModal
          faq={modalMode.faq}
          onClose={() => setModalMode({ open: false })}
          onRefresh={fetchFAQs}
        />
      )}
    </main>
  );
}
