import { router, useFocusEffect, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveRideDetails, ActiveRideStatusChip } from '@/components/active-ride-bottom-card';
import { OsmMapView } from '@/components/osm-map-view';
import { MapStationsFilterSheet } from '@/components/map-stations-filter-sheet';
import type { OsmMapViewRef } from '@/components/osm-map-types';
import { RideEndReceiptModal } from '@/components/ride-end-receipt-modal';
import { ScanToRideModal } from '@/components/scan-to-ride-modal';
import { StationDetailsPanel } from '@/components/station-details-panel';
import { SlowConnectionHint } from '@/components/ui/skeleton';
import { ThemedView } from '@/components/themed-view';
import { FiltersIcon, RefreshIcon } from '@/components/wayfinder/icons';
import { Dialog, IconButton } from '@/components/wayfinder/ui';
import { FontFamily, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMapScreen } from '@/hooks/use-map-screen';
import { useWayfinder } from '@/hooks/use-wayfinder';
import { createReservation, fetchVehiclesForStation, startRide, type VehicleWithState } from '@/lib/mobility-api';
import type { StationRow } from '@/types/entities';

const RIDE_MAP_HEIGHT = 168;

/**
 * OpenStreetMap-derived tiles (Leaflet in a WebView, or an iframe on web). No Google / Apple map SDK.
 * Station markers and location behavior match `useMapScreen`.
 */
export default function MapScreen() {
  const { c, isDark } = useWayfinder();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    region,
    stations,
    parkingStations,
    userLocation,
    loading,
    activeRide,
    pricingCatalog,
    ending,
    refresh,
    onEndRide,
    rideEndReceipt,
    dismissRideEndReceipt,
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
      // Close the station sheet now so only one native modal is ever up; iOS can leave an
      // invisible, touch-blocking layer when stacked modals are dismissed together.
      setSelectedStation(null);
      setReserveSuccessVisible(true);
    } finally {
      setReserveBusyVehicleId((current) => (current === vehicleId ? null : current));
    }
  }, [startRideBusyVehicleId, user]);

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
    router.push(reservationsRoute);
  }, []);

  const rideMapTop = insets.top + 8;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      {loading ? (
        <ThemedView style={styles.overlay}>
          <ActivityIndicator size="large" color={LoaderAccent} />
          <SlowConnectionHint />
        </ThemedView>
      ) : null}

      <View style={rideActive ? [styles.rideMap, { top: rideMapTop }] : styles.map}>
        <OsmMapView
          ref={mapRef}
          style={styles.map}
          region={region}
          stations={mapStations}
          userLocation={userLocation}
          onStationPress={onStationPress}
          stationMarkerMode={rideActive ? 'parking' : 'browse'}
          isDark={isDark}
          selectedStationId={selectedStation?.station_id ?? null}
        />
      </View>

      {rideActive && activeRide ? (
        <>
          <View style={[styles.rideChrome, { top: rideMapTop + 10 }]} pointerEvents="box-none">
            <ActiveRideStatusChip />
            <IconButton
              label="Refresh map"
              variant="inverse"
              onPress={() => void refreshAndAnimate()}
              icon={<RefreshIcon color={c.inverseText} />}
            />
          </View>
          <ActiveRideDetails
            activeRide={activeRide}
            ending={ending}
            stations={parkingStations}
            userLocation={userLocation}
            pricingCatalog={pricingCatalog}
            onEndRide={onEndRide}
            style={{ marginTop: rideMapTop + RIDE_MAP_HEIGHT }}
          />
        </>
      ) : (
        <>
          <View style={[styles.topControls, { top: insets.top + 12 }]} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasMapFilters ? 'Map filters, active' : 'Map filters'}
              style={({ pressed }) => [styles.filtersBtn, { backgroundColor: c.inverse, opacity: pressed ? 0.88 : 1 }]}
              onPress={() => setMapFiltersVisible(true)}>
              <FiltersIcon color={c.inverseText} />
              <Text style={[styles.filtersBtnText, { color: c.inverseText }]}>Filters</Text>
              {hasMapFilters ? <View style={[styles.filterDot, { backgroundColor: c.accent }]} /> : null}
            </Pressable>
            <IconButton
              label="Refresh map"
              variant="inverse"
              size={48}
              onPress={() => void refreshAndAnimate()}
              icon={<RefreshIcon color={c.inverseText} />}
            />
          </View>
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
            pricingCatalog={pricingCatalog}
            onClose={() => setSelectedStation(null)}
            onReserve={onReserveList}
            onStartRide={openScanToRideList}
          />
          <ScanToRideModal
            visible={scanVisible}
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
            showEmptyStations={showEmptyStations}
            visibleStationsCount={browseStationList.length}
            totalStationsCount={stations.length}
            onClose={() => setMapFiltersVisible(false)}
            onToggleShowEmptyStations={() => setShowEmptyStations((prev) => !prev)}
            onReset={() => setShowEmptyStations(false)}
          />
          <Dialog
            inline
            visible={reserveSuccessVisible}
            title="Reserved successfully"
            message={reserveSuccessMessage}
            onRequestClose={onReserveSuccessOk}
            actions={[{ label: 'OK', onPress: onReserveSuccessOk }]}
          />
        </>
      )}
      <RideEndReceiptModal visible={!!rideEndReceipt} billing={rideEndReceipt} onClose={dismissRideEndReceipt} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { ...StyleSheet.absoluteFill },
  rideMap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: RIDE_MAP_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  rideChrome: {
    position: 'absolute',
    left: 28,
    right: 26,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  topControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersBtn: {
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filtersBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
