import { router, useFocusEffect, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
const GRADIENT_RED = '#D90429';
const GRADIENT_BLACK = '#11181C';

/**
 * Native map: OpenStreetMap-derived tiles (Leaflet in WebView). No Google / Apple map SDK.
 * Web uses `map.web.tsx`. Station markers and location behavior match `useMapScreen`.
 */
export default function MapScreen() {
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
  const [reserveBusyVehicleId, setReserveBusyVehicleId] = useState<string | null>(null);
  const [startRideBusyVehicleId, setStartRideBusyVehicleId] = useState<string | null>(null);
  const [scanVehicleId, setScanVehicleId] = useState<string | null>(null);
  const [scanVisible, setScanVisible] = useState(false);
  const [mapFiltersVisible, setMapFiltersVisible] = useState(false);
  const [showEmptyStations, setShowEmptyStations] = useState(false);
  const [reserveSuccessVisible, setReserveSuccessVisible] = useState(false);
  const [reserveSuccessMessage, setReserveSuccessMessage] = useState('Your vehicle has been reserved successfully.');

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

  useEffect(() => {
    console.log('[Map] reserve success modal visibility changed', { visible: reserveSuccessVisible });
  }, [reserveSuccessVisible]);

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
    console.log('[Map] reserve button pressed', { vehicleId, userId: user.id });
    setReserveBusyVehicleId(vehicleId);
    console.log('[Map] reserve loading set', {
      reserveLoadingVehicleId: vehicleId,
      startRideLoadingVehicleId: startRideBusyVehicleId,
      scanUsesReserveLoading: false,
    });
    try {
      const { data, error } = await createReservation(user.id, vehicleId);
      if (error) {
        Alert.alert('Reservation failed', error.message);
        return;
      }
      console.log('[Map] reservation API success response', { vehicleId, data });
      const backendMessage = data?.message?.trim();
      const message = backendMessage || 'Your vehicle has been reserved successfully.';
      setReserveSuccessMessage(message);
      setReserveSuccessVisible(true);
      if (selectedStation) {
        void loadStationVehicles(selectedStation);
      }
    } finally {
      setReserveBusyVehicleId((current) => (current === vehicleId ? null : current));
    }
  }, [loadStationVehicles, selectedStation, startRideBusyVehicleId, user]);

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
    setStartRideBusyVehicleId(scanVehicleId);
    try {
      const { error } = await startRide({
        userId: user.id,
        vehicleId: scanVehicleId,
        startLat: userLocation?.latitude ?? region.latitude,
        startLng: userLocation?.longitude ?? region.longitude,
      });
      if (error) {
        Alert.alert('Cannot start ride', error);
        return;
      }
      Alert.alert('Ride started', 'Have a safe trip.');
      closeScanToRideList();
      setSelectedStation(null);
      await refreshAndAnimate();
    } finally {
      setStartRideBusyVehicleId((current) => (current === scanVehicleId ? null : current));
    }
  }, [closeScanToRideList, region.latitude, region.longitude, refreshAndAnimate, scanVehicleId, user, userLocation?.latitude, userLocation?.longitude]);

  const onReserveSuccessOk = useCallback(() => {
    const reservationsRoute = '/(tabs)/reservations' as Href;
    console.log('[Map] reservation success modal OK pressed');
    console.log('[Map] navigating to reservations route', { route: reservationsRoute });
    setReserveSuccessVisible(false);
    setSelectedStation(null);
    router.push(reservationsRoute);
  }, []);

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
            reserveBusyVehicleId={reserveBusyVehicleId}
            startRideBusyVehicleId={startRideBusyVehicleId}
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
            busy={startRideBusyVehicleId === scanVehicleId}
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
          <Modal
            visible={reserveSuccessVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setReserveSuccessVisible(false)}>
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
                <ThemedText style={styles.successSubtitle}>{reserveSuccessMessage}</ThemedText>
                <Pressable style={styles.successButton} onPress={onReserveSuccessOk}>
                  <ThemedText style={styles.successButtonText}>OK</ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      )}
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
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
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
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.88,
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
