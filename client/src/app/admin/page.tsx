"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Edit3,
  FileUp,
  FileText,
  History,
  Loader2,
  LogOut,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import ChatbotExperience from "@/components/ChatbotExperience";
import { adminAuth, adminService } from "@/services/admin";
import { OcrHistoryEntry, Transaction } from "@/types";

const editableKeys: (keyof Transaction)[] = [
  "tanggal",
  "nama_produk",
  "kategori",
  "jumlah_terjual",
  "harga_satuan",
  "total_penjualan",
  "kota",
  "salesperson",
  "status_pembayaran",
  "metode_pembayaran",
  "konsumen",
];

const editableFields: { key: keyof Transaction; label: string; type?: string }[] = [
  { key: "tanggal", label: "Date", type: "date" },
  { key: "nama_produk", label: "Product Name" },
  { key: "kategori", label: "Category" },
  { key: "jumlah_terjual", label: "Units Sold", type: "number" },
  { key: "harga_satuan", label: "Unit Price", type: "number" },
  { key: "total_penjualan", label: "Total Sales", type: "number" },
  { key: "kota", label: "City" },
  { key: "salesperson", label: "Salesperson" },
  { key: "status_pembayaran", label: "Payment Status" },
  { key: "metode_pembayaran", label: "Payment Method" },
  { key: "konsumen", label: "Customer" },
];

const emptyForm: Partial<Transaction> = editableKeys.reduce(
  (acc, key) => ({ ...acc, [key]: "" }),
  {} as Partial<Transaction>
);

const formatBytes = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

