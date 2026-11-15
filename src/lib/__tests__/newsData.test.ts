/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNews, unseenCount } from '../newsData';

describe('news from Vilarci', () => {
  it('reads the list, newest first, dropping junk', () => {
    const items = parseNews([
      { id: 2, kind: 'update', title: '2.2.0 is out', body: 'Reminders and more', url: 'https://play.google.com/x', at: 20 },
      { id: 5, kind: 'important', title: ' Server work tonight ', body: '10–11 pm', at: 50 },
      { id: 3, kind: 'weird', title: 'Hello', body: 'Hi', url: 'javascript:alert(1)', at: 30 },
      { id: 0, title: 'no id' },
      { id: 9, title: '' },
      'nope',
    ]);
    assert.deepEqual(items.map((n) => n.id), [5, 3, 2]);
    assert.equal(items[0].title, 'Server work tonight', 'trimmed');
    assert.equal(items[1].kind, 'news', 'unknown kind → news');
    assert.equal(items[1].url, undefined, 'only https links');
    assert.equal(items[2].url, 'https://play.google.com/x');
    assert.deepEqual(parseNews(null), []);
  });

  it('counts what you have not seen', () => {
    const items = parseNews([{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }]);
    assert.equal(unseenCount(items, 0), 3);
    assert.equal(unseenCount(items, 2), 1);
    assert.equal(unseenCount(items, 3), 0);
  });
});
