import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { IconButton } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import type { StationRow } from '@/types/entities';

type ParkingStationCardProps = {
  station: StationRow;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * During a ride, tapping a station shows its free parking here, on top of the map,
 * instead of in a blocking alert. The rider can keep looking at the map while it is open.
 */
export function ParkingStationCard({ station, onClose, style }: ParkingStationCardProps) {
  const { c } = useWayfinder();
  const spots = station.available_parking_spots ?? 0;
  const canPark = spots > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>
      <View style={[styles.badge, { backgroundColor: canPark ? c.success : c.muted }]}>
        <Text style={styles.badgeText}>P</Text>
      </View>
      <View style={styles.text}>
        <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
          {station.name ?? 'Station'}
        </Text>
        <Text style={[styles.sub, { color: canPark ? c.success : c.muted }]} numberOfLines={2}>
          {canPark
            ? `${spots} free ${spots === 1 ? 'spot' : 'spots'} · you can end your ride here`
            : 'No free parking spots here right now'}
        </Text>
      </View>
      <IconButton
        label="Close parking info"
        variant="line"
        size={36}
        onPress={onClose}
        icon={<Ionicons name="close" size={18} color={c.text} />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
  },
  badge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: FontFamily.display, fontSize: 18 },
  text: { flex: 1, minWidth: 0 },
  sub: { fontFamily: FontFamily.semibold, fontSize: 13, lineHeight: 18 },
});
