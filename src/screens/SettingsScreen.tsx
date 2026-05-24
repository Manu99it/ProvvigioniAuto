import React, { useState } from 'react';
import { Calculator, FileText, Home as HomeIcon, Percent, Plus, RotateCcw, Sparkles, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { DEFAULT_SETTINGS } from '../constants';
import type { AppSettings } from '../types';
import ScrollRestorer from '../components/ScrollRestorer';
import packageJson from '../../package.json';

export default function SettingsScreen({ 
  onBack, 
  useSystemTheme, 
  setUseSystemTheme, 
  isDarkMode, 
  setIsDarkMode,
  settings,
  setSettings,
  onReset
}: { 
  onBack: () => void;
  useSystemTheme: boolean;
  setUseSystemTheme: (v: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onReset: () => void;
  key?: React.Key;
}) {
  const [keywordInput, setKeywordInput] = useState('');

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.italianKeywords.includes(keywordInput.trim())) {
      setSettings(prev => ({
        ...prev,
        italianKeywords: [...prev.italianKeywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setSettings(prev => ({
      ...prev,
      italianKeywords: prev.italianKeywords.filter(k => k !== kw)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 py-4 pb-12"
    >
      <ScrollRestorer screenName="settings" />
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white dark:bg-sky-900 rounded-xl shadow-sm border dark:border-sky-800 text-sky-600 dark:text-sky-400">
            <HomeIcon size={20} />
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Impostazioni</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commission Calculation Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="text-primary" size={18} />
              Calcolo Provvigioni
            </h3>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, commissionRate: DEFAULT_SETTINGS.commissionRate, deductionRate: DEFAULT_SETTINGS.deductionRate }))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
            >
              <RotateCcw size={14} />
              Ripristina
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Percentuale Provvigione (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.commissionRate}
                    onChange={(e) => setSettings(prev => ({ ...prev, commissionRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Scorporo dal Totale (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.deductionRate}
                    onChange={(e) => setSettings(prev => ({ ...prev, deductionRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <TrendingDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keywords Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b dark:border-slate-800 flex justify-between items-start">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-tertiary" size={18} />
                Parole chiave nostrano
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Ricarica il pdf per i nuovi calcoli. Non ha effetto sullo storico.
              </p>
            </div>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, italianKeywords: [...DEFAULT_SETTINGS.italianKeywords] }))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors whitespace-nowrap"
            >
              <RotateCcw size={14} />
              Ripristina
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Aggiungi parola chiave..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button 
                onClick={addKeyword}
                className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.italianKeywords.map(kw => (
                <span 
                  key={kw} 
                  className="bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-100 dark:border-sky-900/50 flex items-center gap-2 animate-in fade-in zoom-in"
                >
                  {kw}
                  <button 
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                </span>
              ))}
              {settings.italianKeywords.length === 0 && (
                <p className="text-xs text-slate-400 italic">Nessuna parola chiave impostata</p>
              )}
            </div>
          </div>
        </div>
      </div>


      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-secondary" size={20} />
            Grafica
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* System Theme Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Usa tema di sistema</p>
              <p className="text-xs text-slate-500">Adatta l'aspetto dell'app alle impostazioni del dispositivo</p>
            </div>
            <button 
              onClick={() => setUseSystemTheme(!useSystemTheme)}
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${useSystemTheme ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <motion.div 
                animate={{ x: useSystemTheme ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-md"
              />
            </button>
          </div>

          {/* Manual Theme Toggle */}
          <div className={`flex items-center justify-between transition-all duration-300 ${useSystemTheme ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Modalità scura</p>
              <p className="text-xs text-slate-500">Passa manualmente tra tema chiaro e scuro</p>
            </div>
            <button 
              disabled={useSystemTheme}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${isDarkMode ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <motion.div 
                animate={{ x: isDarkMode ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-md"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={onReset}
          className="group flex items-center gap-3 px-8 py-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm border border-red-100 dark:border-red-900/50"
        >
          <RotateCcw size={16} className="group-hover:rotate-[-45deg] transition-transform" />
          Ripristina Applicazione
        </button>
      </div>

      <div className="bg-sky-50/30 dark:bg-sky-800/30 p-6 rounded-3xl text-center space-y-2 border border-dashed border-sky-100 dark:border-sky-800">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">App Version</p>
        <p className="text-sm font-black text-sky-400">v{packageJson.version}</p>
      </div>
    </motion.div>
  );
}

