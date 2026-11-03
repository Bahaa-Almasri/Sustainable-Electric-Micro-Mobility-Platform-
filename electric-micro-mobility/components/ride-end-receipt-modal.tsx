import { StyleSheet, Text, View } from 'react-native';

import { Dialog } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import { formatUnlockRateLine, type EndRideBilling } from '@/lib/mobility-api';

type RideEndReceiptModalProps = {
  visible: boolean;
  billing: EndRideBilling | null;
  onClose: () => void;
};

export function RideEndReceiptModal({ visible, billing, onClose }: RideEndReceiptModalProps) {
  const { c } = useWayfinder();
  const p = billing?.pricing;
  const rateLine = p ? formatUnlockRateLine(p) : null;
  const minutes = billing?.duration_minutes ?? 0;
  const total = billing?.total_price ?? 0;
  const perMinTotal = p != null ? minutes * p.price_per_minute : 0;

  return (
    <Dialog
      visible={Boolean(visible && billing)}
      title="Ride complete"
      message={rateLine ?? undefined}
      onRequestClose={onClose}
      actions={[{ label: 'OK', onPress: onClose }]}>
      <View style={[styles.breakdown, { borderColor: c.line }]}>
        <Row label="Duration" value={`${minutes} min`} />
        {p != null ? (
          <>
            <Row label="Unlock fee" value={`$${p.initial_fee.toFixed(2)}`} />
            <Row
              label={`Ride time (${minutes} × $${p.price_per_minute.toFixed(2)}/min)`}
              value={`$${perMinTotal.toFixed(2)}`}
            />
          </>
        ) : null}
      </View>
      <View style={styles.total}>
        <Text style={[Type.label, { color: c.muted }]}>TOTAL</Text>
        <Text style={[styles.totalValue, { color: c.text }]}>${total.toFixed(2)}</Text>
      </View>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useWayfinder();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.muted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  breakdown: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10, gap: 8, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, fontFamily: FontFamily.regular, fontSize: 14 },
  rowValue: { fontFamily: FontFamily.bold, fontSize: 14 },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  totalValue: { fontFamily: FontFamily.display, fontSize: 40, letterSpacing: -1.5 },
});
