import type React from 'react';
import { FileText, History, Info, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ITALIAN_MONTHS } from '../constants';
import type { HistoryEntry } from '../types';
import ScrollRestorer from '../components/ScrollRestorer';

export default function HistoryScreen({ 
  history, 
  onEntryClick, 
  onDeleteEntry,
  onClear 
}: { 
  history: HistoryEntry[]; 
  onEntryClick: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  onClear: () => void;
  key?: React.Key;
}) {
  // Group history by year
  const groupedHistory = history.reduce((acc, entry) => {
    const year = entry.year || new Date(entry.timestamp).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {} as Record<number, HistoryEntry[]>);

  // Sort years descending
  const sortedYears = Object.keys(groupedHistory)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 py-4"
    >
      <ScrollRestorer screenName="history" />
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white lowercase first-letter:uppercase">Storico</h2>
          <p className="text-xs text-slate-500 font-medium lowercase first-letter:uppercase">Tutte le tue analisi salvate</p>
        </div>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-xl transition-colors hover:bg-red-100"
          >
            Svuota tutto
          </button>
        )}
      </div>

      <div className="space-y-8 py-3">
        {sortedYears.length > 0 ? (
          sortedYears.map((year) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-4 px-2">
                <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{year}</h3>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedHistory[year]
                  .sort((a, b) => {
                    const idxA = ITALIAN_MONTHS.indexOf(a.monthName.toLowerCase());
                    const idxB = ITALIAN_MONTHS.indexOf(b.monthName.toLowerCase());
                    return idxB - idxA;
                  })
                  .map((entry) => (
                    <motion.div 
                      key={entry.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onEntryClick(entry)}
                      className="group relative cursor-pointer bg-white dark:bg-sky-900 p-4 rounded-2xl border border-sky-100/50 dark:border-sky-800 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white capitalize">{entry.monthName}</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[80px] md:max-w-[120px]">{entry.fileName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">€ {entry.commission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Nostrano: € {entry.totalItalian.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        </div>
                        <button 
                          onClick={(e) => onDeleteEntry(entry.id, e)}
                          className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white active:scale-90 z-10 shadow-sm border border-red-100 dark:border-red-500/20"
                          title="Elimina analisi"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <History size={32} />
            </div>
            <p className="text-sm font-bold text-slate-500">Nessuna analisi salvata</p>
            <p className="text-[10px] uppercase tracking-widest mt-1">Carica un PDF per iniziare lo storico</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="p-6 bg-sky-50/30 dark:bg-sky-800/20 rounded-3xl border border-sky-100/50 dark:border-sky-800/50">
          <div className="flex items-start gap-3">
            <Info className="text-primary mt-0.5" size={16} />
            <p className="text-[11px] text-sky-900/60 dark:text-sky-300/60 font-medium leading-relaxed">
              I dati sono salvati localmente sul tuo dispositivo. Se cancelli la cache dell'app, lo storico andrà perso.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
