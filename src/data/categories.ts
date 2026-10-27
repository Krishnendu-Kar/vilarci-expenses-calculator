import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { CategoryKey, GroupKind } from '../types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORIES: { key: CategoryKey; label: string; icon: IconName }[] = [
  { key: 'food', label: 'Food', icon: 'fast-food-outline' },
  { key: 'travel', label: 'Travel', icon: 'car-outline' },
  { key: 'stay', label: 'Stay', icon: 'bed-outline' },
  { key: 'groceries', label: 'Groceries', icon: 'basket-outline' },
  { key: 'fun', label: 'Fun', icon: 'happy-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline' },
  { key: 'other', label: 'Other', icon: 'pricetag-outline' },
];

export function categoryOf(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const GROUP_KINDS: { key: GroupKind; label: string; icon: IconName }[] = [
  { key: 'trip', label: 'Trip', icon: 'airplane-outline' },
  { key: 'hostel', label: 'Hostel / Flat', icon: 'home-outline' },
  { key: 'other', label: 'Other', icon: 'people-outline' },
];

export function groupKindOf(key: GroupKind) {
  return GROUP_KINDS.find((k) => k.key === key) ?? GROUP_KINDS[GROUP_KINDS.length - 1];
}
