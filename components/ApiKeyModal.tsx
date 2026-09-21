import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Loader2, 
  Trash2, 
  Save, 
  Clipboard,
  Sparkles,
  Info
} from 'lucide-react';
import { verifyApiKey } from '../services/gemini';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onRemoveApiKey: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  onRemoveApiKey,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  // Sync state with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(apiKey || '');
      setShowKey(false);
      setVerifyResult({ status: 'idle' });
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputValue(text.trim());
          setVerifyResult({ status: 'idle' });
        }
      }
    } catch {
      // Ignore clipboard read errors
    }
  };

  const handleTestKey = async () => {
    const keyToTest = inputValue.trim();
    if (!keyToTest) {
      setVerifyResult({
        status: 'error',
        message: 'Lütfen test etmek için bir API anahtarı girin.',
      });
      return;
    }

    setIsVerifying(true);
    setVerifyResult({ status: 'idle' });

    try {
      const res = await verifyApiKey(keyToTest);
      if (res.valid) {
        setVerifyResult({
          status: 'success',
          message: res.message || 'API anahtarı başarıyla doğrulandı ve çalışıyor!',
        });
      } else {
        setVerifyResult({
          status: 'error',
          message: res.error || 'API anahtarı doğrulanamadı. Lütfen kontrol edin.',
        });
      }
    } catch (err: any) {
      setVerifyResult({
        status: 'error',
        message: err.message || 'Bağlantı hatası oluştu.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onRemoveApiKey();
      onClose();
      return;
    }

    onSaveApiKey(trimmed);
    onClose();
  };

  const handleRemove = () => {
    onRemoveApiKey();
    setInputValue('');
    setVerifyResult({ status: 'idle' });
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 12) return '••••••••••••';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Google Gemini API Anahtarı
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                  Güvenli Depolama
                </span>
              </h2>
              <p className="text-xs text-slate-400">Varsayılan sistem kota/yetki hatası verirse kullanılır</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Security & LocalStorage Guarantee Notice */}
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-xs text-emerald-300/90">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-emerald-300 block">Gizlilik & Güvenlik Güvencesi</span>
              <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                Girdiğiniz API anahtarı yalnızca tarayıcınızın <strong>localStorage</strong> hafızasında güvenle saklanır. Harici veritabanlarına veya sunucu kayıtlarına yazılmaz.
              </p>
            </div>
          </div>

          {/* Current Active Status */}
          <div className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${apiKey ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
              <div>
                <span className="text-xs font-semibold text-white block">
                  {apiKey ? 'Kişisel API Anahtarınız Aktif' : 'Varsayılan Sistem Anahtarı Aktif'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {apiKey ? maskKey(apiKey) : 'Google AI Studio altyapısı'}
                </span>
              </div>
            </div>

            {apiKey && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                title="Anahtarı kaldır ve varsayılan sistem yapılandırmasına dön"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kaldır</span>
              </button>
            )}
          </div>

          {/* Key Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <label htmlFor="gemini-api-key-input" className="text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Gemini API Anahtarınız</span>
              </label>

              <button
                type="button"
                onClick={handlePaste}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
              >
                <Clipboard className="w-3 h-3" />
                Panodan Yapıştır
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                id="gemini-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setVerifyResult({ status: 'idle' });
                }}
                placeholder="AIzaSy... (Gemini API Anahtarınızı girin)"
                className="w-full pl-3.5 pr-20 py-2.5 bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />

              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                  title={showKey ? 'Gizle' : 'Göster'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              API anahtarınız genellikle <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">AIzaSy</code> ile başlar.
            </p>
          </div>

          {/* Test & Verification Status Box */}
          {verifyResult.status !== 'idle' && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in ${
              verifyResult.status === 'success' 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}>
              {verifyResult.status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-[11px] leading-relaxed">
                {verifyResult.message}
              </div>
            </div>
          )}

          {/* How to get a free key guide */}
          <div className="p-3.5 bg-slate-800/30 border border-slate-800/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                API Anahtarınız Yok mu?
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium hover:underline"
              >
                <span>Google AI Studio'dan Ücretsiz Al</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal list-inside pl-1 leading-relaxed">
              <li>Google AI Studio anahtar sayfasına gidin (Google hesabınızla giriş yapın).</li>
              <li><strong>"Create API key"</strong> düğmesine tıklayın.</li>
              <li>Oluşturulan anahtarı kopyalayıp buradaki kutucuğa yapıştırın ve <strong>Kaydet</strong>'e basın.</li>
            </ol>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={isVerifying || !inputValue.trim()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Test Ediliyor...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bağlantıyı Test Et</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-indigo-500/20 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Kaydet & Etkinleştir</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ApiKeyModal;
