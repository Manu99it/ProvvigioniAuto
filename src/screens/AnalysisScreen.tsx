import type React from 'react';
import { Clock, FileText, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import ScrollRestorer from '../components/ScrollRestorer';

export default function AnalysisScreen({ 
  progress, 
  overallProgress,
  currentFile,
  totalFiles,
  fileName 
}: { 
  progress: number; 
  overallProgress: number;
  currentFile: number;
  totalFiles: number;
  fileName: string; 
  key?: React.Key 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-6"
    >
      <ScrollRestorer screenName="analysis" />
      <div className="relative mb-8">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-sky-50 dark:text-sky-800"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 70}
            strokeDashoffset={2 * Math.PI * 70 * (1 - overallProgress / 100)}
            strokeLinecap="round"
            className="text-primary transition-all duration-300"
          />
          
          <circle
            cx="80"
            cy="80"
            r="55"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-sky-50/50 dark:text-sky-800/50"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="55"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 55}
            strokeDashoffset={2 * Math.PI * 55 * (1 - progress / 100)}
            strokeLinecap="round"
            className="text-secondary transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white dark:bg-sky-900 w-24 h-24 rounded-full shadow-2xl flex flex-col items-center justify-center border border-sky-50 dark:border-sky-800">
             <Sparkles className="text-primary mb-0.5" size={20} />
             <span className="text-xl font-black text-slate-800 dark:text-white">{Math.round(overallProgress)}%</span>
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Totale</span>
          </div>
        </div>
      </div>

      <div className="text-center space-y-3 mb-10">
        <h2 className="text-2xl font-black tracking-tight dark:text-white">
          Analisi Multipla in Corso
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm px-10 leading-relaxed">
          File <span className="font-bold text-primary">{currentFile}</span> di <span className="font-bold text-slate-900 dark:text-slate-200">{totalFiles}</span>. 
          Stiamo elaborando i dati estratti per massimizzare la precisione.
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-sky-900 p-5 rounded-3xl border border-sky-100/50 dark:border-sky-800 flex flex-col gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-primary">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">FILE CORRENTE</p>
            <p className="text-xs font-bold truncate dark:text-white">{fileName}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-sky-900 p-5 rounded-3xl border border-sky-100/50 dark:border-sky-800 flex flex-col gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-secondary">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STIMA TOTALE</p>
            <p className="text-xs font-bold dark:text-white">~ {totalFiles * 3} secondi</p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-6 px-1">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>PROGRESSO FILE ({currentFile}/{totalFiles})</span>
            <span className="text-secondary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>PROGRESSO TOTALE</span>
            <span className="text-primary">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full p-1 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

