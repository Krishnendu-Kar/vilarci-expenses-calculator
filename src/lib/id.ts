import { randomUUID } from 'expo-crypto';

/** A new random UUID (v4), for every group, person, expense and payment. */
export function newId() {
  return randomUUID();
}
