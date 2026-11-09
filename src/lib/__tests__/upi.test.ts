/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanVpa, isVpa, MAX_UPI, sameVpa, sanitizeUpiIds, vpaList } from '../upi';

describe('UPI ids', () => {
  it('accepts name@bank ids and rejects anything else', () => {
    for (const ok of ['krish@okaxis', 'krish.kar-1@ybl', '9876543210@paytm', 'Krish_K@okhdfcbank', 'krish @ okaxis']) {
      assert.ok(isVpa(ok), ok);
    }
    for (const bad of ['', 'krish', '@okaxis', 'krish@', 'k@okaxis', 'krish@1bank', 'kr ish@ok axis!', 'a@b@c', 'krish@ok_axis']) {
      assert.ok(!isVpa(bad), bad);
    }
  });

  it('drops spaces people paste, and matches ids whatever the case', () => {
    assert.equal(cleanVpa(' krish @okaxis '), 'krish@okaxis');
    assert.ok(sameVpa('Krish@OKAXIS', 'krish@okaxis'));
  });

  it('keeps valid, unique ids from storage, three at most, with short labels', () => {
    const stored = [
      { vpa: 'krish@okaxis', label: '  GPay  ' },
      { vpa: 'KRISH@okaxis' },
      { vpa: 'nope' },
      { vpa: 'krish@ybl', label: 'PhonePe and a much too long label' },
      null,
      { vpa: 'krish@paytm', label: 7 },
      { vpa: 'krish@apl' },
    ];
    const ids = sanitizeUpiIds(stored);
    assert.equal(ids.length, MAX_UPI);
    assert.deepEqual(ids, [
      { vpa: 'krish@okaxis', label: 'GPay' },
      { vpa: 'krish@ybl', label: 'PhonePe and a much t' },
      { vpa: 'krish@paytm' },
    ]);
    assert.deepEqual(sanitizeUpiIds('krish@okaxis'), []);
    assert.equal(vpaList(ids), 'krish@okaxis, krish@ybl, krish@paytm');
  });
});
