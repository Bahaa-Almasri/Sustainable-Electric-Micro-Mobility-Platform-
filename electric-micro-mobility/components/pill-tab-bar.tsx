import type { Tabs } from 'expo-router';
import React, { memo, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { TAB_BAR_HEIGHT, useWayfinder } from '@/hooks/use-wayfinder';

/** expo-router bundles its own React Navigation, so take the props type from its `Tabs`. */
export type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function PillTabBarInner({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { c } = useWayfinder();

  return (
    <View style={[styles.bar, { backgroundColor: c.inverse, bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconEl =
          options.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? c.onAccent : c.inverseMuted,
            size: isFocused ? 20 : 22,
          }) ?? null;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => {
              if (Platform.OS !== 'ios') return;
              void import('expo-haptics').then((Haptics) =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              );
            }}
            style={isFocused ? [styles.active, { backgroundColor: c.accent }] : styles.inactive}>
            {iconEl}
            {isFocused ? (
              <Text style={[styles.label, { color: c.onAccent }]} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Stable reference for `<Tabs tabBar={PillTabBar} />` — avoids new render prop each layout pass. */
export const PillTabBar = memo(PillTabBarInner);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  active: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Shrinks on narrow phones so the active pill never pushes a tab off the bar.
  inactive: {
    flex: 1,
    maxWidth: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
});
