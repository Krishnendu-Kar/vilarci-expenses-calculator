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
  /** people: an existing group's people only (from Members), the Add popup open. */
  GroupForm: { groupId?: string; kind?: GroupKind; people?: boolean } | undefined;
  /** putOnlineAs: a group just created as Online goes up on opening, with this member as you. */
  GroupDetail: { groupId: string; putOnlineAs?: string };
  /**
   * Add an expense, or edit one (`expenseId`, from its page's pencil).
   * `copyFrom`: a new expense filled in from that one (⋮ → Make a copy).
   */
  ExpenseForm: { groupId: string; expenseId?: string; date?: string; copyFrom?: string };
  /** One expense to read (everyone in the group); the pencil opens ExpenseForm. */
  Expense: { groupId: string; expenseId: string };
  /** ⋮ → Info on an expense: its history (who added it, every change). */
  ExpenseInfo: { groupId: string; expenseId: string };
  /** A shared expense link opened the app: finds it, or says why it can't. No ids: a broken link. */
  OpenExpense: { groupId?: string; expenseId?: string } | undefined;
  Person: { personId: string };
  Settings: undefined;
  Appearance: undefined;
  Language: undefined;
  Export: undefined;
  Import: undefined;
  Bin: undefined;
  About: undefined;
  /** Sign in / create an account / reset the password. */
  Auth: { mode?: 'signIn' | 'signUp' } | undefined;
  /** Find a group or a person by name. */
  Search: undefined;
  /** Read a group's invite QR code with the camera. */
  Scan: undefined;
  /** A live group's invite link, QR and code; for admins also requests and settings. */
  Invite: { groupId: string };
  /** Join with an invite code (from a link or the scanner), or type one in. */
  Join: { code?: string } | undefined;
  /** Locked groups, kept off Home; reached by pulling Home down and the fingerprint or screen lock. */
  LockedGroups: undefined;
  /** What the app does and how to use it: first start, or Settings → How to use. */
  Welcome: undefined;
  /** Settings → Google Drive backup. */
  /** `find`: open the backup list straight away (Home's restore card). */
  Backup: { find?: boolean } | undefined;
  /** Settings → Notifications: on or off, which kinds, muted groups. */
  Notifications: undefined;
  /** The bell on Home: important notices, updates and news from Vilarci (not group activity). */
  News: undefined;
  /** A live group's Activity: every change, who made it and when. */
  Activity: { groupId: string };
  /** A live group's settings (admins). */
  GroupSettings: { groupId: string };
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
