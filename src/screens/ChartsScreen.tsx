import React, { useRef, useState } from 'react';
import { BarChart3, Download, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { ITALIAN_MONTHS } from '../constants';
import type { AppSettings, HistoryEntry } from '../types';
import ScrollRestorer from '../components/ScrollRestorer';
import { triggerDownload } from '../utils/download';
import { calculateCommissionFromRecords } from '../domain/commissions';

type MonthlyChartRow = { month: string } & Record<number, number>;
type ExportTableRow = string[];

interface TooltipPayloadEntry {
  color?: string;
  fill?: string;
  name?: string;
  value: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  title: string;
}

export default function ChartsScreen({ history, settings }: { history: HistoryEntry[]; settings: AppSettings; key?: React.Key }) {
  const chart1Ref = useRef<HTMLDivElement>(null);
  const chart2Ref = useRef<HTMLDivElement>(null);
  const chart3Ref = useRef<HTMLDivElement>(null);
  const chart4Ref = useRef<HTMLDivElement>(null);
  
  const hiddenChart1Ref = useRef<HTMLDivElement>(null);
  const hiddenChart2Ref = useRef<HTMLDivElement>(null);
  const hiddenChart3Ref = useRef<HTMLDivElement>(null);
  const hiddenChart4Ref = useRef<HTMLDivElement>(null);
  
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    // Give more time for the hidden charts to render properly
    setTimeout(async () => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        let currentY = 20;

        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229);
        doc.text("REPORT ANDAMENTO CDM", 105, currentY, { align: 'center' });
        currentY += 15;
        
        doc.setFontSize(14);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 105, currentY, { align: 'center' });
        currentY += 20;

        // Chart 1: FATTURATO ANNUO
        if (hiddenChart1Ref.current) {
          const dataUrl = await toPng(hiddenChart1Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text("FATTURATO ANNUO CDM", 105, currentY, { align: 'center' });
          currentY += 10;
          
          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          autoTable(doc, {
            startY: currentY,
            margin: { left: 105 - 32.5 },
            tableWidth: 65,
            head: [['Anno', 'Totale', 'Nostrano']],
            body: yearlyData.map(d => [d.year, `€${d.totale.toLocaleString('it-IT')}`, `€${d.nostrano.toLocaleString('it-IT')}`]),
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [2, 132, 199] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 4: PROVVIGIONI
        if (hiddenChart4Ref.current) {
          const dataUrl = await toPng(hiddenChart4Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO PROVVIGIONI", 105, currentY, { align: 'center' });
          currentY += 10;

          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const provvigioniRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: ExportTableRow = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyCommissionData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: provvigioniRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [139, 92, 246] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 2: NOSTRANO
        if (hiddenChart2Ref.current) {
          const dataUrl = await toPng(hiddenChart2Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO NOSTRANO CDM", 105, currentY, { align: 'center' });
          currentY += 10;
          
          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const nostranoRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: ExportTableRow = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyItalianData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: nostranoRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [13, 148, 136] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 3: VENDITA
        if (hiddenChart3Ref.current) {
          const dataUrl = await toPng(hiddenChart3Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO VENDITA CDM", 105, currentY, { align: 'center' });
          currentY += 10;

          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const venditaRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: ExportTableRow = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyTotalData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: venditaRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [2, 132, 199] }
          });
        }

        const pdfBlob = doc.output('blob');
        await triggerDownload(pdfBlob, `Report_Grafici_CDM_${new Date().getFullYear()}.pdf`);
      } catch (error) {
        console.error("Export error:", error);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  const ChartTooltip = ({ active, payload, label, title }: ChartTooltipProps) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-2xl border border-sky-100 dark:border-sky-800 space-y-3 min-w-[200px] z-50">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b dark:border-slate-800 pb-2">{title}: {label}</p>
          <div className="grid gap-2 max-h-48 overflow-y-auto no-scrollbar">
            {payload.map((entry, index) => (
              <div key={index} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate max-w-[100px]">
                    {entry.name}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-white numeric-data">
                  € {entry.value.toLocaleString('it-IT')}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // 1. Process data for Yearly Totals Chart
  const yearlyDataMap = new Map<number, { year: number; totale: number; nostrano: number }>();
  
  history.forEach(entry => {
    let year = entry.year;
    if (!year) {
      year = entry.timestamp ? new Date(entry.timestamp).getFullYear() : new Date().getFullYear();
      if (entry.monthName.toLowerCase() === 'dicembre' && entry.timestamp && new Date(entry.timestamp).getMonth() <= 1) {
        year -= 1;
      }
    }
    
    const existing = yearlyDataMap.get(year) || { year, totale: 0, nostrano: 0 };
    const records = entry.records || [];
    const total = records.reduce((acc, r) => acc + (r.imponibileTotal || 0), 0);
    const nostrano = records.reduce((acc, r) => acc + (r.italianoTotal || 0), 0);
    
    yearlyDataMap.set(year, {
      year,
      totale: existing.totale + total,
      nostrano: existing.nostrano + nostrano
    });
  });
  
  const yearlyData = Array.from(yearlyDataMap.values()).sort((a, b) => a.year - b.year);

  // 2. Process data for Monthly Multi-year Comparisons (Italiano & Totale)
  // Get all years, sorted descending
  const years = Array.from(yearlyDataMap.keys()).sort((a, b) => b - a).reverse();
  const colors = [
    '#0284c7', // Sky
    '#0d9488', // Teal
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#f97316', // Orange
    '#84cc16', // Lime
    '#0ea5e9', // Light Blue
    '#a855f7', // Purple
    '#14b8a6', // Light Teal
    '#ef4444', // Red
    '#eab308', // Yellow
    '#d946ef', // Fuchsia
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#be123c', // Dark Rose
    '#64748b'  // Slate
  ];

  const monthlyItalianData = ITALIAN_MONTHS.map((month) => {
    const row: MonthlyChartRow = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const nostrano = (entry.records || []).reduce((acc, r) => acc + (r.italianoTotal || 0), 0);
        row[year] = Math.round(nostrano);
      } else {
        row[year] = 0; // Or null to have gaps
      }
    });
    return row;
  });

  const monthlyTotalData = ITALIAN_MONTHS.map((month) => {
    const row: MonthlyChartRow = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const total = (entry.records || []).reduce((acc, r) => acc + (r.imponibileTotal || 0), 0);
        row[year] = Math.round(total);
      } else {
        row[year] = 0;
      }
    });
    return row;
  });

  const monthlyCommissionData = ITALIAN_MONTHS.map((month) => {
    const row: MonthlyChartRow = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const commission = calculateCommissionFromRecords(entry.records || [], settings).commission;
        row[year] = Math.round(commission);
      } else {
        row[year] = 0;
      }
    });
    return row;
  });

  return (
    <>
      {/* Hidden Export Container - Rendered with fixed width only during export */}
      {isExporting && (
        <div 
          className="fixed left-[-9999px] top-0 bg-white"
          style={{ width: '1200px' }}
        >
          <div ref={hiddenChart1Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <BarChart width={1200} height={600} data={yearlyData} margin={{ top: 40, right: 40, left: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="year" tick={{ fontSize: 18, fontWeight: 700, fill: 'var(--chart-tick-color)' }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
              <Bar dataKey="totale" name="TOTALE" fill="#0284c7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="nostrano" name="NOSTRANO" fill="#0d9488" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </div>

          <div ref={hiddenChart2Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <LineChart width={1200} height={600} data={monthlyItalianData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Line 
                  key={year} 
                  type="monotone" 
                  dataKey={year} 
                  name={year.toString()} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={4}
                  dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>

          <div ref={hiddenChart3Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <LineChart width={1200} height={600} data={monthlyTotalData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Line 
                  key={year} 
                  type="monotone" 
                  dataKey={year} 
                  name={year.toString()} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={4}
                  dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>

          <div ref={hiddenChart4Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <BarChart width={1200} height={600} data={monthlyCommissionData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Bar 
                  key={year} 
                  dataKey={year} 
                  name={year.toString()} 
                  fill={colors[index % colors.length]} 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </div>

        </div>
      )}


      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-24"
    >
      <ScrollRestorer screenName="charts" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sky-500 rounded-2xl shadow-lg shadow-sky-500/20 text-white">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Grafici d'Andamento</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Analisi comparativa pluriennale del fatturato</p>
          </div>
        </div>
        <button 
          onClick={exportPDF}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
        >
          {isExporting ? (
            <RotateCcw className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isExporting ? 'ESPORTAZIONE...' : 'ESPORTA REPORT PDF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yearly Totals Chart - Full Width */}
        <div ref={chart1Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800 lg:col-span-2">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase text-center tracking-wider">FATTURATO ANNUO CDM</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ left: -20, right: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--chart-tick-color)', fontWeight: 700 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  domain={[0, (dataMax: number) => Math.ceil(dataMax / 10000) * 10000]}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={<ChartTooltip title="ANNO" />}
                />
                <Legend verticalAlign="top" align="center" height={50} wrapperStyle={{ paddingBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}/>
                <Bar dataKey="totale" name="TOTALE" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="nostrano" name="NOSTRANO" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Commission Comparison Chart */}
        <div ref={chart4Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800 lg:col-span-2">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO PROVVIGIONI</h3>
          
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCommissionData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Bar 
                      key={year} 
                      dataKey={year} 
                      name={`${year}`} 
                      fill={colors[i % colors.length]} 
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Italian Comparison Chart */}
        <div ref={chart2Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO NOSTRANO CDM</h3>
          
          {/* Custom Static Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyItalianData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Line 
                      key={year} 
                      type="monotone" 
                      dataKey={year} 
                      name={`${year}`} 
                      stroke={colors[i % colors.length]} 
                      strokeWidth={2.5} 
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Total Comparison Chart */}
        <div ref={chart3Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO VENDITA CDM</h3>
          
          {/* Custom Static Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTotalData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Line 
                      key={year} 
                      type="monotone" 
                      dataKey={year} 
                      name={`${year}`} 
                      stroke={colors[i % colors.length]} 
                      strokeWidth={2.5} 
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>



      </div>
    </motion.div>
  </>
);
}

