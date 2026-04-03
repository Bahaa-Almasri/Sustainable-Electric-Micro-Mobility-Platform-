import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  estimateRangeKm,
  getVehicleImageSource,
  getVehicleVisual,
} from '@/lib/vehicle-image-map';
import { fetchVehicleDetail } from '@/lib/mobility-api';
import type { RideRowWithVehicle, VehicleWithState } from '@/types/entities';

const RED = '#FF4B41';
const CARD_BG_LIGHT = '#FFFFFF';
const CARD_BG_DARK = '#1A1D1F';
const MUTED_LIGHT = '#687076';
const MUTED_DARK = '#9BA1A6';

function formatRideDuration(startIso: string | null | undefined): string {
  if (!startIso) return '00:00';
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return '00:00';
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ActiveRideBottomCardProps = {
  activeRide: RideRowWithVehicle;
  isDark: boolean;
  ending: boolean;
  onEndRide: () => void;
};

export const ActiveRideBottomCard = memo(function ActiveRideBottomCard({
  activeRide,
  isDark,
  ending,
  onEndRide,
}: ActiveRideBottomCardProps) {
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

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const battery = vehicleState?.battery_level;
  const batteryPct =
    battery == null || Number.isNaN(battery) ? null : Math.round(battery);
  const rangeKm = estimateRangeKm(vehicleType, battery ?? null);
  const timerLabel = formatRideDuration(activeRide.start_time);
  void tick;

  const cardBg = isDark ? CARD_BG_DARK : CARD_BG_LIGHT;
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.08)';
  const muted = isDark ? MUTED_DARK : MUTED_LIGHT;
  const strong = isDark ? '#ECEDEE' : '#11181C';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.06)';

  return (
    <View
      style={[
        styles.cardWrap,
        !isDark && Platform.select({ ios: SHADOW_IOS, android: SHADOW_ANDROID, web: SHADOW_WEB }),
      ]}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.topRow}>
          <View style={styles.heroCol}>
            <View style={[styles.imageShell, { backgroundColor: chipBg }]}>
              {imageSource ? (
                <Image source={imageSource} style={styles.heroImg} resizeMode="contain" />
              ) : (
                <Ionicons name="bicycle" size={36} color={muted} />
              )}
            </View>
            <View style={styles.titleBlock}>
              <ThemedText style={[styles.vehicleTitle, { color: strong }]} numberOfLines={1}>
                {visual.title}
              </ThemedText>
              <ThemedText style={[styles.subHint, { color: muted }]} numberOfLines={1}>
                Ride active · ID {activeRide.vehicle_id.slice(0, 8)}…
              </ThemedText>
            </View>
          </View>
          <View style={styles.timerBlock}>
            <ThemedText style={[styles.timerLabel, { color: muted }]}>Duration</ThemedText>
            <ThemedText style={[styles.timerValue, { color: strong }]}>{timerLabel}</ThemedText>
          </View>
        </View>

        <View style={[styles.metricsRow, { backgroundColor: chipBg }]}>
          <View style={styles.metric}>
            <Ionicons name="battery-charging-outline" size={18} color={RED} />
            <ThemedText style={[styles.metricVal, { color: strong }]}>
              {batteryPct == null ? '—' : `${batteryPct}%`}
            </ThemedText>
            <ThemedText style={[styles.metricCap, { color: muted }]}>Battery</ThemedText>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: border }]} />
          <View style={styles.metric}>
            <Ionicons name="navigate-outline" size={18} color={muted} />
            <ThemedText style={[styles.metricVal, { color: strong }]}>
              {rangeKm == null ? '—' : `~${rangeKm} km`}
            </ThemedText>
            <ThemedText style={[styles.metricCap, { color: muted }]}>Est. range</ThemedText>
          </View>
        </View>

        <Pressable
          onPress={onEndRide}
          disabled={ending}
          style={({ pressed }) => [{ opacity: pressed && !ending ? 0.92 : 1 }]}>
          <LinearGradient
            colors={['#11181C', RED]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.endBtn}>
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="stop-circle" size={22} color="#fff" style={styles.endIcon} />
                <ThemedText style={styles.endBtnText}>Stop ride</ThemedText>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
});

const SHADOW_IOS = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 24,
};
const SHADOW_ANDROID = { elevation: 10 };
const SHADOW_WEB = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
};

const styles = StyleSheet.create({
  cardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 28 : 20,
    zIndex: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  imageShell: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImg: {
    width: 68,
    height: 62,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  vehicleTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  timerBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricDivider: {
    width: 1,
    height: 36,
    opacity: 0.6,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricCap: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  endBtn: {
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endIcon: {
    marginRight: -2,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
