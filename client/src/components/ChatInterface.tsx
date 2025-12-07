import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bot,
  User,
  Download,
  FileText,
  Copy,
  Check,
  Sparkles,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Mock Message interface since we don't have access to the actual types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  document?: string;
  created_at: string;
}

interface ChatInterfaceProps {
  roomId: string | null;
  sidebarExpanded: boolean;
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  isBotTyping: boolean;
  onNewChat: () => void;
  onEditMessage: (messageId: string, updatedContent: string) => Promise<void>;
}

const EmptyState: React.FC = () => (
  <motion.div
    className="flex-1 flex items-center justify-center p-8"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    <div className="text-center max-w-md">
      <motion.div
        animate={{
          rotate: 360,
          scale: [1, 1.1, 1],
        }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <Sparkles className="w-16 h-16 mx-auto mb-4 text-cyan-300" />
      </motion.div>
      <motion.h3
        className="text-2xl font-semibold text-white mb-2 bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Ready to chat
      </motion.h3>
      <motion.p
        className="text-slate-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Start a conversation by typing your message below
      </motion.p>
    </div>
  </motion.div>
);

const TypingIndicator: React.FC = () => (
  <motion.div
    className="flex items-start space-x-3"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    <div className="w-8 h-8 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-300/40 flex items-center justify-center">
      <Bot className="w-4 h-4 text-cyan-200" />
    </div>
    <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-sm">
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-cyan-300 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  roomId,
  sidebarExpanded,
  messages,
  onSendMessage,
  isBotTyping,
  onNewChat,
  onEditMessage,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isBotTyping) return;

    const message = inputValue.trim();
    setInputValue("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const startEditing = (message: Message) => {
    if (isBotTyping || message.role !== "user") return;
    setEditingMessageId(message.id);
    setEditingValue(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingValue("");
  };

  const handleEditSubmit = async () => {
    if (!editingMessageId) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    await onEditMessage(editingMessageId, trimmed);
    cancelEditing();
  };

  const formatContentWithBold = (text: string) => {
    const result: React.ReactNode[] = [];
    const regex = /\*\*([\s\S]*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      const boldText = match[1];
      result.push(
        <strong key={`bold-${match.index}-${boldText}`}>
          {boldText}
        </strong>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result.length ? result : [text];
  };

  const renderMessageContent = (message: Message) => {
    const content = (
      <div className="space-y-3">
        <div className="prose prose-slate prose-invert max-w-none relative">
          {editingMessageId === message.id && message.role === "user" ? (
            <div className="space-y-3">
              <textarea
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-full bg-slate-900/70 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                rows={3}
              />
              <div className="flex space-x-2">
                <motion.button
                  onClick={handleEditSubmit}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-900 hover:from-cyan-300 hover:to-indigo-600 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={isBotTyping}
                >
                  Regenerate
                </motion.button>
                <motion.button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-slate-100 border border-white/10 hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-slate-100">
              {formatContentWithBold(message.content)}
            </div>
          )}
        </div>

        {message.image && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={message.image}
              alt="Generated content"
              className="max-w-full h-auto rounded-lg border border-white/10 shadow-xl backdrop-blur-sm"
              style={{ maxHeight: "400px" }}
            />
          </motion.div>
        )}

        {message.excel ? (
          <motion.div
            className="mt-3 p-3 bg-slate-900/60 backdrop-blur-md rounded-lg border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-emerald-300" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  Excel Document Attachment
                </p>
                <p className="text-xs text-slate-400">Click to view or download</p>
              </div>
              <motion.a
                href={message.excel}
                download
                className="p-2 bg-white/5 backdrop-blur-sm rounded-lg transition-all duration-200 hover:bg-white/10 border border-white/10 text-slate-100"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4 text-emerald-300" />
              </motion.a>
            </div>
          </motion.div>
        ) : (
          message.document && (
            <motion.div
              className="mt-3 p-3 bg-slate-900/60 backdrop-blur-md rounded-lg border border-white/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-cyan-300" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    Document Attachment
                  </p>
                  <p className="text-xs text-slate-400">Click to download</p>
                </div>
                <motion.a
                  href={message.document}
                  download
                  className="p-2 bg-white/5 backdrop-blur-sm rounded-lg transition-all duration-200 hover:bg-white/10 border border-white/10 text-slate-100"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-4 h-4 text-cyan-300" />
                </motion.a>
              </div>
            </motion.div>
          )
        )}
      </div>
    );

    if (message.role === "assistant") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {content}
        </motion.div>
      );
    }

    return content;
  };

  return (
    <div
      className={`
      flex flex-col h-screen transition-all duration-300 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
      ${sidebarExpanded ? "ml-80" : "ml-16"}
    `}
    >
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/25 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Header */}
      <motion.div
        className="border-b border-white/10 backdrop-blur-lg bg-slate-900/80 p-4 relative z-10 shadow-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Bot className="w-6 h-6 text-cyan-300" />
            </motion.div>
            <span className="font-medium text-slate-100">
              {roomId ? "AI Assistant" : "New Conversation"}
            </span>
          </div>
          <AnimatePresence>
            {messages.length > 0 && (
              <motion.button
                onClick={onNewChat}
                className="px-4 py-2 text-sm bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 hover:border-cyan-300/50 transition-all duration-200 text-slate-100 hover:bg-white/10 shadow-sm"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                New chat
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Messages Area */}
      {messages.length === 0 && !isBotTyping ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-600">
          <div className="max-w-4xl mx-auto p-4 space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`flex items-start space-x-3 group ${
                    message.role === "user"
                      ? "flex-row-reverse space-x-reverse"
                      : ""
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <motion.div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-lg"
                          : "bg-slate-900/70 border border-white/10 shadow-sm"
                      }
                    `}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-cyan-200" />
                    )}
                  </motion.div>

                  <motion.div
                    className={`
                      max-w-3xl backdrop-blur-md rounded-2xl p-4 relative group/message
                      ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-cyan-900/60 to-indigo-900/60 border border-cyan-300/30 shadow-md"
                          : "bg-slate-900/70 border border-white/10 shadow-sm text-slate-100"
                      }
                    `}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {renderMessageContent(message)}

                    <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                      <div>{new Date(message.created_at).toLocaleTimeString()}</div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                        <motion.button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10 shadow-sm"
                          title="Copy message"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <AnimatePresence mode="wait">
                            {copiedMessageId === message.id ? (
                              <motion.div
                                key="check"
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 180 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Check className="w-4 h-4 text-green-500" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="copy"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Copy className="w-4 h-4 text-slate-700" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                        {message.role === "user" && (
                          <motion.button
                            onClick={() => startEditing(message)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10 shadow-sm"
                            title="Edit & regenerate"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isBotTyping}
                          >
                            <Edit3 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </div>

                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isBotTyping && <TypingIndicator />}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <motion.div
        className="border-t border-white/10 backdrop-blur-md bg-slate-900/70 p-4 relative z-10 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder={
              roomId ? "Type your message..." : "Start a new conversation..."
            }
            rows={1}
            className={`
              w-full resize-none rounded-2xl border bg-slate-900/70 backdrop-blur-md p-4 text-white placeholder-slate-500 transition-all duration-300 focus:outline-none focus:ring-2
              ${
                isInputFocused
                  ? "border-cyan-400/60 focus:ring-cyan-300/40 bg-cyan-950/40"
                  : "border-white/10 hover:border-cyan-300/40"
              }
            `}
            disabled={isBotTyping}
            style={{ minHeight: "56px", maxHeight: "200px" }}
            whileFocus={{ scale: 1.005 }}
          />

          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isBotTyping}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 py-3 text-slate-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:from-cyan-300 hover:to-indigo-600 shadow-lg shadow-cyan-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Send className="w-5 h-5" />
            <span>Send</span>
          </motion.button>
        </motion.form>

        <motion.p
          className="text-xs text-slate-300 text-center mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          AI can make mistakes. Please verify important information.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default ChatInterface;
