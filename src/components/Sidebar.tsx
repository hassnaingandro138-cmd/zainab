import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  Settings, 
  Moon, 
  Sun, 
  Sparkles, 
  Check, 
  X 
} from 'lucide-react';
import { Conversation, UserSettings } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
  settings: UserSettings;
  onToggleTheme: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onOpenSettings,
  settings,
  onToggleTheme,
  isOpen,
  onCloseMobile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-80 bg-zinc-900 text-zinc-100 flex flex-col
        border-r border-zinc-800 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top Header & Logo */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
              <img src="/src/assets/images/mustafa_robot_avatar_1795431230127.jpg" alt="MUSTAFA AI" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide bg-gradient-to-r from-white via-zinc-200 to-indigo-300 bg-clip-text text-transparent">
                MUSTAFA
              </h1>
              <p className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase">2026 AI Edition</p>
            </div>
          </div>
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Recent History
          </div>
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs px-4">
              {searchQuery ? 'No matching conversations found.' : 'No chats yet. Start a new chat above!'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onCloseMobile();
                  }}
                  className={`
                    group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all
                    ${isActive 
                      ? 'bg-gradient-to-r from-indigo-900/60 to-violet-900/40 text-white border border-indigo-700/50 shadow-sm' 
                      : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    
                    {isEditing ? (
                      <form onSubmit={(e) => saveRename(conv.id, e)} className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-zinc-950 px-2 py-1 rounded text-xs text-white border border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveRename(conv.id);
                          }}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span className="truncate">{conv.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 transition-opacity ml-2">
                      <button
                        title="Rename"
                        onClick={(e) => startRename(conv, e)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700/50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-700/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Settings & Theme Toggle */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors flex-1"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Settings</span>
          </button>

          <button
            onClick={onToggleTheme}
            title={settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </aside>
    </>
  );
};
