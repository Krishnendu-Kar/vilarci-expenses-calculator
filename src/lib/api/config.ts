// The Supabase project the app talks to (accounts now, live groups later).
// Both values ship inside the app by design: the publishable key only lets
// the app in through Row Level Security and the functions in
// supabase/migrations. The secret key never leaves Supabase.
//
// This is the development project ("Vilarci-split"). A separate production
// project is planned before launch (onlinedb.md, decision 13).

export const SUPABASE_URL = 'https://orxeebeipucwdietutdu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EXv369uMG6RkOTd5XqR0hA_S3wywjOY';

/** Pages on the website that account emails link to. */
export const SITE = 'https://esplit.vilarci.in';
export const EMAIL_CONFIRMED_URL = `${SITE}/confirmed`;
export const PASSWORD_RESET_URL = `${SITE}/reset`;
