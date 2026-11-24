import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Send,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  User,
  Menu,
  AlertCircle,
  Lightbulb,
  Edit3,
  Trash2,
  X,
  Square,
  Mic,
  MicOff,
  Download,
  Zap
} from 'lucide-react';
import { marked } from 'marked';
import { Conversation, Message } from '../types';

interface MessageBubbleProps {
  msg: Message;
  isLoading: boolean;
  isEditing: boolean;
  editingText: string;
  copiedId: string | null;
  onStartEditing: (id: string, content: string) => void;
  onCancelEditing: () => void;
  onSaveEdit: (id: string) => void;
  onChangeEditingText: (text: string) => void;
  onCopy: (content: string, id: string) => void;
}

const MessageBubble = memo<MessageBubbleProps>(({
  msg,
  isLoading,
  isEditing,
  editingText,
  copiedId,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onChangeEditingText,
  onCopy
}) => {
  const isUser = msg.role === 'user';

  const renderedHtml = useMemo(() => {
    if (isUser) return null;
    try {
      const rawHtml = marked.parse(msg.content, { async: false }) as string;
      return { __html: rawHtml };
    } catch {
      return { __html: msg.content };
    }
  }, [isUser, msg.content]);

  return (
    <div
      className={`flex gap-3 sm:gap-4 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fadeIn`}
    >
      {/* Avatar */}
      <div className={`
        w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden
        ${isUser
          ? 'bg-gradient-to-tr from-zinc-700 to-zinc-900 text-white'
          : 'bg-zinc-800'}
      `}>
        {isUser ? (
          <User className="w-5 h-5" />
        ) : (
          <img src="/src/assets/images/mustafa_robot_avatar_1795431230127.jpg" alt="MUSTAFA" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`group relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-5 py-3.5 shadow-sm ${
        isUser
          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none'
          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
      }`}>
        {isUser ? (
          isEditing ? (
            <div className="space-y-2 min-w-[220px]">
              <textarea
                rows={2}
                value={editingText}
                onChange={(e) => onChangeEditingText(e.target.value)}
                className="w-full bg-indigo-950/50 text-white text-sm rounded-xl p-2 border border-indigo-300/40 focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelEditing}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg.id)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50"
                >
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
          )
        ) : (
          <div
            className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed overflow-x-auto [&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_code]:font-mono [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={renderedHtml || { __html: '' }}
          />
        )}

        {/* Footer / Timestamp & Actions */}
        <div className={`flex items-center justify-between gap-4 mt-2 pt-2 border-t text-[10px] ${
          isUser
            ? 'border-indigo-500/40 text-indigo-100/80'
            : 'border-zinc-100 dark:border-zinc-800 text-zinc-400'
        }`}>
          <span>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {isUser && !isEditing && !isLoading && (
            <button
              onClick={() => onStartEditing(msg.id, msg.content)}
              className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-white"
              title="Edit message"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}

          {!isUser && (
            <button
              onClick={() => onCopy(msg.content, msg.id)}
              className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {copiedId === msg.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface ChatAreaProps {
  conversation: Conversation | null;
  onSendMessage: (content: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onClearConversation: () => void;
  onRegenerate: () => void;
  onStopGenerating: () => void;
  isLoading: boolean;
  onOpenMobileSidebar: () => void;
  apiError: string | null;
  onDismissError: () => void;
  currentModel: string;
  onChangeModel: (model: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  onSendMessage,
  onEditMessage,
  onClearConversation,
  onRegenerate,
  onStopGenerating,
  isLoading,
  onOpenMobileSidebar,
  apiError,
  onDismissError,
  currentModel,
  onChangeModel
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const supportsVoice = typeof window !== 'undefined' && Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  const suggestedPrompts = [
    { title: "2026 AI & Tech Trends", prompt: "What are the biggest breakthroughs in AI agents, robotics, and developer workflows in 2026?" },
    { title: "Full-Stack API Script", prompt: "Write a clean, production-ready TypeScript REST endpoint with validation and error handling." },
    { title: "Startup Strategy 2026", prompt: "Outline a lean 2026 product launch and growth roadmap for an AI-first SaaS app." },
    { title: "Creative Storytelling", prompt: "Write a vivid short story set in a 2026 smart city where humans and AI collaborate." }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
  }, [conversation?.messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const startEditing = useCallback((id: string, currentContent: string) => {
    setEditingMessageId(id);
    setEditingText(currentContent);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const saveEdit = useCallback((id: string) => {
    setEditingText((currentText) => {
      const trimmed = currentText.trim();
      if (trimmed) {
        onEditMessage(id, trimmed);
      }
      return '';
    });
    setEditingMessageId(null);
  }, [onEditMessage]);

  const toggleVoiceInput = () => {
    if (!supportsVoice) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseInput = input.trim() ? input.trim() + ' ' : '';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(baseInput + transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleExportChat = () => {
    if (!conversation || conversation.messages.length === 0) return;
    const mdLines = [
      `# ${conversation.title}`,
      `_Exported from MUSTAFA AI (2026) on ${new Date().toLocaleString()}_`,
      '',
      ...conversation.messages.map((m) => {
        const sender = m.role === 'user' ? 'You' : 'MUSTAFA AI';
        const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `### ${sender} (${time})\n\n${m.content}\n`;
      }),
    ];
    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'mustafa_chat'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const messages = conversation?.messages || [];
  const lastMessage = messages[messages.length - 1];
  const isWaitingForFirstToken = isLoading && (!lastMessage || lastMessage.role === 'user' || lastMessage.content === '');

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 px-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-xs">
                {conversation?.title || 'New Conversation'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                MUSTAFA AI • 2026
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick 2026 Model Switcher */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={currentModel}
              onChange={(e) => onChangeModel(e.target.value)}
              disabled={isLoading}
              aria-label="Select AI Model"
              className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none cursor-pointer max-w-[105px] sm:max-w-none"
            >
              <option value="gemini-3.1-flash-lite" className="bg-white dark:bg-zinc-900">Flash Lite (Ultra Fast)</option>
              <option value="gemini-4-hydrogen" className="bg-white dark:bg-zinc-900">Gemini 4 Hydrogen</option>
            </select>
          </div>

          {messages.length > 0 && (
            <>
              <button
                onClick={handleExportChat}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50"
                title="Export chat as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Export</span>
              </button>
              <button
                onClick={onRegenerate}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50"
                title="Regenerate last response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Regenerate</span>
              </button>
              <button
                onClick={onClearConversation}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50"
                title="Clear current conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clear</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center gap-3 text-red-600 dark:text-red-400 text-xs sm:text-sm animate-fadeIn z-10">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-medium break-words">{apiError}</div>
          <button
            onClick={onDismissError}
            className="p-1 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Messages / Welcome Screen */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center py-8 animate-fadeIn">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/25 mb-5 group hover:scale-105 transition-transform overflow-hidden ring-2 ring-indigo-500/30">
              <img src="/src/assets/images/mustafa_robot_avatar_1795431230127.jpg" alt="MUSTAFA AI" className="w-full h-full object-cover" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[11px] font-semibold tracking-wide uppercase mb-4">
              <Sparkles className="w-3 h-3" />
              2026 Next-Gen AI Edition
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
              Hello, I am <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">MUSTAFA</span>
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mb-8 max-w-lg leading-relaxed">
              Your 2026 intelligent AI assistant powered by Google Gemini. Real-time streaming, voice input, and instant answers for code, research, and creativity.
            </p>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {suggestedPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(item.prompt)}
                  className="p-4 bg-white dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all group text-left flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </span>
                    <Lightbulb className="w-4 h-4 text-amber-500 opacity-70 group-hover:opacity-100" />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              if (msg.role === 'assistant' && msg.content === '' && isLoading) {
                return null;
              }
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isLoading={isLoading}
                  isEditing={editingMessageId === msg.id}
                  editingText={editingMessageId === msg.id ? editingText : ''}
                  copiedId={copiedId}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveEdit={saveEdit}
                  onChangeEditingText={setEditingText}
                  onCopy={handleCopy}
                />
              );
            })}

            {/* Typing Indicator */}
            {isWaitingForFirstToken && (
              <div className="flex gap-4 items-start animate-fadeIn">
                <div className="w-9 h-9 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-md overflow-hidden">
                  <img src="/src/assets/images/mustafa_robot_avatar_1795431230127.jpg" alt="MUSTAFA" className="w-full h-full object-cover animate-pulse" />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-zinc-400 ml-2 font-medium">MUSTAFA is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-end gap-2 sm:gap-3">
          <div className="flex-1 flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask MUSTAFA anything... (Shift + Enter for new line)"
              className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none max-h-40 leading-relaxed"
            />
            {supportsVoice && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop voice input' : 'Speak prompt'}
                className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                  isListening
                    ? 'bg-red-500/20 text-red-500 animate-pulse'
                    : 'text-zinc-500 hover:text-indigo-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          {isLoading ? (
            <button
              type="button"
              onClick={onStopGenerating}
              title="Stop generating"
              className="h-11 w-11 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 transition-all shrink-0 hover:scale-105 active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 transition-all shrink-0 hover:scale-105 active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
        <div className="text-center mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          MUSTAFA AI • 2026 Edition — Verify important information.
        </div>
      </div>
    </div>
  );
};
