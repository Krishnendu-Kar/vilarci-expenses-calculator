import type { Group } from '../types';
import {
  categoryTotals,
  computeBalances,
  groupTotal,
  isSettled,
  suggestTransfers,
  type MemberBalance,
  type Transfer,
} from './split';
import { payerLong, splitLong } from './describe';
import { money } from './money';
import { longDate, plural } from './format';
import { categoryOf, groupKindOf } from '../data/categories';
import { LOGO_DATA_URI } from '../data/logo';

// Reports for people who don't have the app: a chat message and a PDF.
// Both are built from the same numbers the app shows.

interface ReportData {
  group: Group;
  names: Record<string, string>;
  total: number;
  balances: MemberBalance[];
  transfers: Transfer[];
  /** Oldest first: reports read like a diary. */
  expenses: Group['expenses'];
  range: string;
}

function collect(group: Group): ReportData {
  const balances = computeBalances(group);
  const expenses = [...group.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const first = expenses[0]?.date;
  const last = expenses[expenses.length - 1]?.date;
  return {
    group,
    names: Object.fromEntries(group.members.map((m) => [m.id, m.name])),
    total: groupTotal(group),
    balances,
    transfers: suggestTransfers(balances),
    expenses,
    range: !first ? '' : first === last ? longDate(first) : `${longDate(first)} – ${longDate(last)}`,
  };
}

function balanceWords(net: number) {
  if (isSettled(net)) return 'settled';
  return net > 0 ? `gets back ${money(net)}` : `owes ${money(-net)}`;
}

/** WhatsApp-friendly text (*bold* renders in WhatsApp, reads fine elsewhere). */
export function buildTextReport(group: Group) {
  const d = collect(group);
  const lines: string[] = [
    `🧾 *${group.name}* — expense summary`,
    [plural(group.members.length, 'person'), plural(group.expenses.length, 'expense'), d.range].filter(Boolean).join(' · '),
    `Total spent: *${money(d.total)}*`,
    '',
  ];

  lines.push('*Who pays whom*');
  if (d.transfers.length === 0) lines.push('Everyone is settled up 🎉');
  for (const t of d.transfers) lines.push(`➡️ ${d.names[t.from]} pays ${d.names[t.to]} *${money(t.amount)}*`);
  lines.push('');

  lines.push('*Balances*');
  for (const b of [...d.balances].sort((x, y) => y.net - x.net)) {
    lines.push(`${d.names[b.memberId]}: paid ${money(b.paid)}, share ${money(b.share)} → ${balanceWords(b.net)}`);
  }
  lines.push('');

  lines.push('*Expenses*');
  let day = '';
  for (const e of d.expenses) {
    if (e.date !== day) {
      day = e.date;
      lines.push(`_${longDate(day)}_`);
    }
    lines.push(`• ${e.title} — ${money(e.amount)}`);
    const split = splitLong(e, d.names, group.members.length);
    lines.push(`   paid by ${payerLong(e, d.names)}, ${e.splitMode === 'equal' ? split : `split ${split}`}`);
    if (e.note) lines.push(`   📝 ${e.note}`);
  }

  if (group.payments.length) {
    lines.push('', '*Payments already made*');
    for (const p of group.payments) lines.push(`✓ ${d.names[p.from]} paid ${d.names[p.to]} ${money(p.amount)}`);
  }

  lines.push('', '_Made with Vilarci Split_');
  return lines.join('\n');
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained HTML (no external assets) for expo-print. */
export function buildHtmlReport(group: Group, now = new Date()) {
  const d = collect(group);
  const n = (id: string) => esc(d.names[id] ?? '?');
  const cats = categoryTotals(group);
  const maxCat = Math.max(1, ...cats.map((c) => c.amount));
  const avg = group.members.length ? Math.round(d.total / group.members.length) : 0;

  const transfers = d.transfers.length
    ? d.transfers
        .map(
          (t) => `<div class="transfer"><span><b>${n(t.from)}</b> pays <b>${n(t.to)}</b></span><span class="amt">${money(t.amount)}</span></div>`,
        )
        .join('')
    : '<p class="settled">Everyone is settled up 🎉</p>';

  const balances = [...d.balances]
    .sort((a, b) => b.net - a.net)
    .map((b) => {
      const cls = isSettled(b.net) ? '' : b.net > 0 ? 'pos' : 'neg';
      const moved = [b.sent ? `sent ${money(b.sent)}` : '', b.received ? `got ${money(b.received)}` : '']
        .filter(Boolean)
        .join(', ') || '—';
      return `<tr><td>${n(b.memberId)}</td><td class="r">${money(b.paid)}</td><td class="r">${money(b.share)}</td><td class="r">${moved}</td><td class="r ${cls}"><b>${balanceWords(b.net)}</b></td></tr>`;
    })
    .join('');

  const categories = cats
    .map((c) => {
      const pct = d.total ? Math.round((c.amount / d.total) * 100) : 0;
      return `<tr><td>${esc(categoryOf(c.key).label)}</td><td class="bar-cell"><div class="bar" style="width:${(c.amount / maxCat) * 100}%"></div></td><td class="r">${pct}%</td><td class="r">${money(c.amount)}</td></tr>`;
    })
    .join('');

  const expenses = d.expenses
    .map(
      (e) => `<tr>
        <td class="nowrap">${esc(longDate(e.date))}</td>
        <td><b>${esc(e.title)}</b><div class="muted">${esc(categoryOf(e.category).label)}${e.note ? ` · ${esc(e.note)}` : ''}</div></td>
        <td>${esc(payerLong(e, d.names))}</td>
        <td>${esc(splitLong(e, d.names, group.members.length))}</td>
        <td class="r nowrap"><b>${money(e.amount)}</b></td>
      </tr>`,
    )
    .join('');

  const payments = group.payments.length
    ? `<h2>Payments already made</h2><table><tr><th>Date</th><th>From</th><th>To</th><th class="r">Amount</th></tr>${group.payments
        .map(
          (p) => `<tr><td>${esc(new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${n(p.from)}</td><td>${n(p.to)}</td><td class="r">${money(p.amount)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(group.name)} — expenses</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; color: #241012; margin: 0; padding: 28px; font-size: 12px; }
  header { background: #7A1F2B; color: #fff; border-radius: 14px; padding: 18px 22px; display: flex; align-items: center; gap: 16px; }
  header .logo { width: 52px; height: 52px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,.35); flex-shrink: 0; }
  header h1 { margin: 0 0 4px; font-size: 22px; }
  header .sub { opacity: .8; }
  .tiles { display: flex; gap: 10px; margin: 16px 0 6px; }
  .tile { flex: 1; border: 1px solid #EADCDA; border-radius: 10px; padding: 10px 12px; }
  .tile .k { color: #8A6F72; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  .tile .v { font-size: 17px; font-weight: 800; margin-top: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: #7A1F2B; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; color: #8A6F72; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1.5px solid #EADCDA; padding: 6px; }
  td { padding: 7px 6px; border-bottom: 1px solid #F4E6E4; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .r { text-align: right; }
  .nowrap { white-space: nowrap; }
  .muted { color: #8A6F72; font-size: 11px; margin-top: 1px; }
  .pos { color: #2E7D32; } .neg { color: #C62828; }
  .transfer { display: flex; justify-content: space-between; align-items: center; border: 1px solid #EADCDA; border-left: 4px solid #7A1F2B; border-radius: 8px; padding: 10px 12px; margin-bottom: 6px; font-size: 13px; }
  .transfer .amt { font-weight: 800; color: #7A1F2B; font-size: 15px; }
  .settled { color: #2E7D32; font-weight: 700; }
  .bar-cell { width: 45%; }
  .bar { height: 8px; border-radius: 4px; background: #A6414C; min-width: 2px; }
  footer { margin-top: 28px; color: #8A6F72; font-size: 10px; text-align: center; }
</style></head>
<body>
  <header>
    <img class="logo" src="${LOGO_DATA_URI}" alt="Vilarci">
    <div>
      <h1>${esc(group.name)}</h1>
      <div class="sub">${esc(groupKindOf(group.kind).label)} · ${plural(group.members.length, 'person')}${d.range ? ` · ${esc(d.range)}` : ''}</div>
    </div>
  </header>
  <div class="tiles">
    <div class="tile"><div class="k">Total spent</div><div class="v">${money(d.total)}</div></div>
    <div class="tile"><div class="k">Per person avg</div><div class="v">${money(avg)}</div></div>
    <div class="tile"><div class="k">Expenses</div><div class="v">${group.expenses.length}</div></div>
  </div>

  <h2>Who pays whom</h2>
  ${transfers}

  <h2>Balances</h2>
  <table><tr><th>Person</th><th class="r">Paid</th><th class="r">Fair share</th><th class="r">Settle-up payments</th><th class="r">Balance</th></tr>${balances}</table>

  ${cats.length ? `<h2>Spending by category</h2><table>${categories}</table>` : ''}

  <h2>All expenses</h2>
  ${d.expenses.length ? `<table><tr><th>Date</th><th>Item</th><th>Paid by</th><th>Split</th><th class="r">Amount</th></tr>${expenses}</table>` : '<p class="muted">No expenses yet.</p>'}

  ${payments}

  <footer>Made with Vilarci Split · ${esc(now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</footer>
</body></html>`;
}
