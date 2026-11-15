/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease, releaseState, serverNow } from '../appRelease';

// 20 Nov 2026, 00:00 in India.
const FROM_AT = Date.UTC(2026, 10, 19, 18, 30);
const DAY = 24 * 60 * 60 * 1000;

const rpc = (over: Record<string, unknown> = {}) => ({
  min_code: 8,
  min_name: '3.5.0',
  min_from: '2026-11-20',
  min_from_at: FROM_AT,
  latest_code: 10,
  now: FROM_AT - 5 * DAY,
  ...over,
});

describe('outdated versions', () => {
  it('reads the server answer and the saved copy alike', () => {
    const phone = FROM_AT - 5 * DAY - 60_000; // phone a minute behind
    const r = parseRelease(rpc(), phone)!;
    assert.equal(r.offset, 60_000);
    assert.deepEqual(parseRelease(JSON.parse(JSON.stringify(r))), r, 'saved copy round-trips');
    assert.equal(parseRelease(null), null);
    assert.equal(parseRelease({ min_code: 3 }), null, 'no server time');
  });

  it('warns before the day, blocks from it', () => {
    const r = parseRelease(rpc(), FROM_AT - 5 * DAY)!;
    assert.deepEqual(releaseState(r, 7, FROM_AT - DAY), {
      kind: 'warn',
      minName: '3.5.0',
      minFrom: '2026-11-20',
    });
    assert.equal(releaseState(r, 7, FROM_AT - 1).kind, 'warn');
    assert.deepEqual(releaseState(r, 7, FROM_AT), {
      kind: 'blocked',
      minName: '3.5.0',
      minFrom: '2026-11-20',
    });
  });

  it('newer but not outdated: only the update offer; newest: nothing', () => {
    const r = parseRelease(rpc(), FROM_AT)!;
    assert.equal(releaseState(r, 8, FROM_AT + DAY).kind, 'update', 'the minimum itself is fine');
    assert.equal(releaseState(r, 10, FROM_AT + DAY).kind, 'ok');
    assert.equal(releaseState(r, 12, FROM_AT + DAY).kind, 'ok', 'newer than the server knows');
  });

  it("uses the server's clock: a phone set back can't undo the day", () => {
    // The server said it's already the 21st; the phone claims the 1st.
    const r = parseRelease(rpc({ now: FROM_AT + DAY }), Date.UTC(2026, 10, 1))!;
    assert.equal(releaseState(r, 7, Date.UTC(2026, 10, 1)).kind, 'blocked');
    // Set back further after that check: still never before the last server time.
    assert.equal(serverNow(r, Date.UTC(2020, 0, 1)), FROM_AT + DAY);
    assert.equal(releaseState(r, 7, Date.UTC(2020, 0, 1)).kind, 'blocked');
  });

  it('a phone set forward is held to the server too', () => {
    const r = parseRelease(rpc({ now: FROM_AT - 5 * DAY }), FROM_AT + 30 * DAY)!;
    assert.equal(releaseState(r, 7, FROM_AT + 30 * DAY).kind, 'warn');
  });

  it('nothing to say: no answer yet, no version, or nothing outdated', () => {
    assert.equal(releaseState(null, 7, FROM_AT).kind, 'ok');
    const r = parseRelease(rpc(), FROM_AT)!;
    assert.equal(releaseState(r, null, FROM_AT).kind, 'ok', 'unknown version (web)');
    const none = parseRelease(
      rpc({
        min_code: 0,
        min_name: null,
        min_from: null,
        min_from_at: null,
        latest_code: 5,
      }),
      FROM_AT,
    )!;
    assert.equal(releaseState(none, 1, FROM_AT + 99 * DAY).kind, 'update');
    assert.equal(releaseState(none, 5, FROM_AT + 99 * DAY).kind, 'ok');
  });
});
