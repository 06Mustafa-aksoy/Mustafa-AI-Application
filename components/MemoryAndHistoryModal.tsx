import React, { useState, useEffect } from 'react';
import { 
  X, 
  Brain, 
  History, 
  ShieldCheck, 
  Download, 
  Upload, 
  Search, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  Pin, 
  Plus, 
  Bot, 
  Sparkles, 
  Check, 
  AlertCircle,
  FileText,
  Clock,
  HardDrive
} from 'lucide-react';
import { ChatSession, MemoryItem } from '../types';
import { 
  exportAllData, 
  importAllData, 
  requestStoragePersistence, 
  checkStoragePersistence,
  saveMemoryToDB,
  deleteMemoryFromDB
} from '../services/storage';

interface MemoryAndHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  memories: MemoryItem[];
  onUpdateMemories: (memories: MemoryItem[]) => void;
  initialTab?: 'history' | 'memory' | 'backup';
}

export const MemoryAndHistoryModal: React.FC<MemoryAndHistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  memories,
  onUpdateMemories,
  initialTab = 'history'
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'memory' | 'backup'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '3days' | '7days' | 'older'>('all');
  const [selectedPreviewSessionId, setSelectedPreviewSessionId] = useState<string>(currentSessionId || (sessions[0]?.id || ''));
  
  // Storage persistence state
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [storageUsage, setStorageUsage] = useState<{ usageMB?: number; quotaMB?: number }>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Memory Form State
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('user_preference');

  useEffect(() => {
    if (isOpen) {
      checkPersistence();
      if (!selectedPreviewSessionId && sessions.length > 0) {
        setSelectedPreviewSessionId(sessions[0].id);
      }
    }
  }, [isOpen, sessions]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const checkPersistence = async () => {
    const info = await checkStoragePersistence();
    setIsPersisted(info.persisted);
    if (info.usage !== undefined) {
      setStorageUsage({
        usageMB: Math.round((info.usage / (1024 * 1024)) * 10) / 10,
        quotaMB: info.quota ? Math.round((info.quota / (1024 * 1024))) : undefined,
      });
    }
  };

  const handleRequestPersistence = async () => {
    const granted = await requestStoragePersistence();
    setIsPersisted(granted);
    if (granted) {
      setStatusMessage('Kalıcı depolama başarıyla etkinleştirildi. Verileriniz asla silinmeyecek.');
    } else {
      setStatusMessage('Tarayıcınız kalıcı depolama isteğini onaylamadı (Genellikle HTTPS veya yer imi ekleme önerilir).');
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleExportBackup = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mustafa-ai-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('Yedek dosyası başarıyla indirildi.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      setStatusMessage('Yedek alma sırasında hata oluştu.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importAllData(json);
      setStatusMessage(`${res.sessionCount} sohbet ve ${res.memoryCount} hafıza kaydı başarıyla yüklendi!`);
      // Reload parent memories & sessions
      if (json.memories) {
        onUpdateMemories(json.memories);
      }
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setStatusMessage('Geçersiz yedek dosyası!');
    }
  };

  // Filter sessions by date and search
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.messages.some(m => m.text.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    const age = now - (s.updatedAt || s.createdAt);
    if (dateFilter === 'today') return age < oneDayMs;
    if (dateFilter === '3days') return age < 3 * oneDayMs;
    if (dateFilter === '7days') return age < 7 * oneDayMs;
    if (dateFilter === 'older') return age >= 7 * oneDayMs;
    return true;
  });

  const selectedSession = sessions.find(s => s.id === selectedPreviewSessionId) || filteredSessions[0];

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    const item: MemoryItem = {
      id: `mem-${Date.now()}`,
      key: newKey.trim(),
      value: newValue.trim(),
      category: newCategory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    };

    await saveMemoryToDB(item);
    onUpdateMemories([item, ...memories]);
    setNewKey('');
    setNewValue('');
    setShowAddMemory(false);
    setStatusMessage('Yeni hafıza maddesi eklendi.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleTogglePinMemory = async (mem: MemoryItem) => {
    const updated = { ...mem, isPinned: !mem.isPinned, updatedAt: Date.now() };
    await saveMemoryToDB(updated);
    onUpdateMemories(memories.map(m => m.id === mem.id ? updated : m));
  };

  const handleDeleteMemory = async (id: string) => {
    await deleteMemoryFromDB(id);
    onUpdateMemories(memories.filter(m => m.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Hafıza & Sohbet Geçmişi Merkezi
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                  Kalıcı Bellek
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tüm geçmiş sohbetlerinizi önizleyin, AI hafıza kurallarını yönetin ve kalıcı yedek alın.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'history' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Sohbet Önizleme ({sessions.length})
              </button>

              <button
                onClick={() => setActiveTab('memory')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'memory' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                AI Kalıcı Hafıza ({memories.length})
              </button>

              <button
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'backup' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Yedek & Kalıcılık
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className="bg-indigo-950/80 border-b border-indigo-800/50 px-6 py-2 text-xs text-indigo-200 flex items-center justify-between animate-in slide-in-from-top-1">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {statusMessage}
            </span>
            <button onClick={() => setStatusMessage(null)} className="hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden">
          
          {/* TAB 1: HISTORY PREVIEW */}
          {activeTab === 'history' && (
            <div className="grid grid-cols-12 h-full">
              {/* Left Column: Filter & List */}
              <div className="col-span-5 border-r border-slate-800 flex flex-col h-full bg-slate-900/50">
                {/* Search & Filters */}
                <div className="p-4 border-b border-slate-800 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Sohbet veya mesaj içeriği ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Date Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'today', label: 'Bugün' },
                      { id: '3days', label: 'Son 3 Gün' },
                      { id: '7days', label: 'Son 7 Gün' },
                      { id: 'older', label: 'Daha Eski' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setDateFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                          dateFilter === f.id
                            ? 'bg-slate-700 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Aradığınız kriterlere uygun sohbet bulunamadı.
                    </div>
                  ) : (
                    filteredSessions.map(session => {
                      const isSelected = (selectedSession?.id === session.id);
                      const isCurrent = (currentSessionId === session.id);
                      const lastMsg = session.messages[session.messages.length - 1];

                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedPreviewSessionId(session.id)}
                          className={`p-3 rounded-xl cursor-pointer transition-all border text-left ${
                            isSelected 
                              ? 'bg-indigo-950/40 border-indigo-500/40 shadow-sm' 
                              : 'bg-slate-800/30 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                              {session.title || 'Başlıksız Sohbet'}
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {new Date(session.updatedAt || session.createdAt).toLocaleDateString('tr-TR', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                            {lastMsg ? lastMsg.text : 'Mesaj bulunmuyor.'}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {session.messages.length} mesaj
                              </span>
                              {session.isAgentSession && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium flex items-center gap-1">
                                  <Bot className="w-2.5 h-2.5" /> Agent
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                  Aktif
                                </span>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
                                  onDeleteSession(session.id);
                                }
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                              title="Sohbeti Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Full Session Inspector */}
              <div className="col-span-7 flex flex-col h-full bg-slate-950/40">
                {selectedSession ? (
                  <>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                      <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          {selectedSession.title}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Oluşturulma: {new Date(selectedSession.createdAt).toLocaleString('tr-TR')}</span>
                          <span>•</span>
                          <span>{selectedSession.messages.length} İleti</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onSelectSession(selectedSession.id);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Bu Sohbete Geç
                        </button>
                      </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {selectedSession.messages.map((m, idx) => {
                        const isUser = m.role === 'user';
                        return (
                          <div 
                            key={m.id || idx}
                            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                              isUser ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {isUser ? 'M' : <Bot className="w-4 h-4 text-indigo-400" />}
                            </div>

                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                              isUser 
                                ? 'bg-indigo-600/90 text-white' 
                                : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-sm'
                            }`}>
                              <div className="whitespace-pre-wrap">{m.text}</div>
                              {m.attachments && m.attachments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1">
                                  {m.attachments.map((att, aIdx) => (
                                    <span key={aIdx} className="px-2 py-0.5 rounded bg-black/30 text-[10px] text-slate-300 flex items-center gap-1">
                                      <FileText className="w-3 h-3" />
                                      {att.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className={`text-[9px] mt-1.5 ${isUser ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {new Date(m.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                    Önizlemek için soldan bir sohbet seçin.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI LONG-TERM MEMORY */}
          {activeTab === 'memory' && (
            <div className="p-6 h-full overflow-y-auto space-y-6">
              
              {/* Explainer Banner */}
              <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-5 flex items-start gap-4">
                <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <Brain className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Yapay Zeka Kalıcı Hafıza Sistemi
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Mustafa AI burada saklanan kuralları, tercihleri ve çalışma bağlamını her yeni sohbette otomatik hatırlar.
                    Tarayıcıyı kapatsanız dahi bu bilgiler silinmez ve AI modeline rehberlik eder.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddMemory(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Hafıza Maddesi Ekle
                </button>
              </div>

              {/* Add Memory Modal / Form */}
              {showAddMemory && (
                <form onSubmit={handleAddMemorySubmit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Yeni Kalıcı Bilgi / Tercih Ekle
                    </h4>
                    <button type="button" onClick={() => setShowAddMemory(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Başlık / Konu</label>
                      <input
                        type="text"
                        placeholder="Örn: Kodlama Dili Tercihi, Proje Adı"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Kategori</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="user_preference">Kullanıcı Tercihi (Üslup, format vb.)</option>
                        <option value="personal_fact">Kişisel Bilgi / Profil</option>
                        <option value="work_context">Çalışma / Proje Bağlamı</option>
                        <option value="instruction">Özel Sistem Talimatı</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Detay / Kural</label>
                    <textarea
                      placeholder="Mustafa AI'ın her zaman hatırlamasını istediğiniz bilgi veya kural..."
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMemory(false)}
                      className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs hover:bg-slate-700"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-500"
                    >
                      Kaydet
                    </button>
                  </div>
                </form>
              )}

              {/* Memory Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {memories.map(mem => {
                  const categoryLabels = {
                    user_preference: { label: 'Tercih', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                    personal_fact: { label: 'Profil', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                    work_context: { label: 'Bağlam', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    instruction: { label: 'Talimat', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
                  };
                  const cat = categoryLabels[mem.category] || categoryLabels.user_preference;

                  return (
                    <div 
                      key={mem.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        mem.isPinned 
                          ? 'bg-slate-800/60 border-indigo-500/40 shadow-sm' 
                          : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
                            {cat.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePinMemory(mem)}
                              className={`p-1 rounded transition-colors ${
                                mem.isPinned ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title={mem.isPinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMemory(mem.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Hafıza Maddesini Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-semibold text-slate-100 mb-1.5">
                          {mem.key}
                        </h4>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {mem.value}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span>Aktif Hatırlanıyor</span>
                        <span>{new Date(mem.updatedAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BACKUP & PERSISTENCE */}
          {activeTab === 'backup' && (
            <div className="p-8 h-full overflow-y-auto space-y-6 max-w-3xl mx-auto">
              
              {/* Storage Persistence Box */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${isPersisted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        Tarayıcı Kalıcı Bellek Durumu
                        {isPersisted ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Aktif & Kalıcı
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Standart (Temizlenebilir)
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {isPersisted 
                          ? 'Tarayıcınız bu uygulamanın depolama alanını "Kalıcı" olarak kilitledi. Sohbetleriniz 2-3 gün sonra silinmez.' 
                          : 'Tarayıcı optimizasyonları nedeniyle veriler birkaç gün sonra temizlenebilir. Aşağıdaki butondan kalıcılığı kilitleyin.'}
                      </p>
                    </div>
                  </div>

                  {!isPersisted && (
                    <button
                      onClick={handleRequestPersistence}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-sm shrink-0"
                    >
                      Kalıcılığı Kilitle
                    </button>
                  )}
                </div>

                {storageUsage.usageMB !== undefined && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                    <span>Kullanılan Alan: <strong className="text-slate-200">{storageUsage.usageMB} MB</strong></span>
                    {storageUsage.quotaMB && <span>Toplam Kota: <strong className="text-slate-200">~{storageUsage.quotaMB} MB</strong></span>}
                  </div>
                )}
              </div>

              {/* Backup & Restore Box */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-400" />
                  Yedekleme ve Geri Yükleme
                </h3>
                <p className="text-xs text-slate-400">
                  Tüm sohbet geçmişinizi, dosyalarınızı ve yapay zeka hafıza kurallarınızı tek bir JSON dosyası olarak bilgisayarınıza indirin veya geri yükleyin.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={handleExportBackup}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-medium transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    Tüm Verileri JSON Olarak İndir
                  </button>

                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-medium transition-all shadow-sm cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    JSON Yedeği Yükle / Geri Getir
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
