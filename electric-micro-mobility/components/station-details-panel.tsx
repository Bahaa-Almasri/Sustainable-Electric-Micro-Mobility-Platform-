import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { StationVehicleCard } from '@/components/station-vehicle-card';
import { ThemedText } from '@/components/themed-text';
import { LoaderAccent } from '@/constants/theme';
import { VehicleFiltersPanel } from '@/components/vehicle-filters-panel';
import { useVehicleFilters } from '@/hooks/use-vehicle-filters';
import type { RidePricingCatalog, StationRow, VehicleWithState } from '@/types/entities';

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
  accentColor: string;
  isDark: boolean;
  pricingCatalog: RidePricingCatalog | null;
  onClose: () => void;
  onReserve: (vehicleId: string) => void;
  onStartRide: (vehicleId: string) => void;
};

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
  accentColor,
  isDark,
  pricingCatalog,
  onClose,
  onReserve,
  onStartRide,
}: StationDetailsPanelProps) {
  const { width: screenWidth } = useWindowDimensions();
  const stationName = station?.name ?? 'Station';
  const availableCount = station?.available_vehicles ?? 0;
  const capacity = station?.capacity ?? null;
  const [filtersVisible, setFiltersVisible] = useState(false);

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
    setFiltersVisible(false);
    resetFilters();
  }, [resetFilters, station?.station_id]);

  const stationLocation = useMemo(() => {
    if (!station) return { latitude: 0, longitude: 0 };
    return { latitude: station.lat, longitude: station.lng };
  }, [station]);

  const sheetBg = isDark ? '#151718' : '#FFFFFF';
  const grabberBg = isDark ? 'rgba(255,255,255,0.24)' : 'rgba(17,24,28,0.16)';
  const closeBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.06)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,28,0.03)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.06)';
  const pillBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.05)';
  const secondaryIcon = isDark ? '#9BA1A6' : '#687076';
  const carouselGap = 12;
  const railHorizontalPadding = 2;
  const railViewport = Math.max(260, screenWidth - 32);
  const cardWidth = Math.max(248, Math.round(railViewport * 0.68));
  const snapInterval = cardWidth + carouselGap;
  const activeFilterCount = (vehicleType !== 'all' ? 1 : 0) + (batteryRange !== 'all' ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: sheetBg }]} onPress={() => {}} accessibilityRole="none">
          <View style={[styles.grabber, { backgroundColor: grabberBg }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText type="subtitle" style={styles.stationName}>
                {stationName}
              </ThemedText>
              <ThemedText style={styles.stationMeta}>Reserve a vehicle or start a ride when you are ready.</ThemedText>
            </View>
            <Pressable style={[styles.closeBtn, { backgroundColor: closeBg }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={secondaryIcon} />
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: pillBg }]}>
              <Ionicons name="flash" size={15} color={accentColor} />
              <ThemedText style={styles.statText}>
                {availableCount} available
              </ThemedText>
            </View>
            {capacity != null ? (
              <View style={[styles.statPill, { backgroundColor: pillBg }]}>
                <Ionicons name="git-branch-outline" size={15} color={secondaryIcon} />
                <ThemedText style={styles.statText}>Capacity {capacity}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.filterControlsRow}>
            <Pressable
              onPress={() => setFiltersVisible((prev) => !prev)}
              style={({ pressed }) => [
                styles.filterToggleBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(17,24,28,0.1)',
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <Ionicons name="options-outline" size={17} color={accentColor} />
              <ThemedText style={[styles.filterToggleText, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
                Filters
              </ThemedText>
              {activeFilterCount > 0 ? (
                <View style={[styles.filterCountPill, { backgroundColor: accentColor }]}>
                  <ThemedText style={styles.filterCountText}>{activeFilterCount}</ThemedText>
                </View>
              ) : null}
            </Pressable>
            {hasActiveFilters ? (
              <Pressable onPress={resetFilters} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
                <ThemedText style={[styles.resetInlineText, { color: accentColor }]}>Reset filters</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {filtersVisible ? (
            <VehicleFiltersPanel
              isDark={isDark}
              accentColor={accentColor}
              vehicleType={vehicleType}
              batteryRange={batteryRange}
              hasActiveFilters={hasActiveFilters}
              onVehicleTypeChange={setVehicleType}
              onBatteryRangeChange={setBatteryRange}
              onReset={resetFilters}
            />
          ) : null}

          {loading ? (
            <View style={[styles.feedbackWrap, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator color={LoaderAccent} />
              <ThemedText style={styles.feedbackText}>Loading vehicles at this station…</ThemedText>
            </View>
          ) : error ? (
            <View style={[styles.feedbackWrap, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#D90429" />
              <ThemedText style={[styles.feedbackText, styles.errorText]}>{error}</ThemedText>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={[styles.feedbackWrap, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="bicycle-outline" size={28} color={secondaryIcon} />
              <ThemedText style={styles.feedbackText}>
                {hasActiveFilters
                  ? 'No vehicles match your current filters. Try resetting filters.'
                  : 'No vehicles available here right now.'}
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              style={styles.vehicleRail}
              contentContainerStyle={[
                styles.vehicleRailContent,
                { gap: carouselGap, paddingHorizontal: railHorizontalPadding },
              ]}
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
                  accentHex={accentColor}
                  isDark={isDark}
                  reserveBusy={reserveBusyVehicleId === vehicle.vehicle_id}
                  startRideBusy={startRideBusyVehicleId === vehicle.vehicle_id}
                  pricingCatalog={pricingCatalog}
                  onReserve={onReserve}
                  onStartRide={onStartRide}
                />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    minHeight: 380,
    maxHeight: '88%',
    gap: 12,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  stationName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stationMeta: {
    opacity: 0.65,
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterToggleBtn: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  filterCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  resetInlineText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.92,
  },
  feedbackWrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.75,
    textAlign: 'center',
  },
  errorText: {
    color: '#D90429',
    opacity: 1,
  },
  vehicleRail: {
    flexGrow: 0,
  },
  vehicleRailContent: {
    paddingTop: 4,
    paddingBottom: 10,
    flexGrow: 0,
  },
});
