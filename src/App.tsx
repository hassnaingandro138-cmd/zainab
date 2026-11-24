import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { Conversation, Message, UserSettings } from './types';

const STORAGE_KEY_CONV = 'mustafa_ai_conversations_v1';
const STORAGE_KEY_SETTINGS = 'mustafa_ai_settings_v3';
const PREV_STORAGE_KEY_SETTINGS = 'mustafa_ai_settings_v2';
const LEGACY_STORAGE_KEY_SETTINGS = 'mustafa_ai_settings_v1';

const VALID_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

const normalizeModel = (model?: string): string => {
  if (model && VALID_MODELS.has(model)) return model;
  return 'gemini-3.1-flash-lite';
};

const defaultSettings: UserSettings = {
  model: 'gemini-3.1-flash-lite',
  temperature: 0.7,
  systemInstruction: 'You are MUSTAFA, a fast, next-generation 2026 AI assistant powered by Google Gemini with live real-time date and clock awareness. Be direct, clear, accurate, and concise unless the user asks for deep detail.',
  theme: 'dark',
  soundEnabled: true,
};

function getClientClockPayload() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return {
    clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    clientLocalDate: `${dd}-${mm}-${yyyy}`,
    clientLocalDateFull: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    clientLocalTime: now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };
}

function toCleanErrorMessage(err: unknown): string {
  if (!err) {
    return 'An unexpected error occurred while communicating with Gemini API.';
  }

  let msg = '';
  if (typeof err === 'string') {
    msg = err;
  } else if (typeof (err as any)?.message === 'string') {
    msg = (err as any).message;
  } else if ((err as any)?.error) {
    const inner = (err as any).error;
    if (typeof inner === 'string') {
      msg = inner;
    } else if (typeof inner?.message === 'string') {
      msg = inner.message;
    } else {
      try {
        msg = JSON.stringify(inner);
      } catch {
        msg = '';
      }
    }
  }

  // If msg is JSON string, parse it to extract inner message
  for (let i = 0; i < 3; i++) {
    const trimmed = msg.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.error === 'string') {
          msg = parsed.error;
          continue;
        }
        if (typeof parsed?.error?.message === 'string') {
          msg = parsed.error.message;
          continue;
        }
        if (typeof parsed?.message === 'string') {
          msg = parsed.message;
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }

  // Protect against any [object Object] artifacts
  if (!msg || msg.trim() === '' || msg.includes('[object Object]')) {
    msg = 'The backend service encountered an error. Please verify your GEMINI_API_KEY is added in Vercel Project Settings > Environment Variables.';
  }

  // Friendly error for missing API routes on Vercel
  if (
    msg.includes('The page could not be found') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('404')
  ) {
    return 'The backend API route was not found on this deployment. Please ensure you have pushed the latest project files (including the /api directory and vercel.json) to your repository and redeployed on Vercel.';
  }

  return msg.trim();
}

async function parseApiErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        return toCleanErrorMessage(parsed.error);
      }
      if (typeof parsed?.error?.message === 'string' && parsed.error.message.trim()) {
        return toCleanErrorMessage(parsed.error.message);
      }
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        return toCleanErrorMessage(parsed.message);
      }
      if (parsed?.error) {
        return toCleanErrorMessage(parsed.error);
      }
    } catch {
      // fall through to status message
    }
  }

  if (rawText.trim().startsWith('<')) {
    return `Server returned an unexpected response (HTTP ${response.status}). If deployed on Vercel, please ensure GEMINI_API_KEY is configured in Vercel Project Settings > Environment Variables, then redeploy.`;
  }

  return toCleanErrorMessage(rawText.trim() || `Request failed with status ${response.status}`);
}

