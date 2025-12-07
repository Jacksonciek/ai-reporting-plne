'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { Bot, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatInterface from '@/components/ChatInterface';
import Welcome from '@/components/Welcome';
import { apiService } from '@/services/api';
import { Message, Room } from '@/types';
import { authService } from '@/services/auth';

const DEFAULT_ROOM_LABEL = 'New chat';

const shouldRenameRoom = (name?: string) => {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  return normalized === DEFAULT_ROOM_LABEL.toLowerCase() || normalized === 'new conversation';
};

const buildRoomNameFromPrompt = (prompt: string) => {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const maxLength = 48;
  if (capitalized.length <= maxLength) {
    return capitalized;
  }

  const truncated = capitalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const base = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trim()}...`;
};

export default function ChatbotExperience({
  preferChatView = false,
  mode = 'user',
}: {
  preferChatView?: boolean;
  mode?: 'user' | 'admin';
}) {
  const router = useRouter();
  const isAdminMode = mode === 'admin';
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(!preferChatView);
  const [hasLoadedRooms, setHasLoadedRooms] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const sidebarRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const skipNextRoomLoadRef = useRef(false);

  // GSAP animations for background elements
  useEffect(() => {
    if (containerRef.current && backgroundRef.current) {
      // Animated background gradients
      gsap.set(backgroundRef.current, {
        background: 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.25), transparent 55%), radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.22), transparent 55%), radial-gradient(circle at 40% 80%, rgba(14, 165, 233, 0.2), transparent 55%)'
      });

      // Continuous background animation
      gsap.to(backgroundRef.current, {
        duration: 20,
        ease: "none",
        repeat: -1,
        yoyo: true,
        background: 'radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.3), transparent 55%), radial-gradient(circle at 20% 80%, rgba(236, 72, 153, 0.26), transparent 55%), radial-gradient(circle at 60% 20%, rgba(14, 165, 233, 0.28), transparent 55%)'
      });

      // Floating particles animation
      const particles = Array.from({ length: 15 }, (_, i) => {
        const particle = document.createElement('div');
        particle.className = 'absolute w-1 h-1 bg-sky-400/30 rounded-full pointer-events-none';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        backgroundRef.current?.appendChild(particle);

        gsap.to(particle, {
          duration: 10 + Math.random() * 20,
          y: -100 - Math.random() * 100,
          x: -50 + Math.random() * 100,
          opacity: 0,
          repeat: -1,
          ease: "none",
          delay: Math.random() * 10
        });

        return particle;
      });

      return () => {
        particles.forEach(particle => particle.remove());
      };
    }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setAuthReady(true);
  }, [router]);

  // Load initial rooms
  useEffect(() => {
    if (authReady) {
      loadRooms({ forceSpinner: true });
    }
  }, [authReady]);

  // Load messages when room changes
  useEffect(() => {
    if (!authReady) return;

    if (!selectedRoomId) {
      setMessages([]);
      setShowWelcome(!preferChatView);
      return;
    }

    setShowWelcome(false);

    if (skipNextRoomLoadRef.current) {
      skipNextRoomLoadRef.current = false;
      return;
    }

    loadMessages(selectedRoomId);
  }, [selectedRoomId, preferChatView, authReady]);

  const loadRooms = async (options: { forceSpinner?: boolean } = {}) => {
    if (!authReady) return;
    const shouldShowSpinner = options.forceSpinner || !hasLoadedRooms;
    try {
      if (shouldShowSpinner) {
        setIsLoading(true);
      }
      const response = await apiService.getRooms();
      setRooms(response.data || []);

      const shouldShowWelcome =
        !preferChatView && (!response.data?.length || !selectedRoomId);
      setShowWelcome(shouldShowWelcome);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      setShowWelcome(!preferChatView);
      if (!authService.isAuthenticated()) {
        router.replace('/login');
      }
    } finally {
      if (shouldShowSpinner) {
        setIsLoading(false);
      }
      setHasLoadedRooms(true);
    }
  };

  const loadMessages = async (roomId: string) => {
    if (!authReady) return;
    try {
      const response = await apiService.getMessages(roomId);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
      if (!authService.isAuthenticated()) {
        router.replace('/login');
      }
    }
  };

  const handleNewChat = () => {
    setSelectedRoomId(null);
    setMessages([]);
    setShowWelcome(!preferChatView);
    setSidebarExpanded(true);
    loadRooms();
  };

  const handleSendMessage = async (message: string) => {
    if (!authReady) {
      router.replace('/login');
      return;
    }

    if (!message.trim()) return;

    // Immediately hide welcome screen when sending first message
    setShowWelcome(false);

    // Collapse sidebar when chat starts
    setSidebarExpanded(false);

    if (!selectedRoomId) {
      await handleFirstMessage(message);
      return;
    }

    await sendMessageToExistingRoom(message);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!selectedRoomId) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    setMessages((prev) => {
      const index = prev.findIndex((msg) => msg.id === messageId);
      if (index === -1) return prev;
      const updatedMessage = {
        ...prev[index],
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      return [...prev.slice(0, index), updatedMessage];
    });

    await sendMessageToExistingRoom(trimmed, { skipUserMessage: true });
  };

  const handleFirstMessage = async (message: string) => {
    try {
      setIsBotTyping(true);

      const roomTitle = buildRoomNameFromPrompt(message);
      const newRoom = await apiService.createRoom(roomTitle);
      const numericRoomId = newRoom.room_id ?? Date.now();
      const roomId = numericRoomId.toString();
      const roomTimestamp = newRoom.created_at || new Date().toISOString();

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        room_id: roomId,
        content: message,
        role: 'user',
        created_at: new Date().toISOString(),
      };

      setMessages([userMessage]);
      skipNextRoomLoadRef.current = true;
      setSelectedRoomId(roomId);
      setRooms(prev => {
        const updatedRoom: Room = {
          room_id: numericRoomId,
          room_name: roomTitle,
          created_at: roomTimestamp,
          updated_at: roomTimestamp,
          user_id: prev[0]?.user_id,
        };

        const exists = prev.some(room => room.room_id === numericRoomId);
        if (exists) {
          return prev.map(room =>
            room.room_id === numericRoomId ? { ...room, ...updatedRoom } : room
          );
        }

        return [updatedRoom, ...prev];
      });

      try {
        const messagePair = await apiService.sendMessageToBot(roomId, message);

        const realBotMessage: Message = {
          id: `bot-${Date.now()}`,
          room_id: roomId,
          content: messagePair.bot?.text || messagePair.response || 'I received your message but encountered an issue generating a response. Please try again.',
          role: 'assistant',
          created_at: new Date().toISOString(),
          image: messagePair.bot?.image,
          document: messagePair.bot?.document,
          excel: messagePair.bot?.excel,
        };

        setMessages([userMessage, realBotMessage]);
      } catch (botError) {
        console.error('Bot response error:', botError);

        const errorMessage: Message = {
          id: `bot-error-${Date.now()}`,
          room_id: roomId,
          content: 'I apologize, but I encountered an issue processing your request. This could be due to a network connection problem or server issue. Please try sending your message again.',
          role: 'assistant',
          created_at: new Date().toISOString(),
        };

        setMessages([userMessage, errorMessage]);
      }

      await loadRooms();
    } catch (error) {
      console.error('Failed to create new chat:', error);
      setMessages([]);
      setSelectedRoomId(null);
    } finally {
      setIsBotTyping(false);
    }
  };

  const sendMessageToExistingRoom = async (
    message: string,
    options: { skipUserMessage?: boolean } = {}
  ) => {
    if (!selectedRoomId) return;

    const roomId = selectedRoomId;

    try {
      setIsBotTyping(true);

      if (!options.skipUserMessage) {
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          room_id: roomId,
          content: message,
          role: 'user',
          created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
      }

      // 2. Get actual bot response
      try {
        const messagePair = await apiService.sendMessageToBot(roomId, message);

        // 3. Add real bot reply
        const realBotMessage: Message = {
          id: `bot-${Date.now()}`,
          room_id: roomId,
          content: messagePair.bot?.text || messagePair.response || 'I received your message but encountered an issue generating a response. Please try again.',
          role: 'assistant',
          created_at: new Date().toISOString(),
          image: messagePair.bot?.image,
          document: messagePair.bot?.document,
          excel: messagePair.bot?.excel,
        };

        setMessages(prev => [...prev, realBotMessage]);

        setRooms(prev => {
          const updatedTitle = buildRoomNameFromPrompt(message);
          const numericRoomId = Number(roomId);
          const existingIndex = prev.findIndex(
            room => room.room_id.toString() === roomId
          );

          if (existingIndex === -1) {
            if (Number.isNaN(numericRoomId)) {
              return prev;
            }

            const timestamp = new Date().toISOString();
            const newRoom: Room = {
              room_id: numericRoomId,
              room_name: updatedTitle,
              created_at: timestamp,
              updated_at: timestamp,
              user_id: prev[0]?.user_id,
            };

            return [newRoom, ...prev];
          }

          if (!shouldRenameRoom(prev[existingIndex].room_name)) {
            return prev;
          }

          const updatedRooms = [...prev];
          updatedRooms[existingIndex] = {
            ...updatedRooms[existingIndex],
            room_name: updatedTitle,
            updated_at: new Date().toISOString(),
          };

          return updatedRooms;
        });
      } catch (botError) {
        console.error('Bot response error:', botError);

        // Add error message
        const errorMessage: Message = {
          id: `bot-error-${Date.now()}`,
          room_id: roomId,
          content: 'I apologize, but I encountered an issue processing your request. This could be due to a network connection problem or server issue. Please try sending your message again.',
          role: 'assistant',
          created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        room_id: roomId,
        content: 'Failed to send message. Please check your connection and try again.',
        role: 'assistant',
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleRoomSelect = (id: string) => {
    setSelectedRoomId(id);
    setMessages([]);
    setShowWelcome(false);
    setSidebarExpanded(false);
  };

  const refreshRooms = async () => {
    await loadRooms();
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  };

  const loadingVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const mainContentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div 
      ref={containerRef}
      className="h-screen overflow-hidden relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >

      {/* Enhanced Background with Glassmorphism */}
      <div 
        ref={backgroundRef}
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800"
      />
      
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-800/70 backdrop-blur-3xl" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.35'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      {/* Show loading state while determining initial state */}
      <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                className="flex items-center justify-center h-full relative z-10"
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <div className="flex flex-col items-center space-y-4 text-slate-700">
                  <motion.div
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-white border border-slate-200 shadow-xl shadow-blue-100/50"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Bot className="w-8 h-8 text-blue-500" />
                  </motion.div>
                  <motion.p
                    className="text-lg font-medium text-slate-800"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Loading...
                  </motion.p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="h-full relative z-10"
            initial="hidden"
            animate="visible"
          >
            <Sidebar
              isExpanded={sidebarExpanded}
              onToggle={() => setSidebarExpanded(!sidebarExpanded)}
              selectedRoomId={selectedRoomId}
              onRoomSelect={handleRoomSelect}
              onNewChat={handleNewChat}
              rooms={rooms}
              onRefreshRooms={refreshRooms}
              footerHref={isAdminMode ? "/admin" : "/dashboard"}
              footerLabel={isAdminMode ? "Back to Admin Menu" : "Dashboard"}
              footerIcon={isAdminMode ? <ArrowLeft className="w-4 h-4" /> : undefined}
            />

            <AnimatePresence mode="wait">
              {showWelcome ? (
                <motion.div 
                  className={`
                    flex flex-col h-screen transition-all duration-500 ease-out
                    ${sidebarExpanded ? 'ml-80' : 'ml-16'}
                  `}
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <Welcome
                    onSendMessage={handleSendMessage}
                    isBotTyping={isBotTyping}
                    rooms={rooms}
                    onRoomSelect={handleRoomSelect}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`chat-${selectedRoomId || 'empty'}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <ChatInterface
                    key={selectedRoomId || 'empty'}
                    roomId={selectedRoomId}
                    sidebarExpanded={sidebarExpanded}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isBotTyping={isBotTyping}
                    onNewChat={handleNewChat}
                    onEditMessage={handleEditMessage}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
