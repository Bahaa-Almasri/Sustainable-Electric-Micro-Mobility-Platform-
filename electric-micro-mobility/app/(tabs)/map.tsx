import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OsmMapView } from '@/components/osm-map-view';
import { MapStationsFilterSheet } from '@/components/map-stations-filter-sheet';
import type { OsmMapViewRef } from '@/components/osm-map-types';
import { ScanToRideModal } from '@/components/scan-to-ride-modal';
import { StationDetailsPanel } from '@/components/station-details-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMapScreen } from '@/hooks/use-map-screen';
import { createReservation, fetchVehiclesForStation, startRide, type VehicleWithState } from '@/lib/mobility-api';
import type { StationRow } from '@/types/entities';

const RED_ACCENT = '#FF4B41';

/**
 * Native map: OpenStreetMap-derived tiles (Leaflet in WebView). No Google / Apple map SDK.
 * Web uses `map.web.tsx`. Station markers and location behavior match `useMapScreen`.
 */
export default function MapScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const { region, stations, userLocation, loading, activeRide, ending, refresh, onEndRide } = useMapScreen();
  const mapRef = useRef<OsmMapViewRef>(null);
  const mapHasBeenFocusedRef = useRef(false);
  const [selectedStation, setSelectedStation] = useState<StationRow | null>(null);
  const [stationVehicles, setStationVehicles] = useState<VehicleWithState[]>([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState<string | null>(null);
  const [busyVehicleId, setBusyVehicleId] = useState<string | null>(null);
  const [scanVehicleId, setScanVehicleId] = useState<string | null>(null);
  const [scanVisible, setScanVisible] = useState(false);
  const [mapFiltersVisible, setMapFiltersVisible] = useState(false);
  const [showEmptyStations, setShowEmptyStations] = useState(false);

  const filteredStations = useMemo(
    () => stations.filter((s) => showEmptyStations || (s.available_vehicles ?? 0) > 0),
    [showEmptyStations, stations]
  );
  const hasMapFilters = showEmptyStations;

  const refreshAndAnimate = useCallback(async () => {
    const { region: next, stations: nextStations } = await refresh();
    const visibleStations = nextStations.filter((s) => showEmptyStations || (s.available_vehicles ?? 0) > 0);
    mapRef.current?.animateToRegion(next, visibleStations, userLocation);
  }, [refresh, showEmptyStations, userLocation]);

  const loadStationVehicles = useCallback(async (station: StationRow) => {
    setStationLoading(true);
    setStationError(null);
    const { data, error } = await fetchVehiclesForStation(station.station_id);
    const filtered = (data ?? []).filter((v) => (v.vehicles?.status ?? '').toLowerCase() === 'available');
    setStationVehicles(filtered);
    if (error) {
      if (__DEV__) {
        console.error('[map] station vehicles fetch failed', {
          station_id: station.station_id,
          backend_error: error,
        });
      }
      setStationError('Unable to load vehicles right now. Please try again.');
    } else {
      setStationError(null);
    }
    setStationLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!mapHasBeenFocusedRef.current) {
        mapHasBeenFocusedRef.current = true;
        void refreshAndAnimate();
        return;
      }
      void refresh({ silent: true });
    }, [refresh, refreshAndAnimate])
  );

  const onStationPress = useCallback((stationId: string) => {
    const station = filteredStations.find((s) => s.station_id === stationId);
    if (!station) return;
    setSelectedStation(station);
    void loadStationVehicles(station);
  }, [filteredStations, loadStationVehicles]);

  const onReserve = useCallback(async (vehicleId: string) => {
    if (!user) return;
    setBusyVehicleId(vehicleId);
    const { error } = await createReservation(user.id, vehicleId);
    setBusyVehicleId(null);
    if (error) {
      Alert.alert('Reservation failed', error.message);
      return;
    }
    Alert.alert('Reserved', 'Vehicle is on hold. Head to Reservations tab for details.');
    if (selectedStation) {
      void loadStationVehicles(selectedStation);
    }
  }, [loadStationVehicles, selectedStation, user]);

  const selectedScanVehicle = useMemo(
    () => stationVehicles.find((v) => v.vehicle_id === scanVehicleId) ?? null,
    [scanVehicleId, stationVehicles]
  );

  const openScanToRide = useCallback((vehicleId: string) => {
    setScanVehicleId(vehicleId);
    setScanVisible(true);
  }, []);

  const closeScanToRide = useCallback(() => {
    setScanVisible(false);
    setScanVehicleId(null);
  }, []);

  const onStartRideAfterScan = useCallback(async () => {
    if (!user || !scanVehicleId) return;
    setBusyVehicleId(scanVehicleId);
    const { error } = await startRide({
      userId: user.id,
      vehicleId: scanVehicleId,
      startLat: userLocation?.latitude ?? region.latitude,
      startLng: userLocation?.longitude ?? region.longitude,
    });
    setBusyVehicleId(null);
    if (error) {
      Alert.alert('Cannot start ride', error);
      return;
    }
    Alert.alert('Ride started', 'Have a safe trip. You can end the ride from the Map tab.');
    closeScanToRide();
    setSelectedStation(null);
    await refreshAndAnimate();
  }, [closeScanToRide, region.latitude, region.longitude, refreshAndAnimate, scanVehicleId, user, userLocation?.latitude, userLocation?.longitude]);

  return (
    <View style={styles.flex}>
      {activeRide ? (
        <ThemedView style={[styles.banner, { borderColor: colors.tint, backgroundColor: colors.background }]}>
          <View style={styles.bannerText}>
            <ThemedText type="defaultSemiBold">Ride in progress</ThemedText>
            <ThemedText style={styles.muted}>
              {activeRide.vehicles?.model ?? 'Vehicle'} · {activeRide.vehicle_id.slice(0, 8)}…
            </ThemedText>
          </View>
          <Pressable
            style={[styles.endBtn, { backgroundColor: colors.tint }]}
            onPress={onEndRide}
            disabled={ending}>
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.endBtnText}>End ride</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}
      {loading ? (
        <ThemedView style={styles.overlay}>
          <ActivityIndicator size="large" color={LoaderAccent} />
        </ThemedView>
      ) : null}
      <OsmMapView
        ref={mapRef}
        style={styles.map}
        region={region}
        stations={filteredStations}
        userLocation={userLocation}
        onStationPress={onStationPress}
      />
      <View style={styles.topControls}>
        <Pressable
          style={({ pressed }) => [
            styles.filtersBtn,
            {
              backgroundColor: RED_ACCENT,
              borderColor: RED_ACCENT,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => setMapFiltersVisible(true)}>
          <ThemedText style={[styles.filtersBtnText, { color: '#FFFFFF' }]}>Filters</ThemedText>
          {hasMapFilters ? (
            <View style={[styles.filterDot, { backgroundColor: '#FFFFFF' }]} />
          ) : null}
        </Pressable>
      </View>
      <Pressable style={[styles.fab, { backgroundColor: RED_ACCENT }]} onPress={refreshAndAnimate}>
        <Ionicons name="refresh" size={20} color="#FFFFFF" />
      </Pressable>
      <StationDetailsPanel
        visible={!!selectedStation}
        station={selectedStation}
        vehicles={stationVehicles}
        loading={stationLoading}
        error={stationError}
        busyVehicleId={busyVehicleId}
        activeVehicleId={activeRide?.vehicle_id ?? null}
        userLocation={userLocation}
        accentColor={RED_ACCENT}
        isDark={isDark}
        onClose={() => setSelectedStation(null)}
        onReserve={onReserve}
        onStartRide={openScanToRide}
      />
      <ScanToRideModal
        visible={scanVisible}
        accentColor={RED_ACCENT}
        isDark={isDark}
        busy={busyVehicleId === scanVehicleId}
        expectedPayloads={[
          ...(selectedScanVehicle?.vehicles?.qr_code ? [selectedScanVehicle.vehicles.qr_code] : []),
          ...(selectedScanVehicle?.vehicle_id ? [selectedScanVehicle.vehicle_id] : []),
        ]}
        onClose={closeScanToRide}
        onScanConfirmed={onStartRideAfterScan}
      />
      <MapStationsFilterSheet
        visible={mapFiltersVisible}
        isDark={isDark}
        accentColor={RED_ACCENT}
        showEmptyStations={showEmptyStations}
        visibleStationsCount={filteredStations.length}
        totalStationsCount={stations.length}
        onClose={() => setMapFiltersVisible(false)}
        onToggleShowEmptyStations={() => setShowEmptyStations((prev) => !prev)}
        onReset={() => setShowEmptyStations(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 3,
    gap: 12,
  },
  bannerText: { flex: 1, gap: 2 },
  muted: { opacity: 0.75, fontSize: 13 },
  topControls: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: 'center',
  },
  filtersBtn: {
    borderWidth: 1.4,
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filtersBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  endBtnText: { color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  fabText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