export default function AdminPage() {
  const [adminUser, setAdminUser] = useState(adminAuth.getUser());
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<Partial<Transaction>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<Transaction>>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{
    stage: "idle" | "uploading" | "processing" | "success" | "failed";
    percent: number;
    message?: string;
  }>({ stage: "idle", percent: 0 });
  const [ocrHistory, setOcrHistory] = useState<OcrHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const envAdminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "";
  const envAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";
  const [loginPayload, setLoginPayload] = useState({ username: envAdminUsername, password: envAdminPassword });
  const [uploadTargetId, setUploadTargetId] = useState("");

  const sanitizeTransaction = (
    payload: Partial<Transaction>,
    options: { includeId?: boolean } = {}
  ): Partial<Transaction> => {
    const allowed: Partial<Transaction> = {};

    editableKeys.forEach((key) => {
      if (payload[key] !== undefined) {
        allowed[key] = payload[key];
      }
    });

    if (options.includeId && payload.id_transaksi !== undefined) {
      allowed.id_transaksi = payload.id_transaksi;
    }

    if (payload.ocr_preview !== undefined) {
      allowed.ocr_preview = payload.ocr_preview;
    }
    return allowed;
  };

  const isProgressStepDone = (step: "uploading" | "processing" | "success") => {
    if (ocrProgress.stage === "idle") return false;
    if (ocrProgress.stage === "failed") return step !== "success";
    const order = { uploading: 1, processing: 2, success: 3 };
    return order[ocrProgress.stage] >= order[step];
  };

  const progressLabel = (stage: typeof ocrProgress.stage) => {
    switch (stage) {
      case "uploading":
        return "Uploading PDF";
      case "processing":
        return "Running OCR & LLM";
      case "success":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return "Ready to process";
    }
  };

  const progressTone = (stage: typeof ocrProgress.stage) => {
    if (stage === "failed") return "bg-rose-400";
    if (stage === "success") return "bg-emerald-400";
    return "bg-cyan-400";
  };

  const activeOcrStage = ocrProgress.stage === "failed" ? "processing" : ocrProgress.stage;

  const isLoggedIn = useMemo(() => Boolean(adminAuth.isAuthenticated()), [adminUser]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await adminService.listOcrHistory(25);
      setOcrHistory(history);
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load OCR history",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const bootstrapAdminData = async () => {
    try {
      setLoading(true);
      setHistoryLoading(true);
      const [data, history] = await Promise.all([
        adminService.listTransactions(),
        adminService.listOcrHistory(25),
      ]);
      setTransactions(data);
      setOcrHistory(history);
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load transactions",
      });
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    adminAuth.ensureChatSession();
    bootstrapAdminData();
  }, [isLoggedIn]);

  const handleLogin = async () => {
    setStatus(null);
    try {
      const res = await adminAuth.login(loginPayload.username, loginPayload.password);
      setAdminUser(res.user);
      adminAuth.ensureChatSession();
      await bootstrapAdminData();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Admin login failed",
      });
    }
  };

  const handleSave = async () => {
    setStatus(null);
    try {
      const payload = sanitizeTransaction(form);
      const saved = await adminService.createTransaction(payload);
      setForm(emptyForm);
      setTransactions((prev) => {
        const savedId = String(saved.id_transaksi);
        const others = prev.filter((item) => String(item.id_transaksi) !== savedId);
        return [saved, ...others];
      });
      setStatus({
        type: "success",
        message: "Transaction added",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save transaction",
      });
    }
  };

  const handleDelete = async (id: string | number) => {
    const targetId = String(id);
    if (typeof window !== "undefined") {
      const confirmDelete = window.confirm(`Delete transaction #${targetId}?`);
      if (!confirmDelete) return;
    }
    try {
      await adminService.deleteTransaction(targetId);
      setTransactions((prev) => prev.filter((item) => String(item.id_transaksi) !== targetId));
      setStatus({ type: "success", message: "Transaction deleted" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete transaction",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setStatus(null);
    try {
      const payload = sanitizeTransaction(editDraft);
      const saved = await adminService.updateTransaction(editingId, payload);
      setTransactions((prev) => {
        const savedId = String(saved.id_transaksi);
        const others = prev.filter((item) => String(item.id_transaksi) !== savedId);
        return [saved, ...others];
      });
      setStatus({ type: "success", message: "Transaction updated" });
      setIsEditModalOpen(false);
      setEditingId(null);
      setEditDraft(emptyForm);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update transaction",
      });
    }
  };

  const handleEdit = (trx: Transaction) => {
    setEditingId(String(trx.id_transaksi));
    setEditDraft({ ...sanitizeTransaction(trx, { includeId: true }) });
    setUploadTargetId(String(trx.id_transaksi) || "");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingId(null);
    setEditDraft(emptyForm);
  };

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      setOcrProgress({ stage: "uploading", percent: 5, message: "Uploading PDF..." });
      const result = await adminService.uploadDocument(
        file,
        uploadTargetId || undefined,
        ({ percent, stage }) => {
          setOcrProgress({
            stage,
            percent: stage === "uploading" ? percent : Math.max(percent, 85),
            message: stage === "uploading" ? "Uploading PDF..." : "Running OCR & LLM...",
          });
        }
      );

      const sanitized = sanitizeTransaction(result.transaction || {});
      setForm((prev) => ({ ...prev, ...sanitized }));
      setTransactions((prev) => {
        const trxId = String(result.transaction.id_transaksi);
        const others = prev.filter((item) => String(item.id_transaksi) !== trxId);
        return [result.transaction, ...others];
      });

      if (result.history) {
        setOcrHistory((prev) => {
          const others = prev.filter((item) => item.id !== result.history?.id);
          return result.history ? [result.history, ...others].slice(0, 40) : prev;
        });
      } else {
        loadHistory();
      }

      setStatus({
        type: "success",
        message: "Document extracted successfully",
      });
      setOcrProgress({ stage: "success", percent: 100, message: "Document processed" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to extract document",
      });
      setOcrProgress({
        stage: "failed",
        percent: 100,
        message: error instanceof Error ? error.message : "Failed to extract document",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    adminAuth.logout();
    setAdminUser(null);
    setTransactions([]);
    setOcrHistory([]);
    setChatOpen(false);
  };

  const heroGradient =
    "from-slate-950 via-slate-900 to-slate-800 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.16),transparent_25%),radial-gradient(circle_at_80%_10%,rgba(129,140,248,0.16),transparent_20%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,0.18),transparent_25%)]";

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-6 py-16 bg-gradient-to-br ${heroGradient}`}>
        <div className="max-w-3xl w-full">
          <motion.div
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-cyan-500/10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-10 h-10 text-cyan-300" />
              <div>
                <p className="text-cyan-200 text-sm uppercase tracking-[0.25em]">Admin Secure</p>
                <h1 className="text-3xl font-semibold text-white">Admin Panel</h1>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-sm text-slate-200">Username</span>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  value={loginPayload.username}
                  onChange={(e) => setLoginPayload({ ...loginPayload, username: e.target.value })}
                  placeholder="username"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-200">Password</span>
                <input
                  type="password"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  value={loginPayload.password}
                  onChange={(e) => setLoginPayload({ ...loginPayload, password: e.target.value })}
                  placeholder="********"
                />
              </label>
            </div>

            <button
              onClick={handleLogin}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-5 py-3 text-white font-semibold shadow-lg shadow-cyan-500/25 transition hover:scale-[1.01]"
            >
              <Sparkles className="w-4 h-4" />
              Sign in as Admin
            </button>

            <AnimatePresence>
              {status && (
                <motion.div
                  className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                    status.type === "success"
                      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-400/60 bg-rose-500/10 text-rose-100"
                  }`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {status.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{status.message}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br ${heroGradient} text-slate-100`}>
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.35),transparent_28%),radial-gradient(circle_at_70%_10%,rgba(236,72,153,0.3),transparent_30%),radial-gradient(circle_at_60%_80%,rgba(34,197,235,0.25),transparent_30%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/80">Admin Console</p>
            <h1 className="text-3xl font-semibold text-white mt-2">Documents & OCR</h1>
            <p className="text-slate-300 mt-1">
              Manage PDF-sourced transaction data with LLM extraction. All changes are stored in database
              <span className="font-semibold text-cyan-200"> u1792005_ai_reporting</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm(emptyForm)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-white/10 bg-white/5 text-sm hover:bg-white/10 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Reset form
            </button>
            <button
              onClick={() => {
                adminAuth.ensureChatSession();
                setChatOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
            >
              <Bot className="w-4 h-4" />
              Admin chatbot
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-rose-300/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/15"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-cyan-200">Transaction form</p>
                <h2 className="text-xl font-semibold text-white">
                  Add transaction
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Supported fields: date, product name, category, units sold, unit price, total sales, city, salesperson, payment status, payment method, and customer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save transaction
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editableFields.map((field) => (
                <label key={field.key} className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-300">
                    {field.label}
                  </span>
                  <input
                    type={field.type || "text"}
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    placeholder={field.label}
                  />
                </label>
              ))}
            </div>
          </motion.div>

          <div className="space-y-4">
            <motion.div
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/80 via-slate-800/70 to-slate-900/60 backdrop-blur-2xl p-6 shadow-2xl shadow-cyan-500/15"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-cyan-200">Upload PDF</p>
                  <h3 className="text-lg font-semibold text-white">OCR + LLM Extractor</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Automatically updates: date, product name, category, units sold, unit price, total sales, city,
                    salesperson, payment status, payment method, and customer.
                  </p>
                </div>
                <UploadCloud className="w-5 h-5 text-cyan-300" />
              </div>

              <p className="text-sm text-slate-300">
                Upload a PDF and let the LLM extract transaction fields for you.
              </p>

              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-slate-300">Target transaction ID (optional)</label>
                  <input
                    value={uploadTargetId}
                    onChange={(e) => setUploadTargetId(e.target.value)}
                    placeholder="Leave blank to create a new record"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 disabled:opacity-60"
                >
                  <FileUp className="w-4 h-4" />
                  {uploading ? "Processing..." : "Upload PDF & extract"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                />

                {ocrProgress.stage !== "idle" && (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cyan-200">
                        {ocrProgress.stage === "failed" ? (
                          <XCircle className="w-4 h-4 text-rose-300" />
                        ) : ocrProgress.stage === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />
                        )}
                        <span>{progressLabel(ocrProgress.stage)}</span>
                      </div>
                      <span className="text-white font-semibold">
                        {Math.min(Math.round(ocrProgress.percent), 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full ${progressTone(ocrProgress.stage)} transition-all duration-300`}
                        style={{ width: `${Math.min(ocrProgress.percent, 100)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {(["uploading", "processing", "success"] as const).map((step) => {
                        const active = activeOcrStage === step;
                        return (
                          <span
                            key={step}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${
                              isProgressStepDone(step)
                                ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-100"
                                : "border-white/10 bg-white/5 text-slate-200"
                            }`}
                          >
                            {isProgressStepDone(step) ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Loader2 className={`w-3 h-3 ${active ? "animate-spin text-cyan-300" : "text-slate-400"}`} />
                            )}
                            {step === "uploading" ? "Upload" : step === "processing" ? "OCR" : "Done"}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-300">
                      {ocrProgress.message || "Processing document..."}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-cyan-200 font-semibold mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Extraction tips</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure the PDF is not password protected.</li>
                    <li>Tables or invoice layouts improve accuracy.</li>
                    <li>Missing fields will be stored as empty/null.</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/15"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-cyan-200">OCR history</p>
                  <h3 className="text-lg font-semibold text-white">PDF logs & extraction results</h3>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-white/10 bg-white/5 text-xs hover:bg-white/10 disabled:opacity-60"
                >
                  <History className="w-4 h-4" />
                  {historyLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {historyLoading ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading OCR history...</span>
                </div>
              ) : ocrHistory.length === 0 ? (
                <p className="text-slate-300 text-sm">No PDF uploads yet.</p>
              ) : (
                <div className="space-y-3">
                  {ocrHistory.slice(0, 5).map((item) => {
                    const badge =
                      item.status === "success"
                        ? "bg-emerald-500/15 text-emerald-100 border-emerald-300/40"
                        : item.status === "failed"
                          ? "bg-rose-500/15 text-rose-100 border-rose-300/50"
                          : "bg-cyan-500/10 text-cyan-100 border-cyan-300/40";
                    return (
                      <div
                        key={`${item.id}-${item.filename}`}
                        className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-cyan-300" />
                            <div>
                              <p className="text-sm font-semibold text-white">{item.filename}</p>
                              <p className="text-[11px] text-slate-400">
                                {formatBytes(item.filesize_bytes)} | {item.page_count} pages
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[11px] border ${badge}`}>
                            {item.status === "processing" ? "processing" : item.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <span className="text-slate-400">Transaction ID</span>
                          <span>{item.transaksi_id ?? "Waiting for persistence"}</span>
                          <span className="text-slate-400">Message</span>
                          <span>{item.message || "Processed successfully"}</span>
                        </div>
                        {item.fields_json && (
                          <div className="text-[11px] text-slate-400 max-h-12 overflow-hidden">
                            Sample fields:{" "}
                            {["tanggal", "nama_produk", "total_penjualan", "konsumen"]
                              .map((key) => `${key}: ${item.fields_json?.[key] ?? "-"}`)
                              .join(" | ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <MessageCircle className="w-4 h-4 text-cyan-300" />
                  <span>Need instant analysis? Open the admin chatbot.</span>
                </div>
                <button
                  onClick={() => {
                    adminAuth.ensureChatSession();
                    setChatOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 text-xs"
                >
                  <Bot className="w-4 h-4" />
                  Open chat
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                status.type === "success"
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-400/60 bg-rose-500/10 text-rose-100"
              }`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-cyan-200">Transactions</p>
              <h3 className="text-xl font-semibold text-white">OCR & manual entries</h3>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-300">Loading data...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-300">No transactions yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {transactions.map((trx) => (
                <motion.div
                  key={trx.id_transaksi}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 space-y-2"
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-cyan-200">{trx.id_transaksi}</p>
                      <h4 className="text-lg font-semibold text-white">{trx.nama_produk || "Untitled"}</h4>
                      <p className="text-xs text-slate-400">
                        {trx.kota || "-"} | {trx.tanggal || "Date unavailable"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
                        onClick={() => handleEdit(trx)}
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4 text-cyan-200" />
                      </button>
                      <button
                        className="p-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-300/40"
                        onClick={() => handleDelete(trx.id_transaksi)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-rose-200" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <span className="text-slate-400">Category:</span>
                    <span>{trx.kategori || "-"}</span>
                    <span className="text-slate-400">Units sold:</span>
                    <span>{trx.jumlah_terjual ?? "-"}</span>
                    <span className="text-slate-400">Unit price:</span>
                    <span>{trx.harga_satuan ?? "-"}</span>
                    <span className="text-slate-400">Total sales:</span>
                    <span>{trx.total_penjualan || "-"}</span>
                    <span className="text-slate-400">Method:</span>
                    <span>{trx.metode_pembayaran || "-"}</span>
                    <span className="text-slate-400">Status:</span>
                    <span>{trx.status_pembayaran || "-"}</span>
                    <span className="text-slate-400">Customer:</span>
                    <span>{trx.konsumen || "-"}</span>
                    <span className="text-slate-400">Salesperson:</span>
                    <span>{trx.salesperson || "-"}</span>
                  </div>

                  {trx.ocr_preview && (
                    <div className="mt-2 text-[11px] text-slate-400 max-h-20 overflow-hidden">
                      OCR preview: {trx.ocr_preview}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={closeEditModal}
            />
            <motion.div
              className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-500/10"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-cyan-200">Edit transaction</p>
                  <h3 className="text-xl font-semibold text-white">
                    #{editingId || "-"}
                  </h3>
                </div>
                <button
                  onClick={closeEditModal}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-white/10 bg-white/5 text-sm text-slate-100 hover:bg-white/10"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editableFields.map((field) => (
                  <label key={field.key} className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-slate-300">
                      {field.label}
                    </span>
                    <input
                      type={field.type || "text"}
                      value={String(editDraft[field.key] ?? "")}
                      onChange={(e) => setEditDraft({ ...editDraft, [field.key]: e.target.value })}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      placeholder={field.label}
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeEditModal}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-white/10 bg-white/5 text-sm text-slate-100 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl"
              onClick={() => setChatOpen(false)}
            />
            <div className="absolute inset-3 lg:inset-10 rounded-3xl overflow-hidden border border-white/10 bg-slate-950">
              <button
                onClick={() => setChatOpen(false)}
                className="absolute top-4 right-4 z-50 inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 border border-white/20 text-sm text-white hover:bg-white/20"
              >
                <XCircle className="w-4 h-4" />
                Close chatbot
              </button>
              <div className="h-full w-full">
                <ChatbotExperience preferChatView />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


