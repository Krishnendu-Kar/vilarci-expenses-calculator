import type { CategoryKey, Expense, Member } from '../types';
import { toPaise } from './money';

// "Many at once": reads expenses the way people type them in a group chat,
// in English or Banglish, and turns them into draft expenses to review.
//
//   Krish - 48,80,64,180(3) ,120      Krish paid each amount for everyone;
//                                     180 was only for 3 people (picked later)
//   Krish 50+50+sayak60               Krish paid 50 and 50, Sayak paid 60
//   Krish+tamal khabr 50 ami diyachi  I paid 50 (food) for Krish and Tamal
//   Tamal 30 auto amar ar kish ami diyachi
//                                     I paid 30 (auto) for Tamal, me, Krish
//   Sayak roll 40 and krish 24 ami pabo
//                                     I'm owed: I paid 40 (roll) for Sayak
//                                     and 24 for Krish
//   Krish owes me 50 · Tamal paid 90 for Sayak · paid by Om 20
//
// Rules:
// - With no "paid"/"owed" word, each name pays the amounts after it, for
//   everyone. A line with no name continues the line above.
// - "paid / diyachi / dilam …": the name right before it (or "by X") paid;
//   other names are who it was for. If each name has its own amount, each
//   amount is for that person only; otherwise the amount is shared.
// - "pabo / pabe" (will get) and "owes": each named person's amount was
//   paid for them by the person who gets it back (me unless named).
// - Words that aren't names become the title ("auto", "roll", "rice").
// - "(n)" after an amount: only n people shared it. "₹"/"Rs" optional.
//   No thousands commas: "1,200" reads as 1 and 200.
// - WhatsApp's "[28/10, 11:28 am] Sender:" copy prefix is skipped.

export interface Draft {
  /** 1-based line in the text. */
  line: number;
  /** Name as typed ("Krish", "ami"); null when the line doesn't say. */
  payer: string | null;
  amount: number;
  label?: string;
  /** Names as typed; undefined means everyone. */
  forNames?: string[];
  /** "(n)": only n people, picked in the preview. */
  forCount?: number;
}

export interface QuickError {
  line: number;
  message: string;
}

export interface QuickParse {
  drafts: Draft[];
  errors: QuickError[];
}

const ME = new Set(['me', 'i', 'myself', 'self', 'mine', 'my', 'ami', 'amar', 'amake', 'amr', 'amay']);
const CONNECTORS = new Set([
  'and', 'ar', 'aar', 'o', 'with', 'for', 'er', 'jonno', 'jnno', 'of', 'to', 'the', 'from', 'also', 'n', 'te', 'ke', 'k',
]);
const PAID = new Set([
  'paid', 'pay', 'payed', 'gave', 'spent', 'diyachi', 'diyechi', 'diyeche', 'diyecho', 'diyachhe', 'diyechhi', 'diyachhi',
  'dilam', 'dilo', 'dise', 'disi', 'dichhi', 'dichi', 'dicchi', 'diye', 'dichhe',
]);
const GETS_BACK = new Set(['pabo', 'pabe', 'paabo', 'paabe', 'pabi']);
const OWES = new Set(['owe', 'owes', 'owed']);

