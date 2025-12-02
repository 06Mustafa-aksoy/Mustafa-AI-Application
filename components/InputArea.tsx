import React, { useState, useRef, useEffect } from 'react';
import { Attachment } from '../types';

interface InputAreaProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
}

// Add support for the Web Speech API types and SheetJS
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    XLSX: any;
  }
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize SpeechRecognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');
        
        if (event.results[0].isFinal) {
           setInput(prev => (prev ? prev + ' ' : '') + transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await processFiles(files);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readExcelAsCSV = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
            const data = e.target?.result;
            if (window.XLSX) {
                const workbook = window.XLSX.read(data, { type: 'array' });
                let combinedText = "";
                // Read all sheets
                workbook.SheetNames.forEach((sheetName: string) => {
                    const sheet = workbook.Sheets[sheetName];
                    const csv = window.XLSX.utils.sheet_to_csv(sheet);
                    combinedText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
                });
                resolve(combinedText);
            } else {
                reject(new Error("XLSX library not loaded"));
            }
        } catch (error) {
            reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: File[]) => {
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      try {
        let attachment: Attachment;
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        // 1. Excel Support
        if (extension === 'xlsx' || extension === 'xls' || file.type.includes('sheet') || file.type.includes('excel')) {
             const csvContent = await readExcelAsCSV(file);
             const base64Content = btoa(unescape(encodeURIComponent(csvContent)));
             attachment = {
                 name: file.name,
                 mimeType: 'text/csv',
                 data: base64Content
             };
        } 
        // 2. Code & Text Support
        else if (['json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'html', 'css', 'md', 'txt', 'xml', 'csv'].includes(extension || '')) {
             const textContent = await readFileAsText(file);
             const base64Content = btoa(unescape(encodeURIComponent(textContent)));
             
             let mimeType = 'text/plain';
             if (extension === 'json') mimeType = 'application/json';
             else if (extension === 'xml') mimeType = 'application/xml';
             else if (extension === 'js' || extension === 'jsx') mimeType = 'text/javascript';
             else if (extension === 'ts' || extension === 'tsx') mimeType = 'text/typescript';
             else if (extension === 'py') mimeType = 'text/x-python';
             else if (extension === 'html') mimeType = 'text/html';
             else if (extension === 'css') mimeType = 'text/css';
             else if (extension === 'md') mimeType = 'text/markdown';
             else if (extension === 'csv') mimeType = 'text/csv';

             attachment = {
                 name: file.name,
                 mimeType: mimeType,
                 data: base64Content
             };
        }
        // 3. PDF & Images (Native Binary Support)
        else {
            const base64Data = await readFileAsBase64(file);
            const rawBase64 = base64Data.split(',')[1];
            
            // Explicitly handle PDF type if browser doesn't detect it perfectly
            let mimeType = file.type;
            if (extension === 'pdf' && !mimeType) mimeType = 'application/pdf';
            
            attachment = {
                name: file.name,
                mimeType: mimeType || 'application/octet-stream',
                data: rawBase64
            };
        }
        
        newAttachments.push(attachment);
      } catch (err) {
        console.error("Error reading file:", err);
        alert(`Failed to read file ${file.name}`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSendMessage(input, attachments);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      await processFiles(files);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('csv') || mimeType.includes('sheet')) return 'sheet';
    if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.startsWith('text/') || mimeType.includes('script')) return 'code';
    return 'default';
  };

  const renderFileIcon = (type: string) => {
    switch (type) {
        case 'pdf':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h.008v.008H9V13.5zm0 3h.008v.008H9V16.5zm0 3h.008v.008H9V19.5z" />
                </svg>
            );
        case 'sheet':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 1.5c0 .621.504 1.125 1.125 1.125M13.125 18.375v-1.5m0 1.5c0 .621.504 1.125 1.125 1.125M20.625 16.125v1.5c0 .621-.504 1.125-1.125 1.125" />
                </svg>
            );
        case 'code':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
            );
        default:
            return (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* File Preview Area */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {attachments.map((att, index) => {
             const iconType = getFileIcon(att.mimeType);
             return (
                <div key={index} className="relative group bg-slate-800 border border-slate-700 rounded-xl p-2 flex items-center gap-2 max-w-[200px]">
                <div className="w-8 h-8 flex-shrink-0 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                    {iconType === 'image' ? (
                    <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                    renderFileIcon(iconType)
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs text-slate-200 truncate font-medium">{att.name}</span>
                    <span className="text-[10px] text-slate-500 truncate uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                </div>
                <button 
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
                </div>
             );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-slate-800/80 backdrop-blur-sm p-2 rounded-2xl border border-slate-700 shadow-xl">
        <input 
          type="file" 
          multiple 
          ref={fileInputRef}
          className="hidden" 
          onChange={handleFileSelect}
        />
        
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-xl transition-all duration-200 flex-shrink-0 mb-[1px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          title="Add files (Images, PDF, Excel, Code, Text)"
          disabled={isLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask anything..."
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-base p-3 focus:outline-none resize-none max-h-[200px] overflow-y-auto rounded-xl"
          rows={1}
          disabled={isLoading}
        />
        
        {/* Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`
            p-3 rounded-xl transition-all duration-200 flex-shrink-0 mb-[1px]
            ${isListening 
              ? 'bg-red-500/20 text-red-400 animate-pulse' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }
          `}
          title="Voice Input"
          disabled={isLoading}
        >
          {isListening ? (
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!input.trim() && attachments.length === 0) || isLoading}
          className={`
            p-3 rounded-xl transition-all duration-200 flex-shrink-0 mb-[1px]
            ${(!input.trim() && attachments.length === 0) || isLoading 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'
            }
          `}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          )}
        </button>
      </form>
      <div className="text-center mt-2 text-xs text-slate-500">
        Gemini 3 Pro Preview can make mistakes. Consider checking important information.
      </div>
    </div>
  );
};

export default InputArea;