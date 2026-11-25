import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EndRideConfirmSheet } from '@/components/end-ride-confirm-sheet';
import { RideCostText, RideDurationText } from '@/components/ride-live-text';
import { RouteStop } from '@/components/wayfinder/route';
import { FontFamily, Type } from '@/constants/theme';
import { useRideDistance } from '@/hooks/use-ride-distance';
import { useTabBarSpace, useWayfinder } from '@/hooks/use-wayfinder';
import { distanceMetersBetween } from '@/lib/geo-distance';
import { haptics } from '@/lib/haptics';
import { fetchVehicleDetail } from '@/lib/mobility-api';
import { formatClock } from '@/lib/ride-time';
import { estimateRangeKm, getVehicleImageSource, getVehicleVisual, vehicleKindFromDbType } from '@/lib/vehicle-image-map';
import type { RidePricingCatalog, RideRowWithVehicle, StationRow, VehicleWithState } from '@/types/entities';

/** A ride starting this close to a station is shown as starting there. */
const START_STATION_RADIUS_M = 300;

/** Minimal top indicator on the map card. */
export const ActiveRideStatusChip = memo(function ActiveRideStatusChip() {
  const { c } = useWayfinder();
  return (
    <View style={[styles.chip, { backgroundColor: c.inverse }]}>
      <View style={[styles.chipDot, { backgroundColor: c.accent }]} />
      <Text style={[styles.chipText, { color: c.inverseText }]}>Active ride</Text>
    </View>
  );
});

function startStationName(ride: RideRowWithVehicle, stations: StationRow[]): string {
  if (ride.start_lat == null || ride.start_lng == null) return 'Ride start';
  const start = { latitude: ride.start_lat, longitude: ride.start_lng };
  let best: { name: string; meters: number } | null = null;
  for (const s of stations) {
    const meters = distanceMetersBetween(start, { latitude: s.lat, longitude: s.lng });
    if (!best || meters < best.meters) best = { name: s.name, meters };
  }
  return best && best.meters <= START_STATION_RADIUS_M ? best.name : 'Ride start';
}

type ActiveRideDetailsProps = {
  activeRide: RideRowWithVehicle;
  ending: boolean;
  stations: StationRow[];
  userLocation: { latitude: number; longitude: number } | null;
  pricingCatalog: RidePricingCatalog | null;
  onEndRide: () => void;
  style?: object;
};

