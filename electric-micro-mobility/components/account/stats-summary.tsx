import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { ACCENT, cardShadow } from '@/components/account/account-theme';

export type StatItem = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  highlight?: boolean;
  /** Span full width (e.g. environmental impact). */
  fullWidth?: boolean;
};

type Props = {
  items: StatItem[];
  colors: {
    text: string;
    muted: string;
    cardBg: string;
  };
};

export function StatsSummary({ items, colors }: Props) {
  return (
    <View style={[styles.grid, { gap: 10 }]}>
      {items.map((it) => (
        <View
          key={it.key}
          style={[
            styles.cell,
            it.fullWidth && styles.cellFull,
            cardShadow,
            {
              backgroundColor: colors.cardBg,
              borderColor: it.highlight ? `${ACCENT}24` : 'transparent',
              borderWidth: it.highlight ? 1 : 0,
            },
          ]}>
          <View style={styles.cellTop}>
            <View style={[styles.iconBg, { backgroundColor: `${ACCENT}14` }]}>
              <Ionicons name={it.icon} size={16} color={ACCENT} />
            </View>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
              {it.value}
            </Text>
          </View>
          <Text style={[styles.label, { color: colors.muted }]} numberOfLines={2}>
            {it.label}
          </Text>
          {it.sub ? (
            <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={2}>
              {it.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  cellFull: {
    width: '100%',
  },
  cellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconBg: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.85,
  },
});
