import { Ionicons } from '@expo/vector-icons';
import { useEffect, useId, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import {
  getToast,
  getTopToastHost,
  registerToastHost,
  subscribeToast,
  toast,
  unregisterToastHost,
  type ToastKind,
} from '@/lib/toast';

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

/**
 * Renders the current toast at the top of the screen.
 *
 * Mount one in the root layout, and one inside each native `Modal` that can show a toast:
 * a native modal covers everything under it, so a root-level toast would be hidden.
 * Only the most recently mounted host draws, so the toast never appears twice.
 */
export function ToastHost() {
  const { c } = useWayfinder();
  const { top } = useSafeAreaInsets();
  const hostId = useId();

  useEffect(() => {
    registerToastHost(hostId);
    return () => unregisterToastHost(hostId);
  }, [hostId]);

  const current = useSyncExternalStore(subscribeToast, getToast, getToast);
  const topHost = useSyncExternalStore(subscribeToast, getTopToastHost, getTopToastHost);

  if (topHost !== hostId || current == null) return null;

  const accent = current.kind === 'success' ? c.inverseSuccess : current.kind === 'error' ? c.accent : c.inverseMuted;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: top + 8 }]}>
      <Animated.View
        key={current.id}
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(160)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: c.inverse }]}>
        <Pressable
          onPress={toast.hide}
          accessibilityLabel={`${current.title}. ${current.message ?? ''} Tap to dismiss.`}
          style={styles.body}>
          <Ionicons name={ICONS[current.kind]} size={22} color={accent} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: c.inverseText }]} numberOfLines={2}>
              {current.title}
            </Text>
            {current.message ? (
              <Text style={[styles.message, { color: c.inverseMuted }]} numberOfLines={3}>
                {current.message}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              const action = current.action;
              toast.hide();
              action?.onPress();
            }}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.actionText, { color: c.accent }]}>{current.action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 20 },
  message: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 1 },
  action: { paddingHorizontal: 6, paddingVertical: 4 },
  actionText: { fontFamily: FontFamily.bold, fontSize: 15 },
});
