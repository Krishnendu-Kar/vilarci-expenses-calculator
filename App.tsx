import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { I18nProvider, useI18n } from './src/i18n/I18nContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { GroupsProvider } from './src/context/GroupsContext';
import { UndoProvider } from './src/context/UndoContext';
import { MenuProvider } from './src/context/MenuContext';
import { LockProvider } from './src/context/LockContext';
import { AuthProvider } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <Gate>
              {/* Inside the theme and language, so even the error page matches the app. */}
              <ErrorBoundary>
                <GroupsProvider>
                  <LockProvider>
                    <AuthProvider>
                      <UndoProvider>
                        <SyncProvider>
                          <MenuProvider>
                            {/* The header bar is dark in both themes. */}
                            <StatusBar style="light" />
                            <RootNavigator />
                          </MenuProvider>
                        </SyncProvider>
                      </UndoProvider>
                    </AuthProvider>
                  </LockProvider>
                </GroupsProvider>
              </ErrorBoundary>
            </Gate>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Waits for the saved theme and language, so the app never flashes the wrong ones. */
function Gate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const i18n = useI18n();
  if (!theme.ready || !i18n.ready) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  return <>{children}</>;
}
