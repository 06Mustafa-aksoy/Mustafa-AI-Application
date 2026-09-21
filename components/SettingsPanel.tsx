import React from 'react';
import { 
  X, 
  Bot, 
  Brain, 
  Cpu, 
  Sparkles, 
  ShieldCheck, 
  Code, 
  Compass, 
  BarChart3, 
  Layers,
  Key
} from 'lucide-react';
import { AgentSpecialty } from '../types';

interface SettingsPanelProps {
  thinkingBudget: number;
  setThinkingBudget: (value: number) => void;
  isAgentMode: boolean;
  setIsAgentMode: (value: boolean) => void;
  agentSpecialty: AgentSpecialty;
  setAgentSpecialty: (specialty: AgentSpecialty) => void;
  isOpen: boolean;
  toggleOpen: () => void;
  onOpenMemoryHub: (tab?: 'history' | 'memory' | 'backup') => void;
  memoryCount: number;
  customApiKey?: string;
  onOpenApiKeyModal: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  thinkingBudget, 
  setThinkingBudget,
  isAgentMode,
  setIsAgentMode,
  agentSpecialty,
  setAgentSpecialty,
  isOpen,
  toggleOpen,
  onOpenMemoryHub,
  memoryCount,
  customApiKey,
  onOpenApiKeyModal
}) => {
  const specialties: { id: AgentSpecialty; label: string; icon: any; desc: string }[] = [
    { id: 'general', label: 'Genel Otonom', icon: Layers, desc: 'Çok yönlü adım adım problem çözme ve icraat.' },
    { id: 'research', label: 'Derin Araştırma', icon: Compass, desc: 'Kapsamlı bilgi taraması ve sentez.' },
    { id: 'coder', label: 'Yazılım & Mimari', icon: Code, desc: 'Üretim standardında kod, hata ayıklama ve mimari.' },
    { id: 'analyst', label: 'Veri & Analiz', icon: BarChart3, desc: 'Tablo analizi, veri işleme ve stratejik çıkarım.' },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
          onClick={toggleOpen}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-88 max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Yapay Zeka Ayarları</h2>
              <p className="text-[11px] text-slate-400">Model akıl yürütme & Agent modları</p>
            </div>
          </div>

          <button 
            onClick={toggleOpen}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
          
          {/* Agent Mode Section */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-white">Agent Modu</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAgentMode(!isAgentMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAgentMode ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isAgentMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Agent modu açıldığında yapay zeka sadece yanıt vermekle kalmaz; hedefleri belirler, aşamalı plan yapar ve otonom problem çözer.
            </p>

            {/* Specialty Selection */}
            {isAgentMode && (
              <div className="pt-2 space-y-2 border-t border-slate-700/50 animate-in fade-in">
                <label className="text-[11px] font-medium text-slate-300 block">Agent Uzmanlık Alanı</label>
                <div className="grid grid-cols-2 gap-2">
                  {specialties.map(s => {
                    const Icon = s.icon;
                    const isSelected = agentSpecialty === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setAgentSpecialty(s.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-indigo-950/60 border-indigo-500/50 text-white shadow-sm ring-1 ring-indigo-500/20' 
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                          <span className={isSelected ? 'text-indigo-200' : 'text-slate-300'}>{s.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                          {s.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Thinking Budget Control */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-cyan-400" />
                Düşünme Bütçesi (Thinking)
              </span>
              <span className="font-mono bg-slate-900 px-2 py-0.5 rounded-lg text-[11px] text-cyan-300 border border-slate-800">
                {thinkingBudget > 0 ? `${thinkingBudget} token` : 'Kapalı'}
              </span>
            </div>

            <input
              id="thinking-budget"
              type="range"
              min="0"
              max="32768"
              step="1024"
              value={thinkingBudget}
              onChange={(e) => setThinkingBudget(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              {[
                { label: 'Kapalı', value: 0 },
                { label: '2K Hızlı', value: 2048 },
                { label: '8K Standart', value: 8192 },
                { label: '16K Derin', value: 16384 },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setThinkingBudget(p.value)}
                  className={`flex-1 py-1 rounded-lg text-[10px] border transition-colors ${
                    thinkingBudget === p.value 
                      ? 'bg-indigo-600 text-white border-indigo-500 font-medium' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Modelin cevap vermeden önce derinlemesine akıl yürütmesi için ayrılan düşünme kapasitesi.
            </p>
          </div>

          {/* Google Gemini API Key Section */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-white">Gemini API Anahtarı</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                customApiKey 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {customApiKey ? 'Özel Anahtar Aktif' : 'Varsayılan Sistem'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Varsayılan sistemde kota veya yetki sorunu yaşanırsa, tarayıcınızın yerel hafızasında saklanan kişisel Gemini API anahtarınız devreye girer.
            </p>

            <button
              onClick={() => {
                toggleOpen();
                onOpenApiKeyModal();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30 text-xs font-medium transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              {customApiKey ? 'API Anahtarını Değiştir / Yönet' : 'Kişisel API Anahtarı Tanımla'}
            </button>
          </div>

          {/* Long-Term Memory Quick Access */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-white">Kalıcı Hafıza & Kurallar</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                {memoryCount} Kural
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Mustafa AI, geçmiş konuşmalardan veya manuel eklediğiniz hafıza kurallarını hiçbir zaman unutmaz.
            </p>

            <button
              onClick={() => {
                toggleOpen();
                onOpenMemoryHub('memory');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-medium transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              Hafıza Maddelerini Yönet
            </button>
          </div>

          {/* Data Persistence Shortcut */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Sohbetler 2-3 Gün Sonra Silinmesin</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Tarayıcının sohbet geçmişini otomatik temizlemesini engellemek ve tam yedek almak için Kalıcı Depolama panelini kullanın.
            </p>
            <button
              onClick={() => {
                toggleOpen();
                onOpenMemoryHub('backup');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Yedekleme & Kalıcılık Ayarları →
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-center">
          <p className="text-[11px] text-slate-500">
            Mustafa AI • Gemini 3.7 Flash & Flash-Lite
          </p>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
