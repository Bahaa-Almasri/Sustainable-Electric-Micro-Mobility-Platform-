import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { OsmMapView } from '@/components/osm-map-view';
import type { OsmMapViewRef } from '@/components/osm-map-types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMapScreen } from '@/hooks/use-map-screen';

/**
 * Native map: OpenStreetMap-derived tiles (Leaflet in WebView). No Google / Apple map SDK.
 * Web uses `map.web.tsx`. Vehicle markers and navigation match `useMapScreen`.
 */
export default function MapScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { region, vehicles, loading, activeRide, ending, refresh, onEndRide } = useMapScreen();
  const mapRef = useRef<OsmMapViewRef>(null);
  const mapHasBeenFocusedRef = useRef(false);

  const refreshAndAnimate = useCallback(async () => {
    const { region: next, vehicles: nextVehicles } = await refresh();
    mapRef.current?.animateToRegion(next, nextVehicles);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      if (!mapHasBeenFocusedRef.current) {
        mapHasBeenFocusedRef.current = true;
        void refreshAndAnimate();
        return;
      }
      void refresh({ silent: true });
    }, [refresh, refreshAndAnimate])
  );

  const onVehiclePress = useCallback((vehicleId: string) => {
    router.push(`/vehicle/${vehicleId}` as Href);
  }, []);

  return (
    <View style={styles.flex}>
      {activeRide ? (
        <ThemedView style={[styles.banner, { borderColor: colors.tint, backgroundColor: colors.background }]}>
          <View style={styles.bannerText}>
            <ThemedText type="defaultSemiBold">Ride in progress</ThemedText>
            <ThemedText style={styles.muted}>
              {activeRide.vehicles?.model ?? 'Vehicle'} · {activeRide.vehicle_id.slice(0, 8)}…
            </ThemedText>
          </View>
          <Pressable
            style={[styles.endBtn, { backgroundColor: colors.tint }]}
            onPress={onEndRide}
            disabled={ending}>
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.endBtnText}>End ride</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}
      {loading ? (
        <ThemedView style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </ThemedView>
      ) : null}
      <OsmMapView
        ref={mapRef}
        style={styles.map}
        region={region}
        vehicles={vehicles}
        onVehiclePress={onVehiclePress}
      />
      <Pressable style={[styles.fab, { backgroundColor: colors.tint }]} onPress={refreshAndAnimate}>
        <ThemedText style={styles.fabText}>↻</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 3,
    gap: 12,
  },
  bannerText: { flex: 1, gap: 2 },
  muted: { opacity: 0.75, fontSize: 13 },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  endBtnText: { color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  fabText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
