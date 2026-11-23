/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildExpenseText, buildHtmlReport, buildTextReport } from '../report';
import { expense, group } from './fixtures';

const P = ['A', 'B', 'C'];
const g = () =>
  group(P, [
    { ...expense('Hotel', 3000, 'A', P, { date: '2026-10-25' }), note: 'Room 12' },
    expense('Boat', 1500, { B: 100000, C: 50000 }, ['A', 'B'], { date: '2026-10-26' }),
  ]);

describe('text report', () => {
  it('lists who pays whom, balances and every expense', () => {
    const text = buildTextReport(g());
    assert.match(text, /Total spent: \*₹4,500\*/);
    assert.match(text, /25 Oct 2026 – 26 Oct 2026/);
    assert.match(text, /➡️ Person C pays Person A \*₹500\*/);
    assert.match(text, /Person B: paid ₹1,000, share ₹1,750 → owes ₹750/);
    assert.match(text, /paid by Person B ₹1,000 \+ Person C ₹500, for Person A & Person B/);
    assert.match(text, /📝 Room 12/);
    assert.match(text, /^3 people · 2 expenses/m);
  });

  it('labels custom splits so they read apart from the payers', () => {
    const custom = group(P, [expense('Dinner', 300, { A: 20000, B: 10000 }, P, { mode: 'shares', values: { A: 1, B: 1, C: 1 } })]);
    assert.match(buildTextReport(custom), /paid by Person A ₹200 \+ Person B ₹100, split Person A ₹100, Person B ₹100, Person C ₹100/);
  });

  it('says when everyone is settled', () => {
    assert.match(buildTextReport(group(P, [])), /Everyone is settled up/);
  });

  it('adds where to pay you by UPI, only when someone owes you', () => {
    const upiIds = [{ vpa: 'a@okaxis', label: 'GPay' }, { vpa: 'a@ybl' }];
    // A gets money back from B and C.
    assert.match(buildTextReport(g(), { memberId: 'A', upiIds }), /Pay Person A by UPI: a@okaxis, a@ybl/);
    assert.doesNotMatch(buildTextReport(g(), { memberId: 'B', upiIds }), /by UPI/, 'B owes, nobody pays B');
    assert.doesNotMatch(buildTextReport(g(), { memberId: 'A', upiIds: [] }), /by UPI/);
    assert.doesNotMatch(buildTextReport(g()), /by UPI/);
  });
});

describe('one expense as a message', () => {
  const LINK = 'https://esplit.vilarci.in/e/x/y';

  it('says what it was, who paid and each person’s part, with the link', () => {
    const e = { ...expense('Dinner', 2400, 'A', P, { date: '2026-11-22' }), category: 'food' as const, note: 'bill no. 4512' };
    const text = buildExpenseText(group(P, [e]), e, LINK);
    assert.match(text, /^🧾 \*Dinner\* — ₹2,400$/m);
    assert.match(text, /^Test · 22 Nov 2026 · Food$/m);
    assert.match(text, /^💳 Paid by Person A$/m);
    assert.match(text, /^➗ Split equally:\n• Person A ₹800\n• Person B ₹800\n• Person C ₹800$/m);
    assert.match(text, /^📝 bill no\. 4512$/m);
    assert.match(text, /^🔗 Open it in Vilarci E-Split: https:\/\/esplit\.vilarci\.in\/e\/x\/y$/m);
    assert.match(text, /_Made with Vilarci E-Split_$/);
  });

  it('a group on this phone only goes without a link', () => {
    const e = expense('Cab', 300, 'A', P);
    assert.doesNotMatch(buildExpenseText(group(P, [e]), e, null), /Open it in|https?:/);
  });

  it('several payers, and the parts of each split', () => {
    const many = expense('Boat', 1500, { B: 100000, C: 50000 }, ['A', 'B']);
    assert.match(buildExpenseText(group(P, [many]), many), /Paid by Person B ₹1,000 \+ Person C ₹500/);
    const shares = expense('Pizza', 300, 'A', P, { mode: 'shares', values: { A: 2, B: 1, C: 1 } });
    assert.match(buildExpenseText(group(P, [shares]), shares), /➗ Split by shares:\n• Person A ₹150 \(2x\)\n• Person B ₹75 \(1x\)/);
    const pct = expense('Rent', 1000, 'A', ['A', 'B'], { mode: 'percent', values: { A: 7500, B: 2500 } });
    assert.match(buildExpenseText(group(P, [pct]), pct), /➗ Split by %:\n• Person A ₹750 \(75%\)\n• Person B ₹250 \(25%\)/);
    const exact = expense('Gift', 100, 'A', ['B', 'C'], { mode: 'exact', values: { B: 6000, C: 4000 } });
    assert.match(buildExpenseText(group(P, [exact]), exact), /➗ Split by exact amounts:\n• Person B ₹60\n• Person C ₹40/);
  });

  it('says when it isn’t counted, and the month a hostel expense counts for', () => {
    const e = { ...expense('Gas', 900, 'A', P, { date: '2026-11-02' }), month: '2026-10', archivedAt: 5 };
    const hostel = { ...group(P, [e]), kind: 'hostel' as const };
    const text = buildExpenseText(hostel, e);
    assert.match(text, /· For October 2026$/m);
    assert.match(text, /_Archived: not counted in totals or balances_/);
  });
});

describe('html report', () => {
  it('escapes names and titles people typed', () => {
    const evil = g();
    evil.members[0].name = '<script>x</script>';
    evil.expenses[0].title = 'Tom & Jerry "Café"';
    const html = buildHtmlReport(evil);
    assert.ok(!html.includes('<script>x'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(html.includes('Tom &amp; Jerry &quot;Café&quot;'));
  });

  it('includes the settle-up and totals', () => {
    const html = buildHtmlReport(g());
    assert.ok(html.includes('₹4,500'));
    assert.ok(html.includes('<b>Person C</b> pays <b>Person A</b>'));
  });

  it('shows your UPI id under who pays whom', () => {
    const html = buildHtmlReport(g(), new Date(2026, 10, 8), { memberId: 'A', upiIds: [{ vpa: 'a@okaxis' }] });
    assert.ok(html.includes('<p class="upi">💳 Pay Person A by UPI: a@okaxis</p>'));
  });

  it('embeds the logo so the PDF needs no network or asset access', () => {
    assert.match(buildHtmlReport(g()), /<img class="logo" src="data:image\/png;base64,[A-Za-z0-9+/=]{1000,}"/);
  });
});
