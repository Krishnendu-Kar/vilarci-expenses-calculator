import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';
import { INVITE_HOST, joinPathCode } from '../lib/invite';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GroupsScreen } from '../screens/GroupsScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { ExpenseFormScreen } from '../screens/ExpenseFormScreen';
import { RecurringScreen } from '../screens/RecurringScreen';
import { PersonScreen } from '../screens/PersonScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AppearanceScreen } from '../screens/AppearanceScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { BinScreen } from '../screens/BinScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { InviteScreen } from '../screens/InviteScreen';
import { JoinScreen } from '../screens/JoinScreen';
import { GroupSettingsScreen } from '../screens/GroupSettingsScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { LockedGroupsScreen } from '../screens/LockedGroupsScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { BackupScreen } from '../screens/BackupScreen';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import type { IconName } from '../data/categories';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ['home-outline', 'home'],
  People: ['people-outline', 'people'],
  Profile: ['person-circle-outline', 'person-circle'],
};

function useHeaderOptions() {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.header },
      headerTintColor: colors.white,
      headerTitleStyle: { fontWeight: '700' as const },
      headerShadowVisible: false,
    }),
    [colors],
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const header = useHeaderOptions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...header,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 1 : 0]} size={size} color={color} />
        ),
      })}
    >
      {/* Every tab draws its own top (the pendulum hero, the People hero, the Profile header): no header bar. */}
      <Tab.Screen name="Home" component={GroupsScreen} options={{ title: t('tabs.home'), headerShown: false }} />
      <Tab.Screen name="People" component={PeopleScreen} options={{ title: t('tabs.people'), headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile'), headerShown: false }} />
    </Tab.Navigator>
  );
}

/**
 * Invite links open the app on the Join page (onlinedb.md §15):
 * https://esplit.vilarci.in/join/<code> (an App Link, once the site's
 * assetlinks.json vouches for the app) or vesplit://join/<code>. Back goes
 * Home. Any other link just opens the app. Phones only: on the web the
 * browser's address stays as it is.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['vesplit://', `https://${INVITE_HOST}`],
  getStateFromPath: (path) => {
    const code = joinPathCode(path);
    return {
      routes: [{ name: 'Main' }, ...(code === null ? [] : [{ name: 'Join' as const, params: code ? { code } : undefined }])],
    };
  },
};

export function RootNavigator() {
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const header = useHeaderOptions();

  const navTheme: Theme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.tint,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
      },
    };
  }, [colors, dark]);

  return (
    <NavigationContainer theme={navTheme} linking={Platform.OS === 'web' ? undefined : linking}>
      <Stack.Navigator screenOptions={{ ...header, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false, title: t('tabs.home') }} />
        <Stack.Screen
          name="GroupForm"
          component={GroupFormScreen}
          options={({ route }) => ({ title: route.params?.groupId ? t('groupForm.editTitle') : t('groupForm.newTitle') })}
        />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: '' }} />
        <Stack.Screen
          name="ExpenseForm"
          component={ExpenseFormScreen}
          options={({ route }) => ({ title: route.params.expenseId ? t('expense.editTitle') : t('expense.addTitle') })}
        />
        <Stack.Screen name="Recurring" component={RecurringScreen} options={{ title: t('recurring.title') }} />
        <Stack.Screen name="Person" component={PersonScreen} options={{ title: '' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: t('appearance.title') }} />
        <Stack.Screen name="Language" component={LanguageScreen} options={{ title: t('language.title') }} />
        <Stack.Screen name="Export" component={ExportScreen} options={{ title: t('export.title') }} />
        <Stack.Screen name="Import" component={ImportScreen} options={{ title: t('import.title') }} />
        <Stack.Screen name="Bin" component={BinScreen} options={{ title: t('bin.title') }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ title: t('about.title') }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: t('account.signIn') }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false, animation: 'fade' }} />
        {/* From the left, like the camera in WhatsApp: it sits left of All. */}
        <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="Invite" component={InviteScreen} options={{ title: t('invite.title') }} />
        {/* A card over Home, not a page of its own. */}
        <Stack.Screen
          name="Join"
          component={JoinScreen}
          options={{ title: t('join.title'), headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ title: t('gsettings.title') }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: t('activity.title') }} />
        <Stack.Screen name="LockedGroups" component={LockedGroupsScreen} options={{ title: t('lock.lockedTitle') }} />
        <Stack.Screen name="Backup" component={BackupScreen} options={{ title: t('backup.title') }} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
