import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeEvent, type ActivityEvent } from '../activity';

const names: Record<string, string> = { neha: 'Neha', rahul: 'Rahul', admin: 'Krish' };
const nameOf = (id: string) => names[id];
const NOV = Date.UTC(2026, 10, 10, 9);
const ev = (type: string, actor: string | null, data: Record<string, unknown>): ActivityEvent => ({
  id: 'e',
  type,
  actor,
  data,
  createdAt: NOV,
  seq: 1,
});

describe('Activity lines', () => {
  it('tells joining by the link from being let in', () => {
    assert.equal(describeEvent(ev('member_joined', 'rahul', { id: 'rahul', name: 'Rahul' }), nameOf).text, 'Rahul joined with the invite link');
    assert.equal(describeEvent(ev('member_joined', 'admin', { id: 'rahul', name: 'Rahul' }), nameOf).text, 'Krish let Rahul in');
  });

  it('says who left, who was removed, and deleting or restoring the group', () => {
    assert.equal(describeEvent(ev('member_left', 'neha', { id: 'neha', name: 'Neha' }), nameOf).text, 'Neha left');
    assert.equal(describeEvent(ev('member_removed', 'admin', { id: 'gone', name: 'Amit' }), nameOf).text, 'Krish removed Amit');
    assert.equal(describeEvent(ev('group_deleted', 'admin', { name: 'Goa' }), nameOf).text, 'Krish deleted the group for everyone');
    assert.equal(describeEvent(ev('group_restored', 'admin', { name: 'Goa' }), nameOf).text, 'Krish restored the group');
  });

  it('says who added, edited and deleted which expense, with the amounts', () => {
    assert.equal(
      describeEvent(ev('expense_added', 'neha', { title: 'Dinner', amount: 90000, date: '2026-11-09' }), nameOf).text,
      'Neha added "Dinner" (₹900)',
    );
    const edited = describeEvent(
      ev('expense_edited', 'neha', {
        title: 'Dinner',
        amount: 95000,
        date: '2026-11-09',
        archived: false,
        before: { title: 'Dinner', amount: 90000, date: '2026-11-09', archived: false },
      }),
      nameOf,
    );
    assert.equal(edited.text, 'Neha edited "Dinner"');
    assert.equal(edited.detail, '₹900 → ₹950');
    assert.equal(
      describeEvent(ev('expense_deleted', 'rahul', { title: 'Taxi', amount: 30000, date: '2026-11-09' }), nameOf).text,
      'Rahul deleted "Taxi" (₹300)',
    );
  });

  it("marks a change to an earlier month's expense with its date", () => {
    const line = describeEvent(ev('expense_added', 'neha', { title: 'Rent', amount: 100, date: '2026-10-12' }), nameOf);
    assert.match(line.detail ?? '', /^dated /);
  });

  it('names the group rename, settings, roles and guests', () => {
    assert.equal(
      describeEvent(ev('group_renamed', 'neha', { name: 'Goa 2026', kind: 'trip', before: { name: 'Goa', kind: 'trip' } }), nameOf).text,
      'Neha renamed the group from "Goa" to "Goa 2026"',
    );
    const settings = describeEvent(
      ev('settings_changed', 'admin', { add_expenses: 'admins', require_approval: true, before: { add_expenses: 'all', require_approval: true } }),
      nameOf,
    );
    assert.equal(settings.text, 'Krish changed the group settings');
    assert.equal(settings.detail, 'Add and edit expenses: Only admins');
    assert.equal(describeEvent(ev('role_changed', 'admin', { id: 'neha', role: 'admin' }), nameOf).text, 'Krish made Neha an admin');
    assert.equal(
      describeEvent(ev('guest_linked', 'admin', { guest_id: 'g', guest: 'Rahul K', id: 'rahul', name: 'Rahul' }), nameOf).text,
      'Krish linked guest Rahul K to Rahul',
    );
  });

  it('says who recorded a payment between whom', () => {
    assert.equal(
      describeEvent(ev('payment_added', 'neha', { from_id: 'neha', to_id: 'admin', amount: 200000 }), nameOf).text,
      'Neha recorded: Neha paid Krish ₹2,000',
    );
  });

  it('still says something for someone gone or a type it does not know', () => {
    assert.equal(describeEvent(ev('expense_added', 'gone', { title: 'X', amount: 100, date: '2026-11-01' }), nameOf).text, 'Someone added "X" (₹1)');
    assert.equal(describeEvent(ev('something_new', 'neha', {}), nameOf).text, 'Neha changed something in the group');
  });
});
