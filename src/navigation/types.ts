import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupKind } from '../types';

export type RootStackParamList = {
  Groups: undefined;
  /** `kind` preselects the type for a new group. */
  GroupForm: { groupId?: string; kind?: GroupKind } | undefined;
  GroupDetail: { groupId: string };
  ExpenseForm: { groupId: string; expenseId?: string };
  Settings: undefined;
  Export: undefined;
  Import: undefined;
  About: undefined;
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;
