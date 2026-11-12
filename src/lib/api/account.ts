import { supabase } from './supabase';
import { EMAIL_CONFIRMED_URL, PASSWORD_RESET_URL } from './config';
import { sanitizeUpiIds } from '../upi';
import type { UpiId } from '../../types';

// Accounts: email + password for now (Continue with Google comes with the
// development build). Every function throws Supabase's error as it is; the
// screens turn it into a message with authErrorKey().

/** What the account keeps: the same name and UPI ids as Profile. */
export interface AccountProfile {
  name: string;
  upiIds: UpiId[];
}

/** needsConfirm: the account exists but its email must be confirmed first. */
export async function signUp(name: string, email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: EMAIL_CONFIRMED_URL },
  });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

/**
 * The 6-digit code from the sign-up email (sent by Vilarci through Resend):
 * confirms the email and signs you in, no link to open.
 */
export async function verifySignUpCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: EMAIL_CONFIRMED_URL } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: PASSWORD_RESET_URL });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Your profile on the server; null if it isn't there (yet). */
export async function fetchAccountProfile(userId: string): Promise<AccountProfile | null> {
  // People you share a live group with are readable too, so ask for yours.
  const { data, error } = await supabase.from('profiles').select('name, upi_ids').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? { name: typeof data.name === 'string' ? data.name : '', upiIds: sanitizeUpiIds(data.upi_ids) } : null;
}

export async function saveAccountProfile(p: AccountProfile) {
  const { error } = await supabase.rpc('update_profile', { p_name: p.name, p_upi_ids: p.upiIds });
  if (error) throw error;
}

/** Deletes the account on the server (supabase/functions/delete-account), then signs out here. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
