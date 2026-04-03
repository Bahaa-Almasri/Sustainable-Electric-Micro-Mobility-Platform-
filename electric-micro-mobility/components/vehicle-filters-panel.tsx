import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { BatteryRangeFilter, VehicleTypeFilter } from '@/hooks/use-vehicle-filters';

type VehicleFiltersPanelProps = {
  isDark: boolean;
  accentColor: string;
  vehicleType: VehicleTypeFilter;
  batteryRange: BatteryRangeFilter;
  hasActiveFilters: boolean;
  onVehicleTypeChange: (next: VehicleTypeFilter) => void;
  onBatteryRangeChange: (next: BatteryRangeFilter) => void;
  onReset: () => void;
};

const VEHICLE_TYPE_OPTIONS: { label: string; value: VehicleTypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Car', value: 'car' },
  { label: 'Bike', value: 'bike' },
  { label: 'Scooter', value: 'scooter' },
];

const BATTERY_RANGE_OPTIONS: { label: string; value: BatteryRangeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: '0-25%', value: '0-25' },
  { label: '26-50%', value: '26-50' },
  { label: '51-75%', value: '51-75' },
  { label: '76-100%', value: '76-100' },
];

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor: string;
  isDark: boolean;
};

function FilterChip({ label, active, onPress, accentColor, isDark }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? accentColor : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.04)',
          borderColor: active ? accentColor : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,28,0.12)',
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <ThemedText style={[styles.chipLabel, { color: active ? '#FFFFFF' : isDark ? '#ECEDEE' : '#11181C' }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export const VehicleFiltersPanel = memo(function VehicleFiltersPanel({
  isDark,
  accentColor,
  vehicleType,
  batteryRange,
  hasActiveFilters,
  onVehicleTypeChange,
  onBatteryRangeChange,
  onReset,
}: VehicleFiltersPanelProps) {
  const panelBg = isDark ? 'rgba(255,255,255,0.05)' : '#FAFAFB';
  const panelBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,28,0.08)';
  const muted = isDark ? '#9BA1A6' : '#687076';

  return (
    <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
      <View style={styles.headerRow}>
        <View style={styles.panelTitleRow}>
          <Ionicons name="options-outline" size={16} color={muted} />
          <ThemedText style={styles.sectionTitle}>Vehicle Type</ThemedText>
        </View>
      </View>
      <View style={styles.chipRow}>
        {VEHICLE_TYPE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={vehicleType === opt.value}
            onPress={() => onVehicleTypeChange(opt.value)}
            accentColor={accentColor}
            isDark={isDark}
          />
        ))}
      </View>

      <View style={styles.separator} />

      <View style={styles.headerRow}>
        <View style={styles.panelTitleRow}>
          <Ionicons name="battery-half-outline" size={16} color={muted} />
          <ThemedText style={styles.sectionTitle}>Battery</ThemedText>
        </View>
        {hasActiveFilters ? (
          <Pressable onPress={onReset} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText style={[styles.resetLabel, { color: accentColor }]}>Reset filters</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.chipRow}>
        {BATTERY_RANGE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={batteryRange === opt.value}
            onPress={() => onBatteryRangeChange(opt.value)}
            accentColor={accentColor}
            isDark={isDark}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginVertical: 2,
  },
  resetLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
});
