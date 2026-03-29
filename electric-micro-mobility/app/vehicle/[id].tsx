import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createReservation, fetchVehicleDetail, startRide, type VehicleWithState } from '@/lib/mobility-api';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleWithState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    const res = await fetchVehicleDetail(id);
    setError(res.error);
    setVehicle(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onStartRide() {
    if (!user || !vehicle || !id) return;
    setBusy(true);
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
    setBusy(false);
    if (err) {
      Alert.alert('Cannot start ride', err);
      return;
    }
    Alert.alert('Ride started', 'Have a safe trip. You can end the ride from the Map tab.');
    router.back();
  }

  async function onReserve() {
    if (!user || !id) return;
    setBusy(true);
    const { error: err } = await createReservation(user.id, id);
    setBusy(false);
    if (err) {
      Alert.alert('Reservation failed', err.message);
      return;
    }
    Alert.alert('Reserved', 'Vehicle is on hold. Head to the Reservations tab for details.');
    router.back();
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
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

  const v = vehicle.vehicles;
  const available = (v?.status ?? '').toLowerCase() === 'available';

  return (
    <ThemedView style={styles.body}>
      <Stack.Screen options={{ title: v?.model ?? 'Vehicle' }} />
      <ThemedText type="title">{v?.model ?? 'Vehicle'}</ThemedText>
      <ThemedText style={styles.muted}>Type: {v?.type ?? '—'}</ThemedText>
      <ThemedText style={styles.muted}>QR / id: {v?.qr_code ?? vehicle.vehicle_id}</ThemedText>
      <ThemedText style={styles.muted}>Fleet status: {v?.status ?? '—'}</ThemedText>
      <ThemedText style={styles.muted}>Battery: {vehicle.battery_level ?? '—'}%</ThemedText>
      <ThemedText style={styles.muted}>
        Last update: {vehicle.last_updated ?? v?.last_gps_at ?? '—'}
      </ThemedText>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, { backgroundColor: colors.tint }]}
          onPress={onStartRide}
          disabled={busy || !available}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryText}>{available ? 'Start ride' : 'Not available'}</ThemedText>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondary, { borderColor: colors.tint }]}
          onPress={onReserve}
          disabled={busy}>
          <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>Hold (reservation)</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 20, gap: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.8, fontSize: 15 },
  actions: { marginTop: 24, gap: 12 },
  primary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
});
