import type { Key } from '../i18n';

// Checks and messages for the account screens, kept apart from the network
// code so they can be tested.

export const PASSWORD_MIN = 8;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Supabase error codes we explain in the app's own words. */
const CODES: Record<string, Key> = {
  invalid_credentials: 'account.err.invalidLogin',
  email_not_confirmed: 'account.err.notConfirmed',
  user_already_exists: 'account.err.exists',
  email_exists: 'account.err.exists',
  weak_password: 'account.err.weakPassword',
  over_email_send_rate_limit: 'account.err.tooMany',
  over_request_rate_limit: 'account.err.tooMany',
  email_address_invalid: 'account.err.badEmail',
  signup_disabled: 'account.err.generic',
};

/** The message to show for anything a sign-in, sign-up or reset threw. */
export function authErrorKey(e: unknown): Key {
  const err = (e ?? {}) as { code?: unknown; name?: unknown; message?: unknown; status?: unknown };
  if (typeof err.code === 'string' && CODES[err.code]) return CODES[err.code];
  // No answer from the server at all: offline, or the request never got out.
  const message = typeof err.message === 'string' ? err.message : '';
  if (err.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|load failed/i.test(message)) {
    return 'account.err.offline';
  }
  return 'account.err.generic';
}
