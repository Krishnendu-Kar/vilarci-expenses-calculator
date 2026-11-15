import { supabase } from './supabase';
import { parseRelease, type Release } from '../appRelease';

/** Which versions are outdated, from the server (works signed out). */
export async function fetchRelease(platform: 'android' | 'ios'): Promise<Release | null> {
  const { data, error } = await supabase.rpc('app_release_for', {
    p_platform: platform,
  });
  if (error) throw error;
  return parseRelease(data, Date.now());
}
