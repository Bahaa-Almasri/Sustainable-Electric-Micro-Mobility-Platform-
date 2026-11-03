import { Redirect, Tabs, type Href } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, type ColorValue } from 'react-native';

import { PillTabBar, type BottomTabBarProps } from '@/components/pill-tab-bar';
import { ThemedView } from '@/components/themed-view';
import { ChatIcon, HoldIcon, PersonIcon, RouteIcon, TicketIcon } from '@/components/wayfinder/icons';
import { LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

/** Expo Router 58 sets the starting tab here instead of on `<Tabs>`. */
export const unstable_settings = { anchor: 'wallet' };

type TabIconProps = { color: ColorValue; size: number };

function WalletTabIcon({ color, size }: TabIconProps) {
  return <TicketIcon color={color} size={size} />;
}
function ReservationsTabIcon({ color, size }: TabIconProps) {
  return <HoldIcon color={color} size={size} />;
}
function MapTabIcon({ color, size }: TabIconProps) {
  return <RouteIcon color={color} size={size} />;
}
function SupportTabIcon({ color, size }: TabIconProps) {
  return <ChatIcon color={color} size={size} />;
}
function AccountTabIcon({ color, size }: TabIconProps) {
  return <PersonIcon color={color} size={size} />;
}

const screenOptions = { headerShown: false };

export default function TabLayout() {
  const { user, loading, configured } = useAuth();

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
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: MapTabIcon,
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
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: WalletTabIcon,
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
