import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { AuthProvider } from '@/contexts/auth-context';
import { PreferencesProvider } from '@/contexts/preferences-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const stackScreenOptions = { headerShown: false as const };

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const navigationTheme = useMemo(
    () => (colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    [colorScheme]
  );
  const statusStyle = colorScheme === 'dark' ? 'light' : 'dark';

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="vehicle/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Vehicle',
          }}
        />
      </Stack>
      <StatusBar style={statusStyle} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <RootLayoutContent />
      </PreferencesProvider>
    </AuthProvider>
  );
}
