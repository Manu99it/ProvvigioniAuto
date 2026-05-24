import type { DDTRecord } from '../services/pdfService';
import type { AppSettings } from '../types';
import { roundCurrency } from '../utils/currency';

type CommissionSettings = Pick<AppSettings, 'commissionRate' | 'deductionRate'>;

export interface CommissionDetails {
  totalItalian: number;
  deductionAmount: number;
  netItalian: number;
  commission: number;
}

export function sumItalianTotal(records: DDTRecord[]): number {
  return roundCurrency(records.reduce((acc, record) => acc + (record.italianoTotal || 0), 0));
}

export function sumImponibileTotal(records: DDTRecord[]): number {
  return roundCurrency(records.reduce((acc, record) => acc + (record.imponibileTotal || 0), 0));
}

export function calculateCommissionDetails(
  italianTotal: number,
  settings: CommissionSettings
): CommissionDetails {
  const totalItalian = roundCurrency(italianTotal);
  const deductionAmount = roundCurrency(totalItalian * (settings.deductionRate / 100));
  const netItalian = roundCurrency(totalItalian - deductionAmount);
  const commission = roundCurrency(netItalian * (settings.commissionRate / 100));

  return {
    totalItalian,
    deductionAmount,
    netItalian,
    commission
  };
}

export function calculateCommissionFromRecords(
  records: DDTRecord[],
  settings: CommissionSettings
): CommissionDetails {
  return calculateCommissionDetails(sumItalianTotal(records), settings);
}
