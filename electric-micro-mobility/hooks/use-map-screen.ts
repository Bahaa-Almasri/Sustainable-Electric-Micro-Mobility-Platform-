import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { endRide, fetchVehiclesForMap, getActiveRideForUser, type VehicleWithState } from '@/lib/mobility-api';
import type { RideRowWithVehicle } from '@/types/entities';

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
  const [vehicles, setVehicles] = useState<VehicleWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRide, setActiveRide] = useState<RideRowWithVehicle | null>(null);
  const [ending, setEnding] = useState(false);

  const refresh = useCallback(async (opts?: MapRefreshOptions) => {
    const silent = opts?.silent ?? false;
    if (!user) {
      setLoading(false);
      return { region: regionRef.current, vehicles: [] as VehicleWithState[] };
    }
    if (!silent) {
      setLoading(true);
    }
    let nextRegion: typeof DEFAULT_MAP_REGION = regionRef.current;
    try {
      if (!silent) {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          nextRegion = DEFAULT_MAP_REGION;
          if (perm.status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            nextRegion = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            };
            setRegion(nextRegion);
          }
        } catch {
          nextRegion = DEFAULT_MAP_REGION;
        }
      }
      const [rideRes, mapRes] = await Promise.all([
        getActiveRideForUser(user.id),
        fetchVehiclesForMap(),
      ]);
      const list = mapRes.data ?? [];
      setActiveRide(rideRes.data ?? null);
      setVehicles(list);
      return { region: nextRegion, vehicles: list };
    } finally {
      setLoading(false);
    }
  }, [user]);

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
    vehicles,
    loading,
    activeRide,
    ending,
    refresh,
    onEndRide,
  };
}
