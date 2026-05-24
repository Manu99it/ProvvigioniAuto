import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DDTRecord } from '../services/pdfService';
import {
  calculateCommissionDetails,
  calculateCommissionFromRecords,
  sumImponibileTotal,
  sumItalianTotal
} from './commissions';

const settings = {
  commissionRate: 5,
  deductionRate: 2.7
};

describe('commission calculations', () => {
  it('applies deduction before commission', () => {
    assert.deepEqual(calculateCommissionDetails(1000, settings), {
      totalItalian: 1000,
      deductionAmount: 27,
      netItalian: 973,
      commission: 48.65
    });
  });

  it('rounds record totals before calculating commission', () => {
    const records = [
      record({ imponibileTotal: 500.123, italianoTotal: 100.105 }),
      record({ imponibileTotal: 200.204, italianoTotal: 200.205 })
    ];

    assert.equal(sumItalianTotal(records), 300.31);
    assert.equal(sumImponibileTotal(records), 700.33);
    assert.deepEqual(calculateCommissionFromRecords(records, settings), {
      totalItalian: 300.31,
      deductionAmount: 8.11,
      netItalian: 292.2,
      commission: 14.61
    });
  });
});

function record(values: Pick<DDTRecord, 'imponibileTotal' | 'italianoTotal'>): DDTRecord {
  return {
    number: '1',
    date: '01/01/2026',
    items: [],
    ...values
  };
}
