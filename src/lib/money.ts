/**
 * An amount that may be a sum: "48+80+64", "180*3" or "180x3", "500-20".
 * For when nobody knows the total yet. Plain amounts work too. Paise, or
 * null if it can't be read.
 */
export function evalAmount(input: string): number | null {
  const s = input.replace(/[\s₹,]/g, '').replace(/[x×]/gi, '*');
  if (!s || !/^[\d.+\-*]+$/.test(s)) return null;
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join('') !== s) return null;
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const [first, ...rest] = term.replace(/^[+-]/, '').split('*');
    let paise = toPaise(first);
    if (paise == null || first === '') return null;
    for (const f of rest) {
      if (!/^\d+(\.\d+)?$/.test(f)) return null;
      paise = Math.round(paise * parseFloat(f));
    }
    total += sign * paise;
  }
  return total;
}

/** True when the text is a sum rather than a single number. */
export function isSum(input: string) {
  return /\d\s*[+\-*x×]\s*\d/i.test(input);
}

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
