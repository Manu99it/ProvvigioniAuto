import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface HomeTrendChartPoint {
  name: string;
  nostrano: number;
  totale: number;
  date: string;
}

interface TooltipPayloadEntry {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length >= 2) {
    return (
      <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-2xl border border-sky-100 dark:border-sky-800 space-y-3 min-w-[180px]">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b dark:border-sky-800 pb-2">DDT n. {label}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sky-500" />
              <span className="text-[10px] font-bold text-sky-500 uppercase">Nostrano</span>
            </div>
            <span className="text-sm font-black text-sky-600 dark:text-sky-400">
              € {payload[1].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Totale</span>
            </div>
            <span className="text-sm font-black text-slate-600 dark:text-slate-300">
              € {payload[0].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function HomeTrendChart({ data }: { data: HomeTrendChartPoint[] }) {
  const chartData = data.length > 0 ? data : [{ name: '', nostrano: 0, totale: 0, date: '' }];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorNostrano" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTotale" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" hide />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="totale"
          stroke="#0284c7"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorTotale)"
        />
        <Area
          type="monotone"
          dataKey="nostrano"
          stroke="#0d9488"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorNostrano)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
