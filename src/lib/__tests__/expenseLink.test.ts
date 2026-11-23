/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expenseLink, expensePath, packId, shareLink, unpackId } from '../expenseLink';
import { DEFAULT_SETTINGS } from '../permissions';

const G = '0b9e5c1e-8d2c-4b4f-9f0e-3c2d1a7b6e5f';
const E = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

describe('ids in a link', () => {
  it('packs a UUID into 22 URL-safe characters and back', () => {
    for (const id of [G, E, '00000000-0000-0000-0000-000000000000', ...Array.from({ length: 50 }, () => randomUUID())]) {
      const packed = packId(id);
      assert.ok(packed && /^[A-Za-z0-9_-]{22}$/.test(packed), `${id} → ${packed}`);
      assert.equal(unpackId(packed!), id);
    }
    assert.equal(unpackId(packId(G.toUpperCase())!), G, 'always lower case');
  });

  it('turns down anything that is not a UUID', () => {
    assert.equal(packId('g1'), null);
    assert.equal(packId(`${G}0`), null);
    assert.equal(unpackId('short'), null);
    assert.equal(unpackId('A'.repeat(23)), null);
    assert.equal(unpackId(`${'A'.repeat(21)}=`), null);
    // The last character only holds 2 bits: another spelling of the same id is refused.
    const packed = packId(G)!;
    const other = packed.slice(0, 21) + String.fromCharCode(packed.charCodeAt(21) + 1);
    assert.equal(unpackId(other), null);
  });
});

describe('expense links', () => {
  it('builds the link and reads it back from the paths that open the app', () => {
    const link = expenseLink(G, E)!;
    assert.match(link, /^https:\/\/esplit\.vilarci\.in\/e\/[A-Za-z0-9_-]{22}\/[A-Za-z0-9_-]{22}$/);
    assert.ok(link.length < 80, `short enough for a chat: ${link.length}`);
    const path = link.replace('https://esplit.vilarci.in/', '');
    assert.deepEqual(expensePath(path), { groupId: G, expenseId: E });
    assert.deepEqual(expensePath(`/${path}/`), { groupId: G, expenseId: E }, 'slashes around');
    assert.deepEqual(expensePath(`${path}?utm_source=whatsapp`), { groupId: G, expenseId: E }, 'a query');
  });

  it('an expense link that cannot be read is broken, not something else', () => {
    assert.equal(expensePath('e'), 'broken');
    assert.equal(expensePath('e/abc/def'), 'broken');
    assert.equal(expensePath(`e/${packId(G)}`), 'broken');
    assert.equal(expensePath(`e/${packId(G)}/${packId(E)}/more`), 'broken');
  });

  it('leaves other links alone', () => {
    assert.equal(expensePath('join/K7QM2XPA'), null);
    assert.equal(expensePath('?c=K7QM2XPA'), null);
    assert.equal(expensePath('expenses'), null);
    assert.equal(expensePath(''), null);
  });

  it('only live groups still on the server get a link', () => {
    const online = { role: 'member' as const, status: 'active' as const, settings: DEFAULT_SETTINGS };
    assert.equal(shareLink({ id: G }, E), null, 'a group on this phone only');
    assert.equal(shareLink({ id: G, online }, E), expenseLink(G, E));
    assert.equal(shareLink({ id: G, online: { ...online, role: null, status: 'left' } }, E), expenseLink(G, E), 'others are still in it');
    assert.equal(shareLink({ id: G, online: { ...online, status: 'gone' } }, E), null);
    assert.equal(shareLink({ id: G, online: { ...online, deletedAt: 1 } }, E), null);
  });
});
