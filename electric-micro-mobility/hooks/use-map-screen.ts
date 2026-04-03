import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { endRide, fetchActiveStations, fetchParkingAvailableStations, getActiveRideForUser } from '@/lib/mobility-api';
import type { RideRowWithVehicle, StationRow } from '@/types/entities';

export const DEFAULT_MAP_REGION = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

export type MapRefreshOptions = {
  /** Skip GPS and loading overlay; only refetch ride + vehicles (faster when returning to the tab). */
  silent?: boolean;
};

export function useMapScreen() {
  const { user } = useAuth();
  const [region, setRegion] = useState(DEFAULT_MAP_REGION);
  const regionRef = useRef(region);
  regionRef.current = region;
  const [stations, setStations] = useState<StationRow[]>([]);
  /** Populated while user has an active ride — stations with free parking only. */
  const [parkingStations, setParkingStations] = useState<StationRow[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRide, setActiveRide] = useState<RideRowWithVehicle | null>(null);
  const [ending, setEnding] = useState(false);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  /** Web: expo-location's watch cleanup calls LocationEventEmitter.removeSubscription, which does not exist on the web EventEmitter (crash on unmount). Poll instead. */
  const webLocationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const centeredFromGpsRef = useRef(false);

  const WEB_LOCATION_POLL_MS = 15000;

  const resolveCurrentLocation = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({});
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async (opts?: MapRefreshOptions) => {
    const silent = opts?.silent ?? false;
    if (!user) {
      setLoading(false);
      setParkingStations([]);
      return { region: regionRef.current, stations: [] as StationRow[] };
    }
    if (!silent) {
      setLoading(true);
    }
    let nextRegion: typeof DEFAULT_MAP_REGION = regionRef.current;
    try {
      if (!silent) {
        const loc = await resolveCurrentLocation();
        if (loc) {
          nextRegion = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          };
          setRegion(nextRegion);
          setUserLocation(loc);
        }
      }
      const rideRes = await getActiveRideForUser(user.id);
      const active = rideRes.error != null ? null : (rideRes.data ?? null);
      setActiveRide(active);

      if (active) {
        const pr = await fetchParkingAvailableStations();
        const rawP = pr.data ?? [];
        const seenP = new Set<string>();
        const parkingList = rawP.filter((s) => {
          if (!s.station_id || seenP.has(s.station_id)) return false;
          seenP.add(s.station_id);
          return true;
        });
        setParkingStations(parkingList);
        setStations([]);
        if (__DEV__) {
          console.log(
            `[map] active ride → GET /stations/parking-available → ${rawP.length} rows, ${parkingList.length} unique`
          );
        }
        return { region: nextRegion, stations: parkingList };
      }

      setParkingStations([]);
      const stationRes = await fetchActiveStations();
      const raw = stationRes.data ?? [];
      const seen = new Set<string>();
      const list = raw.filter((s) => {
        if (!s.station_id || seen.has(s.station_id)) return false;
        seen.add(s.station_id);
        return true;
      });
      if (__DEV__) {
        const markerPayload = list.filter((s) => s.lat != null && s.lng != null);
        console.log(
          `[map] GET /stations/active → ${raw.length} rows, ${list.length} unique station_id, ${markerPayload.length} with lat/lng`
        );
      }
      setStations(list);
      return { region: nextRegion, stations: list };
    } finally {
      setLoading(false);
    }
  }, [resolveCurrentLocation, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const loc = await resolveCurrentLocation();
      if (cancelled || !loc) return;
      setUserLocation(loc);
      if (!centeredFromGpsRef.current) {
        centeredFromGpsRef.current = true;
        setRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        });
      }

      if (Platform.OS === 'web') {
        const poll = async () => {
          if (cancelled) return;
          try {
            const l = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (cancelled) return;
            setUserLocation({
              latitude: l.coords.latitude,
              longitude: l.coords.longitude,
            });
          } catch {
            /* transient browser / permission noise */
          }
        };
        webLocationPollRef.current = setInterval(() => {
          void poll();
        }, WEB_LOCATION_POLL_MS);
        return;
      }

      try {
        locationWatcherRef.current?.remove();
        locationWatcherRef.current = null;
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 20,
          },
          (update) => {
            setUserLocation({
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            });
          }
        );
      } catch {
        // Keep single-location fallback if watching is unavailable.
      }
    })();

    return () => {
      cancelled = true;
      if (webLocationPollRef.current != null) {
        clearInterval(webLocationPollRef.current);
        webLocationPollRef.current = null;
      }
      try {
        locationWatcherRef.current?.remove();
      } catch {
        /* guard unexpected native cleanup errors */
      }
      locationWatcherRef.current = null;
    };
  }, [resolveCurrentLocation, user]);

  const onEndRide = useCallback(async () => {
    if (!user || !activeRide) return;
    setEnding(true);
    let endLat = region.latitude;
    let endLng = region.longitude;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        endLat = loc.coords.latitude;
        endLng = loc.coords.longitude;
      }
    } catch {
      /* use current region center as fallback */
    }
    const { error } = await endRide(activeRide.ride_id, activeRide.vehicle_id, endLat, endLng);
    setEnding(false);
    if (error) {
      Alert.alert('Could not end ride', error);
      return;
    }
    setActiveRide(null);
    await refresh();
  }, [user, activeRide, region.latitude, region.longitude, refresh]);

  return {
    region,
    setRegion,
    stations,
    parkingStations,
    userLocation,
    loading,
    activeRide,
    ending,
    refresh,
    onEndRide,
  };
}
