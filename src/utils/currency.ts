export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseItalianCurrency(str: string): number {
  if (!str) return 0;

  const normalized = str.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const val = parseFloat(normalized);

  return Number.isNaN(val) ? 0 : val;
}
