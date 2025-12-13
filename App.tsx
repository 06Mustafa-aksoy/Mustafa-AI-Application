import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatSession, Attachment } from './types';
import { generateContentStream } from './services/gemini';
import { saveSessionsToDB, loadSessionsFromDB } from './services/storage';
import ChatMessage from './components/ChatMessage';
import InputArea from './components/InputArea';
import SettingsPanel from './components/SettingsPanel';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  // State for multiple sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);

  // ID of the currently active session. Null means we are in "New Chat" mode.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived state: current messages
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load sessions from IndexedDB on mount
  useEffect(() => {
    const initStorage = async () => {
      try {
        let loadedSessions = await loadSessionsFromDB();
        
        // Migration check for very old localStorage data if DB is empty
        if (loadedSessions.length === 0) {
           const localSessions = localStorage.getItem('gemini_sessions');
           if (localSessions) {
             try {
               const parsed = JSON.parse(localSessions);
               if (Array.isArray(parsed) && parsed.length > 0) {
                 loadedSessions = parsed;
                 // Save to DB immediately to persist migration
                 await saveSessionsToDB(loadedSessions);
               }
             } catch (e) { /* ignore */ }
           }
        }

        setSessions(loadedSessions);
        
        // Restore last active session if available
        if (loadedSessions.length > 0) {
           setCurrentSessionId(loadedSessions[loadedSessions.length - 1].id);
        }
      } catch (error) {
        console.error("Storage initialization failed:", error);
      } finally {
        setIsStorageInitialized(true);
      }
    };

    initStorage();
  }, []);

  // Persist sessions to IndexedDB when they change (Debounced)
  useEffect(() => {
    if (!isStorageInitialized) return;

    // Save changes with a shorter debounce to prevent data loss on tab close
    const timeoutId = setTimeout(() => {
      saveSessionsToDB(sessions).catch(e => console.error("Failed to save sessions", e));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sessions, isStorageInitialized]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setIsLoading(false);
    setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prevSessions => prevSessions.map(session => 
      session.id === id ? { ...session, title: newTitle } : session
    ));
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    let activeSessionId = currentSessionId;
    let currentHistory = messages; // This is the history BEFORE the new message
    let newSessions = [...sessions];

    // If no active session, create one now
    if (!activeSessionId) {
      const titleText = text || (attachments.length > 0 ? `Image Analysis` : 'New Chat');
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: titleText.slice(0, 30) + (titleText.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
      };
      activeSessionId = newSession.id;
      newSessions.push(newSession);
      setSessions(newSessions); 
      setCurrentSessionId(activeSessionId);
      currentHistory = [];
    }

    // Add user message to state
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      attachments: attachments,
      timestamp: Date.now(),
    };

    // This is the history including the user message, for UI display
    const updatedHistoryForUI = [...currentHistory, userMessage];

    // Update sessions state with user message
    setSessions(prevSessions => prevSessions.map(session => 
      session.id === activeSessionId 
        ? { ...session, messages: updatedHistoryForUI }
        : session
    ));

    setIsLoading(true);

    try {
      // Use the streaming generator
      const stream = generateContentStream(text, attachments, currentHistory, { thinkingBudget });
      
      let accumulatedText = "";
      let aiMessageId = (Date.now() + 1).toString();
      let isFirstChunk = true;

      for await (const chunk of stream) {
        accumulatedText += chunk;

        if (isFirstChunk) {
            isFirstChunk = false;
            // Append the new AI message with the first chunk
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
            // Update the existing AI message text
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
      
    } catch (error: any) {
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
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        
        {/* Header */}
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
                <h1 className="text-lg font-semibold tracking-tight text-white group-hover:text-cyan-400 transition-colors">Mustafa AI uygulaması</h1>
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

        {/* Chat Area */}
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
                  Experience the reasoning capabilities of Gemini 3 Pro. Try asking complex questions or adjusting the thinking budget in settings.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  <button 
                    onClick={() => handleSendMessage("Explain how AI works in a few words")}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all duration-200 group"
                  >
                    <span className="block font-medium text-slate-200 mb-1 group-hover:text-cyan-400">Explain AI</span>
                    <span className="block text-sm text-slate-500">How does artificial intelligence work?</span>
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Write a short story about a robot who loves painting")}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all duration-200 group"
                  >
                    <span className="block font-medium text-slate-200 mb-1 group-hover:text-cyan-400">Creative Writing</span>
                    <span className="block text-sm text-slate-500">Story about a painting robot</span>
                  </button>
                   <button 
                    onClick={() => handleSendMessage("Analyze the pros and cons of remote work for improved productivity")}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all duration-200 group"
                  >
                    <span className="block font-medium text-slate-200 mb-1 group-hover:text-cyan-400">Complex Reasoning</span>
                    <span className="block text-sm text-slate-500">Remote work analysis</span>
                  </button>
                   <button 
                    onClick={() => handleSendMessage("Help me debug this Python code: \n\ndef fib(n):\n  if n <= 1: return n\n  else: return fib(n-1) + fib(n-2)")}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all duration-200 group"
                  >
                    <span className="block font-medium text-slate-200 mb-1 group-hover:text-cyan-400">Coding Help</span>
                    <span className="block text-sm text-slate-500">Debug a Fibonacci function</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                
                {/* 
                  Thinking Indicator:
                  Displays when loading and the model has not yet responded (last message is User).
                  Disappears automatically when the model's message starts streaming.
                */}
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div className="flex w-full mb-6 justify-start">
                     <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-none px-5 py-4 bg-slate-800 border border-slate-700 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                            </div>
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

        {/* Input Area */}
        <div className="flex-none bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-6 pb-2 px-4">
           <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsPanel 
        thinkingBudget={thinkingBudget}
        setThinkingBudget={setThinkingBudget}
        isOpen={isSettingsOpen}
        toggleOpen={() => setIsSettingsOpen(!isSettingsOpen)}
      />
      
      {/* Overlay for mobile settings */}
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