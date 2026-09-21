import React, { useState } from 'react';
import { 
  Bot, 
  User, 
  Copy, 
  Check, 
  FileText, 
  Code, 
  Compass, 
  BarChart3, 
  Layers, 
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Key
} from 'lucide-react';
import { Message } from '../types';
import { marked } from 'marked';

interface ChatMessageProps {
  message: Message;
  onOpenApiKeyModal?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onOpenApiKeyModal }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.isError;
  
  const timeString = new Date(message.timestamp).toLocaleTimeString('tr-TR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Kopyalama hatası:", e);
    }
  };

  const renderContent = () => {
    try {
      const html = marked.parse(message.text || '');
      return { __html: html as string };
    } catch (e) {
      return { __html: message.text };
    }
  };

  const getSpecialtyBadge = () => {
    if (!message.isAgent) return null;
    const specialty = message.agentSpecialty || 'general';
    switch (specialty) {
      case 'research':
        return { label: 'Agent: Araştırma', icon: Compass, color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
      case 'coder':
        return { label: 'Agent: Yazılım & Kod', icon: Code, color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' };
      case 'analyst':
        return { label: 'Agent: Veri Analiz', icon: BarChart3, color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
      default:
        return { label: 'Agent: Otonom', icon: Layers, color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' };
    }
  };

  const agentBadge = getSpecialtyBadge();

  return (
    <div className={`flex w-full mb-6 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      
      {/* Model Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${
            isError 
              ? 'bg-rose-950/80 text-rose-400 border border-rose-800' 
              : message.isAgent 
                ? 'bg-indigo-600 text-white shadow-indigo-500/20' 
                : 'bg-slate-800 text-indigo-400 border border-slate-700'
          }`}>
            {isError ? (
              <AlertTriangle className="w-4 h-4" />
            ) : message.isAgent ? (
              <Bot className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[88%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Agent Specialty Header */}
        {!isUser && agentBadge && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${agentBadge.color}`}>
              {React.createElement(agentBadge.icon, { className: 'w-3 h-3' })}
              {agentBadge.label}
            </span>
          </div>
        )}

        <div className={`
          relative px-5 py-4 rounded-2xl shadow-sm overflow-hidden text-left
          ${isUser 
            ? 'bg-indigo-600 text-white rounded-tr-sm' 
            : isError 
              ? 'bg-rose-950/30 border border-rose-500/30 text-rose-100 rounded-tl-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm'
          }
        `}>
          
          {/* Attachments Display */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-white/10">
              {message.attachments.map((att, i) => {
                const isImg = att.mimeType.startsWith('image/');
                return (
                  <div key={i} className="flex items-center gap-2 bg-black/25 rounded-xl p-2 max-w-full border border-white/5">
                    <div className="w-8 h-8 flex-shrink-0 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                      {isImg ? (
                        <img 
                          src={`data:${att.mimeType};base64,${att.data}`} 
                          alt={att.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden min-w-0 pr-1">
                      <span className="text-xs font-medium truncate max-w-[160px]">{att.name}</span>
                      <span className="text-[9px] opacity-70 uppercase font-mono">{att.mimeType.split('/')[1] || 'DOSYA'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Content */}
          <div 
            className={`prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed break-words
              prose-p:my-2 
              prose-headings:text-white prose-headings:font-semibold
              prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-pre:p-3.5 prose-pre:rounded-xl
              prose-code:bg-white/10 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[11px]
              prose-code:before:content-none prose-code:after:content-none
              prose-table:border-collapse prose-th:border prose-th:border-slate-700 prose-th:p-2 prose-td:border prose-td:border-slate-800 prose-td:p-2
              ${isUser ? 'prose-headings:text-white prose-p:text-white prose-strong:text-white' : 'text-slate-200'}
            `}
            dangerouslySetInnerHTML={renderContent()}
          />

          {/* Prompt to configure API key if error or system notification is present */}
          {(isError || message.text.includes('Gemini API') || message.text.includes('API anahtarı')) && onOpenApiKeyModal && (
            <div className="mt-3 pt-2.5 border-t border-white/10">
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-sm transition-all"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Kendi Gemini API Anahtarınızı Tanımlayın</span>
              </button>
            </div>
          )}

          {/* Grounding Sources (if any) */}
          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 text-[10px]">
              <span className="text-slate-400">Kaynaklar:</span>
              {message.groundingSources.map((source, sIdx) => (
                <a 
                  key={sIdx} 
                  href={source.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {source.title}
                </a>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer: Time & Action Buttons */}
        <div className="flex items-center gap-2 mt-1.5 px-1 text-[10px] text-slate-500">
          <span>{timeString}</span>
          
          {!isUser && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-opacity p-0.5"
              title="Mesajı Kopyala"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Kopyala</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 shadow-md">
            <User className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;

