import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanToRideModal } from '@/components/scan-to-ride-modal';
import { VehicleDetailSkeleton } from '@/components/screen-skeletons';
import { ScanIcon } from '@/components/wayfinder/icons';
import { BackButton, Button, Dialog, StatusPill } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useWayfinder } from '@/hooks/use-wayfinder';
import {
  createReservation,
  fetchReservationsForUser,
  fetchVehicleDetails,
  startRide,
  type VehicleWithState,
} from '@/lib/mobility-api';
import { estimateRangeKm, getVehicleImageSelection, getVehicleVisual, vehicleKindFromDbType } from '@/lib/vehicle-image-map';
import type { ReservationRow, RidePricingCatalog } from '@/types/entities';

type AvailabilityState = 'available' | 'reserved' | 'in_use' | 'maintenance' | 'offline' | 'unknown';

function normalizeAvailability(raw: string | null | undefined): AvailabilityState {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'available' || value === 'reserved' || value === 'in_use' || value === 'maintenance' || value === 'offline') {
    return value;
  }
  return 'unknown';
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toShortId(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function isReservationStillActive(row: ReservationRow): boolean {
  if ((row.status ?? '').toLowerCase() !== 'active') return false;
  if (!row.expires_at) return true;
  const expiresAtMs = new Date(row.expires_at).getTime();
  if (Number.isNaN(expiresAtMs)) return true;
  return expiresAtMs > Date.now();
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useWayfinder();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleWithState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startRideBusy, setStartRideBusy] = useState(false);
  const [reserveLoadingVehicleId, setReserveLoadingVehicleId] = useState<string | null>(null);
  const [scanVisible, setScanVisible] = useState(false);
  const [myReservation, setMyReservation] = useState<ReservationRow | null>(null);
  const [pricingCatalog, setPricingCatalog] = useState<RidePricingCatalog | null>(null);
  const [reservationSuccessVisible, setReservationSuccessVisible] = useState(false);
  const [reservationSuccessMessage, setReservationSuccessMessage] = useState('Your vehicle has been reserved successfully.');

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    const { data: details, error: detailsError } = await fetchVehicleDetails(id);
    setError(detailsError);
    setVehicle(details?.vehicle ?? null);
    setPricingCatalog(details?.pricing ?? null);

    if (details?.myReservations) {
      const mine = details.myReservations
        .filter((row) => isReservationStillActive(row))
        .sort((a, b) => {
          const aMs = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bMs = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bMs - aMs;
        })[0];
      setMyReservation(mine ?? null);
    } else {
      setMyReservation(null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const v = vehicle?.vehicles;
  const visual = getVehicleVisual(v?.type ?? null);
  const imageSelection = getVehicleImageSelection(v?.type ?? null);
  const availability = normalizeAvailability(v?.status);
  const reservedByCurrentUser = availability === 'reserved' && !!myReservation;
  const rangeKm = estimateRangeKm(v?.type ?? null, vehicle?.battery_level ?? null);
  const rate = pricingCatalog?.[vehicleKindFromDbType(v?.type ?? null)] ?? null;
  const isReserveLoading = !!id && reserveLoadingVehicleId === id;
  const actionBusy = startRideBusy || isReserveLoading;
  const batteryRounded =
    vehicle?.battery_level == null || Number.isNaN(vehicle.battery_level)
      ? null
      : Math.round(vehicle.battery_level);
  const lowBattery = batteryRounded != null && batteryRounded <= 20;

  const primaryActionEnabled = !!user && (availability === 'available' || reservedByCurrentUser);
  const reserveActionEnabled = !!user && availability === 'available';

  const primaryLabel = reservedByCurrentUser
    ? 'Scan to Ride'
    : availability === 'available'
      ? 'Scan to Ride'
      : availability === 'reserved'
        ? 'Reserved by another rider'
        : availability === 'in_use'
          ? 'Currently in use'
          : 'Not available';

  const reserveLabel = reservedByCurrentUser
    ? 'Reserved by you'
    : availability === 'reserved'
      ? 'Unavailable'
      : availability === 'available'
        ? 'Reserve'
        : 'Cannot reserve';

  const statusPill = useMemo(() => {
    if (reservedByCurrentUser) return { label: 'Reserved by you', color: c.success };
    if (availability === 'available') return { label: 'Available', color: c.success };
    if (availability === 'reserved') return { label: 'Reserved', color: c.accentText };
    if (availability === 'in_use') return { label: 'In use', color: c.text };
    if (availability === 'maintenance') return { label: 'Maintenance', color: c.warning };
    return { label: 'Unavailable', color: c.muted };
  }, [availability, c, reservedByCurrentUser]);

  async function onStartRide() {
    if (!user || !vehicle || !id) return;
    setStartRideBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      let startLat = vehicle.lat ?? 0;
      let startLng = vehicle.lng ?? 0;
      if (perm.status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        startLat = loc.coords.latitude;
        startLng = loc.coords.longitude;
      }
      const { error: err } = await startRide({
        userId: user.id,
        vehicleId: id,
        startLat,
        startLng,
      });
      if (err) {
        Alert.alert('Cannot start ride', err);
        return;
      }
      setScanVisible(false);
      Alert.alert('Ride started', 'Have a safe trip. You can end the ride from the Map tab.');
      router.back();
    } finally {
      setStartRideBusy(false);
    }
  }

  async function onReserve() {
    if (!user || !id) return;
    setReserveLoadingVehicleId(id);
    try {
      const { data, error: err } = await createReservation(user.id, id);
      if (err) {
        Alert.alert('Reservation failed', err.message);
        return;
      }
      const backendMessage = data?.message?.trim();
      const successMessage = backendMessage || 'Your vehicle has been reserved successfully.';
      const reservationsRes = await fetchReservationsForUser(user.id);
      const latestMine = (reservationsRes.data ?? [])
        .filter((row) => row.vehicle_id === id && isReservationStillActive(row))
        .sort((a, b) => {
          const aMs = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bMs = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bMs - aMs;
        })[0];
      setMyReservation(latestMine ?? null);
      setReservationSuccessMessage(successMessage);
      await load();
      setReservationSuccessVisible(true);
    } finally {
      setReserveLoadingVehicleId((current) => (current === id ? null : current));
    }
  }

  function onReservationSuccessOk() {
    setReservationSuccessVisible(false);
    router.push('/(tabs)/reservations' as Href);
  }

  if (loading) {
    return <VehicleDetailSkeleton pageBg={c.bg} />;
  }

  if (error || !vehicle) {
    return (
      <View style={[styles.flex, styles.notFound, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}>
        <BackButton onPress={() => router.back()} />
        <Text style={[Type.detailTitle, { color: c.text }]}>Vehicle not found</Text>
        <Text style={[styles.note, { color: c.muted }]}>{error ?? 'Unknown error'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <BackButton onPress={() => router.back()} />
          <StatusPill label={statusPill.label} color={statusPill.color} />
        </View>

        <View style={styles.hero}>
          <View style={[styles.circle, { backgroundColor: c.photoTile }]} />
          {imageSelection.source ? (
            <Image source={imageSelection.source} resizeMode="contain" style={styles.image} accessibilityLabel={visual.title} />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="bicycle-outline" size={64} color="#121212" />
            </View>
          )}
          <View>
            <Text style={[Type.label, { color: c.muted }]}>BATTERY</Text>
            <Text style={[styles.battery, { color: c.text }]}>
              {batteryRounded ?? '—'}
              {batteryRounded != null ? <Text style={[styles.percent, { color: c.accent }]}>%</Text> : null}
            </Text>
            <View style={[styles.track, { backgroundColor: c.line }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${batteryRounded ?? 0}%`, backgroundColor: lowBattery ? c.accentText : c.success },
                ]}
              />
            </View>
          </View>
        </View>

        <Text style={[Type.label, { color: c.accentText }]}>{(v?.type ?? 'Unknown').toUpperCase()}</Text>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
          {v?.model?.trim() || visual.title}
        </Text>

        <View style={[styles.grid, { borderTopColor: c.text }]}>
          <View style={[styles.cell, { borderBottomColor: c.line }]}>
            <Text style={[Type.secondary, { color: c.muted }]}>Estimated range</Text>
            <Text style={[styles.cellValue, { color: c.text }]}>{rangeKm == null ? 'N/A' : `${rangeKm} km`}</Text>
          </View>
          <View style={[styles.cell, styles.cellRight, { borderBottomColor: c.line, borderLeftColor: c.line }]}>
            <Text style={[Type.secondary, { color: c.muted }]}>Ride rate</Text>
            <Text style={[styles.cellValue, { color: c.text }]}>
              {rate ? `$${rate.price_per_minute.toFixed(2)}` : 'N/A'}
              {rate ? <Text style={[styles.perMin, { color: c.muted }]}>/min</Text> : null}
            </Text>
          </View>
          <View style={[styles.cell, { borderBottomColor: c.line }]}>
            <Text style={[Type.secondary, { color: c.muted }]}>Vehicle ID</Text>
            <Text style={[styles.cellText, { color: c.text }]}>#{toShortId(vehicle.vehicle_id)}</Text>
          </View>
          <View style={[styles.cell, styles.cellRight, { borderBottomColor: c.line, borderLeftColor: c.line }]}>
            <Text style={[Type.secondary, { color: c.muted }]}>QR code</Text>
            <Text style={[styles.cellText, { color: c.text }]} numberOfLines={1}>
              {v?.qr_code ?? 'Not set'}
            </Text>
          </View>
        </View>

        <Text style={[styles.note, { color: c.muted }]}>
          {rate ? `$${rate.initial_fee.toFixed(2)} unlock fee · ` : ''}Last update{' '}
          {formatTimestamp(vehicle.last_updated ?? v?.last_gps_at)}
        </Text>
        {myReservation?.expires_at ? (
          <Text style={[styles.notice, { color: c.success }]}>
            Your reservation is active until {formatTimestamp(myReservation.expires_at)}
          </Text>
        ) : null}
        {lowBattery ? (
          <Text style={[styles.notice, { color: c.warning }]}>Low battery. Plan a shorter trip.</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          label={reserveLabel}
          variant="secondary"
          onPress={() => void onReserve()}
          loading={isReserveLoading}
          disabled={actionBusy || !reserveActionEnabled}
          height={58}
          style={styles.reserve}
        />
        <Button
          label={primaryLabel}
          onPress={() => setScanVisible(true)}
          loading={startRideBusy}
          disabled={actionBusy || !primaryActionEnabled}
          height={58}
          leading={primaryActionEnabled ? <ScanIcon color={c.onAccent} /> : undefined}
          style={styles.scan}
        />
      </View>

      <ScanToRideModal
        visible={scanVisible}
        busy={startRideBusy}
        expectedPayloads={[...(v?.qr_code ? [v.qr_code] : []), vehicle.vehicle_id]}
        onClose={() => setScanVisible(false)}
        onScanConfirmed={onStartRide}
      />

      <Dialog
        visible={reservationSuccessVisible}
        title="Reserved successfully"
        message={reservationSuccessMessage}
        onRequestClose={() => setReservationSuccessVisible(false)}
        actions={[{ label: 'OK', onPress: onReservationSuccessOk }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notFound: { paddingHorizontal: 24, gap: 12 },
  content: { paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { height: 276, justifyContent: 'center' },
  circle: { position: 'absolute', right: -74, top: 2, width: 270, height: 270, borderRadius: 135 },
  image: { position: 'absolute', right: -24, top: 0, width: 270, height: 270 },
  imageFallback: { position: 'absolute', right: 20, top: 100 },
  battery: { fontFamily: FontFamily.display, fontSize: 112, lineHeight: 112, letterSpacing: -5 },
  percent: { fontSize: 34, letterSpacing: 0 },
  track: { width: 120, height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  name: { fontFamily: FontFamily.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.6, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, borderTopWidth: 1.5 },
  cell: { width: '50%', paddingVertical: 12, borderBottomWidth: 1 },
  cellRight: { borderLeftWidth: 1, paddingLeft: 14 },
  cellValue: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 30 },
  cellText: { fontFamily: FontFamily.bold, fontSize: 16, marginTop: 2 },
  perMin: { fontFamily: FontFamily.semibold, fontSize: 14 },
  note: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 12 },
  notice: { fontFamily: FontFamily.semibold, fontSize: 14, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 12 },
  reserve: { flex: 1 },
  scan: { flex: 1.5 },
});
