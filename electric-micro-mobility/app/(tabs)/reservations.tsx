import { router, useFocusEffect, type Href } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ListScreenSkeleton } from '@/components/screen-skeletons';
import { Button, Card, DashedLine, Dialog, EmptyNote, Field, PageHeader, StatusPill, UnderlineTabs } from '@/components/wayfinder/ui';
import { FontFamily, LoaderAccent, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTabBarSpace, useWayfinder } from '@/hooks/use-wayfinder';
import { cancelReservation, createReservation, fetchReservationsForUser } from '@/lib/mobility-api';
import { getVehicleImageSource, getVehicleVisual } from '@/lib/vehicle-image-map';
import type { ReservationRow } from '@/types/entities';

const HOLD_SEGMENTS = 15;

type ListTab = 'active' | 'past';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCountdown(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function vehicleName(item: ReservationRow): string {
  return item.vehicles?.model?.trim() || getVehicleVisual(item.vehicles?.type ?? null).title;
}

function isActiveReservation(item: ReservationRow): boolean {
  if ((item.status ?? '').toLowerCase() !== 'active') return false;
  if (!item.expires_at) return true;
  const expiresMs = new Date(item.expires_at).getTime();
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs > Date.now();
}

function pastStatusLabel(item: ReservationRow): string {
  const status = (item.status ?? '').toLowerCase();
  if (status === 'active') return 'Expired';
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type HoldTicketProps = {
  item: ReservationRow;
  cancelling: boolean;
  onExpired: () => void;
  onViewDetails: (item: ReservationRow) => void;
  onCancelReservation: (item: ReservationRow) => void;
};

/** Active hold: the vehicle above the tear line, a live countdown below it. */
const HoldTicket = memo(function HoldTicket({ item, cancelling, onExpired, onViewDetails, onCancelReservation }: HoldTicketProps) {
  const { c } = useWayfinder();
  const expiresMs = item.expires_at ? new Date(item.expires_at).getTime() : NaN;
  const createdMs = item.created_at ? new Date(item.created_at).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasCountdown = !Number.isNaN(expiresMs);
  const remainingMs = hasCountdown ? expiresMs - now : 0;
  const totalMs = hasCountdown && !Number.isNaN(createdMs) ? expiresMs - createdMs : 0;
  const remainingSegments =
    totalMs > 0 ? Math.max(0, Math.min(HOLD_SEGMENTS, Math.ceil((remainingMs / totalMs) * HOLD_SEGMENTS))) : HOLD_SEGMENTS;

  useEffect(() => {
    if (hasCountdown && remainingMs <= 0) onExpired();
  }, [hasCountdown, onExpired, remainingMs]);

  const imageSource = getVehicleImageSource(item.vehicles?.type ?? null);

  return (
    <Card style={styles.ticket}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketHead}>
          <StatusPill label="RESERVED" color={c.accent} filled />
          <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={1}>
            #{item.vehicle_id.replace(/-/g, '').slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={styles.vehicleRow}>
          <View style={[styles.photo, { backgroundColor: c.photoTile }]}>
            {imageSource ? <Image source={imageSource} style={styles.photoImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.vehicleText}>
            <Text style={[styles.vehicleName, { color: c.text }]} numberOfLines={1}>
              {vehicleName(item)}
            </Text>
            <Text style={[Type.secondary, styles.vehicleSub, { color: c.muted }]} numberOfLines={2}>
              Your hold is active until it expires.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: c.bg, borderColor: c.line }]} />
        <DashedLine style={styles.tearLine} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: c.bg, borderColor: c.line }]} />
      </View>

      <View style={styles.ticketBottom}>
        <Text style={[Type.label, { color: c.muted }]}>YOUR HOLD EXPIRES IN</Text>
        <Text
          style={[styles.countdown, { color: c.text }]}
          accessibilityLabel={`Hold expires in ${formatCountdown(remainingMs)}`}>
          {hasCountdown ? formatCountdown(remainingMs) : '—'}
        </Text>
        <View style={styles.segments}>
          {Array.from({ length: HOLD_SEGMENTS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                { backgroundColor: i >= HOLD_SEGMENTS - remainingSegments ? c.accent : c.line },
              ]}
            />
          ))}
        </View>
        <View style={styles.segmentLabels}>
          <Text style={[Type.secondary, { color: c.muted }]}>Reserved {formatTime(item.created_at)}</Text>
          {totalMs > 0 ? (
            <Text style={[Type.secondary, { color: c.muted }]}>{Math.round(totalMs / 60000)} min hold</Text>
          ) : null}
        </View>
        <View style={styles.ticketActions}>
          <Button
            label="Find on map"
            onPress={() => router.push('/(tabs)/map' as Href)}
            height={48}
            radius={16}
            style={styles.flex}
          />
          <Button
            label="View details"
            variant="secondary"
            onPress={() => onViewDetails(item)}
            height={48}
            radius={16}
            style={styles.flex}
          />
        </View>
        <Button
          label="Cancel reservation"
          variant="text"
          onPress={() => onCancelReservation(item)}
          loading={cancelling}
          height={44}
        />
      </View>
    </Card>
  );
});

