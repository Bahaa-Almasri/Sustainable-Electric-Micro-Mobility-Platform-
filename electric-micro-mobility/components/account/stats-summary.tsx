import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

export type StatItem = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  /** Show the value in the positive (green) colour. */
  positive?: boolean;
};

/** Inverse stats card with the coral pass stripe, three stats per row. */
export function StatsSummary({ items }: { items: StatItem[] }) {
  const { c } = useWayfinder();
  return (
    <View style={[styles.card, { backgroundColor: c.inverse }]}>
      <View style={[styles.stripe, { backgroundColor: c.accent }]} />
      <View style={styles.grid}>
        {items.map((it) => (
          <View key={it.key} style={styles.cell}>
            <Text
              style={[styles.value, { color: it.positive ? c.inverseSuccess : c.inverseText }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {it.value}
              {it.unit ? <Text style={styles.unit}> {it.unit}</Text> : null}
            </Text>
            <Text style={[styles.label, { color: c.inverseMuted }]} numberOfLines={1}>
              {it.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', flexDirection: 'row', marginBottom: 14 },
  stripe: { width: 12 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingLeft: 16, paddingRight: 10 },
  cell: { width: '33.33%', paddingVertical: 7, paddingRight: 8 },
  value: { fontFamily: FontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  unit: { fontSize: 14, letterSpacing: 0 },
  label: { fontFamily: FontFamily.regular, fontSize: 12 },
});
