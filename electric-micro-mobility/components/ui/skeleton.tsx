import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** After this long on a skeleton, tell the user the wait is likely their connection, not the app. */
export const SLOW_LOADING_MS = 6000;

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** A grey placeholder block that pulses while content loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const isDark = useColorScheme() === 'dark';
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, opacity, backgroundColor: isDark ? '#2A2F33' : '#E3E6E8' },
        style,
      ]}
    />
  );
}

/** True once `active` has stayed true for `delayMs`; resets when it turns false. */
export function useIsSlow(active: boolean, delayMs = SLOW_LOADING_MS) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setSlow(true), delayMs);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [active, delayMs]);
  return active && slow;
}

/** Shown under a skeleton when loading drags on, so a slow network isn't mistaken for a broken app. */
export function SlowConnectionHint({ loading = true }: { loading?: boolean }) {
  const slow = useIsSlow(loading);
  if (!slow) return null;
  return (
    <View style={styles.hint} accessibilityLiveRegion="polite">
      <ThemedText style={styles.hintText} lightColor="#687076" darkColor="#9BA1A6">
        Taking longer than usual. Your connection may be slow.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
