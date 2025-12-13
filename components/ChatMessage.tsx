import React from 'react';
import { Message } from '../types';
import { marked } from 'marked';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;
  
  // Format time
  const timeString = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Render markdown safely
  const renderContent = () => {
    try {
      // Configure marked to not sanitize if we trust the output (Gemini output is generally safe markdown)
      // or rely on React's default behavior for innerHTML (which is what we do here)
      // Note: In a production app with untrusted user input reflected back, you'd want DOMPurify here.
      const html = marked.parse(message.text || '');
      return { __html: html as string };
    } catch (e) {
      return { __html: message.text };
    }
  };

  return (
     <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar for Model */}
        {!isUser && (
            <div className="flex-shrink-0 mr-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isError ? 'bg-red-900/50' : 'bg-gradient-to-br from-cyan-600 to-blue-700'} shadow-lg`}>
                    {isError ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-200">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    )}
                </div>
            </div>
        )}

        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
            
            <div className={`
                relative px-5 py-3.5 rounded-2xl shadow-sm overflow-hidden
                ${isUser 
                    ? 'bg-cyan-700 text-white rounded-tr-none' 
                    : isError 
                        ? 'bg-red-900/30 border border-red-500/30 text-red-100 rounded-tl-none'
                        : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-none'
                }
            `}>
                
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {message.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg p-2 max-w-full">
                                <div className="w-8 h-8 flex-shrink-0 bg-white/10 rounded flex items-center justify-center overflow-hidden">
                                    {att.mimeType.startsWith('image/') ? (
                                        <img src={`data:${att.mimeType};base64,${att.data}`} alt="att" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex flex-col overflow-hidden min-w-0">
                                    <span className="text-xs font-medium truncate max-w-[150px]">{att.name}</span>
                                    <span className="text-[10px] opacity-70 uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Text Content */}
                <div 
                    className={`prose prose-invert max-w-none 
                        prose-p:leading-relaxed 
                        prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-white/10 prose-pre:p-3 prose-pre:rounded-lg
                        prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
                        text-sm sm:text-base break-words 
                        ${isUser ? 'prose-headings:text-white prose-p:text-white prose-strong:text-white' : 'text-slate-100'}
                    `}
                    dangerouslySetInnerHTML={renderContent()}
                />
            </div>
            
            <span className="text-[10px] text-slate-500 mt-1 px-1">
                {timeString}
            </span>
        </div>

        {/* User Avatar */}
        {isUser && (
             <div className="flex-shrink-0 ml-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                </div>
            </div>
        )}
     </div>
  );
};

export default ChatMessage;
