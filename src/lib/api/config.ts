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

/**
 * Google sign-in and Drive backup (onlinedb.md §11.3, §21): the OAuth *Web*
 * client id from Google Cloud (the same one set in Supabase → Auth → Google).
 * Not a secret: it ships in every app that signs in with Google. Empty would
 * hide the Google buttons. Needs a dev or store build (the native module
 * isn't in Expo Go, where the buttons stay hidden).
 */
export const GOOGLE_WEB_CLIENT_ID = '761092670416-h2vc0qldai7lq4cn2jvmngdp2oepa0d2.apps.googleusercontent.com';
