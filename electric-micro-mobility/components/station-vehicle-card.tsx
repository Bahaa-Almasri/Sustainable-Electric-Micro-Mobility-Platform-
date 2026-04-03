import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { distanceMetersBetween, formatDistanceAway } from '@/lib/geo-distance';
import {
  estimateRangeKm,
  getVehicleCommerceSpecs,
  getVehicleHeroBlobGradient,
  getVehicleImageSelection,
  getVehicleImageSource,
  getVehicleVisual,
  vehicleKindFromDbType,
} from '@/lib/vehicle-image-map';
import type { VehicleWithState } from '@/types/entities';

type StationVehicleCardProps = {
  vehicle: VehicleWithState;
  cardWidth: number;
  userLocation: { latitude: number; longitude: number } | null;
  stationLocation: { latitude: number; longitude: number };
  busy: boolean;
  isDark: boolean;
  accentHex: string;
  onReserve: (vehicleId: string) => void;
  onStartRide: (vehicleId: string) => void;
};

function batteryTone(level: number | null): string {
  if (level == null) return '#8A8F98';
  if (level < 25) return '#D90429';
  if (level < 55) return '#F59F00';
  return '#1B4332';
}

function formatOperationalLine(operational: string | null | undefined): string | null {
  if (!operational) return null;
  const o = operational.toLowerCase().trim();
  if (o === 'healthy' || o === 'ok' || o === 'operational') return null;
  const pretty = operational.replace(/_/g, ' ');
  return `Status · ${pretty}`;
}

/** Dark text on light fills (e.g. dark mode tint #fff). */
function contrastingOnAccent(accentHex: string): string {
  const n = accentHex.replace('#', '').trim();
  if (n.length !== 6 || !/^[0-9a-fA-F]+$/.test(n)) return '#fff';
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  return L > 0.55 ? '#11181C' : '#FFFFFF';
}

