'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Activity, Bot, Clock, Database, PanelRight, RefreshCcw } from 'lucide-react';
import { apiService } from '@/services/api';
import { Room, WeeklyActivity } from '@/types';
import { authService } from '@/services/auth';
import SignOutButton from '@/components/SignOutButton';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getTimestamp = (room: Room) => room.updated_at || room.created_at || undefined;

const formatDayLabel = (isoDate: string) => {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return isoDate;
  }
};

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return 'No data yet';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
};

const formatAbsolute = (timestamp?: string) => {
  if (!timestamp) return 'Time unavailable';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setIsActivityLoading(true);
        const [roomsResponse, activityResponse] = await Promise.all([
          apiService.getRooms({ limit: 20 }),
          apiService.getWeeklyActivity(),
        ]);
        setRooms(roomsResponse.data || []);
        setWeeklyActivity(activityResponse || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
        setError('Failed to load data from the API');
        if (!authService.isAuthenticated()) {
          router.replace('/login');
        }
      } finally {
        setIsLoading(false);
        setIsActivityLoading(false);
      }
    };

    if (authReady) {
      load();
    }
  }, [authReady]);

  const stats = useMemo(() => {
    const total = rooms.length;
    const activeToday = rooms.filter((room) => {
      const ts = getTimestamp(room);
      return ts ? Date.now() - new Date(ts).getTime() < ONE_DAY_MS : false;
    }).length;
    const lastActiveRoom = [...rooms].sort((a, b) => {
      const aTs = getTimestamp(a);
      const bTs = getTimestamp(b);
      return new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime();
    })[0];

    return {
      total,
      activeToday,
      lastActiveRoom,
    };
  }, [rooms]);

  const recentRooms = useMemo(() => {
    return [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime();
      })
      .slice(0, 5);
  }, [rooms]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.26),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.24),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.22),transparent_38%)]" />

      <div className="max-w-6xl mx-auto px-6 py-16 relative z-10 space-y-8">
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center space-x-4">
            <div>
              <div className="flex items-center space-x-3">
                <Bot className="w-8 h-8 text-cyan-300" />
                <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
              </div>
              <p className="text-sm text-slate-300 mt-1">Snapshot of data pulled from the chatbot API</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SignOutButton compact />
            <Link
              href="/chatbot"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 hover:from-cyan-300 hover:to-indigo-600 transition-colors text-slate-900 font-medium shadow-lg shadow-cyan-500/25"
            >
              <span>Open Chatbot</span>
              <PanelRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <StatCard
            title="Total rooms"
            icon={Database}
            value={isLoading ? '...' : stats.total}
            helper="Saved conversations"
            gradient="from-blue-500/30 to-cyan-500/30"
          />
          <StatCard
            title="Active in 24h"
            icon={Activity}
            value={isLoading ? '...' : stats.activeToday}
            helper="Rooms active in the last 24h"
            gradient="from-emerald-500/30 to-teal-500/30"
          />
          <StatCard
            title="Latest activity"
            icon={Clock}
            value={
              isLoading
                ? '...'
                : stats.lastActiveRoom
                  ? formatRelativeTime(getTimestamp(stats.lastActiveRoom))
                  : 'No data yet'
            }
            helper={
              stats.lastActiveRoom
                ? stats.lastActiveRoom.room_name || `Room #${stats.lastActiveRoom.room_id}`
                : 'Start a conversation to see stats'
            }
            gradient="from-purple-500/30 to-pink-500/30"
          />
        </motion.div>

        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-2xl shadow-cyan-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Recent rooms</h2>
              </div>
              <RefreshCcw className="w-4 h-4 text-cyan-300" />
            </div>

            {error && (
              <div className="text-sm text-rose-100 bg-rose-500/10 border border-rose-400/50 rounded-xl p-3">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-slate-300 text-sm">Loading data...</div>
            ) : recentRooms.length ? (
              <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {recentRooms.map((room) => {
                  const ts = getTimestamp(room);
                  return (
                    <div
                      key={room.room_id}
                      className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-300/40 hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{room.room_name || `Room #${room.room_id}`}</p>
                          <p className="text-xs text-slate-400">{formatRelativeTime(ts)}</p>
                        </div>
                        <span className="text-xs text-slate-400">{formatAbsolute(ts)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-300 text-sm">No room data yet.</div>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-2xl shadow-cyan-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Weekly activity</h2>
                <p className="text-sm text-slate-300">Interactions over the last 7 days</p>
              </div>
              <div className="text-xs font-medium text-slate-300">Live data</div>
            </div>
            {isActivityLoading ? (
              <div className="text-sm text-slate-300">Loading activity...</div>
            ) : weeklyActivity.length === 0 ? (
              <div className="text-sm text-slate-300">No activity recorded yet.</div>
            ) : (
              <div className="grid grid-cols-7 gap-3">
                {weeklyActivity.map((item) => {
                  const maxValue = Math.max(...weeklyActivity.map((d) => d.total), 1);
                  const height = Math.max((item.total / maxValue) * 100, 8);
                  return (
                    <div key={item.day} className="flex flex-col items-center gap-2">
                      <div className="relative w-full h-28 rounded-xl bg-slate-900/60 border border-white/10 overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-t-xl bg-gradient-to-t from-cyan-400 via-blue-500 to-emerald-400"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs font-medium text-slate-300">{formatDayLabel(item.day)}</div>
                      <div className="text-[11px] text-slate-400">{item.total} chat</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ComponentType<any>;
  gradient: string;
}) {
  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-xl shadow-cyan-500/10 flex items-center space-x-4">
      <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-300">{title}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="text-xs text-slate-400">{helper}</p>
      </div>
    </div>
  );
}
