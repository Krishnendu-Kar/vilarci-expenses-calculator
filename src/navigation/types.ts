import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Groups: undefined;
  GroupForm: { groupId?: string } | undefined;
  GroupDetail: { groupId: string };
  ExpenseForm: { groupId: string; expenseId?: string };
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;
