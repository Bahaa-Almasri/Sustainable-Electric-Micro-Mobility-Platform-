import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { PillTabBar } from '@/components/pill-tab-bar';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading, configured } = useAuth();

  if (!configured || (!loading && !user)) {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  const headerBg = colorScheme === 'dark' ? colors.background : '#F9F9F9';

  return (
    <Tabs
      initialRouteName="wallet"
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: headerBg,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: route.name === 'account' || route.name === 'support' ? '800' : '700',
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
        headerTitleAlign: 'left',
      })}
      tabBar={(props) => <PillTabBar {...props} />}>
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="account-balance-wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="event-note" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="map" size={size + 4} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="support-agent" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
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
