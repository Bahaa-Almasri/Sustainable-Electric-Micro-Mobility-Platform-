import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
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

export function useMapScreen() {
  const { user } = useAuth();
  const [region, setRegion] = useState(DEFAULT_MAP_REGION);
  const [vehicles, setVehicles] = useState<VehicleWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRide, setActiveRide] = useState<RideRowWithVehicle | null>(null);
  const [ending, setEnding] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      return { region: DEFAULT_MAP_REGION, vehicles: [] as VehicleWithState[] };
    }
    setLoading(true);
    const perm = await Location.requestForegroundPermissionsAsync();
    let nextRegion: typeof DEFAULT_MAP_REGION = DEFAULT_MAP_REGION;
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
    const [rideRes, mapRes] = await Promise.all([
      getActiveRideForUser(user.id),
      fetchVehiclesForMap(),
    ]);
    const list = mapRes.data ?? [];
    setActiveRide(rideRes.data ?? null);
    setVehicles(list);
    setLoading(false);
    return { region: nextRegion, vehicles: list };
  }, [user]);

  const onEndRide = useCallback(async () => {
    if (!user || !activeRide) return;
    setEnding(true);
    let endLat = region.latitude;
    let endLng = region.longitude;
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      endLat = loc.coords.latitude;
      endLng = loc.coords.longitude;
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