function PastRow({ item, onViewDetails }: { item: ReservationRow; onViewDetails: (item: ReservationRow) => void }) {
  const { c } = useWayfinder();
  return (
    <Card style={styles.pastCard}>
      <View style={styles.pastText}>
        <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
          {vehicleName(item)}
        </Text>
        <Text style={[Type.secondary, { color: c.muted }]}>
          {formatDay(item.created_at)} · {formatTime(item.created_at)} · {pastStatusLabel(item)}
        </Text>
      </View>
      <Button label="View details" variant="secondary" onPress={() => onViewDetails(item)} height={44} radius={22} style={styles.pastBtn} />
    </Card>
  );
}

export default function ReservationsScreen() {
  const { c } = useWayfinder();
  const tabBarSpace = useTabBarSpace();
  const { user } = useAuth();
  const [items, setItems] = useState<ReservationRow[]>([]);
  const [tab, setTab] = useState<ListTab>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleIdInput, setVehicleIdInput] = useState('');
  const [reserving, setReserving] = useState(false);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const screenFocusRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!user) return [] as ReservationRow[];
      if (!silent) setLoading(true);
      try {
        const { data, error } = await fetchReservationsForUser(user.id);
        const rows = !error && data ? (data as ReservationRow[]) : [];
        setItems(rows);
        return rows;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      const silent = screenFocusRef.current;
      screenFocusRef.current = true;
      // Arriving here usually follows a new hold, so show it rather than a stale Past tab.
      setTab('active');
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

  const onHoldExpired = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const onViewDetails = useCallback((r: ReservationRow) => {
    router.push(`/vehicle/${r.vehicle_id}` as Href);
  }, []);

  const onCancelReservation = useCallback((reservation: ReservationRow) => {
    if ((reservation.status ?? '').toLowerCase() !== 'active') {
      Alert.alert('Cannot cancel', 'Only active reservations can be cancelled.');
      return;
    }
    setSelectedReservation(reservation);
  }, []);

  const onConfirmCancelReservation = useCallback(async () => {
    if (!user) return;
    const reservationId = selectedReservation?.reservation_id?.trim();
    if (!reservationId) {
      Alert.alert('Cancellation failed', 'Missing reservation_id for selected row.');
      return;
    }
    setSelectedReservation(null);
    setCancellingReservationId(reservationId);
    try {
      const { data: deleteResult, error } = await cancelReservation(user.id, reservationId);
      if (error) {
        Alert.alert('Cancellation failed', error.message);
        return;
      }
      if (!deleteResult?.ok) {
        Alert.alert('Cancellation failed', 'Server did not confirm deletion.');
        return;
      }
      const refreshed = await load({ silent: true });
      if (refreshed.some((x) => x.reservation_id === reservationId && isActiveReservation(x))) {
        Alert.alert(
          'Removal not confirmed',
          'Reservation still appears after refresh. Please retry and check backend logs.'
        );
        return;
      }
      setDeleteSuccessMessage(deleteResult.message?.trim() || 'Your vehicle hold has been released.');
    } finally {
      setCancellingReservationId(null);
    }
  }, [load, selectedReservation, user]);

  async function submitReservation() {
    const id = vehicleIdInput.trim();
    if (!id || !user) {
      Alert.alert('Vehicle ID required', 'Paste the vehicle UUID from the map or fleet.');
      return;
    }
    setReserving(true);
    const { error } = await createReservation(user.id, id);
    setReserving(false);
    if (error) {
      Alert.alert('Could not reserve', error.message);
      return;
    }
    setVehicleIdInput('');
    Alert.alert('Reserved', 'Your hold is active until it expires.');
    void load({ silent: true });
  }

  const activeItems = useMemo(() => items.filter(isActiveReservation), [items]);
  const pastItems = useMemo(() => items.filter((r) => !isActiveReservation(r)), [items]);
  const tabs = useMemo(
    () => [
      { label: `Active · ${activeItems.length}`, value: 'active' as const },
      { label: 'Past', value: 'past' as const },
    ],
    [activeItems.length]
  );

  const renderItem = useCallback(
    ({ item }: { item: ReservationRow }) =>
      tab === 'active' ? (
        <HoldTicket
          item={item}
          cancelling={cancellingReservationId === item.reservation_id}
          onExpired={onHoldExpired}
          onViewDetails={onViewDetails}
          onCancelReservation={onCancelReservation}
        />
      ) : (
        <PastRow item={item} onViewDetails={onViewDetails} />
      ),
    [cancellingReservationId, onCancelReservation, onHoldExpired, onViewDetails, tab]
  );

  if (loading && !refreshing) {
    return <ListScreenSkeleton pageBg={c.bg} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={tab === 'active' ? activeItems : pastItems}
        keyExtractor={(r) => r.reservation_id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LoaderAccent} colors={[LoaderAccent]} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.pageHeader}>
              <PageHeader title="Reservations" />
            </View>
            <UnderlineTabs options={tabs} value={tab} onChange={setTab} style={styles.tabs} />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyNote
              text={
                tab === 'active'
                  ? 'No reservations yet. Find a scooter on the map or enter a vehicle ID to reserve.'
                  : 'No past reservations yet.'
              }
            />
          </View>
        }
        ListFooterComponent={
          tab === 'active' ? (
            <View style={styles.reserveRow}>
              <Field
                label="Reserve by vehicle ID"
                placeholder="Vehicle UUID"
                autoCapitalize="none"
                autoCorrect={false}
                value={vehicleIdInput}
                onChangeText={setVehicleIdInput}
                onSubmitEditing={() => void submitReservation()}
                style={styles.flex}
              />
              <Button
                label="Reserve"
                variant="secondary"
                onPress={() => void submitReservation()}
                loading={reserving}
                height={44}
                radius={22}
                style={styles.reserveBtn}
              />
            </View>
          ) : undefined
        }
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace }]}
        windowSize={7}
        initialNumToRender={6}
      />

      <Dialog
        visible={!!selectedReservation}
        title="Cancel reservation"
        message={`Do you want to cancel reservation #${selectedReservation?.reservation_id?.slice(0, 8).toUpperCase() ?? 'N/A'} now?`}
        onRequestClose={() => setSelectedReservation(null)}
        actions={[
          { label: 'Keep', variant: 'secondary', onPress: () => setSelectedReservation(null) },
          { label: 'Cancel it', onPress: () => void onConfirmCancelReservation() },
        ]}
      />

      <Dialog
        visible={deleteSuccessMessage != null}
        title="Reservation cancelled"
        message={deleteSuccessMessage ?? undefined}
        onRequestClose={() => setDeleteSuccessMessage(null)}
        actions={[{ label: 'Done', onPress: () => setDeleteSuccessMessage(null) }]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageHeader: { marginHorizontal: -16 },
  tabs: { marginHorizontal: 8, marginBottom: 4 },
  emptyWrap: { paddingHorizontal: 8 },
  ticket: { borderRadius: 26 },
  ticketTop: { padding: 18, paddingBottom: 14 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  photo: { width: 84, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: 76, height: 68 },
  vehicleText: { flex: 1, minWidth: 0 },
  vehicleName: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  vehicleSub: { fontSize: 14 },
  tear: { height: 24, justifyContent: 'center' },
  tearLine: { marginHorizontal: 18 },
  notch: { position: 'absolute', top: 0, width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  ticketBottom: { paddingHorizontal: 18, paddingBottom: 6, paddingTop: 2 },
  countdown: {
    fontFamily: FontFamily.display,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  },
  segments: { flexDirection: 'row', gap: 4, marginTop: 8 },
  segment: { flex: 1, height: 14, borderRadius: 3 },
  segmentLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  ticketActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pastCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pastText: { flex: 1, minWidth: 0 },
  pastBtn: { paddingHorizontal: 16 },
  reserveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12, paddingHorizontal: 8 },
  reserveBtn: { paddingHorizontal: 18 },
});
