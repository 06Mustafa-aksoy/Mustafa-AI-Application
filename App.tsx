import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatSession, Attachment, AgentSpecialty, MemoryItem } from './types';
import { generateContentStream } from './services/gemini';
import { 
  loadSessionsFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB,
  loadMemoriesFromDB,
  saveMemoryToDB,
  deleteMemoryFromDB,
  requestStoragePersistence
} from './services/storage';
import ChatMessage from './components/ChatMessage';
import InputArea from './components/InputArea';
import SettingsPanel from './components/SettingsPanel';
import Sidebar from './components/Sidebar';
import { MemoryAndHistoryModal } from './components/MemoryAndHistoryModal';
import ApiKeyModal from './components/ApiKeyModal';
import { 
  Bot, 
  Sparkles, 
  Brain, 
  History, 
  ShieldCheck, 
  Sliders, 
  Code, 
  Compass, 
  BarChart3, 
  Layers, 
  Menu, 
  Plus,
  ArrowRight,
  Key
} from 'lucide-react';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Agent & Model Settings
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentSpecialty, setAgentSpecialty] = useState<AgentSpecialty>('general');

  // Custom Gemini API Key (persisted securely in browser's localStorage)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('gemini_custom_api_key') || '';
    } catch {
      return '';
    }
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const handleSaveApiKey = (newKey: string) => {
    const trimmed = newKey.trim();
    setCustomApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('gemini_custom_api_key', trimmed);
      } else {
        localStorage.removeItem('gemini_custom_api_key');
      }
    } catch (e) {
      console.error("LocalStorage save error:", e);
    }
  };

  const handleRemoveApiKey = () => {
    setCustomApiKey('');
    try {
      localStorage.removeItem('gemini_custom_api_key');
    } catch (e) {
      console.error("LocalStorage remove error:", e);
    }
  };
  
  // UI Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryModalTab, setMemoryModalTab] = useState<'history' | 'memory' | 'backup'>('history');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 1. Initial Storage & Memory Loading
  useEffect(() => {
    const initAppStorage = async () => {
      try {
        // Request persistent storage so browser does NOT purge data 2-3 days later
        await requestStoragePersistence();

        // Load chat sessions
        let loadedSessions = await loadSessionsFromDB();
        
        // Migration fallback from localStorage if IndexedDB was clean
        if (loadedSessions.length === 0) {
          const localSessions = localStorage.getItem('gemini_sessions');
          if (localSessions) {
            try {
              const parsed = JSON.parse(localSessions);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedSessions = parsed;
                for (const s of loadedSessions) {
                  await saveSessionToDB(s);
                }
              }
            } catch (e) { /* ignore */ }
          }
        }

        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          setCurrentSessionId(loadedSessions[0].id);
        }

        // Load long-term memory items
        const loadedMemories = await loadMemoriesFromDB();
        setMemories(loadedMemories);

      } catch (error) {
        console.error("Storage initialization error:", error);
      } finally {
        setIsStorageInitialized(true);
      }
    };

    initAppStorage();
  }, []);

  const handleNewChat = () => {
    // Abort current stream if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentSessionId(null);
    setIsLoading(false);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    }
    await deleteSessionFromDB(id);
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    let updatedSession: ChatSession | undefined;
    
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === id) {
        updatedSession = { ...session, title: newTitle, updatedAt: Date.now() };
        return updatedSession;
      }
      return session;
    }));

    if (updatedSession) {
      await saveSessionToDB(updatedSession);
    }
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleOpenMemoryHub = (tab: 'history' | 'memory' | 'backup' = 'history') => {
    setMemoryModalTab(tab);
    setIsMemoryModalOpen(true);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // --- SEND MESSAGE WITH AGENT MODE & PERSISTENT MEMORY ---
  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    let activeSessionId = currentSessionId;
    let currentHistory = messages; 
    let workingSession: ChatSession | undefined;

    // 1. Create New Chat Session if not exists
    if (!activeSessionId) {
      const defaultTitle = text.trim() 
        ? text.slice(0, 32) + (text.length > 32 ? '...' : '') 
        : (attachments.length > 0 ? `Görsel / Dosya Analizi` : (isAgentMode ? `Agent Görevi` : `Yeni Sohbet`));

      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: defaultTitle,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      activeSessionId = newSession.id;
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(activeSessionId);
      currentHistory = [];
      workingSession = newSession;
      
      await saveSessionToDB(newSession);
    } else {
      workingSession = sessions.find(s => s.id === activeSessionId);
    }

    // 2. Add User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      attachments: attachments,
      timestamp: Date.now(),
    };

    const updatedHistoryForUI = [...currentHistory, userMessage];

    // Update state
    setSessions(prevSessions => prevSessions.map(session => 
      session.id === activeSessionId 
        ? { ...session, messages: updatedHistoryForUI, updatedAt: Date.now() }
        : session
    ));

    // Update DB
    if (workingSession) {
      await saveSessionToDB({
        ...workingSession,
        id: activeSessionId!,
        messages: updatedHistoryForUI,
        updatedAt: Date.now()
      });
    }

    setIsLoading(true);

    // Setup abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 3. Initiate Gemini Stream with Agent Mode, Memory and optional Custom API Key
      const stream = generateContentStream(
        text, 
        attachments, 
        currentHistory, 
        { 
          thinkingBudget, 
          isAgentMode, 
          agentSpecialty,
          memories,
          signal: abortController.signal,
          customApiKey: customApiKey ? customApiKey.trim() : undefined
        }
      );
      
      let accumulatedText = "";
      let aiMessageId = (Date.now() + 1).toString();
      let isFirstChunk = true;

      for await (const chunk of stream) {
        accumulatedText += chunk;

        if (isFirstChunk) {
          isFirstChunk = false;
          const aiMessage: Message = {
            id: aiMessageId,
            role: 'model',
            text: accumulatedText,
            timestamp: Date.now(),
            isAgent: isAgentMode,
            agentSpecialty: isAgentMode ? agentSpecialty : undefined
          };
          
          setSessions(prevSessions => prevSessions.map(session => 
            session.id === activeSessionId 
              ? { ...session, messages: [...updatedHistoryForUI, aiMessage], updatedAt: Date.now() }
              : session
          ));
        } else {
          setSessions(prevSessions => prevSessions.map(session => 
            session.id === activeSessionId 
              ? { 
                  ...session, 
                  updatedAt: Date.now(),
                  messages: session.messages.map(m => 
                    m.id === aiMessageId ? { ...m, text: accumulatedText } : m
                  ) 
                }
              : session
          ));
        }
      }
      
      // 4. Save Final State to DB
      const finalAiMessage: Message = {
        id: aiMessageId,
        role: 'model',
        text: accumulatedText,
        timestamp: Date.now(),
        isAgent: isAgentMode,
        agentSpecialty: isAgentMode ? agentSpecialty : undefined
      };

      const currentSessionData = sessions.find(s => s.id === activeSessionId) || workingSession;
      
      const finalSessionState: ChatSession = {
        id: activeSessionId!,
        title: currentSessionData?.title || (text.slice(0, 30) + '...'),
        createdAt: currentSessionData?.createdAt || Date.now(),
        messages: [...updatedHistoryForUI, finalAiMessage],
        updatedAt: Date.now()
      };

      await saveSessionToDB(finalSessionState);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Kullanıcı tarafından durduruldu.");
      } else {
        console.error("Gemini çağrı hatası:", error);
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'model',
          text: error.message || "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.",
          timestamp: Date.now(),
          isError: true,
        };
        
        setSessions(prevSessions => prevSessions.map(session => 
          session.id === activeSessionId 
            ? { ...session, messages: [...updatedHistoryForUI, errorMessage], updatedAt: Date.now() }
            : session
        ));

        if (activeSessionId) {
          const latestSession = sessions.find(s => s.id === activeSessionId) || workingSession;
          if (latestSession) {
            await saveSessionToDB({
              ...latestSession,
              messages: [...updatedHistoryForUI, errorMessage],
              updatedAt: Date.now()
            });
          }
        }
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Quick Starter Prompts
  const quickStarters = [
    {
      title: 'Genel Agent & Görev',
      desc: 'Hedefi belirle, adımları planla ve otonom yürüt.',
      prompt: 'Sen benim otonom yapay zeka asistanımsın. Bana bir sonraki projem için adım adım bir yol haritası ve strateji hazırla.',
      icon: Layers,
      specialty: 'general' as AgentSpecialty
    },
    {
      title: 'Derin Araştırma',
      desc: 'Detaylı akademik ve teknik araştırma raporu hazırla.',
      prompt: 'Yapay zekadaki en yeni akıl yürütme (reasoning) ve agent mimarileri hakkında derinlemesine bir analiz ve özet hazırla.',
      icon: Compass,
      specialty: 'research' as AgentSpecialty
    },
    {
      title: 'Yazılım & Kod Mimarisi',
      desc: 'Üretim standardında kod, mimari ve optimizasyon.',
      prompt: 'React 19 ve TypeScript kullanarak yüksek performanslı bir veri tablosu mimarisi ve state yönetimi planla.',
      icon: Code,
      specialty: 'coder' as AgentSpecialty
    },
    {
      title: 'Veri & Tablo Analizi',
      desc: 'Excel / CSV dosyalarını incele ve öngörü çıkar.',
      prompt: 'Veri setlerindeki anomalileri ve büyüme trendlerini bulmak için hangi adımları izlemeliyim?',
      icon: BarChart3,
      specialty: 'analyst' as AgentSpecialty
    },
  ];

  if (!isStorageInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-sm">Mustafa AI & Kalıcı Hafıza Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenMemoryHub={handleOpenMemoryHub}
      />

      {/* Main Chat Layout */}
      <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        
        {/* Header */}
        <header className="flex-none h-16 border-b border-slate-800/80 flex items-center justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Menüyü Aç"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={handleNewChat}
              title="Yeni Sohbet Başlat"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                  <span>Mustafa AI</span>
                  {isAgentMode && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      AGENT
                    </span>
                  )}
                </h1>
                <p className="text-[10px] text-slate-400">Gemini 3.7 Flash • Kalıcı Hafıza</p>
              </div>
            </div>
          </div>
          
          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* API Key Modal Button */}
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                customApiKey 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/60 shadow-xs' 
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
              title="Kendi Google Gemini API Anahtarınızı Tanımlayın veya Yönetin"
            >
              <Key className={`w-3.5 h-3.5 ${customApiKey ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="hidden sm:inline">
                {customApiKey ? 'API Key Aktif' : 'API Key'}
              </span>
              {customApiKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Memory & History Preview Hub Button */}
            <button
              onClick={() => handleOpenMemoryHub('history')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Sohbet Önizleme & Hafıza Merkezi"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Geçmiş & Hafıza</span>
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yeni Sohbet</span>
            </button>

            {/* Settings Trigger */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
              title="Model ve Agent Ayarları"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Chat History View Area */}
        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
            {messages.length === 0 ? (
              
              /* Empty State: Welcome and Quick Starter Cards */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-2 animate-in fade-in">
                
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-indigo-900/20">
                  <Bot className="w-8 h-8 text-indigo-400" />
                </div>
                
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Mustafa AI Asistanına Hoş Geldiniz
                </h2>
                
                <p className="text-slate-400 max-w-md text-xs sm:text-sm mb-6 leading-relaxed">
                  Kalıcı hafıza sayesinde sohbetleriniz ve tercihleriniz asla kaybolmaz. Agent modu ve yüksek hızlı Gemini 3.7 modelleriyle dilediğiniz görevi verin.
                </p>

                {/* Quick Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                  {quickStarters.map((starter, idx) => {
                    const Icon = starter.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsAgentMode(true);
                          setAgentSpecialty(starter.specialty);
                          handleSendMessage(starter.prompt);
                        }}
                        className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl transition-all group shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                              <Icon className="w-4 h-4" />
                            </div>
                            <h3 className="font-semibold text-xs text-white group-hover:text-indigo-300 transition-colors">
                              {starter.title}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {starter.desc}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-indigo-400 mt-3 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Başlat</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Long-Term Memory Summary Pill */}
                <div className="mt-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kalıcı Depolama Aktif • {memories.length} Hafıza Maddesi Tanımlı</span>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                  />
                ))}
                
                {/* Thinking / Agent Processing Indicator */}
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div className="flex w-full mb-6 justify-start animate-in fade-in">
                    <div className="flex-shrink-0 mr-3 mt-1">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md animate-pulse">
                        <Bot className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tl-sm px-5 py-4 bg-slate-900 border border-slate-800 shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                        <span className="text-slate-300 text-xs font-medium">
                          {isAgentMode ? 'Agent akıl yürütüyor ve adımları planlıyor...' : 'Mustafa AI düşünüyor ve yanıt hazırlıyor...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </main>

        {/* Input Bar Area */}
        <div className="flex-none bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-4 pb-2 px-4">
          <InputArea 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading}
            onStopGeneration={handleStopGeneration}
            isAgentMode={isAgentMode}
            setIsAgentMode={setIsAgentMode}
            agentSpecialty={agentSpecialty}
            setAgentSpecialty={setAgentSpecialty}
          />
        </div>
      </div>

      {/* Model & Agent Settings Drawer */}
      <SettingsPanel 
        thinkingBudget={thinkingBudget}
        setThinkingBudget={setThinkingBudget}
        isAgentMode={isAgentMode}
        setIsAgentMode={setIsAgentMode}
        agentSpecialty={agentSpecialty}
        setAgentSpecialty={setAgentSpecialty}
        isOpen={isSettingsOpen}
        toggleOpen={() => setIsSettingsOpen(!isSettingsOpen)}
        onOpenMemoryHub={handleOpenMemoryHub}
        memoryCount={memories.length}
        customApiKey={customApiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Persistent Memory & History Preview Modal */}
      <MemoryAndHistoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId || ''}
        onSelectSession={(id) => {
          handleSelectSession(id);
          setIsMemoryModalOpen(false);
        }}
        onDeleteSession={(id) => handleDeleteSession(id)}
        memories={memories}
        onUpdateMemories={(newMemories) => setMemories(newMemories)}
        initialTab={memoryModalTab}
      />

      {/* Secure Gemini API Key Modal */}
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={customApiKey}
        onSaveApiKey={handleSaveApiKey}
        onRemoveApiKey={handleRemoveApiKey}
      />
    </div>
  );
};

export default App;
