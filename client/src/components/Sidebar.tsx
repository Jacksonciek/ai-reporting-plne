import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  LayoutDashboard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Room } from "@/types";
import { apiService } from "@/services/api";
import SignOutButton from "./SignOutButton";

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
  onNewChat: () => void;
  rooms: Room[];
  onRefreshRooms?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isExpanded,
  onToggle,
  selectedRoomId,
  onRoomSelect,
  onNewChat,
  rooms: initialRooms,
  onRefreshRooms,
}) => {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const roomRefs = useRef<{ [key: string]: HTMLDivElement }>({});

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { x: -100, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      gsap.to(sidebarRef.current, {
        width: "320px",
        duration: 0.4,
        ease: "power2.inOut",
      });
    } else {
      gsap.to(sidebarRef.current, {
        width: "64px",
        duration: 0.4,
        ease: "power2.inOut",
      });
    }
  }, [isExpanded]);

  useEffect(() => {
    if (rooms.length > 0) {
      Object.values(roomRefs.current).forEach((ref, index) => {
        if (ref) {
          gsap.fromTo(
            ref,
            { x: -50, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.4,
              delay: index * 0.05,
              ease: "power2.out",
            }
          );
        }
      });
    }
  }, [rooms.length]);

  useEffect(() => {
    if (initialRooms && initialRooms.length > 0) {
      setRooms(initialRooms);
      setError(null);
    }
  }, [initialRooms]);

  useEffect(() => {
    if (isExpanded && !connectionTested) {
      loadRooms();
    }
  }, [isExpanded, connectionTested]);

  const loadRooms = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRooms({ limit: 50 });
      if (response.data && response.data.length > 0) {
        const sortedRooms = response.data.sort((a, b) => {
          const dateA = new Date(a.created_at || "").getTime();
          const dateB = new Date(b.created_at || "").getTime();
          return dateB - dateA;
        });
        setRooms(sortedRooms);
      } else {
        setRooms([]);
      }
      setConnectionTested(true);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setError(
        `Failed to load conversations: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setRooms([]);
      setConnectionTested(true);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Just now";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Just now";
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return date.toLocaleDateString();
    } catch {
      return "Just now";
    }
  };

  const truncateText = (text: string, maxLength: number = 30) => {
    if (!text) return "New chat";
    return text.length <= maxLength ? text : `${text.substring(0, maxLength)}...`;
  };

  const refresh = async () => {
    setError(null);
    setConnectionTested(false);
    await loadRooms();
    onRefreshRooms?.();
  };

  const handleNewChat = async () => {
    try {
      const newRoom = await apiService.createRoom("New chat");
      const roomData: Room = {
        room_id: newRoom.room_id,
        room_name: newRoom.room_name || "New chat",
        created_at: newRoom.created_at,
        updated_at: newRoom.created_at,
        user_id: 1,
      };
      setRooms((prev) => [roomData, ...prev]);
      onNewChat();
      onRoomSelect(newRoom.room_id.toString());
    } catch (err) {
      console.error("Failed to create new room:", err);
      setError("Failed to create new chat");
      onNewChat();
    }
  };

  const handleEditRoom = (roomId: string, currentName: string) => {
    setEditingRoom(roomId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async (roomId: string) => {
    // Implement rename if API available
    setEditingRoom(null);
    setEditingName("");
  };

  const sidebarVariants = {
    expanded: {
      width: 320,
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
    },
    collapsed: {
      width: 64,
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
    },
  };

  return (
    <motion.div
      ref={sidebarRef}
      className="fixed left-0 top-0 h-full z-50 overflow-hidden flex flex-col"
      initial="collapsed"
      animate={isExpanded ? "expanded" : "collapsed"}
      variants={sidebarVariants}
      style={{
        background: "rgba(12, 20, 38, 0.96)",
        backdropFilter: "blur(18px)",
        borderRight: "1px solid rgba(148, 163, 184, 0.15)",
        boxShadow: "0 6px 24px rgba(14, 165, 233, 0.16)",
      }}
    >
      {/* Header */}
      <motion.div
        className={`flex items-center justify-between ${isExpanded ? "p-4" : "px-2 py-3"} border-b border-slate-800/80 bg-slate-950/80`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <AnimatePresence initial={false}>
            {isExpanded ? (
              <motion.div
                key="brand"
                className="rounded-2xl px-4 py-2 bg-slate-800/80 border border-slate-700/70 text-slate-100 font-semibold tracking-tight"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, y: -6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, rgba(56,189,248,0.25), rgba(94,234,212,0.35), rgba(129,140,248,0.3))",
                  backgroundSize: "200% 200%",
                }}
              >
                AI Reporting
              </motion.div>
            ) : (
              <motion.div
                key="brand-icon"
                className="rounded-2xl px-3 py-2 bg-slate-800/80 border border-slate-700/70 text-slate-100 font-semibold"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                AI
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          onClick={onToggle}
          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all duration-300 shadow-sm ml-2 flex items-center justify-center shrink-0"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="w-5 h-5 text-slate-200" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-200" />
          )}
        </motion.button>
      </motion.div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* New chat */}
        <motion.div
          className="p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <motion.button
            onClick={handleNewChat}
            className={`
              w-full flex items-center space-x-3 p-3 rounded-xl
              bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10
              hover:from-cyan-500/20 hover:via-blue-500/20 hover:to-indigo-500/20
              border border-white/10 hover:border-cyan-300/40
              backdrop-blur-md transition-all duration-300 shadow-sm shadow-cyan-500/10
              ${!isExpanded ? "justify-center" : ""}
            `}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 8px 25px rgba(59, 130, 246, 0.15)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              animate={{ rotate: 0 }}
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.3 }}
            >
              <Plus className="w-5 h-5 text-cyan-300" />
            </motion.div>
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  className="text-slate-100 font-medium"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  New chat
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Chat list */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-slate-600/80 scrollbar-track-slate-900/60"
        >
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                className="mb-4 flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <span className="text-sm text-slate-300 font-medium">
                  {rooms.length} conversation{rooms.length !== 1 ? "s" : ""}
                </span>
                <motion.button
                  onClick={refresh}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-300/40 transition-all duration-300 shadow-sm"
                  title="Refresh conversations"
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={{ rotate: loading ? 360 : 0 }}
                    transition={{
                      duration: 1,
                      repeat: loading ? Infinity : 0,
                      ease: "linear",
                    }}
                  >
                    <RefreshCw className="w-4 h-4 text-cyan-300" />
                  </motion.div>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {/* Error */}
            <AnimatePresence>
              {error && isExpanded && (
                <motion.div
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/50 backdrop-blur-md"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-center">
                    <span className="flex-1 text-rose-100 text-sm">{error}</span>
                    <motion.button
                      onClick={refresh}
                      className="ml-2 p-1 rounded-lg hover:bg-rose-500/20 transition-colors"
                      title="Retry"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <RefreshCw className="w-4 h-4 text-rose-200" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading */}
            <AnimatePresence>
              {loading && isExpanded && (
                <motion.div
                  className="p-4 text-center text-slate-300"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-500 rounded-full mx-auto mb-2"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <span className="text-sm">Loading conversations...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty */}
            <AnimatePresence>
              {!loading &&
                rooms.length === 0 &&
                !error &&
                connectionTested &&
                isExpanded && (
                  <motion.div
                    className="p-6 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.4 }}
                  >
                    <motion.div
                      className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <MessageSquare className="w-6 h-6 text-cyan-300" />
                    </motion.div>
                    <p className="text-slate-300 text-sm">
                      No conversations yet.
                      <br />
                      <span className="text-slate-400">Start a new chat to begin!</span>
                    </p>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* Rooms */}
            <AnimatePresence>
              {rooms.map((room, index) => (
                <motion.div
                  key={room.room_id}
                  ref={(el) => {
                    if (el) roomRefs.current[room.room_id] = el;
                  }}
                  className="relative group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  onHoverStart={() => setHoveredRoom(room.room_id.toString())}
                  onHoverEnd={() => setHoveredRoom(null)}
                >
                  <motion.div
                    className={`rounded-xl transition-all duration-300 overflow-hidden ${
                      selectedRoomId === room.room_id.toString()
                        ? "bg-gradient-to-r from-cyan-500/20 via-indigo-500/15 to-slate-900 border border-cyan-300/40 shadow-md"
                        : "bg-slate-900/60 hover:bg-slate-800/70 border border-white/10 hover:border-cyan-300/40 shadow-sm"
                    }`}
                    style={{ backdropFilter: "blur(10px)" }}
                  >
                    <button
                      onClick={() => onRoomSelect(room.room_id.toString())}
                      className={`w-full flex items-center space-x-3 p-3 transition-all duration-200 ${
                        !isExpanded ? "justify-center" : ""
                      }`}
                      title={isExpanded ? room.room_name : undefined}
                    >
                      <motion.div
                        animate={{
                          scale: selectedRoomId === room.room_id.toString() ? 1.1 : 1,
                          color: selectedRoomId === room.room_id.toString() ? "#60a5fa" : "#9ca3af",
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <MessageSquare className="w-5 h-5 flex-shrink-0" />
                      </motion.div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="flex-1 text-left min-w-0"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {editingRoom === room.room_id.toString() ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleSaveEdit(room.room_id.toString())}
                                onKeyPress={(e) =>
                                  e.key === "Enter" && handleSaveEdit(room.room_id.toString())
                                }
                                className="w-full bg-transparent text-sm font-medium text-white border-b border-cyan-300 outline-none"
                                autoFocus
                              />
                            ) : (
                              <>
                                <div className="truncate text-sm font-medium text-slate-100">
                                  {truncateText(room.room_name || "New chat", 25)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {formatDate(room.created_at)}
                                </div>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>

                    <AnimatePresence>
                      {isExpanded && hoveredRoom === room.room_id.toString() && (
                        <motion.div
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.button
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRoom(room.room_id.toString(), room.room_name || "New chat");
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Edit3 className="w-3 h-3 text-cyan-200" />
                          </motion.button>

                          <motion.button
                            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-400/50 hover:bg-rose-500/20 transition-colors shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-3 h-3 text-rose-200" />
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/80 bg-slate-950/90 px-3 py-4 flex flex-col items-center gap-2">
        <Link
          href="/dashboard"
          className={`inline-flex items-center gap-2 rounded-xl w-full justify-center px-3 py-2 text-sm font-medium transition-all duration-200 ${
            isExpanded
              ? "bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700"
              : "bg-slate-800 border border-slate-700 text-slate-100"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          {isExpanded && <span>Dashboard</span>}
        </Link>
        <SignOutButton
          compact={!isExpanded}
          className="w-full justify-center bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
        />
      </div>
    </motion.div>
  );
};

Sidebar.displayName = "Sidebar";

export default Sidebar;
