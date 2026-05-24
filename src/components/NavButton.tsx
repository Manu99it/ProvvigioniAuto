import type React from 'react';

export default function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-300 rounded-full ${active ? 'bg-sky-100/80 dark:bg-sky-900/60 text-primary px-7 py-1.5' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-3 py-1.5'}`}
    >
      <div className="mb-0.5">{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