const WHATSAPP_PREFIX = /^\[[^\]]*\]\s*[^:]{1,40}:\s*/;
const TOKEN = /(?:(?:₹|rs\.?|inr)\s*)?(\d+(?:\.\d+)?)(?:\s*\(\s*(\d+)\s*\))?|([\p{L}][\p{L}'’]*)|([,;+&/\-:=–—])/giu;

type Tok =
  | { t: 'num'; raw: string; forCount?: number }
  | { t: 'word'; w: string; lw: string }
  | { t: 'sep'; s: string };

interface Item {
  amount: number;
  forCount?: number;
  label?: string;
}
interface Segment {
  names: string[];
  items: Item[];
}

export function isMeAlias(name: string) {
  return ME.has(name.trim().toLowerCase());
}

/**
 * Reads the text. `members` lets it tell names ("sayak") from item words
 * ("roll") in the middle of a sentence.
 */
export function parseQuickAdd(text: string, members: Member[] = []): QuickParse {
  const drafts: Draft[] = [];
  const errors: QuickError[] = [];
  const isName = (lw: string) => ME.has(lw) || matchMember(lw, members) != null;
  let lastPayer: string | null = null;

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = i + 1;
    const content = rawLine.replace(WHATSAPP_PREFIX, '').trim();
    if (!content) return;

    const toks = tokenize(content);
    if (!toks.some((t) => t.t === 'num')) {
      errors.push({ line, message: `No amounts found in "${clip(content)}".` });
      return;
    }

    // Find the meaning word, and who it's about.
    const words = toks.map((t, k) => ({ t, k })).filter((x) => x.t.t === 'word') as { t: Extract<Tok, { t: 'word' }>; k: number }[];
    const marker = words.find((x) => PAID.has(x.t.lw) || GETS_BACK.has(x.t.lw) || OWES.has(x.t.lw));
    let mode: 'list' | 'paid' | 'getsBack' | 'owes' = 'list';
    let subject: string | null = null;
    const skip = new Set<number>();

    if (marker) {
      skip.add(marker.k);
      mode = PAID.has(marker.t.lw) ? 'paid' : GETS_BACK.has(marker.t.lw) ? 'getsBack' : 'owes';
      if (mode === 'owes') {
        // "Krish owes me 50": the one owed comes after; default me.
        const after = words.find((x) => x.k > marker.k && (isName(x.t.lw) || !CONNECTORS.has(x.t.lw)) && toks[x.k - 1]?.t !== 'num');
        if (after && isName(after.t.lw)) {
          subject = after.t.w;
          skip.add(after.k);
        } else subject = 'me';
      } else {
        // The word right before the marker is who paid, even an unknown
        // name ("Rahul paid 50"); else the nearest known name before it;
        // else "by X" after it; else me.
        const before = toks[marker.k - 1];
        const by = toks[marker.k + 1];
        const byName = by?.t === 'word' && by.lw === 'by' ? toks[marker.k + 2] : undefined;
        if (before?.t === 'word' && !CONNECTORS.has(before.lw)) {
          subject = before.w;
          skip.add(marker.k - 1);
        } else if (byName?.t === 'word') {
          subject = byName.w;
          skip.add(marker.k + 1).add(marker.k + 2);
        } else {
          const near = [...words].reverse().find((x) => x.k < marker.k && isName(x.t.lw));
          if (near) {
            subject = near.t.w;
            skip.add(near.k);
          } else subject = 'me';
        }
      }
    }

    const { segments, problems } = segment(toks, skip, isName, mode === 'list');
    for (const p of problems) errors.push({ line, message: p });

    if (mode === 'list') {
      for (const s of segments) {
        let payer: string | null;
        if (s.names.length === 1) payer = s.names[0];
        else if (s.names.length === 0) payer = lastPayer; // a wrapped line
        else payer = null; // "Krish+Tamal 50": who paid? asked in the preview
        if (s.names.length === 0 && !lastPayer) {
          errors.push({ line, message: 'Start the line with who paid, e.g. "Krish - 48, 80".' });
          continue;
        }
        if (payer) lastPayer = payer;
        for (const it of s.items) drafts.push({ line, payer, ...it });
      }
      return;
    }

    // paid / getsBack / owes: subject paid, named people benefit.
    const withItems = segments.filter((s) => s.items.length);
    const perPerson = mode !== 'paid' || withItems.length > 1;
    if (perPerson) {
      let carry: string[] = [];
      for (const s of segments) {
        const names = s.names.length ? s.names : carry;
        carry = names;
        for (const it of s.items) drafts.push({ line, payer: subject, ...it, ...(names.length ? { forNames: names } : {}) });
      }
    } else {
      const names = [...new Set(segments.flatMap((s) => s.names))];
      for (const s of withItems) {
        for (const it of s.items) drafts.push({ line, payer: subject, ...it, ...(names.length ? { forNames: names } : {}) });
      }
    }
    lastPayer = subject;
  });

  return { drafts, errors };
}

function tokenize(content: string): Tok[] {
  const out: Tok[] = [];
  for (const m of content.matchAll(TOKEN)) {
    if (m[1] != null) out.push({ t: 'num', raw: m[1], ...(m[2] ? { forCount: parseInt(m[2], 10) } : {}) });
    else if (m[3] != null) out.push({ t: 'word', w: m[3], lw: m[3].toLowerCase() });
    else out.push({ t: 'sep', s: m[4] });
  }
  return out;
}

/**
 * Groups tokens into "names, then their amounts" runs. Words that aren't
 * names become the title of the amount they sit next to.
 */
