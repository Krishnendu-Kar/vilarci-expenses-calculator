import type { Group } from '../types';
import {
  categoryTotals,
  computeBalances,
  counted,
  groupTotal,
  isSettled,
  suggestTransfers,
  type MemberBalance,
  type Transfer,
} from './split';
import { balanceWords, payerLong, splitLong } from './describe';
import { money } from './money';
import { longDate } from './format';
import { categoryOf, groupKindOf } from '../data/categories';
import { LOGO_DATA_URI } from '../data/logo';
import { dateLocale, getLang, translate as t } from '../i18n';

// Reports for people who don't have the app: a chat message and a PDF.
// Both are built from the same numbers the app shows, in the app's language.

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
  // Archived expenses aren't part of the numbers, so reports leave them out.
  const expenses = group.expenses
    .filter(counted)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
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

/** WhatsApp-friendly text (*bold* renders in WhatsApp, reads fine elsewhere). */
export function buildTextReport(group: Group) {
  const d = collect(group);
  const lines: string[] = [
    t('report.title', { name: group.name }),
    [t('count.person', { count: group.members.length }), t('count.expense', { count: d.expenses.length }), d.range]
      .filter(Boolean)
      .join(' · '),
    t('report.total', { amount: money(d.total) }),
    '',
  ];

  lines.push(t('report.whoPays'));
  if (d.transfers.length === 0) lines.push(t('report.allSettled'));
  for (const tr of d.transfers) {
    lines.push(t('report.pays', { from: d.names[tr.from], to: d.names[tr.to], amount: money(tr.amount) }));
  }
  lines.push('');

  lines.push(t('report.balances'));
  for (const b of [...d.balances].sort((x, y) => y.net - x.net)) {
    lines.push(
      t('report.balanceLine', {
        name: d.names[b.memberId],
        paid: money(b.paid),
        share: money(b.share),
        result: balanceWords(b.net),
      }),
    );
  }
  lines.push('');

  lines.push(t('report.expenses'));
  let day = '';
  for (const e of d.expenses) {
    if (e.date !== day) {
      day = e.date;
      lines.push(`_${longDate(day)}_`);
    }
    lines.push(`• ${e.title} — ${money(e.amount)}`);
    const split = splitLong(e, d.names, group.members.length);
    const splitText = e.splitMode === 'equal' ? split : t('report.splitCustom', { split });
    lines.push(`   ${t('report.paidBy', { payers: payerLong(e, d.names), split: splitText })}`);
    if (e.note) lines.push(`   📝 ${e.note}`);
  }

  if (group.payments.length) {
    lines.push('', t('report.paymentsMade'));
    for (const p of group.payments) {
      lines.push(t('report.paymentLine', { from: d.names[p.from], to: d.names[p.to], amount: money(p.amount) }));
    }
  }

  lines.push('', t('report.footer'));
  return lines.join('\n');
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const fullDate = (d: Date) => d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

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
          (tr) =>
            `<div class="transfer"><span>${t('pdf.pays', { from: `<b>${n(tr.from)}</b>`, to: `<b>${n(tr.to)}</b>` })}</span><span class="amt">${money(tr.amount)}</span></div>`,
        )
        .join('')
    : `<p class="settled">${esc(t('report.allSettled'))}</p>`;

  const balances = [...d.balances]
    .sort((a, b) => b.net - a.net)
    .map((b) => {
      const cls = isSettled(b.net) ? '' : b.net > 0 ? 'pos' : 'neg';
      const moved =
        [b.sent ? t('pdf.sent', { amount: money(b.sent) }) : '', b.received ? t('pdf.got', { amount: money(b.received) }) : '']
          .filter(Boolean)
          .join(', ') || '—';
      return `<tr><td>${n(b.memberId)}</td><td class="r">${money(b.paid)}</td><td class="r">${money(b.share)}</td><td class="r">${esc(moved)}</td><td class="r ${cls}"><b>${esc(balanceWords(b.net))}</b></td></tr>`;
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
    ? `<h2>${esc(t('pdf.paymentsMade'))}</h2><table><tr><th>${esc(t('pdf.date'))}</th><th>${esc(t('pdf.from'))}</th><th>${esc(t('pdf.to'))}</th><th class="r">${esc(t('pdf.amount'))}</th></tr>${group.payments
        .map(
          (p) =>
            `<tr><td>${esc(fullDate(new Date(p.createdAt)))}</td><td>${n(p.from)}</td><td>${n(p.to)}</td><td class="r">${money(p.amount)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  const sub = [esc(groupKindOf(group.kind).label), esc(t('count.person', { count: group.members.length })), d.range ? esc(d.range) : '']
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="${getLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('pdf.docTitle', { name: group.name }))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Segoe UI', 'Noto Sans', Arial, sans-serif; color: #241012; margin: 0; padding: 28px; font-size: 12px; }
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
      <div class="sub">${sub}</div>
    </div>
  </header>
  <div class="tiles">
    <div class="tile"><div class="k">${esc(t('pdf.totalSpent'))}</div><div class="v">${money(d.total)}</div></div>
    <div class="tile"><div class="k">${esc(t('pdf.avg'))}</div><div class="v">${money(avg)}</div></div>
    <div class="tile"><div class="k">${esc(t('pdf.expenses'))}</div><div class="v">${d.expenses.length}</div></div>
  </div>

  <h2>${esc(t('pdf.whoPays'))}</h2>
  ${transfers}

  <h2>${esc(t('pdf.balances'))}</h2>
  <table><tr><th>${esc(t('pdf.person'))}</th><th class="r">${esc(t('pdf.paid'))}</th><th class="r">${esc(t('pdf.fairShare'))}</th><th class="r">${esc(t('pdf.settlePayments'))}</th><th class="r">${esc(t('pdf.balance'))}</th></tr>${balances}</table>

  ${cats.length ? `<h2>${esc(t('pdf.byCategory'))}</h2><table>${categories}</table>` : ''}

  <h2>${esc(t('pdf.allExpenses'))}</h2>
  ${d.expenses.length ? `<table><tr><th>${esc(t('pdf.date'))}</th><th>${esc(t('pdf.item'))}</th><th>${esc(t('pdf.paidBy'))}</th><th>${esc(t('pdf.split'))}</th><th class="r">${esc(t('pdf.amount'))}</th></tr>${expenses}</table>` : `<p class="muted">${esc(t('pdf.noExpenses'))}</p>`}

  ${payments}

  <footer>${esc(t('pdf.footer', { date: fullDate(now) }))}</footer>
</body></html>`;
}
