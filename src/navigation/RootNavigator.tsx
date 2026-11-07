import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
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
import { BrandTitle } from '../components/BrandTitle';
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
      <Tab.Screen
        name="Home"
        component={GroupsScreen}
        options={{ title: t('tabs.home'), headerTitle: () => <BrandTitle /> }}
      />
      <Tab.Screen name="People" component={PeopleScreen} options={{ title: t('tabs.people') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

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
    <NavigationContainer theme={navTheme}>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
