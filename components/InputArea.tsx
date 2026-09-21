import React, { useState, useRef, useEffect } from 'react';
import { 
  Paperclip, 
  Mic, 
  MicOff, 
  Send, 
  Square, 
  Bot, 
  Sparkles, 
  X, 
  FileText, 
  Code, 
  Table, 
  Compass, 
  BarChart3, 
  Layers
} from 'lucide-react';
import { Attachment, AgentSpecialty } from '../types';
import * as XLSX from 'xlsx';

interface InputAreaProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  isAgentMode: boolean;
  setIsAgentMode: (enabled: boolean) => void;
  agentSpecialty: AgentSpecialty;
  setAgentSpecialty: (specialty: AgentSpecialty) => void;
}

// Support for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration,
  isAgentMode,
  setIsAgentMode,
  agentSpecialty,
  setAgentSpecialty
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const specialties: { id: AgentSpecialty; label: string; icon: any }[] = [
    { id: 'general', label: 'Genel Otonom', icon: Layers },
    { id: 'research', label: 'Derin Araştırma', icon: Compass },
    { id: 'coder', label: 'Yazılım & Kod', icon: Code },
    { id: 'analyst', label: 'Veri Analiz', icon: BarChart3 },
  ];

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'tr-TR';

        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);

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
          console.warn("Ses tanıma uyarısı:", event.error);
          setIsListening(false);
        };
      } catch (e) {
        console.warn("Speech recognition init failed:", e);
      }
    }
  }, []);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!recognitionRef.current) {
      alert("Sesli giriş bu tarayıcıda desteklenmiyor.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // already started
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      await processFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readExcelAsCSV = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          let combinedText = "";
          workbook.SheetNames.forEach((sheetName: string) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            combinedText += `--- Sayfa: ${sheetName} ---\n${csv}\n\n`;
          });
          resolve(combinedText);
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
        else if (['json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'html', 'css', 'md', 'txt', 'xml', 'csv', 'sql', 'sh'].includes(extension || '')) {
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
        // 3. PDF & Images
        else {
          const base64Data = await readFileAsBase64(file);
          const rawBase64 = base64Data.split(',')[1];
          
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
        console.error("Dosya okuma hatası:", err);
        alert(`Dosya yüklenemedi: ${file.name}`);
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

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: File[] = Array.from(e.dataTransfer.files);
      await processFiles(files);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const renderFilePreview = (att: Attachment) => {
    if (att.mimeType.startsWith('image/')) {
      return (
        <img 
          src={`data:${att.mimeType};base64,${att.data}`} 
          alt={att.name} 
          className="w-full h-full object-cover rounded-lg" 
        />
      );
    }
    if (att.mimeType.includes('csv') || att.mimeType.includes('sheet')) {
      return <Table className="w-4 h-4 text-emerald-400" />;
    }
    if (att.mimeType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    return <Code className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div 
      className="w-full max-w-4xl mx-auto p-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Bar: Agent Mode & Specialty Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2">
        
        {/* Agent Mode Toggle Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAgentMode(!isAgentMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              isAgentMode 
                ? 'bg-indigo-600 border-indigo-500 text-white ring-2 ring-indigo-500/20' 
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Bot className={`w-3.5 h-3.5 ${isAgentMode ? 'text-white' : 'text-indigo-400'}`} />
            <span>Agent Modu: {isAgentMode ? 'Aktif' : 'Kapalı'}</span>
            <span className={`w-2 h-2 rounded-full ${isAgentMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          </button>

          {/* Specialty Selector Chips (When in Agent Mode) */}
          {isAgentMode && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 animate-in fade-in">
              {specialties.map(s => {
                const Icon = s.icon;
                const isSelected = agentSpecialty === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setAgentSpecialty(s.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                      isSelected 
                        ? 'bg-slate-800 text-indigo-300 border-indigo-500/50' 
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Hint */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Kalıcı Hafıza & Gemini 3.7</span>
        </div>
      </div>

      {/* File Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2 animate-in fade-in">
          {attachments.map((att, index) => (
            <div 
              key={index} 
              className="relative group bg-slate-800/90 border border-slate-700/80 rounded-xl p-2 flex items-center gap-2 max-w-[220px] shadow-sm"
            >
              <div className="w-8 h-8 flex-shrink-0 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700">
                {renderFilePreview(att)}
              </div>
              <div className="flex flex-col min-w-0 pr-4">
                <span className="text-xs text-slate-200 truncate font-medium">{att.name}</span>
                <span className="text-[9px] text-slate-400 truncate uppercase font-mono">{att.mimeType.split('/')[1] || 'DOSYA'}</span>
              </div>
              <button 
                onClick={() => removeAttachment(index)}
                className="absolute top-1 right-1 text-slate-400 hover:text-rose-400 p-1 transition-colors"
                title="Kaldır"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <form 
        onSubmit={handleSubmit} 
        className={`relative flex items-end gap-2 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border transition-all shadow-xl ${
          isDragging 
            ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-900' 
            : isAgentMode 
              ? 'border-indigo-500/40 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20' 
              : 'border-slate-800 focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-700'
        }`}
      >
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
          className="p-2.5 rounded-xl transition-colors flex-shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
          title="Dosya Ekle (Görsel, PDF, Excel, Kod, Metin)"
          disabled={isLoading}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isAgentMode 
              ? `${specialties.find(s => s.id === agentSpecialty)?.label || 'Agent'} modunda hedef veya görevinizi yazın...` 
              : "Mustafa AI'a bir soru sorun veya görev verin..."
          }
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm p-2 focus:outline-none resize-none max-h-[200px] overflow-y-auto"
          rows={1}
          disabled={isLoading}
        />
        
        {/* Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
            isListening 
              ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/40' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Sesli Konuşma (Türkçe)"
          disabled={isLoading}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send or Stop Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStopGeneration}
            className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors shadow-lg flex-shrink-0 flex items-center gap-1 text-xs font-semibold"
            title="Üretimi Durdur"
          >
            <Square className="w-4 h-4 fill-white" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() && attachments.length === 0}
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
              (!input.trim() && attachments.length === 0)
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
            title="Gönder"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
      
      <div className="text-center mt-2 text-[11px] text-slate-500 flex items-center justify-center gap-2">
        <span>Mustafa AI kalıcı hafızaya sahiptir ve sohbetlerinizi saklar.</span>
      </div>
    </div>
  );
};

export default InputArea;
