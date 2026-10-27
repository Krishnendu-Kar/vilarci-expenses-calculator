import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupsScreen } from '../screens/GroupsScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { ExpenseFormScreen } from '../screens/ExpenseFormScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { BrandTitle } from '../components/BrandTitle';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Groups"
          component={GroupsScreen}
          options={{ title: 'Vilarci Split', headerTitle: () => <BrandTitle /> }}
        />
        <Stack.Screen
          name="GroupForm"
          component={GroupFormScreen}
          options={({ route }) => ({ title: route.params?.groupId ? 'Edit group' : 'New group' })}
        />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: '' }} />
        <Stack.Screen
          name="ExpenseForm"
          component={ExpenseFormScreen}
          options={({ route }) => ({ title: route.params.expenseId ? 'Edit expense' : 'Add expense' })}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="Export" component={ExportScreen} options={{ title: 'Export data' }} />
        <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Import data' }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
