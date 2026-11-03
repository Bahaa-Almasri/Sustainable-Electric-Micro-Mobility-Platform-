import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { UnderlineTabs } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import type { BatteryRangeFilter, VehicleTypeFilter } from '@/hooks/use-vehicle-filters';
import { useWayfinder } from '@/hooks/use-wayfinder';

type VehicleFiltersPanelProps = {
  vehicleType: VehicleTypeFilter;
  batteryRange: BatteryRangeFilter;
  hasActiveFilters: boolean;
  onVehicleTypeChange: (next: VehicleTypeFilter) => void;
  onBatteryRangeChange: (next: BatteryRangeFilter) => void;
  onReset: () => void;
};

const VEHICLE_TYPE_OPTIONS: { label: string; value: VehicleTypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scooter', value: 'scooter' },
  { label: 'Bike', value: 'bike' },
  { label: 'Car', value: 'car' },
];

const BATTERY_RANGE_OPTIONS: { label: string; value: BatteryRangeFilter }[] = [
  { label: 'Any battery', value: 'all' },
  { label: '0-25%', value: '0-25' },
  { label: '26-50%', value: '26-50' },
  { label: '51-75%', value: '51-75' },
  { label: '76-100%', value: '76-100' },
];

export const VehicleFiltersPanel = memo(function VehicleFiltersPanel({
  vehicleType,
  batteryRange,
  hasActiveFilters,
  onVehicleTypeChange,
  onBatteryRangeChange,
  onReset,
}: VehicleFiltersPanelProps) {
  const { c } = useWayfinder();

  return (
    <View style={styles.wrap}>
      <UnderlineTabs options={VEHICLE_TYPE_OPTIONS} value={vehicleType} onChange={onVehicleTypeChange} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {BATTERY_RANGE_OPTIONS.map((opt) => {
          const active = batteryRange === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onBatteryRangeChange(opt.value)}
              style={[
                styles.chip,
                active ? { backgroundColor: c.inverse, borderColor: c.inverse } : { borderColor: c.line },
              ]}>
              <Text style={[styles.chipText, { color: active ? c.inverseText : c.text }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {hasActiveFilters ? (
        <Pressable accessibilityRole="button" onPress={onReset} hitSlop={8} style={styles.reset}>
          <Text style={[Type.secondary, styles.resetText, { color: c.accentText }]}>Reset filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center' },
  chipText: { fontFamily: FontFamily.semibold, fontSize: 13 },
  reset: { alignSelf: 'flex-start' },
  resetText: { fontFamily: FontFamily.bold },
});
