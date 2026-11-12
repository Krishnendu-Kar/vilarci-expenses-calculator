import { Platform, TurboModuleRegistry } from 'react-native';
import { supabase } from './supabase';
import { GOOGLE_WEB_CLIENT_ID } from './config';

// Continue with Google (onlinedb.md §11.3) and the Drive token for backups
// (§21). The native module exists only in a dev or store build, not in Expo
// Go or on the web, so it's loaded lazily and everything here says "not
// available" instead of crashing.

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** Drive's hidden app folder: the narrowest Drive permission there is. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let loaded: GoogleModule | null | undefined;
let configured = false;

function google(): GoogleModule | null {
  if (!GOOGLE_WEB_CLIENT_ID) return null;
  if (loaded === undefined) {
    // Ask first whether the native part is in this build (Expo Go has none):
    // loading the library without it fails in a way dev mode reports as a
    // crash, even inside try/catch.
    const native = Platform.OS !== 'web' && TurboModuleRegistry.get('RNGoogleSignin') != null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = native ? (require('@react-native-google-signin/google-signin') as GoogleModule) : null;
    } catch {
      loaded = null;
    }
  }
  if (loaded && !configured) {
    try {
      loaded.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      configured = true;
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

/** Can this build talk to Google at all? */
export const googleAvailable = () => !!google();

/** The Google account chooser, then a Supabase sign-in with its id token. The email, or null if cancelled. */
export async function signInWithGoogle(): Promise<string | null> {
  const g = google();
  if (!g) throw new Error('Google sign-in is not available in this build');
  await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await g.GoogleSignin.signIn();
  if (res.type !== 'success') return null;
  const token = res.data.idToken;
  if (!token) throw new Error('Google gave no id token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
  if (error) throw error;
  return res.data.user.email;
}

/**
 * A Drive access token for the app folder, and which Google account it's
 * for. `interactive`: may show the account chooser and the Drive consent;
 * otherwise only uses an account already connected (auto backup).
 */
export async function driveAccess(interactive: boolean): Promise<{ token: string; email: string } | null> {
  const g = google();
  if (!g) return null;
  const S = g.GoogleSignin;
  let user = S.getCurrentUser();
  if (!user) {
    const silent = await S.signInSilently().catch(() => null);
    user = silent?.type === 'success' ? silent.data : null;
  }
  if (!user) {
    if (!interactive) return null;
    const res = await S.signIn();
    if (res.type !== 'success') return null;
    user = res.data;
  }
  if (!user.scopes.includes(DRIVE_SCOPE)) {
    if (!interactive) return null;
    const res = await S.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!res || res.type !== 'success') return null;
    user = res.data;
  }
  const { accessToken } = await S.getTokens();
  return { token: accessToken, email: user.user.email };
}

/** The Google account connected for backups, if any (asks nothing). */
export function driveConnectedEmail(): string | null {
  const user = google()?.GoogleSignin.getCurrentUser();
  return user && user.scopes.includes(DRIVE_SCOPE) ? user.user.email : null;
}

export async function disconnectGoogle() {
  await google()
    ?.GoogleSignin.signOut()
    .catch(() => {});
}
