/** "1,200.5" / "₹ 300" → paise, or null when it isn't a valid amount. */
export function toPaise(input: string): number | null {
  const s = input.replace(/[,\s₹]/g, '');
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === '' || s === '.') return null;
  return Math.round(parseFloat(s) * 100);
}

/** 120050 → "₹1,200.50", 120000 → "₹1,200". */
export function money(paise: number) {
  const abs = Math.abs(paise);
  const str = (abs / 100).toLocaleString('en-IN', {
    minimumFractionDigits: abs % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${paise < 0 ? '-' : ''}₹${str}`;
}

/** Paise → text for an editable amount field. */
export function paiseToInput(paise: number) {
  return paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100);
}
