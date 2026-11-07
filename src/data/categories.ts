import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { CategoryKey, GroupKind } from '../types';
import { translate, type Key } from '../i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// `label` is read in the current language each time it's used.
function entry<K extends string>(key: K, labelKey: Key, icon: IconName) {
  return {
    key,
    icon,
    get label() {
      return translate(labelKey);
    },
  };
}

export const CATEGORIES: { key: CategoryKey; label: string; icon: IconName }[] = [
  entry('food', 'cat.food', 'fast-food-outline'),
  entry('travel', 'cat.travel', 'car-outline'),
  entry('stay', 'cat.stay', 'bed-outline'),
  entry('groceries', 'cat.groceries', 'basket-outline'),
  entry('fun', 'cat.fun', 'happy-outline'),
  entry('shopping', 'cat.shopping', 'bag-handle-outline'),
  entry('other', 'cat.other', 'pricetag-outline'),
];

export function categoryOf(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const GROUP_KINDS: { key: GroupKind; label: string; icon: IconName }[] = [
  entry('trip', 'kind.trip', 'airplane-outline'),
  entry('hostel', 'kind.hostel', 'home-outline'),
  entry('other', 'kind.other', 'people-outline'),
];

export function groupKindOf(key: GroupKind) {
  return GROUP_KINDS.find((k) => k.key === key) ?? GROUP_KINDS[GROUP_KINDS.length - 1];
}
