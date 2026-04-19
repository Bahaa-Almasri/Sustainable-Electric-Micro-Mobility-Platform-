import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { cardShadow } from '@/components/account/account-theme';
import type { RideRow } from '@/types/entities';

const AVATAR_GRADIENT_START = '#6B4540';
const AVATAR_GRADIENT_END = '#2A3D2E';
const ON_SURFACE = '#111111';
const MUTED_TEXT = '#757575';
const BADGE_GOLD = '#E8C547';

function rideDurationMinutes(r: RideRow): number | null {
  if (!r.start_time || !r.end_time) return null;
  const a = new Date(r.start_time).getTime();
  const b = new Date(r.end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}

function formatRideWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} • ${time}`;
}

function vehicleLabel(vehicleId: string): string {
  const short = vehicleId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `Vehicle #${short}`;
}

function tripDurationLabel(mins: number | null): string {
  if (mins == null) return '—';
  return `${mins} min trip`;
}

function tripDurationSubLabel(mins: number | null): string {
  if (mins == null) return '—';
  if (mins >= 60) {
    const h = mins / 60;
    return h >= 1.5 ? `About ${Math.round(h)} hours` : 'About 1 hour';
  }
  return `${mins} minutes`;
}

export type RidePreviewCardProps = {
  item: RideRow;
};

export const RidePreviewCard = memo(function RidePreviewCard({ item }: RidePreviewCardProps) {
  const mins = rideDurationMinutes(item);
  const badgeText =
    mins != null
      ? `-${mins} min`
      : item.cost != null
        ? `${item.cost}`
        : (item.status ?? '—').toUpperCase();
  return (
    <View style={styles.rideCard}>
      <View style={styles.rideTopRow}>
        <LinearGradient
          colors={[AVATAR_GRADIENT_START, AVATAR_GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rideIconCircle}>
          <Ionicons name="flash" size={18} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.rideTitleBlock}>
          <ThemedText
            type="defaultSemiBold"
            style={styles.rideVehicle}
            lightColor={ON_SURFACE}
            darkColor={ON_SURFACE}>
            {vehicleLabel(item.vehicle_id)}
          </ThemedText>
          <ThemedText style={styles.rideWhen} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            {formatRideWhen(item.start_time)}
          </ThemedText>
        </View>
        <View style={styles.rideBadge}>
          <Text style={styles.rideBadgeText}>{badgeText}</Text>
        </View>
      </View>
      <View style={styles.rideDivider} />
      <View style={styles.rideBottomRow}>
        <View style={styles.timerCircle}>
          <Ionicons name="time-outline" size={16} color="#757575" />
        </View>
        <ThemedText
          type="defaultSemiBold"
          style={styles.tripMain}
          lightColor={ON_SURFACE}
          darkColor={ON_SURFACE}>
          {tripDurationLabel(mins)}
        </ThemedText>
        <ThemedText style={styles.tripSub} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
          {tripDurationSubLabel(mins)}
        </ThemedText>
      </View>
      {item.cost != null && mins == null ? (
        <ThemedText style={styles.costNote} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
          Cost: {item.cost}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  rideCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
    overflow: 'hidden',
  },
  rideTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingBottom: 4,
  },
  rideIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingTop: 3,
  },
  rideVehicle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  rideWhen: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
  rideBadge: {
    backgroundColor: '#2C2C2C',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  rideBadgeText: {
    color: BADGE_GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  rideDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: 14,
    marginHorizontal: -16,
    marginBottom: 0,
  },
  rideBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F0F0',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6E6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripMain: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  tripSub: {
    fontSize: 11,
    maxWidth: '40%',
    textAlign: 'right',
    color: '#B0B0B0',
    fontWeight: '600',
  },
  costNote: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
});
