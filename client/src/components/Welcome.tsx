import React, { useMemo, useState } from "react";
import {
  Send,
  Bot,
  Zap,
  BarChart3,
  FileText,
  MessageSquare,
  Sparkles,
  Activity,
  Clock,
} from "lucide-react";
import { Room } from "@/types";

interface WelcomeProps {
  onSendMessage: (message: string) => Promise<void>;
  isBotTyping: boolean;
  rooms: Room[];
  onRoomSelect: (roomId: string) => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getTimestamp = (room: Room) =>
  room.updated_at || room.created_at || undefined;

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return "No data yet";
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
};

const formatAbsolute = (timestamp?: string) => {
  if (!timestamp) return "Time unavailable";
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Welcome: React.FC<WelcomeProps> = ({
  onSendMessage,
  isBotTyping,
  rooms,
  onRoomSelect,
}) => {
  const [inputValue, setInputValue] = useState("");

  const stats = useMemo(() => {
    const totalChats = rooms.length;
    const activeToday = rooms.filter((room) => {
      const ts = getTimestamp(room);
      if (!ts) return false;
      return Date.now() - new Date(ts).getTime() < ONE_DAY_MS;
    }).length;
    const lastActiveRoom = [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return (
          new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime()
        );
      })
      .shift();

    return [
      {
        label: "Total Conversations",
        value: totalChats,
        sublabel: totalChats ? "History saved" : "Start your first chat",
        icon: MessageSquare,
      },
      {
        label: "Active in 24h",
        value: activeToday,
        sublabel: "Latest conversations",
        icon: Activity,
      },
      {
        label: "Last Activity",
        value: lastActiveRoom ? formatRelativeTime(getTimestamp(lastActiveRoom)) : "No data yet",
        sublabel: lastActiveRoom
          ? `Room #${lastActiveRoom.room_id}`
          : "Send a message to get started",
        icon: Clock,
      },
    ];
  }, [rooms]);

  const recentRooms = useMemo(() => {
    return [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return (
          new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime()
        );
      })
      .slice(0, 4);
  }, [rooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isBotTyping) return;
    const message = inputValue.trim();
    setInputValue("");
    await onSendMessage(message);
  };

  const samplePrompts = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Sales Analysis",
      prompt: "Share the top 3 product categories by sales",
      gradient: "from-emerald-400 to-cyan-400",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Export Data",
      prompt:
        "Generate an Excel file containing sales for the electronics category",
      gradient: "from-purple-400 to-pink-400",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "City Performance",
      prompt: "Show me the highest sales by city",
      gradient: "from-orange-400 to-red-400",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "General Inquiry",
      prompt: "Hello, I need a quick summary of today",
      gradient: "from-blue-400 to-indigo-400",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden text-slate-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-emerald-400/15 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto py-12 px-6 space-y-10">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-full bg-white/10 border border-white/10 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs uppercase tracking-widest text-slate-200">
                Conversation dashboard
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-white/10 backdrop-blur">
                <Bot className="w-8 h-8 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white">
                  Welcome back
                </h1>
                <p className="text-slate-300">
                  Review your chat activity before you start asking questions.
                </p>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-300 border border-white/10 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-lg shadow-sm">
            The system is ready for new prompts anytime. Start by typing your question below.
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg flex items-center space-x-4 hover:border-cyan-300/40 transition-colors shadow-sm"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20">
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-300">{stat.label}</p>
                <p className="text-2xl font-semibold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.sublabel}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recent conversations
                </h2>
                <p className="text-sm text-slate-300">
                  A snapshot of your last 4 chats
                </p>
              </div>
              <button
                className="text-sm text-cyan-300 hover:text-white transition-colors"
                onClick={() => onSendMessage("Please summarize my latest conversations.")}
                disabled={isBotTyping}
              >
                Summarize chats
              </button>
            </div>

            {recentRooms.length ? (
              <div className="space-y-3">
                {recentRooms.map((room) => {
                  const timestamp = getTimestamp(room);
                  return (
                    <button
                      key={room.room_id}
                      onClick={() => onRoomSelect(room.room_id.toString())}
                      className="w-full text-left p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-300/40 hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {room.room_name || `Room #${room.room_id}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            {timestamp
                              ? formatRelativeTime(timestamp)
                              : "No activity yet"}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatAbsolute(timestamp)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-white/20 text-center text-slate-300 bg-white/5">
                No conversations saved yet. Send your first message to populate the dashboard.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-100 to-purple-100 border border-blue-100 backdrop-blur space-y-4">
              <h3 className="text-slate-900 font-semibold">
                Jumpstart with these prompts
              </h3>
              <div className="grid gap-3">
                {samplePrompts.map((sample) => (
                  <button
                    key={sample.title}
                    onClick={() => onSendMessage(sample.prompt)}
                    disabled={isBotTyping}
                    className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-300/40 hover:bg-white/10 transition-colors disabled:opacity-50 shadow-sm text-slate-100"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-xl bg-gradient-to-r ${sample.gradient} text-white`}
                      >
                        {sample.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {sample.title}
                        </p>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {sample.prompt}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-xs text-slate-300 shadow-sm">
              Tip: use natural language such as{" "}
              <span className="text-blue-700">
                &quot;Compare sales performance in 2023 vs 2024&quot;
              </span>{" "}
              so the bot immediately understands the context.
            </div>
          </div>
        </section>

        <section className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur shadow-lg shadow-cyan-500/10 space-y-4">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask something about your sales data..."
              className="w-full p-5 pr-16 rounded-2xl bg-slate-900/70 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 transition-all"
              disabled={isBotTyping}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isBotTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 shadow"
            >
              {isBotTyping ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
            {[
              { icon: <Zap className="w-4 h-4" />, text: "Real-time analysis" },
              { icon: <FileText className="w-4 h-4" />, text: "Excel export" },
              {
                icon: <BarChart3 className="w-4 h-4" />,
                text: "Data visualisation",
              },
            ].map((feature) => (
              <div
                key={feature.text}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-slate-900/60 border border-white/10 text-slate-100"
              >
                {feature.icon}
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center">
            AI can make mistakes. Please verify important information.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Welcome;
