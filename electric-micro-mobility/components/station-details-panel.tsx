import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StationVehicleCard } from '@/components/station-vehicle-card';
import { StationVehiclesSkeleton } from '@/components/screen-skeletons';
import { VehicleFiltersPanel } from '@/components/vehicle-filters-panel';
import { IconButton } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useVehicleFilters } from '@/hooks/use-vehicle-filters';
import { useWayfinder } from '@/hooks/use-wayfinder';
import { distanceMetersBetween } from '@/lib/geo-distance';
import type { RidePricingCatalog, StationRow, VehicleWithState } from '@/types/entities';

/** Average walking pace, for the walk-time estimate. */
const WALK_METERS_PER_MINUTE = 80;

type StationDetailsPanelProps = {
  visible: boolean;
  station: StationRow | null;
  vehicles: VehicleWithState[];
  loading: boolean;
  error: string | null;
  reserveBusyVehicleId: string | null;
  startRideBusyVehicleId: string | null;
  activeVehicleId: string | null;
  userLocation: { latitude: number; longitude: number } | null;
  pricingCatalog: RidePricingCatalog | null;
  onClose: () => void;
  onReserve: (vehicleId: string) => void;
  onStartRide: (vehicleId: string) => void;
};

function formatStationDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} M` : `${(meters / 1000).toFixed(1)} KM`;
}

export const StationDetailsPanel = memo(function StationDetailsPanel({
  visible,
  station,
  vehicles,
  loading,
  error,
  reserveBusyVehicleId,
  startRideBusyVehicleId,
  activeVehicleId,
  userLocation,
  pricingCatalog,
  onClose,
  onReserve,
  onStartRide,
}: StationDetailsPanelProps) {
  const { c } = useWayfinder();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const stationName = station?.name ?? 'Station';
  const availableCount = station?.available_vehicles ?? 0;
  const parkingSpots = station?.available_parking_spots ?? null;
  const capacity = station?.capacity ?? null;

  const nonActiveVehicles = useMemo(() => {
    return vehicles.filter((v) => !activeVehicleId || v.vehicle_id !== activeVehicleId);
  }, [vehicles, activeVehicleId]);
  const {
    vehicleType,
    setVehicleType,
    batteryRange,
    setBatteryRange,
    filteredVehicles,
    hasActiveFilters,
    resetFilters,
  } = useVehicleFilters(nonActiveVehicles);

  useEffect(() => {
    resetFilters();
  }, [resetFilters, station?.station_id]);

  const stationLocation = useMemo(() => {
    if (!station) return { latitude: 0, longitude: 0 };
    return { latitude: station.lat, longitude: station.lng };
  }, [station]);

  const distanceMeters = station && userLocation ? distanceMetersBetween(userLocation, stationLocation) : null;
  const walkMinutes = distanceMeters == null ? null : Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MINUTE));

  const carouselGap = 12;
  const railViewport = Math.min(Math.max(280, screenWidth - 48), 520);
  const cardWidth = filteredVehicles.length > 1 ? Math.round(railViewport * 0.88) : railViewport;
  const snapInterval = cardWidth + carouselGap;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.backdrop }]}>
        {/* Tap-outside-to-close sits behind the sheet: wrapping the sheet in a Pressable steals swipes from the vehicle rail on iOS. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close station details" />
        <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: bottom + 20 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[Type.label, { color: c.accentText }]}>
                STATION{distanceMeters == null ? '' : ` · ${formatStationDistance(distanceMeters)}`}
              </Text>
              <Text style={[Type.detailTitle, { color: c.text }]} numberOfLines={2}>
                {stationName}
              </Text>
            </View>
            <IconButton
              label="Close"
              variant="line"
              size={44}
              onPress={onClose}
              icon={<Ionicons name="close" size={20} color={c.text} />}
            />
          </View>

          <View style={[styles.stats, { borderColor: c.line }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: c.text }]}>{availableCount}</Text>
              <Text style={[styles.statLabel, { color: c.muted }]}>vehicles</Text>
            </View>
            <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
              <Text style={[styles.statValue, { color: c.text }]}>{parkingSpots ?? capacity ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: c.muted }]}>{parkingSpots != null ? 'parking' : 'capacity'}</Text>
            </View>
            <View style={[styles.stat, styles.statDivided, { borderLeftColor: c.line }]}>
              <Text style={[styles.statValue, { color: c.text }]}>{walkMinutes ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: c.muted }]}>min walk</Text>
            </View>
          </View>

          <VehicleFiltersPanel
            vehicleType={vehicleType}
            batteryRange={batteryRange}
            hasActiveFilters={hasActiveFilters}
            onVehicleTypeChange={setVehicleType}
            onBatteryRangeChange={setBatteryRange}
            onReset={resetFilters}
          />

          {loading ? (
            <StationVehiclesSkeleton cardWidth={cardWidth} cardBg={c.surface} />
          ) : error ? (
            <View style={[styles.feedback, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Ionicons name="alert-circle-outline" size={24} color={c.accentText} />
              <Text style={[styles.feedbackText, { color: c.accentText }]}>{error}</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={[styles.feedback, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Ionicons name="bicycle-outline" size={28} color={c.muted} />
              <Text style={[styles.feedbackText, { color: c.muted }]}>
                {hasActiveFilters
                  ? 'No vehicles match your current filters. Try resetting filters.'
                  : 'No vehicles available here right now.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: carouselGap }}
              snapToInterval={snapInterval}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              bounces={false}>
              {filteredVehicles.map((vehicle) => (
                <StationVehicleCard
                  key={vehicle.vehicle_id}
                  vehicle={vehicle}
                  cardWidth={cardWidth}
                  userLocation={userLocation}
                  stationLocation={stationLocation}
                  reserveBusy={reserveBusyVehicleId === vehicle.vehicle_id}
                  startRideBusy={startRideBusyVehicleId === vehicle.vehicle_id}
                  pricingCatalog={pricingCatalog}
                  onReserve={onReserve}
                  onStartRide={onStartRide}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    maxHeight: '88%',
    gap: 12,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingVertical: 8 },
  statDivided: { borderLeftWidth: 1, paddingLeft: 12 },
  statValue: { fontFamily: FontFamily.display, fontSize: 22 },
  statLabel: { fontFamily: FontFamily.regular, fontSize: 13 },
  feedback: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center', gap: 10 },
  feedbackText: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
