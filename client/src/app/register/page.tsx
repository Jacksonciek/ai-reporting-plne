'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, ListChecks, Lock, UserPlus2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth';

const passwordChecks = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'Max 20 characters', test: (value: string) => value.length <= 20 },
  { label: 'At least one symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
  { label: 'Includes a number', test: (value: string) => /\d/.test(value) },
  { label: 'At least one uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
];

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const passwordScore = useMemo(() => {
    return passwordChecks.filter((rule) => rule.test(password)).length;
  }, [password]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');
    setFeedback('');

    const isValid = passwordChecks.every((rule) => rule.test(password));
    if (!isValid) {
      setStatus('error');
      setFeedback('Password does not meet the security requirements.');
      return;
    }
    if (!username.trim()) {
      setStatus('error');
      setFeedback('Username is required.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await authService.register(username.trim(), password);
      setStatus('success');
      setFeedback(result.message || 'Registration successful! Redirecting to dashboard...');
      setTimeout(() => router.replace('/dashboard'), 500);
    } catch (error) {
      setStatus('error');
      setFeedback(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_10%_10%,rgba(129,140,248,0.35),transparent_45%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.35),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(45,212,191,0.35),transparent_45%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-10">
        <motion.div
          className="flex w-full flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl lg:flex-row"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex-1 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Create Account</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Register an Account</h1>
              <p className="text-sm text-slate-300">
                This registration instantly creates your account and logs you into the app.
              </p>
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
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-cyan-500/15 space-y-5 backdrop-blur">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Username</span>
                <div className="relative">
                  <UserPlus2 className="absolute left-3 top-3 h-5 w-5 text-cyan-300" />
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-11 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    placeholder="choose a username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Password</span>
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
                  <ListChecks className="h-5 w-5 text-cyan-300" />
                  <span>Checklist password</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {passwordChecks.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <div className="flex items-center gap-3" key={rule.label}>
                        <div
                          className={`h-2 w-2 rounded-full ${
                            passed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-slate-600'
                          }`}
                        />
                        <span className={passed ? 'text-slate-100 font-medium' : undefined}>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${(passwordScore / passwordChecks.length) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-5 py-3 text-lg font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading}
              >
                <KeyRound className="h-5 w-5" />
                {isLoading ? 'Processing...' : 'Create & Sign in'}
              </button>
            </div>

            {status !== 'idle' && (
              <div
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  status === 'success'
                    ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                    : 'border-rose-400/60 bg-rose-500/10 text-rose-100'
                }`}
              >
                {status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <p>{feedback}</p>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Already have an account?</span>
              <Link href="/login" className="font-semibold text-cyan-300 hover:text-white">
                Go to login
              </Link>
            </div>
          </form>
        </motion.div>

        <div className="mt-8 flex items-center gap-3 text-sm text-slate-300">
          <KeyRound className="h-4 w-4 text-cyan-300" />
          <p>Password validation is prepared so it can plug into your AI Reporting authentication later.</p>
        </div>
      </div>
    </div>
  );
}
