import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sha1Hex, uuid5 } from '../uuid5';

describe('uuid5', () => {
  it('hashes like SHA-1 (standard test values)', () => {
    assert.equal(sha1Hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
    assert.equal(sha1Hex(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
    // Longer than one 64-byte block.
    assert.equal(
      sha1Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    );
  });

  it("gives the same id as Python's uuid.uuid5", () => {
    // uuid.uuid5(uuid.NAMESPACE_DNS, 'python.org')
    assert.equal(uuid5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });
});
