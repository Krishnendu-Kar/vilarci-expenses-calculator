/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorKey, isEmail, cleanCode, isCode } from '../accountRules';

describe('sign-up codes', () => {
  it('takes 6 to 10 digits, spaces and dashes allowed', () => {
    assert.equal(isCode('123456'), true);
    assert.equal(isCode(' 123 456 '), true);
    assert.equal(isCode('123-456'), true);
    assert.equal(cleanCode('123 456'), '123456');
    assert.equal(isCode('12345'), false);
    assert.equal(isCode('12345a'), false);
    assert.equal(isCode('12345678901'), false);
  });

  it('a wrong or old code gets its own message', () => {
    assert.equal(authErrorKey({ code: 'otp_expired' }), 'account.err.badCode');
  });
});

describe('account rules', () => {
  it('checks email addresses loosely, the server has the last word', () => {
    for (const ok of ['krish@gmail.com', ' krish.kar+1@vilarci.in ', 'a@b.co']) assert.ok(isEmail(ok), ok);
    for (const bad of ['', 'krish', 'krish@', '@gmail.com', 'krish@gmail', 'kr ish@gmail.com', 'krish@gmail.c']) assert.ok(!isEmail(bad), bad);
  });

  it('turns Supabase errors into our own messages', () => {
    assert.equal(authErrorKey({ code: 'invalid_credentials', message: 'Invalid login credentials' }), 'account.err.invalidLogin');
    assert.equal(authErrorKey({ code: 'email_not_confirmed' }), 'account.err.notConfirmed');
    assert.equal(authErrorKey({ code: 'user_already_exists' }), 'account.err.exists');
    assert.equal(authErrorKey({ code: 'over_email_send_rate_limit' }), 'account.err.tooMany');
    assert.equal(authErrorKey({ name: 'AuthRetryableFetchError', message: 'Network request failed' }), 'account.err.offline');
    assert.equal(authErrorKey(new TypeError('Failed to fetch')), 'account.err.offline');
    assert.equal(authErrorKey({ code: 'something_new' }), 'account.err.generic');
    assert.equal(authErrorKey(undefined), 'account.err.generic');
  });
});
