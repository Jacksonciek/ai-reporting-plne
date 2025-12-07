"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { adminAuth } from "@/services/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const defaultAdminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "";
  const defaultAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";
  const [username, setUsername] = useState(defaultAdminUsername);
  const [password, setPassword] = useState(defaultAdminPassword);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("idle");
    setFeedback("");
    setLoading(true);
    try {
      await adminAuth.login(username, password);
      setStatus("success");
      setFeedback("Admin login successful, redirecting to console...");
      router.push("/admin");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.3),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.3),transparent_45%)]" />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-10 items-center">
        <motion.div
          className="flex-1 space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/10 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span className="text-xs uppercase tracking-[0.3em] text-slate-200">Admin Secure</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-white">Sign in to Admin Console</h1>
            <p className="text-slate-300 text-sm">
              Restricted area to manage transactions and OCR documents. Regular users cannot self-register as admin.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to user login
          </Link>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-2">
            <label className="text-sm text-slate-200">Admin username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              placeholder="username"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-200">Admin password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-5 py-3 text-slate-900 font-semibold shadow-lg shadow-cyan-500/30 transition hover:scale-[1.01] disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Processing..." : "Admin Login"}
          </button>

          <AnimatePresence>
            {status !== "idle" && (
              <motion.div
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                  status === "success"
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-400/60 bg-rose-500/10 text-rose-100"
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {status === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{feedback}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            <span>Use the admin credentials provided by your team.</span>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
