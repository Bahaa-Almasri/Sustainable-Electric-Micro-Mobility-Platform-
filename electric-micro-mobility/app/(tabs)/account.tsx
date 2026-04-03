import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { fetchRidesForUser, fetchUserMe } from '@/lib/mobility-api';
import type { RideRow, UserRow } from '@/types/entities';

const PAGE_BG = '#F9F9F9';
const ON_SURFACE = '#111111';
const MUTED_TEXT = '#757575';
const AVATAR_GRADIENT_START = '#6B4540';
const AVATAR_GRADIENT_END = '#2A3D2E';
const STAT_LABEL_MINUTES = '#1B4332';
const RED_ACCENT = '#FF4B41';
const BADGE_GOLD = '#E8C547';
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});
const STAT_CARD_HIGHLIGHT_SHADOW = Platform.select({
  ios: {
    shadowColor: '#FF4B41',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  android: { elevation: 4 },
  default: {},
});

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
  return `VEHICLE #${short}`;
}

function tripDurationLabel(mins: number | null): string {
  if (mins == null) return '—';
  return `${mins} MIN TRIP`;
}

function tripDurationSubLabel(mins: number | null): string {
  if (mins == null) return '—';
  if (mins >= 60) {
    const h = mins / 60;
    return h >= 1.5 ? `ABOUT ${Math.round(h)} HOURS` : 'ABOUT 1 HOUR';
  }
  return `${mins} MINUTES`;
}

type RideHistoryCardProps = {
  item: RideRow;
};

const RideHistoryCard = memo(function RideHistoryCard({ item }: RideHistoryCardProps) {
  const mins = rideDurationMinutes(item);
  const badgeText =
    mins != null
      ? `-${mins} MIN`
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

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const screenFocusRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const [profRes, ridesRes] = await Promise.all([fetchUserMe(), fetchRidesForUser(user.id)]);
      setProfile(profRes.data ?? null);
      if (!ridesRes.error && ridesRes.data) setRides(ridesRes.data);
      else setRides([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const silent = screenFocusRef.current;
      screenFocusRef.current = true;
      void load({ silent });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onSignOut = useCallback(async () => {
    await signOut();
    router.replace('/sign-in' as Href);
  }, [signOut]);

  const displayName =
    profile?.name?.trim() || user?.email?.trim() || 'Rider';

  const avatarLetter = useMemo(
    () => (displayName.trim().charAt(0) || '?').toUpperCase(),
    [displayName]
  );

  const totalMinutes = useMemo(
    () => rides.reduce((s, r) => s + (rideDurationMinutes(r) ?? 0), 0),
    [rides]
  );

  const emailDisplay = (profile?.email ?? user?.email ?? '').toUpperCase();

  const listHeader = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[AVATAR_GRADIENT_START, AVATAR_GRADIENT_END]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </LinearGradient>
          <Pressable
            style={styles.editFab}
            onPress={() => Alert.alert('Edit profile', 'Profile editing is not available yet.')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo">
            <Ionicons name="pencil" size={14} color="#FFFFFF" />
          </Pressable>
        </View>

        <ThemedText type="title" style={styles.nameCenter} lightColor={ON_SURFACE} darkColor={ON_SURFACE}>
          {displayName.toUpperCase()}
        </ThemedText>
        <Text style={styles.emailCaps}>{emailDisplay}</Text>

        {profile?.phone_number ? (
          <ThemedText style={styles.phoneLine} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            {profile.phone_number}
          </ThemedText>
        ) : null}
        {profile?.status ? (
          <ThemedText style={styles.statusLine} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            Account status: {profile.status}
          </ThemedText>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText type="title" style={styles.statValue} lightColor={ON_SURFACE} darkColor={ON_SURFACE}>
              {rides.length}
            </ThemedText>
            <Text style={styles.statLabelMuted}>TOTAL RIDES</Text>
          </View>
          <View style={[styles.statCard, styles.statCardEmphasized]}>
            <ThemedText type="title" style={styles.statValue} lightColor={ON_SURFACE} darkColor={ON_SURFACE}>
              {totalMinutes}
            </ThemedText>
            <Text style={[styles.statLabelGreen, { color: STAT_LABEL_MINUTES }]}>TOTAL MINUTES</Text>
          </View>
        </View>

        <ThemedText type="subtitle" style={styles.historyHeading} lightColor={ON_SURFACE} darkColor={ON_SURFACE}>
          RIDE HISTORY
        </ThemedText>
      </View>
    ),
    [avatarLetter, displayName, emailDisplay, profile, rides.length, totalMinutes]
  );

  const renderRideItem = useCallback(({ item }: { item: RideRow }) => <RideHistoryCard item={item} />, []);

  const listFooter = useMemo(
    () => (
      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    ),
    [onSignOut]
  );

  if (loading && !refreshing) {
    return (
      <ThemedView style={[styles.centered, styles.loadingScreen]}>
        <ActivityIndicator size="large" color={RED_ACCENT} />
      </ThemedView>
    );
  }

  return (
    <FlatList
      data={rides}
      keyExtractor={(r) => r.ride_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      style={{ backgroundColor: PAGE_BG }}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.empty} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            No rides recorded yet.
          </ThemedText>
        </View>
      }
      renderItem={renderRideItem}
      contentContainerStyle={styles.list}
      ListFooterComponent={listFooter}
      windowSize={7}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    paddingTop: 4,
    backgroundColor: PAGE_BG,
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
    paddingTop: 8,
    backgroundColor: PAGE_BG,
  },
  avatarWrap: {
    width: 128,
    height: 128,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '800',
  },
  editFab: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: PAGE_BG,
  },
  nameCenter: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  emailCaps: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
    letterSpacing: 0.85,
    textAlign: 'center',
    marginBottom: 10,
  },
  phoneLine: {
    fontSize: 13,
    opacity: 0.75,
    textAlign: 'center',
    marginBottom: 4,
  },
  statusLine: {
    fontSize: 12,
    opacity: 0.65,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  statCardEmphasized: {
    ...STAT_CARD_HIGHLIGHT_SHADOW,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 65, 0.14)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  statLabelMuted: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.9,
  },
  statLabelGreen: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  historyHeading: {
    marginTop: 32,
    marginBottom: 14,
    alignSelf: 'flex-start',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    marginBottom: 14,
    ...CARD_SHADOW,
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
  emptyWrap: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  empty: {
    opacity: 0.7,
    textAlign: 'center',
    fontSize: 14,
  },
  signOut: {
    marginTop: 32,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 65, 0.55)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: '72%',
  },
  signOutPressed: {
    opacity: 0.88,
  },
  signOutText: {
    color: RED_ACCENT,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    backgroundColor: PAGE_BG,
  },
});