function segment(toks: Tok[], skip: Set<number>, isName: (lw: string) => boolean, listMode: boolean) {
  const segments: Segment[] = [];
  const problems: string[] = [];
  let cur: Segment = { names: [], items: [] };
  let pending: string[] = []; // title words waiting for an amount
  let lastItem: Item | null = null;
  let seenNumber = false;
  let headWords: string[] = []; // list mode: unknown words before the first amount = a new name

  const flushHead = () => {
    if (headWords.length) {
      cur.names.push(headWords.join(' '));
      headWords = [];
    }
  };

  toks.forEach((tok, k) => {
    if (skip.has(k)) return;
    if (tok.t === 'sep') {
      if (tok.s === ',' || tok.s === ';') {
        // A title before a comma belongs to the amount before it.
        if (pending.length && lastItem && !lastItem.label) lastItem.label = pending.join(' ');
        pending = [];
        lastItem = null;
      }
      return;
    }
    if (tok.t === 'word') {
      if (CONNECTORS.has(tok.lw) || tok.lw === 'by') return;
      if (isName(tok.lw)) {
        if (cur.items.length) {
          if (pending.length && lastItem && !lastItem.label) lastItem.label = pending.join(' ');
          segments.push(cur);
          cur = { names: [], items: [] };
        }
        flushHead();
        cur.names.push(tok.w);
        pending = [];
        lastItem = null;
        return;
      }
      if (listMode && !seenNumber && segments.length === 0 && cur.items.length === 0) {
        headWords.push(tok.w);
        return;
      }
      pending.push(tok.w);
      return;
    }
    // number
    flushHead();
    seenNumber = true;
    const amount = toPaise(tok.raw);
    if (amount == null) {
      problems.push(`"${tok.raw}" has too many decimals (use up to 2).`);
      return;
    }
    if (amount === 0) {
      problems.push('An amount of 0 was skipped.');
      return;
    }
    if (tok.forCount === 0) {
      problems.push(`"${tok.raw}(0)" is for 0 people.`);
      return;
    }
    const item: Item = { amount, ...(tok.forCount ? { forCount: tok.forCount } : {}) };
    if (pending.length) {
      // Words just before an amount are its title ("roll 40") unless the
      // previous amount has none yet and they were right after it ("30 auto, …").
      if (lastItem && !lastItem.label) lastItem.label = pending.join(' ');
      else item.label = pending.join(' ');
      pending = [];
    }
    cur.items.push(item);
    lastItem = item;
  });

  if (pending.length && lastItem && !(lastItem as Item).label) (lastItem as Item).label = pending.join(' ');
  else if (pending.length) problems.push(`"${clip(pending.join(' '))}" isn't an amount or a name in this group.`);
  flushHead();
  if (cur.items.length || cur.names.length) segments.push(cur);
  for (const s of segments) for (const it of s.items) if (it.label) it.label = it.label.slice(0, 50);
  return { segments, problems };
}

const clip = (s: string) => (s.length > 30 ? `${s.slice(0, 30)}…` : s);

/** Edits needed to turn a into b (insert, delete, change one letter). */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Best member for a typed name, or null if it's unclear.
 * Exact name wins, then a unique first-name match, then a unique
 * "starts with" either way (Krish ↔ Krishnendu), then a unique
 * one-letter typo for names of 4+ letters (kish → Krish).
 */
export function matchMember(typed: string, members: Member[], meId?: string | null): string | null {
  const t = typed.trim().toLowerCase();
  if (!t) return null;
  if (ME.has(t)) return meId ?? null;
  const unique = (list: Member[]) => (list.length === 1 ? list[0].id : null);
  const first = (m: Member) => m.name.toLowerCase().split(/\s+/)[0];

  return (
    unique(members.filter((m) => m.name.toLowerCase() === t)) ??
    unique(members.filter((m) => first(m) === t)) ??
    (t.length >= 3 ? unique(members.filter((m) => first(m).startsWith(t) || t.startsWith(first(m)))) : null) ??
    (t.length >= 4 ? unique(members.filter((m) => editDistance(first(m), t) <= 1)) : null)
  );
}

export interface QuickRow {
  /** Index into the drafts. */
  key: number;
  payer: string | null;
  amount: number;
  title: string;
  /** null = everyone (the group's default split). */
  among: string[] | null;
  /** How many people "(n)" asked for, if any. */
  needCount?: number;
}

/**
 * Drafts → rows with member ids, using the typed-name → member mapping.
 * Anything it can't map is left null for the preview to ask about.
 */
export function resolveDrafts(drafts: Draft[], nameToId: Record<string, string | null>, categoryLabel: string): QuickRow[] {
  const id = (n: string) => nameToId[n.trim().toLowerCase()] ?? null;
  return drafts.map((d, key) => {
    const among = d.forNames ? d.forNames.map(id) : null;
    return {
      key,
      payer: d.payer ? id(d.payer) : null,
      amount: d.amount,
      title: d.label ?? categoryLabel,
      among: among && among.every(Boolean) ? [...new Set(among as string[])] : d.forNames ? [] : null,
      ...(d.forCount ? { needCount: d.forCount } : {}),
    };
  });
}

/** Why a row can't be saved yet, or null when it's ready. */
export function rowProblem(row: QuickRow): string | null {
  if (!row.payer) return 'Pick who paid';
  if (row.needCount && (row.among?.length ?? 0) !== row.needCount) return `Pick the ${row.needCount} people it was for`;
  if (row.among && row.among.length === 0) return 'Pick who it was for';
  return null;
}

export interface QuickBuildOptions {
  everyone: string[];
  date: string;
  category: CategoryKey;
  now?: number;
}

/** One expense per row. Returns null while any row still needs an answer. */
export function buildQuickExpenses(rows: QuickRow[], o: QuickBuildOptions, newId: () => string): Expense[] | null {
  if (rows.some(rowProblem)) return null;
  const now = o.now ?? Date.now();
  return rows.map((r, i) => ({
    id: newId(),
    title: r.title,
    amount: r.amount,
    category: o.category,
    payers: { [r.payer!]: r.amount },
    splitMode: 'equal' as const,
    splitAmong: r.among ?? o.everyone,
    date: o.date,
    // Keeps the typed order when the list is sorted newest first.
    createdAt: now + i,
  }));
}
