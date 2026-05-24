import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Award, Download, FileText, MoreHorizontal, Percent, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { DDTRecord } from '../services/pdfService';
import type { AppSettings, HistoryEntry } from '../types';
import { ITALIAN_MONTHS } from '../constants';
import ScrollRestorer from '../components/ScrollRestorer';
import { triggerDownload } from '../utils/download';
import {
  calculateCommissionFromRecords,
  sumImponibileTotal,
  sumItalianTotal
} from '../domain/commissions';
import type { HomeTrendChartPoint } from '../components/HomeTrendChart';

const HomeTrendChart = lazy(() => import('../components/HomeTrendChart'));

export default function HomeScreen({ hasData, records, settings, history, monthName, year, onLoadEntry }: { 
  hasData: boolean; 
  records: DDTRecord[]; 
  settings: AppSettings; 
  history: HistoryEntry[]; 
  monthName: string; 
  year: number;
  onLoadEntry: (entry: HistoryEntry) => void;
  key?: React.Key 
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current && history.length > 0 && !hasScrolled) {
      const element = scrollContainerRef.current;
      const timeoutId = setTimeout(() => {
        const activeBar = element.querySelector('[data-active="true"]') as HTMLElement;
        if (activeBar) {
          // Calculate precise horizontal scroll to center the active bar within the container ONLY
          const containerWidth = element.offsetWidth;
          const barLeft = activeBar.offsetLeft;
          const barWidth = activeBar.offsetWidth;
          element.scrollLeft = barLeft - (containerWidth / 2) + (barWidth / 2);
        } else {
          element.scrollLeft = element.scrollWidth;
        }
        setHasScrolled(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [history.length, hasScrolled]);

  const totItaliano = sumItalianTotal(records);
  const totGenerale = sumImponibileTotal(records);
  const commissionDetails = calculateCommissionFromRecords(records, settings);
  const monthlyCommission = commissionDetails.commission;

  // Prepare History Chart Data (Bar Chart)
  const historyChartData = history
    .map(entry => {
      let entryYear = entry.year;
      
      // Better year inference if missing
      if (!entryYear) {
        const date = entry.timestamp ? new Date(entry.timestamp) : new Date();
        entryYear = date.getFullYear();
        
        // If it's Dicembre but recorded in Jan/Feb, it's likely previous year
        if (entry.monthName.toLowerCase() === 'dicembre' && date.getMonth() <= 1) {
          entryYear -= 1;
        }
      }
      
      // Recalculate commission based on CURRENT settings if records exist, otherwise use saved commission
      let recalculatedCommission = entry.commission || 0;
      if (entry.records && entry.records.length > 0) {
        recalculatedCommission = calculateCommissionFromRecords(entry.records, settings).commission;
      }
      
      return {
        name: `${entry.monthName.substring(0, 3).toUpperCase()} '${entryYear.toString().slice(-2)}`,
        fullName: entry.monthName,
        value: recalculatedCommission,
        monthIndex: ITALIAN_MONTHS.indexOf(entry.monthName.toLowerCase()),
        year: entryYear,
        entry: entry
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      // If monthIndex is -1 (N/A), sort it to the end of the year
      const idxA = a.monthIndex === -1 ? 12 : a.monthIndex;
      const idxB = b.monthIndex === -1 ? 12 : b.monthIndex;
      return idxA - idxB;
    });

  // Calculate Trend
  let trendValue = 0;
  let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  
  // Find index of current monthName in chronological history
  const currentIndex = historyChartData.findIndex(d => d.fullName.toLowerCase() === monthName.toLowerCase() && d.year === year);
  
  // Only calculate trend if we found the current month and there is a previous entry
  if (currentIndex > 0) {
    const currentVal = monthlyCommission; // Use the actual displayed commission
    const prevVal = historyChartData[currentIndex - 1].value;
    
    if (prevVal > 0) {
      trendValue = ((currentVal - prevVal) / prevVal) * 100;
      // Allow even small trends to be visible unless it's within the 0.5% tolerance
      if (Math.abs(trendValue) < 0.5) {
        trendDirection = 'neutral';
      } else {
        trendDirection = trendValue > 0 ? 'up' : 'down';
      }
    } else if (prevVal === 0 && currentVal > 0) {
        trendValue = 100;
        trendDirection = 'up';
    } else if (prevVal > 0 && currentVal === 0) {
        trendValue = -100;
        trendDirection = 'down';
    }
  } else if (currentIndex === 0 && historyChartData.length > 1) {
    // If it's the oldest entry, we could potentially show trend relative to the NEXT month
    // but usually trend is backward-looking. For now, keep it neutral or don't show.
  }

  // Chart data: trend of italianoTotal and totale per DDT
  const chartData: HomeTrendChartPoint[] = records.map(r => ({
    name: r.number,
    nostrano: r.italianoTotal,
    totale: r.imponibileTotal,
    date: r.date
  })); 

  const handleExportPDF = async () => {
    if (!hasData || records.length === 0) return;
    
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    const finalAfterDiscount = commissionDetails.netItalian;
    const scorporoValue = commissionDetails.deductionAmount;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199); // Sky-600 Marine Blue
    doc.setFont("helvetica", "bold");
    doc.text(`Riepilogo Provvigioni`, 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${year}`, 14, 32);
    
    // Line separator
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 38, 196, 38);

    // Summary Details
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Imponibile Totale Generale:`, 14, 48);
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 48);
    
    doc.setTextColor(100);
    doc.text(`Imponibile Prodotti Nostrani:`, 14, 54);
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${totItaliano.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 54);

    doc.setTextColor(100);
    doc.text(`Scorporo (${settings.deductionRate}%):`, 14, 60);
    doc.setTextColor(180, 0, 0); // Red for deduction
    doc.text(`- € ${scorporoValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 60);

    doc.setTextColor(100);
    doc.text(`Imponibile Netto Provvigionale:`, 14, 66);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${finalAfterDiscount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 66);
    
    // Highlighted Commission Box
    doc.setFillColor(240, 249, 255); // Sky-50
    doc.roundedRect(14, 74, 182, 18, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setTextColor(2, 132, 199);
    doc.text(`PROVVIGIONE TOTALE (${settings.commissionRate}%):`, 18, 85);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`€ ${monthlyCommission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 130, 85);
    
    const tableData = records.map(r => [
      r.number,
      r.date,
      `€ ${r.imponibileTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      `€ ${r.italianoTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    ]);
    
    autoTable(doc, {
      startY: 100,
      head: [['N. D.D.T.', 'Data', 'Imponibile', 'Imp. Nostrano']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [2, 132, 199], halign: 'center', fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      styles: { fontSize: 9, cellPadding: 2, minCellHeight: 0 }
    });
    
    const pdfBlob = doc.output('blob');
    await triggerDownload(pdfBlob, `Provvigioni_${monthName}_${year}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!hasData || records.length === 0) return;
    const XLSX = await import('xlsx');
    
    // Create the main data rows
    const data = records.map(r => {
      // Remove dots (thousands separators) from the number if it's a string
      const cleanNumber = r.number.replace(/\./g, '');
      return {
        'N. D.D.T.': isNaN(Number(cleanNumber)) ? cleanNumber : Number(cleanNumber),
        'Data': r.date,
        'Imponibile': r.imponibileTotal,
        'Imponibile Nostrano': r.italianoTotal
      };
    });
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const lastRow = data.length + 1; // +1 for header
    
    // Add Summary rows with formulas
    const summaryStartRow = lastRow + 2;
    
    // Totals title
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['RIEPILOGO FINALE', '', '', ''],
      ['TOTALE GENERALE', '', { f: `SUM(C2:C${lastRow})` }, { f: `SUM(D2:D${lastRow})` }],
      [`SCORPORO (${settings.deductionRate}%)`, '', '', { f: `D${summaryStartRow + 1} * ${settings.deductionRate / 100}` }],
      ['IMPONIBILE NETTO', '', '', { f: `D${summaryStartRow + 1} - D${summaryStartRow + 2}` }],
      [`PROVVIGIONE (${settings.commissionRate}%)`, '', '', { f: `D${summaryStartRow + 3} * ${settings.commissionRate / 100}` }]
    ], { origin: `A${summaryStartRow}` });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registro Vendite");
    
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await triggerDownload(excelBlob, `Registro_Vendite_${monthName}_${year}.xlsx`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <ScrollRestorer screenName="home" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Commission Highlight Card */}
          <div className="bg-gradient-to-br from-sky-600 to-sky-800 rounded-3xl p-6 text-white shadow-2xl shadow-sky-500/30 relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-sky-900/40 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sky-100/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">Provvigione {monthName} {year}</p>
                  <h2 className="text-4xl font-black tracking-tight">
                    € {monthlyCommission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                </div>
                <div className={`px-3 py-2 rounded-xl backdrop-blur-md flex items-center gap-1.5 border border-white/10 ${trendDirection === 'up' ? 'bg-emerald-500/20 text-emerald-300' : trendDirection === 'down' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/60'}`}>
                  {trendDirection === 'up' && <TrendingUp size={18} className="text-emerald-400" />}
                  {trendDirection === 'down' && <TrendingDown size={18} className="text-rose-400" />}
                  {trendDirection === 'neutral' && <MoreHorizontal size={18} />}
                  
                  <span className="text-[10px] font-black tracking-wider">
                    {trendDirection === 'neutral' ? '0.0%' : `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-4 items-center mb-8">
                <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                  <Percent size={12} className="text-sky-200" />
                  <span className="text-[10px] font-black">{settings.commissionRate}% PREMIO</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <p className="text-[10px] text-sky-100/60 font-medium leading-tight">
                  Calcolato su Totale Nostrano <br /> al netto del {settings.deductionRate}%
                </p>
              </div>
            </div>

            {/* History Bar Chart Mini Component */}
            {historyChartData.length > 0 && (
              <div ref={scrollContainerRef} className="relative z-10 w-full overflow-x-auto no-scrollbar scroll-smooth">
                <div className="flex items-end h-24 gap-[4px] px-1 min-w-full pb-1">
                  {historyChartData.map((data) => {
                    // Find max to scale relatively
                    const maxVal = Math.max(...historyChartData.map(d => d.value));
                    const percentage = (data.value / maxVal) * 100;
                    const isSelected = data.fullName.toLowerCase() === monthName.toLowerCase() && data.year === year;
                    
                    return (
                      <button 
                        key={`${data.fullName}-${data.year}`} 
                        data-active={isSelected ? "true" : "false"}
                        onClick={(e) => {
                          const container = e.currentTarget.closest('.overflow-x-auto');
                          if (container) {
                            const scrollLeft = e.currentTarget.offsetLeft - (container.clientWidth / 2) + (e.currentTarget.clientWidth / 2);
                            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                          }
                          onLoadEntry(data.entry);
                        }}
                        className="flex-1 min-w-[44px] flex flex-col items-center gap-1.5 group cursor-pointer border-none bg-transparent p-0 outline-none"
                      >
                        <div className="w-full relative flex items-end justify-center h-16">
                           <motion.div 
                             initial={{ height: 0 }}
                             animate={{ height: `${percentage}%` }}
                             className={`w-full max-w-[44px] rounded-t-[3px] transition-all duration-300 ${isSelected ? 'bg-white origin-bottom' : 'bg-white/20 hover:bg-white/40'}`}
                           />
                        </div>
                        <span className={`text-[9px] font-bold transition-colors ${isSelected ? 'text-white' : 'text-sky-200/50 hover:text-white'}`}>
                          {data.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          {/* Analytics Chart */}
          <div className="bg-white dark:bg-sky-900 rounded-2xl p-5 shadow-sm border border-sky-100/50 dark:border-sky-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Andamento vendite giornaliero</h3>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">Trend</span>
            </div>
            <div className="h-40 w-full">
              <Suspense fallback={<div className="h-full w-full rounded-xl bg-sky-50/60 dark:bg-sky-950/40" />}>
                <HomeTrendChart data={chartData} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>


      {/* Commission Table */}
      <div className="bg-white dark:bg-sky-900 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-4 justify-between items-start border-b border-sky-50 dark:border-sky-800">
          <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 tracking-tight flex-1 min-w-[120px]">Registro Vendite</h3>
          <div className="flex gap-2 flex-shrink-0">
            <button 
              disabled={!hasData}
              onClick={handleExportPDF}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${hasData ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 shadow-sm active:scale-95' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'}`}
              title="Esporta PDF"
            >
              <FileText size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">PDF</span>
            </button>
            <button 
              disabled={!hasData}
              onClick={handleExportExcel}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${hasData ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm active:scale-95' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'}`}
              title="Esporta Excel"
            >
              <Zap size={14} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wider">EXCEL</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar min-h-[400px]">
          {hasData ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">N. D.D.T.</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Data</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Imponibile</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-primary text-right whitespace-nowrap">Imp. nostrano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {records.map((row) => (
                   <tr key={row.number} className="hover:bg-sky-50/20 dark:hover:bg-sky-900/10 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.number}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 text-xs text-right numeric-data font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      € {row.imponibileTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold numeric-data inline-block">
                        € {row.italianoTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-slate-300 dark:text-slate-600" size={32} />
              </div>
              <p className="text-slate-400 dark:text-slate-400 font-medium text-sm">Nessun dato analizzato</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-500 uppercase tracking-widest mt-1">Carica un PDF per iniziare</p>
            </div>
          )}
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-slate-500">Imponibile totale</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            € {totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Imponibile nostrano totale</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            € {totItaliano.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </motion.div>

  );
}

