import type { ImageSourcePropType } from 'react-native';

/** Values of `public.vehicles.type` (Postgres `vehicle_type`). */
export type VehicleKind = 'scooter' | 'bike' | 'car';

export type VehicleCommerceSpecs = {
  pricePerHour: number;
  maxSpeedKmh: number;
  maxLoadKg: number;
};

type VehicleVisualConfig = {
  title: string;
  subtitle: string;
  icon: 'flash' | 'bicycle' | 'bicycle-outline' | 'car-outline';
  image: ImageSourcePropType | null;
};

type VehicleImageKey = VehicleKind | 'generic';

const VEHICLE_IMAGE_MAP: Record<VehicleKind, ImageSourcePropType> = {
  scooter: require('@/assets/vehicles/electric-scooter-elite.png'),
  bike: require('@/assets/vehicles/ebike.png'),
  car: require('@/assets/vehicles/microlino.png'),
};

const VEHICLE_VISUALS: Record<VehicleKind, Omit<VehicleVisualConfig, 'image'>> = {
  scooter: {
    title: 'Electric scooter',
    subtitle: 'Quick city ride',
    icon: 'flash',
  },
  bike: {
    title: 'Bike',
    subtitle: 'Easy pedal commute',
    icon: 'bicycle',
  },
  car: {
    title: 'Electric microcar',
    subtitle: 'Weather-protected city trip',
    icon: 'car-outline',
  },
};

/**
 * Map `vehicles.type` to a display kind. Only exact enum strings are recognized;
 * legacy `ebike` is treated as `bike`. Everything else falls back to scooter (with a dev warning).
 */
export function vehicleKindFromDbType(rawType: string | null | undefined): VehicleKind {
  const v = (rawType ?? '').toLowerCase().trim();
  if (v === 'ebike') return 'bike';
  if (v === 'scooter' || v === 'bike' || v === 'car') {
    return v;
  }
  if (__DEV__ && rawType != null && String(rawType).trim() !== '') {
    console.warn('[vehicle] unknown vehicles.type:', rawType, '(expected scooter | bike | car); using scooter image');
  }
  return 'scooter';
}

const COMMERCE_BY_KIND: Record<VehicleKind, VehicleCommerceSpecs> = {
  scooter: { pricePerHour: 10, maxSpeedKmh: 25, maxLoadKg: 100 },
  bike: { pricePerHour: 8, maxSpeedKmh: 25, maxLoadKg: 120 },
  car: { pricePerHour: 18, maxSpeedKmh: 90, maxLoadKg: 220 },
};

/** Display pricing and spec limits by `vehicles.type` (until backend exposes real rates). */
export function getVehicleCommerceSpecs(rawType: string | null | undefined): VehicleCommerceSpecs {
  return COMMERCE_BY_KIND[vehicleKindFromDbType(rawType)];
}

/** Soft gradient colors for the hero blob behind vehicle art. */
export function getVehicleHeroBlobGradient(kind: VehicleKind, isDark: boolean): [string, string] {
  if (isDark) {
    if (kind === 'car') return ['rgba(255,75,65,0.34)', 'rgba(17,24,28,0.62)'];
    if (kind === 'bike') return ['rgba(255,75,65,0.28)', 'rgba(32,32,32,0.54)'];
    return ['rgba(255,75,65,0.38)', 'rgba(17,24,28,0.58)'];
  }
  if (kind === 'car') return ['rgba(255,75,65,0.2)', 'rgba(17,24,28,0.14)'];
  if (kind === 'bike') return ['rgba(255,75,65,0.16)', 'rgba(32,32,32,0.1)'];
  return ['rgba(255,183,170,0.65)', 'rgba(17,24,28,0.08)'];
}

export function getVehicleKind(rawType: string | null | undefined): VehicleKind {
  return vehicleKindFromDbType(rawType);
}

function normalizeVehicleType(rawType: string | null | undefined): string {
  return (rawType ?? '').trim().toLowerCase();
}

function imageKeyFromVehicleType(rawType: string | null | undefined): VehicleImageKey {
  const normalized = normalizeVehicleType(rawType);
  if (normalized === 'ebike') return 'bike';
  if (normalized === 'scooter' || normalized === 'bike' || normalized === 'car') {
    return normalized;
  }
  return 'generic';
}

export function getVehicleImageSelection(rawType: string | null | undefined): {
  key: VehicleImageKey;
  normalizedType: string;
  source: ImageSourcePropType | null;
} {
  const normalizedType = normalizeVehicleType(rawType);
  const key = imageKeyFromVehicleType(rawType);
  return {
    key,
    normalizedType,
    source: key === 'generic' ? null : VEHICLE_IMAGE_MAP[key],
  };
}

/** Image for this vehicle: driven only by `vehicles.type`. */
export function getVehicleImageSource(rawType: string | null | undefined): ImageSourcePropType | null {
  return getVehicleImageSelection(rawType).source;
}

export function getVehicleVisual(rawType: string | null | undefined): VehicleVisualConfig & { kind: VehicleKind } {
  const kind = vehicleKindFromDbType(rawType);
  return {
    kind,
    ...VEHICLE_VISUALS[kind],
    image: VEHICLE_IMAGE_MAP[kind],
  };
}

export function estimateRangeKm(rawType: string | null | undefined, batteryLevel: number | null): number | null {
  if (batteryLevel == null || Number.isNaN(batteryLevel)) return null;
  const kind = vehicleKindFromDbType(rawType);
  const maxRangeByType: Record<VehicleKind, number> = {
    scooter: 35,
    bike: 45,
    car: 120,
  };
  const maxRange = maxRangeByType[kind];
  return Math.max(1, Math.round((batteryLevel / 100) * maxRange));
}
