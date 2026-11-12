// Group invites: https://esplit.vilarci.in/join/K7QM2XPA (also ?c=K7QM2XPA),
// read the same way as the website's invite page. Codes are 8 letters and
// digits without 0, O, 1 and I, so they can be read out loud.

export const INVITE_HOST = 'esplit.vilarci.in';
const CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

const clean = (raw: string) => raw.toUpperCase().replace(/[\s-]/g, '');

/** The invite code in a scanned or pasted link, or null if it isn't one of ours (or the code is broken). */
export function inviteCode(text: string): string | null {
  const s = text.trim();
  // The host must end there: esplit.vilarci.in.example.com is someone else's.
  const m = s.match(/^(?:https?:\/\/)?esplit\.vilarci\.in(?=[/?#]|$)(\/[^?#\s]*)?(?:\?([^#\s]*))?/i);
  if (!m) return null;
  const path = m[1] ?? '';
  const join = path.match(/^\/join\/([^/]+)\/?$/i);
  let raw: string | null = null;
  if (join) {
    try {
      raw = decodeURIComponent(join[1]);
    } catch {
      return null;
    }
  } else {
    const c = (m[2] ?? '').split('&').find((p) => p.toLowerCase().startsWith('c='));
    raw = c ? decodeURIComponent(c.slice(2)) : null;
  }
  if (raw === null) return null;
  const code = clean(raw);
  return CODE.test(code) ? code : null;
}

/** Is it a link to our site at all (so a broken code can say so, instead of "not ours")? */
export const isOurLink = (text: string) => /^(?:https?:\/\/)?esplit\.vilarci\.in(?:[/?#]|$)/i.test(text.trim());

/**
 * A link that opened the app (https://esplit.vilarci.in/join/<code> as an
 * App Link, or vesplit://join/<code>), as the path the navigator hands over:
 * the code, '' for a join link with a broken code, or null when it isn't a
 * join link at all.
 */
export function joinPathCode(path: string): string | null {
  const rest = path.trim().replace(/^\/+/, '');
  if (!/^join(?:[/?#]|$)/i.test(rest) && !/^\?c=/i.test(rest)) return null;
  return inviteCode(`${INVITE_HOST}/${rest}`) ?? '';
}