export default function App() {
  // Load settings from localStorage (migrating v1 settings to fast default)
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const savedV3 = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        parsed.model = normalizeModel(parsed.model);
        if (
          typeof parsed.systemInstruction !== 'string' ||
          !parsed.systemInstruction.includes('real-time')
        ) {
          parsed.systemInstruction = defaultSettings.systemInstruction;
        }
        return { ...defaultSettings, ...parsed };
      }
      const savedV2 = localStorage.getItem(PREV_STORAGE_KEY_SETTINGS);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        parsed.model = normalizeModel(parsed.model);
        parsed.systemInstruction = defaultSettings.systemInstruction;
        return { ...defaultSettings, ...parsed };
      }
      const savedV1 = localStorage.getItem(LEGACY_STORAGE_KEY_SETTINGS);
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        parsed.model = 'gemini-3.1-flash-lite';
        parsed.systemInstruction = defaultSettings.systemInstruction;
        return { ...defaultSettings, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaultSettings;
  });

  // Load conversations from localStorage
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONV);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            model: normalizeModel(c.model),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load conversations from localStorage', e);
    }
    const initialConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: defaultSettings.model,
    };
    return [initialConv];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    return conversations[0]?.id || '';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; type: 'single' | 'all' | 'clear_current' }>({
    isOpen: false,
    id: null,
    type: 'single',
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Apply theme class to document
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Save conversations to localStorage (debounced during active streaming to keep UI instant)
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY_CONV, JSON.stringify(conversations));
      return;
    }
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_CONV, JSON.stringify(conversations));
    }, 600);
    return () => clearTimeout(timer);
  }, [conversations, isLoading]);

  const currentConversation = conversations.find(c => c.id === currentConversationId) || conversations[0] || null;

  // Create new chat
  const handleNewChat = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: settings.model,
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setApiError(null);
  };

  // Select conversation
  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setApiError(null);
  };

  // Rename conversation
  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  // Trigger delete modal
  const handleDeletePrompt = (id: string) => {
    setDeleteModal({ isOpen: true, id, type: 'single' });
  };

  // Trigger clear current conversation modal
  const handleClearCurrentConversation = () => {
    if (!currentConversation) return;
    setDeleteModal({ isOpen: true, id: currentConversation.id, type: 'clear_current' });
  };

  // Confirm delete conversation
  const confirmDelete = () => {
    if (deleteModal.type === 'single' && deleteModal.id) {
      const targetId = deleteModal.id;
      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== targetId);
        if (filtered.length === 0) {
          const fresh: Conversation = {
            id: Date.now().toString(),
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: settings.model,
          };
          setCurrentConversationId(fresh.id);
          return [fresh];
        }
        if (targetId === currentConversationId) {
          setCurrentConversationId(filtered[0].id);
        }
        return filtered;
      });
    } else if (deleteModal.type === 'clear_current' && deleteModal.id) {
      const targetId = deleteModal.id;
      setConversations(prev =>
        prev.map(c =>
          c.id === targetId
            ? { ...c, title: 'New Conversation', messages: [], updatedAt: Date.now() }
            : c
        )
      );
      setApiError(null);
    } else if (deleteModal.type === 'all') {
      const fresh: Conversation = {
        id: Date.now().toString(),
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: settings.model,
      };
      setConversations([fresh]);
      setCurrentConversationId(fresh.id);
      setApiError(null);
    }
  };

  // Clear all chats
  const handleClearAllData = () => {
    setDeleteModal({ isOpen: true, id: null, type: 'all' });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // Shared streaming request helper with automatic /api/chat fallback and safe response parsing
  const streamChatResponse = async (convId: string, historyMessages: Message[]) => {
    setIsLoading(true);
    setApiError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const assistantMsgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let accumulatedText = '';
    let streamFailed = false;
    let streamError: any = null;

    try {
      const recentMessages = historyMessages
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content }));
      const clockPayload = getClientClockPayload();

      const response = await fetch('/api/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
        },
        body: JSON.stringify({
          messages: recentMessages,
          systemInstruction: settings.systemInstruction,
          model: settings.model,
          ...clockPayload,
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseApiErrorResponse(response);
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle non-streaming JSON fallback safely if returned by proxy
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to generate AI response.');
        }
        accumulatedText = data.text;
        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  messages: [
                    ...c.messages.filter(m => m.id !== assistantMsgId),
                    { id: assistantMsgId, role: 'assistant', content: data.text, timestamp: Date.now() },
                  ],
                  updatedAt: Date.now(),
                }
              : c
          )
        );
        return;
      }

      if (!contentType.includes('text/event-stream') || !response.body) {
        const errorMessage = await parseApiErrorResponse(response);
        throw new Error(errorMessage || 'Invalid response format from server.');
      }

      // Insert empty placeholder assistant message for live streaming
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
                ],
                updatedAt: Date.now(),
              }
            : c
        )
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            let payload: any;
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (payload.error) {
              const errStr = typeof payload.error === 'string'
                ? payload.error
                : (payload.error?.message || JSON.stringify(payload.error));
              throw new Error(errStr);
            }

            if (payload.text) {
              accumulatedText += payload.text;
              const currentText = accumulatedText;
              setConversations(prev =>
                prev.map(c =>
                  c.id === convId
                    ? {
                        ...c,
                        messages: c.messages.map(m =>
                          m.id === assistantMsgId ? { ...m, content: currentText } : m
                        ),
                        updatedAt: Date.now(),
                      }
                    : c
                )
              );
            }
          }
        }
      }

      // Process any trailing buffered SSE line
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const payload = JSON.parse(jsonStr);
            if (payload.error) {
              const errStr = typeof payload.error === 'string'
                ? payload.error
                : (payload.error?.message || JSON.stringify(payload.error));
              throw new Error(errStr);
            }
            if (payload.text) {
              accumulatedText += payload.text;
              const currentText = accumulatedText;
              setConversations(prev =>
                prev.map(c =>
                  c.id === convId
                    ? {
                        ...c,
                        messages: c.messages.map(m =>
                          m.id === assistantMsgId ? { ...m, content: currentText } : m
                        ),
                        updatedAt: Date.now(),
                      }
                    : c
                )
              );
            }
          } catch (e: any) {
            if (e?.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        abortControllerRef.current = null;
        setIsLoading(false);
        return;
      }
      streamFailed = true;
      streamError = err;
    }

    // Automatic fallback to standard /api/chat if streaming endpoint failed before receiving tokens
    if (streamFailed && !accumulatedText.trim() && !controller.signal.aborted) {
      try {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: historyMessages.slice(-16).map(m => ({ role: m.role, content: m.content })),
            systemInstruction: settings.systemInstruction,
            model: settings.model,
            ...getClientClockPayload(),
          }),
        });

        if (!fallbackRes.ok) {
          const fallbackErr = await parseApiErrorResponse(fallbackRes);
          throw new Error(fallbackErr);
        }

        const fallbackData = await fallbackRes.json();
        if (!fallbackData.success) {
          throw new Error(fallbackData.error || 'Failed to generate AI response.');
        }

        accumulatedText = fallbackData.text;
        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  messages: [
                    ...c.messages.filter(m => m.id !== assistantMsgId),
                    { id: assistantMsgId, role: 'assistant', content: fallbackData.text, timestamp: Date.now() },
                  ],
                  updatedAt: Date.now(),
                }
              : c
          )
        );
        streamFailed = false;
      } catch (fbErr: any) {
        streamError = fbErr;
      }
    }

    if (streamFailed && !controller.signal.aborted) {
      console.error('Chat API Error:', streamError);
      // Clean up empty assistant placeholder if failed
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.filter(m => !(m.id === assistantMsgId && m.content === '')),
              }
            : c
        )
      );

      const cleanErrorMsg = toCleanErrorMessage(streamError);
      setApiError(cleanErrorMsg);
    }

    abortControllerRef.current = null;
    setIsLoading(false);
  };

  // Send message and call backend API
  const handleSendMessage = async (content: string) => {
    if (!currentConversation || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    let updatedTitle = currentConversation.title;
    if (currentConversation.messages.length === 0) {
      updatedTitle = content.length > 30 ? content.substring(0, 30) + '...' : content;
    }

    const updatedMessages = [...currentConversation.messages, userMessage];

    setConversations(prev =>
      prev.map(c =>
        c.id === currentConversation.id
          ? { ...c, title: updatedTitle, messages: updatedMessages, updatedAt: Date.now() }
          : c
      )
    );

    await streamChatResponse(currentConversation.id, updatedMessages);
  };

  // Edit user message and regenerate from that point
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentConversation || isLoading) return;

    const msgIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const truncated = currentConversation.messages.slice(0, msgIndex + 1).map((m, idx) =>
      idx === msgIndex ? { ...m, content: newContent, timestamp: Date.now() } : m
    );

    setConversations(prev =>
      prev.map(c =>
        c.id === currentConversation.id
          ? { ...c, messages: truncated, updatedAt: Date.now() }
          : c
      )
    );

    await streamChatResponse(currentConversation.id, truncated);
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    if (!currentConversation || currentConversation.messages.length === 0 || isLoading) return;

    const msgs = [...currentConversation.messages];
    if (msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }

    if (msgs.length === 0) return;

    setConversations(prev =>
      prev.map(c => (c.id === currentConversation.id ? { ...c, messages: msgs } : c))
    );

    await streamChatResponse(currentConversation.id, msgs);
  };

  const handleToggleTheme = () => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleChangeModel = (model: string) => {
    setSettings(prev => ({
      ...prev,
      model: normalizeModel(model),
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeletePrompt}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={settings}
        onToggleTheme={handleToggleTheme}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <ChatArea
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onClearConversation={handleClearCurrentConversation}
        onRegenerate={handleRegenerate}
        onStopGenerating={handleStopGenerating}
        isLoading={isLoading}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        apiError={apiError}
        onDismissError={() => setApiError(null)}
        currentModel={settings.model}
        onChangeModel={handleChangeModel}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
        onClearAllData={handleClearAllData}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        title={
          deleteModal.type === 'all'
            ? 'Clear All Conversations'
            : deleteModal.type === 'clear_current'
              ? 'Clear Current Conversation'
              : 'Delete Conversation'
        }
        message={
          deleteModal.type === 'all'
            ? 'Are you sure you want to clear all chat history? This cannot be undone.'
            : deleteModal.type === 'clear_current'
              ? 'Are you sure you want to clear all messages in this conversation?'
              : 'Are you sure you want to delete this conversation?'
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleteModal({ isOpen: false, id: null, type: 'single' })}
      />
    </div>
  );
}
