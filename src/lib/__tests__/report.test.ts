/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHtmlReport, buildTextReport } from '../report';
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

  it('embeds the logo so the PDF needs no network or asset access', () => {
    assert.match(buildHtmlReport(g()), /<img class="logo" src="data:image\/png;base64,[A-Za-z0-9+/=]{1000,}"/);
  });
});
