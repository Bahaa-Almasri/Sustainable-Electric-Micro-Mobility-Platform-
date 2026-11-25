import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/toast-host';
import { Button } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import { elapsedSeconds, estimateRideCost, formatRideDuration } from '@/lib/ride-time';
import type { RidePricingSnapshot } from '@/types/entities';

type EndRideConfirmSheetProps = {
  visible: boolean;
  vehicleName: string;
  startTime: string | null | undefined;
  rate: RidePricingSnapshot | null;
  ending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks before ending a ride. Ending is billed and cannot be undone, so one stray tap on
 * "Stop ride" while riding must not end it. Shows time and cost so far so the rider
 * knows what they are confirming.
 */
export function EndRideConfirmSheet({
  visible,
  vehicleName,
  startTime,
  rate,
  ending,
  onConfirm,
  onCancel,
}: EndRideConfirmSheetProps) {
  const { c } = useWayfinder();
  const { bottom } = useSafeAreaInsets();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const seconds = elapsedSeconds(startTime);

  const cost = estimateRideCost(rate, seconds);
  const close = ending ? () => {} : onCancel;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: c.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Keep riding" />
        <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: bottom + 20 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[Type.label, { color: c.accentText }]}>END RIDE</Text>
          <Text style={[Type.detailTitle, { color: c.text }]} accessibilityRole="header">
            End your ride?
          </Text>
          <Text style={[styles.note, { color: c.muted }]}>
            Park at a station with free spots first. You will be charged for this ride.
          </Text>

          <View style={[styles.stats, { borderTopColor: c.text, borderBottomColor: c.line }]}>
            <View style={styles.stat}>
              <Text style={[Type.secondary, { color: c.muted }]}>Vehicle</Text>
              <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
                {vehicleName}
              </Text>
            </View>
            <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
              <Text style={[Type.secondary, { color: c.muted }]}>Time</Text>
              <Text style={[Type.stat, styles.tabular, { color: c.text }]}>{formatRideDuration(seconds)}</Text>
            </View>
            <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
              <Text style={[Type.secondary, { color: c.muted }]}>So far</Text>
              <Text style={[Type.stat, { color: c.text }]}>{cost == null ? '—' : `$${cost.toFixed(2)}`}</Text>
            </View>
          </View>
          <Text style={[styles.fine, { color: c.muted }]}>The final price is confirmed on your receipt.</Text>

          <View style={styles.actions}>
            <Button label="Keep riding" variant="secondary" onPress={onCancel} disabled={ending} style={styles.flex} />
            <Button label="End ride" variant="inverse" onPress={onConfirm} loading={ending} style={styles.flex} />
          </View>
        </View>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 8,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 8 },
  note: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: 'row', marginTop: 8, borderTopWidth: 1.5, borderBottomWidth: 1 },
  stat: { flex: 1, paddingVertical: 12, minWidth: 0 },
  statDivided: { borderLeftWidth: 1, paddingLeft: 14 },
  tabular: { fontVariant: ['tabular-nums'] },
  fine: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
