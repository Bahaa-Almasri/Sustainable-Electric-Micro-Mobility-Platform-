import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScanToRideModal } from '@/components/scan-to-ride-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  createReservation,
  fetchReservationsForUser,
  fetchRidePricingCatalog,
  fetchVehicleDetail,
  formatUnlockRateLine,
  startRide,
  type VehicleWithState,
} from '@/lib/mobility-api';
import {
  estimateRangeKm,
  getVehicleHeroBlobGradient,
  getVehicleImageSelection,
  getVehicleVisual,
  vehicleKindFromDbType,
} from '@/lib/vehicle-image-map';
import type { ReservationRow, RidePricingCatalog } from '@/types/entities';

const RED_ACCENT = '#FF4B41';
const GRADIENT_RED = '#D90429';
const GRADIENT_BLACK = '#11181C';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
    const [vehicleRes, reservationRes, pricingRes] = await Promise.all([
      fetchVehicleDetail(id),
      user ? fetchReservationsForUser(user.id) : Promise.resolve({ data: null, error: null }),
      fetchRidePricingCatalog(),
    ]);
    setError(vehicleRes.error);
    setVehicle(vehicleRes.data);
    setPricingCatalog(pricingRes.error != null ? null : pricingRes.data);

    if (reservationRes.data) {
      const mine = reservationRes.data
        .filter((row) => row.vehicle_id === id && isReservationStillActive(row))
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
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const v = vehicle?.vehicles;
  const visual = getVehicleVisual(v?.type ?? null);
  const imageSelection = getVehicleImageSelection(v?.type ?? null);
  const availability = normalizeAvailability(v?.status);
  const reservedByCurrentUser = availability === 'reserved' && !!myReservation;
  const rangeKm = estimateRangeKm(v?.type ?? null, vehicle?.battery_level ?? null);
  const unlockLine =
    formatUnlockRateLine(pricingCatalog?.[vehicleKindFromDbType(v?.type ?? null)] ?? null) ?? null;
  const blobGradient = getVehicleHeroBlobGradient(visual.kind, isDark);
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
      ? 'Reservation unavailable'
      : availability === 'available'
        ? 'Hold for 15 min'
        : 'Cannot reserve now';

  const statusPill = useMemo(() => {
    if (reservedByCurrentUser) {
      return { label: 'Reserved by you', bg: 'rgba(27,67,50,0.2)', color: isDark ? '#8ED1A2' : '#1B4332' };
    }
    if (availability === 'available') {
      return { label: 'Available', bg: 'rgba(27,67,50,0.18)', color: isDark ? '#9FE3B2' : '#1B4332' };
    }
    if (availability === 'reserved') {
      return { label: 'Reserved', bg: 'rgba(217,4,41,0.2)', color: isDark ? '#FF8A98' : '#D90429' };
    }
    if (availability === 'in_use') {
      return { label: 'In use', bg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.12)', color: isDark ? '#ECEDEE' : '#11181C' };
    }
    if (availability === 'maintenance') {
      return { label: 'Maintenance', bg: 'rgba(245,159,0,0.2)', color: isDark ? '#FFD47A' : '#9C6B00' };
    }
    return { label: 'Unavailable', bg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.12)', color: isDark ? '#D0D5DA' : '#687076' };
  }, [availability, isDark, reservedByCurrentUser]);

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
    console.log('[VehicleDetail] reserve button clicked', { vehicleId: id, userId: user.id });
    setReserveLoadingVehicleId(id);
    console.log('[VehicleDetail] reserve loading started', { loadingVehicleId: id });
    try {
      const { data, error: err } = await createReservation(user.id, id);
      if (err) {
        Alert.alert('Reservation failed', err.message);
        return;
      }
      console.log('[VehicleDetail] reserve success response', { vehicleId: id, data });
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
      console.log('[VehicleDetail] reservation success modal opening', { vehicleId: id, message: successMessage });
      setReservationSuccessVisible(true);
    } finally {
      setReserveLoadingVehicleId((current) => (current === id ? null : current));
    }
  }

  function onReservationSuccessOk() {
    const reservationsRoute = '/(tabs)/reservations' as Href;
    console.log('[VehicleDetail] reservation success modal OK pressed', { vehicleId: id });
    console.log('[VehicleDetail] navigating to reservations route', { route: reservationsRoute });
    setReservationSuccessVisible(false);
    router.push(reservationsRoute);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  if (error || !vehicle) {
    return (
      <ThemedView style={styles.body}>
        <Stack.Screen options={{ title: 'Vehicle' }} />
        <ThemedText type="subtitle">Vehicle not found</ThemedText>
        <ThemedText style={styles.muted}>{error ?? 'Unknown error'}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.body, { backgroundColor: isDark ? '#0F1112' : '#F6F7F8' }]}>
      <Stack.Screen options={{ title: 'Vehicle' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={isDark ? ['rgba(217,4,41,0.22)', 'rgba(17,24,28,0.16)'] : ['rgba(255,75,65,0.14)', 'rgba(17,24,28,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.08)' }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleBlock}>
              <ThemedText style={styles.vehicleTitle}>{visual.title}</ThemedText>
              <ThemedText style={styles.vehicleSubtitle}>{visual.subtitle}</ThemedText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: statusPill.bg }]}>
              <ThemedText style={[styles.statusChipText, { color: statusPill.color }]}>{statusPill.label}</ThemedText>
            </View>
          </View>

          <View style={styles.heroImageWrap}>
            <LinearGradient
              colors={blobGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBlob}
            />
            {imageSelection.source ? (
              <Image source={imageSelection.source} resizeMode="contain" style={styles.heroImage} />
            ) : (
              <View style={styles.genericImageFallback}>
                <Ionicons name="bicycle-outline" size={40} color={isDark ? '#ECEDEE' : '#11181C'} />
                <ThemedText style={styles.genericImageFallbackText}>Generic vehicle</ThemedText>
              </View>
            )}
          </View>
        </LinearGradient>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? '#17191A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.08)',
            },
          ]}>
          <ThemedText style={styles.infoSectionTitle}>Vehicle Information</ThemedText>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Type</ThemedText>
              <ThemedText style={styles.infoValue}>{(v?.type ?? 'Unknown').toUpperCase()}</ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Vehicle ID</ThemedText>
              <ThemedText style={styles.infoValue}>#{toShortId(vehicle.vehicle_id)}</ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>QR code</ThemedText>
              <ThemedText style={styles.infoValue}>{v?.qr_code ?? 'Not set'}</ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Battery</ThemedText>
              <ThemedText style={styles.infoValue}>
                {batteryRounded == null ? 'N/A' : `${batteryRounded}%`}
              </ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Estimated range</ThemedText>
              <ThemedText style={styles.infoValue}>{rangeKm == null ? 'N/A' : `${rangeKm} km`}</ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Ride rate</ThemedText>
              <ThemedText style={styles.infoValue}>{unlockLine ?? 'Not available'}</ThemedText>
            </View>
            <View style={styles.infoCell}>
              <ThemedText style={styles.infoLabel}>Last update</ThemedText>
              <ThemedText style={styles.infoValue}>{formatTimestamp(vehicle.last_updated ?? v?.last_gps_at)}</ThemedText>
            </View>
          </View>
          {myReservation?.expires_at ? (
            <View style={[styles.myReservationBadge, { backgroundColor: 'rgba(27,67,50,0.12)' }]}>
              <Ionicons name="time-outline" size={16} color="#1B4332" />
              <ThemedText style={styles.myReservationText}>
                Your reservation is active until {formatTimestamp(myReservation.expires_at)}
              </ThemedText>
            </View>
          ) : null}
          {lowBattery ? (
            <View style={[styles.warningBadge, { backgroundColor: 'rgba(245,159,0,0.16)' }]}>
              <Ionicons name="warning-outline" size={16} color="#9C6B00" />
              <ThemedText style={styles.warningText}>Low battery. Plan a shorter trip.</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: RED_ACCENT,
                opacity: pressed || actionBusy || !primaryActionEnabled ? 0.86 : 1,
              },
            ]}
            onPress={() => setScanVisible(true)}
            disabled={actionBusy || !primaryActionEnabled}>
            {startRideBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.primaryInner}>
                <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.primaryText}>{primaryLabel}</ThemedText>
              </View>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              {
                borderColor: RED_ACCENT,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                opacity: pressed || actionBusy || !reserveActionEnabled ? 0.82 : 1,
              },
            ]}
            onPress={onReserve}
            disabled={actionBusy || !reserveActionEnabled}>
            {isReserveLoading ? (
              <ActivityIndicator color={RED_ACCENT} />
            ) : (
              <ThemedText style={[styles.secondaryText, { color: RED_ACCENT }]}>{reserveLabel}</ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <ScanToRideModal
        visible={scanVisible}
        accentColor={RED_ACCENT}
        isDark={isDark}
        busy={startRideBusy}
        expectedPayloads={[...(v?.qr_code ? [v.qr_code] : []), vehicle.vehicle_id]}
        onClose={() => setScanVisible(false)}
        onScanConfirmed={onStartRide}
      />

      <Modal visible={reservationSuccessVisible} transparent animationType="fade" onRequestClose={() => setReservationSuccessVisible(false)}>
        <View style={styles.successOverlay}>
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: isDark ? '#151718' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.08)',
              },
            ]}>
            <LinearGradient colors={[GRADIENT_RED, GRADIENT_BLACK]} style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={28} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText style={styles.successTitle}>Reserved successfully</ThemedText>
            <ThemedText style={styles.successSubtitle}>{reservationSuccessMessage}</ThemedText>
            <Pressable style={styles.successButton} onPress={onReservationSuccessOk}>
              <ThemedText style={styles.successButtonText}>OK</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.8, fontSize: 15, lineHeight: 22 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleBlock: {
    flex: 1,
    gap: 4,
  },
  vehicleTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  vehicleSubtitle: {
    opacity: 0.72,
    fontSize: 14,
    lineHeight: 20,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroImageWrap: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroBlob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroImage: {
    width: 220,
    height: 168,
  },
  genericImageFallback: {
    width: 180,
    height: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(17,24,28,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,24,28,0.04)',
  },
  genericImageFallbackText: {
    fontSize: 12,
    opacity: 0.72,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  infoGrid: {
    gap: 10,
  },
  infoCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  myReservationBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  myReservationText: {
    color: '#1B4332',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  warningBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#9C6B00',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  actions: { marginTop: 2, gap: 12 },
  primary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  secondaryText: {
    fontWeight: '700',
    fontSize: 15,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  successSubtitle: {
    opacity: 0.75,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  successButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: RED_ACCENT,
    minHeight: 44,
    minWidth: 136,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  successButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
