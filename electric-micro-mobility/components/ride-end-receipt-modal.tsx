import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatUnlockRateLine, type EndRideBilling } from '@/lib/mobility-api';

const GRADIENT_RED = '#D90429';
const GRADIENT_BLACK = '#11181C';
const ACCENT = '#FF4B41';

type RideEndReceiptModalProps = {
  visible: boolean;
  billing: EndRideBilling | null;
  isDark: boolean;
  onClose: () => void;
};

export function RideEndReceiptModal({ visible, billing, isDark, onClose }: RideEndReceiptModalProps) {
  const p = billing?.pricing;
  const rateLine = p ? formatUnlockRateLine(p) : null;
  const minutes = billing?.duration_minutes ?? 0;
  const total = billing?.total_price ?? 0;
  const perMinTotal = p != null ? minutes * p.price_per_minute : 0;

  const cardBg = isDark ? '#151718' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.08)';
  const muted = isDark ? '#9BA1A6' : '#687076';
  const strong = isDark ? '#ECEDEE' : '#11181C';

  return (
    <Modal visible={Boolean(visible && billing)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <LinearGradient colors={[GRADIENT_RED, GRADIENT_BLACK]} style={styles.iconWrap}>
            <Ionicons name="receipt-outline" size={28} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText style={[styles.title, { color: strong }]}>Ride complete</ThemedText>
          {rateLine ? (
            <ThemedText style={[styles.rateSummary, { color: muted }]} numberOfLines={2}>
              {rateLine}
            </ThemedText>
          ) : null}

          <View style={[styles.breakdown, { borderColor: border }]}>
            <Row label="Duration" value={`${minutes} min`} muted={muted} strong={strong} />
            {p != null ? (
              <>
                <Row
                  label="Unlock fee"
                  value={`$${p.initial_fee.toFixed(2)}`}
                  muted={muted}
                  strong={strong}
                />
                <Row
                  label={`Ride time (${minutes} × $${p.price_per_minute.toFixed(2)}/min)`}
                  value={`$${perMinTotal.toFixed(2)}`}
                  muted={muted}
                  strong={strong}
                />
              </>
            ) : null}
          </View>

          <View style={styles.totalBlock}>
            <ThemedText style={[styles.totalLabel, { color: muted }]}>Total</ThemedText>
            <ThemedText style={[styles.totalAmount, { color: strong }]}>${total.toFixed(2)}</ThemedText>
          </View>

          <Pressable style={styles.btn} onPress={onClose}>
            <ThemedText style={styles.btnText}>OK</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted: string;
  strong: string;
}) {
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.rowLabel, { color: muted }]} numberOfLines={2}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.rowValue, { color: strong }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 30,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'stretch',
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  rateSummary: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  breakdown: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    gap: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  totalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  btn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: ACCENT,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
