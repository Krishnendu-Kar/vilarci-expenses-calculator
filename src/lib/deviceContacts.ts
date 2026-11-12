import { Platform } from 'react-native';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { cleanContactNames } from './contacts';

// The phone's contacts, names only (nothing else is read, nothing leaves
// the phone). Asked for only when someone taps "From contacts".

export type ContactNames =
  | { status: 'ok'; names: string[] }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

export async function readContactNames(): Promise<ContactNames> {
  // A browser has no address book to read.
  if (Platform.OS === 'web') return { status: 'unavailable' };
  try {
    const permission = await requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    const all = await Contact.getAllDetails([ContactField.FULL_NAME] as const, { sortOrder: ContactsSortOrder.UserDefault });
    return { status: 'ok', names: cleanContactNames(all.map((c) => c.fullName)) };
  } catch (e) {
    console.warn('Could not read contacts', e);
    return { status: 'unavailable' };
  }
}
