import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACTIVE_PILL = '#FF4B41';

function PillTabBarInner({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const barBg = theme.background;
  const inactive = theme.tabIconDefault;
  const borderTop = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: barBg,
          borderTopColor: borderTop,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        colorScheme === 'dark' && styles.barDark,
      ]}>
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

        const color = isFocused ? '#FFFFFF' : inactive;
        const size = 22;
        const iconEl =
          options.tabBarIcon?.({
            focused: isFocused,
            color,
            size,
          }) ?? null;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => {
              if (Platform.OS !== 'ios') return;
              void import('expo-haptics').then((Haptics) =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              );
            }}
            style={styles.tabPressable}>
            {isFocused ? (
              <View style={styles.pillActive}>
                {iconEl}
                <Text style={styles.labelActive} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ) : (
              <View style={styles.tabInner}>
                {iconEl}
                <Text style={[styles.labelInactive, { color: inactive }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barDark: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0.25,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  tabPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  pillActive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTIVE_PILL,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 5,
    minHeight: 56,
    alignSelf: 'stretch',
    marginHorizontal: 3,
    maxWidth: '100%',
  },
  tabInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 5,
    minHeight: 56,
  },
  labelActive: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  labelInactive: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
