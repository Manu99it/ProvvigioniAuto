import type { AppSettings } from './types';

export const ITALIAN_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

export const DEFAULT_SETTINGS: AppSettings = {
  commissionRate: 5,
  deductionRate: 2.7,
  italianKeywords: ['37.2.1', '37.2.2', '37.1.3', 'allevato in italia']
};

export function extractMonthFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  for (const month of ITALIAN_MONTHS) {
    if (lower.includes(month)) {
      return month.charAt(0).toUpperCase() + month.slice(1);
    }
  }
  return 'N/A';
}
