import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseItalianCurrency, roundCurrency } from './currency';

describe('parseItalianCurrency', () => {
  it('parses Italian decimal and thousands separators', () => {
    assert.equal(parseItalianCurrency('1.234,56'), 1234.56);
    assert.equal(parseItalianCurrency('12 345,67'), 12345.67);
    assert.equal(parseItalianCurrency('42'), 42);
  });

  it('returns zero for empty or invalid values', () => {
    assert.equal(parseItalianCurrency(''), 0);
    assert.equal(parseItalianCurrency('non disponibile'), 0);
  });
});

describe('roundCurrency', () => {
  it('rounds to cents', () => {
    assert.equal(roundCurrency(12.345), 12.35);
    assert.equal(roundCurrency(12.344), 12.34);
  });
});