export const StationVehicleCard = memo(function StationVehicleCard({
  vehicle,
  cardWidth,
  userLocation,
  stationLocation,
  busy,
  isDark,
  accentHex,
  onReserve,
  onStartRide,
}: StationVehicleCardProps) {
  const dbType = vehicle.vehicles?.type ?? null;
  const kind = vehicleKindFromDbType(dbType);
  const visual = getVehicleVisual(dbType);
  const imageSelection = getVehicleImageSelection(dbType);
  const imageSource = getVehicleImageSource(dbType);
  const commerce = getVehicleCommerceSpecs(dbType);
  const rangeKm = estimateRangeKm(dbType, vehicle.battery_level);
  const blobColors = getVehicleHeroBlobGradient(kind, isDark);

  const operationalLine = formatOperationalLine(vehicle.status);
  const muted = isDark ? '#9BA1A6' : '#687076';
  const strong = isDark ? '#ECEDEE' : '#11181C';
  const cardBg = isDark ? '#1E2122' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.08)';
  const innerMuted = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.05)';
  const chipBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(17,24,28,0.04)';

  const batteryPct =
    vehicle.battery_level == null || Number.isNaN(vehicle.battery_level)
      ? null
      : Math.round(vehicle.battery_level);

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

  const shortId = vehicle.vehicle_id.slice(0, 8);
  const onPrimary = contrastingOnAccent(accentHex);
  const batteryValue = batteryPct == null ? '—' : `${batteryPct}%`;
  const rangeValue = rangeKm == null ? '—' : `${rangeKm} km`;

  useEffect(() => {
    if (!__DEV__) return;
    console.info('[station-vehicle-image]', {
      vehicle_id: vehicle.vehicle_id,
      vehicle_type: dbType,
      normalized_type: imageSelection.normalizedType,
      chosen_image: imageSelection.key,
    });
  }, [dbType, imageSelection.key, imageSelection.normalizedType, vehicle.vehicle_id]);

  return (
    <View style={[styles.card, { width: cardWidth, backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.heroRow}>
        <View style={styles.headerCopy}>
          <ThemedText style={[styles.typeTitle, { color: strong }]} numberOfLines={1}>
            {visual.title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: muted }]} numberOfLines={1}>
            {operationalLine ?? visual.subtitle}
          </ThemedText>
          <ThemedText style={[styles.idLine, { color: muted }]} numberOfLines={1}>
            ID {shortId}…
          </ThemedText>
        </View>

        <View style={styles.visualColumn}>
          <LinearGradient
            colors={blobColors}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blob}
          />
          {imageSource ? (
            <Image source={imageSource} style={styles.heroImage} resizeMode="contain" accessibilityLabel={visual.title} />
          ) : (
            <View style={styles.genericFallback} accessibilityLabel="Generic mobility vehicle icon">
              <Ionicons name={visual.icon} size={44} color={isDark ? '#ECEDEE' : '#11181C'} />
            </View>
          )}
        </View>
      </View>

      <View style={[styles.metricsRow, { backgroundColor: innerMuted, borderColor: border }]}>
        <View style={styles.metricCell}>
          <View style={styles.metricHeading}>
            <Ionicons name="battery-charging-outline" size={16} color={batteryTone(vehicle.battery_level)} />
            <ThemedText style={[styles.metricValue, { color: strong }]} numberOfLines={1}>
              {batteryValue}
            </ThemedText>
          </View>
          <ThemedText style={[styles.metricLabel, { color: muted }]} numberOfLines={1}>
            Battery
          </ThemedText>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: border }]} />
        <View style={styles.metricCell}>
          <View style={styles.metricHeading}>
            <Ionicons name="flash-outline" size={16} color={accentHex} />
            <ThemedText style={[styles.metricValue, { color: strong }]} numberOfLines={1}>
              {rangeValue}
            </ThemedText>
          </View>
          <ThemedText style={[styles.metricLabel, { color: muted }]} numberOfLines={1}>
            Estimated range
          </ThemedText>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: border }]} />
        <View style={styles.metricCell}>
          <View style={styles.metricHeading}>
            <Ionicons name="navigate-outline" size={16} color={muted} />
            <ThemedText style={[styles.metricValue, { color: strong }]} numberOfLines={1}>
              {distanceLabel}
            </ThemedText>
          </View>
          <ThemedText style={[styles.metricLabel, { color: muted }]} numberOfLines={1}>
            From you
          </ThemedText>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.rateRow}>
          <ThemedText style={[styles.rateLabel, { color: muted }]}>From</ThemedText>
          <ThemedText style={[styles.rateCurrency, { color: strong }]}>$</ThemedText>
          <ThemedText style={[styles.rateAmount, { color: strong }]}>{commerce.pricePerHour}</ThemedText>
          <ThemedText style={[styles.rateUnit, { color: muted }]} numberOfLines={1}>
            / hr
          </ThemedText>
        </View>
        <View style={[styles.specChip, { backgroundColor: chipBg }]}>
          <ThemedText style={[styles.specText, { color: muted }]} numberOfLines={1}>
            {commerce.maxSpeedKmh} km/h max · {commerce.maxLoadKg} kg load
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => onReserve(vehicle.vehicle_id)}
          disabled={busy}
          style={({ pressed }) => [
            styles.secondaryBtn,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,75,65,0.45)',
              opacity: pressed && !busy ? 0.82 : 1,
            },
          ]}>
          <ThemedText style={[styles.secondaryBtnLabel, { color: accentHex }]}>Reserve</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => onStartRide(vehicle.vehicle_id)}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: accentHex, opacity: pressed && !busy ? 0.9 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color={onPrimary} />
          ) : (
            <>
              <Ionicons name="scan" size={20} color={onPrimary} style={styles.primaryIcon} />
              <ThemedText style={[styles.primaryBtnLabel, { color: onPrimary }]}>Scan to Ride</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
      web: {
        boxShadow: '0 10px 28px rgba(0,0,0,0.1)',
      },
    }),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'flex-start',
  },
  visualColumn: {
    width: 124,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  blob: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    bottom: 8,
    opacity: 0.95,
  },
  heroImage: {
    width: 126,
    height: 112,
    marginTop: 2,
  },
  genericFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,28,0.08)',
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  idLine: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
    letterSpacing: 0.15,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  metricCell: {
    flex: 1,
    gap: 3,
  },
  metricHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    alignSelf: 'center',
    height: 34,
    opacity: 0.65,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  priceRow: {
    gap: 8,
    marginTop: -2,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  rateLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    marginRight: 2,
  },
  rateCurrency: {
    fontSize: 17,
    fontWeight: '800',
  },
  rateAmount: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  rateUnit: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  specChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  specText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryBtnLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryBtn: {
    flex: 1.15,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryIcon: {
    marginRight: -2,
  },
  primaryBtnLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
});
