/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inviteCode, isOurLink, joinPathCode } from '../invite';

describe('invite links', () => {
  it('reads the code from /join/<code> and ?c=, like the website', () => {
    assert.equal(inviteCode('https://esplit.vilarci.in/join/K7QM2XPA'), 'K7QM2XPA');
    assert.equal(inviteCode('esplit.vilarci.in/join/k7qm-2xpa/'), 'K7QM2XPA', 'no scheme, lower case, a dash');
    assert.equal(inviteCode('https://esplit.vilarci.in/?c=K7QM2XPA'), 'K7QM2XPA');
    assert.equal(inviteCode('  https://ESPLIT.vilarci.in/join/K7QM%202XPA  '), 'K7QM2XPA');
  });

  it('turns down broken codes and other sites', () => {
    assert.equal(inviteCode('https://esplit.vilarci.in/join/K7QM2XP0'), null, '0 is never used');
    assert.equal(inviteCode('https://esplit.vilarci.in/join/SHORT'), null);
    assert.equal(inviteCode('https://esplit.vilarci.in/'), null);
    assert.equal(inviteCode('https://evil.example/join/K7QM2XPA'), null);
    assert.equal(inviteCode('https://esplit.vilarci.in.evil.example/join/K7QM2XPA'), null);
    assert.equal(inviteCode('K7QM2XPA'), null, 'a bare code is not a link');
  });

  it('tells our links from anything else', () => {
    assert.equal(isOurLink('https://esplit.vilarci.in/join/BAD'), true);
    assert.equal(isOurLink('esplit.vilarci.in'), true);
    assert.equal(isOurLink('https://esplit.vilarci.in.evil.example/'), false);
    assert.equal(isOurLink('WIFI:S:home;T:WPA;P:secret;;'), false);
  });
});

describe('links that open the app', () => {
  it('reads the code from the path the navigator gives', () => {
    assert.equal(joinPathCode('join/K7QM2XPA'), 'K7QM2XPA');
    assert.equal(joinPathCode('/join/k7qm-2xpa/'), 'K7QM2XPA');
    assert.equal(joinPathCode('?c=K7QM2XPA'), 'K7QM2XPA');
  });

  it('a join link with a broken code is still a join link', () => {
    assert.equal(joinPathCode('join/K7QM2XP0'), '');
    assert.equal(joinPathCode('join'), '');
  });

  it('anything else is not a join link', () => {
    assert.equal(joinPathCode(''), null);
    assert.equal(joinPathCode('privacy'), null);
    assert.equal(joinPathCode('joinery/K7QM2XPA'), null);
  });
});
