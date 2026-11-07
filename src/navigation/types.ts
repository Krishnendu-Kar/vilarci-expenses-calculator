import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupKind } from '../types';

/** The bottom bar. */
export type TabParamList = {
  Home: undefined;
  People: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  /** `kind` preselects the type for a new group. */
  GroupForm: { groupId?: string; kind?: GroupKind } | undefined;
  GroupDetail: { groupId: string };
  ExpenseForm: { groupId: string; expenseId?: string; date?: string };
  Recurring: { groupId: string };
  Person: { personId: string };
  Settings: undefined;
  Appearance: undefined;
  Language: undefined;
  Export: undefined;
  Import: undefined;
  Bin: undefined;
  About: undefined;
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

/** A bottom-bar screen that can also open the stack's screens. */
export type TabProps<K extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, K>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
