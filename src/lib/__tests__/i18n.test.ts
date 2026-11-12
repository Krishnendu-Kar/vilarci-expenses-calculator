/// <reference types="node" />
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, setLang, translate } from '../../i18n';
import { en, type Key } from '../../i18n/en';
import { hi } from '../../i18n/hi';
import { bn } from '../../i18n/bn';
import { ta } from '../../i18n/ta';
import { joinNames } from '../describe';

afterEach(() => setLang('en'));

const placeholders = (v: unknown) =>
  [...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translate', () => {
  it('fills placeholders and picks plurals', () => {
    assert.equal(translate('count.member', { count: 1 }), '1 member');
    assert.equal(translate('count.member', { count: 4 }), '4 members');
    assert.equal(translate('settle.markedPaid', { from: 'A', to: 'B', amount: '₹5' }), 'A paid B ₹5');
  });

  it('treats 0 as singular in Hindi and Bengali', () => {
    setLang('hi');
    assert.equal(translate('count.expense', { count: 0 }), translate('count.expense', { count: 1 }).replace('1', '0'));
  });

  it('joins names in the current language', () => {
    assert.equal(joinNames(['A', 'B', 'C']), 'A, B & C');
  });
});

describe('every language', () => {
  for (const [code, dict] of Object.entries({ hi, bn, ta })) {
    it(`${code} has every key, with the same placeholders`, () => {
      for (const key of Object.keys(en) as Key[]) {
        const value = dict[key];
        assert.ok(value, `${code} is missing ${key}`);
        assert.equal(typeof value, typeof en[key], `${code} ${key}: plural shape differs`);
        assert.equal(placeholders(value), placeholders(en[key]), `${code} ${key}: placeholders differ`);
      }
      assert.deepEqual(Object.keys(dict).filter((k) => !(k in en)), [], `${code} has keys English doesn't`);
    });
  }

  it('lists each language once', () => {
    assert.deepEqual(LANGS.map((l) => l.code), ['en', 'hi', 'bn', 'ta']);
  });
});
