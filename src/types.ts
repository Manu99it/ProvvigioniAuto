import type { DDTRecord } from './services/pdfService';

export type Screen = 'home' | 'analysis' | 'charts' | 'history' | 'settings';

export interface AppSettings {
  commissionRate: number;
  deductionRate: number;
  italianKeywords: string[];
}

export interface HistoryEntry {
  id: string;
  monthName: string;
  year: number;
  fileName: string;
  records: DDTRecord[];
  totalItalian: number;
  commission: number;
  timestamp: number;
}

export interface PersonalInfo {
  name: string;
  role: string;
  email: string;
}
