import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, Eye, EyeOff, Key } from 'lucide-react';
import { LuxuryLabel } from '../components/shared/LuxuryLabel';
import { useUIStore } from '../store/uiStore';

export const SettingsPage = () => {
  const addToast = useUIStore((s) => s.addToast);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState({
    geminiKey: '', groqKey: '', openrouterKey: '', tavilyKey: '',
    supabaseUrl: '', supabaseKey: '',
    chunkSize: '800', chunkOverlap: '150', topK: '10',
  });

  const toggleKey = (key: string) => setShowKeys((s) => ({ ...s, [key]: !s[key] }));
  const update = (key: string, value: string) => setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = () => {
    Object.entries(settings).forEach(([k, v]) => { if (v) localStorage.setItem(`thinksync_${k}`, v); });
    addToast({ type: 'success', title: 'Settings Saved', message: 'Configuration updated successfully' });
  };

  const apiKeys = [
    { key: 'openrouterKey', label: 'OpenRouter API Key', placeholder: 'sk-or-...' },
    { key: 'groqKey', label: 'Groq API Key', placeholder: 'gsk_...' },
    { key: 'geminiKey', label: 'Gemini API Key (Optional)', placeholder: 'AIza...' },
    { key: 'tavilyKey', label: 'Tavily API Key', placeholder: 'tvly-...' },
  ];

  return (
    <div className="p-12 lg:p-16 xl:p-20 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <LuxuryLabel gold className="mb-6 block">Configuration</LuxuryLabel>
        <h2 className="font-serif text-5xl text-white italic tracking-tight mb-12">System <span className="gold-text">Settings</span></h2>
      </motion.div>

      {/* API Keys */}
      <div className="mb-12">
        <LuxuryLabel className="mb-6 block">API Keys</LuxuryLabel>
        <div className="space-y-3">
          {apiKeys.map(({ key, label, placeholder }) => (
            <div key={key} className="bg-white/[0.02] border border-white/5 p-5 flex items-center gap-4">
              <Key className="w-4 h-4 text-white/20 shrink-0" />
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-2">{label}</label>
                <input type={showKeys[key] ? 'text' : 'password'} value={settings[key as keyof typeof settings]}
                  onChange={(e) => update(key, e.target.value)} placeholder={placeholder}
                  className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/10 font-mono" />
              </div>
              <button onClick={() => toggleKey(key)} className="text-white/20 hover:text-primary transition-colors p-1">
                {showKeys[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* RAG Settings */}
      <div className="mb-12">
        <LuxuryLabel className="mb-6 block">RAG Configuration</LuxuryLabel>
        <div className="grid grid-cols-3 gap-3">
          {[{ key: 'chunkSize', label: 'Chunk Size' }, { key: 'chunkOverlap', label: 'Overlap' }, { key: 'topK', label: 'Top K' }].map(({ key, label }) => (
            <div key={key} className="bg-white/[0.02] border border-white/5 p-5">
              <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-2">{label}</label>
              <input type="number" value={settings[key as keyof typeof settings]} onChange={(e) => update(key, e.target.value)}
                className="w-full bg-transparent border-none outline-none text-primary text-2xl font-serif italic font-bold" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave}
        className="px-8 py-3 bg-primary text-background font-mono text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white transition-all flex items-center gap-2 active:scale-95">
        <Save className="w-4 h-4" /> Save Configuration
      </button>
    </div>
  );
};
