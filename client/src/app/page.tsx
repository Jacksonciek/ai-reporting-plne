"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const highlights = [
  {
    icon: LineChart,
    title: "Timely insights",
    desc: "Track performance and reporting progress from a single responsive screen.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "Layered authentication keeps access safe before connecting to the source database.",
  },
  {
    icon: Sparkles,
    title: "AI chatbot",
    desc: "An intelligent assistant ready to answer questions and build reports anytime.",
  },
];

export default function SplashHome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.25),_transparent_45%),radial-gradient(circle_at_20%_60%,_rgba(99,102,241,0.25),_transparent_50%),radial-gradient(circle_at_80%_40%,_rgba(59,130,246,0.22),_transparent_50%)]" />
      <div className="absolute inset-0 opacity-40 bg-[conic-gradient(at_top,_rgba(14,165,233,0.35),_rgba(109,40,217,0.35),_rgba(34,197,94,0.25),_rgba(14,165,233,0.35))]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-20 lg:flex-row lg:items-center lg:justify-between">
        <motion.div
          className="space-y-8 text-center lg:text-left"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-sm font-medium tracking-wide text-slate-200 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span>AI Reporting</span>
          </div>


          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              One click to start your{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-300 bg-clip-text text-transparent">
                AI Reporting experience
              </span>
            </h1>
            <p className="text-lg text-slate-300 sm:text-xl">
              Start from this splash screen and choose whether to log in or create an account.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-8 py-3 text-lg font-semibold text-slate-900 shadow-2xl shadow-cyan-500/30 transition hover:scale-105"
            >
              Start login
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:border-cyan-300/40 hover:bg-white/15"
            >
              Register account
            </Link>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-slate-300 lg:justify-start">
            <Bot className="h-5 w-5 text-cyan-300" />
            <span>The chatbot is ready right after you log in.</span>
          </div>
        </motion.div>

        <motion.div
          className="grid w-full gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl md:grid-cols-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {highlights.map((item) => (
            <motion.div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-slate-200 shadow-lg shadow-cyan-500/10"
              whileHover={{ y: -6 }}
            >
              <item.icon className="mb-4 h-10 w-10 text-cyan-300" />
              <h3 className="text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="text-sm text-slate-300">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