/** Timer, route timeline, stats and Stop ride, shown under the map card during a ride. */
export const ActiveRideDetails = memo(function ActiveRideDetails({
  activeRide,
  ending,
  stations,
  userLocation,
  pricingCatalog,
  onEndRide,
  style,
}: ActiveRideDetailsProps) {
  const { c } = useWayfinder();
  const tabBarSpace = useTabBarSpace();
  const vehicleType = activeRide.vehicles?.type ?? null;
  const visual = getVehicleVisual(vehicleType);
  const imageSource = getVehicleImageSource(vehicleType);
  const [vehicleState, setVehicleState] = useState<VehicleWithState | null>(null);

  const loadVehicle = useCallback(async () => {
    const res = await fetchVehicleDetail(activeRide.vehicle_id);
    setVehicleState(res.data);
  }, [activeRide.vehicle_id]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const ridden = useRideDistance(activeRide.ride_id, userLocation);
  const startName = useMemo(() => startStationName(activeRide, stations), [activeRide, stations]);

  const battery = vehicleState?.battery_level;
  const batteryPct = battery == null || Number.isNaN(battery) ? null : Math.round(battery);
  const rangeKm = estimateRangeKm(vehicleType, battery ?? null);

  const rate = activeRide.pricing ?? pricingCatalog?.[vehicleKindFromDbType(vehicleType)] ?? null;
  const vehicleName = activeRide.vehicles?.model?.trim() || visual.title;
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <ScrollView
      style={[styles.details, { backgroundColor: c.bg }, style]}
      contentContainerStyle={[styles.detailsContent, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.timerHead}>
        <Text style={[Type.label, { color: c.muted }]}>DURATION</Text>
        <View style={styles.vehicleLine}>
          <View style={[styles.tile, { backgroundColor: c.photoTile }]}>
            {imageSource ? (
              <Image source={imageSource} style={styles.tileImage} resizeMode="contain" />
            ) : (
              <Ionicons name="bicycle" size={20} color="#121212" />
            )}
          </View>
          <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
            {vehicleName}
          </Text>
        </View>
      </View>
      <RideDurationText startTime={activeRide.start_time} style={[styles.timer, { color: c.text }]} />

      <View style={styles.timeline}>
        <RouteStop state="end" line="text" dotOffset={3}>
          <View style={styles.stopRow}>
            <View style={styles.stopText}>
              <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
                {startName}
              </Text>
              <Text style={[Type.secondary, { color: c.muted }]}>Started</Text>
            </View>
            <Text style={[Type.body, { color: c.text }]}>{formatClock(activeRide.start_time)}</Text>
          </View>
        </RouteStop>
        <RouteStop state="current" line="dashed" dotOffset={3}>
          <View style={styles.stopRow}>
            <View style={styles.stopText}>
              <Text style={[Type.body, { color: c.text }]}>You are here</Text>
              <Text style={[Type.secondary, { color: c.muted }]}>
                {ridden == null ? 'Turn on location to track distance' : `${(ridden / 1000).toFixed(1)} km ridden`}
              </Text>
            </View>
            <Text style={[Type.body, { color: c.accentText }]}>Now</Text>
          </View>
        </RouteStop>
        <RouteStop state="open" dotOffset={3}>
          <Text style={[Type.body, { color: c.text }]}>Any station with free spots</Text>
          <Text style={[Type.secondary, { color: c.muted }]}>Park there to end your ride</Text>
        </RouteStop>
      </View>

      <View style={[styles.stats, { borderTopColor: c.text, borderBottomColor: c.line }]}>
        <View style={styles.stat}>
          <Text style={[Type.secondary, { color: c.muted }]}>Battery</Text>
          <Text style={[Type.stat, { color: c.success }]}>{batteryPct == null ? '—' : `${batteryPct}%`}</Text>
        </View>
        <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
          <Text style={[Type.secondary, { color: c.muted }]}>Est. range</Text>
          <Text style={[Type.stat, { color: c.text }]}>{rangeKm == null ? '—' : `${rangeKm} km`}</Text>
        </View>
        <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
          <Text style={[Type.secondary, { color: c.muted }]}>So far</Text>
          <RideCostText startTime={activeRide.start_time} rate={rate} style={[Type.stat, { color: c.text }]} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop ride"
        accessibilityHint="Asks you to confirm before the ride ends"
        accessibilityState={{ disabled: ending }}
        hitSlop={8}
        onPress={() => {
          haptics.medium();
          setConfirmVisible(true);
        }}
        disabled={ending}
        style={({ pressed }) => [styles.stop, { backgroundColor: c.inverse, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[styles.stopSquare, { backgroundColor: c.accent }]} />
        <Text style={[styles.stopText2, { color: c.inverseText }]}>Stop ride</Text>
      </Pressable>

      <EndRideConfirmSheet
        visible={confirmVisible}
        vehicleName={vehicleName}
        startTime={activeRide.start_time}
        rate={rate}
        ending={ending}
        onConfirm={onEndRide}
        onCancel={() => setConfirmVisible(false)}
      />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: FontFamily.bold, fontSize: 13 },
  details: { flex: 1 },
  detailsContent: { paddingHorizontal: 24, paddingTop: 10 },
  timerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  vehicleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  tile: { width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileImage: { width: 34, height: 30 },
  timer: {
    fontFamily: FontFamily.display,
    fontSize: 84,
    lineHeight: 92,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timeline: { marginTop: 2 },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 12 },
  stopText: { flex: 1, minWidth: 0 },
  stats: { flexDirection: 'row', marginTop: 8, borderTopWidth: 1.5, borderBottomWidth: 1 },
  stat: { flex: 1, paddingVertical: 12 },
  statDivided: { borderLeftWidth: 1, paddingLeft: 14 },
  stop: {
    marginTop: 14,
    height: 58,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stopSquare: { width: 18, height: 18, borderRadius: 4 },
  stopText2: { fontFamily: FontFamily.bold, fontSize: 18 },
});
