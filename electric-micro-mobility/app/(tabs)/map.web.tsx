import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  ActiveRideBottomCard,
  ActiveRideStatusChip,
} from '@/components/active-ride-bottom-card';
import { OsmMapView } from '@/components/osm-map-view';
import { MapStationsFilterSheet } from '@/components/map-stations-filter-sheet';
import type { OsmMapViewRef } from '@/components/osm-map-types';
import { ScanToRideModal } from '@/components/scan-to-ride-modal';
import { StationDetailsPanel } from '@/components/station-details-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMapScreen } from '@/hooks/use-map-screen';
import { createReservation, fetchVehiclesForStation, startRide, type VehicleWithState } from '@/lib/mobility-api';
import type { StationRow } from '@/types/entities';

const RED_ACCENT = '#FF4B41';

/**
 * Web map tab: same OSM / Leaflet stack as native (`map.tsx`) via iframe.
 */
export default function MapScreenWeb() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const {
    region,
    stations,
    parkingStations,
    userLocation,
    loading,
    activeRide,
    ending,
    refresh,
    onEndRide,
  } = useMapScreen();
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

  const rideActive = !!activeRide;

  const browseStationList = useMemo(
    () => stations.filter((s) => showEmptyStations || (s.available_vehicles ?? 0) > 0),
    [showEmptyStations, stations]
  );

  const mapStations = rideActive ? parkingStations : browseStationList;
  const hasMapFilters = showEmptyStations;

  const refreshAndAnimate = useCallback(async () => {
    const { region: next, stations: rawNext } = await refresh();
    const fitStations = rideActive
      ? rawNext
      : rawNext.filter((s) => showEmptyStations || (s.available_vehicles ?? 0) > 0);
    mapRef.current?.animateToRegion(next, fitStations, userLocation);
  }, [refresh, rideActive, showEmptyStations, userLocation]);

  useEffect(() => {
    if (!rideActive) return;
    setSelectedStation(null);
    setMapFiltersVisible(false);
    setScanVisible(false);
    setScanVehicleId(null);
    setStationVehicles([]);
    setStationError(null);
  }, [rideActive]);

  const loadStationVehicles = useCallback(async (station: StationRow) => {
    setStationLoading(true);
    setStationError(null);
    const { data, error } = await fetchVehiclesForStation(station.station_id);
    const filtered = (data ?? []).filter((v) => (v.vehicles?.status ?? '').toLowerCase() === 'available');
    setStationVehicles(filtered);
    if (error) {
      if (__DEV__) {
        console.error('[map-web] station vehicles fetch failed', {
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

  const onStationPress = useCallback(
    (stationId: string) => {
      if (rideActive) {
        const s = parkingStations.find((x) => x.station_id === stationId);
        if (!s) return;
        const spots = s.available_parking_spots ?? 0;
        Alert.alert(
          s.name ?? 'Station',
          spots > 0
            ? `${spots} free parking ${spots === 1 ? 'spot' : 'spots'} — you can end your ride here.`
            : 'No parking spots available here.'
        );
        return;
      }
      const station = browseStationList.find((x) => x.station_id === stationId);
      if (!station) return;
      setSelectedStation(station);
      void loadStationVehicles(station);
    },
    [browseStationList, loadStationVehicles, parkingStations, rideActive]
  );

  const onReserveList = useCallback(async (vehicleId: string) => {
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

  const openScanToRideList = useCallback((vehicleId: string) => {
    setScanVehicleId(vehicleId);
    setScanVisible(true);
  }, []);

  const closeScanToRideList = useCallback(() => {
    setScanVisible(false);
    setScanVehicleId(null);
  }, []);

  const onStartRideAfterScanList = useCallback(async () => {
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
    Alert.alert('Ride started', 'Have a safe trip.');
    closeScanToRideList();
    setSelectedStation(null);
    await refreshAndAnimate();
  }, [closeScanToRideList, region.latitude, region.longitude, refreshAndAnimate, scanVehicleId, user, userLocation?.latitude, userLocation?.longitude]);

  return (
    <View style={styles.flex}>
      {loading ? (
        <ThemedView style={styles.overlay}>
          <ActivityIndicator size="large" color={LoaderAccent} />
        </ThemedView>
      ) : null}

      <OsmMapView
        ref={mapRef}
        style={styles.map}
        region={region}
        stations={mapStations}
        userLocation={userLocation}
        onStationPress={onStationPress}
        stationMarkerMode={rideActive ? 'parking' : 'browse'}
      />

      {rideActive ? (
        <>
          <View style={styles.rideTopChrome} pointerEvents="box-none">
            <ActiveRideStatusChip isDark={isDark} />
          </View>
          {activeRide ? (
            <ActiveRideBottomCard
              activeRide={activeRide}
              isDark={isDark}
              ending={ending}
              onEndRide={onEndRide}
            />
          ) : null}
          <Pressable
            style={[styles.fabRide, { backgroundColor: RED_ACCENT }]}
            onPress={refreshAndAnimate}
            accessibilityLabel="Refresh map">
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </Pressable>
        </>
      ) : (
        <>
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
            activeVehicleId={null}
            userLocation={userLocation}
            accentColor={RED_ACCENT}
            isDark={isDark}
            onClose={() => setSelectedStation(null)}
            onReserve={onReserveList}
            onStartRide={openScanToRideList}
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
            onClose={closeScanToRideList}
            onScanConfirmed={onStartRideAfterScanList}
          />
          <MapStationsFilterSheet
            visible={mapFiltersVisible}
            isDark={isDark}
            accentColor={RED_ACCENT}
            showEmptyStations={showEmptyStations}
            visibleStationsCount={browseStationList.length}
            totalStationsCount={stations.length}
            onClose={() => setMapFiltersVisible(false)}
            onToggleShowEmptyStations={() => setShowEmptyStations((prev) => !prev)}
            onReset={() => setShowEmptyStations(false)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 480 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  rideTopChrome: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
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
  fabRide: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
