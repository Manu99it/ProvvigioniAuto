const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace chart ticks
content = content.replace(/tick=\{\{\s*fontSize:\s*18,\s*fontWeight:\s*700\s*\}\}/g, "tick={{ fontSize: 18, fontWeight: 700, fill: 'var(--chart-tick-color)' }}");
content = content.replace(/tick=\{\{\s*fontSize:\s*16,\s*fill:\s*'#64748b',\s*fontWeight:\s*600\s*\}\}/g, "tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}");
content = content.replace(/tick=\{\{\s*fontSize:\s*16,\s*fontWeight:\s*600\s*\}\}/g, "tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}");
content = content.replace(/tick=\{\{\s*fontSize:\s*13,\s*fontWeight:\s*700\s*\}\}/g, "tick={{ fontSize: 13, fill: 'var(--chart-tick-color)', fontWeight: 700 }}");
content = content.replace(/tick=\{\{\s*fontSize:\s*12,\s*fill:\s*'#64748b',\s*fontWeight:\s*600\s*\}\}/g, "tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}");
content = content.replace(/tick=\{\{\s*fontSize:\s*12,\s*fontWeight:\s*800,\s*angle:\s*-45,\s*textAnchor:\s*'end'\s*\}\}/g, "tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }}");

// Replace Empty State contrast
content = content.replace(/className="text-slate-400 dark:text-slate-600 font-medium text-sm">Nessun dato analizzato<\/p>/g, 'className="text-slate-400 dark:text-slate-400 font-medium text-sm">Nessun dato analizzato</p>');
content = content.replace(/className="text-\[10px\] text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-1">Carica un PDF per iniziare<\/p>/g, 'className="text-[10px] text-slate-300 dark:text-slate-500 uppercase tracking-widest mt-1">Carica un PDF per iniziare</p>');

// Replace Settings Screen dividers
content = content.replace(/className="p-4 border-b dark:border-sky-800 flex justify-between items-center"/g, 'className="p-4 border-b dark:border-slate-800 flex justify-between items-center"');
content = content.replace(/className="p-4 border-b dark:border-sky-800 flex justify-between items-start"/g, 'className="p-4 border-b dark:border-slate-800 flex justify-between items-start"');

fs.writeFileSync('src/App.tsx', content);
console.log("Done");
