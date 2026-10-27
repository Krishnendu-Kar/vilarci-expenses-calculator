/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuickExpenses, matchMember, parseQuickAdd, resolveDrafts, rowProblem, type Draft } from '../quickAdd';
import { computeBalances, groupTotal } from '../split';
import { group } from './fixtures';

const MEMBERS = [
  { id: 'krish', name: 'Krish' },
  { id: 'tamal', name: 'Tamal' },
  { id: 'sayak', name: 'Sayak' },
  { id: 'me', name: 'Sukrish' },
];

// The user's real group-chat messages.
const LIST = `Krish - 48,80,64,180(3) ,120
Tamal - 36,360,160
Sayak- 140
Me - 60,48`;

const show = (d: Draft) =>
  [d.payer, d.amount / 100, d.label ?? null, d.forNames ?? 'everyone', d.forCount ?? null] as const;
const parse = (text: string) => parseQuickAdd(text, MEMBERS);

describe('parseQuickAdd: lists', () => {
  it('reads the list message', () => {
    const { drafts, errors } = parse(LIST);
    assert.deepEqual(errors, []);
    assert.deepEqual(drafts.map(show), [
      ['Krish', 48, null, 'everyone', null],
      ['Krish', 80, null, 'everyone', null],
      ['Krish', 64, null, 'everyone', null],
      ['Krish', 180, null, 'everyone', 3],
      ['Krish', 120, null, 'everyone', null],
      ['Tamal', 36, null, 'everyone', null],
      ['Tamal', 360, null, 'everyone', null],
      ['Tamal', 160, null, 'everyone', null],
      ['Sayak', 140, null, 'everyone', null],
      ['Me', 60, null, 'everyone', null],
      ['Me', 48, null, 'everyone', null],
    ]);
  });

  it('accepts other separators, ₹/Rs, decimals, and names not in the group yet', () => {
    const { drafts, errors } = parse('Asha: ₹48.50 + Rs 20; 30\nBilal = 10 20\nOm Prakash 99');
    assert.deepEqual(errors, []);
    assert.deepEqual(
      drafts.map((d) => [d.payer, d.amount / 100]),
      [
        ['Asha', 48.5],
        ['Asha', 20],
        ['Asha', 30],
        ['Bilal', 10],
        ['Bilal', 20],
        ['Om Prakash', 99],
      ],
    );
  });

  it('turns words next to an amount into its title', () => {
    const { drafts } = parse('Tamal - 120 rice, oil 85, 40(2) milk');
    assert.deepEqual(
      drafts.map((d) => [d.amount / 100, d.label, d.forCount ?? null]),
      [
        [120, 'rice', null],
        [85, 'oil', null],
        [40, 'milk', 2],
      ],
    );
  });

  it('joins a wrapped line to the person above', () => {
    const { drafts, errors } = parse('Krish - 48, 80\n\n  64, 120\nMe - 5');
    assert.deepEqual(errors, []);
    assert.deepEqual(
      drafts.map((d) => [d.payer, d.amount / 100]),
      [
        ['Krish', 48],
        ['Krish', 80],
        ['Krish', 64],
        ['Krish', 120],
        ['Me', 5],
      ],
    );
  });

  it('strips the WhatsApp copy prefix', () => {
    const { drafts } = parse('[28/10, 11:28 am] Sayak Das: Tamal - 36, 360');
    assert.deepEqual(
      drafts.map((d) => [d.payer, d.amount / 100]),
      [
        ['Tamal', 36],
        ['Tamal', 360],
      ],
    );
  });

  it('leaves the payer open when two names share amounts with no "paid"', () => {
    assert.equal(parse('Krish+Tamal 50').drafts[0].payer, null);
  });

  it('explains mistakes with line numbers', () => {
    const { drafts, errors } = parse('Krish - 48, abc\n50, 60\nTamal\nSayak - 12.345, 0, 30(0)');
    assert.deepEqual(
      drafts.map((d) => d.amount / 100),
      [48, 50, 60],
    );
    assert.deepEqual(
      errors.map((e) => e.line),
      [1, 3, 4, 4, 4],
    );
    assert.match(errors[0].message, /"abc" isn't an amount or a name/);
    assert.match(errors[1].message, /No amounts found/);
    assert.match(parse('48, 80').errors[0].message, /who paid/);
  });
});

describe('parseQuickAdd: chat sentences', () => {
  it('Tamal 290', () => {
    assert.deepEqual(parse('Tamal 290').drafts.map(show), [['Tamal', 290, null, 'everyone', null]]);
  });

  it('Krish 50+50+sayak60: names switch who paid', () => {
    assert.deepEqual(parse('Krish 50+50+sayak60').drafts.map(show), [
      ['Krish', 50, null, 'everyone', null],
      ['Krish', 50, null, 'everyone', null],
      ['sayak', 60, null, 'everyone', null],
    ]);
  });

  it('Tamal 30 auto amar ar kish ami diyachi: I paid, for the three named (with a typo)', () => {
    assert.deepEqual(parse('Tamal 30 auto amar ar kish ami diyachi').drafts.map(show), [
      ['ami', 30, 'auto', ['Tamal', 'amar', 'kish'], null],
    ]);
  });

  it('Krish+tamal khabr 50 ami diyachi: I paid for two of them', () => {
    assert.deepEqual(parse('Krish+tamal khabr 50 ami diyachi').drafts.map(show), [
      ['ami', 50, 'khabr', ['Krish', 'tamal'], null],
    ]);
  });

  it('Sayak roll 40 and krish 24 ami pabo: each owes me their own amount', () => {
    assert.deepEqual(parse('Sayak roll 40 and krish 24 ami pabo').drafts.map(show), [
      ['ami', 40, 'roll', ['Sayak'], null],
      ['ami', 24, null, ['krish'], null],
    ]);
  });

  it('English forms: owes, paid … for, paid by', () => {
    assert.deepEqual(parse('Krish owes me 50').drafts.map(show), [['me', 50, null, ['Krish'], null]]);
    assert.deepEqual(parse('Tamal paid 90 for Sayak').drafts.map(show), [['Tamal', 90, null, ['Sayak'], null]]);
    assert.deepEqual(parse('paid by Sayak 20 snacks').drafts.map(show), [['Sayak', 20, 'snacks', 'everyone', null]]);
    assert.deepEqual(parse('I paid 300 for Krish and Tamal').drafts.map(show), [['I', 300, null, ['Krish', 'Tamal'], null]]);
  });
});

describe('matchMember', () => {
  const members = [
    { id: 'k', name: 'Krishnendu Kar' },
    { id: 't', name: 'Tamal' },
    { id: 's1', name: 'Sayak' },
    { id: 's2', name: 'Sayan' },
    { id: 'u', name: 'Sukrish' },
  ];
  it('matches exact, first name, prefix, a one-letter typo and "me"', () => {
    assert.equal(matchMember('tamal', members), 't');
    assert.equal(matchMember('Krishnendu', members), 'k');
    assert.equal(matchMember('Krish', members), 'k');
    assert.equal(matchMember('Tamol', members), 't');
    assert.equal(matchMember('ami', members, 'u'), 'u');
    assert.equal(matchMember('me', members), null);
  });
  it('refuses to guess when it is ambiguous or unknown', () => {
    assert.equal(matchMember('Saya', members), null);
    assert.equal(matchMember('Sayam', members), null);
    assert.equal(matchMember('Rahul', members), null);
  });
});

describe('resolve and build', () => {
  const ids = MEMBERS.map((m) => m.id);
  let n = 0;
  const newId = () => `x${n++}`;
  const map = (drafts: Draft[]) => {
    const out: Record<string, string | null> = {};
    for (const d of drafts) for (const name of [d.payer, ...(d.forNames ?? [])]) {
      if (name) out[name.toLowerCase()] = matchMember(name, MEMBERS, 'me');
    }
    return out;
  };
  const opts = { everyone: ids, date: '2026-10-28', category: 'food' as const, now: 1000 };

  it('the whole chat adds up, and needs the (3) pick before saving', () => {
    const chat = `${LIST}\nTamal 290\nKrish 50+50+sayak60\nTamal 30 auto amar ar kish ami diyachi\nKrish+tamal khabr 50 ami diyachi\nSayak roll 40 and krish 24 ami pabo`;
    const { drafts, errors } = parse(chat);
    assert.deepEqual(errors, []);
    const rows = resolveDrafts(drafts, map(drafts), 'Food');

    assert.equal(buildQuickExpenses(rows, opts, newId), null);
    const boat = rows.find((r) => r.needCount === 3)!;
    assert.equal(rowProblem(boat), 'Pick the 3 people it was for');
    boat.among = ['krish', 'tamal', 'sayak'];

    const expenses = buildQuickExpenses(rows, opts, newId)!;
    assert.equal(expenses.length, 19);
    const g = group(ids, []);
    g.members = MEMBERS;
    g.expenses = expenses;
    assert.equal(groupTotal(g) / 100, 1296 + 290 + 160 + 30 + 50 + 64);

    const auto = expenses.find((e) => e.title === 'auto')!;
    assert.deepEqual(auto.payers, { me: 3000 });
    assert.deepEqual(auto.splitAmong, ['tamal', 'me', 'krish']);
    const roll = expenses.find((e) => e.title === 'roll')!;
    assert.deepEqual([roll.payers, roll.splitAmong], [{ me: 4000 }, ['sayak']]);
    assert.equal(Object.values(computeBalances(g)).reduce((s, b) => s + b.net, 0), 0);
  });

  it('asks about names it cannot match', () => {
    const { drafts } = parse('Rahul 50');
    const [row] = resolveDrafts(drafts, map(drafts), 'Food');
    assert.equal(rowProblem(row), 'Pick who paid');
  });

  it('keeps the typed order when the list is sorted newest first', () => {
    const { drafts } = parse('Krish - 1, 2');
    const [a, b] = buildQuickExpenses(resolveDrafts(drafts, map(drafts), 'Food'), opts, newId)!;
    assert.ok(b.createdAt > a.createdAt);
    assert.equal(a.title, 'Food');
  });
});
