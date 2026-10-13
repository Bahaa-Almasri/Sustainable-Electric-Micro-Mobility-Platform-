/**
 * Loading placeholders shaped like each screen, shown instead of a bare spinner
 * so users see the layout coming and a slow-connection hint if it drags on.
 */
import { ScrollView, StyleSheet, View } from 'react-native';

import { Skeleton, SlowConnectionHint } from '@/components/ui/skeleton';
import { useColorScheme } from '@/hooks/use-color-scheme';

function useCardBg(cardBg?: string) {
  const isDark = useColorScheme() === 'dark';
  return cardBg ?? (isDark ? '#1C1F21' : '#FFFFFF');
}

function SkeletonCard({ cardBg }: { cardBg: string }) {
  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <Skeleton width="55%" height={18} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
      <Skeleton width={84} height={24} radius={12} />
    </View>
  );
}

/** Reservations and Support: action button, heading, then a list of cards. */
export function ListScreenSkeleton({
  pageBg,
  cardBg,
  rows = 4,
  withHeading = true,
}: {
  pageBg: string;
  cardBg?: string;
  rows?: number;
  withHeading?: boolean;
}) {
  const bg = useCardBg(cardBg);
  return (
    <ScrollView style={{ backgroundColor: pageBg }} contentContainerStyle={styles.screen} scrollEnabled={false}>
      <Skeleton width={170} height={48} radius={24} />
      {withHeading ? <Skeleton width="45%" height={22} style={styles.heading} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonCard key={i} cardBg={bg} />
      ))}
      <SlowConnectionHint />
    </ScrollView>
  );
}

/** Wallet: balance card, packages, ride history row, package catalog. */
export function WalletSkeleton({ pageBg, cardBg }: { pageBg: string; cardBg?: string }) {
  const bg = useCardBg(cardBg);
  return (
    <ScrollView style={{ backgroundColor: pageBg }} contentContainerStyle={styles.screen} scrollEnabled={false}>
      <Skeleton height={140} radius={20} />
      <Skeleton width="40%" height={22} style={styles.heading} />
      <View style={[styles.card, { backgroundColor: bg }]}>
        <Skeleton width="50%" height={18} />
        <Skeleton width="35%" height={14} />
      </View>
      <Skeleton height={56} radius={14} />
      <Skeleton width="40%" height={22} style={styles.heading} />
      <SkeletonCard cardBg={bg} />
      <SkeletonCard cardBg={bg} />
      <SlowConnectionHint />
    </ScrollView>
  );
}

/** Account: avatar and name, profile progress, then settings rows. */
export function AccountSkeleton({ pageBg, cardBg }: { pageBg: string; cardBg?: string }) {
  const bg = useCardBg(cardBg);
  return (
    <ScrollView style={{ backgroundColor: pageBg }} contentContainerStyle={styles.screen} scrollEnabled={false}>
      <View style={styles.profileRow}>
        <Skeleton width={72} height={72} radius={36} />
        <View style={styles.profileText}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="85%" height={14} />
          <Skeleton width="50%" height={14} />
        </View>
      </View>
      <Skeleton height={10} radius={5} />
      <View style={[styles.card, { backgroundColor: bg }]}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={styles.settingsRow}>
            <Skeleton width={32} height={32} radius={16} />
            <Skeleton width="60%" height={16} />
          </View>
        ))}
      </View>
      <SkeletonCard cardBg={bg} />
      <SlowConnectionHint />
    </ScrollView>
  );
}

/** Vehicle details: hero image card, stat tiles, pricing line, action buttons. */
export function VehicleDetailSkeleton({ pageBg }: { pageBg: string }) {
  return (
    <ScrollView style={{ backgroundColor: pageBg }} contentContainerStyle={styles.screen} scrollEnabled={false}>
      <Skeleton height={300} radius={24} />
      <View style={styles.tileRow}>
        <Skeleton width="auto" height={76} radius={16} style={styles.tile} />
        <Skeleton width="auto" height={76} radius={16} style={styles.tile} />
        <Skeleton width="auto" height={76} radius={16} style={styles.tile} />
      </View>
      <Skeleton width="65%" height={16} />
      <Skeleton height={52} radius={26} />
      <Skeleton height={52} radius={26} />
      <SlowConnectionHint />
    </ScrollView>
  );
}

/** Station panel: the horizontal rail of vehicle cards. */
export function StationVehiclesSkeleton({ cardWidth, cardBg }: { cardWidth: number; cardBg?: string }) {
  const bg = useCardBg(cardBg);
  return (
    <View>
      <View style={styles.rail}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.card, styles.railCard, { width: cardWidth, backgroundColor: bg }]}>
            <Skeleton height={110} radius={14} />
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
            <Skeleton height={44} radius={22} />
          </View>
        ))}
      </View>
      <SlowConnectionHint />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    gap: 14,
  },
  heading: {
    marginTop: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileText: {
    flex: 1,
    gap: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
  },
  rail: {
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
  },
  railCard: {
    flexShrink: 0,
  },
});
