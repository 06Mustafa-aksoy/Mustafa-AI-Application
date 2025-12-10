import React, { useState, useEffect } from 'react';
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
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Group sessions by date
  const groupedSessions = sessions.slice().reverse().reduce((groups, session) => {
    const date = new Date(session.createdAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    let groupName = 'Older';
    if (date >= today) groupName = 'Today';
    else if (date >= yesterday) groupName = 'Yesterday';
    else if (date >= lastWeek) groupName = 'Previous 7 Days';

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(session);
    return groups;
  }, {} as Record<string, ChatSession[]>);

  const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

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

  const handleCancelEdit = () => {
    setEditingSessionId(null);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-slate-900 border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div 
                onClick={onNewChat}
                className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer transition-colors group"
            >
                <div className="w-6 h-6 rounded bg-cyan-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-cyan-900/50 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </div>
                <span className="font-medium text-sm">New Chat</span>
            </div>
            <button onClick={onClose} className="md:hidden p-2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-6 custom-scrollbar">
            {sessions.length === 0 ? (
                <div className="text-center text-slate-500 text-sm mt-10 px-4">
                    <p>No previous chats.</p>
                    <p className="mt-2 text-xs">Your conversation history will appear here.</p>
                </div>
            ) : (
                groupOrder.map(group => {
                  const groupSessions = groupedSessions[group];
                  if (!groupSessions || groupSessions.length === 0) return null;

                  return (
                    <div key={group}>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">{group}</h3>
                      <div className="space-y-1">
                        {groupSessions.map((session) => (
                          <div 
                              key={session.id}
                              onClick={() => {
                                  if (editingSessionId !== session.id) {
                                    onSelectSession(session.id);
                                    if (window.innerWidth < 768) onClose();
                                  }
                              }}
                              className={`
                                  group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
                                  ${currentSessionId === session.id && editingSessionId !== session.id
                                      ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-500/10' 
                                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                  }
                              `}
                          >
                              {editingSessionId === session.id ? (
                                <form 
                                  onSubmit={handleSaveEdit} 
                                  className="flex items-center w-full gap-2"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                    autoFocus
                                    onBlur={handleSaveEdit}
                                  />
                                </form>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                  </svg>
                                  <span className="text-sm truncate flex-1 pr-12">{session.title}</span>
                                  
                                  <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleStartEdit(e, session)}
                                        className="p-1 hover:text-cyan-400 hover:bg-slate-700/50 rounded transition-colors"
                                        title="Rename Chat"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                      </svg>
                                    </button>
                                    <button
                                        onClick={(e) => onDeleteSession(session.id, e)}
                                        className="p-1 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors"
                                        title="Delete Chat"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                    </button>
                                  </div>
                                </>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;