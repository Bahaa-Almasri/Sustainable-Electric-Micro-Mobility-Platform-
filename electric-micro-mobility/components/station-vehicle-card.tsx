import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ScanIcon } from '@/components/wayfinder/icons';
import { Button } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import { distanceMetersBetween, formatDistanceAway } from '@/lib/geo-distance';
import {
  estimateRangeKm,
  getVehicleCommerceSpecs,
  getVehicleImageSource,
  getVehicleVisual,
  vehicleKindFromDbType,
} from '@/lib/vehicle-image-map';
import type { RidePricingCatalog, VehicleWithState } from '@/types/entities';

type StationVehicleCardProps = {
  vehicle: VehicleWithState;
  cardWidth: number;
  userLocation: { latitude: number; longitude: number } | null;
  stationLocation: { latitude: number; longitude: number };
  reserveBusy: boolean;
  startRideBusy: boolean;
  /** When set, replaces hardcoded hourly rate with backend unlock + per-minute rate. */
  pricingCatalog: RidePricingCatalog | null;
  onReserve: (vehicleId: string) => void;
  onStartRide: (vehicleId: string) => void;
};

function formatOperationalLine(operational: string | null | undefined): string | null {
  if (!operational) return null;
  const o = operational.toLowerCase().trim();
  if (o === 'healthy' || o === 'ok' || o === 'operational') return null;
  return `Status · ${operational.replace(/_/g, ' ')}`;
}

export const StationVehicleCard = memo(function StationVehicleCard({
  vehicle,
  cardWidth,
  userLocation,
  stationLocation,
  reserveBusy,
  startRideBusy,
  pricingCatalog,
  onReserve,
  onStartRide,
}: StationVehicleCardProps) {
  const { c } = useWayfinder();
  const dbType = vehicle.vehicles?.type ?? null;
  const kind = vehicleKindFromDbType(dbType);
  const visual = getVehicleVisual(dbType);
  const imageSource = getVehicleImageSource(dbType);
  const commerce = getVehicleCommerceSpecs(dbType);
  const rate = pricingCatalog?.[kind] ?? null;
  const rangeKm = estimateRangeKm(dbType, vehicle.battery_level);
  const operationalLine = formatOperationalLine(vehicle.status);

  const batteryPct =
    vehicle.battery_level == null || Number.isNaN(vehicle.battery_level)
      ? null
      : Math.round(vehicle.battery_level);
  const batteryColor = batteryPct == null ? c.muted : batteryPct < 25 ? c.accentText : batteryPct < 55 ? c.warning : c.success;

  const distanceMeters = useMemo(() => {
    if (!userLocation) return null;
    const vLat = vehicle.lat;
    const vLng = vehicle.lng;
    if (vLat != null && vLng != null && !Number.isNaN(vLat) && !Number.isNaN(vLng)) {
      return distanceMetersBetween(userLocation, { latitude: vLat, longitude: vLng });
    }
    return distanceMetersBetween(userLocation, stationLocation);
  }, [userLocation, vehicle.lat, vehicle.lng, stationLocation]);
  const distanceLabel = userLocation ? formatDistanceAway(distanceMeters) : 'Turn on location';

  return (
    <View style={[styles.card, { width: cardWidth, backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: c.photoTile }]}>
          {imageSource ? (
            <Image source={imageSource} style={styles.image} resizeMode="contain" accessibilityLabel={visual.title} />
          ) : (
            <Ionicons name={visual.icon} size={32} color="#121212" accessibilityLabel={visual.title} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[Type.body, styles.name, { color: c.text }]} numberOfLines={1}>
            {vehicle.vehicles?.model?.trim() || visual.title}
          </Text>
          <View style={styles.batteryRow}>
            <View style={[styles.batteryTrack, { backgroundColor: c.line }]}>
              <View style={[styles.batteryFill, { width: `${batteryPct ?? 0}%`, backgroundColor: batteryColor }]} />
            </View>
            <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={1}>
              {batteryPct == null ? '—' : `${batteryPct}%`} · {rangeKm == null ? '—' : `${rangeKm} km`}
            </Text>
          </View>
        </View>
        <View style={styles.price}>
          {rate ? (
            <>
              <Text style={[styles.priceValue, { color: c.text }]}>${rate.price_per_minute.toFixed(2)}</Text>
              <Text style={[styles.priceSub, { color: c.muted }]}>/min · ${rate.initial_fee.toFixed(2)} start</Text>
            </>
          ) : (
            <>
              <Text style={[styles.priceValue, { color: c.text }]}>${commerce.pricePerHour}</Text>
              <Text style={[styles.priceSub, { color: c.muted }]}>/hr</Text>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>
        {operationalLine ?? `${distanceLabel} · ${commerce.maxSpeedKmh} km/h max · ${commerce.maxLoadKg} kg load`}
      </Text>
      <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>
        ID {vehicle.vehicle_id.slice(0, 8)}…
      </Text>

      <View style={styles.actions}>
        <Button
          label="Reserve"
          variant="secondary"
          onPress={() => onReserve(vehicle.vehicle_id)}
          loading={reserveBusy}
          height={46}
          radius={14}
          style={styles.reserve}
        />
        <Button
          label="Scan to Ride"
          onPress={() => onStartRide(vehicle.vehicle_id)}
          loading={startRideBusy}
          height={46}
          radius={14}
          leading={<ScanIcon color={c.onAccent} size={18} />}
          style={styles.scan}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  tile: { width: 64, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  image: { width: 56, height: 50 },
  info: { flex: 1, minWidth: 0, gap: 6 },
  name: { fontSize: 16 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryTrack: { width: 44, height: 4, borderRadius: 2, overflow: 'hidden' },
  batteryFill: { height: 4, borderRadius: 2 },
  price: { alignItems: 'flex-end' },
  priceValue: { fontFamily: FontFamily.display, fontSize: 18 },
  priceSub: { fontFamily: FontFamily.regular, fontSize: 12 },
  meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  reserve: { flex: 1 },
  scan: { flex: 1.4 },
});
