import { Platform } from 'react-native';
import { Contact, ContactField, ContactsSortOrder, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { cleanContactNames } from './contacts';

// The phone's contacts, names only (nothing else is read, nothing leaves
// the phone). Reading a big address book takes a moment, so it starts as
// soon as the Add people popup opens (only if contacts are already allowed:
// opening the popup never asks), and the names are kept for the rest of the
// session. "From contacts" then shows them at once, and refreshes them
// quietly behind.

export type ContactNames =
  | { status: 'ok'; names: string[] }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

/** The last names read this session. */
let latest: { status: 'ok'; names: string[] } | null = null;
/** A read under way, shared by everyone who asks meanwhile. */
let reading: Promise<ContactNames> | null = null;

function read(): Promise<ContactNames> {
  if (!reading) {
    reading = Contact.getAllDetails([ContactField.FULL_NAME] as const, { sortOrder: ContactsSortOrder.UserDefault })
      .then((all): ContactNames => {
        latest = { status: 'ok', names: cleanContactNames(all.map((c) => c.fullName)) };
        return latest;
      })
      .catch((e): ContactNames => {
        console.warn('Could not read contacts', e);
        return latest ?? { status: 'unavailable' };
      })
      .finally(() => {
        reading = null;
      });
  }
  return reading;
}

/** The names already read this session, for showing at once (null if none yet). */
export const cachedContactNames = (): ContactNames | null => latest;

/**
 * The Add people popup opened: start reading in the background, but only if
 * contacts are already allowed (no permission prompt from opening a popup).
 */
export function prefetchContactNames() {
  if (Platform.OS === 'web' || reading) return;
  getPermissionsAsync()
    .then((p) => {
      if (p.granted) void read();
    })
    .catch(() => {});
}

/** "From contacts": the names, asking for the permission if needed. */
export async function readContactNames(): Promise<ContactNames> {
  // A browser has no address book to read.
  if (Platform.OS === 'web') return { status: 'unavailable' };
  try {
    if (reading) return await reading;
    if (latest) {
      // Already have them: show these now, refresh for next time.
      void read();
      return latest;
    }
    const permission = await requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    return await read();
  } catch (e) {
    console.warn('Could not read contacts', e);
    return { status: 'unavailable' };
  }
}
