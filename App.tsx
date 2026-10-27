import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GroupsProvider } from './src/context/GroupsContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <GroupsProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </GroupsProvider>
    </SafeAreaProvider>
  );
}
