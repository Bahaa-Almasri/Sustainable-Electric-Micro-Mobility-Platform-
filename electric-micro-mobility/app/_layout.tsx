import 'react-native-reanimated';

import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { OfflineBanner } from '@/components/offline-banner';
import { AuthProvider } from '@/contexts/auth-context';
import { PreferencesProvider } from '@/contexts/preferences-context';
import { Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const stackScreenOptions = { headerShown: false as const };

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    const c = colorScheme === 'dark' ? Palette.dark : Palette.light;
    return { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.line } };
  }, [colorScheme]);
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
            title: 'Vehicle',
          }}
        />
      </Stack>
      <OfflineBanner />
      <StatusBar style={statusStyle} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  // On a font error, fall through and render with system fonts rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <PreferencesProvider>
        <RootLayoutContent />
      </PreferencesProvider>
    </AuthProvider>
  );
}
