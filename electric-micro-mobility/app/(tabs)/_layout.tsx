import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs, type Href } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, type ColorValue } from 'react-native';

import { PillTabBar, type BottomTabBarProps } from '@/components/pill-tab-bar';
import { ThemedView } from '@/components/themed-view';
import { Colors, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Expo Router 58 sets the starting tab here instead of on `<Tabs>`. */
export const unstable_settings = { anchor: 'wallet' };

type TabIconProps = { color: ColorValue; size: number };

/** React Native 0.88's `ColorValue` includes `null` and numbers, which icon colors don't accept. */
const iconColor = (color: ColorValue) => (color == null || typeof color === 'number' ? undefined : color);

function WalletTabIcon({ color, size }: TabIconProps) {
  return <MaterialIcons name="account-balance-wallet" size={size} color={iconColor(color)} />;
}
function ReservationsTabIcon({ color, size }: TabIconProps) {
  return <MaterialIcons name="event-note" size={size} color={iconColor(color)} />;
}
function MapTabIcon({ color, size }: TabIconProps) {
  return <MaterialIcons name="map" size={size + 4} color={iconColor(color)} />;
}
function SupportTabIcon({ color, size }: TabIconProps) {
  return <MaterialIcons name="support-agent" size={size} color={iconColor(color)} />;
}
function AccountTabIcon({ color, size }: TabIconProps) {
  return <MaterialIcons name="person" size={size} color={iconColor(color)} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading, configured } = useAuth();
  const headerBg = colorScheme === 'dark' ? colors.background : '#F9F9F9';

  const screenOptions = useCallback(
    ({ route }: { route: { name: string } }) => ({
      headerShown: true,
      headerStyle: {
        backgroundColor: headerBg,
      },
      headerShadowVisible: false,
      headerTitleStyle: {
        fontWeight: route.name === 'account' || route.name === 'support' ? ('800' as const) : ('700' as const),
        fontSize:
          route.name === 'wallet'
            ? 28
            : route.name === 'account' || route.name === 'support'
              ? 26
              : 20,
        letterSpacing: route.name === 'account' || route.name === 'support' ? -0.25 : 0,
        ...(route.name === 'account' || route.name === 'support'
          ? { color: colorScheme === 'dark' ? '#FFFFFF' : '#111111' }
          : {}),
      },
      headerTitleAlign: 'left' as const,
    }),
    [colorScheme, headerBg]
  );

  // React Navigation expects `tabBar` to be a plain function — `React.memo(PillTabBar)` is not typeof "function".
  const renderTabBar = useCallback((props: BottomTabBarProps) => <PillTabBar {...props} />, []);

  if (!configured || (!loading && !user)) {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  return (
    <Tabs screenOptions={screenOptions} tabBar={renderTabBar}>
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: WalletTabIcon,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarIcon: ReservationsTabIcon,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: MapTabIcon,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: SupportTabIcon,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: AccountTabIcon,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
