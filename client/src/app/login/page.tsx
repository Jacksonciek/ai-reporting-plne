"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  ShieldCheck,
  User2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("idle");
    setFeedback("");

    try {
      setIsLoading(true);
      const result = await authService.login(username, password);
      setStatus("success");
      setFeedback(result.message || "Login successful! Redirecting to dashboard.");
      router.push("/dashboard");
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.4),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.35),transparent_42%),radial-gradient(circle_at_50%_80%,rgba(34,197,94,0.35),transparent_45%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-10">
        <motion.div
          className="flex w-full flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl lg:flex-row"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex-1 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">
                Sign in
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                AI Reporting Login
              </h1>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to splash screen
            </Link>
          </div>

          <form className="flex-1 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-cyan-500/15 backdrop-blur">
              <div className="space-y-5">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    Username
                  </span>
                  <div className="relative">
                    <User2 className="absolute left-3 top-3 h-5 w-5 text-cyan-300" />
                    <input
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-11 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    placeholder="enter username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    Password
                  </span>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-cyan-300" />
                    <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-11 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    placeholder="********"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-5 py-3 text-lg font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Sign in now"}
                </button>
              </div>
            </div>

            {status !== "idle" && (
              <div
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  status === "success"
                    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-400/50 bg-rose-500/10 text-rose-100"
                }`}
              >
                {status === "success" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <p>{feedback}</p>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Don&apos;t have an account?</span>
              <Link
                href="/register"
                className="font-semibold text-cyan-300 hover:text-white"
              >
                Register now
              </Link>
              <Link
                href="/admin-login"
                className="inline-flex items-center gap-2 font-semibold text-amber-200 hover:text-white"
                title="Sign in as admin"
              >
                Admin login
              </Link>
            </div>
          </form>
        </motion.div>

        <div className="mt-8 flex items-center gap-3 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-cyan-300" />
          <p>
            Once connected to the database, this authentication will immediately verify AI Reporting users.
          </p>
        </div>
      </div>
    </div>
  );
}
