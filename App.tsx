import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatSession, Attachment } from './types';
import { generateContentStream } from './services/gemini';
// Dikkat: Artık tekil fonksiyonları import ediyoruz
import { loadSessionsFromDB, saveSessionToDB, deleteSessionFromDB } from './services/storage';
import ChatMessage from './components/ChatMessage';
import InputArea from './components/InputArea';
import SettingsPanel from './components/SettingsPanel';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 1. Uygulama açılışında verileri yükle
  useEffect(() => {
    const initStorage = async () => {
      try {
        let loadedSessions = await loadSessionsFromDB();
        
        // Migration: Eğer DB boşsa ve LocalStorage varsa kurtar
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
      } catch (error) {
        console.error("Başlatma hatası:", error);
      } finally {
        setIsStorageInitialized(true);
      }
    };

    initStorage();
  }, []);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setIsLoading(false);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
    await deleteSessionFromDB(id);
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    let updatedSession: ChatSession | undefined;
    
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === id) {
        updatedSession = { ...session, title: newTitle };
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

  // --- DÜZELTİLMİŞ MESAJ GÖNDERME FONKSİYONU ---
  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    let activeSessionId = currentSessionId;
    let currentHistory = messages; 
    let workingSession: ChatSession | undefined;

    // 1. Yeni Chat Oluşturma (Gerekirse)
    if (!activeSessionId) {
      const titleText = text || (attachments.length > 0 ? `Image Analysis` : 'New Chat');
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: titleText.slice(0, 30) + (titleText.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      activeSessionId = newSession.id;
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(activeSessionId);
      currentHistory = [];
      workingSession = newSession;
      
      // Hemen kaydet
      await saveSessionToDB(newSession);
    } else {
        workingSession = sessions.find(s => s.id === activeSessionId);
    }

    // 2. Kullanıcı Mesajını Ekle
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      attachments: attachments,
      timestamp: Date.now(),
    };

    const updatedHistoryForUI = [...currentHistory, userMessage];

    // State Güncelle
    setSessions(prevSessions => prevSessions.map(session => 
      session.id === activeSessionId 
        ? { ...session, messages: updatedHistoryForUI, updatedAt: Date.now() }
        : session
    ));

    // DB Güncelle
    if (workingSession) {
        await saveSessionToDB({
            ...workingSession,
            id: activeSessionId!,
            messages: updatedHistoryForUI,
            updatedAt: Date.now()
        });
    }

    setIsLoading(true);

    try {
      // 3. Gemini Yanıtını Başlat
      const stream = generateContentStream(text, attachments, currentHistory, { thinkingBudget });
      
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
            };
            
            setSessions(prevSessions => prevSessions.map(session => 
                session.id === activeSessionId 
                ? { ...session, messages: [...updatedHistoryForUI, aiMessage] }
                : session
            ));
        } else {
             setSessions(prevSessions => prevSessions.map(session => 
                session.id === activeSessionId 
                ? { 
                    ...session, 
                    messages: session.messages.map(m => 
                        m.id === aiMessageId ? { ...m, text: accumulatedText } : m
                    ) 
                  }
                : session
            ));
        }
      }
      
      // 4. BİTİŞ - SON HALİNİ DB'YE KAYDET
      const finalAiMessage: Message = {
          id: aiMessageId,
          role: 'model',
          text: accumulatedText,
          timestamp: Date.now()
      };

      const currentSessionData = sessions.find(s => s.id === activeSessionId) || workingSession;
      
      const finalSessionState: ChatSession = {
          id: activeSessionId!,
          title: currentSessionData?.title || 'Chat',
          createdAt: currentSessionData?.createdAt || Date.now(),
          messages: [...updatedHistoryForUI, finalAiMessage],
          updatedAt: Date.now()
      };

      // İşte burası eskiden çalışmıyordu, şimdi çalışacak:
      await saveSessionToDB(finalSessionState);

    } catch (error: any) {
      console.error("Hata:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'model',
        text: error.message || "Sorry, something went wrong.",
        timestamp: Date.now(),
        isError: true,
      };
      
      setSessions(prevSessions => prevSessions.map(session => 
        session.id === activeSessionId 
          ? { ...session, messages: [...updatedHistoryForUI, errorMessage] }
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
    } finally {
      setIsLoading(false);
    }
  };

  if (!isStorageInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        <header className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-slate-900/90 backdrop-blur z-20">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
             </button>

            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={handleNewChat}
              title="Start New Chat"
            >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/50 group-hover:shadow-cyan-500/50 transition-shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-white group-hover:text-cyan-400 transition-colors">Mustafa AI</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button
              onClick={handleNewChat}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-medium">New Chat</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-black/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-cyan-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">How can I help you today?</h2>
                <p className="text-slate-400 max-w-md mb-8">
                  Experience the reasoning capabilities of Gemini 3 Pro.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                   {/* Butonlar burada */}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div className="flex w-full mb-6 justify-start">
                     <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-none px-5 py-4 bg-slate-800 border border-slate-700 shadow-md">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-300 text-sm font-medium animate-pulse">Thinking...</span>
                        </div>
                     </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </main>
        <div className="flex-none bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-6 pb-2 px-4">
           <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
      <SettingsPanel 
        thinkingBudget={thinkingBudget}
        setThinkingBudget={setThinkingBudget}
        isOpen={isSettingsOpen}
        toggleOpen={() => setIsSettingsOpen(!isSettingsOpen)}
      />
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
