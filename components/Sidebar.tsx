import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Bot, 
  Eye, 
  Brain, 
  Search, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenMemoryHub: (tab?: 'history' | 'memory' | 'backup') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose,
  onOpenMemoryHub
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - (24 * 60 * 60 * 1000);
  const threeDaysAgo = today - (3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);

  // Filtered sessions
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.messages.some(m => m.text.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  // Group sessions by date
  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const sessionTime = session.updatedAt || session.createdAt;

    let groupName = 'Daha Eski';
    if (sessionTime >= today) groupName = 'Bugün';
    else if (sessionTime >= yesterday) groupName = 'Dün';
    else if (sessionTime >= threeDaysAgo) groupName = 'Son 2-3 Gün';
    else if (sessionTime >= sevenDaysAgo) groupName = 'Son 7 Gün';

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(session);
    return groups;
  }, {} as Record<string, ChatSession[]>);

  const groupOrder = ['Bugün', 'Dün', 'Son 2-3 Gün', 'Son 7 Gün', 'Daha Eski'];

  const handleStartEdit = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingSessionId && editTitle.trim()) {
      onRenameSession(editingSessionId, editTitle.trim());
      setEditingSessionId(null);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-slate-900 border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          flex flex-col h-full
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header with New Chat */}
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs shadow-sm transition-all group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              <span>Yeni Sohbet Başlat</span>
            </button>

            <button 
              onClick={onClose} 
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sohbetlerde ara..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-10 px-4">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {searchFilter ? 'Aramaya uygun sohbet bulunamadı.' : 'Henüz sohbet geçmişi yok.'}
            </div>
          ) : (
            groupOrder.map(group => {
              const groupSessions = groupedSessions[group];
              if (!groupSessions || groupSessions.length === 0) return null;

              return (
                <div key={group}>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {group}
                    </h3>
                    <span className="text-[9px] text-slate-400">
                      {groupSessions.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {groupSessions.map((session) => {
                      const isCurrent = currentSessionId === session.id;
                      const isEditing = editingSessionId === session.id;

                      return (
                        <div 
                          key={session.id}
                          onClick={() => {
                            if (!isEditing) {
                              onSelectSession(session.id);
                              if (window.innerWidth < 768) onClose();
                            }
                          }}
                          className={`
                            group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all text-left text-xs
                            ${isCurrent && !isEditing
                              ? 'bg-indigo-950/60 text-indigo-200 border border-indigo-500/30 shadow-sm font-medium' 
                              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                            }
                          `}
                        >
                          {isEditing ? (
                            <form 
                              onSubmit={handleSaveEdit} 
                              className="flex items-center w-full gap-1.5"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                autoFocus
                              />
                              <button type="submit" className="text-emerald-400 p-1 hover:bg-slate-800 rounded">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setEditingSessionId(null)} className="text-slate-400 p-1 hover:bg-slate-800 rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 truncate flex-1 pr-2">
                                {session.isAgentSession ? (
                                  <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                ) : (
                                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                                )}
                                <span className="truncate">{session.title || 'Yeni Sohbet'}</span>
                              </div>

                              {/* Hover actions */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenMemoryHub('history');
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-700/60 rounded"
                                  title="Detaylı Önizle"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleStartEdit(e, session)}
                                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
                                  title="Yeniden Adlandır"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => onDeleteSession(session.id, e)}
                                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded"
                                  title="Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Long-Term Memory & Persistence Center */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
          <button
            onClick={() => onOpenMemoryHub('memory')}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/30 rounded-xl text-xs text-slate-200 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                <Brain className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-200 group-hover:text-white flex items-center gap-1.5">
                  AI Kalıcı Hafıza
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-[10px] text-slate-400">
                  Önizle, düzenle & kurallar
                </div>
              </div>
            </div>
            <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
          </button>

          <button
            onClick={() => onOpenMemoryHub('backup')}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-lg transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kalıcı Depolama & Yedek</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
