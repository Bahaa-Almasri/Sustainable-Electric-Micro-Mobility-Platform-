import { useCallback, useMemo, useState } from 'react';

import type { VehicleWithState } from '@/types/entities';

export type VehicleTypeFilter = 'all' | 'car' | 'bike' | 'scooter';
export type BatteryRangeFilter = 'all' | '0-25' | '26-50' | '51-75' | '76-100';

function normalizeVehicleType(rawType: string | null | undefined): VehicleTypeFilter | null {
  if (!rawType) return null;
  const normalized = rawType.trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (normalized === 'car') return 'car';
  if (normalized === 'bike' || normalized === 'ebike') return 'bike';
  if (normalized === 'scooter' || normalized === 'escooter') return 'scooter';
  return null;
}

function matchesBatteryRange(level: number | null | undefined, range: BatteryRangeFilter): boolean {
  if (range === 'all') return true;
  if (level == null || Number.isNaN(level)) return false;
  if (range === '0-25') return level >= 0 && level <= 25;
  if (range === '26-50') return level >= 26 && level <= 50;
  if (range === '51-75') return level >= 51 && level <= 75;
  return level >= 76 && level <= 100;
}

export function useVehicleFilters(vehicles: VehicleWithState[]) {
  const [vehicleType, setVehicleType] = useState<VehicleTypeFilter>('all');
  const [batteryRange, setBatteryRange] = useState<BatteryRangeFilter>('all');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const typeMatch =
        vehicleType === 'all' ||
        normalizeVehicleType(vehicle.vehicles?.type) === vehicleType;
      const batteryMatch = matchesBatteryRange(vehicle.battery_level, batteryRange);
      return typeMatch && batteryMatch;
    });
  }, [vehicles, vehicleType, batteryRange]);

  const hasActiveFilters = vehicleType !== 'all' || batteryRange !== 'all';

  const resetFilters = useCallback(() => {
    setVehicleType('all');
    setBatteryRange('all');
  }, []);

  return {
    vehicleType,
    setVehicleType,
    batteryRange,
    setBatteryRange,
    filteredVehicles,
    hasActiveFilters,
    resetFilters,
  };
}
